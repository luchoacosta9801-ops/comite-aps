// Acceso con usuario y contraseña (puerta de entrada). Los usuarios se publican en datos.js con la contraseña
// cifrada (SHA-256 con sal propia por usuario); nunca se guarda la contraseña. Perfiles: 'ver' y 'editor'
// (editor activa el modo editor en ese navegador, como el enlace ?editor=). Es una puerta, no una bóveda: los datos
// siguen en el repositorio público de GitHub. En este PC (localhost) y con el editor activado no se pide clave.
// DB.usuarios = {lista:[{u, nombre, rol, sal, h, creado}]}
// SESION_KEY está en store.js
const SESION_DIAS = 30;

async function accHash(sal, u, clave){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}|${String(u).trim().toLowerCase()}|${clave}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const accSal = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, '0')).join('');
// Usuarios publicados (los que valen para entrar) y los de este navegador (los que se están editando)
const accPublicados = () => (typeof SEED !== 'undefined' && SEED.usuarios && SEED.usuarios.lista) || [];
const accLista = () => (DB.usuarios && DB.usuarios.lista) || [];
function accSesion(){
  try { const s = JSON.parse(localStorage.getItem(SESION_KEY) || 'null'); if (!s || s.exp < Date.now()) return null;
    const u = accPublicados().find(x => x.u === s.u && x.h === s.h); return u ? {...u} : null; } catch (e) { return null; }
}
// ¿Hay que pedir clave? Solo si ya hay usuarios publicados, no es este PC y no hay editor activado
const accPuertaActiva = () => accPublicados().length > 0 && !ES_LOCAL && !editorActivado();

function accPantalla(){
  const d = document.createElement('div');
  d.className = 'acc-puerta'; d.id = 'acc-puerta';
  d.innerHTML = `<form class="acc-caja" id="acc-form" autocomplete="on">
    <img src="img/logo-riopaila.png" alt="Riopaila Agrícola" class="acc-logo">
    <h1>Ingeniería Agrícola</h1><p>Riopaila Agrícola S.A.</p>
    <label>Usuario<input id="acc-u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
    <label>Contraseña<span class="acc-clave"><input id="acc-c" name="password" type="password" autocomplete="current-password" required><button type="button" id="acc-ver" title="Mostrar u ocultar">👁</button></span></label>
    <div class="acc-err" id="acc-err" hidden></div>
    <button type="submit" class="acc-entrar">Entrar</button>
    <small>¿No tienes usuario? Pídeselo al administrador del área de Ingeniería Agrícola.</small>
  </form>`;
  document.body.appendChild(d);
  document.documentElement.classList.add('acc-bloqueado');
  const f = d.querySelector('#acc-form'), err = d.querySelector('#acc-err');
  d.querySelector('#acc-ver').onclick = () => { const c = q('acc-c'); c.type = c.type === 'password' ? 'text' : 'password'; };
  f.onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const u = q('acc-u').value.trim().toLowerCase(), c = q('acc-c').value;
    const x = accPublicados().find(y => y.u === u);
    if (!x || await accHash(x.sal, u, c) !== x.h) { err.textContent = 'Usuario o contraseña incorrectos'; err.hidden = false; q('acc-c').select(); return; }
    try { localStorage.setItem(SESION_KEY, JSON.stringify({u, h:x.h, exp:Date.now() + SESION_DIAS * 864e5})); if (x.rol === 'editor') localStorage.setItem(EDITOR_KEY, EDITOR_HASH); } catch (e2) {}
    location.reload();
  };
  setTimeout(() => q('acc-u').focus(), 50);
}
function accSalir(){ try { localStorage.removeItem(SESION_KEY); localStorage.removeItem(EDITOR_KEY); } catch (e) {} location.reload(); }


