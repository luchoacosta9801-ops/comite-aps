// Simulador de costos por suerte (suertes en proceso).
// Para cada suerte: qué labores se hacen, con qué contratista y cuántos pases → costo $/ha,
// presupuesto $/ha, diferencia y costo total en pesos (= $/ha × área).
// Tarifas, presupuesto y planes viven en DB.sim (se publica con "Publicar para todos");
// mientras no se edite nada se usan los valores base de js/sim-datos.js.

const SIM_ESTADOS = [['R','Hecha'],['S','Por hacer'],['N','No']];
// Labores que se proponen por defecto a cada suerte, en orden de ejecución
const SIM_ORDEN = ['Descepada','Land plane','Subsuelo','Rastra','Pulida','Surcada'];
const SIM_PASES_DEF = {'DESCEPADA':2,'LAND PLANE':1,'NIVELACION':1,'SUBSUELO':1,'RASTRA':1,'PULIDA':2,'SURCADA':1,'CANTERIZADOR':1};
// Nombres cortos del dashboard → nombre del contratista en las tarifas
const SIM_ALIAS = {'BIENES':'BIENES Y MAQUINARIA','BIENES Y MAQ':'BIENES Y MAQUINARIA','SAO':'SERVICIOS AGROMECANICOS DE OCCIDENTES S.A.S.'};

let simBase = null;
function simDefault(){
  return {
    tarifas: SIM_TARIFAS_BASE.map(t => ({contratista:t[0], codigo:t[1], desc:t[2], unidad:t[3], costo:t[4]})),
    labores: clone(SIM_LABORES_BASE),
    ppto: clone(SIM_PPTO_BASE),
    planes: {},
  };
}
function simData(){ return DB.sim || (simBase = simBase || simDefault()); }
// Todo cambio pasa por aquí: copia los valores base a DB.sim la primera vez, guarda y redibuja
function simCambio(fn){
  if (!MODO_EDICION) return;
  if (!DB.sim) DB.sim = clone(simData());
  fn(DB.sim);
  save(); renderSimulador(); renderEstadoEdicion();
}

const simLaborDef = name => simData().labores.find(l => norm(l.nombre) === norm(name)) || {nombre:name, base:'', ppto:'', adec:false};
const simPpto = def => def.ppto ? simData().ppto.find(p => norm(p.labor) === norm(def.ppto)) : null;
const simTarifa = (c, desc) => (c && desc) ? simData().tarifas.find(t => norm(t.contratista) === norm(c) && norm(t.desc) === norm(desc)) : null;
function simContratistas(){
  const m = new Map();
  simData().tarifas.forEach(t => { const k = norm(t.contratista); if (k && !m.has(k)) m.set(k, String(t.contratista).trim()); });
  return [...m.values()].sort((a, b) => a.localeCompare(b));
}
function simAlias(c){
  const k = norm(c); if (!k || k === '—') return '';
  if (SIM_ALIAS[k]) return SIM_ALIAS[k];
  return simContratistas().find(x => norm(x) === k || norm(x).startsWith(k)) || String(c).trim();
}
// Contratista con la tarifa más baja para la labor
function simMasBarato(labor){
  const base = simLaborDef(labor).base; if (!base) return '';
  const t = simData().tarifas.filter(x => norm(x.desc) === norm(base)).sort((a, b) => a.costo - b.costo)[0];
  return t ? t.contratista : '';
}

// Plan propuesto para una suerte en proceso: las labores anteriores a la actual quedan "Hechas"
function simPlanDefecto(r){
  const actual = SIM_ORDEN.findIndex(l => norm(l) === norm(r.labor));
  const cont = simAlias(r.cont);
  return SIM_ORDEN.map((lab, i) => {
    const def = simLaborDef(lab);
    const c = simTarifa(cont, def.base) ? cont : (simMasBarato(lab) || cont);
    return {labor:lab, estado: actual >= 0 && i < actual ? 'R' : 'S', contratista:c, cant:SIM_PASES_DEF[norm(lab)] ?? 1, tarifaManual:null};
  });
}
function simPlan(r){ return simData().planes[r.sue] || simPlanDefecto(r); }
// Para editar el plan de una suerte: lo guarda primero si aún era el propuesto
function simPlanEditable(s, sue){
  if (!s.planes[sue]) { const r = DB.proceso.find(x => x.sue === sue); s.planes[sue] = simPlanDefecto(r); }
  return s.planes[sue];
}

