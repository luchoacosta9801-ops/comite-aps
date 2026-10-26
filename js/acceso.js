// Acceso con usuario y contraseña (puerta de entrada). Los usuarios se publican en datos.js con la contraseña
// cifrada (SHA-256 con sal propia por usuario); nunca se guarda la contraseña. Perfiles: 'ver' y 'editor'
// (editor activa el modo editor en ese navegador, como el enlace ?editor=). Es una puerta, no una bóveda: los datos
// siguen en el repositorio público de GitHub. En este PC (localhost) y con el editor activado no se pide clave.
// DB.usuarios = {lista:[{u, nombre, rol, sal, h, creado}]}
const SESION_KEY = 'comite-aps:sesion';
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

// Al cargar: si hace falta, se tapa todo con la pantalla de entrada; si hay sesión, botón para salir
(function accIniciar(){
  if (!window.crypto || !crypto.subtle) return;
  const s = accSesion();
  if (accPuertaActiva() && !s) { accPantalla(); return; }
  if (s || (accPublicados().length && editorActivado() && !ES_LOCAL)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'fbtn-inicio acc-salir'; b.title = 'Cerrar sesión en este navegador';
    b.textContent = `🔒 ${s ? (s.nombre || s.u).split(' ')[0] : 'Salir'}`; b.onclick = () => { if (confirm('¿Cerrar la sesión en este navegador?')) accSalir(); };
    const ref = q('btn-inicio'); if (ref) ref.insertAdjacentElement('afterend', b);
  }
})();

// ── Administración de usuarios (solo editor): #usuarios, vista 'usu' ──
const accE = {nuevo:null};
function renderUsuarios(){
  const cont = q('usuarios');
  if (!MODO_EDICION) { cont.innerHTML = '<div class="nores">Solo el administrador puede ver esta sección.</div>'; return; }
  const L = accLista(), pub = accPublicados(), pubK = new Set(pub.map(x => x.u + '|' + x.h + '|' + x.rol));
  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">🔐 Usuarios y accesos</div>
      <div class="sim-subt">${pub.length ? `La página pide usuario y contraseña (${pub.length} usuarios publicados).` : 'Aún no hay usuarios publicados: la página está abierta para todos. Al publicar el primer usuario empieza a pedir clave.'}</div></div></div>
    <div class="acc-aviso">ℹ️ Es una <b>puerta de entrada</b>: evita que cualquiera con el enlace vea la página, pero los datos siguen en el repositorio público de GitHub. Las contraseñas no se guardan, solo una huella cifrada. Después de crear, cambiar o quitar usuarios, dale <b>🚀 Publicar</b>.</div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Nuevo usuario</b></div>
      <form class="acc-nuevo" id="acc-nuevo">
        <label>Usuario<input id="an-u" placeholder="ej. jperez" autocapitalize="none" spellcheck="false" required pattern="[a-zA-Z0-9._-]{3,30}" title="3 a 30 letras, números, punto, guion"></label>
        <label>Nombre<input id="an-n" placeholder="Nombre de la persona" required></label>
        <label>Perfil<select id="an-r"><option value="ver">👁 Ver</option><option value="editor">✏️ Editor</option></select></label>
        <label>Contraseña<span class="acc-clave"><input id="an-c" required minlength="6"><button type="button" id="an-gen" title="Generar una contraseña">🎲</button></span></label>
        <button type="submit" class="mbtn">➕ Crear usuario</button>
      </form>
      ${accE.nuevo ? `<div class="acc-creado">✓ Usuario <b>${esc(accE.nuevo.u)}</b> creado. Envíale estos datos (la contraseña no se vuelve a mostrar):<br><code>Página: https://luchoacosta9801-ops.github.io/comite-aps/ · Usuario: ${esc(accE.nuevo.u)} · Contraseña: ${esc(accE.nuevo.c)}</code> <button type="button" class="plegar-todo" data-acc-copiar>📋 Copiar</button></div>` : ''}</div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Usuarios</b> <span class="meta">· ${L.length}</span></div>
      <div class="sim-tw"><table class="sim-t"><thead><tr><th>Usuario</th><th>Nombre</th><th>Perfil</th><th>Estado</th><th></th></tr></thead>
      <tbody>${L.map(x => `<tr><td class="b" style="font-family:var(--mono)">${esc(x.u)}</td><td>${esc(x.nombre)}</td>
        <td><select data-acc-rol="${esc(x.u)}"><option value="ver" ${x.rol === 'ver' ? 'selected' : ''}>👁 Ver</option><option value="editor" ${x.rol === 'editor' ? 'selected' : ''}>✏️ Editor</option></select></td>
        <td>${pubK.has(x.u + '|' + x.h + '|' + x.rol) ? '<span class="meta">publicado</span>' : '<b style="color:#b45309">sin publicar</b>'}</td>
        <td style="white-space:nowrap"><button type="button" class="plegar-todo" data-acc-clave="${esc(x.u)}" title="Poner una contraseña nueva">🔑 Nueva clave</button> <button type="button" class="plegar-todo" data-acc-borrar="${esc(x.u)}" title="Quitar el acceso">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" class="nores">Aún no hay usuarios.</td></tr>'}</tbody></table></div></div>`;
}
const accClaveAzar = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return [...crypto.getRandomValues(new Uint8Array(10))].map(b => a[b % a.length]).join(''); };
function accGuardar(fn){ modCambio(() => { DB.usuarios = DB.usuarios || {lista:[]}; fn(DB.usuarios.lista); if (!DB.usuarios.lista.length) delete DB.usuarios; }); }
q('usuarios').addEventListener('submit', async e => {
  if (e.target.id !== 'acc-nuevo') return; e.preventDefault();
  const u = q('an-u').value.trim().toLowerCase(), nombre = q('an-n').value.trim(), rol = q('an-r').value, c = q('an-c').value;
  if (accLista().some(x => x.u === u)) { toast('⚠ Ese usuario ya existe'); return; }
  const sal = accSal(), h = await accHash(sal, u, c);
  accE.nuevo = {u, c};
  accGuardar(L => L.push({u, nombre, rol, sal, h, creado:new Date().toISOString().slice(0, 10)}));
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
q('usuarios').addEventListener('change', e => { const s = e.target.closest('[data-acc-rol]'); if (s) accGuardar(L => { L.find(x => x.u === s.dataset.accRol).rol = s.value; }); });
// El portal se dibujó antes de cargar este archivo: se redibuja para mostrar la tarjeta y la vista de usuarios
if (['usu', 'portal'].includes(vistaActual)) renderVista();
