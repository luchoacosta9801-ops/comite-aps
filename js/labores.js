// Control de labores de levante (#labores, vista 'lab', se abre desde el dashboard del Comité APS).
// Base: el reporte de labores pendientes de Operaciones Campo · Levante (labores_pendientes_AAAA-MM-DD.xlsx, hoja BD,
// en Documents\OPERACIONES CAMPO - LEVANTE): una fila por suerte cosechada (o por corte parcial) con el área pendiente
// de 1ra labor (roturación), 2da labor y fertilización: columnas H, K y N: área > 0 = pendiente; 0 o vacía = hecha.
// Se cruza con el maestro de suertes (hacienda, variedad, número de corte) y se suman las suertes que el maestro da
// por cosechadas en los últimos N días y que el reporte aún no trae. Despaje y reencalle son alertas por días
// después del corte (no vienen en el reporte; si ya se roturó, se dan por hechas).
// Datos: DB.levante {archivo, fecha (del reporte), filas:[{s, z, za, a, f (corte), r1, r2, fe, tipo, i1, c1, i2, c2, cf}]}
//        DB.labores {params:{dias, despaje:[d0,d1], …}, reg:{'suerte|corte': {labor:{p, r}}}}  (p = programada, r = hecha)
// Las fechas de corte del reporte se calculan con la columna Días (desde la fecha del reporte), porque la columna
// Fecha Inicio viene mezclada: texto dd/mm/aaaa y fechas que Excel volteó (día por mes).

const LAB_LABORES = [
  {k:'despaje',   n:'Despaje',        ico:'🍂', tipo:'alerta', col:'#b45309'},
  {k:'reencalle', n:'Reencalle',      ico:'〰️', tipo:'alerta', col:'#7c3aed'},
  {k:'rotur',     n:'1ra roturación', ico:'🚜', tipo:'prog',   col:'#0369a1', bd:'r1'},
  {k:'rotur2',    n:'2da roturación', ico:'🚜', tipo:'prog',   col:'#0e7490', bd:'r2'},
  {k:'fert',      n:'Fertilización',  ico:'🌱', tipo:'prog',   col:'#15803d', bd:'fe'},
];
// Ventanas por defecto (días después del corte); el editor las cambia en «Parámetros»
const LAB_DEF = {dias:60, despaje:[0, 10], reencalle:[5, 15], rotur:[15, 30], rotur2:[30, 50], fert:[25, 45]};
const LAB_EST = {
  hecha:      {n:'Hecha',      col:'#15803d', bg:'#dcfce7'},
  programada: {n:'Programada', col:'#1d4ed8', bg:'#dbeafe'},
  atrasada:   {n:'Atrasada',   col:'#c2410c', bg:'#ffedd5'},
  pendiente:  {n:'Pendiente',  col:'#a16207', bg:'#fef9c3'},
  vencida:    {n:'Vencida',    col:'#b91c1c', bg:'#fee2e2'},
  proxima:    {n:'Próxima',    col:'#64748b', bg:'#f1f5f9'},
  noaplica:   {n:'No aplica',  col:'#94a3b8', bg:'#f8fafc'},
};
const labE = {zona:'', hac:'', txt:'', filtro:'alertas', orden:'corte', progFecha:'', fuente:''};

function labDatos(){
  if (DB.labores === undefined && typeof SEED !== 'undefined' && SEED.labores) DB.labores = clone(SEED.labores);
  return DB.labores || {params:{}, reg:{}};
}
function labReporte(){
  if (DB.levante === undefined && typeof SEED !== 'undefined' && SEED.levante) DB.levante = clone(SEED.levante);
  return DB.levante || null;
}
const labPar = () => Object.assign({}, LAB_DEF, labDatos().params || {});
const labISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const labHoy = () => labISO(new Date());
const labDias = (a, b) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 864e5);
const labMenos = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - n); return labISO(d); };
const labLunes = iso => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return labISO(d); };