function simFila(area, f){
  const def = simLaborDef(f.labor), t = simTarifa(f.contratista, def.base);
  const tarifa = f.tarifaManual != null ? f.tarifaManual : (t ? t.costo : null);
  const unidad = t ? norm(t.unidad) : 'HA';
  const cant = num(f.cant) || 0;
  const activo = f.estado !== 'N' && cant > 0;
  let costoHa = null;
  if (activo && tarifa != null) costoHa = unidad === 'HA' ? cant * tarifa : (area > 0 ? cant * tarifa / area : 0);
  const p = simPpto(def), pptoHa = p ? (num(p.cant) || 0) * (num(p.costo) || 0) : null;
  return {def, t, tarifa, unidad, cant, activo, costoHa, pptoHa, sinTarifa: activo && tarifa == null};
}
function simSuerte(r){
  const area = num(r.area) || 0, plan = simPlan(r);
  let hecho = 0, porHacer = 0, ppto = 0;
  const filas = plan.map(f => {
    const c = simFila(area, f);
    if (c.pptoHa != null) ppto += c.pptoHa;
    if (c.costoHa != null) { if (f.estado === 'R') hecho += c.costoHa; else if (f.estado === 'S') porHacer += c.costoHa; }
    return c;
  });
  const proy = hecho + porHacer;
  return {r, area, plan, filas, hecho, porHacer, proy, ppto, dif: ppto - proy, total: proy * area, pptoTotal: ppto * area};
}
function simSuertes(){ return DB.proceso.map(simSuerte); }

const moneyM = n => { const a = Math.abs(n || 0);
  if (a >= 1e6) return '$' + (n / 1e6).toLocaleString('es-CO', {maximumFractionDigits:1}) + ' M';
  return money(n); };
const simDif = (d, ppto, proy) => !ppto ? '<span class="pill-sim warn">Sin ppto</span>'
  : !proy ? '<span class="pill-sim warn">Sin costos</span>'
  : d >= 0 ? `<span class="pill-sim ok">Ahorro ${moneyM(d)}/ha</span>` : `<span class="pill-sim bad">Sobrecosto ${moneyM(-d)}/ha</span>`;

