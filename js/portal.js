// Portal "Ingeniería Agrícola · Riopaila Agrícola": portada con botones a los módulos y
// navegación entre ellos por la dirección (#inicio, #aps, #simulador, #estructura, #ppto2027).
// Los módulos nuevos (Estructura y Presupuesto 2027) guardan sus datos en DB.estructura y
// DB.ppto2027, que se publican en datos.js como el resto.

const VISTAS = {
  portal:     {hash:'#inicio',     titulo:'Ingeniería Agrícola',     sub:'Riopaila Agrícola S.A.',                   doc:'Ingeniería Agrícola · Riopaila Agrícola'},
  aps:        {hash:'#aps',        titulo:'Comité APS · Dashboard',  sub:'Renovación y siembra · Riopaila Agrícola', doc:'Comité APS · Dashboard Ejecutivo'},
  simulador:  {hash:'#simulador',  titulo:'Comité APS · Simulador',  sub:'Costos por suerte · Riopaila Agrícola',    doc:'Simulador de costos · Comité APS'},
  estructura: {hash:'#estructura', titulo:'Estructura del área',      sub:'Ingeniería Agrícola · Riopaila Agrícola',  doc:'Estructura del área · Ingeniería Agrícola'},
  ppto:       {hash:'#ppto2027',   titulo:'Presupuesto APS 2027',     sub:'Ingeniería Agrícola · Riopaila Agrícola',  doc:'Presupuesto APS 2027 · Ingeniería Agrícola'},
};
const vistaDeHash = h => (Object.entries(VISTAS).find(([, v]) => v.hash === h) || ['portal'])[0];
let vistaActual = 'portal';

function irA(vista, {historial = true} = {}){
  vistaActual = VISTAS[vista] ? vista : 'portal';
  const V = VISTAS[vistaActual];
  document.body.dataset.vista = vistaActual;
  document.body.classList.toggle('modo-sim', vistaActual === 'simulador');   // estilos del simulador
  document.querySelector('.hdr-title').textContent = V.titulo;
  document.querySelector('.hdr-sub').textContent = V.sub;
  document.title = V.doc;
  const bs = q('btn-sim');
  bs.textContent = vistaActual === 'simulador' ? '📊 Dashboard' : '💰 Simulador';
  bs.title = vistaActual === 'simulador' ? 'Ir al dashboard del Comité APS' : 'Simulador de costos por suerte';
  if (historial && location.hash !== V.hash) history.pushState(null, '', V.hash);
  renderVista();
  ajustarBarra(); window.scrollTo(0, 0);
}
function renderVista(){
  if (vistaActual === 'portal') renderPortal();
  else if (vistaActual === 'simulador') renderSimulador();
  else if (vistaActual === 'estructura') renderEstructura();
  else if (vistaActual === 'ppto') renderPpto2027();
}
// El simulador ya traía su propio botón: ahora navega con el portal
function modoSimulador(abrir){ irA(abrir ? 'simulador' : 'aps'); }
window.addEventListener('popstate', () => irA(vistaDeHash(location.hash), {historial:false}));
q('btn-inicio').addEventListener('click', () => irA('portal'));
// Buscar una suerte desde cualquier módulo lleva al dashboard
q('search-results').addEventListener('click', e => { if (e.target.closest('.sr-item') && vistaActual !== 'aps') irA('aps'); }, true);
// Cualquier cambio de datos redibuja también el módulo abierto
const _renderAllBase = renderAll;
renderAll = function(){ _renderAllBase(); if (vistaActual !== 'aps') renderVista(); };

// Cambios en los módulos nuevos (solo editor): guardan, redibujan y marcan "sin publicar"
function modCambio(fn){ if (!MODO_EDICION) return; fn(); save(); renderVista(); renderEstadoEdicion(); }