// Suertes del control: las del reporte (cada corte) + las cosechadas según el maestro que el reporte no trae
function labSuertes(){
  if (typeof msFilas !== 'function') return [];
  const P = labPar(), hoy = labHoy(), R = labDatos().reg || {}, B = labReporte();
  const ms = msFilas().filter(x => x.emp === 'RIOP'), porCod = {};
  ms.forEach(x => { const o = porCod[x.s]; if (!o || (/^CAÑA$/i.test(x.uso || '') && !/^CAÑA$/i.test(o.uso || ''))) porCod[x.s] = x; });
  const out = [];
  if (B) B.filas.forEach(f => { const m = porCod[f.s] || {};
    out.push({x:{s:f.s, hac:m.hac || '', zona:f.z ?? m.zona, area:f.a, variedad:m.variedad, nCorte:m.nCorte, ultCorte:f.f, zonaAgro:f.za || m.zonaAgro, tipo:f.tipo},
      bd:f, fuente:'reporte'}); });
  const renov = new Set((DB.lotes || []).map(l => l.s + '|' + norm(l.h)));
  ms.filter(x => x.ultCorte && x.estado !== 'PROCESO' && /^(CAÑA|SEMILLA)$/i.test(x.uso || '') && !renov.has(x.s + '|' + norm(x.hac)))
    .forEach(x => { const dd = labDias(x.ultCorte, hoy); if (dd < 0 || dd > P.dias) return;
      // Ya está en el reporte si trae esa suerte con un corte de la misma fecha o posterior (±10 días)
      if (B && B.filas.some(f => f.s === x.s && labDias(x.ultCorte, f.f) >= -10)) return;
      out.push({x:{s:x.s, hac:x.hac, zona:x.zona, area:x.area, variedad:x.variedad, nCorte:x.nCorte, ultCorte:x.ultCorte, zonaAgro:x.zonaAgro}, bd:null, fuente:'maestro'}); });
  return out.map(o => Object.assign(o, {dd:labDias(o.x.ultCorte, hoy), key:`${o.x.s}|${o.x.ultCorte}`}))
    .map(o => Object.assign(o, {reg:R[o.key] || {}}));
}
// Estado de una labor en una suerte. Orden: hecha a mano → hecha según el reporte (0) → no aplica (casilla vacía) →
// programada (o atrasada si ya pasó la fecha) → por días después del corte: próxima / pendiente / vencida
function labEstado(o, L){
  const P = labPar(), [d0, d1] = P[L.k], r = o.reg[L.k] || {}, hoy = labHoy(), v = o.bd && L.bd ? o.bd[L.bd] : undefined;
  if (r.r) return {e:'hecha', t:`Hecha ${msF(r.r)}`};
  if (o.bd && L.bd && !(v > 0)) return {e:'hecha', t:'Hecha según el reporte'};   // 0 o casilla vacía = hecha
  if (L.tipo === 'alerta' && o.dd > P.dias) return {e:'noaplica', t:`Corte de hace más de ${P.dias} días: sin seguimiento`};
  if (L.tipo === 'alerta' && o.bd && !(o.bd.r1 > 0)) return {e:'hecha', t:'Se da por hecha: ya se roturó'};
  const pend = v > 0 ? ` · ${msN(v, 2)} ha pendientes` : '';
  if (r.p) return r.p < hoy ? {e:'atrasada', t:`Programada ${msF(r.p)} · atrasada ${labDias(r.p, hoy)} d${pend}`} : {e:'programada', t:`Programada ${msF(r.p)}${pend}`};
  if (o.dd < d0) return {e:'proxima', t:`Empieza en ${d0 - o.dd} d${pend}`};
  if (o.dd <= d1) return {e:'pendiente', t:`Quedan ${d1 - o.dd} d${pend}`};
  return {e:'vencida', t:`Vencida hace ${o.dd - d1} d${pend}`};
}
const labUrgente = e => e === 'pendiente' || e === 'vencida' || e === 'atrasada';
// Por hacer: todo lo que no está hecho ni «no aplica» (incluye próximas y programadas); así cuadra con el reporte
const labPorHacer = e => e !== 'hecha' && e !== 'noaplica';
// Área que falta de una labor: la del reporte si la trae, si no el área de la suerte
const labHa = (o, L) => o.bd && L.bd && o.bd[L.bd] > 0 ? o.bd[L.bd] : (o.x.area || 0);
// Suertes de la lista a las que se les puede aplicar en bloque: programar (sin hacer ni programar) o marcar como
// hechas (sin hacer y con la ventana ya empezada o programada)
const labBloque = (A, Lb, campo) => A.filter(o => { const r = o.reg[Lb.k] || {}, e = labEstado(o, Lb).e; return e !== 'hecha' && e !== 'noaplica' && (campo === 'p' ? !r.p : e !== 'proxima'); });

