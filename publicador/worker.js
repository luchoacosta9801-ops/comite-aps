// Publicador del Comité APS (Cloudflare Worker).
// Deja que los usuarios con perfil editor / editor por panel publiquen desde CUALQUIER equipo, sin pasar por el
// PC del administrador. Recibe los módulos que cambió el usuario, verifica su usuario y contraseña contra
// js/datos.js (la misma lista de 🔐 Usuarios y accesos), reemplaza solo esos módulos en js/datos.js, sube la
// versión (index.html, sw.js, version.json, como publicar.ps1) y hace UN commit en main y gh-pages.
//
// Secretos (Cloudflare → Worker → Settings → Variables and Secrets), nunca en la página:
//   GITHUB_TOKEN  token "fine-grained" de GitHub con permiso Contents: Read and write SOLO en el repositorio comite-aps
// Variables opcionales: REPO (por defecto luchoacosta9801-ops/comite-aps), ORIGENES (separados por coma)
//
// GET  /datos     → { ok, sha, contenido }  js/datos.js tal como está en GitHub ahora (sin esperar a Pages); sha = commit de main
// POST /publicar  { u, clave, mensaje, sha, modulos:{clave: valor|null} }
//   sha = el de /datos sobre el que el navegador mezcló sus cambios; si alguien publicó entretanto → 409 y el
//   navegador vuelve a mezclar y reintenta solo.

const REPO_DEF = 'luchoacosta9801-ops/comite-aps';
const ORIGENES_DEF = ['https://luchoacosta9801-ops.github.io', 'http://localhost:8080', 'http://127.0.0.1:8080'];
// Módulos que puede tocar cada panel (igual que ACC_PANELES en js/acceso.js). El perfil editor toca todos menos usuarios y meta.
const PANELES = { agro:['agronomia'], maes:['maestroSuertes'], freat:['freatico', 'lluvias'], nfcos:['cosechaNF'], ppto:['ppto2027'],
  proy:['proyectos'], proto:['protocolos'], estructura:['estructura'], simulador:['sim'], lab:['labores', 'levante'] };

