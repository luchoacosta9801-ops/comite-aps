// Control de labores de levante (#labores, vista 'lab', se abre desde el dashboard del Comité APS): toma del maestro
// de suertes las cosechadas (fecha del último corte) y a cada una le arma la secuencia de labores de la soca:
// alertas de despaje y reencalle, y programación de roturación y fertilización, cada una con su ventana de días
// después del corte. No entran las suertes que van a renovación (en el comité APS o en estado PROCESO del maestro).
// Datos: DB.labores {params:{dias, despaje:[d0,d1], reencalle, rotur, fert}, reg:{'HACIENDA|suerte|corte': {despaje:{p, r}, …, obs}}}
//   p = fecha programada, r = fecha en que se hizo. La clave lleva la fecha del corte: un corte nuevo empieza de cero.

const LAB_LABORES = [
  {k:'despaje',   n:'Despaje',       ico:'🍂', tipo:'alerta', col:'#b45309'},
  {k:'reencalle', n:'Reencalle',     ico:'〰️', tipo:'alerta', col:'#7c3aed'},
  {k:'rotur',     n:'Roturación',    ico:'🚜', tipo:'prog',   col:'#0369a1'},
  {k:'fert',      n:'Fertilización', ico:'🌱', tipo:'prog',   col:'#15803d'},
];
// Ventanas por defecto (días después del corte); el editor las cambia en «Parámetros»
const LAB_DEF = {dias:60, despaje:[0, 10], reencalle:[5, 15], rotur:[15, 30], fert:[25, 45]};
const LAB_EST = {
  hecha:      {n:'Hecha',      col:'#15803d', bg:'#dcfce7'},
  programada: {n:'Programada', col:'#1d4ed8', bg:'#dbeafe'},
  atrasada:   {n:'Atrasada',   col:'#c2410c', bg:'#ffedd5'},
  pendiente:  {n:'Pendiente',  col:'#a16207', bg:'#fef9c3'},
  vencida:    {n:'Vencida',    col:'#b91c1c', bg:'#fee2e2'},
  proxima:    {n:'Próxima',    col:'#64748b', bg:'#f1f5f9'},
};
const labE = {zona:'', hac:'', txt:'', filtro:'alertas', orden:'corte', progFecha:''};

function labDatos(){
  if (DB.labores === undefined && typeof SEED !== 'undefined' && SEED.labores) DB.labores = clone(SEED.labores);
  return DB.labores || {params:{}, reg:{}};
}
const labPar = () => Object.assign({}, LAB_DEF, labDatos().params || {});
const labISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const labHoy = () => labISO(new Date());
const labDias = (a, b) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 864e5);
const labLunes = iso => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return labISO(d); };

// Suertes cosechadas en los últimos N días (maestro), sin las que van a renovación
function labSuertes(){
  if (typeof msFilas !== 'function') return [];
  const P = labPar(), hoy = labHoy(), R = labDatos().reg || {};
  const renov = new Set((DB.lotes || []).map(l => l.s + '|' + norm(l.h)));
  return msFilas().filter(x => x.emp === 'RIOP' && x.ultCorte && x.estado !== 'PROCESO' && /^(CAÑA|SEMILLA)$/i.test(x.uso || '')
      && !renov.has(x.s + '|' + norm(x.hac)))
    .map(x => ({x, dd:labDias(x.ultCorte, hoy), key:`${x.hac}|${x.s}|${x.ultCorte}`}))
    .filter(o => o.dd >= 0 && o.dd <= P.dias)
    .map(o => Object.assign(o, {reg:R[o.key] || {}}));
}
// Estado de una labor en una suerte: hecha / programada / atrasada (programada y ya pasó) / pendiente (en su
// ventana) / vencida (pasó la ventana sin hacerse) / próxima (aún no empieza la ventana)
function labEstado(o, L){
  const P = labPar(), [d0, d1] = P[L.k], r = o.reg[L.k] || {}, hoy = labHoy();
  if (r.r) return {e:'hecha', t:`Hecha ${msF(r.r)}`};
  if (r.p) return r.p < hoy ? {e:'atrasada', t:`Programada ${msF(r.p)} · atrasada ${labDias(r.p, hoy)} d`} : {e:'programada', t:`Programada ${msF(r.p)}`};
  if (o.dd < d0) return {e:'proxima', t:`Empieza en ${d0 - o.dd} d`};
  if (o.dd <= d1) return {e:'pendiente', t:`Quedan ${d1 - o.dd} d`};
  return {e:'vencida', t:`Vencida hace ${o.dd - d1} d`};
}
const labUrgente = e => e === 'pendiente' || e === 'vencida' || e === 'atrasada';
// Suertes de la lista a las que se les puede aplicar en bloque: programar (sin hacer ni programar) o marcar como
// hechas (sin hacer y con la ventana ya empezada o programada)
const labBloque = (A, Lb, campo) => A.filter(o => { const r = o.reg[Lb.k] || {}, e = labEstado(o, Lb).e; return !r.r && (campo === 'p' ? !r.p : e !== 'proxima'); });