// ── Render ──
function renderSimulador(){
  const L = simSuertes(), ed = MODO_EDICION;
  const T = L.reduce((a, s) => ({area:a.area + s.area, total:a.total + s.total, ppto:a.ppto + s.pptoTotal,
    hecho:a.hecho + s.hecho * s.area, porHacer:a.porHacer + s.porHacer * s.area}), {area:0, total:0, ppto:0, hecho:0, porHacer:0});
  const dif = T.ppto - T.total;
  q('sim-sub').textContent = `${DB.meta.semana} · ${L.length} suertes en proceso · ${f2(T.area)} ha` + (ed ? '' : ' · solo lectura');
  q('sim-kpis').innerHTML = `
    <div class="sim-kpi"><div class="l">Costo proyectado</div><div class="v">${moneyM(T.total)}</div><div class="s">Hecho ${moneyM(T.hecho)} · por hacer ${moneyM(T.porHacer)}</div></div>
    <div class="sim-kpi"><div class="l">Presupuesto</div><div class="v">${moneyM(T.ppto)}</div><div class="s">Ejecución ${T.ppto ? (T.total / T.ppto * 100).toFixed(1) : '—'}%</div></div>
    <div class="sim-kpi ${dif >= 0 ? 'ok' : 'bad'}"><div class="l">${dif >= 0 ? 'Ahorro' : 'Sobrecosto'}</div><div class="v">${moneyM(Math.abs(dif))}</div><div class="s">Proyectado vs presupuesto</div></div>
    <div class="sim-kpi"><div class="l">Costo promedio</div><div class="v">${money(T.area ? T.total / T.area : 0)}/ha</div><div class="s">Ppto ${money(T.area ? T.ppto / T.area : 0)}/ha</div></div>`;

  const cont = simContratistas();
  const opCont = sel => `<option value="">—</option>` + (sel && !cont.some(c => norm(c) === norm(sel)) ? `<option selected>${esc(sel)}</option>` : '') +
    cont.map(c => `<option ${norm(c) === norm(sel) ? 'selected' : ''}>${esc(c)}</option>`).join('');
  // Tarjetas plegadas por defecto; se abren con clic, con el filtro o con "Expandir todas"
  const Lv = simFiltroSuerte ? L.filter(s => s.r.sue === simFiltroSuerte) : L;
  const todasAbiertas = Lv.length && Lv.every(s => simAbiertas.has(s.r.sue));
  const barra = L.length ? `<div class="sim-bar">
      <label class="fchip"><span>Suerte</span><select id="sim-fsuerte" class="fsel">
        <option value="">Todas (${L.length})</option>
        ${L.map(s => `<option value="${esc(s.r.sue)}" ${s.r.sue === simFiltroSuerte ? 'selected' : ''}>${esc(s.r.sue)} · ${esc(s.r.hac)}</option>`).join('')}
      </select></label>
      <button type="button" class="plegar-todo" data-act="todas">${todasAbiertas ? '⊟ Contraer todas' : '⊞ Expandir todas'}</button>
      <span class="meta">Clic en una suerte para ver o editar sus labores</span>
    </div>` : '';
  q('sim-suertes').innerHTML = barra + (Lv.length ? '<div class="sim-grid">' + Lv.map(s => {
    const r = s.r, abierta = simAbiertas.has(r.sue);
    const filas = s.plan.map((f, i) => {
      const c = s.filas[i], est = SIM_ESTADOS.find(e => e[0] === f.estado) || SIM_ESTADOS[1];
      const d = c.costoHa != null && c.pptoHa != null ? c.pptoHa - c.costoHa : null;
      return `<tr class="est-${f.estado}" data-sue="${esc(r.sue)}" data-i="${i}">
        <td class="lab">${esc(c.def.nombre)}</td>
        <td class="c-est" data-label="Estado">${ed ? `<span class="seg-sim">${SIM_ESTADOS.map(([k, t]) => `<button type="button" data-act="estado" data-v="${k}" class="${f.estado === k ? 'on ' + k : ''}">${t}</button>`).join('')}</span>` : `<span class="est-chip ${f.estado}">${est[1]}</span>`}</td>
        <td data-label="Contratista">${ed ? `<select data-fld="contratista">${opCont(f.contratista)}</select>` : esc(f.contratista || '—')}</td>
        <td class="n" data-label="Pases">${ed ? `<input data-fld="cant" type="number" min="0" step="any" value="${esc(f.cant)}">` : f2(c.cant).replace(/\.00$/, '')}</td>
        <td class="n" data-label="Tarifa">${ed ? `<input data-fld="tarifa" type="number" min="0" step="any" class="${f.tarifaManual != null ? 'manual' : ''}" placeholder="sin tarifa" value="${c.tarifa != null ? Math.round(c.tarifa) : ''}" title="${f.tarifaManual != null ? 'Tarifa escrita a mano (borra para usar la del contratista)' : c.t ? esc(c.t.desc) + ' · ' + money(c.t.costo) + '/' + esc(c.t.unidad) : 'Sin tarifa para este contratista'}">` : (c.tarifa != null ? money(c.tarifa) : '<span class="warn-t">sin tarifa</span>')}${c.unidad !== 'HA' && c.t ? `<small>/${esc(c.t.unidad.toLowerCase())}</small>` : ''}</td>
        <td class="n b" data-label="Costo $/ha">${c.costoHa != null ? money(c.costoHa) : c.sinTarifa ? '<span class="warn-t">sin tarifa</span>' : '—'}</td>
        <td class="n" data-label="Ppto $/ha">${c.pptoHa != null ? money(c.pptoHa) : '—'}</td>
        <td data-label="Diferencia" class="n ${d == null ? '' : d >= 0 ? 'pos' : 'neg'}">${d == null ? '—' : (d >= 0 ? '+' : '−') + money(Math.abs(d))}</td>
        <td class="n" data-label="Total $">${c.costoHa != null ? moneyM(c.costoHa * s.area) : '—'}</td>
        ${ed ? `<td class="c-x"><button type="button" class="x" data-act="quitar" title="Quitar labor">×</button></td>` : ''}
      </tr>`;
    }).join('');
    const faltan = simData().labores.filter(l => !s.plan.some(f => norm(f.labor) === norm(l.nombre)));
    return `<div class="sim-card ${abierta ? 'abierta' : ''}" data-card="${esc(r.sue)}">
      <div class="sim-card-h" data-act="tarjeta" title="${abierta ? 'Ocultar labores' : 'Ver labores'}">
        <div class="sim-card-t"><span class="sim-flecha">▶</span><b class="sue">${esc(r.sue)}</b> <span class="sim-hac">${esc(r.hac)}</span>
          <span class="sim-pill-wrap">${simDif(s.dif, s.ppto, s.proy)}</span></div>
        <div class="meta sim-card-m">${f2(s.area)} ha · labor actual: <b>${esc(r.labor)}</b> (${esc(r.cont || '—')})</div>
        <div class="sim-card-k">
          <div><span>Costo/ha</span><b>${money(s.proy)}</b></div>
          <div><span>Total</span><b>${moneyM(s.total)}</b></div>
          <div><span>Ppto</span><b>${moneyM(s.pptoTotal)}</b></div>
        </div>
        <div class="sim-card-ver">${abierta ? 'Ocultar labores ▲' : 'Ver labores ▼'}</div>
      </div>
      <div class="sim-tw"><table class="sim-t">
        <thead><tr><th>Labor</th><th>Estado</th><th>Contratista</th><th class="n">Pases</th><th class="n">Tarifa</th><th class="n">Costo $/ha</th><th class="n">Ppto $/ha</th><th class="n">Diferencia</th><th class="n">Total $</th>${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr><td colspan="5" class="c-tot">Total suerte <span class="meta">(hecho ${money(s.hecho)}/ha · por hacer ${money(s.porHacer)}/ha)</span></td>
          <td class="n b" data-label="Costo $/ha">${money(s.proy)}</td><td class="n" data-label="Ppto $/ha">${money(s.ppto)}</td>
          <td data-label="Diferencia" class="n ${s.dif >= 0 ? 'pos' : 'neg'}">${(s.dif >= 0 ? '+' : '−') + money(Math.abs(s.dif))}</td><td class="n b" data-label="Total $">${moneyM(s.total)}</td>${ed ? '<td class="c-x"></td>' : ''}</tr></tfoot>
      </table></div>
      ${ed && faltan.length ? `<div class="sim-add" data-sue="${esc(r.sue)}"><select data-act="agregar"><option value="">+ Agregar labor…</option>${faltan.map(l => `<option>${esc(l.nombre)}</option>`).join('')}</select>
        ${simData().planes[r.sue] ? `<button type="button" class="link" data-act="restaurar">↺ Volver al plan propuesto</button>` : ''}</div>` : ''}
    </div>`;
  }).join('') + '</div>' : '<div class="nores">No hay suertes en proceso.</div>');
  renderSimParam();
}

