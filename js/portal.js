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
  agro:       {hash:'#agronomia',  titulo:'Gestión Agronomía',        sub:'Ingeniería Agrícola · Riopaila Agrícola',  doc:'Gestión Agronomía · Ingeniería Agrícola'},
  proto:      {hash:'#protocolos', titulo:'Protocolos de emergencia', sub:'Ingeniería Agrícola · Riopaila Agrícola',  doc:'Protocolos de emergencia · Ingeniería Agrícola'},
  proy:       {hash:'#proyectos',  titulo:'Proyectos ejecutados',     sub:'Ingeniería Agrícola · Riopaila Agrícola',  doc:'Proyectos ejecutados · Ingeniería Agrícola'},
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
  else if (vistaActual === 'agro') renderAgronomia();
  else if (vistaActual === 'proto') renderProtocolos();
  else if (vistaActual === 'proy') renderProyectos();
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
  const E = estructura(), P = ppto2027(), haP = haTotal2027(P);
  const card = (vista, icono, titulo, desc, dato, color) => `
    <button type="button" class="pt-card" data-ir="${vista}" style="--c:${color}">
      <span class="pt-ico">${icono}</span>
      <span class="pt-tit">${titulo}</span>
      <span class="pt-desc">${desc}</span>
      <span class="pt-dato">${dato}</span>
      <span class="pt-ir">Abrir →</span>
    </button>`;
  // Fondo de la portada: video en bucle (archivo en img/) con la foto como respaldo mientras carga
  const imgPortada = DB.portada && DB.portada.imagen ? DB.portada.imagen : 'img/portada.svg';
  const vid = DB.portada && /^img\/[\w.-]+\.(mp4|webm)$/i.test(DB.portada.video || '') ? DB.portada.video : '';
  q('portal').innerHTML = `
    <div class="pt-banner ${vid ? 'con-video' : ''}">
      <img src="${imgPortada}" alt="Ingeniería Agrícola · Riopaila Agrícola">
      ${vid ? `<video src="${esc(vid)}" poster="${imgPortada}" autoplay muted loop playsinline preload="auto" aria-label="Video de labores en campo"></video>` : ''}
      ${MODO_EDICION ? `<div class="pt-banner-acc">
        <label class="pt-cambiar">📷 Cambiar imagen<input type="file" id="pt-foto" accept="image/*" hidden></label>
        ${vid ? '<button type="button" class="pt-cambiar" id="pt-sin-video">⏹ Quitar video</button>' : ''}
        ${DB.portada ? '<button type="button" class="pt-cambiar" id="pt-quitar">↺ Imagen original</button>' : ''}</div>` : ''}
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
      ${(() => { const A = agroFilas(); return card('agro', '🌱', 'Gestión Agronomía', 'Suertes sembradas, surcadas y en ruta del Comité APS: fecha de siembra, variedad y observaciones.',
        A.length ? `<b>${A.length}</b> ${A.length === 1 ? 'suerte' : 'suertes'} · <b>${f2(sum(A, x => x.a))} ha</b> · ${A.filter(x => x.fecha).length} con fecha de siembra` : 'Sin suertes cerradas aún', '#15803d'); })()}
      ${(() => { const L = protocolos(); return card('proto', '🚨', 'Protocolos de emergencia', 'Libros de reacción: qué hacer ante inundaciones, rotura de diques, incendios, derrames y accidentes.',
        L.length ? `<b>${L.length}</b> ${L.length === 1 ? 'protocolo' : 'protocolos'} · ${L.filter(p => p.borrador).length} en borrador` : 'Por completar', 'var(--red)'); })()}
      ${(() => { const L = proyectos(); return card('proy', '🏗️', 'Proyectos ejecutados', 'Obras y proyectos del área: drenajes, diques, vías, canales, nivelación y mejoras, con inversión y resultados.',
        L.length ? `<b>${L.length}</b> ${L.length === 1 ? 'proyecto' : 'proyectos'} · inversión <b>${moneyM(sum(L, p => +p.inversion || 0))}</b>` : 'Por completar', '#0f766e'); })()}
    </div>
    <div class="pt-pie">Comité APS · Riopaila Agrícola · Elaborado por: <b>Luis Acosta</b> · Esp. de Ingeniería Agrícola</div>`;
}
q('portal').addEventListener('click', e => {
  const b = e.target.closest('[data-ir]'); if (b) { irA(b.dataset.ir); return; }
  if (e.target.closest('#pt-quitar')) { modCambio(() => { delete DB.portada; }); toast('Imagen original restaurada'); }
  if (e.target.closest('#pt-sin-video')) { modCambio(() => { delete DB.portada.video; }); toast('Video quitado · queda la imagen'); }
});
// Foto de portada (equipo o área): se reduce a máx. 1600 px y JPEG para que la página siga liviana
q('portal').addEventListener('change', e => {
  const f = e.target.id === 'pt-foto' && e.target.files[0]; if (!f) return;
  const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => {
    const k = Math.min(1, 1600 / img.width), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    const dato = c.toDataURL('image/jpeg', 0.8);
    modCambio(() => { DB.portada = {imagen: dato}; });
    toast(`✓ Imagen cambiada (${Math.round(dato.length * 0.75 / 1024)} KB) · recuerda 🚀 Publicar`);
  };
  img.onerror = () => toast('⚠ No se pudo leer esa imagen');
  img.src = url;
});

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
    // Tarjeta estilo organigrama: foto redonda (o iniciales), nombre y dos casillas (cargo | equipo)
    const ini = p.nombre ? p.nombre.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('') : '?';
    return `<li>
      <div class="org-card ${p.nombre ? '' : 'vacante'}" ${p.funciones ? `title="${esc(p.funciones)}"` : ''}>
        <div class="org-foto">${p.foto ? `<img src="${p.foto}" alt="${esc(p.nombre)}">` : `<span>${esc(ini)}</span>`}</div>
        <div class="org-nom">${p.nombre ? esc(p.nombre) : 'Por asignar'}</div>
        <div class="org-cel"><div>${esc(p.cargo || 'Cargo sin definir')}</div><div>${esc(p.equipo || p.zona || '—')}</div></div>
        ${ed ? `<div class="org-acc"><button type="button" data-org="editar" data-id="${esc(p.id)}" title="Editar">✏️</button><button type="button" data-org="agregar" data-id="${esc(p.id)}" title="Agregar a su cargo">➕</button><button type="button" data-org="borrar" data-id="${esc(p.id)}" title="Quitar">🗑</button></div>` : ''}
      </div>
      ${hs.length ? `<ul class="${hs.length >= 3 && hs.every(h => !hijos(h.id).length) ? 'org-hojas' : ''}">${hs.map(h => nodo(h, nivel + 1)).join('')}</ul>` : ''}
    </li>`;
  };
  q('estructura').innerHTML = `
    <div class="mod-top">
      <div><div class="sim-tit">👥 Estructura del área · Ingeniería Agrícola</div>
        <div class="sim-subt">${E.personas.length} ${E.personas.length === 1 ? 'cargo' : 'cargos'} · ${E.personas.filter(p => !p.nombre).length} por asignar${equipos.length ? ' · equipos: ' + equipos.map(esc).join(', ') : ''}${ed ? '' : ' · solo lectura'}</div></div>
      ${ed ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><label class="mbtn mbtn-ghost pt-file">📥 Cargar desde Excel<input type="file" id="est-xls" accept=".xlsx,.xlsm,.xls" hidden></label>
        <button type="button" class="mbtn mbtn-primary" data-org="agregar" data-id="">➕ Agregar cargo</button></div>` : ''}
    </div>
    ${E.personas.length ? `<div class="org-scroll"><ul class="org">${raices.map(p => nodo(p, 0)).join('')}</ul></div>` : '<div class="nores">Aún no hay cargos.' + (ed ? ' Pulsa «➕ Agregar cargo».' : '') + '</div>'}
    ${renderProcesos(E)}
    ${ed ? '<div class="note">💡 Organiza el área con «➕ A cargo» en cada persona. Deja el nombre vacío para un cargo por asignar. «Cargar desde Excel» lee solo nombre y cargo (no cédula, RH, ciudad ni teléfono) y la hoja de procesos y responsables. Los cambios llegan a todos al pulsar 🚀 Publicar.</div>' : ''}`;
  const f = q('est-xls'); if (f) f.addEventListener('change', () => f.files[0] && cargarEstructuraExcel(f.files[0]));
}

// Procesos y responsables del área, agrupados por proceso general; filtrables por responsable
let estFiltroResp = '';
function renderProcesos(E){
  const P = E.procesos || []; if (!P.length) return '';
  const resp = [...new Set(P.flatMap(p => String(p.responsable).split(/\s+-\s+/).map(x => x.trim()).filter(Boolean)))].sort();
  const vis = estFiltroResp ? P.filter(p => String(p.responsable).split(/\s+-\s+/).map(x => x.trim().toUpperCase()).includes(estFiltroResp.toUpperCase())) : P;
  const grupos = [];
  vis.forEach(p => { let g = grupos.find(x => x.general === p.general); if (!g) grupos.push(g = {n:p.n, general:p.general, nucleo:p.nucleo, admin:p.admin, indic:p.indic, items:[]}); g.items.push(p); });
  const si = v => /^SI$/i.test(String(v).trim());
  return `<div class="mod-top" style="margin-top:22px"><div><div class="sim-tit" style="font-size:13.5px">🧭 Procesos y responsables del área</div>
      <div class="sim-subt">${P.length} procesos específicos en ${new Set(P.map(p => p.general)).size} procesos generales</div></div>
      <label class="fchip" style="background:#fff"><span>Responsable</span><select id="est-f-resp" class="fsel ${estFiltroResp ? 'on' : ''}"><option value="">Todos</option>${resp.map(r => `<option ${r === estFiltroResp ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label></div>
    <div class="proc-grid">${grupos.map(g => `<div class="proc-card">
      <div class="proc-h"><span class="proc-n">${esc(g.n)}</span><b>${esc(g.general)}</b></div>
      ${g.nucleo && g.nucleo !== g.general ? `<div class="proc-nuc">${esc(g.nucleo)}</div>` : ''}
      <div class="proc-tags">${g.admin ? `<span class="${si(g.admin) ? 'si' : 'no'}">Proceso administrativo: ${si(g.admin) ? 'Sí' : 'No'}</span>` : ''}${g.indic ? `<span class="${si(g.indic) ? 'si' : 'no'}">Genera indicadores: ${si(g.indic) ? 'Sí' : 'No'}</span>` : ''}</div>
      <ul>${g.items.map(i => `<li><span>${esc(i.especifico)}</span><small>${esc(i.responsable)}</small></li>`).join('')}</ul>
    </div>`).join('')}</div>`;
}
q('estructura').addEventListener('change', e => { if (e.target.id === 'est-f-resp') { estFiltroResp = e.target.value; renderEstructura(); } });

// Lee del Excel del área: hoja con «NOMBRE Y APELLIDOS» y «CARGO» (solo esas dos columnas, por privacidad)
// y hoja con «PROCESO ESPECÍFICO» y «RESPONSABLE». Las celdas combinadas se completan con la fila anterior.
const titulo = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim()
  .replace(/(^|[\s/(-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase())
  .replace(/ (De|Del|La|Las|Los|Y|E|En|A|Con|Para|Por|El) /g, s => s.toLowerCase()).replace(/ (De|Del|La|Las|Los|Y|E|En|A|Con|Para|Por|El) /g, s => s.toLowerCase())
  .replace(/\(([A-Za-z]{1,4})\)/g, (m, s) => '(' + s.toUpperCase() + ')').replace(/\bAps\b/, 'APS')
  .replace(/(Ingenieria|Agricola|Tecnico|Supervision|Administracion|Coordinacion|Instalacion|Adecuacion|Preparacion)/g, w => ({Ingenieria:'Ingeniería', Agricola:'Agrícola', Tecnico:'Técnico', Supervision:'Supervisión', Administracion:'Administración', Coordinacion:'Coordinación', Instalacion:'Instalación', Adecuacion:'Adecuación', Preparacion:'Preparación'})[w]);
function leerEstructura(file){
  return cargarXLSX().then(XLSX => file.arrayBuffer().then(buf => {
    const wb = XLSX.read(buf, {type:'array'}), out = {personas:null, procesos:null};
    for (const n of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:'', raw:false});
      const hi = rows.findIndex(r => r.some(v => /NOMBRE/.test(norm(v))) && r.some(v => norm(v) === 'CARGO'));
      if (!out.personas && hi >= 0) {
        const H = rows[hi].map(norm), cn = H.findIndex(h => /NOMBRE/.test(h)), cc = H.indexOf('CARGO');
        const L = rows.slice(hi + 1).filter(r => String(r[cc]).trim()).map((r, i) => {
          const nom = String(r[cn]).trim(), vac = !nom || /VACANTE/.test(norm(nom));
          return {id:'p' + (i + 1), nombre: vac ? '' : titulo(nom), cargo: titulo(r[cc]), equipo:'', zona:'', funciones:'', reportaA:''};
        });
        // Jerarquía: el primero es la cabeza; practicantes y maestro de obras le reportan; oficios varios, al maestro
        const cabeza = L[0], maestro = L.find(p => /MAESTRO/.test(norm(p.cargo)));
        L.forEach((p, i) => {
          const c = norm(p.cargo);
          p.equipo = /OBRA|OFICIOS/.test(c) ? 'Obras civiles' : 'Ingeniería Agrícola';
          if (i === 0) return;
          p.reportaA = /OFICIOS/.test(c) && maestro ? maestro.id : cabeza.id;
        });
        if (L.length) out.personas = L;
      }
      const hp = rows.findIndex(r => r.some(v => /PROCESO ESPECIFICO/.test(norm(v))) && r.some(v => norm(v) === 'RESPONSABLE'));
      if (!out.procesos && hp >= 0) {
        const H = rows[hp].map(norm), c = {nuc:H.findIndex(h => /NUCLEO/.test(h)), n:H.indexOf(''), gen:H.findIndex(h => /PROCESO GENERAL/.test(h)), esp:H.findIndex(h => /PROCESO ESPECIFICO/.test(h)), resp:H.indexOf('RESPONSABLE')};
        const top = rows[hp - 1] ? rows[hp - 1].map(norm) : [], ca = top.findIndex(h => /ADMINISTRATIVO/.test(h)), ci = top.findIndex(h => /INDICADORES/.test(h));
        const num = H.findIndex((h, j) => j > c.nuc && j < c.gen);
        let prev = {nucleo:'', n:'', general:'', admin:'', indic:''};
        const P = [];
        rows.slice(hp + 1).forEach(r => {
          const esp = String(r[c.esp] || '').replace(/\s+/g, ' ').trim(); if (!esp) return;
          const nuevo = String(r[c.gen] || '').trim();
          if (nuevo) prev = {nucleo: titulo(r[c.nuc]) || prev.nucleo, n: String(r[num] || '').trim(), general: titulo(nuevo), admin: ca >= 0 ? String(r[ca]).trim() : '', indic: ci >= 0 ? String(r[ci]).trim() : ''};
          P.push(Object.assign({}, prev, {especifico: esp, responsable: String(r[c.resp] || '').replace(/\s+/g, ' ').trim()}));
        });
        if (P.length) out.procesos = P;
      }
    }
    return out;
  }));
}
function cargarEstructuraExcel(file){
  leerEstructura(file).then(r => {
    if (!r.personas && !r.procesos) { toast('⚠ No encontré la hoja de estructura (NOMBRE Y APELLIDOS / CARGO) ni la de procesos'); return; }
    const txtC = r.personas ? `${r.personas.length} cargos (${r.personas.filter(p => !p.nombre).length} vacantes)` : 'sin hoja de estructura';
    const txtP = r.procesos ? `${r.procesos.length} procesos` : 'sin hoja de procesos';
    if (!confirm(`Encontré: ${txtC} · ${txtP}.\nSolo se toman nombre y cargo (no cédula, RH, ciudad ni teléfono).\n¿Reemplazar la estructura del área?`)) return;
    modCambio(() => { const D = estEditable(); if (r.personas) D.personas = r.personas; if (r.procesos) D.procesos = r.procesos; D.fuente = file.name; });
    estFiltroResp = '';
    toast('✓ Estructura cargada · revisa a quién reporta cada uno y pulsa 🚀 Publicar');
  }).catch(err => toast('⚠ ' + err.message));
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
    <div class="mrow"><div><label class="mlabel">Foto</label>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="org-foto" id="org-foto-prev">${p.foto ? `<img src="${p.foto}" alt="">` : '<span>📷</span>'}</div>
        <label class="mbtn mbtn-ghost pt-file">Elegir foto<input type="file" id="org-foto" accept="image/*" hidden></label>
        <button type="button" class="mbtn mbtn-ghost" id="org-foto-quitar" ${p.foto ? '' : 'hidden'}>Quitar foto</button>
      </div></div></div>
    <div id="org-err" class="err" hidden></div>`;
  // Foto: recorte cuadrado de 240 px en JPEG (liviano para la página pública)
  let foto = p.foto || '';
  q('org-foto').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const lado = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 240;
      c.getContext('2d').drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 240, 240);
      URL.revokeObjectURL(url); foto = c.toDataURL('image/jpeg', 0.82);
      q('org-foto-prev').innerHTML = `<img src="${foto}" alt="">`; q('org-foto-quitar').hidden = false;
    };
    img.onerror = () => toast('⚠ No se pudo leer esa imagen');
    img.src = url;
  });
  q('org-foto-quitar').addEventListener('click', () => { foto = ''; q('org-foto-prev').innerHTML = '<span>📷</span>'; q('org-foto-quitar').hidden = true; });
  modalFooter.innerHTML = `<button class="mbtn mbtn-ghost" onclick="closeModal()">Cancelar</button><button class="mbtn mbtn-primary" id="org-guardar">✓ Guardar</button>`;
  overlay.style.display = 'flex'; document.body.style.overflow = 'hidden';
  q('org-guardar').addEventListener('click', () => {
    const v = k => q('org-' + k).value.trim();
    if (!v('cargo')) { q('org-err').hidden = false; q('org-err').textContent = 'Escribe el cargo.'; return; }
    modCambio(() => {
      const D = estEditable(), datos = {nombre:v('nombre'), cargo:v('cargo'), equipo:v('equipo'), zona:v('zona'), funciones:v('funciones'), reportaA:v('reportaA'), foto};
      if (nuevo) D.personas.push(Object.assign({id:nuevoId()}, datos)); else Object.assign(D.personas.find(x => x.id === p.id), datos);
    });
    closeModal(); toast(nuevo ? '✓ Cargo agregado' : '✓ Cargo actualizado');
  });
}

// ── Presupuesto APS 2027 (programa de renovación) ──
// Fuente: hoja "Riopaila" del libro "RENOVACION PPTO 2027": una fila por suerte con hacienda, zona,
// área, mes de renovación, variedades y nivelación (N1–N4). Las hectáreas por mes salen de ahí.
let pptoBase = null;
function ppto2027(){
  return DB.ppto2027 || (pptoBase = pptoBase || {fuente:'', suertes:[],
    labores:SIM_PPTO_BASE.map(p => ({labor:p.labor, cant:p.cant, costo:Math.round(p.costo)}))});
}
function pptoEditable(){ if (!DB.ppto2027) DB.ppto2027 = clone(ppto2027()); return DB.ppto2027; }
const pptoHa2027 = P => sum(P.labores, l => (+l.cant || 0) * (+l.costo || 0));
// Hectáreas por mes y zona (meses 1–12)
function pptoMeses(P){
  const z1 = Array(12).fill(0), z2 = Array(12).fill(0);
  (P.suertes || []).forEach(s => { const m = (+s.mes || 0) - 1; if (m >= 0 && m < 12) (s.z === 1 ? z1 : z2)[m] += +s.a || 0; });
  if (!(P.suertes || []).length && P.z1) { P.z1.forEach((v, i) => z1[i] = +v || 0); (P.z2 || []).forEach((v, i) => z2[i] = +v || 0); }
  return {z1, z2};
}
const haTotal2027 = P => { const M = pptoMeses(P); return sum(M.z1) + sum(M.z2); };

// Gráfico de barras por mes (Zona 1 + Zona 2 apiladas) con la referencia 2026 como marca gris
function graficoMeses(M, ref, mesSel, maxFijo){
  const W = 900, H = 260, L = 44, R = 12, T = 18, B = 34, w = (W - L - R) / 12;
  const tot = M.z1.map((v, i) => v + M.z2[i]);
  const max = (maxFijo || Math.max(10, ...tot, ...ref)) * 1.12, y = v => T + (H - T - B) * (1 - v / max), bw = Math.min(42, w * 0.62);
  const paso = max > 200 ? 50 : max > 80 ? 20 : 10;
  let s = '';
  for (let v = 0; v <= max; v += paso) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#e6edf4"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end" class="g-ax">${v}</text>`;
  MESES.forEach((m, i) => {
    const x = L + w * i + (w - bw) / 2, a = M.z1[i], b = M.z2[i], gap = a && b ? 2 : 0;
    const h1 = y(0) - y(a), h2 = y(0) - y(b);
    const tip = `${m}: ${f2(tot[i])} ha · Zona 1 ${f2(a)} · Zona 2 ${f2(b)}${ref[i] ? ' · ref. 2026 ' + f2(ref[i]) : ''} · clic para filtrar el mes`;
    s += `<g class="g-bar ${mesSel && mesSel !== i + 1 ? 'g-off' : ''} ${mesSel === i + 1 ? 'g-sel' : ''}" data-mes="${i + 1}"><title>${tip}</title><rect x="${L + w * i}" y="${T}" width="${w}" height="${H - T - B}" fill="transparent"/>`;
    if (a) s += `<rect x="${x}" y="${y(a)}" width="${bw}" height="${Math.max(0, h1)}" fill="var(--green)" rx="${b ? 0 : 4}"/>`;
    if (b) s += `<path d="M${x},${y(a) - gap} v${-(h2 - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${h2 - 4} z" fill="var(--amber)"/>`;
    if (tot[i]) s += `<text x="${x + bw / 2}" y="${y(tot[i]) - 5 - gap}" text-anchor="middle" class="g-val">${Math.round(tot[i])}</text>`;
    if (ref[i]) s += `<line x1="${x - 4}" x2="${x + bw + 4}" y1="${y(ref[i])}" y2="${y(ref[i])}" stroke="#7a95ae" stroke-width="2" stroke-dasharray="4 3"/>`;
    s += `<text x="${L + w * i + w / 2}" y="${H - B + 16}" text-anchor="middle" class="g-ax">${m}</text></g>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="g-meses" role="img" aria-label="Hectáreas a renovar por mes en 2027">${s}<line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="#b8c8db"/></svg>`;
}

// Filtros del módulo: hacienda, zona y mes de renovación (columnas de la hoja)
const pf = {hac:'', zona:'', mes:0};
let pptoFiltroHac = '';   // (compatibilidad) = pf.hac
function renderPpto2027(){
  const P = ppto2027(), ed = MODO_EDICION, dis = ed ? '' : 'disabled', Todas = P.suertes || [];
  pptoFiltroHac = pf.hac;
  // Sf: filtro de hacienda y zona (el gráfico muestra sus 12 meses) · S: además el mes elegido
  const Sf = Todas.filter(s => (!pf.hac || s.h === pf.hac) && (!pf.zona || s.z === +pf.zona));
  const S = pf.mes ? Sf.filter(s => +s.mes === pf.mes) : Sf;
  const Mg = (Todas.length ? pptoMeses({suertes:Sf}) : pptoMeses(P));
  const t1 = sum(S.filter(s => s.z === 1), s => s.a), t2 = sum(S.filter(s => s.z === 2), s => s.a);
  const M = Todas.length ? {z1:Mg.z1, z2:Mg.z2} : Mg, tt = Todas.length ? t1 + t2 : sum(M.z1) + sum(M.z2);
  const a26 = DB.pptoMensual, refZ = pf.zona === '1' ? a26.z1 : pf.zona === '2' ? a26.z2 : a26.z1.map((v, i) => v + (a26.z2[i] || 0));
  const ref = pf.hac ? Array(12).fill(0) : refZ, t26 = pf.mes ? (ref[pf.mes - 1] || 0) : sum(ref), costoHa = pptoHa2027(P);
  const hacs = [...new Set(S.map(s => s.h))];
  const porHac = hacs.map(h => { const L = S.filter(s => s.h === h); return {h, z:L[0].z, n:L.length, a:sum(L, s => s.a),
    meses:[...new Set(L.map(s => +s.mes))].sort((x, y) => x - y).map(m => MESES[m - 1]).join(', ')}; }).sort((x, y) => y.a - x.a);
  const niv = ['N1','N2','N3','N4'].map(n => [n, sum(S.filter(s => s.niv === n), s => s.a)]);
  const vis = S, hayFiltro = pf.hac || pf.zona || pf.mes;
  // Programa 2026 por mes (del comité), con el filtro de zona; misma escala que 2027 para comparar
  const cero = Array(12).fill(0);
  const M26 = {z1: pf.zona === '2' ? cero : a26.z1.slice(), z2: pf.zona === '1' ? cero : a26.z2.slice()};
  const maxComun = Math.max(10, ...M.z1.map((v, i) => v + M.z2[i]), ...(pf.hac ? [] : M26.z1.map((v, i) => v + M26.z2[i])));
  const hacsTodas = [...new Set(Todas.map(s => s.h))].sort();
  const filtros = Todas.length ? `<div class="sim-bar pp-filtros">
      <label class="fchip"><span>Hacienda</span><select id="pp-f-hac" class="fsel ${pf.hac ? 'on' : ''}"><option value="">Todas</option>${hacsTodas.map(h => `<option ${h === pf.hac ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>
      <label class="fchip"><span>Zona</span><select id="pp-f-zona" class="fsel ${pf.zona ? 'on' : ''}"><option value="">Todas</option><option value="1" ${pf.zona === '1' ? 'selected' : ''}>Zona 1</option><option value="2" ${pf.zona === '2' ? 'selected' : ''}>Zona 2</option></select></label>
      <label class="fchip"><span>Mes</span><select id="pp-f-mes" class="fsel ${pf.mes ? 'on' : ''}"><option value="0">Todos</option>${MESES.map((m, i) => `<option value="${i + 1}" ${pf.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
      ${hayFiltro ? '<button type="button" class="plegar-todo" data-pp-limpiar>✕ Quitar filtros</button>' : ''}
      <span class="meta">${hayFiltro ? `Mostrando: ${[pf.hac, pf.zona && 'Zona ' + pf.zona, pf.mes && MESES[pf.mes - 1]].filter(Boolean).map(esc).join(' · ')}` : 'Clic en una barra para ver ese mes'}</span>
    </div>` : '';
  q('ppto2027').innerHTML = `
    <div class="mod-top">
      <div><div class="sim-tit">📅 Presupuesto APS 2027 · Programa de renovación</div>
        <div class="sim-subt">${Todas.length ? `Fuente: ${esc(P.fuente || 'Excel de renovación')}` : 'Sin datos aún'}${ed ? '' : ' · solo lectura'}</div></div>
      ${ed ? '<label class="mbtn mbtn-ghost pt-file">📥 Cargar desde Excel<input type="file" id="ppto-xls" accept=".xlsx,.xlsm,.xls" hidden></label>' : ''}
    </div>
    ${filtros}
    <div class="sim-kpis">
      <div class="sim-kpi"><div class="l">Área a renovar 2027${pf.mes ? ' · ' + MESES[pf.mes - 1] : ''}</div><div class="v">${f2(tt)} ha</div><div class="s">${S.length} suertes · ${hacs.length} ${hacs.length === 1 ? "hacienda" : "haciendas"}</div></div>
      <div class="sim-kpi"><div class="l">Por zona</div><div class="v" style="font-size:15px">Z1 ${f2(t1)} · Z2 ${f2(t2)}</div><div class="s">${tt ? Math.round(t1 / tt * 100) : 0}% · ${tt ? Math.round(t2 / tt * 100) : 0}%</div></div>
      <div class="sim-kpi"><div class="l">Diferencia vs. programa 2026</div><div class="v">${tt && t26 ? ((tt - t26) >= 0 ? '+' : '−') + f2(Math.abs(tt - t26)) + ' ha' : '—'}</div><div class="s">${pf.hac ? "sin referencia por hacienda" : `2027: ${f2(tt)} ha · 2026: ${f2(t26)} ha`}</div></div>
      <div class="sim-kpi"><div class="l">Inversión estimada</div><div class="v">${moneyM(tt * costoHa)}</div><div class="s">${money(costoHa)}/ha (costo por labor)</div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Programa 2026 por mes (ha)</b> <span class="meta">· ${pf.hac ? 'no disponible por hacienda' : `total ${f2(sum(M26.z1) + sum(M26.z2))} ha`}</span>
        <span class="g-ley"><i style="background:var(--green)"></i>Zona 1 <i style="background:var(--amber)"></i>Zona 2</span></div>
      ${pf.hac ? '<div class="nores">El programa 2026 del comité no viene por hacienda.</div>' : `<div class="sim-tw" style="padding:6px 10px 2px">${graficoMeses(M26, Array(12).fill(0), pf.mes, maxComun)}</div>`}
    </div>
    <div class="sim-card abierta" style="margin-top:12px"><div class="sim-card-h" style="cursor:default"><b>Programa 2027 por mes (ha)</b> <span class="meta">· total ${f2(sum(M.z1) + sum(M.z2))} ha</span>
        <span class="g-ley"><i style="background:var(--green)"></i>Zona 1 <i style="background:var(--amber)"></i>Zona 2</span></div>
      <div class="sim-tw" style="padding:6px 10px 2px">${graficoMeses(M, Array(12).fill(0), pf.mes, maxComun)}</div>
      <div class="sim-tw"><table class="sim-t ppto-t"><thead><tr><th>Zona</th>${MESES.map(m => `<th class="n">${m}</th>`).join('')}<th class="n">Total</th></tr></thead>
        <tbody>${[['Zona 1', M.z1], ['Zona 2', M.z2]].map(([n, z]) => `<tr><td class="lab">${n}</td>${z.map(v => `<td class="n">${v ? f2(v) : '—'}</td>`).join('')}<td class="n b">${f2(sum(z))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total 2027</td>${M.z1.map((v, i) => `<td class="n">${v + M.z2[i] ? f2(v + M.z2[i]) : '—'}</td>`).join('')}<td class="n b">${f2(sum(M.z1) + sum(M.z2))}</td></tr></tfoot></table></div>
    </div>
    ${Todas.length ? `<div class="pp-dos">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Por hacienda</b> <span class="meta">· clic para ver sus suertes</span></div>
        <div class="sim-tw"><table class="sim-t"><thead><tr><th>Hacienda</th><th>Zona</th><th class="n">Suertes</th><th class="n">Área (ha)</th><th class="n">%</th><th>Meses</th></tr></thead>
          <tbody>${porHac.map(x => `<tr class="pp-hac ${x.h === pptoFiltroHac ? 'on' : ''}" data-hac="${esc(x.h)}"><td class="lab">${esc(x.h)}</td><td>Z${x.z}</td><td class="n">${x.n}</td><td class="n b">${f2(x.a)}</td><td class="n">${(x.a / tt * 100).toFixed(1)}%</td><td>${x.meses}</td></tr>`).join('')}</tbody></table></div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Nivelación requerida</b></div>
        <div style="padding:10px 14px">${niv.map(([n, a]) => `<div class="pp-niv"><span>${n}</span><div class="bt"><div class="bf" style="width:${tt ? a / tt * 100 : 0}%;background:var(--violet)"></div></div><b>${f2(a)} ha</b><small>${tt ? (a / tt * 100).toFixed(0) : 0}%</small></div>`).join('')}
          <div class="meta" style="margin-top:6px">N1 mínimo · N2 moderado · N3 alto · N4 muy alto movimiento de tierra</div></div></div>
    </div>
    <details class="sim-param" ${hayFiltro ? 'open' : ''}><summary>📋 Suertes a renovar (${vis.length}${hayFiltro ? ' con los filtros' : ''})</summary>
      <div class="sim-tw" style="max-height:420px;margin-top:8px"><table class="sim-t"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Zona</th><th>Tipo</th><th class="n">Área (ha)</th><th>Mes</th><th>Variedad actual → nueva</th><th>Nivelación</th></tr></thead>
        <tbody>${vis.slice().sort((x, y) => x.mes - y.mes || x.s.localeCompare(y.s)).map(s => `<tr><td class="lab" style="font-family:var(--mono)">${esc(s.s)}</td><td>${esc(s.h)}</td><td>Z${s.z}</td><td>${esc(s.f || '')}</td><td class="n">${f2(s.a)}</td><td>${MESES[s.mes - 1] || '—'}</td><td>${esc(s.vAct || '—')} → <b>${esc(s.v1 || '—')}</b>${s.v2 ? ' / ' + esc(s.v2) : ''}</td><td>${esc(s.niv || '—')}</td></tr>`).join('')}</tbody></table></div>
    </details>` : `<div class="nores">${ed ? 'Pulsa «📥 Cargar desde Excel» y elige el libro de renovación 2027 (hoja «Riopaila»).' : 'Aún no se ha cargado el programa de renovación 2027.'}</div>`}
    <div class="sim-card abierta" style="margin-top:12px"><div class="sim-card-h" style="cursor:default"><b>Costo presupuestado por labor</b> <span class="meta">· para la inversión estimada; valores iniciales de referencia 2026</span></div>
      <div class="sim-tw"><table class="sim-t sim-pp">
        <thead><tr><th>Labor</th><th class="n">Pases</th><th class="n">$ por pase/ha</th><th class="n">$/ha</th>${ed ? '<th></th>' : ''}</tr></thead>
        <tbody>${P.labores.map((l, i) => `<tr data-i="${i}"><td>${ed ? `<input data-pl="labor" value="${esc(l.labor)}" style="width:130px">` : esc(l.labor)}</td>
          <td class="n"><input type="number" step="any" min="0" data-pl="cant" value="${l.cant}" ${dis}></td>
          <td class="n"><input type="number" step="any" min="0" data-pl="costo" value="${l.costo}" ${dis}></td>
          <td class="n b">${money((+l.cant || 0) * (+l.costo || 0))}</td>${ed ? '<td><button type="button" class="x" data-pl-borrar>×</button></td>' : ''}</tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">Total por hectárea</td><td class="n b">${money(costoHa)}</td>${ed ? '<td></td>' : ''}</tr></tfoot>
      </table></div>
      ${ed ? '<div class="sim-add"><button type="button" class="link" data-pl-agregar>+ Agregar labor</button></div>' : ''}</div>`;
  const f = q('ppto-xls'); if (f) f.addEventListener('change', () => f.files[0] && cargarPptoExcel(f.files[0]));
}
q('ppto2027').addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'pp-f-hac') { pf.hac = el.value; renderPpto2027(); return; }
  if (el.id === 'pp-f-zona') { pf.zona = el.value; renderPpto2027(); return; }
  if (el.id === 'pp-f-mes') { pf.mes = +el.value; renderPpto2027(); return; }
  if (el.dataset.pl) modCambio(() => { const l = pptoEditable().labores[+el.closest('tr').dataset.i]; l[el.dataset.pl] = el.dataset.pl === 'labor' ? el.value.trim() : (num(el.value) || 0); });
});
q('ppto2027').addEventListener('click', e => {
  const h = e.target.closest('.pp-hac');
  if (h) { pf.hac = pf.hac === h.dataset.hac ? '' : h.dataset.hac; renderPpto2027(); return; }
  const bar = e.target.closest('.g-bar[data-mes]');
  if (bar) { const m = +bar.dataset.mes; pf.mes = pf.mes === m ? 0 : m; renderPpto2027(); return; }
  if (e.target.closest('[data-pp-limpiar]')) { pf.hac = ''; pf.zona = ''; pf.mes = 0; renderPpto2027(); return; }
  if (e.target.closest('[data-pl-agregar]')) modCambio(() => { pptoEditable().labores.push({labor:'Nueva labor', cant:1, costo:0}); });
  else if (e.target.closest('[data-pl-borrar]')) { const i = +e.target.closest('tr').dataset.i; modCambio(() => { pptoEditable().labores.splice(i, 1); }); }
});

// Lee la hoja "Riopaila" (o la primera con encabezados Hacienda / Sec-Ste / Área): una fila por suerte
function leerRenovacion(file){
  return cargarXLSX().then(XLSX => file.arrayBuffer().then(buf => {
    const wb = XLSX.read(buf, {type:'array'});
    const orden = [...wb.SheetNames.filter(n => norm(n) === 'RIOPAILA'), ...wb.SheetNames];
    for (const n of orden) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], {header:1, defval:'', raw:true});
      const hi = rows.findIndex(r => r.some(v => norm(v) === 'SEC STE') && r.some(v => norm(v) === 'HACIENDA'));
      if (hi < 0) continue;
      const H = rows[hi].map(norm), col = re => H.findIndex(h => re.test(h));
      const c = {h:col(/^HACIENDA$/), z:col(/^ZONA$/), f:col(/^FINCA$/), s:col(/^SEC STE$/), a:col(/^AREA$/), mes:col(/^RENOVACION$/),
        vAct:col(/^ACTUAL$/), v1:col(/^VARIEDAD 1$/), v2:col(/^VARIEDAD 2$/), agro:col(/AGROECOLOGICA/), n:[1,2,3,4].map(i => col(new RegExp('^N ' + i + '$')))};
      if (c.s < 0 || c.a < 0 || c.mes < 0) continue;
      const suertes = rows.slice(hi + 1).filter(r => /^\d{4}-\d{3}$/.test(String(r[c.s]).trim())).map(r => {
        const zn = String(r[c.z]).match(/\d/), ni = c.n.findIndex(k => k >= 0 && (num(r[k]) || 0) > 0);
        return {h:String(r[c.h]).trim().toUpperCase(), z:zn ? +zn[0] : zonaDe(String(r[c.h]).trim().toUpperCase()), f:txt(r[c.f]) || '', s:String(r[c.s]).trim(),
          a:+(num(r[c.a]) || 0).toFixed(2), mes:Math.round(num(r[c.mes]) || 0), vAct:txt(r[c.vAct]) || '', v1:txt(r[c.v1]) || '', v2:txt(r[c.v2]) || '',
          agro:txt(r[c.agro]) || '', niv:ni >= 0 ? 'N' + (ni + 1) : ''};
      });
      if (suertes.length) return {hoja:n, suertes};
    }
    return null;
  }));
}
function cargarPptoExcel(file){
  leerRenovacion(file).then(r => {
    if (!r) { toast('⚠ No encontré una hoja con columnas Hacienda, Sec-Ste, Área y Mes de renovación'); return; }
    const ha = sum(r.suertes, s => s.a), sinMes = r.suertes.filter(s => !(s.mes >= 1 && s.mes <= 12)).length;
    if (!confirm(`Hoja «${r.hoja}»: ${r.suertes.length} suertes · ${f2(ha)} ha${sinMes ? `\n(${sinMes} sin mes de renovación)` : ''}.\n¿Reemplazar el programa de renovación 2027?`)) return;
    modCambio(() => { const P = pptoEditable(); P.suertes = r.suertes; P.fuente = `${file.name} · hoja ${r.hoja}`; delete P.z1; delete P.z2; });
    pf.hac = ''; pf.zona = ''; pf.mes = 0;
    toast('✓ Programa 2027 cargado · recuerda 🚀 Publicar');
  }).catch(err => toast('⚠ ' + err.message));
}

// ── Gestión Agronomía ──
// Todas las suertes cerradas del dashboard APS: sembradas (caña y arroz), surcadas (labor SURCADA)
// y en ruta de siembra. Lo que se escribe (fecha de siembra, variedad, observación) queda en
// DB.agronomia.filas por suerte y cultivo, y la fila se conserva aunque salga del comité.
const agroClave = (s, h, c) => `${h}|${s}|${c || 'CAÑA'}`;
const AGRO_ESTADOS = ['Sembrada', 'Surcada', 'En ruta de siembra', 'Guardada'];
function agroFilas(){
  const guard = (DB.agronomia && DB.agronomia.filas) || {}, M = new Map();
  // Cultivo de una suerte aún sin sembrar: el del lote pendiente, si no caña
  const cultPend = (s, h) => ((DB.lotes.find(l => l.s === s && l.h === h && l.e !== 'SEMBRADA') || {}).c) || 'CAÑA';
  const poner = (s, h, c, a, z, v, origen) => {
    const k = agroClave(s, h, c); if (M.has(k)) return;
    const l = DB.lotes.find(x => x.s === s && x.h === h && x.c === c) || {};
    M.set(k, {k, s, h, c, a:+a || 0, z:z || zonaDe(h), vBase:v || l.v || '', origen});
  };
  DB.lotes.filter(l => l.e === 'SEMBRADA').forEach(l => poner(l.s, l.h, l.c, l.a, l.z, l.v, 'Sembrada'));
  DB.proceso.filter(r => norm(r.labor) === 'SURCADA').forEach(r => poner(r.sue, r.hac, cultPend(r.sue, r.hac), r.area, r.z, r.variedad, 'Surcada'));
  DB.ruta.forEach(r => poner(r.s, r.h, cultPend(r.s, r.h), r.a, null, r.variedad, 'En ruta de siembra'));
  Object.entries(guard).forEach(([k, g]) => { if (!M.has(k) && g.s) M.set(k, {k, s:g.s, h:g.h, c:g.c || 'CAÑA', a:+g.a || 0, z:g.z || zonaDe(g.h), vBase:'', origen:'Guardada'}); });
  return [...M.values()].map(x => {
    const g = guard[x.k] || {}, partes = String(x.s).split('-');
    return Object.assign(x, {sector:partes.length > 1 ? partes[0] : '', ste:partes.length > 1 ? partes.slice(1).join('-') : x.s,
      fecha:g.fecha || '', corte:g.corte || '', variedad:g.variedad !== undefined ? g.variedad : x.vBase, obs:g.obs || '',
      lucro:diasEntre(g.corte, g.fecha), mCorte:g.mCorte || '', mFecha:g.mFecha || '', mLucro:diasEntre(g.mCorte, g.mFecha)});
  }).sort((a, b) => a.h.localeCompare(b.h) || a.s.localeCompare(b.s));
}
function fechaLarga(iso){ const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${+m[3]} ${MESES[+m[2] - 1]} ${m[1]}` : ''; }
// Días de lucro cesante: de la fecha de corte (cosecha) a la fecha de siembra de esta tabla
function diasEntre(desde, hasta){
  const a = Date.parse(desde || ''), b = Date.parse(hasta || '');
  return isNaN(a) || isNaN(b) ? null : Math.round((b - a) / 864e5);
}
function promedioLucro(A, campo = 'lucro'){
  const L = A.filter(x => x[campo] != null && x[campo] >= 0), area = sum(L, x => x.a);
  return {n:L.length, prom:L.length ? sum(L, x => x[campo]) / L.length : null, pond:area ? sum(L, x => x[campo] * x.a) / area : null};
}
const af = {est:'', hac:'', cult:''};
function renderAgronomia(){
  const Todas = agroFilas(), ed = MODO_EDICION;
  const A = Todas.filter(x => (!af.est || x.origen === af.est) && (!af.hac || x.h === af.hac) && (!af.cult || x.c === af.cult));
  const hayFiltro = af.est || af.hac || af.cult, PL = promedioLucro(A), PM = promedioLucro(A, 'mLucro');
  const celLucro = (v, cls, l) => `<td class="n b ${cls}" data-l="${l}">${v == null ? '<span class="meta">—</span>' : v < 0
    ? '<span style="color:var(--red)" title="La siembra quedó antes del corte: revisar fechas">⚠ revisar</span>'
    : `<span style="color:${v > 120 ? 'var(--red)' : v > 60 ? 'var(--amber)' : 'var(--green)'}">${v}</span>`}</td>`;
  const prom = P => P.prom != null ? Math.round(P.prom) + ' días' : '—';
  const sel = (id, val, ops, todas) => `<select id="${id}" class="fsel ${val ? 'on' : ''}"><option value="">${todas}</option>${ops.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const colorEst = {'Sembrada':'var(--green)', 'Surcada':'var(--cyan)', 'En ruta de siembra':'var(--amber)', 'Guardada':'var(--muted)'};
  const celda = (x, campo, tipo, ph) => ed
    ? `<input type="${tipo}" data-ag="${campo}" value="${esc(x[campo])}" placeholder="${ph}" ${tipo === 'text' ? 'style="width:100%"' : ''}>`
    : (tipo === 'date' ? (fechaLarga(x[campo]) || '<span class="meta">—</span>') : (esc(x[campo]) || '<span class="meta">—</span>'));
  q('agronomia').innerHTML = `
    <div class="mod-top">
      <div><div class="sim-tit">🌱 Gestión Agronomía · Suertes cerradas</div>
        <div class="sim-subt">Se traen solas del Dashboard APS (sembradas, surcadas y en ruta de siembra) · ${DB.meta.semana ? esc(DB.meta.semana) : ''}${ed ? ' · escribe y se guarda solo; luego 🚀 Publicar' : ' · solo lectura'}${DB.agronomia && DB.agronomia.maestro ? ` · Maestro: ${esc(DB.agronomia.maestro)}` : ''}</div></div>
      ${ed ? '<label class="mbtn mbtn-ghost pt-file">📥 Cargar maestro<input type="file" id="ag-maestro" accept=".xlsx,.xlsm,.xls" hidden></label>' : ''}
    </div>
    <div class="sim-bar pp-filtros">
      <label class="fchip"><span>Estado</span>${sel('ag-f-est', af.est, AGRO_ESTADOS.filter(e => Todas.some(x => x.origen === e)), 'Todos')}</label>
      <label class="fchip"><span>Hacienda</span>${sel('ag-f-hac', af.hac, [...new Set(Todas.map(x => x.h))].sort(), 'Todas')}</label>
      <label class="fchip"><span>Cultivo</span>${sel('ag-f-cult', af.cult, [...new Set(Todas.map(x => x.c))].sort(), 'Todos')}</label>
      ${hayFiltro ? '<button type="button" class="plegar-todo" data-ag-limpiar>✕ Quitar filtros</button>' : ''}
      <span class="meta">${AGRO_ESTADOS.filter(e => Todas.some(x => x.origen === e)).map(e => `${e}: ${Todas.filter(x => x.origen === e).length}`).join(' · ')}</span>
    </div>
    <div class="sim-kpis">
      <div class="sim-kpi"><div class="l">Suertes${hayFiltro ? ' (filtro)' : ''}</div><div class="v">${A.length}</div><div class="s">${[...new Set(A.map(x => x.h))].length} haciendas</div></div>
      <div class="sim-kpi"><div class="l">Área</div><div class="v">${f2(sum(A, x => x.a))} ha</div><div class="s">Z1 ${f2(sum(A.filter(x => x.z === 1), x => x.a))} · Z2 ${f2(sum(A.filter(x => x.z === 2), x => x.a))}</div></div>
      <div class="sim-kpi"><div class="l">Con fecha de siembra</div><div class="v">${A.filter(x => x.fecha).length}</div><div class="s">${A.filter(x => !x.fecha).length} por definir · ${A.filter(x => x.corte).length} con fecha de corte</div></div>
      <div class="sim-kpi"><div class="l">Lucro cesante promedio · real</div><div class="v">${prom(PL)}</div><div class="s">${PL.n ? `${PL.n} suertes · ponderado por área ${Math.round(PL.pond)} días` : 'Falta fecha de corte y de siembra'}</div></div>
      <div class="sim-kpi"><div class="l">Lucro cesante promedio · maestro</div><div class="v">${prom(PM)}</div><div class="s">${PM.n ? `${PM.n} suertes · ponderado por área ${Math.round(PM.pond)} días${PL.n ? ` · diferencia ${Math.round(PM.prom - PL.prom) >= 0 ? '+' : ''}${Math.round(PM.prom - PL.prom)} días` : ''}` : 'Pendiente cargar el maestro'}</div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-tw"><table class="sim-t ag-t">
      <thead><tr><th rowspan="2">Sector</th><th rowspan="2">Suerte</th><th rowspan="2">Hacienda</th><th rowspan="2" class="n">Área (ha)</th><th rowspan="2">Cultivo</th><th rowspan="2">Estado</th>
        <th colspan="3" class="ag-grp ag-grp-real">Real</th><th colspan="3" class="ag-grp ag-grp-mae">Maestro</th><th rowspan="2">Variedad</th><th rowspan="2">Observación</th>${ed ? '<th rowspan="2"></th>' : ''}</tr>
        <tr><th class="ag-sub-real">Fecha de corte</th><th class="ag-sub-real">Fecha de siembra</th><th class="n ag-sub-real" title="Días entre la fecha de corte y la fecha de siembra">Días lucro cesante</th>
        <th class="ag-sub-mae">Fecha de corte</th><th class="ag-sub-mae">Fecha de siembra</th><th class="n ag-sub-mae" title="Según las fechas del maestro">Días lucro cesante</th></tr></thead>
      <tbody>${A.length ? A.map(x => `<tr data-k="${esc(x.k)}">
        <td class="ag-sec" style="font-family:var(--mono)">${esc(x.sector) || '—'}</td><td class="lab ag-ste" style="font-family:var(--mono)">${esc(x.ste)}</td>
        <td class="ag-hac">${esc(x.h)} <span class="meta">Z${x.z}</span></td><td class="n b ag-a">${f2(x.a)}<span class="ag-u"> ha</span></td>
        <td class="ag-c">${esc(x.c)}</td><td class="ag-e"><span class="ag-est" style="--c:${colorEst[x.origen]}">${esc(x.origen)}</span></td>
        <td class="ag-co" data-l="Fecha de corte">${celda(x, 'corte', 'date', '')}</td><td class="ag-f" data-l="Fecha de siembra">${celda(x, 'fecha', 'date', '')}</td>
        ${celLucro(x.lucro, 'ag-l', 'Días lucro (real)')}
        <td class="ag-mco ag-mae" data-l="Corte (maestro)">${celda(x, 'mCorte', 'date', '')}</td><td class="ag-mf ag-mae" data-l="Siembra (maestro)">${celda(x, 'mFecha', 'date', '')}</td>
        ${celLucro(x.mLucro, 'ag-ml ag-mae', 'Días lucro (maestro)')}<td class="ag-v" data-l="Variedad">${celda(x, 'variedad', 'text', 'Variedad')}</td><td class="ag-o" data-l="Observación" style="min-width:200px">${celda(x, 'obs', 'text', 'Observación')}</td>
        ${ed ? `<td class="ag-x">${x.origen === 'Guardada' ? '<button type="button" class="x" data-ag-borrar title="Quitar de la lista">×</button>' : ''}</td>` : ''}</tr>`).join('')
        : `<tr><td colspan="${ed ? 15 : 14}" class="nores">${hayFiltro ? 'Ninguna suerte con esos filtros.' : 'No hay suertes cerradas en el último comité.'}</td></tr>`}</tbody>
      ${A.length ? `<tfoot><tr><td colspan="3">Total</td><td class="n b">${f2(sum(A, x => x.a))}</td><td colspan="4"></td><td class="n b" title="Promedio simple real">${PL.prom != null ? 'Prom. ' + Math.round(PL.prom) : ''}</td><td colspan="2"></td><td class="n b" title="Promedio simple maestro">${PM.prom != null ? 'Prom. ' + Math.round(PM.prom) : ''}</td><td colspan="${ed ? 3 : 2}"></td></tr></tfoot>` : ''}
    </table></div></div>
    <div class="meta" style="margin-top:8px">Si una suerte deja de aparecer en el comité, su fila se conserva aquí (estado «Guardada») cuando tiene datos escritos.</div>`;
}
q('agronomia').addEventListener('change', e => {
  const id = e.target.id, k = {'ag-f-est':'est', 'ag-f-hac':'hac', 'ag-f-cult':'cult'}[id];
  if (k) { af[k] = e.target.value; renderAgronomia(); }
});
q('agronomia').addEventListener('change', e => {
  const el = e.target, tr = el.closest('tr[data-k]'); if (!el.dataset.ag || !tr) return;
  const x = agroFilas().find(f => f.k === tr.dataset.k); if (!x) return;
  modCambio(() => {
    DB.agronomia = DB.agronomia || {filas:{}};
    const g = DB.agronomia.filas[x.k] = Object.assign({s:x.s, h:x.h, c:x.c, a:x.a, z:x.z}, DB.agronomia.filas[x.k]);
    g[el.dataset.ag] = el.value.trim();
  });
});
q('agronomia').addEventListener('click', e => {
  if (e.target.closest('[data-ag-limpiar]')) { af.est = af.hac = af.cult = ''; renderAgronomia(); return; }
  const tr = e.target.closest('[data-ag-borrar]') && e.target.closest('tr[data-k]');
  if (tr && confirm('¿Quitar esta suerte de la lista de agronomía?')) modCambio(() => { delete DB.agronomia.filas[tr.dataset.k]; });
});
q('agronomia').addEventListener('change', e => {
  const f = e.target.id === 'ag-maestro' && e.target.files[0]; if (!f) return;
  f.arrayBuffer().then(buf => cargarMaestro(buf, f.name)).catch(err => toast('⚠ ' + err.message));
});

// Maestro de suertes (hoja "MAESTRO"): por cada suerte de la tabla toma la fecha de siembra (col. S)
// y la del último corte (col. T) para el bloque Maestro. El corte también llena el bloque Real si
// está vacío; la siembra real queda para escribirla aquí (la del maestro no coincide).
function leerMaestro(XLSX, buf){
  const wb = XLSX.read(buf, {type:'array'});
  const hoja = wb.SheetNames.find(n => norm(n) === 'MAESTRO');
  if (!hoja) throw new Error('El archivo no tiene una hoja llamada «MAESTRO».');
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[hoja], {header:1, defval:'', raw:true});
  const hi = rows.findIndex(r => norm(r[0]) === 'SUERTE');
  const H = (rows[hi] || []).map(norm), col = (re, def) => { const i = H.findIndex(h => re.test(h)); return i >= 0 ? i : def; };
  const cS = col(/^FECHA DE SIEMBRA/, 18), cT = col(/^FECHA DE ULTIMO CO/, 19), cF = col(/^FINCA$/, 8);
  const cZ = col(/^ZONA$/, 5), cU = col(/^USO DE LA SUERTE/, 16), cV = col(/^VARIEDAD$/, 23), cA = col(/^AREA NETA/, 25);
  const iso = v => {
    if (typeof v === 'number' && v > 0) { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''; }
    const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(String(v).trim()); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };
  const M = new Map();
  rows.slice(hi + 1).forEach(r => {
    const s = String(r[0]).trim(); if (!/^\d{4}-\d{3}$/.test(s)) return;
    (M.get(s) || M.set(s, []).get(s)).push({finca:norm(r[cF]), siembra:iso(r[cS]), corte:iso(r[cT]),
      zona:parseInt(r[cZ], 10) || null, uso:String(r[cU] || '').trim().toUpperCase(), variedad:String(r[cV] || '').trim().toUpperCase(), area:num(r[cA]) || 0});
  });
  return M;
}
function cargarMaestro(buf, nombre){
  return cargarXLSX().then(XLSX => {
    const M = leerMaestro(XLSX, buf), A = agroFilas();
    guardarMaestroLocal(M, nombre);
    let ok = 0, varias = 0; const faltan = [];
    const cambios = A.map(x => {
      let L = M.get(x.s) || [];
      if (L.length > 1) { const h = L.filter(m => m.finca.includes(norm(x.h)) || norm(x.h).includes(m.finca)); if (h.length) L = h; varias++; }
      const m = L[0]; if (!m) { faltan.push(x.s); return null; }
      ok++; return {x, m};
    }).filter(Boolean);
    if (!confirm(`Maestro «${nombre}»: encontré ${ok} de ${A.length} suertes${faltan.length ? ` (no están: ${faltan.join(', ')})` : ''}${varias ? `; ${varias} aparecen más de una vez` : ''}.\n\n¿Llenar el bloque Maestro (fecha de corte y de siembra) y la fecha de corte Real donde esté vacía?`)) return;
    modCambio(() => {
      DB.agronomia = DB.agronomia || {filas:{}};
      DB.agronomia.maestro = nombre;
      cambios.forEach(({x, m}) => {
        const g = DB.agronomia.filas[x.k] = Object.assign({s:x.s, h:x.h, c:x.c, a:x.a, z:x.z}, DB.agronomia.filas[x.k]);
        g.mCorte = m.corte; g.mFecha = m.siembra;
        if (!g.corte) g.corte = m.corte;
      });
    });
    toast(`✓ Maestro cargado en ${ok} suertes · recuerda 🚀 Publicar`);
  });
}

// ── Protocolos de emergencia y Proyectos ejecutados ──
// Listas editables (solo editor) guardadas en DB.protocolos / DB.proyectos y publicadas en datos.js.
// Los protocolos arrancan con borradores sugeridos que el área debe validar (SST / brigada).
const idNuevo = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const PROTO_TIPOS = ['Inundación / diques', 'Lluvias y crecientes', 'Incendio', 'Derrame', 'Accidente', 'Falla de infraestructura', 'Otro'];
const PROTO_BASE = [
  {id:'pr1', tipo:'Inundación / diques', titulo:'Rotura o desbordamiento de dique', borrador:true,
    activa:'Filtración fuerte, grieta, desbordamiento o rotura de un dique; agua entrando a suertes, vías o viviendas.',
    pasos:'Avisar de inmediato al jefe del área y a la línea de emergencias interna, indicando dique, hacienda y punto exacto.\nRetirar a las personas y la maquinaria de la zona baja; nadie se queda sobre el dique afectado.\nCerrar compuertas y suspender el riego que alimente el sector.\nCoordinar maquinaria amarilla (retro, bulldozer) y material (tierra, sacos) para el cierre provisional, solo cuando sea seguro.\nMarcar y señalizar el punto; vigilar el nivel del río cada hora.\nTerminada la emergencia: levantamiento del daño, fotos, informe y reparación definitiva en el plan de diques.',
    responsable:'Ingeniería Agrícola', enlace:''},
  {id:'pr2', tipo:'Lluvias y crecientes', titulo:'Alerta por lluvias intensas o creciente de río', borrador:true,
    activa:'Pronóstico de lluvias fuertes, alerta de la autoridad ambiental o subida rápida del nivel del río.',
    pasos:'Revisar el estado de diques críticos, compuertas y alcantarillas antes del evento.\nDejar limpios canales, zanjas y descoles para que el agua salga.\nUbicar maquinaria y material de reserva cerca de los puntos críticos.\nSuspender labores en zonas bajas y retirar equipos.\nRonda de vigilancia de diques durante y después de la lluvia; reportar novedades.\nRegistrar lluvia caída, niveles y daños para el informe.',
    responsable:'Ingeniería Agrícola', enlace:''},
  {id:'pr3', tipo:'Incendio', titulo:'Incendio en caña, residuos o área de trabajo', borrador:true,
    activa:'Fuego o humo en una suerte, en residuos de cosecha, en maquinaria o en instalaciones.',
    pasos:'Dar la alarma a la brigada y a la línea de emergencias interna; si es necesario, a bomberos.\nAlejar a las personas; nadie se pone a favor del viento ni de frente al fuego.\nRetirar maquinaria y vehículos del área si se puede hacer sin riesgo.\nApoyar a la brigada con cisternas, motobombas o maquinaria para hacer cortafuegos, solo bajo su indicación.\nNo volver a entrar hasta que la brigada declare el área segura.\nReportar área afectada y causa probable.',
    responsable:'Brigada / SST', enlace:''},
  {id:'pr4', tipo:'Derrame', titulo:'Derrame de combustible o aceite', borrador:true,
    activa:'Fuga o derrame de ACPM, aceite o hidráulico de maquinaria o de tanques, sobre todo cerca de canales o drenajes.',
    pasos:'Apagar el equipo y eliminar fuentes de ignición; no fumar.\nDetener la fuga si es seguro (cerrar válvula, tapar, poner bandeja).\nContener con el kit antiderrames, tierra o barreras; impedir que llegue a canales o zanjas.\nAvisar al jefe del área y al responsable ambiental.\nRecoger el material contaminado y entregarlo como residuo peligroso.\nRegistrar cantidad, causa y acción tomada.',
    responsable:'Ingeniería Agrícola / Ambiental', enlace:''},
  {id:'pr5', tipo:'Accidente', titulo:'Accidente con maquinaria o persona lesionada', borrador:true,
    activa:'Persona herida, volcamiento, atrapamiento o choque de maquinaria o vehículo.',
    pasos:'Detener la operación y apagar los equipos cercanos.\nLlamar a la línea de emergencias interna y al brigadista más cercano.\nNo mover al lesionado salvo peligro inminente; atenderlo solo si está capacitado.\nSeñalizar el sitio y no modificar la escena.\nAvisar al jefe inmediato y a SST para el reporte del accidente.\nAcompañar la investigación y aplicar las acciones de mejora.',
    responsable:'SST', enlace:''},
];
const PROY_TIPOS = ['Drenaje', 'Diques', 'Vías', 'Canales y riego', 'Nivelación', 'Obras civiles', 'Infraestructura', 'Otro'];
function protocolos(){ return (DB.protocolos && DB.protocolos.items) || PROTO_BASE; }
function proyectos(){ return (DB.proyectos && DB.proyectos.items) || []; }
function listaEditable(clave){
  if (!DB[clave]) DB[clave] = {items: clave === 'protocolos' ? clone(PROTO_BASE) : []};
  return DB[clave].items;
}
const campoPf = (id, f, val, tipo = 'text', extra = '') => tipo === 'textarea'
  ? `<textarea data-pf="${f}" rows="${extra || 3}">${esc(val)}</textarea>`
  : tipo === 'select' ? `<select data-pf="${f}">${extra.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
  : `<input type="${tipo}" data-pf="${f}" value="${esc(val)}" ${tipo === 'number' ? 'step="any" min="0"' : ''}>`;
const enlaceSeguro = u => /^https?:\/\//i.test(u || '') ? u : '';

const pfil = {tipo:'', txt:''};
// Vista del protocolo: pasos con responsable, insumos, datos clave, directorio y mapas
function prDetalle(p){
  const lineas = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
  const pasos = lineas(p.pasos).map(s => { const [a, r] = s.split('|').map(x => x.trim()); return `<li>${esc(a)}${r ? `<span class="pr-resp">${esc(r)}</span>` : ''}</li>`; }).join('');
  const D = lineas(p.datos).map(s => s.split(/:(.+)/)).filter(a => a[1]);
  const dir = (p.directorio || []).filter(c => c.nombre || c.cargo);
  const F = (p.figuras || []).filter(f => /^img\/protocolos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(f.src));
  return `<div class="pr-det">
    <div class="pr-sec">✅ Qué hacer</div><ol class="pr-pasos">${pasos}</ol>
    ${lineas(p.insumos).length ? `<div class="pr-sec">🧰 Insumos y equipos</div><div class="pr-chips">${lineas(p.insumos).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
    ${D.length ? `<div class="pr-sec">📊 Datos clave</div><div class="py-cifras">${D.map(([l, v]) => `<div><small>${esc(l.trim())}</small><b>${esc(v.trim())}</b></div>`).join('')}</div>` : ''}
    ${dir.length ? `<div class="pr-sec">📞 Directorio de contactos</div><div class="pr-dir-v">${dir.map(c => `<div><b>${esc(c.nombre || '—')}</b><small>${esc(c.cargo || '')}</small>${c.tel ? `<a href="tel:${esc(String(c.tel).replace(/[^\d+]/g, ''))}">📞 ${esc(c.tel)}</a>` : ''}</div>`).join('')}</div>` : ''}
    ${F.length ? `<div class="pr-sec">🗺️ Mapas y apoyo</div><div class="py-fotos pr-mapas">${F.map(f => `<a href="${esc(f.src)}" target="_blank" rel="noopener"><img src="${esc(f.src)}" alt="${esc(f.pie || '')}" loading="lazy"><span>${esc(f.pie || '')}</span></a>`).join('')}</div>` : ''}
    <div class="pr-pie">Responsable: <b>${esc(p.responsable || '—')}</b>${p.fuente ? ` · Fuente: ${esc(p.fuente)}` : ''}${enlaceSeguro(p.enlace) ? ` · <a href="${esc(enlaceSeguro(p.enlace))}" target="_blank" rel="noopener">📄 Ver documento</a>` : ''}</div></div>`;
}
function renderProtocolos(){
  const L = protocolos(), ed = MODO_EDICION, t = norm(pfil.txt);
  const V = L.filter(p => (!pfil.tipo || p.tipo === pfil.tipo) && (!t || norm(`${p.titulo} ${p.activa} ${p.pasos}`).includes(t)));
  const tipos = [...new Set(L.map(p => p.tipo))];
  q('protocolos').innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">🚨 Protocolos de emergencia · Libros de reacción</div>
      <div class="sim-subt">Qué hacer, en orden, ante cada emergencia del área${ed ? ' · edita y luego 🚀 Publicar' : ''}</div></div>
      ${ed ? '<button type="button" class="mbtn mbtn-primary" data-pr-nuevo>+ Nuevo protocolo</button>' : ''}</div>
    ${ed ? '<div class="pr-aviso">🔒 La página es pública: no escribas teléfonos personales ni datos privados; usa cargos y la línea de emergencias interna. Los marcados como <b>borrador</b> son sugerencias para validar con SST.</div>' : ''}
    <div class="sim-bar pp-filtros">
      <label class="fchip"><span>Tipo</span><select id="pr-f-tipo" class="fsel ${pfil.tipo ? 'on' : ''}"><option value="">Todos</option>${tipos.map(x => `<option ${x === pfil.tipo ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <input id="pr-f-txt" class="pr-buscar" placeholder="Buscar en los protocolos…" value="${esc(pfil.txt)}">
    </div>
    <div class="pr-grid">${V.map(p => !ed ? prTarjeta(p) : `<details class="pr-card" data-id="${esc(p.id)}">
      <summary><span class="pr-tipo">${esc(p.tipo)}</span>${p.borrador ? '<span class="pr-borr">Borrador</span>' : ''}<b>${esc(p.titulo)}</b><small>${esc(p.activa)}</small></summary>
      ${ed ? `<div class="pr-form">
          <label>Título${campoPf(p.id, 'titulo', p.titulo)}</label>
          <label>Tipo${campoPf(p.id, 'tipo', p.tipo, 'select', PROTO_TIPOS)}</label>
          <label class="ancho">Cuándo se activa${campoPf(p.id, 'activa', p.activa, 'textarea', 2)}</label>
          <label class="ancho">Pasos (uno por línea, en orden; responsable al final con «|», ej. «Revisar diques | JEFE DE ZONA»)${campoPf(p.id, 'pasos', p.pasos, 'textarea', 8)}</label>
          <label class="ancho">Insumos y equipos (uno por línea)${campoPf(p.id, 'insumos', p.insumos, 'textarea', 3)}</label>
          <label class="ancho">Datos clave (una por línea: «Etiqueta: valor»)${campoPf(p.id, 'datos', p.datos, 'textarea', 3)}</label>
          <div class="ancho pr-dir-ed"><div class="pr-sec">📞 Directorio de contactos</div>
            <div class="pr-aviso" style="margin:4px 0 8px">🔒 Lo que escribas aquí lo verá cualquiera que tenga el link. Pon teléfonos solo si las personas están de acuerdo; si no, deja el cargo y la línea de la sala de radios.</div>
            <table class="pr-dir"><thead><tr><th>Nombre</th><th>Cargo</th><th>Teléfono</th><th></th></tr></thead><tbody>
            ${(p.directorio || []).map((c, i) => `<tr data-dir="${i}"><td><input data-dk="nombre" value="${esc(c.nombre)}"></td><td><input data-dk="cargo" value="${esc(c.cargo)}"></td><td><input data-dk="tel" value="${esc(c.tel)}" inputmode="tel" placeholder="—"></td><td><button type="button" class="x" data-dir-borrar title="Quitar">×</button></td></tr>`).join('')}
            </tbody></table><button type="button" class="link" data-dir-agregar>+ Agregar contacto</button></div>
          <label>Responsable${campoPf(p.id, 'responsable', p.responsable)}</label>
          <label>Enlace al documento (PDF, Drive…)${campoPf(p.id, 'enlace', p.enlace, 'url')}</label>
          <label class="pr-chk"><input type="checkbox" data-pf="borrador" ${p.borrador ? 'checked' : ''}> Borrador (sin validar)</label>
          <button type="button" class="mbtn mbtn-ghost" data-pr-ver="${esc(p.id)}">▶ Ver presentación</button>
          <button type="button" class="x pr-borrar" data-pr-borrar>🗑 Eliminar protocolo</button></div>`
      : prDetalle(p)}
    </details>`).join('') || '<div class="nores">Ningún protocolo con ese filtro.</div>'}</div>`;
}
q('protocolos').addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'pr-f-tipo') { pfil.tipo = el.value; renderProtocolos(); return; }
  if (el.dataset.dk) {   // directorio de contactos
    const id = el.closest('[data-id]').dataset.id, i = +el.closest('[data-dir]').dataset.dir;
    modCambio(() => { const p = listaEditable('protocolos').find(x => x.id === id); p.directorio[i][el.dataset.dk] = el.value.trim(); });
    const d = q('protocolos').querySelector(`[data-id="${CSS.escape(id)}"]`); if (d) d.open = true; return;
  }
  const id = el.dataset.pf && el.closest('[data-id]') && el.closest('[data-id]').dataset.id; if (!id) return;
  modCambio(() => { const p = listaEditable('protocolos').find(x => x.id === id); if (p) p[el.dataset.pf] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  const d = q('protocolos').querySelector(`[data-id="${CSS.escape(id)}"]`); if (d) d.open = true;
});
q('protocolos').addEventListener('input', e => { if (e.target.id === 'pr-f-txt') { pfil.txt = e.target.value; const pos = e.target.selectionStart; renderProtocolos(); const i = q('pr-f-txt'); i.focus(); i.setSelectionRange(pos, pos); } });
q('protocolos').addEventListener('click', e => {
  const ver = e.target.closest('[data-pr-ver]');
  if (ver) { const p = protocolos().find(x => x.id === ver.dataset.prVer); if (p) abrirPresentacion(p, prDiapositivas(p), '🚨 ' + p.titulo); return; }
  if (e.target.closest('[data-pr-nuevo]')) { const id = idNuevo('pr'); modCambio(() => { listaEditable('protocolos').unshift({id, tipo:'Otro', titulo:'Nuevo protocolo', activa:'', pasos:'', responsable:'', enlace:'', borrador:true}); }); const d = q('protocolos').querySelector(`[data-id="${id}"]`); if (d) d.open = true; return; }
  const da = e.target.closest('[data-dir-agregar]'), db = e.target.closest('[data-dir-borrar]');
  if (da || db) {
    const id = e.target.closest('[data-id]').dataset.id;
    modCambio(() => { const p = listaEditable('protocolos').find(x => x.id === id); p.directorio = p.directorio || [];
      if (da) p.directorio.push({nombre:'', cargo:'', tel:''}); else p.directorio.splice(+db.closest('[data-dir]').dataset.dir, 1); });
    const d = q('protocolos').querySelector(`[data-id="${CSS.escape(id)}"]`); if (d) d.open = true; return;
  }
  const b = e.target.closest('[data-pr-borrar]');
  if (b && confirm('¿Eliminar este protocolo?')) { const id = b.closest('[data-id]').dataset.id; modCambio(() => { DB.protocolos.items = listaEditable('protocolos').filter(x => x.id !== id); }); }
});

const yfil = {tipo:'', anio:'', hac:''};
// Cifras clave ("Etiqueta: valor" por línea) + presupuesto vs costo final
function pyCifras(p){
  const L = String(p.datos || '').split('\n').map(s => s.split(/:(.+)/)).filter(a => a[0].trim() && a[1]).map(([l, v]) => [l.trim(), v.trim()]);
  const ppto = +p.ppto || 0, cost = +p.inversion || 0;
  if (ppto && cost) L.push(['Presupuesto', money(ppto)], ['Costo final', money(cost)], ['Variación', `${cost - ppto >= 0 ? '+' : '−'}${money(Math.abs(cost - ppto))} (${((cost - ppto) / ppto * 100).toFixed(1)}%)`]);
  return L.length ? `<div class="py-cifras">${L.map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>` : '';
}
// Fotos del proyecto (archivos en img/proyectos/): miniaturas que abren la foto completa
function pyFotos(p){
  const F = (p.fotos || []).filter(f => /^img\/proyectos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(f.src));
  return F.length ? `<div class="py-fotos">${F.map(f => `<a href="${esc(f.src)}" target="_blank" rel="noopener" title="${esc(f.pie || '')}"><img src="${esc(f.src)}" alt="${esc(f.pie || p.nombre)}" loading="lazy"><span>${esc(f.pie || '')}</span></a>`).join('')}</div>` : '';
}
function renderProyectos(){
  const L = proyectos(), ed = MODO_EDICION;
  const V = L.filter(p => (!yfil.tipo || p.tipo === yfil.tipo) && (!yfil.anio || String(p.anio) === yfil.anio) && (!yfil.hac || p.hacienda === yfil.hac));
  const anios = [...new Set(L.map(p => String(p.anio || '')).filter(Boolean))].sort().reverse(), hacs = [...new Set(L.map(p => p.hacienda).filter(Boolean))].sort();
  const porTipo = PROY_TIPOS.map(t => [t, V.filter(p => p.tipo === t)]).filter(([, a]) => a.length);
  const sel = (id, val, ops) => `<select id="${id}" class="fsel ${val ? 'on' : ''}"><option value="">Todos</option>${ops.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  q('proyectos').innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">🏗️ Proyectos ejecutados</div>
      <div class="sim-subt">Obras y proyectos del área de Ingeniería Agrícola${ed ? ' · edita y luego 🚀 Publicar' : ''}</div></div>
      ${ed ? '<button type="button" class="mbtn mbtn-primary" data-py-nuevo>+ Nuevo proyecto</button>' : ''}</div>
    ${L.length ? `<div class="sim-bar pp-filtros">
      <label class="fchip"><span>Tipo</span>${sel('py-f-tipo', yfil.tipo, PROY_TIPOS.filter(t => L.some(p => p.tipo === t)))}</label>
      <label class="fchip"><span>Año</span>${sel('py-f-anio', yfil.anio, anios)}</label>
      <label class="fchip"><span>Hacienda</span>${sel('py-f-hac', yfil.hac, hacs)}</label></div>
    <div class="sim-kpis">
      <div class="sim-kpi"><div class="l">Proyectos</div><div class="v">${V.length}</div><div class="s">${V.filter(p => p.estado === 'En ejecución').length} en ejecución</div></div>
      <div class="sim-kpi"><div class="l">Inversión</div><div class="v">${moneyM(sum(V, p => +p.inversion || 0))}</div><div class="s">${porTipo.map(([t, a]) => `${t} ${moneyM(sum(a, p => +p.inversion || 0))}`).slice(0, 3).join(' · ')}</div></div>
    </div>` : ''}
    <div class="pr-grid">${V.map(p => !ed ? pyTarjeta(p) : `<details class="pr-card py-card" data-id="${esc(p.id)}">
      <summary><span class="pr-tipo py-tipo">${esc(p.tipo)}</span><span class="py-anio">${esc(p.anio || '')}${p.estado === 'En ejecución' ? ' · en ejecución' : ''}</span><b>${esc(p.nombre)}</b>
        <small>${esc(p.hacienda || '')}${p.cantidad ? ' · ' + esc(p.cantidad) : ''}${+p.inversion ? ` · <b>${moneyM(+p.inversion)}</b>` : ''}</small></summary>
      ${ed ? `<div class="pr-form">
          <label class="ancho">Nombre${campoPf(p.id, 'nombre', p.nombre)}</label>
          <label>Tipo${campoPf(p.id, 'tipo', p.tipo, 'select', PROY_TIPOS)}</label>
          <label>Estado${campoPf(p.id, 'estado', p.estado, 'select', ['Ejecutado', 'En ejecución'])}</label>
          <label>Hacienda / lugar${campoPf(p.id, 'hacienda', p.hacienda)}</label>
          <label>Año${campoPf(p.id, 'anio', p.anio, 'number')}</label>
          <label>Presupuesto ($)${campoPf(p.id, 'ppto', p.ppto, 'number')}</label>
          <label>Costo final / inversión ($)${campoPf(p.id, 'inversion', p.inversion, 'number')}</label>
          <label class="ancho">Cifras clave (una por línea: «Etiqueta: valor»)${campoPf(p.id, 'datos', p.datos, 'textarea', 5)}</label>
          <label>Cantidad (ej. 1.2 km, 15 ha)${campoPf(p.id, 'cantidad', p.cantidad)}</label>
          <label class="ancho">Descripción corta (portada)${campoPf(p.id, 'descripcion', p.descripcion, 'textarea', 2)}</label>
          <label class="ancho">El problema / diagnóstico${campoPf(p.id, 'diagnostico', p.diagnostico, 'textarea', 3)}</label>
          <label class="ancho">La solución${campoPf(p.id, 'solucion', p.solucion, 'textarea', 3)}</label>
          <label class="ancho">Distribución de costos (una por línea: «Concepto: valor»)${campoPf(p.id, 'costos', p.costos, 'textarea', 3)}</label>
          <label class="ancho">Resultado / beneficio${campoPf(p.id, 'resultado', p.resultado, 'textarea', 2)}</label>
          <label class="ancho">Enlace (fotos, informe)${campoPf(p.id, 'enlace', p.enlace, 'url')}</label>
          ${(p.fotos || []).length ? `<div class="ancho">${pyFotos(p)}</div>` : ''}
          <button type="button" class="mbtn mbtn-ghost" data-py-ver="${esc(p.id)}">▶ Ver presentación</button>
          <button type="button" class="x pr-borrar" data-py-borrar>🗑 Eliminar proyecto</button></div>`
      : `<div class="py-det">${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : ''}
          ${pyCifras(p)}
          ${p.resultado ? `<p><b>Resultado:</b> ${esc(p.resultado)}</p>` : ''}
          ${pyFotos(p)}
          ${enlaceSeguro(p.enlace) ? `<a href="${esc(enlaceSeguro(p.enlace))}" target="_blank" rel="noopener">📷 Ver fotos / informe</a>` : ''}</div>`}
    </details>`).join('') || `<div class="nores">${L.length ? 'Ningún proyecto con esos filtros.' : ed ? 'Pulsa «+ Nuevo proyecto» para registrar el primero.' : 'Aún no hay proyectos registrados.'}</div>`}</div>`;
}
q('proyectos').addEventListener('change', e => {
  const el = e.target, f = {'py-f-tipo':'tipo', 'py-f-anio':'anio', 'py-f-hac':'hac'}[el.id];
  if (f) { yfil[f] = el.value; renderProyectos(); return; }
  const id = el.dataset.pf && el.closest('[data-id]') && el.closest('[data-id]').dataset.id; if (!id) return;
  modCambio(() => { const p = listaEditable('proyectos').find(x => x.id === id); if (p) p[el.dataset.pf] = el.type === 'number' ? (num(el.value) || 0) : el.value.trim(); });
  const d = q('proyectos').querySelector(`[data-id="${CSS.escape(id)}"]`); if (d) d.open = true;
});
q('proyectos').addEventListener('click', e => {
  const ver = e.target.closest('[data-py-ver]');
  if (ver) { const p = proyectos().find(x => x.id === ver.dataset.pyVer); if (p) abrirPresentacion(p); return; }
  if (e.target.closest('[data-py-nuevo]')) { const id = idNuevo('py'); yfil.tipo = yfil.anio = yfil.hac = ''; modCambio(() => { listaEditable('proyectos').unshift({id, nombre:'Nuevo proyecto', tipo:'Obras civiles', estado:'Ejecutado', hacienda:'', anio:new Date().getFullYear(), inversion:0, cantidad:'', descripcion:'', resultado:'', enlace:''}); }); const d = q('proyectos').querySelector(`[data-id="${id}"]`); if (d) d.open = true; return; }
  const b = e.target.closest('[data-py-borrar]');
  if (b && confirm('¿Eliminar este proyecto?')) { const id = b.closest('[data-id]').dataset.id; modCambio(() => { DB.proyectos.items = listaEditable('proyectos').filter(x => x.id !== id); }); }
});

// ── Presentación de un proyecto (pantalla completa, diapositivas) ──
const pyLineas = t => String(t || '').split('\n').map(s => s.split(/:(.+)/)).filter(a => a[0].trim() && a[1]).map(([l, v]) => [l.trim(), v.trim()]);
const pyNum = v => +String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.') || 0;
const pyFotosOk = p => (p.fotos || []).filter(f => /^img\/proyectos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(f.src));
const pyEsMapa = f => /mapa|diseño|diagn|isobata|plano/i.test(f.pie || '');
function pyPortada(p){
  const F = pyFotosOk(p);
  return F[+p.portada] || F.filter(f => !pyEsMapa(f)).pop() || F[0] || null;
}
function pyTarjeta(p){
  const f = pyPortada(p), C = pyLineas(p.datos).slice(0, 3);
  return `<button type="button" class="py-tarj" data-py-ver="${esc(p.id)}">
    <div class="py-tarj-img" ${f ? `style="background-image:url('${esc(f.src)}')"` : ''}><span class="pr-tipo py-tipo">${esc(p.tipo)}</span><span class="py-play">▶ Ver presentación</span></div>
    <div class="py-tarj-c"><span class="py-anio">${esc(p.anio || '')} · ${esc(p.hacienda || '')}${p.estado === 'En ejecución' ? ' · en ejecución' : ''}</span>
      <b>${esc(p.nombre)}</b>
      <div class="py-tarj-k">${C.map(([l, v]) => `<span><small>${esc(l)}</small>${esc(v)}</span>`).join('')}${+p.inversion ? `<span><small>Inversión</small>${moneyM(+p.inversion)}</span>` : ''}</div></div>
  </button>`;
}
function pyDiapositivas(p){
  const F = pyFotosOk(p), mapas = F.filter(pyEsMapa), obra = F.filter(f => !pyEsMapa(f)), D = pyLineas(p.datos), C = pyLineas(p.costos);
  const port = pyPortada(p), ppto = +p.ppto || 0, cost = +p.inversion || 0, S = [];
  const img = (f, cls = '') => f ? `<figure class="pz-fig ${cls}"><img src="${esc(f.src)}" alt="${esc(f.pie || '')}"><figcaption>${esc(f.pie || '')}</figcaption></figure>` : '';
  // 1. Portada
  S.push({cls:'pz-portada', bg:port && port.src, html:`<div class="pz-port-c">
    <span class="pz-chip">${esc(p.tipo)} · ${esc(p.estado || 'Ejecutado')} · ${esc(p.anio || '')}</span>
    <h1>${esc(p.nombre)}</h1><p class="pz-lugar">📍 ${esc(p.hacienda || '')}${p.cantidad ? ' · ' + esc(p.cantidad) : ''}</p>
    ${p.descripcion && !p.diagnostico ? '' : p.descripcion ? `<p class="pz-lead">${esc(p.descripcion)}</p>` : ''}
    <div class="pz-port-k">${D.slice(0, 2).map(([l, v]) => `<div><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}${cost ? `<div><b>${moneyM(cost)}</b><small>Inversión</small></div>` : ''}</div>
    <p class="pz-firma">Ingeniería Agrícola · Riopaila Agrícola</p></div>`});
  // 2. Problema
  const diag = p.diagnostico || (!p.solucion && p.descripcion);
  if (diag) S.push({titulo:'El problema', ico:'💧', html:`<div class="pz-dos"><div class="pz-txt"><p>${esc(diag)}</p></div>${img(mapas[0] || obra[0])}</div>`});
  // 3. Solución
  if (p.solucion) S.push({titulo:'La solución', ico:'🛠️', html:`<div class="pz-dos">${img(mapas[1] || mapas[0])}<div class="pz-txt"><p>${esc(p.solucion)}</p>
    ${D.filter(([l]) => /profund|pendiente|diametro|diámetro|ancho/i.test(l)).map(([l, v]) => `<div class="pz-mini"><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div></div>`});
  // 4. Proceso de obra (fotos en orden)
  if (obra.length) S.push({titulo:'Así se hizo', ico:'🚜', html:`<div class="pz-pasos">${obra.map((f, i) => `<figure class="pz-paso" style="--i:${i}"><img src="${esc(f.src)}" alt="${esc(f.pie || '')}"><figcaption><b>${i + 1}</b>${esc(f.pie || '')}</figcaption></figure>`).join('')}</div>`});
  // 5. Cifras
  // (sin costos ni las medidas que ya salen en "La solución"); número grande y unidad aparte
  const cif = D.filter(([l]) => !/^(materiales|retro|volqueta|mano de obra)/i.test(l) && !(p.solucion && /profund|pendiente|diametro|diámetro|ancho/i.test(l)));
  const numUni = v => { const m = /^([$]?[\d.,]+)\s*(.*)$/.exec(v); return m ? `${esc(m[1])}<em>${esc(m[2])}</em>` : esc(v); };
  if (cif.length) S.push({titulo:'En cifras', ico:'📊', html:`<div class="pz-cifras">${cif.map(([l, v], i) => `<div style="--i:${i}"><b>${numUni(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>`});
  // 6. Inversión
  if (ppto || cost || C.length) {
    const mx = Math.max(ppto, cost, 1), tot = sum(C, ([, v]) => pyNum(v)) || 1, dif = cost - ppto;
    const col = ['#0f766e', '#0077aa', '#b45309', '#6d28d9', '#c0392b'];
    S.push({titulo:'Inversión', ico:'💰', html:`<div class="pz-dos pz-inv">
      ${ppto && cost ? `<div class="pz-barras">
        <div class="pz-barra"><small>Presupuesto</small><div><i style="--w:${ppto / mx * 100}%;background:#94a3b8"></i></div><b>${money(ppto)}</b></div>
        <div class="pz-barra"><small>Ejecutado</small><div><i style="--w:${cost / mx * 100}%;background:#0f766e"></i></div><b>${money(cost)}</b></div>
        <div class="pz-var ${Math.abs(dif / ppto) <= .05 ? 'ok' : 'mal'}">${dif >= 0 ? '+' : '−'}${money(Math.abs(dif))} · ${(dif / ppto * 100).toFixed(1)}%<small>${Math.abs(dif / ppto) <= .05 ? (dif > 0 ? 'Prácticamente igual a lo presupuestado' : 'Por debajo de lo presupuestado') : dif > 0 ? 'Por encima de lo presupuestado' : 'Por debajo de lo presupuestado'}</small></div></div>`
      : ppto ? `<div class="pz-barras"><div class="pz-var ok">${moneyM(ppto)}<small>Presupuesto aprobado</small></div>
        ${C.length ? `<div class="pz-barra" style="margin-top:18px"><small>Registrado / cotizado</small><div><i style="--w:${Math.min(100, tot / ppto * 100)}%;background:#0f766e"></i></div><b>${money(tot)} · ${Math.round(tot / ppto * 100)}%</b></div>` : ''}</div>` : ''}
      ${C.length ? `<div class="pz-dist"><small class="pz-sub">¿En qué se invirtió?</small>${C.map(([l, v], i) => { const n = pyNum(v); return `<div class="pz-dist-f"><span><i style="background:${col[i % col.length]}"></i>${esc(l)}</span><b>${money(n)} · ${Math.round(n / tot * 100)}%</b><div><i style="--w:${n / tot * 100}%;background:${col[i % col.length]}"></i></div></div>`; }).join('')}</div>` : ''}
    </div>`});
  }
  // 7. Resultado
  if (p.resultado) S.push({cls:'pz-final', bg:port && port.src, html:`<div class="pz-port-c"><span class="pz-chip">Resultado</span><h2>${esc(p.resultado)}</h2>
    ${enlaceSeguro(p.enlace) ? `<a class="pz-link" href="${esc(enlaceSeguro(p.enlace))}" target="_blank" rel="noopener">📄 Ver informe completo</a>` : ''}
    <p class="pz-firma">Elaborado por: Luis Acosta · Esp. de Ingeniería Agrícola</p></div>`});
  return S;
}
// Diapositivas de un protocolo de emergencia: portada, pasos, insumos, datos, directorio y un mapa por lámina
function prDiapositivas(p){
  const lineas = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean), S = [];
  const pasos = lineas(p.pasos).map(s => s.split('|').map(x => x.trim()));
  const D = lineas(p.datos).map(s => s.split(/:(.+)/)).filter(a => a[1]).map(([l, v]) => [l.trim(), v.trim()]);
  const F = (p.figuras || []).filter(f => /^img\/protocolos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(f.src));
  const dir = (p.directorio || []).filter(c => c.nombre || c.cargo);
  const fondo = (/^img\/protocolos\/[\w.-]+\.(jpe?g|png|webp)$/i.test(p.fondo || '') && {src:p.fondo}) || F.find(f => /foto|obra/i.test(f.pie || '')) || null;
  S.push({cls:'pz-portada pz-alerta', bg:fondo && fondo.src, html:`<div class="pz-port-c">
    <span class="pz-chip pz-chip-r">🚨 ${esc(p.tipo)}${p.borrador ? ' · borrador' : ''}</span>
    <h1>${esc(p.titulo)}</h1>
    ${p.activa ? `<div class="pz-activa"><small>Se activa cuando</small>${esc(p.activa)}</div>` : ''}
    <div class="pz-port-k">${pasos.length ? `<div><b>${pasos.length}</b><small>acciones</small></div>` : ''}${dir.length ? `<div><b>${dir.length}</b><small>contactos</small></div>` : ''}${F.length ? `<div><b>${F.length}</b><small>mapas</small></div>` : ''}</div>
    <p class="pz-firma">${p.fuente ? esc(p.fuente) + ' · ' : ''}Ingeniería Agrícola · Riopaila Agrícola</p></div>`});
  if (pasos.length) S.push({titulo:'Qué hacer, en orden', ico:'✅', html:`<div class="pz-acc ${pasos.length > 6 ? 'dos' : ''}">${pasos.map(([a, r], i) =>
    `<div class="pz-acc-i" style="--i:${i}"><b>${i + 1}</b><div>${esc(a)}${r ? `<span>${esc(r)}</span>` : ''}</div></div>`).join('')}</div>`});
  if (lineas(p.insumos).length || D.length) S.push({titulo:lineas(p.insumos).length ? 'Insumos y datos clave' : 'Datos clave', ico:'🧰', html:`
    ${lineas(p.insumos).length ? `<small class="pz-sub">Tener listo</small><div class="pz-insumos">${lineas(p.insumos).map((s, i) => `<span style="--i:${i}">${esc(s)}</span>`).join('')}</div>` : ''}
    ${D.length ? `<div class="pz-cifras" style="margin-top:22px">${D.map(([l, v], i) => `<div style="--i:${i}"><b style="font-size:clamp(20px,2.4vw,30px)">${esc(v)}</b><small>${esc(l)}</small></div>`).join('')}</div>` : ''}`});
  if (dir.length) S.push({titulo:'Directorio de contactos', ico:'📞', html:`<div class="pz-dir">${dir.map((c, i) => `<div style="--i:${i}"><b>${esc(c.nombre || '—')}</b><small>${esc(c.cargo || '')}</small>${c.tel ? `<a href="tel:${esc(String(c.tel).replace(/[^\d+]/g, ''))}">📞 ${esc(c.tel)}</a>` : ''}</div>`).join('')}</div>`});
  F.forEach(f => S.push({titulo:f.pie || 'Mapa', ico:'🗺️', html:`<figure class="pz-mapa"><img src="${esc(f.src)}" alt="${esc(f.pie || '')}"></figure>`}));
  S.push({cls:'pz-final pz-alerta', bg:fondo && fondo.src, html:`<div class="pz-port-c"><span class="pz-chip pz-chip-r">Responsable</span>
    <h2>${esc(p.responsable || 'Ingeniería Agrícola')}</h2>
    ${enlaceSeguro(p.enlace) ? `<a class="pz-link" href="${esc(enlaceSeguro(p.enlace))}" target="_blank" rel="noopener">📄 Ver documento completo</a>` : ''}
    <p class="pz-firma">Ante cualquier novedad, avisar de inmediato al jefe del área y a la sala de radios.</p></div>`});
  return S;
}
function prTarjeta(p){
  const n = String(p.pasos || '').split('\n').filter(s => s.trim()).length, f = (p.figuras || [])[0];
  return `<button type="button" class="pr-tarj" data-pr-ver="${esc(p.id)}">
    <span class="pr-tipo">${esc(p.tipo)}</span>${p.borrador ? '<span class="pr-borr">Borrador</span>' : ''}
    <b>${esc(p.titulo)}</b><small>${esc(p.activa)}</small>
    <span class="pr-tarj-pie">${n} acciones${(p.directorio || []).length ? ` · ${p.directorio.length} contactos` : ''}${(p.figuras || []).length ? ` · ${p.figuras.length} mapas` : ''}<span class="pr-play">▶ Ver presentación</span></span>
  </button>`;
}
function abrirPresentacion(p, S = pyDiapositivas(p), cab = '🏗️ ' + p.nombre){
  let i = 0;
  const o = document.createElement('div'); o.className = 'pz'; o.tabIndex = -1;
  o.innerHTML = `<div class="pz-top"><span>${esc(cab)}</span><button type="button" class="pz-x" title="Cerrar (Esc)">✕</button></div>
    <div class="pz-pista">${S.map((s, k) => `<section class="pz-dia ${s.cls || ''}" ${s.bg ? `style="--bg:url('${esc(new URL(s.bg, document.baseURI).href)}')"` : ''} aria-hidden="${k ? 'true' : 'false'}">
      ${s.titulo ? `<h2 class="pz-h"><span>${s.ico || ''}</span>${esc(s.titulo)}<small>${k + 1} / ${S.length}</small></h2>` : ''}<div class="pz-cuerpo">${s.html}</div></section>`).join('')}</div>
    <button type="button" class="pz-nav pz-ant" title="Anterior (←)">‹</button><button type="button" class="pz-nav pz-sig" title="Siguiente (→)">›</button>
    <div class="pz-puntos">${S.map((s, k) => `<button type="button" data-k="${k}" title="${esc(s.titulo || (k ? 'Resultado' : 'Portada'))}"></button>`).join('')}</div>`;
  document.body.appendChild(o); document.body.classList.add('pz-abierta');
  const dias = o.querySelectorAll('.pz-dia'), puntos = o.querySelectorAll('.pz-puntos button');
  const ir = k => {
    i = Math.max(0, Math.min(S.length - 1, k));
    dias.forEach((d, n) => { d.classList.toggle('on', n === i); d.classList.toggle('antes', n < i); d.setAttribute('aria-hidden', n !== i); });
    puntos.forEach((b, n) => b.classList.toggle('on', n === i));
    o.querySelector('.pz-ant').disabled = i === 0; o.querySelector('.pz-sig').disabled = i === S.length - 1;
  };
  const cerrar = () => { o.remove(); document.body.classList.remove('pz-abierta'); document.removeEventListener('keydown', tecla); };
  const tecla = e => { if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); ir(i + 1); } else if (e.key === 'ArrowLeft') ir(i - 1); };
  document.addEventListener('keydown', tecla);
  o.addEventListener('click', e => {
    if (e.target.closest('.pz-x')) cerrar();
    else if (e.target.closest('.pz-ant')) ir(i - 1);
    else if (e.target.closest('.pz-sig')) ir(i + 1);
    else if (e.target.closest('.pz-puntos button')) ir(+e.target.dataset.k);
    else if (e.target.closest('.pz-fig img, .pz-paso img, .pz-mapa img')) window.open(e.target.src, '_blank', 'noopener');
  });
  // Deslizar con el dedo en el celular
  let x0 = null;
  o.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, {passive:true});
  o.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(i + (dx < 0 ? 1 : -1)); x0 = null; });
  ir(0); setTimeout(() => o.focus(), 30);
}

// Arranque: abre el módulo que indique la dirección (sin dirección = portada)
irA(vistaDeHash(location.hash), {historial:false});

// ── Buscador del portal (encabezado): módulos, personas, procesos, haciendas y suertes ──
// Corre después del buscador original del dashboard y reemplaza sus resultados.
const TEMAS = [
  {ir:'aps', t:'Dashboard Comité APS', d:'Avance de renovación y siembra, labores, ruta, presupuesto', k:'dashboard comite aps avance siembra renovacion labores ruta indicadores zona hacienda'},
  {ir:'simulador', t:'Simulador de costos', d:'Costos por suerte, tarifas y contratistas', k:'simulador costos tarifas contratistas pases presupuesto labor'},
  {ir:'estructura', t:'Estructura del área', d:'Organigrama, cargos y procesos', k:'estructura organigrama cargos personas equipo procesos responsables'},
  {ir:'ppto', t:'Presupuesto APS 2027', d:'Programa de renovación 2027 por mes, zona y hacienda', k:'presupuesto 2027 programa renovacion meses zona hacienda nivelacion'},
  {ir:'proto', t:'Protocolos de emergencia', d:'Libros de reacción ante emergencias', k:'protocolos emergencia libro reaccion inundacion dique incendio derrame accidente evacuacion'},
  {ir:'proy', t:'Proyectos ejecutados', d:'Obras y proyectos realizados, inversión y resultados', k:'proyectos ejecutados obras drenaje dique vias canal nivelacion inversion'},
  {ir:'agro', t:'Gestión Agronomía', d:'Suertes surcadas: fecha de siembra, variedad y observaciones', k:'gestion agronomia surcadas siembra fecha variedad observacion sector'},
];
busInput.addEventListener('input', () => {
  const s = busInput.value.trim(), n = norm(s);
  if (!n) { busResults.classList.remove('show'); return; }
  const R = [], add = (tipo, titulo, sub, ir, extra = '') => R.push({tipo, titulo, sub, ir, extra});
  TEMAS.forEach(m => { if (norm(m.t + ' ' + m.k).includes(n)) add('Módulo', m.t, m.d, m.ir); });
  const E = estructura();
  E.personas.forEach(p => { if (norm(`${p.nombre} ${p.cargo} ${p.equipo}`).includes(n)) add('Persona', p.nombre || 'Por asignar', p.cargo, 'estructura'); });
  (E.procesos || []).forEach(p => { if (norm(`${p.especifico} ${p.general}`).includes(n)) add('Proceso', p.especifico, p.general, 'estructura'); });
  const hacs = new Set();
  DB.lotes.forEach(l => { if (norm(l.h).includes(n)) hacs.add(l.h); });
  (ppto2027().suertes || []).forEach(x => { if (norm(x.h).includes(n)) hacs.add(x.h); });
  hacs.forEach(h => add('Hacienda', h, 'Ver en el dashboard APS', 'aps', `data-hac="${esc(h)}"`));
  DB.lotes.forEach(l => { if (norm(l.s).includes(n)) add('Suerte APS', `${l.s} · ${l.h}`, `${f2(l.a)} ha · ${l.c} · ${l.e}`, 'aps', `data-sue="${esc(l.s)}" data-hac="${esc(l.h)}"`); });
  (ppto2027().suertes || []).forEach(x => { if (norm(x.s).includes(n)) add('Suerte 2027', `${x.s} · ${x.h}`, `${f2(x.a)} ha · renovación ${MESES[x.mes - 1] || '—'}`, 'ppto', `data-hac27="${esc(x.h)}"`); });
  const vis = R.slice(0, 14);
  busResults.innerHTML = vis.length
    ? `<div class="sr-header">${R.length} resultado${R.length !== 1 ? 's' : ''}${R.length > vis.length ? ' · primeros ' + vis.length : ''}</div>` +
      vis.map(r => `<div class="sr-tema" data-ir="${r.ir}" ${r.extra}><span class="chip cc" style="font-size:8px">${r.tipo}</span><div><b>${hl(r.titulo, s)}</b><small>${esc(r.sub || '')}</small></div></div>`).join('')
    : `<div class="sr-empty">Sin resultados para "<b>${esc(s)}</b>"</div>`;
  busResults.classList.add('show');
});
busResults.addEventListener('click', e => {
  const it = e.target.closest('.sr-tema'); if (!it) return;
  const {ir, sue, hac, hac27} = it.dataset;
  busResults.classList.remove('show'); busInput.value = '';
  if (ir === 'ppto' && hac27) { pf.hac = hac27; pf.zona = ''; pf.mes = 0; }
  irA(ir);
  if (ir === 'aps' && hac) {
    F.hac = hac; q('sel-hac').value = hac; q('sel-hac').className = 'fsel on'; estadoTabla = 'all'; render();
    const row = sue && [...q('lotes-tbody').querySelectorAll('tr')].find(r => r.dataset.sue === sue);
    if (row) { row.scrollIntoView({behavior:'smooth', block:'center'}); row.style.background = '#fff3cd'; setTimeout(() => row.style.background = '', 1800); }
    toast(sue ? `Suerte ${sue} · ${hac}` : `Hacienda ${hac}`);
  }
});