function labFiltradas(T){
  const t = norm(labE.txt);
  return T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac)
    && (!t || norm(`${o.x.s} ${o.x.hac} ${o.x.variedad || ''}`).includes(t))
    && (() => { const f = labE.filtro; if (!f) return true;
      const E = LAB_LABORES.map(L => labEstado(o, L).e);
      if (f === 'alertas') return E.some(labUrgente);
      if (f === 'vencidas') return E.some(e => e === 'vencida' || e === 'atrasada');
      if (f === 'completas') return E.every(e => e === 'hecha');
      const [k, e] = f.split(':'), i = LAB_LABORES.findIndex(L => L.k === k); return i >= 0 && (e === 'urgente' ? labUrgente(E[i]) : E[i] === e); })());
}

function renderLabores(){
  const cont = q('labores'); if (!cont) return;
  if (typeof maestroSuertes !== 'function' || !maestroSuertes()) { cont.innerHTML = '<div class="nores">Primero hay que cargar el 📚 Maestro de suertes: de ahí salen las suertes cosechadas.</div>'; return; }
  const P = labPar(), T = labSuertes(), L = labFiltradas(T), hoy = labHoy(), M = maestroSuertes(), ed = MODO_EDICION;
  const ha = A => sum(A, o => o.x.area || 0);
  const hacs = [...new Set(T.map(o => o.x.hac))].sort();
  const opt = (v, t, s) => `<option value="${esc(v)}" ${s === v ? 'selected' : ''}>${esc(t)}</option>`;
  // KPI por labor
  const kpi = LAB_LABORES.map(Lb => { const E = T.map(o => labEstado(o, Lb).e), cuenta = e => T.filter((o, i) => E[i] === e);
    const urg = T.filter((o, i) => labUrgente(E[i])), ven = T.filter((o, i) => E[i] === 'vencida' || E[i] === 'atrasada');
    return `<div class="sim-kpi lab-kpi" style="--c:${Lb.col}"><div class="l">${Lb.ico} ${Lb.n} <small>${P[Lb.k][0]}–${P[Lb.k][1]} d</small></div>
      <div class="v">${urg.length}<small> por hacer</small></div>
      <div class="s">${msN(ha(urg), 1)} ha${ven.length ? ` · <b style="color:#b91c1c">${ven.length} vencidas</b>` : ''}<br>${Lb.tipo === 'prog' ? `${cuenta('programada').length} programadas · ` : ''}${cuenta('hecha').length} hechas</div>
      <button type="button" class="plegar-todo" data-lab-filtro="${Lb.k}:urgente">Ver</button></div>`; }).join('');
  // Alertas de despaje y reencalle (las más urgentes primero)
  const alertas = [];
  T.forEach(o => LAB_LABORES.filter(Lb => Lb.tipo === 'alerta').forEach(Lb => { const s = labEstado(o, Lb); if (s.e === 'pendiente' || s.e === 'vencida') alertas.push({o, Lb, s, falta:labPar()[Lb.k][1] - o.dd}); }));
  alertas.sort((a, b) => a.falta - b.falta);
  // Programa semanal de roturación y fertilización (fechas programadas, de esta semana en adelante)
  const sem = {};
  T.forEach(o => LAB_LABORES.filter(Lb => Lb.tipo === 'prog').forEach(Lb => { const r = o.reg[Lb.k] || {}; if (!r.p || r.r) return;
    const w = r.p < hoy ? 'atrasadas' : labLunes(r.p); const s = sem[w] = sem[w] || {}; const z = s[Lb.k] = s[Lb.k] || {n:0, a:0}; z.n++; z.a += o.x.area || 0; }));
  const semanas = Object.keys(sem).sort((a, b) => a === 'atrasadas' ? -1 : b === 'atrasadas' ? 1 : a < b ? -1 : 1);
  // Tabla
  const ord = [...L].sort((a, b) => labE.orden === 'hac' ? (a.x.hac + a.x.s).localeCompare(b.x.hac + b.x.s) : labE.orden === 'area' ? (b.x.area || 0) - (a.x.area || 0) : b.dd - a.dd);
  const celda = (o, Lb) => { const s = labEstado(o, Lb), E = LAB_EST[s.e], r = o.reg[Lb.k] || {}, k = esc(o.key + '|' + Lb.k);
    return `<td class="lab-c"><span class="lab-chip" style="color:${E.col};background:${E.bg}" title="${esc(s.t)}">${E.n}</span><small class="lab-t">${esc(s.t)}</small>
      ${ed ? `<div class="lab-ed">${Lb.tipo === 'prog' ? `<label title="Fecha programada">Prog.<input type="date" data-lab="${k}|p" value="${esc(r.p || '')}"></label>` : ''}
        <label title="Fecha en que se hizo">Hecha<input type="date" data-lab="${k}|r" value="${esc(r.r || '')}"></label>${!r.r ? `<button type="button" class="plegar-todo" data-lab-hoy="${k}" title="Marcar como hecha hoy">✓ Hoy</button>` : ''}</div>` : ''}</td>`; };
  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">🚜 Control de labores · levante de socas</div>
      <div class="sim-subt">Suertes cosechadas en los últimos <b>${P.dias} días</b> según el maestro (${esc(M.fecha || M.archivo || '')}) · ${T.length} suertes · ${msN(ha(T), 1)} ha. No incluye las que van a renovación.</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="plegar-todo" data-ir="aps">📊 Dashboard Comité APS</button><button type="button" class="plegar-todo" data-lab-excel>📊 Excel</button></div></div>
    <div class="sim-kpis lab-kpis">${kpi}</div>
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>🔔 Alertas de despaje y reencalle</b> <span class="meta">· ${alertas.length}</span></div>
        <div class="lab-alertas">${alertas.slice(0, 40).map(a => `<div class="lab-al ${a.s.e}"><b>${esc(a.Lb.ico)} ${esc(a.Lb.n)}</b> · <span class="b">${esc(a.o.x.s)}</span> ${esc(msHacN(a.o.x.hac))} · ${msN(a.o.x.area, 2)} ha <span class="meta">· cortada hace ${a.o.dd} d</span><span class="lab-al-t">${esc(a.s.t)}</span></div>`).join('') || '<div class="nores">Sin alertas: todo al día ✓</div>'}
        ${alertas.length > 40 ? `<div class="meta" style="padding:6px 12px">… y ${alertas.length - 40} más (filtra la tabla por «Con alertas»)</div>` : ''}</div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>📅 Programa de roturación y fertilización</b> <span class="meta">· por semana</span></div>
        <div class="sim-tw"><table class="sim-t"><thead><tr><th>Semana</th><th class="n">🚜 Roturación</th><th class="n">🌱 Fertilización</th></tr></thead><tbody>
        ${semanas.map(w => { const s = sem[w], c = k => s[k] ? `${s[k].n} st · <b>${msN(s[k].a, 1)} ha</b>` : '<span class="meta">—</span>';
          return `<tr${w === 'atrasadas' ? ' style="background:#fff7ed"' : ''}><td>${w === 'atrasadas' ? '<b style="color:#c2410c">Atrasadas</b>' : `Semana del ${msF(w)}`}</td><td class="n">${c('rotur')}</td><td class="n">${c('fert')}</td></tr>`; }).join('') || '<tr><td colspan="3" class="nores">Aún no hay labores programadas.</td></tr>'}</tbody></table></div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Suertes cosechadas</b> <span class="meta">· ${L.length} de ${T.length} · ${msN(ha(L), 1)} ha</span></div>
      <div class="lab-filtros">
        <select id="lab-zona">${opt('', 'Todas las zonas', labE.zona)}${opt('1', 'Zona 1', labE.zona)}${opt('2', 'Zona 2', labE.zona)}</select>
        <select id="lab-hac">${opt('', 'Todas las haciendas', labE.hac)}${hacs.map(h => opt(h, msHacN(h), labE.hac)).join('')}</select>
        <select id="lab-filtro">${opt('', 'Todas', labE.filtro)}${opt('alertas', 'Con algo por hacer', labE.filtro)}${opt('vencidas', 'Con vencidas o atrasadas', labE.filtro)}${opt('completas', 'Con todo hecho', labE.filtro)}
          ${LAB_LABORES.map(Lb => opt(Lb.k + ':urgente', `${Lb.n}: por hacer`, labE.filtro) + opt(Lb.k + ':programada', `${Lb.n}: programada`, labE.filtro) + opt(Lb.k + ':hecha', `${Lb.n}: hecha`, labE.filtro)).join('')}</select>
        <select id="lab-orden">${opt('corte', 'Más antiguas primero', labE.orden)}${opt('hac', 'Por hacienda', labE.orden)}${opt('area', 'Por área', labE.orden)}</select>
        <input id="lab-txt" class="pr-buscar" placeholder="Buscar suerte, hacienda o variedad…" value="${esc(labE.txt)}"></div>
      ${ed ? `<div class="lab-prog"><b>En bloque</b> <span class="meta">· aplica a las suertes que muestra la tabla con estos filtros</span>
        <div>Fecha <input type="date" id="lab-pf" value="${esc(labE.progFecha || hoy)}"> <span class="meta">Programar:</span>
          ${LAB_LABORES.filter(Lb => Lb.tipo === 'prog').map(Lb => { const n = labBloque(L, Lb, 'p').length; return `<button type="button" class="plegar-todo" data-lab-bloque="${Lb.k}|p" ${n ? '' : 'disabled'}>${Lb.ico} ${Lb.n} (${n})</button>`; }).join('')}
          <span class="meta">Marcar como hechas:</span>
          ${LAB_LABORES.map(Lb => { const n = labBloque(L, Lb, 'r').length; return `<button type="button" class="plegar-todo" data-lab-bloque="${Lb.k}|r" ${n ? '' : 'disabled'}>✓ ${Lb.n} (${n})</button>`; }).join('')}</div></div>` : ''}
      <div class="sim-tw" style="max-height:640px"><table class="sim-t lab-tab"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Zona</th><th class="n">Área</th><th>Variedad · corte</th><th>Cosechada</th>${LAB_LABORES.map(Lb => `<th>${Lb.ico} ${Lb.n}<br><small class="meta">${P[Lb.k][0]}–${P[Lb.k][1]} d</small></th>`).join('')}</tr></thead>
      <tbody>${ord.map(o => `<tr><td class="b" style="font-family:var(--mono)">${esc(o.x.s)}</td><td>${esc(msHacN(o.x.hac))}</td><td>${esc(o.x.zona ?? '')}</td><td class="n">${msN(o.x.area, 2)}</td>
        <td>${esc(o.x.variedad || '—')}<br><small class="meta">corte ${msN(o.x.nCorte)}</small></td><td>${msF(o.x.ultCorte)}<br><small class="meta">hace ${o.dd} d</small></td>${LAB_LABORES.map(Lb => celda(o, Lb)).join('')}</tr>`).join('') || `<tr><td colspan="${6 + LAB_LABORES.length}" class="nores">Ninguna suerte con esos filtros.</td></tr>`}</tbody></table></div></div>
    ${ed ? `<div class="sim-card"><div class="sim-card-h"><b>⚙️ Parámetros</b> <span class="meta">· ventanas en días después del corte</span></div><div class="sim-card-b lab-par">
      <label>Suertes cosechadas en los últimos<input type="number" min="15" max="365" data-lab-par="dias" value="${P.dias}"> días</label>
      ${LAB_LABORES.map(Lb => `<label>${Lb.ico} ${Lb.n}: del día<input type="number" min="0" max="365" data-lab-par="${Lb.k}|0" value="${P[Lb.k][0]}">al<input type="number" min="0" max="365" data-lab-par="${Lb.k}|1" value="${P[Lb.k][1]}"></label>`).join('')}
      <button type="button" class="plegar-todo" data-lab-par-def>↺ Valores por defecto</button></div></div>` : ''}`;
}

// Cambios (solo en modo editor): fechas por suerte y labor, programación en bloque y parámetros
function labPoner(key, k, campo, valor){
  modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.reg = D.reg || {};
    const r = D.reg[key] = D.reg[key] || {}, x = r[k] = r[k] || {};
    if (valor) x[campo] = valor; else delete x[campo];
    if (!Object.keys(x).length) delete r[k]; if (!Object.keys(r).length) delete D.reg[key];
    labLimpiar(D); });
}
// Se borran los registros de cortes viejos (fuera de la ventana y con todo terminado o sin nada), para no crecer sin fin
function labLimpiar(D){
  const vivas = new Set(labSuertes().map(o => o.key));
  Object.keys(D.reg).forEach(k => { if (!vivas.has(k) && labDias(k.split('|')[2], labHoy()) > 400) delete D.reg[k]; });
}
q('labores').addEventListener('click', e => {
  const t = e.target;
  const ir = t.closest('[data-ir]'); if (ir) { irA(ir.dataset.ir); return; }
  if (t.closest('[data-lab-excel]')) { labExcel(); return; }
  const f = t.closest('[data-lab-filtro]'); if (f) { labE.filtro = f.dataset.labFiltro; renderLabores(); q('lab-filtro') && q('lab-filtro').scrollIntoView({block:'center', behavior:'smooth'}); return; }
  const h = t.closest('[data-lab-hoy]'); if (h) { const p = h.dataset.labHoy.split('|'); labPoner(p.slice(0, 3).join('|'), p[3], 'r', labHoy()); return; }
  const b = t.closest('[data-lab-bloque]');
  if (b) { const [k, campo] = b.dataset.labBloque.split('|'), Lb = LAB_LABORES.find(x => x.k === k), fe = (q('lab-pf') || {}).value; if (!fe) { toast('⚠ Elige la fecha'); return; }
    const A = labBloque(labFiltradas(labSuertes()), Lb, campo), que = campo === 'p' ? `¿Programar ${Lb.n.toLowerCase()} para el ${msF(fe)}` : `¿Marcar ${Lb.n.toLowerCase()} como hecha el ${msF(fe)}`;
    if (!A.length || !confirm(`${que} en ${A.length} suertes (${msN(sum(A, o => o.x.area || 0), 1)} ha)?`)) return;
    labE.progFecha = fe;
    modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.reg = D.reg || {}; A.forEach(o => { const r = D.reg[o.key] = D.reg[o.key] || {}; (r[k] = r[k] || {})[campo] = fe; }); });
    toast(`✓ ${A.length} suertes ${campo === 'p' ? 'programadas' : 'marcadas como hechas'} · recuerda 🚀 Publicar`); return; }
  if (t.closest('[data-lab-par-def]')) { modCambio(() => { if (DB.labores) delete DB.labores.params; }); return; }
});
q('labores').addEventListener('change', e => {
  const t = e.target;
  const d = t.dataset.lab; if (d) { const p = d.split('|'); labPoner(p.slice(0, 3).join('|'), p[3], p[4], t.value); return; }
  const pa = t.dataset.labPar;
  if (pa) { const v = Math.max(0, Math.round(+t.value || 0)); modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; const P = D.params = Object.assign({}, labPar(), D.params || {});
    if (pa === 'dias') P.dias = Math.max(15, v); else { const [k, i] = pa.split('|'); P[k] = [...P[k]]; P[k][+i] = v; if (P[k][0] > P[k][1]) P[k] = [P[k][1], P[k][0]]; } }); return; }
  if (t.id === 'lab-pf') { labE.progFecha = t.value; return; }
  const k = {'lab-zona':'zona', 'lab-hac':'hac', 'lab-filtro':'filtro', 'lab-orden':'orden'}[t.id]; if (k) { labE[k] = t.value; renderLabores(); }
});
let labEspera = 0;
q('labores').addEventListener('input', e => { if (e.target.id === 'lab-txt') { labE.txt = e.target.value; clearTimeout(labEspera); labEspera = setTimeout(() => redibujarConservando('lab-txt', renderLabores), 250); } });

function labExcel(){
  cargarXLSX().then(XLSX => {
    const L = labFiltradas(labSuertes()), wb = XLSX.utils.book_new(), P = labPar();
    const cab = ['Suerte', 'Hacienda', 'Zona', 'Área (ha)', 'Variedad', 'Corte', 'Fecha de cosecha', 'Días desde el corte'];
    LAB_LABORES.forEach(Lb => cab.push(`${Lb.n} (${P[Lb.k][0]}–${P[Lb.k][1]} d)`, `${Lb.n} programada`, `${Lb.n} hecha`));
    const filas = [cab, ...L.map(o => { const f = [o.x.s, msHacN(o.x.hac), o.x.zona, +(o.x.area || 0).toFixed(2), o.x.variedad || '', o.x.nCorte ?? '', o.x.ultCorte, o.dd];
      LAB_LABORES.forEach(Lb => { const r = o.reg[Lb.k] || {}; f.push(LAB_EST[labEstado(o, Lb).e].n, r.p || '', r.r || ''); }); return f; })];
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, filas), 'Labores');
    XLSX.writeFile(wb, `control-labores-${labHoy()}.xlsx`);
  });
}

// Resumen para el Inge Virtual y la tarjeta del portal
function labResumen(){
  const T = labSuertes();
  return {n:T.length, ha:sum(T, o => o.x.area || 0), L:LAB_LABORES.map(Lb => { const E = T.map(o => labEstado(o, Lb).e);
    const de = f => T.filter((o, i) => f(E[i]));
    return {Lb, urg:de(labUrgente), ven:de(e => e === 'vencida' || e === 'atrasada'), prog:de(e => e === 'programada'), hecha:de(e => e === 'hecha')}; })};
}

// El portal se dibujó antes de cargar este archivo: se redibuja para mostrar la tarjeta y la vista de labores
if (['lab', 'portal'].includes(vistaActual)) renderVista();