export default {
  async fetch(req, env) {
    const origen = req.headers.get('Origin') || '';
    const permitidos = env.ORIGENES ? env.ORIGENES.split(',').map(s => s.trim()) : ORIGENES_DEF;
    const cors = permitidos.includes(origen) ? { 'Access-Control-Allow-Origin': origen, 'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' } : {};
    const resp = (codigo, obj) => new Response(JSON.stringify(obj), { status: codigo, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!permitidos.includes(origen)) return resp(403, { ok: false, error: 'Origen no permitido' });
    if (!env.GITHUB_TOKEN) return resp(500, { ok: false, error: 'Falta configurar GITHUB_TOKEN en el publicador' });
    const gh = github(env.GITHUB_TOKEN, env.REPO || REPO_DEF);
    const ruta = new URL(req.url).pathname;
    try {
      if (req.method === 'GET' && ruta === '/datos') {
        const f = await gh.archivo('js/datos.js');
        return resp(200, { ok: true, sha: f.commit, contenido: f.texto });
      }
      if (req.method === 'POST' && ruta === '/publicar') return resp(...await publicar(await req.json(), gh));
      return resp(404, { ok: false, error: 'No existe' });
    } catch (e) {
      return resp(502, { ok: false, error: 'Error del publicador: ' + (e && e.message || e) });
    }
  },
};

async function publicar(p, gh) {
  if (!p || typeof p.u !== 'string' || typeof p.clave !== 'string' || !p.modulos || typeof p.modulos !== 'object') return [400, { ok: false, error: 'Solicitud incompleta' }];
  const datos = await gh.archivo('js/datos.js');
  // 1. Usuario y contraseña, contra la lista publicada
  const u = p.u.trim().toLowerCase();
  const x = usuarios(datos.texto).find(y => y.u === u);
  if (!x || await sha256(`${x.sal}|${u}|${p.clave}`) !== x.h) return [401, { ok: false, error: 'Usuario o contraseña incorrectos' }];
  if (x.hasta) { const [a, m, d] = x.hasta.split('-').map(Number); if (Date.now() >= Date.UTC(a, m - 1, d + 1, 5)) return [403, { ok: false, error: 'Tu acceso venció' }]; }   // medianoche hora Colombia (UTC-5)
  const puede = x.rol === 'editor' ? Object.keys(p.modulos).filter(k => /^[A-Za-z0-9_]+$/.test(k) && k !== 'usuarios' && k !== 'meta') : x.rol === 'panel' ? (x.paneles || []).flatMap(v => PANELES[v] || []) : [];
  const ks = Object.keys(p.modulos), fuera = ks.filter(k => !puede.includes(k));
  if (!ks.length) return [400, { ok: false, error: 'No hay cambios para publicar' }];
  if (fuera.length) return [403, { ok: false, error: `Tu perfil no puede publicar: ${fuera.join(', ')}` }];
  // 2. ¿Alguien publicó mientras tanto? El navegador vuelve a mezclar y reintenta
  if (p.sha && p.sha !== datos.commit) return [409, { ok: false, conflicto: true, error: 'Alguien publicó hace un momento; mezclando de nuevo…' }];
  // 3. Reemplazar solo esos módulos y poner un corte nuevo (los navegadores toman los datos nuevos)
  let texto = datos.texto;
  for (const k of ks) texto = ponerModulo(texto, k, p.modulos[k]);
  const corte = new Date().toISOString();
  texto = ponerModulo(texto, 'meta', Object.assign(leerModulo(texto, 'meta') || {}, { corte }));
  if (!texto.includes('const SEED = {') || texto.length < 200) return [500, { ok: false, error: 'El archivo resultante no es válido' }];
  // 4. Subir versión y hacer un solo commit en main (y gh-pages, que es lo que sirve Pages)
  const v0 = +JSON.parse((await gh.archivo('version.json')).texto).version, v1 = v0 + 1;
  const index = (await gh.archivo('index.html')).texto, sw = (await gh.archivo('sw.js')).texto;
  const cambiar = (t, pares, nombre) => pares.reduce((s, [a, b]) => { if (!s.includes(a)) throw new Error(`No encontré "${a}" en ${nombre}`); return s.split(a).join(b); }, t);
  const archivos = {
    'js/datos.js': texto,
    'version.json': `{ "version": "${v1}" }\n`,
    'index.html': cambiar(index, [[`?v=${v0}"`, `?v=${v1}"`], [`name="app-version" content="${v0}"`, `name="app-version" content="${v1}"`]], 'index.html'),
    'sw.js': cambiar(sw, [[`?v=${v0}'`, `?v=${v1}'`], [`comite-aps-v${v0}'`, `comite-aps-v${v1}'`]], 'sw.js'),
  };
  const mensaje = `${String(p.mensaje || 'Actualizar datos').slice(0, 120).replace(/[\r\n]+/g, ' ')} · ${x.nombre || u} (v${v1})`;
  const r = await gh.commit(archivos, mensaje, datos.commit);
  if (r === 'conflicto') return [409, { ok: false, conflicto: true, error: 'Alguien publicó hace un momento; mezclando de nuevo…' }];
  return [200, { ok: true, version: v1, corte, salida: `Publicado v${v1} por ${x.nombre || u}` }];
}

// ── js/datos.js: es "const SEED = {" con una entrada por módulo que empieza en una línea con dos espacios ("  clave: ")
// y puede ocupar varias líneas (las siguientes van más adentro). Se reemplaza el texto de una entrada sin evaluar el archivo.
const INICIO = /^ {2}([A-Za-z0-9_]+): /;
function entrada(lineas, k) {
  const i = lineas.findIndex(l => l.startsWith(`  ${k}: `));
  if (i < 0) return null;
  let j = i + 1; while (j < lineas.length && !/^ {2}(\/\/|[A-Za-z0-9_]+: )/.test(lineas[j]) && !/^\};/.test(lineas[j])) j++;
  return [i, j];   // [desde, hasta) en líneas
}
function ponerModulo(texto, k, valor) {
  const nl = texto.includes('\r\n') ? '\r\n' : '\n', L = texto.split(/\r?\n/), e = entrada(L, k);
  const nueva = valor === null || valor === undefined ? [] : [`  ${k}: ${JSON.stringify(valor)},`];
  if (e) { let [i, j] = e; if (!nueva.length && i > 0 && /^ {2}\/\//.test(L[i - 1])) i--; L.splice(i, j - i, ...nueva); }
  else if (nueva.length) { const c = L.findIndex(l => l.startsWith('  costos: ')); L.splice(c < 0 ? L.findIndex(l => /^\};/.test(l)) : c, 0, ...nueva); }
  return L.join(nl);
}
function leerModulo(texto, k) {
  const L = texto.split(/\r?\n/), e = entrada(L, k); if (!e) return undefined;
  return parsear(L.slice(e[0], e[1]).join('\n').replace(INICIO, '').replace(/,\s*$/, ''));
}
// Las entradas son JSON salvo algunas claves sin comillas (usuarios: { lista: [...] }); se les ponen comillas
function parsear(t) { try { return JSON.parse(t); } catch (e) { return JSON.parse(t.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')); } }
function usuarios(texto) { const v = leerModulo(texto, 'usuarios'); return (v && v.lista) || []; }

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ── GitHub (API REST): leer archivos de main y hacer un commit con varios archivos ──
function github(token, repo) {
  const api = async (ruta, opc = {}) => {
    const r = await fetch(`https://api.github.com/repos/${repo}/${ruta}`, { ...opc, headers: { 'Authorization': `Bearer ${token}`,
      'Accept': opc.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'comite-aps-publicador', ...(opc.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (opc.permitir && opc.permitir.includes(r.status)) return { status: r.status };
    if (!r.ok) throw new Error(`GitHub ${r.status} en ${ruta.split('?')[0]}: ${(await r.text()).slice(0, 200)}`);
    return opc.raw ? r.text() : r.json();
  };
  let cabeza = null;   // commit de main al leer (todas las lecturas salen del mismo commit)
  const leerCabeza = async () => cabeza || (cabeza = (await api('git/ref/heads/main')).object.sha);
  return {
    async archivo(ruta) {
      const c = await leerCabeza();
      return { texto: await api(`contents/${ruta}?ref=${c}`, { raw: true }), commit: c };
    },
    async commit(archivos, mensaje, padre) {
      const base = (await api(`git/commits/${padre}`)).tree.sha;
      const tree = [];
      for (const [path, content] of Object.entries(archivos)) {
        const b = await api('git/blobs', { method: 'POST', body: JSON.stringify({ content, encoding: 'utf-8' }) });
        tree.push({ path, mode: '100644', type: 'blob', sha: b.sha });
      }
      const t = await api('git/trees', { method: 'POST', body: JSON.stringify({ base_tree: base, tree }) });
      const c = await api('git/commits', { method: 'POST', body: JSON.stringify({ message: mensaje, tree: t.sha, parents: [padre] }) });
      // main avanza solo si nadie publicó entretanto (sin force); gh-pages lo sigue
      const m = await api('git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }), permitir: [409, 422] });
      if (m.status) return 'conflicto';
      await api('git/refs/heads/gh-pages', { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) });
      return c.sha;
    },
  };
}