function labFiltradas(T){
  const t = norm(labE.txt);
  return T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac) && (!labE.fuente || o.fuente === labE.fuente)
    && (!t || norm(`${o.x.s} ${o.x.hac} ${o.x.variedad || ''} ${o.x.zonaAgro || ''}`).includes(t))
    && (() => { const f = labE.filtro; if (!f) return true;
      const E = LAB_LABORES.map(L => labEstado(o, L).e);
      if (f === 'alertas') return E.some(labPorHacer);
      if (f === 'vencidas') return E.some(e => e === 'vencida' || e === 'atrasada');
      if (f === 'completas') return E.every(e => e === 'hecha' || e === 'noaplica');
      const [k, e] = f.split(':'), i = LAB_LABORES.findIndex(L => L.k === k); return i >= 0 && (e === 'urgente' ? labPorHacer(E[i]) : E[i] === e); })());
}

function renderLabores(){
  const cont = q('labores'); if (!cont) return;
  const B = labReporte(), ed = MODO_EDICION;
  if (typeof maestroSuertes !== 'function' || (!maestroSuertes() && !B)) { cont.innerHTML = `<div class="nores">Carga el reporte de labores pendientes de levante o el 📚 Maestro de suertes.${ed ? labCargaHTML() : ''}</div>`; return; }
  const P = labPar(), T = labSuertes(), L = labFiltradas(T), hoy = labHoy(), M = maestroSuertes();
  const ha = A => sum(A, o => o.x.area || 0), haL = (A, Lb) => sum(A, o => labHa(o, Lb));
  const hacs = [...new Set(T.map(o => o.x.hac).filter(Boolean))].sort();
  const opt = (v, t, s) => `<option value="${esc(v)}" ${s === v ? 'selected' : ''}>${esc(t)}</option>`;
  const nRep = T.filter(o => o.fuente === 'reporte').length, nMs = T.length - nRep;
  // KPI por labor
  const kpi = LAB_LABORES.map(Lb => { const E = T.map(o => labEstado(o, Lb).e), cuenta = e => T.filter((o, i) => E[i] === e);
    const urg = T.filter((o, i) => labPorHacer(E[i])), ven = T.filter((o, i) => E[i] === 'vencida' || E[i] === 'atrasada');
    return `<div class="sim-kpi lab-kpi" style="--c:${Lb.col}"><div class="l">${Lb.ico} ${Lb.n} <small>${P[Lb.k][0]}–${P[Lb.k][1]} d</small></div>
      <div class="v">${msN(haL(urg, Lb), 1)}<small> ha pendientes</small></div>
      <div class="s">${urg.length} suertes${ven.length ? ` · <b style="color:#b91c1c">${ven.length} vencidas</b>` : ''}<br>${Lb.tipo === 'prog' ? `${cuenta('programada').length} programadas · ` : ''}${cuenta('hecha').length} hechas</div>
      <button type="button" class="plegar-todo" data-lab-filtro="${Lb.k}:urgente">Ver</button></div>`; }).join('');
  // Alertas de despaje y reencalle (las más urgentes primero)
  const alertas = [];
  T.forEach(o => LAB_LABORES.filter(Lb => Lb.tipo === 'alerta').forEach(Lb => { const s = labEstado(o, Lb); if (s.e === 'pendiente' || s.e === 'vencida') alertas.push({o, Lb, s, falta:P[Lb.k][1] - o.dd}); }));
  alertas.sort((a, b) => a.falta - b.falta);
  // Programa semanal de roturación y fertilización (fechas programadas, de esta semana en adelante)
  const PROG = LAB_LABORES.filter(Lb => Lb.tipo === 'prog'), sem = {};
  T.forEach(o => PROG.forEach(Lb => { const r = o.reg[Lb.k] || {}, e = labEstado(o, Lb).e; if (!r.p || e === 'hecha' || e === 'noaplica') return;
    const w = r.p < hoy ? 'atrasadas' : labLunes(r.p); const s = sem[w] = sem[w] || {}; const z = s[Lb.k] = s[Lb.k] || {n:0, a:0}; z.n++; z.a += labHa(o, Lb); }));
  const semanas = Object.keys(sem).sort((a, b) => a === 'atrasadas' ? -1 : b === 'atrasadas' ? 1 : a < b ? -1 : 1);
  // Tabla
  const ord = [...L].sort((a, b) => labE.orden === 'hac' ? (a.x.hac + a.x.s).localeCompare(b.x.hac + b.x.s) : labE.orden === 'area' ? (b.x.area || 0) - (a.x.area || 0) : labE.orden === 'nuevas' ? a.dd - b.dd : b.dd - a.dd);
  const celda = (o, Lb) => { const s = labEstado(o, Lb), E = LAB_EST[s.e], r = o.reg[Lb.k] || {}, k = esc(o.key), cerrada = s.e === 'noaplica' || (s.e === 'hecha' && !r.r);
    return `<td class="lab-c"><span class="lab-chip" style="color:${E.col};background:${E.bg}" title="${esc(s.t)}">${E.n}</span><small class="lab-t">${esc(s.t)}</small>
      ${ed && !cerrada ? `<div class="lab-ed">${Lb.tipo === 'prog' ? `<label title="Fecha programada">Prog.<input type="date" data-lab="${k}" data-labk="${Lb.k}" data-labc="p" value="${esc(r.p || '')}"></label>` : ''}
        <label title="Fecha en que se hizo">Hecha<input type="date" data-lab="${k}" data-labk="${Lb.k}" data-labc="r" value="${esc(r.r || '')}"></label>${!r.r ? `<button type="button" class="plegar-todo" data-lab-hoy="${k}" data-labk="${Lb.k}" title="Marcar como hecha hoy">✓ Hoy</button>` : ''}</div>` : ''}</td>`; };
  const origen = B ? `Reporte de levante <b>${esc(B.archivo)}</b> (${msF(B.fecha)}): ${nRep} cortes` : '<b style="color:#b45309">Sin reporte de levante cargado</b>';
  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">🚜 Control de labores · levante de socas</div>
      <div class="sim-subt">${origen}${nMs ? ` · + ${nMs} cosechadas según el maestro (${esc((M && (M.fecha || M.archivo)) || '')}) que el reporte aún no trae` : ''} · ${msN(ha(T), 1)} ha. Cruce con el maestro para hacienda, variedad y corte.</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="plegar-todo" data-ir="aps">📊 Dashboard Comité APS</button><button type="button" class="plegar-todo" data-lab-excel>📊 Excel</button></div></div>
    ${ed ? labCargaHTML() : ''}
    <div class="sim-kpis lab-kpis">${kpi}</div>
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>🔔 Alertas de despaje y reencalle</b> <span class="meta">· ${alertas.length}</span></div>
        <div class="lab-alertas">${alertas.slice(0, 40).map(a => `<div class="lab-al ${a.s.e}"><b>${esc(a.Lb.ico)} ${esc(a.Lb.n)}</b> · <span class="b">${esc(a.o.x.s)}</span> ${esc(msHacN(a.o.x.hac))} · ${msN(a.o.x.area, 2)} ha <span class="meta">· cortada hace ${a.o.dd} d</span><span class="lab-al-t">${esc(a.s.t)}</span></div>`).join('') || '<div class="nores">Sin alertas: todo al día ✓</div>'}
        ${alertas.length > 40 ? `<div class="meta" style="padding:6px 12px">… y ${alertas.length - 40} más (filtra la tabla por «Con algo por hacer»)</div>` : ''}</div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>📅 Programa de roturación y fertilización</b> <span class="meta">· por semana</span></div>
        <div class="sim-tw"><table class="sim-t"><thead><tr><th>Semana</th>${PROG.map(Lb => `<th class="n">${Lb.ico} ${Lb.n}</th>`).join('')}</tr></thead><tbody>
        ${semanas.map(w => { const s = sem[w], c = k => s[k] ? `${s[k].n} st · <b>${msN(s[k].a, 1)} ha</b>` : '<span class="meta">—</span>';
          return `<tr${w === 'atrasadas' ? ' style="background:#fff7ed"' : ''}><td>${w === 'atrasadas' ? '<b style="color:#c2410c">Atrasadas</b>' : `Semana del ${msF(w)}`}</td>${PROG.map(Lb => `<td class="n">${c(Lb.k)}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${PROG.length + 1}" class="nores">Aún no hay labores programadas.</td></tr>`}</tbody></table></div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Suertes cosechadas</b> <span class="meta">· ${L.length} de ${T.length} · ${msN(ha(L), 1)} ha</span></div>
      <div class="lab-filtros">
        <select id="lab-zona">${opt('', 'Todas las zonas', labE.zona)}${opt('1', 'Zona 1', labE.zona)}${opt('2', 'Zona 2', labE.zona)}</select>
        <select id="lab-hac">${opt('', 'Todas las haciendas', labE.hac)}${hacs.map(h => opt(h, msHacN(h), labE.hac)).join('')}</select>
        <select id="lab-fuente">${opt('', 'Reporte y maestro', labE.fuente)}${opt('reporte', 'Solo las del reporte', labE.fuente)}${opt('maestro', 'Solo las que el reporte no trae', labE.fuente)}</select>
        <select id="lab-filtro">${opt('', 'Todas', labE.filtro)}${opt('alertas', 'Con algo pendiente', labE.filtro)}${opt('vencidas', 'Con vencidas o atrasadas', labE.filtro)}${opt('completas', 'Con todo hecho', labE.filtro)}
          ${LAB_LABORES.map(Lb => opt(Lb.k + ':urgente', `${Lb.n}: pendiente`, labE.filtro) + opt(Lb.k + ':programada', `${Lb.n}: programada`, labE.filtro) + opt(Lb.k + ':hecha', `${Lb.n}: hecha`, labE.filtro)).join('')}</select>
        <select id="lab-orden">${opt('corte', 'Más antiguas primero', labE.orden)}${opt('nuevas', 'Más recientes primero', labE.orden)}${opt('hac', 'Por hacienda', labE.orden)}${opt('area', 'Por área', labE.orden)}</select>
        <input id="lab-txt" class="pr-buscar" placeholder="Buscar suerte, hacienda, variedad o zona agroecológica…" value="${esc(labE.txt)}"></div>
      ${ed ? `<div class="lab-prog"><b>En bloque</b> <span class="meta">· aplica a las suertes que muestra la tabla con estos filtros</span>
        <div>Fecha <input type="date" id="lab-pf" value="${esc(labE.progFecha || hoy)}"> <span class="meta">Programar:</span>
          ${PROG.map(Lb => { const n = labBloque(L, Lb, 'p').length; return `<button type="button" class="plegar-todo" data-lab-bloque="${Lb.k}|p" ${n ? '' : 'disabled'}>${Lb.ico} ${Lb.n} (${n})</button>`; }).join('')}
          <span class="meta">Marcar como hechas:</span>
          ${LAB_LABORES.map(Lb => { const n = labBloque(L, Lb, 'r').length; return `<button type="button" class="plegar-todo" data-lab-bloque="${Lb.k}|r" ${n ? '' : 'disabled'}>✓ ${Lb.n} (${n})</button>`; }).join('')}</div></div>` : ''}
      <div class="sim-tw" style="max-height:640px"><table class="sim-t lab-tab"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Zona</th><th class="n">Área</th><th>Variedad · corte</th><th>Cosechada</th>${LAB_LABORES.map(Lb => `<th>${Lb.ico} ${Lb.n}<br><small class="meta">${P[Lb.k][0]}–${P[Lb.k][1]} d</small></th>`).join('')}</tr></thead>
      <tbody>${ord.map(o => `<tr><td class="b" style="font-family:var(--mono)">${esc(o.x.s)}${o.fuente === 'maestro' ? '<br><small class="lab-fu" title="Cosechada según el maestro; aún no está en el reporte de levante">maestro</small>' : ''}</td><td>${esc(msHacN(o.x.hac)) || '<span class="meta">—</span>'}</td><td>${esc(o.x.zona ?? '')}${o.x.zonaAgro ? `<br><small class="meta">${esc(o.x.zonaAgro)}</small>` : ''}</td><td class="n">${msN(o.x.area, 2)}</td>
        <td>${esc(o.x.variedad || '—')}<br><small class="meta">${o.x.nCorte != null ? 'corte ' + msN(o.x.nCorte) : esc(o.x.tipo || '')}</small></td><td>${msF(o.x.ultCorte)}<br><small class="meta">hace ${o.dd} d</small></td>${LAB_LABORES.map(Lb => celda(o, Lb)).join('')}</tr>`).join('') || `<tr><td colspan="${6 + LAB_LABORES.length}" class="nores">Ninguna suerte con esos filtros.</td></tr>`}</tbody></table></div></div>
    ${ed ? `<div class="sim-card"><div class="sim-card-h"><b>⚙️ Parámetros</b> <span class="meta">· ventanas en días después del corte</span></div><div class="sim-card-b lab-par">
      <label>Del maestro, cosechadas en los últimos<input type="number" min="15" max="365" data-lab-par="dias" value="${P.dias}"> días</label>
      ${LAB_LABORES.map(Lb => `<label>${Lb.ico} ${Lb.n}: del día<input type="number" min="0" max="365" data-lab-par="${Lb.k}|0" value="${P[Lb.k][0]}">al<input type="number" min="0" max="365" data-lab-par="${Lb.k}|1" value="${P[Lb.k][1]}"></label>`).join('')}
      <button type="button" class="plegar-todo" data-lab-par-def>↺ Valores por defecto</button></div></div>` : ''}`;
}
const labCargaHTML = () => `<div class="lab-carga"><span>📥 Reporte de labores pendientes (hoja BD):</span>
  <label class="plegar-todo pt-file">📂 Cargar Excel…<input type="file" id="lab-archivo" accept=".xlsx,.xls,.xlsm" hidden></label>
  <button type="button" class="plegar-todo" data-lab-servidor title="El más reciente de Documents\\OPERACIONES CAMPO - LEVANTE">🔄 Traer el último de la carpeta</button>
  ${labReporte() ? '<button type="button" class="plegar-todo" data-lab-quitar title="Quitar el reporte (quedan solo las del maestro)">✕ Quitar reporte</button>' : ''}</div>`;

// ── Lectura del reporte (hoja BD) ──
function labLeerReporte(X, buf, archivo, fechaArchivo){
  const wb = X.read(buf, {type:'array'}), hoja0 = wb.Sheets[wb.SheetNames.find(n => /^bd$/i.test(n.trim())) || wb.SheetNames.find(n => /bd|base/i.test(n)) || ''];
  if (!hoja0) throw new Error('El Excel no tiene la hoja BD');
  const F = X.utils.sheet_to_json(hoja0, {header:1, raw:true, defval:''});
  const iH = F.findIndex(r => r.some(c => norm(c) === 'SUERTE') && r.some(c => /AREA.?TOTAL/.test(norm(c))));
  if (iH < 0) throw new Error('No encontré los encabezados (Suerte, Area_Total) en la hoja BD');
  const H = F[iH].map(c => norm(c)), col = re => H.findIndex(h => re.test(h));
  const C = {z:col(/^ZONA$/), za:col(/ZONA.?AGRO/), s:col(/^SUERTE$/), a:col(/AREA.?TOTAL/), f:col(/FECHA/), d:col(/^DIAS$/),
    r1:col(/^1RA LABOR.*AREA/), i1:col(/^1RA LABOR.*IMPLEMENTO/), c1:col(/^1RA LABOR.*CONTRATISTA/),
    r2:col(/^2DA LABOR.*AREA/), i2:col(/^2DA LABOR.*IMPLEMENTO/), c2:col(/^2DA LABOR.*CONTRATISTA/),
    fe:col(/FERTILIZ.*AREA/), cf:col(/FERTILIZ.*CONTRATISTA/), t:col(/TIPO/)};
  // Si los encabezados cambian, las áreas están en H (1ra roturación), K (2da roturación) y N (fertilización)
  if (C.r1 < 0) C.r1 = 7; if (C.r2 < 0) C.r2 = 10; if (C.fe < 0) C.fe = 13;
  if (C.s < 0 || C.d < 0 && C.f < 0) throw new Error('Faltan las columnas Suerte y Días (o Fecha Inicio)');
  // Fecha del reporte: la del nombre del archivo (labores_pendientes_2026-11-05) o la del archivo
  const mf = /(\d{4})-(\d{2})-(\d{2})/.exec(archivo || ''), fRep = mf ? mf[0] : (fechaArchivo || labHoy()).slice(0, 10);
  const num = v => v === '' || v == null ? null : isNaN(+String(v).replace(',', '.')) ? null : +String(v).replace(',', '.');
  const fechaDe = (dias, v) => { if (dias != null) return labMenos(fRep, dias);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim()); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (typeof v === 'number' && v > 30000) return labISO(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4)); return null; };
  const filas = [];
  F.slice(iH + 1).forEach(r => { const s = frCodSuerte(r[C.s]); if (!s) return;
    const dias = C.d >= 0 ? num(r[C.d]) : null, f = fechaDe(dias, C.f >= 0 ? r[C.f] : ''); if (!f) return;
    const t = i => { if (i < 0) return undefined; const v = String(r[i] ?? '').trim(); return v && v !== '0' ? v : undefined; };
    const o = {s, z:num(r[C.z]) ?? undefined, za:t(C.za), a:num(r[C.a]) || 0, f, r1:C.r1 >= 0 ? num(r[C.r1]) : null, r2:C.r2 >= 0 ? num(r[C.r2]) : null, fe:C.fe >= 0 ? num(r[C.fe]) : null,
      tipo:t(C.t), i1:t(C.i1), c1:t(C.c1), i2:t(C.i2), c2:t(C.c2), cf:t(C.cf)};
    Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
    filas.push(o); });
  if (!filas.length) throw new Error('La hoja BD no trae suertes');
  return {archivo, fecha:fRep, filas};
}
function labAplicar(R){
  modCambio(() => { DB.levante = R; });
  const pend = k => sum(R.filas, f => f[k] > 0 ? f[k] : 0);
  toast(`🚜 Reporte cargado: ${R.filas.length} cortes · pendiente 1ra ${msN(pend('r1'), 1)} ha · 2da ${msN(pend('r2'), 1)} ha · fertilización ${msN(pend('fe'), 1)} ha · recuerda 🚀 Publicar`);
}
function labCargarArchivo(file){
  if (!file) return; toast(`⏳ Leyendo ${file.name}…`);
  Promise.all([cargarXLSX(), file.arrayBuffer()]).then(([X, buf]) => labAplicar(labLeerReporte(X, buf, file.name, labISO(new Date(file.lastModified))))).catch(e => toast('⚠ ' + (e.message || e)));
}
function labDesdeServidor(){
  const H = {cache:'no-store', headers:{'X-Comite':'1'}};
  toast('⏳ Buscando el último reporte de levante…');
  fetch(API_BASE + 'api/levante', H).then(r => { if (!r.ok) return r.json().then(j => { throw new Error(j.error || 'No se pudo traer'); });
    const nom = decodeURIComponent(r.headers.get('X-Archivo') || 'reporte.xlsx'), fe = (r.headers.get('X-Fecha') || '').slice(0, 10);
    return Promise.all([cargarXLSX(), r.arrayBuffer()]).then(([X, buf]) => labAplicar(labLeerReporte(X, buf, nom, fe))); })
    .catch(e => toast('⚠ ' + (e.message === 'Failed to fetch' ? 'El servidor de este PC no responde' : e.message || e)));
}

// Cambios (solo en modo editor): fechas por suerte y labor, programación en bloque y parámetros
function labPoner(key, k, campo, valor){
  modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.reg = D.reg || {};
    const r = D.reg[key] = D.reg[key] || {}, x = r[k] = r[k] || {};
    if (valor) x[campo] = valor; else delete x[campo];
    if (!Object.keys(x).length) delete r[k]; if (!Object.keys(r).length) delete D.reg[key];
    labLimpiar(D); });
}
// Se borran los registros de cortes de hace más de 400 días que ya no están en el control, para no crecer sin fin
function labLimpiar(D){
  const vivas = new Set(labSuertes().map(o => o.key));
  Object.keys(D.reg).forEach(k => { if (!vivas.has(k) && labDias(k.split('|')[1], labHoy()) > 400) delete D.reg[k]; });
}
q('labores').addEventListener('click', e => {
  const t = e.target;
  const ir = t.closest('[data-ir]'); if (ir) { irA(ir.dataset.ir); return; }
  if (t.closest('[data-lab-excel]')) { labExcel(); return; }
  if (t.closest('[data-lab-servidor]')) { labDesdeServidor(); return; }
  if (t.closest('[data-lab-quitar]')) { if (confirm('¿Quitar el reporte de levante? Quedan solo las suertes cosechadas según el maestro.')) modCambio(() => { delete DB.levante; }); return; }
  const f = t.closest('[data-lab-filtro]'); if (f) { labE.filtro = f.dataset.labFiltro; renderLabores(); q('lab-filtro') && q('lab-filtro').scrollIntoView({block:'center', behavior:'smooth'}); return; }
  const h = t.closest('[data-lab-hoy]'); if (h) { labPoner(h.dataset.labHoy, h.dataset.labk, 'r', labHoy()); return; }
  const b = t.closest('[data-lab-bloque]');
  if (b) { const [k, campo] = b.dataset.labBloque.split('|'), Lb = LAB_LABORES.find(x => x.k === k), fe = (q('lab-pf') || {}).value; if (!fe) { toast('⚠ Elige la fecha'); return; }
    const A = labBloque(labFiltradas(labSuertes()), Lb, campo), que = campo === 'p' ? `¿Programar ${Lb.n.toLowerCase()} para el ${msF(fe)}` : `¿Marcar ${Lb.n.toLowerCase()} como hecha el ${msF(fe)}`;
    if (!A.length || !confirm(`${que} en ${A.length} suertes (${msN(sum(A, o => labHa(o, Lb)), 1)} ha)?`)) return;
    labE.progFecha = fe;
    modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.reg = D.reg || {}; A.forEach(o => { const r = D.reg[o.key] = D.reg[o.key] || {}; (r[k] = r[k] || {})[campo] = fe; }); });
    toast(`✓ ${A.length} suertes ${campo === 'p' ? 'programadas' : 'marcadas como hechas'} · recuerda 🚀 Publicar`); return; }
  if (t.closest('[data-lab-par-def]')) { modCambio(() => { if (DB.labores) delete DB.labores.params; }); return; }
});
q('labores').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'lab-archivo') { labCargarArchivo(t.files[0]); t.value = ''; return; }
  if (t.dataset.lab) { labPoner(t.dataset.lab, t.dataset.labk, t.dataset.labc, t.value); return; }
  const pa = t.dataset.labPar;
  if (pa) { const v = Math.max(0, Math.round(+t.value || 0)); modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; const P = D.params = Object.assign({}, labPar(), D.params || {});
    if (pa === 'dias') P.dias = Math.max(15, v); else { const [k, i] = pa.split('|'); P[k] = [...P[k]]; P[k][+i] = v; if (P[k][0] > P[k][1]) P[k] = [P[k][1], P[k][0]]; } }); return; }
  if (t.id === 'lab-pf') { labE.progFecha = t.value; return; }
  const k = {'lab-zona':'zona', 'lab-hac':'hac', 'lab-filtro':'filtro', 'lab-orden':'orden', 'lab-fuente':'fuente'}[t.id]; if (k) { labE[k] = t.value; renderLabores(); }
});
let labEspera = 0;
q('labores').addEventListener('input', e => { if (e.target.id === 'lab-txt') { labE.txt = e.target.value; clearTimeout(labEspera); labEspera = setTimeout(() => redibujarConservando('lab-txt', renderLabores), 250); } });

function labExcel(){
  cargarXLSX().then(XLSX => {
    const L = labFiltradas(labSuertes()), wb = XLSX.utils.book_new(), P = labPar();
    const cab = ['Suerte', 'Hacienda', 'Zona', 'Zona agroecológica', 'Área (ha)', 'Variedad', 'Corte', 'Fecha de cosecha', 'Días desde el corte', 'Origen'];
    LAB_LABORES.forEach(Lb => cab.push(`${Lb.n} (${P[Lb.k][0]}–${P[Lb.k][1]} d)`, ...(Lb.bd ? [`${Lb.n} · ha pendientes (reporte)`] : []), `${Lb.n} programada`, `${Lb.n} hecha`));
    const filas = [cab, ...L.map(o => { const f = [o.x.s, msHacN(o.x.hac), o.x.zona ?? '', o.x.zonaAgro || '', +(+o.x.area || 0).toFixed(2), o.x.variedad || '', o.x.nCorte ?? '', o.x.ultCorte, o.dd, o.fuente === 'reporte' ? 'Reporte de levante' : 'Maestro'];
      LAB_LABORES.forEach(Lb => { const r = o.reg[Lb.k] || {}; f.push(LAB_EST[labEstado(o, Lb).e].n); if (Lb.bd) f.push(o.bd ? (o.bd[Lb.bd] ?? '') : ''); f.push(r.p || '', r.r || ''); }); return f; })];
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, filas), 'Labores');
    XLSX.writeFile(wb, `control-labores-${labHoy()}.xlsx`);
  });
}

// Resumen para el Inge Virtual y la tarjeta del portal
function labResumen(){
  const T = labSuertes();
  return {n:T.length, ha:sum(T, o => o.x.area || 0), L:LAB_LABORES.map(Lb => { const E = T.map(o => labEstado(o, Lb).e);
    const de = f => T.filter((o, i) => f(E[i]));
    const urg = de(labPorHacer);
    return {Lb, urg, haUrg:sum(urg, o => labHa(o, Lb)), ven:de(e => e === 'vencida' || e === 'atrasada'), prog:de(e => e === 'programada'), hecha:de(e => e === 'hecha')}; })};
}

// El portal se dibujó antes de cargar este archivo: se redibuja para mostrar la tarjeta y la vista de labores
if (['lab', 'portal'].includes(vistaActual)) renderVista();
