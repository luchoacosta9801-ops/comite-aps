// Estado de la app. En modo edición (solo en este PC, vía servidor.ps1 o archivo local)
// los cambios se guardan en localStorage hasta publicarlos; en GitHub Pages todos ven
// exactamente los datos publicados (js/datos.js), sin edición.
const STORE_KEY = 'comite-aps:v1';
// El editor también se puede activar en el link público, solo en el navegador del administrador,
// abriendo una vez ?editor=<clave> (la clave está en _privado/clave-editor.txt; aquí solo su hash).
// Es una comodidad, no seguridad: publicar exige servidor.ps1 en su PC y su acceso a GitHub.
const EDITOR_KEY = 'comite-aps:editor';
const EDITOR_HASH = 'af8b68f4115e09b71a8f924bf6eceee2db4329a3e3eab3638d2000068a65344d';
const ES_LOCAL = location.protocol === 'file:' || ['localhost','127.0.0.1'].includes(location.hostname);
function editorActivado(){ try { return localStorage.getItem(EDITOR_KEY) === EDITOR_HASH; } catch (e) { return false; } }
const MODO_EDICION = ES_LOCAL || editorActivado();
// Dónde está servidor.ps1: el mismo sitio si se abrió desde él; si no, el del PC
const API_BASE = ES_LOCAL && location.protocol.startsWith('http') ? '' : 'http://localhost:8080/';
let DB;

// ?editor=<clave> activa el editor en este navegador; ?editor=salir lo desactiva
(function activarEditor(){
  const p = new URLSearchParams(location.search).get('editor');
  if (p === null) return;
  const limpiar = () => location.replace(location.pathname + location.hash);
  if (p === 'salir') { try { localStorage.removeItem(EDITOR_KEY); } catch (e) {} limpiar(); return; }
  if (!window.crypto || !crypto.subtle) return;
  crypto.subtle.digest('SHA-256', new TextEncoder().encode(p)).then(buf => {
    const h = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (h === EDITOR_HASH) { try { localStorage.setItem(EDITOR_KEY, h); } catch (e) {} }
    limpiar();
  });
})();

function clone(o){ return JSON.parse(JSON.stringify(o)); }

function loadDB(){
  if (!MODO_EDICION) { DB = clone(SEED); return; }
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      // Un corte publicado más nuevo reemplaza lo guardado en el navegador
      // (o uno igual/más nuevo: recién publicado desde aquí, mientras Pages termina de actualizar)
      const iso = c => /^\d{4}-\d{2}-\d{2}T/.test(String(c || ''));
      const c0 = d && d.meta && d.meta.corte, c1 = SEED.meta.corte;
      const vigente = c0 === c1 || (iso(c0) && iso(c1) && c0 > c1);
      if (d && Array.isArray(d.lotes) && vigente) { DB = Object.assign(clone(SEED), d); return; }
    }
  } catch (e) { console.warn('No se pudo leer el guardado local', e); }
  DB = clone(SEED);
}

function save(){
  if (!MODO_EDICION) return;
  DB.meta.actualizado = new Date().toISOString();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  catch (e) { toast('⚠ No se pudo guardar en este navegador'); }
  updateSaveDot();
}

// ── Publicación (solo desde este PC con servidor.ps1) ──
// Datos comparables, sin las marcas de tiempo
function contenidoDatos(d){ const c = clone(d); delete c.meta.actualizado; delete c.meta.corte; return JSON.stringify(c); }
function hayCambiosSinPublicar(){ return contenidoDatos(DB) !== contenidoDatos(SEED); }

// Texto de js/datos.js: un registro por línea para que los cambios se lean fácil en git
function datosJS(d){
  const J = JSON.stringify;
  const lista = (a, sangria = '  ') => '[\n' + a.map(o => sangria + '  ' + J(o)).join(',\n') + '\n' + sangria + ']';
  const meta = Object.assign({}, d.meta); delete meta.actualizado;
  const ant = d.procesoAnterior;
  return `// Datos publicados del Comité APS. Archivo generado por la app ("Publicar para todos");
// cambiar meta.corte hace que los navegadores descarten lo guardado y tomen estos datos.
const SEED = {
  meta: ${J(meta)},
  lotes: ${lista(d.lotes)},
  ruta: ${lista(d.ruta)},
  proceso: ${lista(d.proceso)},
  // RUTA SEMANA PASADA del comité anterior, para la torta comparativa
  procesoAnterior: ${ant ? `{ fecha: ${J(ant.fecha)}, semana: ${J(ant.semana)}, items: ${lista(ant.items, '    ')} }` : 'null'},
  pptoMensual: { z1: ${J(d.pptoMensual.z1)}, z2: ${J(d.pptoMensual.z2)} },
  costos: ${lista(d.costos)},
};
`;
}

// Envía los datos al servidor local, que escribe js/datos.js y ejecuta publicar.ps1
function publicarDatos(mensaje, publicar = true){
  const d = clone(DB);
  d.meta.corte = new Date().toISOString();   // corte nuevo: todos los navegadores lo toman
  return fetch(API_BASE + 'api/publicar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Comite': '1' },
    body: JSON.stringify({ contenido: datosJS(d), mensaje, publicar }),
  }).then(r => r.json().catch(() => ({ ok:false, error:'Respuesta no válida del servidor' })))
    .then(res => {
      if (!res.ok) throw new Error(res.error || res.salida || 'No se pudo publicar');
      DB.meta.corte = d.meta.corte;
      save();
      return res;
    });
}
function servidorDisponible(){
  if (location.protocol === 'file:') return Promise.resolve(false);
  return fetch(API_BASE + 'api/estado', { cache:'no-store' }).then(r => r.ok ? r.json() : null).then(j => !!(j && j.edicion)).catch(() => false);
}

function resetDB(){
  DB = clone(SEED);
  save();
}

function hacsActuales(){
  const set = new Set(HACS_BASE);
  DB.lotes.forEach(l => set.add(l.h));
  DB.proceso.forEach(r => set.add(r.hac));
  return [...set];
}

// ── Respaldo JSON ──
function descargar(nombre, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugSemana(){ return (DB.meta.semana || 'semana').replace(/\s+/g,'-').toLowerCase(); }

function exportarRespaldo(){
  descargar(`comite-aps-${slugSemana()}.json`,
    new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'}));
  toast('✓ Respaldo descargado');
}

function importarRespaldo(file){
  return file.text().then(txt => {
    const d = JSON.parse(txt);
    if (!d || !Array.isArray(d.lotes) || !Array.isArray(d.ruta) || !Array.isArray(d.proceso))
      throw new Error('El archivo no es un respaldo válido del Comité APS.');
    DB = Object.assign(clone(SEED), d);
    DB.meta = Object.assign({}, d.meta, { corte: SEED.meta.corte }); // que no lo descarte loadDB
    save();
  });
}

// ── Excel (SheetJS se carga solo cuando se necesita) ──
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxPromise;
function cargarXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise = xlsxPromise || new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = XLSX_URL;
    s.onload = () => res(window.XLSX);
    s.onerror = () => { xlsxPromise = null; rej(new Error('No se pudo cargar el lector de Excel (¿sin internet?).')); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