// ── Portada ──
function renderPortal(){
  const semb = DB.lotes.filter(l => l.e === 'SEMBRADA'), ha = sum(semb, l => l.a);
  const pct = DB.meta.pptoTotal ? (ha / DB.meta.pptoTotal * 100).toFixed(1) : '—';
  const S = simSuertes(), simTot = sum(S, s => s.total), simDifT = sum(S, s => s.pptoTotal) - simTot;
  const E = estructura(), P = ppto2027(), haP = sum(P.z1) + sum(P.z2);
  const card = (vista, icono, titulo, desc, dato, color) => `
    <button type="button" class="pt-card" data-ir="${vista}" style="--c:${color}">
      <span class="pt-ico">${icono}</span>
      <span class="pt-tit">${titulo}</span>
      <span class="pt-desc">${desc}</span>
      <span class="pt-dato">${dato}</span>
      <span class="pt-ir">Abrir →</span>
    </button>`;
  q('portal').innerHTML = `
    <div class="pt-hero">
      <img src="img/logo-riopaila.png" alt="Riopaila Agrícola S.A." class="pt-logo">
      <div>
        <div class="pt-h1">Ingeniería Agrícola</div>
        <div class="pt-h2">Riopaila Agrícola S.A. · Indicadores del área</div>
        <div class="pt-firma">Luis Acosta · Esp. de Ingeniería Agrícola</div>
      </div>
    </div>
    <div class="pt-kpis">
      <div><span>Sembradas APS</span><b>${f2(ha)} ha</b><small>${esc(DB.meta.semana)}</small></div>
      <div><span>Avance vs ppto</span><b>${pct}%</b><small>${f2(DB.meta.pptoTotal)} ha ppto</small></div>
      <div><span>En proceso</span><b>${DB.proceso.length} suertes</b><small>${f2(sum(DB.proceso, r => r.area))} ha</small></div>
      <div><span>Costo proyectado</span><b>${moneyM(simTot)}</b><small>suertes en proceso</small></div>
      <div><span>Ppto 2027</span><b>${haP ? f2(haP) + ' ha' : '—'}</b><small>${haP ? moneyM(haP * pptoHa2027(P)) : 'sin datos aún'}</small></div>
      <div><span>Equipo del área</span><b>${E.personas.length} ${E.personas.length === 1 ? 'cargo' : 'cargos'}</b><small>${E.personas.filter(p => !p.nombre).length} por asignar</small></div>
    </div>
    <div class="pt-grid">
      ${card('aps', '📊', 'Dashboard Comité APS', 'Avance de renovación y siembra por zona, hacienda y suerte; labores, ruta de siembra y presupuesto.',
        `${esc(DB.meta.semana)} · <b>${f2(ha)} ha</b> sembradas · <b>${pct}%</b> vs ppto`, 'var(--cyan)')}
      ${card('simulador', '💰', 'Simulador de costos', 'Costo por suerte según labor, contratista y pases, comparado con el presupuesto.',
        `${S.length} suertes en proceso · <b>${moneyM(simTot)}</b> · ${simDifT >= 0 ? 'ahorro' : 'sobrecosto'} ${moneyM(Math.abs(simDifT))}`, 'var(--green)')}
      ${card('estructura', '👥', 'Estructura del área', 'Organigrama del área: cargos, personas, equipos y zonas a cargo.',
        E.personas.length ? `<b>${E.personas.length}</b> ${E.personas.length === 1 ? 'cargo' : 'cargos'} · ${E.personas.filter(p => !p.nombre).length} por asignar` : 'Por completar', 'var(--violet)')}
      ${card('ppto', '📅', 'Presupuesto APS 2027', 'Hectáreas a renovar por mes y zona, y costo presupuestado por labor.',
        haP ? `<b>${f2(haP)} ha</b> · inversión <b>${moneyM(haP * pptoHa2027(P))}</b>` : 'Estructura lista · sin datos aún', 'var(--amber)')}
    </div>
    <div class="pt-pie">Comité APS · Riopaila Agrícola · Elaborado por: <b>Luis Acosta</b> · Esp. de Ingeniería Agrícola</div>`;
}
q('portal').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b) irA(b.dataset.ir); });