// Paneles que se pueden dar a un "editor por panel" y los datos (módulos de DB) que toca cada uno
const ACC_PANELES = [
  {v:'agro', t:'🌱 Gestión Agronomía', m:['agronomia']},
  {v:'maes', t:'📚 Maestro de suertes', m:['maestroSuertes']},
  {v:'freat', t:'💧 Niveles freáticos', m:['freatico', 'lluvias']},
  {v:'nfcos', t:'🌾 Cosecha vs niveles', m:['cosechaNF']},
  {v:'ppto', t:'📅 Presupuesto 2027', m:['ppto2027']},
  {v:'proy', t:'🏗️ Proyectos', m:['proyectos']},
  {v:'proto', t:'🚨 Protocolos', m:['protocolos']},
  {v:'estructura', t:'👥 Estructura', m:['estructura']},
  {v:'simulador', t:'💰 Simulador', m:['sim']},
];
const ROLES = {ver:'👁 Ver', panel:'🧩 Editor por panel', editor:'✏️ Editor (todo)'};
const accRolOpts = r => Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${r === k ? 'selected' : ''}>${t}</option>`).join('');
// Módulos que puede cambiar un usuario: los de sus paneles (o todos si es editor)
const accModulos = x => x.rol === 'editor' ? MODULOS_LOCALES.filter(k => k !== 'usuarios') : ACC_PANELES.filter(p => (x.paneles || []).includes(p.v)).flatMap(p => p.m);

// ── Enviar cambios (usuarios que editan desde otro equipo): solo este PC publica, así que los cambios se
// mandan en un archivo al administrador, que los recibe en 🔐 Usuarios y accesos y publica ──
function accPendientes(x){ return accModulos(x).filter(k => JSON.stringify(DB[k] === undefined ? null : DB[k]) !== JSON.stringify(SEED[k] === undefined ? null : SEED[k])); }
async function accEnviar(x){
  const ks = accPendientes(x); if (!ks.length) { toast('No tienes cambios por enviar'); return; }
  const hoy = new Date(), modulos = {}; ks.forEach(k => { modulos[k] = DB[k] === undefined ? null : DB[k]; });
  const nombre = `cambios-${x.u}-${hoy.toISOString().slice(0, 10)}.json`;
  const txt = JSON.stringify({tipo:'comite-aps-cambios', u:x.u, nombre:x.nombre, fecha:hoy.toISOString(), base:SEED.meta.corte, modulos});
  const f = new File([txt], nombre, {type:'application/json'});
  try { if (navigator.canShare && navigator.canShare({files:[f]})) { await navigator.share({files:[f], title:'Cambios Ingeniería Agrícola', text:`Cambios de ${x.nombre}`}); return; } } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('📤 Se descargó el archivo de cambios: envíaselo al administrador');
}

// Al cargar: si hace falta, se tapa todo con la pantalla de entrada; si hay sesión, botones de salir y enviar cambios
(function accIniciar(){
  if (!window.crypto || !crypto.subtle) return;
  const s = accSesion();
  if (accPuertaActiva() && !s) { accPantalla(); return; }
  const ref = q('btn-inicio');
  if (s || (accPublicados().length && editorActivado() && !ES_LOCAL)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fbtn-inicio acc-salir'; b.title = 'Cerrar sesión en este navegador';
    b.textContent = `🔒 ${s ? (s.nombre || s.u).split(' ')[0] : 'Salir'}`; b.onclick = () => { if (confirm('¿Cerrar la sesión en este navegador?')) accSalir(); };
    if (ref) ref.insertAdjacentElement('afterend', b);
  }
  if (s && !ES_LOCAL && (s.rol === 'panel' || s.rol === 'editor')) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fbtn-inicio acc-enviar'; b.id = 'acc-enviar'; b.hidden = true;
    b.textContent = '📤 Enviar cambios'; b.title = 'Manda tus cambios al administrador para que los publique';
    b.onclick = () => accEnviar(s);
    if (ref) ref.insertAdjacentElement('afterend', b);
    const base = renderEstadoEdicion;
    renderEstadoEdicion = function(){ base(); const n = accPendientes(s).length; b.hidden = !n; b.textContent = `📤 Enviar cambios${n ? ' ●' : ''}`; };
    renderEstadoEdicion();
  }
})();

// Administrador: recibe el archivo de cambios de un usuario y lo aplica (solo en los paneles que tiene)
async function accRecibir(file){
  let d; try { d = JSON.parse(await file.text()); } catch (e) { toast('⚠ El archivo no se pudo leer'); return; }
  if (!d || d.tipo !== 'comite-aps-cambios' || !d.modulos) { toast('⚠ Ese archivo no es de cambios de la página'); return; }
  const x = accLista().find(y => y.u === d.u);
  if (!x || x.rol === 'ver') { toast(`⚠ El usuario ${d.u || '?'} no existe o no puede editar`); return; }
  const permitidos = accModulos(x), ks = Object.keys(d.modulos).filter(k => permitidos.includes(k)), fuera = Object.keys(d.modulos).filter(k => !permitidos.includes(k));
  if (!ks.length) { toast('⚠ El archivo no trae cambios de los paneles de ese usuario'); return; }
  const nom = k => (ACC_PANELES.find(p => p.m.includes(k)) || {t:k}).t;
  const viejo = d.base && SEED.meta.corte && d.base < SEED.meta.corte;
  if (!confirm(`Cambios de ${x.nombre} (${new Date(d.fecha).toLocaleString('es-CO')}):\n\n• ${[...new Set(ks.map(nom))].join('\n• ')}${fuera.length ? `\n\n(Se ignoran ${fuera.length} partes que no son de sus paneles)` : ''}${viejo ? '\n\n⚠ Los hizo sobre una versión anterior de la página: lo que se publicó después en esos paneles quedará reemplazado.' : ''}\n\nEsos paneles quedarán como los dejó ${x.nombre.split(' ')[0]}. ¿Aplicar? Luego revisa y dale 🚀 Publicar.`)) return;
  modCambio(() => ks.forEach(k => { if (d.modulos[k] === null) delete DB[k]; else DB[k] = d.modulos[k]; }));
  toast('✓ Cambios aplicados · revisa y dale 🚀 Publicar');
}

// ── Administración de usuarios (solo editor): #usuarios, vista 'usu' ──
const accE = {nuevo:null};
const accPanelesHTML = (x, attr) => `<div class="acc-paneles">${ACC_PANELES.map(p => `<label><input type="checkbox" ${attr} value="${p.v}" ${(x.paneles || []).includes(p.v) ? 'checked' : ''}>${p.t}</label>`).join('')}</div>`;
function renderUsuarios(){
  const cont = q('usuarios');
  if (!EDITOR_TOTAL) { cont.innerHTML = '<div class="nores">Solo el administrador puede ver esta sección.</div>'; return; }
  const L = accLista(), pub = accPublicados(), clave = x => [x.u, x.h, x.rol, (x.paneles || []).join()].join('|'), pubK = new Set(pub.map(clave));
  const nr = (q('an-r') || {}).value || 'ver';
  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">🔐 Usuarios y accesos</div>
      <div class="sim-subt">${pub.length ? `La página pide usuario y contraseña (${pub.length} usuarios publicados).` : 'Aún no hay usuarios publicados: la página está abierta para todos. Al publicar el primer usuario empieza a pedir clave.'}</div></div>
      <label class="mbtn mbtn-ghost pt-file" title="Archivo .json que te mandó un usuario con el botón 📤 Enviar cambios">📥 Recibir cambios de un usuario<input type="file" id="acc-recibir" accept=".json,application/json" hidden></label></div>
    <div class="acc-aviso">ℹ️ Es una <b>puerta de entrada</b>: evita que cualquiera con el enlace vea la página, pero los datos siguen en el repositorio público de GitHub. Las contraseñas no se guardan, solo una huella cifrada. Después de crear, cambiar o quitar usuarios, dale <b>🚀 Publicar</b>.<br>
      <b>Perfiles:</b> 👁 Ver = solo mirar · 🧩 Editor por panel = edita solo los paneles marcados · ✏️ Editor = edita todo. Solo este PC publica: quien edita desde otro equipo usa <b>📤 Enviar cambios</b> y tú los recibes aquí con <b>📥 Recibir cambios</b>.</div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Nuevo usuario</b></div>
      <form class="acc-nuevo" id="acc-nuevo">
        <label>Usuario<input id="an-u" placeholder="ej. jperez" autocapitalize="none" spellcheck="false" required pattern="[a-zA-Z0-9._-]{3,30}" title="3 a 30 letras, números, punto, guion"></label>
        <label>Nombre<input id="an-n" placeholder="Nombre de la persona" required></label>
        <label>Perfil<select id="an-r">${accRolOpts(nr)}</select></label>
        <label>Contraseña<span class="acc-clave"><input id="an-c" required minlength="6"><button type="button" id="an-gen" title="Generar una contraseña">🎲</button></span></label>
        <div class="acc-np" id="an-pan" ${nr === 'panel' ? '' : 'hidden'}><b>Paneles que puede editar</b>${accPanelesHTML({}, 'data-an-pan')}</div>
        <button type="submit" class="mbtn">➕ Crear usuario</button>
      </form>
      ${accE.nuevo ? `<div class="acc-creado">✓ Usuario <b>${esc(accE.nuevo.u)}</b> listo. Envíale estos datos (la contraseña no se vuelve a mostrar):<br><code>Página: https://luchoacosta9801-ops.github.io/comite-aps/ · Usuario: ${esc(accE.nuevo.u)} · Contraseña: ${esc(accE.nuevo.c)}</code> <button type="button" class="plegar-todo" data-acc-copiar>📋 Copiar</button></div>` : ''}</div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Usuarios</b> <span class="meta">· ${L.length}</span></div>
      <div class="sim-tw"><table class="sim-t"><thead><tr><th>Usuario</th><th>Nombre</th><th>Perfil</th><th>Estado</th><th></th></tr></thead>
      <tbody>${L.map(x => `<tr><td class="b" style="font-family:var(--mono)">${esc(x.u)}</td><td>${esc(x.nombre)}</td>
        <td><select data-acc-rol="${esc(x.u)}">${accRolOpts(x.rol)}</select>${x.rol === 'panel' ? accPanelesHTML(x, `data-acc-pan="${esc(x.u)}"`) : ''}</td>
        <td>${pubK.has(clave(x)) ? '<span class="meta">publicado</span>' : '<b style="color:#b45309">sin publicar</b>'}</td>
        <td style="white-space:nowrap"><button type="button" class="plegar-todo" data-acc-clave="${esc(x.u)}" title="Poner una contraseña nueva">🔑 Nueva clave</button> <button type="button" class="plegar-todo" data-acc-borrar="${esc(x.u)}" title="Quitar el acceso">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" class="nores">Aún no hay usuarios.</td></tr>'}</tbody></table></div></div>`;
}
const accClaveAzar = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return [...crypto.getRandomValues(new Uint8Array(10))].map(b => a[b % a.length]).join(''); };
function accGuardar(fn){ modCambio(() => { DB.usuarios = DB.usuarios || {lista:[]}; fn(DB.usuarios.lista); if (!DB.usuarios.lista.length) delete DB.usuarios; }); }
q('usuarios').addEventListener('submit', async e => {
  if (e.target.id !== 'acc-nuevo') return; e.preventDefault();
  const u = q('an-u').value.trim().toLowerCase(), nombre = q('an-n').value.trim(), rol = q('an-r').value, c = q('an-c').value;
  const paneles = [...document.querySelectorAll('[data-an-pan]:checked')].map(i => i.value);
  if (accLista().some(x => x.u === u)) { toast('⚠ Ese usuario ya existe'); return; }
  if (rol === 'panel' && !paneles.length) { toast('⚠ Marca al menos un panel que pueda editar'); return; }
  const sal = accSal(), h = await accHash(sal, u, c);
  accE.nuevo = {u, c};
  accGuardar(L => L.push(Object.assign({u, nombre, rol, sal, h, creado:new Date().toISOString().slice(0, 10)}, rol === 'panel' ? {paneles} : {})));
  toast(`✓ Usuario ${u} creado · recuerda 🚀 Publicar`);
});
q('usuarios').addEventListener('click', async e => {
  const t = e.target;
  if (t.id === 'an-gen') { q('an-c').value = accClaveAzar(); return; }
  if (t.closest('[data-acc-copiar]') && accE.nuevo) { const txt = `Página: https://luchoacosta9801-ops.github.io/comite-aps/\nUsuario: ${accE.nuevo.u}\nContraseña: ${accE.nuevo.c}`; try { await navigator.clipboard.writeText(txt); toast('📋 Copiado'); } catch (e2) { toast('No se pudo copiar'); } return; }
  const b = t.closest('[data-acc-borrar]');
  if (b) { const u = b.dataset.accBorrar; if (confirm(`¿Quitar el acceso a ${u}?`)) { accE.nuevo = null; accGuardar(L => L.splice(L.findIndex(x => x.u === u), 1)); } return; }
  const k = t.closest('[data-acc-clave]');
  if (k) { const u = k.dataset.accClave, c = prompt(`Contraseña nueva para ${u} (mínimo 6 caracteres):`, accClaveAzar()); if (!c || c.length < 6) return;
    const sal = accSal(), h = await accHash(sal, u, c); accE.nuevo = {u, c}; accGuardar(L => { const x = L.find(y => y.u === u); x.sal = sal; x.h = h; }); toast(`🔑 Clave de ${u} cambiada · recuerda 🚀 Publicar`); }
});
q('usuarios').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'an-r') { q('an-pan').hidden = t.value !== 'panel'; return; }
  if (t.id === 'acc-recibir') { if (t.files[0]) accRecibir(t.files[0]); t.value = ''; return; }
  const s = t.closest('[data-acc-rol]');
  if (s) { accGuardar(L => { const x = L.find(y => y.u === s.dataset.accRol); x.rol = s.value; if (x.rol === 'panel') x.paneles = x.paneles || []; else delete x.paneles; }); return; }
  const p = t.closest('[data-acc-pan]');
  if (p) { const u = p.dataset.accPan, v = [...document.querySelectorAll(`[data-acc-pan="${CSS.escape(u)}"]:checked`)].map(i => i.value);
    accGuardar(L => { L.find(y => y.u === u).paneles = v; }); }
});
// El portal se dibujó antes de cargar este archivo: se redibuja para mostrar la tarjeta y la vista de usuarios
if (['usu', 'portal'].includes(vistaActual)) renderVista();