let simFiltroT = '';
function renderSimParam(){
  const S = simData(), ed = MODO_EDICION, dis = ed ? '' : 'disabled';
  const pp = S.ppto.map((p, i) => `<tr data-i="${i}"><td>${esc(p.labor)}</td>
      <td class="n"><input data-pfld="cant" type="number" step="any" min="0" value="${p.cant}" ${dis}></td>
      <td class="n"><input data-pfld="costo" type="number" step="any" min="0" value="${Math.round(p.costo)}" ${dis}></td>
      <td class="n b">${money(p.cant * p.costo)}</td></tr>`).join('');
  const qn = norm(simFiltroT);
  const tf = S.tarifas.map((t, i) => [t, i]).filter(([t]) => !qn || norm(`${t.contratista} ${t.codigo} ${t.desc}`).includes(qn));
  const filasT = tf.map(([t, i]) => `<tr data-i="${i}">
      <td><input data-tfld="contratista" value="${esc(t.contratista)}" ${dis}></td>
      <td><input data-tfld="codigo" value="${esc(t.codigo)}" style="width:90px" ${dis}></td>
      <td><input data-tfld="desc" value="${esc(t.desc)}" ${dis}></td>
      <td><input data-tfld="unidad" value="${esc(t.unidad)}" style="width:50px" ${dis}></td>
      <td class="n"><input data-tfld="costo" type="number" step="any" min="0" value="${t.costo}" ${dis}></td>
      ${ed ? '<td><button type="button" class="x" data-act="borrarT" title="Borrar tarifa">×</button></td>' : ''}</tr>`).join('');
  q('sim-param-cuerpo').innerHTML = `
    <div class="sim-sec">Presupuesto por labor <span class="meta">(Ppto $/ha = pases × $ por pase)</span></div>
    <div class="sim-tw"><table class="sim-t sim-pp"><thead><tr><th>Labor</th><th class="n">Pases</th><th class="n">$ por pase/ha</th><th class="n">Ppto $/ha</th></tr></thead>
      <tbody>${pp}</tbody><tfoot><tr><td colspan="3">Total presupuesto</td><td class="n b">${money(sum(S.ppto, p => p.cant * p.costo))}/ha</td></tr></tfoot></table></div>
    <div class="sim-sec">Tarifas por contratista <span class="meta">(${S.tarifas.length})</span></div>
    <div class="sim-tbar"><input type="search" id="sim-qt" placeholder="Buscar contratista, labor o código…" value="${esc(simFiltroT)}">
      ${ed ? '<button type="button" class="mbtn mbtn-primary" data-act="nuevaT" style="padding:5px 12px">+ Tarifa</button>' : ''}
      ${ed && DB.sim ? '<button type="button" class="mbtn mbtn-ghost" data-act="reiniciarSim" style="padding:5px 12px" title="Volver a las tarifas y presupuesto del simulador original">↺ Valores originales</button>' : ''}</div>
    <div class="sim-tw" style="max-height:340px"><table class="sim-t sim-tar"><thead><tr><th>Contratista</th><th>Código</th><th>Descripción (labor)</th><th>Unidad</th><th class="n">$ tarifa</th>${ed ? '<th></th>' : ''}</tr></thead>
      <tbody>${filasT || '<tr><td colspan="6" class="nores">Sin coincidencias</td></tr>'}</tbody></table></div>`;
  const b = q('sim-qt');
  b.addEventListener('input', () => { simFiltroT = b.value; renderSimParam(); const n = q('sim-qt'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
}

// ── Eventos (delegados) ──
const simAbiertas = new Set();   // suertes con la tarjeta abierta (todas cerradas al entrar)
let simFiltroSuerte = '';

q('simulador').addEventListener('click', e => {
  const h = e.target.closest('[data-act="tarjeta"]');
  if (h) { const sue = h.closest('[data-card]').dataset.card; simAbiertas.has(sue) ? simAbiertas.delete(sue) : simAbiertas.add(sue); renderSimulador(); return; }
  const b = e.target.closest('button[data-act]'); if (!b) return;
  if (b.dataset.act === 'todas') {
    const vis = simSuertes().filter(s => !simFiltroSuerte || s.r.sue === simFiltroSuerte).map(s => s.r.sue);
    const abrir = !vis.every(x => simAbiertas.has(x));
    vis.forEach(x => abrir ? simAbiertas.add(x) : simAbiertas.delete(x));
    renderSimulador(); return;
  }
  const act = b.dataset.act, tr = b.closest('tr'), sue = b.closest('[data-sue]')?.dataset.sue;
  if (act === 'estado') simCambio(s => { const f = simPlanEditable(s, sue)[+tr.dataset.i]; f.estado = b.dataset.v; if (f.estado !== 'N' && !f.contratista) f.contratista = simMasBarato(f.labor); });
  else if (act === 'quitar') simCambio(s => { simPlanEditable(s, sue).splice(+tr.dataset.i, 1); });
  else if (act === 'restaurar') simCambio(s => { delete s.planes[sue]; });
  else if (act === 'borrarT') simCambio(s => { s.tarifas.splice(+tr.dataset.i, 1); });
  else if (act === 'nuevaT') { simFiltroT = ''; simCambio(s => { s.tarifas.unshift({contratista:'NUEVO CONTRATISTA', codigo:'', desc:'', unidad:'HA', costo:0}); }); toast('Escribe los datos de la tarifa nueva (primera fila)'); }
  else if (act === 'reiniciarSim') { if (confirm('¿Volver a las tarifas y al presupuesto originales del simulador? Los planes de cada suerte se conservan.')) simCambio(s => { const d = simDefault(); s.tarifas = d.tarifas; s.ppto = d.ppto; s.labores = d.labores; }); }
});
q('simulador').addEventListener('change', e => {
  const el = e.target, tr = el.closest('tr'), sue = el.closest('[data-sue]')?.dataset.sue;
  if (el.id === 'sim-fsuerte') {   // filtro: al elegir una suerte se abre su tarjeta
    simFiltroSuerte = el.value; if (el.value) simAbiertas.add(el.value);
    renderSimulador(); return;
  }
  if (el.dataset.act === 'agregar') {
    const lab = el.value; if (!lab) return;
    simCambio(s => { const def = simLaborDef(lab), p = simPpto(def);
      simPlanEditable(s, sue).push({labor:def.nombre, estado:'S', contratista:simMasBarato(lab), cant:SIM_PASES_DEF[norm(lab)] ?? (p ? Math.round(p.cant) : 1), tarifaManual:null}); });
    toast(`${lab} agregada como "Por hacer"`); return;
  }
  if (el.dataset.fld) simCambio(s => {
    const f = simPlanEditable(s, sue)[+tr.dataset.i];
    if (el.dataset.fld === 'contratista') { f.contratista = el.value; f.tarifaManual = null; }
    else if (el.dataset.fld === 'cant') f.cant = num(el.value) ?? 0;
    else if (el.dataset.fld === 'tarifa') f.tarifaManual = el.value === '' ? null : num(el.value);
  });
  else if (el.dataset.pfld) simCambio(s => { s.ppto[+tr.dataset.i][el.dataset.pfld] = num(el.value) ?? 0; });
  else if (el.dataset.tfld) simCambio(s => { const t = s.tarifas[+tr.dataset.i], k = el.dataset.tfld;
    t[k] = k === 'costo' ? (num(el.value) ?? 0) : (k === 'contratista' || k === 'unidad' ? el.value.trim().toUpperCase() : el.value.trim()); });
});

// ── Abrir / cerrar el simulador ──
function modoSimulador(abrir){
  document.body.classList.toggle('modo-sim', abrir);
  q('btn-sim').textContent = abrir ? '← Dashboard' : '💰 Simulador';
  q('btn-sim').title = abrir ? 'Volver al dashboard' : 'Simulador de costos por suerte';
  if (abrir) renderSimulador();
  history.replaceState(null, '', abrir ? '#simulador' : location.pathname + location.search);
  ajustarBarra(); window.scrollTo(0, 0);
}
q('btn-sim').addEventListener('click', () => modoSimulador(!document.body.classList.contains('modo-sim')));
if (location.hash === '#simulador') modoSimulador(true);

// Filas para la hoja SIMULADOR del Excel
function filasSimulador(){
  const E = Object.fromEntries(SIM_ESTADOS);
  const r2 = n => Math.round((+n || 0) * 100) / 100;
  return simSuertes().flatMap(s => s.plan.map((f, i) => { const c = s.filas[i];
    return [s.r.sue, s.r.hac, r2(s.area), c.def.nombre, E[f.estado] || f.estado, f.contratista || '', c.cant, c.tarifa != null ? Math.round(c.tarifa) : '',
      c.costoHa != null ? Math.round(c.costoHa) : '', c.pptoHa != null ? Math.round(c.pptoHa) : '',
      c.costoHa != null && c.pptoHa != null ? Math.round(c.pptoHa - c.costoHa) : '', c.costoHa != null ? Math.round(c.costoHa * s.area) : ''];
  }));
}