// ── Estructura del área ──
let estBase = null;
function estructura(){
  return DB.estructura || (estBase = estBase || {personas:[
    {id:'p1', nombre:'Luis Acosta', cargo:'Especialista de Ingeniería Agrícola', equipo:'Ingeniería Agrícola', reportaA:'', zona:'', funciones:''},
  ]});
}
function estEditable(){ if (!DB.estructura) DB.estructura = clone(estructura()); return DB.estructura; }
const nuevoId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function renderEstructura(){
  const E = estructura(), ed = MODO_EDICION, ids = new Set(E.personas.map(p => p.id));
  const hijos = id => E.personas.filter(p => (p.reportaA || '') === id && p.id !== id);
  const raices = E.personas.filter(p => !p.reportaA || !ids.has(p.reportaA));
  const equipos = [...new Set(E.personas.map(p => p.equipo).filter(Boolean))];
  const nodo = (p, nivel) => {
    const hs = nivel < 12 ? hijos(p.id) : [];
    return `<li>
      <div class="org-card ${p.nombre ? '' : 'vacante'}">
        <div class="org-nom">${p.nombre ? esc(p.nombre) : 'Por asignar'}</div>
        <div class="org-cargo">${esc(p.cargo || 'Cargo sin definir')}</div>
        <div class="org-tags">${p.equipo ? `<span>${esc(p.equipo)}</span>` : ''}${p.zona ? `<span class="z">📍 ${esc(p.zona)}</span>` : ''}${hs.length ? `<span class="n">${hs.length} a cargo</span>` : ''}</div>
        ${p.funciones ? `<div class="org-fun">${esc(p.funciones)}</div>` : ''}
        ${ed ? `<div class="org-acc"><button type="button" data-org="editar" data-id="${esc(p.id)}">✏️ Editar</button><button type="button" data-org="agregar" data-id="${esc(p.id)}">➕ A cargo</button><button type="button" data-org="borrar" data-id="${esc(p.id)}">🗑</button></div>` : ''}
      </div>
      ${hs.length ? `<ul>${hs.map(h => nodo(h, nivel + 1)).join('')}</ul>` : ''}
    </li>`;
  };
  q('estructura').innerHTML = `
    <div class="mod-top">
      <div><div class="sim-tit">👥 Estructura del área · Ingeniería Agrícola</div>
        <div class="sim-subt">${E.personas.length} ${E.personas.length === 1 ? 'cargo' : 'cargos'} · ${E.personas.filter(p => !p.nombre).length} por asignar${equipos.length ? ' · equipos: ' + equipos.map(esc).join(', ') : ''}${ed ? '' : ' · solo lectura'}</div></div>
      ${ed ? '<button type="button" class="mbtn mbtn-primary" data-org="agregar" data-id="">➕ Agregar cargo</button>' : ''}
    </div>
    ${E.personas.length ? `<ul class="org">${raices.map(p => nodo(p, 0)).join('')}</ul>` : '<div class="nores">Aún no hay cargos.' + (ed ? ' Pulsa «➕ Agregar cargo».' : '') + '</div>'}
    ${ed ? '<div class="note">💡 Organiza el área con «➕ A cargo» en cada persona. Deja el nombre vacío para un cargo por asignar. Los cambios se ven aquí y llegan a todos al pulsar 🚀 Publicar.</div>' : ''}`;
}
q('estructura').addEventListener('click', e => {
  const b = e.target.closest('[data-org]'); if (!b || !MODO_EDICION) return;
  const id = b.dataset.id, E = estructura();
  if (b.dataset.org === 'agregar') formPersona(null, id);
  else if (b.dataset.org === 'editar') formPersona(E.personas.find(p => p.id === id));
  else if (b.dataset.org === 'borrar') {
    const p = E.personas.find(x => x.id === id), n = E.personas.filter(x => x.reportaA === id).length;
    if (!confirm(`¿Quitar "${p.nombre || p.cargo}" de la estructura?` + (n ? `\nLas ${n} personas a su cargo pasarán a reportar a su jefe.` : ''))) return;
    modCambio(() => { const D = estEditable(); D.personas.forEach(x => { if (x.reportaA === id) x.reportaA = p.reportaA || ''; }); D.personas = D.personas.filter(x => x.id !== id); });
    toast('Cargo quitado');
  }
});
function formPersona(p, jefe){
  const E = estructura(), nuevo = !p;
  p = p || {id:'', nombre:'', cargo:'', equipo:'', zona:'', funciones:'', reportaA:jefe || ''};
  // No puede reportar a sí mismo ni a alguien que está debajo suyo
  const debajo = new Set(); const marcar = id => E.personas.filter(x => x.reportaA === id).forEach(x => { if (!debajo.has(x.id)) { debajo.add(x.id); marcar(x.id); } });
  if (p.id) { debajo.add(p.id); marcar(p.id); }
  const jefes = E.personas.filter(x => !debajo.has(x.id));
  setHeader('👥', nuevo ? 'Agregar cargo' : 'Editar cargo', 'Estructura del área · Ingeniería Agrícola');
  const campo = (k, lbl, ph) => `<div><label class="mlabel">${lbl}</label><input class="minput" id="org-${k}" value="${esc(p[k] || '')}" placeholder="${ph}"></div>`;
  modalBody.innerHTML = `
    <div class="mrow" style="grid-template-columns:1fr 1fr">${campo('nombre', 'Nombre', 'Vacío = por asignar')}${campo('cargo', 'Cargo *', 'ej: Supervisor de adecuación')}</div>
    <div class="mrow" style="grid-template-columns:1fr 1fr">${campo('equipo', 'Equipo / área', 'ej: Topografía')}${campo('zona', 'Zona o haciendas a cargo', 'ej: Zona 1 · La Luisa, Lagunas')}</div>
    <div class="mrow"><div><label class="mlabel">Reporta a</label><select class="mselect" id="org-reportaA">
      <option value="">— Nadie (cabeza del área) —</option>
      ${jefes.map(x => `<option value="${esc(x.id)}" ${x.id === p.reportaA ? 'selected' : ''}>${esc(x.nombre || 'Por asignar')} · ${esc(x.cargo)}</option>`).join('')}
    </select></div></div>
    <div class="mrow"><div><label class="mlabel">Funciones principales</label><textarea class="minput" id="org-funciones" rows="3" placeholder="ej: Seguimiento de labores de preparación y comité semanal">${esc(p.funciones || '')}</textarea></div></div>
    <div id="org-err" class="err" hidden></div>`;
  modalFooter.innerHTML = `<button class="mbtn mbtn-ghost" onclick="closeModal()">Cancelar</button><button class="mbtn mbtn-primary" id="org-guardar">✓ Guardar</button>`;
  overlay.style.display = 'flex'; document.body.style.overflow = 'hidden';
  q('org-guardar').addEventListener('click', () => {
    const v = k => q('org-' + k).value.trim();
    if (!v('cargo')) { q('org-err').hidden = false; q('org-err').textContent = 'Escribe el cargo.'; return; }
    modCambio(() => {
      const D = estEditable(), datos = {nombre:v('nombre'), cargo:v('cargo'), equipo:v('equipo'), zona:v('zona'), funciones:v('funciones'), reportaA:v('reportaA')};
      if (nuevo) D.personas.push(Object.assign({id:nuevoId()}, datos)); else Object.assign(D.personas.find(x => x.id === p.id), datos);
    });
    closeModal(); toast(nuevo ? '✓ Cargo agregado' : '✓ Cargo actualizado');
  });
}

