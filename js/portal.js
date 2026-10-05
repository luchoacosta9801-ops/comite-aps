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
  const E = estructura(), P = ppto2027(), haP = haTotal2027(P);
  const card = (vista, icono, titulo, desc, dato, color) => `
    <button type="button" class="pt-card" data-ir="${vista}" style="--c:${color}">
      <span class="pt-ico">${icono}</span>
      <span class="pt-tit">${titulo}</span>
      <span class="pt-desc">${desc}</span>
      <span class="pt-dato">${dato}</span>
      <span class="pt-ir">Abrir →</span>
    </button>`;
  q('portal').innerHTML = `
    <div class="pt-banner">
      <img src="${DB.portada && DB.portada.imagen ? DB.portada.imagen : 'img/portada.svg'}" alt="Ingeniería Agrícola · Riopaila Agrícola">
      ${MODO_EDICION ? `<div class="pt-banner-acc">
        <label class="pt-cambiar">📷 Cambiar imagen<input type="file" id="pt-foto" accept="image/*" hidden></label>
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
    </div>
    <div class="pt-pie">Comité APS · Riopaila Agrícola · Elaborado por: <b>Luis Acosta</b> · Esp. de Ingeniería Agrícola</div>`;
}
q('portal').addEventListener('click', e => {
  const b = e.target.closest('[data-ir]'); if (b) { irA(b.dataset.ir); return; }
  if (e.target.closest('#pt-quitar')) { modCambio(() => { delete DB.portada; }); toast('Imagen original restaurada'); }
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

// Arranque: abre el módulo que indique la dirección (sin dirección = portada)
irA(vistaDeHash(location.hash), {historial:false});