// ── Presupuesto APS 2027 ──
let pptoBase = null;
function ppto2027(){
  return DB.ppto2027 || (pptoBase = pptoBase || {z1:Array(12).fill(0), z2:Array(12).fill(0),
    labores:SIM_PPTO_BASE.map(p => ({labor:p.labor, cant:p.cant, costo:Math.round(p.costo)}))});
}
function pptoEditable(){ if (!DB.ppto2027) DB.ppto2027 = clone(ppto2027()); return DB.ppto2027; }
const pptoHa2027 = P => sum(P.labores, l => (+l.cant || 0) * (+l.costo || 0));

function renderPpto2027(){
  const P = ppto2027(), ed = MODO_EDICION, dis = ed ? '' : 'disabled';
  const z1 = P.z1, z2 = P.z2, zt = z1.map((v, i) => v + (z2[i] || 0)), t1 = sum(z1), t2 = sum(z2), tt = t1 + t2;
  const a26 = DB.pptoMensual, t26 = sum(a26.z1) + sum(a26.z2), costoHa = pptoHa2027(P);
  const fila = (lbl, z, arr, color) => `<tr><td class="lab" style="color:${color}">${lbl}</td>${arr.map((v, i) => `<td class="n">${z ? `<input type="number" step="any" min="0" data-pz="${z}" data-m="${i}" value="${v || ''}" placeholder="0" ${dis}>` : (v ? f2(v) : '—')}</td>`).join('')}<td class="n b">${f2(sum(arr))}</td></tr>`;
  q('ppto2027').innerHTML = `
    <div class="mod-top">
      <div><div class="sim-tit">📅 Presupuesto APS 2027</div>
        <div class="sim-subt">${tt ? `${f2(tt)} ha a renovar` : 'Estructura lista · sin datos aún'}${ed ? '' : ' · solo lectura'}</div></div>
      ${ed ? '<label class="mbtn mbtn-ghost pt-file">📥 Cargar desde Excel<input type="file" id="ppto-xls" accept=".xlsx,.xlsm,.xls" hidden></label>' : ''}
    </div>
    <div class="sim-kpis">
      <div class="sim-kpi"><div class="l">Hectáreas 2027</div><div class="v">${f2(tt)}</div><div class="s">Zona 1 ${f2(t1)} · Zona 2 ${f2(t2)}</div></div>
      <div class="sim-kpi"><div class="l">Vs. 2026</div><div class="v">${tt && t26 ? ((tt - t26) >= 0 ? '+' : '') + f2(tt - t26) + ' ha' : '—'}</div><div class="s">2026: ${f2(t26)} ha</div></div>
      <div class="sim-kpi"><div class="l">Costo por hectárea</div><div class="v">${money(costoHa)}</div><div class="s">Suma de labores × pases</div></div>
      <div class="sim-kpi"><div class="l">Inversión estimada</div><div class="v">${moneyM(tt * costoHa)}</div><div class="s">Hectáreas × costo/ha</div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Hectáreas a renovar por mes</b> <span class="meta">${ed ? '· escribe las hectáreas de cada mes' : ''}</span></div>
      <div class="sim-tw"><table class="sim-t ppto-t">
        <thead><tr><th>Zona</th>${MESES.map(m => `<th class="n">${m}</th>`).join('')}<th class="n">Total</th></tr></thead>
        <tbody>${fila('Zona 1', 'z1', z1, 'var(--green)')}${fila('Zona 2', 'z2', z2, 'var(--amber)')}</tbody>
        <tfoot>${fila('Total 2027', '', zt, 'var(--cyan)')}<tr class="ref"><td class="lab">Ref. 2026</td>${a26.z1.map((v, i) => `<td class="n">${f2(v + (a26.z2[i] || 0))}</td>`).join('')}<td class="n">${f2(t26)}</td></tr></tfoot>
      </table></div></div>
    <div class="sim-card abierta" style="margin-top:12px"><div class="sim-card-h" style="cursor:default"><b>Costo presupuestado por labor</b> <span class="meta">· valores iniciales de referencia 2026, ajústalos para 2027</span></div>
      <div class="sim-tw"><table class="sim-t sim-pp">
        <thead><tr><th>Labor</th><th class="n">Pases</th><th class="n">$ por pase/ha</th><th class="n">$/ha</th>${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${P.labores.map((l, i) => `<tr data-i="${i}"><td>${ed ? `<input data-pl="labor" value="${esc(l.labor)}" style="width:130px">` : esc(l.labor)}</td>
          <td class="n"><input type="number" step="any" min="0" data-pl="cant" value="${l.cant}" ${dis}></td>
          <td class="n"><input type="number" step="any" min="0" data-pl="costo" value="${l.costo}" ${dis}></td>
          <td class="n b">${money((+l.cant || 0) * (+l.costo || 0))}</td>${ed ? '<td><button type="button" class="x" data-pl-borrar>×</button></td>' : ''}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total por hectárea</td><td class="n b">${money(costoHa)}</td>${ed ? '<td></td>' : ''}</tr></tfoot>
      </table></div>
      ${ed ? '<div class="sim-add"><button type="button" class="link" data-pl-agregar>+ Agregar labor</button></div>' : ''}</div>
    ${ed ? '<div class="note">💡 «Cargar desde Excel» lee una hoja «PPTO 2027» con el mismo formato de la hoja PPTO 2026 del comité (filas ZONA 1 y ZONA 2, meses 1 a 12). Los cambios llegan a todos al pulsar 🚀 Publicar.</div>' : ''}`;
  const f = q('ppto-xls'); if (f) f.addEventListener('change', () => f.files[0] && cargarPptoExcel(f.files[0]));
}
q('ppto2027').addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.pz) modCambio(() => { pptoEditable()[el.dataset.pz][+el.dataset.m] = num(el.value) || 0; });
  else if (el.dataset.pl) modCambio(() => { const l = pptoEditable().labores[+el.closest('tr').dataset.i]; l[el.dataset.pl] = el.dataset.pl === 'labor' ? el.value.trim() : (num(el.value) || 0); });
});
q('ppto2027').addEventListener('click', e => {
  if (e.target.closest('[data-pl-agregar]')) modCambio(() => { pptoEditable().labores.push({labor:'Nueva labor', cant:1, costo:0}); });
  else if (e.target.closest('[data-pl-borrar]')) { const i = +e.target.closest('tr').dataset.i; modCambio(() => { pptoEditable().labores.splice(i, 1); }); }
});
// Lee la hoja "PPTO 2027" (o la primera con filas ZONA 1 / ZONA 2): 12 valores después de la etiqueta
function cargarPptoExcel(file){
  leerLibroPpto(file).then(r => {
    if (!r) { toast('⚠ No encontré filas «ZONA 1» y «ZONA 2» con los 12 meses'); return; }
    if (!confirm(`Hoja «${r.hoja}»: Zona 1 ${f2(sum(r.z1))} ha · Zona 2 ${f2(sum(r.z2))} ha.\n¿Reemplazar las hectáreas por mes de 2027?`)) return;
    modCambio(() => { const P = pptoEditable(); P.z1 = r.z1; P.z2 = r.z2; });
    toast('✓ Presupuesto 2027 cargado · recuerda 🚀 Publicar');
  }).catch(err => toast('⚠ ' + err.message));
}
function leerLibroPpto(file){
  return cargarXLSX().then(XLSX => file.arrayBuffer().then(buf => {
    const wb = XLSX.read(buf, {type:'array'});
    const orden = [...wb.SheetNames.filter(n => /PPTO.*2027/.test(norm(n))), ...wb.SheetNames];
    for (const n of orden) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:'', raw:true});
      const buscar = et => { for (const r of rows) { const i = r.findIndex(v => norm(v) === et); if (i >= 0) { const vals = r.slice(i + 1, i + 13).map(v => num(v) || 0); if (vals.length === 12) return vals; } } return null; };
      const z1 = buscar('ZONA 1'), z2 = buscar('ZONA 2');
      if (z1 && z2) return {hoja:n, z1:z1.map(v => +v.toFixed(2)), z2:z2.map(v => +v.toFixed(2))};
    }
    return null;
  }));
}

// Arranque: abre el módulo que indique la dirección (sin dirección = portada)
irA(vistaDeHash(location.hash), {historial:false});
