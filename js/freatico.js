// Niveles freáticos (#freaticos, vista 'freat'): lecturas quincenales de los pozos de observación y mapa
// de isobatas hecho aquí mismo con IDW (potencia 2, todos los pozos con lectura), recortado a las suertes,
// como el que se hacía en QGIS. Rangos: 0-0,5 crítico · 0,5-1 subcrítico · 1-1,5 regular · 1,5-2 bueno.
// Datos: DB.freatico {archivo, fechaArchivo, pozos[[n,lat,lon,hacienda,sector,zona]], lecturas{fecha:{n:valor}}}
// (valor en m, "S" = seco = más de 2 m). Los trae el servidor (GET /api/freatico) del Excel fijo en
// Documents\SIG\LECTURA NIVEL FREATICO. La cartografía (suertes, ríos, canales) está en js/mapa-freatico.js.

const FR_CLASES = [
  {n:'Crítico',    r:'0,0 - 0,5', c:'#e8202a', max:0.5},
  {n:'Subcrítico', r:'0,5 - 1,0', c:'#f7941d', max:1},
  {n:'Regular',    r:'1,0 - 1,5', c:'#f4e82a', max:1.5},
  {n:'Bueno',      r:'1,5 - 2,0', c:'#3aaa35', max:Infinity},
];
const frClase = v => v < 0.5 ? 0 : v < 1 ? 1 : v < 1.5 ? 2 : 3;
const FR_CELDA = 20;          // tamaño de celda del IDW (m): 20 m = 0,04 ha
// Potencia del IDW 2,75 (peso = 1/d^2,75, calculado con raíces porque es mucho más rápido que Math.pow):
// así la distribución del 30 jul 2025 queda como la del mapa de QGIS (QGIS 5,7/23,0/41,9/29,4 % · aquí 6,5/23,8/40,9/28,8 %)
const frVal = v => v === 'S' ? 2 : v == null ? null : Math.min(2, +v);
const frMes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const frFecha = (f, anio = true) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? `${+m[3]} ${frMes[+m[2] - 1]}${anio ? ' ' + m[1] : ''}` : '—'; };
const frNum = (n, d = 2) => (+n || 0).toLocaleString('es-CO', {minimumFractionDigits:d, maximumFractionDigits:d});

// Coordenadas geográficas → MAGNA-SIRGAS Colombia Oeste (EPSG:3115), Transversa de Mercator
function frTM(lat, lon){
  const a = 6378137, f = 1 / 298.257222101, e2 = f * (2 - f), ep2 = e2 / (1 - e2), k0 = 1;
  const rad = Math.PI / 180, la = lat * rad, l0 = -77.07750791666666 * rad, la0 = 4.596200416666666 * rad;
  const e4 = e2 * e2, e6 = e4 * e2;
  const M = p => a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * p - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * p)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * p) - (35 * e6 / 3072) * Math.sin(6 * p));
  const s = Math.sin(la), c = Math.cos(la), t = Math.tan(la);
  const N = a / Math.sqrt(1 - e2 * s * s), T = t * t, C = ep2 * c * c, A = (lon * rad - l0) * c;
  const x = 1e6 + k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A ** 5 / 120);
  const y = 1e6 + k0 * (M(la) - M(la0) + N * t * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A ** 6 / 720));
  return [x, y];
}

function freatico(){
  if (!DB.freatico && typeof SEED !== 'undefined' && SEED.freatico) DB.freatico = clone(SEED.freatico);
  return DB.freatico || null;
}
const frFechas = F => Object.keys(F.lecturas || {}).sort();
// Pozos con su lectura en una fecha (x, y en metros relativos al mapa)
function frPuntos(F, fecha){
  const L = F.lecturas[fecha] || {}, M = MAPA_FREATICO;
  return F.pozos.map(p => { const [x, y] = frTM(p[1], p[2]), raw = L[p[0]]; return {n:p[0], h:p[3], s:p[4], z:p[5], x:x - M.x0, y:y - M.y0, raw, v:frVal(raw)}; });
}

// ── Malla de celdas dentro de las suertes (se arma una vez) ──
let FRM = null;
function frMalla(){
  if (FRM) return FRM;
  const M = MAPA_FREATICO, W = Math.ceil(M.ancho / FR_CELDA), H = Math.ceil(M.alto / FR_CELDA);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  M.suertes.forEach((s, i) => {
    const id = i + 1; g.fillStyle = `rgb(${id >> 16 & 255},${id >> 8 & 255},${id & 255})`;
    g.beginPath();
    s[3].forEach(r => { for (let k = 0; k < r.length; k += 2) { const px = r[k] / FR_CELDA, py = (M.alto - r[k + 1]) / FR_CELDA; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); });
    g.fill('evenodd');
  });
  const d = g.getImageData(0, 0, W, H).data, idx = [], sue = [], cx = [], cy = [];
  const celda = new Int32Array(W * H).fill(-1);
  for (let k = 0; k < W * H; k++) {
    if (d[k * 4 + 3] < 128) continue;
    const id = (d[k * 4] << 16 | d[k * 4 + 1] << 8 | d[k * 4 + 2]) - 1;
    if (id < 0 || id >= M.suertes.length) continue;
    celda[k] = idx.length; idx.push(k); sue.push(id);
    cx.push((k % W + 0.5) * FR_CELDA); cy.push(M.alto - (Math.floor(k / W) + 0.5) * FR_CELDA);
  }
  // Agua en metros (viene en lon/lat)
  const agua = (M.agua_lonlat || []).map(r => { const o = []; for (let k = 0; k < r.length; k += 2) { const [x, y] = frTM(r[k + 1], r[k]); o.push(x - M.x0, y - M.y0); } return o; });
  return FRM = {W, H, idx:Int32Array.from(idx), sue:Int32Array.from(sue), cx:Float64Array.from(cx), cy:Float64Array.from(cy), celda, agua};
}

// IDW sobre las celdas (paso = 1 usa todas; 3 = una de cada 3x3 para la evolución)
function frIDW(P, paso = 1){
  const G = frMalla(), pts = P.filter(p => p.v != null);
  const n = pts.length, px = Float64Array.from(pts, p => p.x), py = Float64Array.from(pts, p => p.y), pv = Float64Array.from(pts, p => p.v);
  const out = new Float32Array(G.idx.length).fill(NaN);
  if (!n) return out;
  for (let i = 0; i < G.idx.length; i++) {
    if (paso > 1) { const k = G.idx[i]; if ((k % G.W) % paso || Math.floor(k / G.W) % paso) continue; }
    const x = G.cx[i], y = G.cy[i]; let sw = 0, sv = 0, exacto = -1;
    for (let j = 0; j < n; j++) { const dx = px[j] - x, dy = py[j] - y, d2 = dx * dx + dy * dy; if (d2 < 1) { exacto = j; break; } const r4 = Math.sqrt(Math.sqrt(d2)), w = 1 / (d2 * r4 * Math.sqrt(r4)); sw += w; sv += w * pv[j]; }
    out[i] = exacto >= 0 ? pv[exacto] : sv / sw;
  }
  return out;
}
// Resumen de una interpolación: área por clase, por hacienda y nivel promedio por suerte.
// El área de cada suerte (ha oficial de la cartografía) se reparte según la fracción de sus celdas en cada rango.
function frResumen(V){
  const G = frMalla(), M = MAPA_FREATICO, nS = M.suertes.length;
  const clases = [0, 0, 0, 0], hac = {}, suma = new Float64Array(nS), cnt = new Int32Array(nS), porCl = new Int32Array(nS * 4);
  for (let i = 0; i < V.length; i++) {
    const v = V[i]; if (v !== v) continue;
    const s = G.sue[i]; porCl[s * 4 + frClase(v)]++; suma[s] += v; cnt[s]++;
  }
  for (let s = 0; s < nS; s++) {
    if (!cnt[s]) continue;
    const ha = M.suertes[s][2], h = M.suertes[s][1], H = hac[h] = hac[h] || [0, 0, 0, 0];
    for (let c = 0; c < 4; c++) { const a = ha * porCl[s * 4 + c] / cnt[s]; clases[c] += a; H[c] += a; }
  }
  const suertes = M.suertes.map((s, i) => cnt[i] ? {i, cod:s[0], h:s[1], ha:s[2], v:suma[i] / cnt[i]} : null).filter(Boolean);
  return {clases, total:clases.reduce((a, b) => a + b, 0), hac, suertes};
}

// ── Estado de la vista ──
const frE = {fecha:'', capas:{pozos:true, suertes:true, agua:true, etiquetas:false}, pozo:null, hac:'', vista:null, cache:{}, evol:{}, evolFechas:''};
function frCalculo(F, fecha){
  if (frE.cache[fecha]) return frE.cache[fecha];
  const P = frPuntos(F, fecha), V = frIDW(P), R = frResumen(V);
  return frE.cache[fecha] = {P, V, R};
}
// Resumen con malla gruesa (1 de cada 3x3 celdas): para la evolución y la comparación con la lectura anterior
function frResumenRapido(F, fecha){
  if (frE.cache[fecha]) return frE.cache[fecha].R;
  return frE.evol[fecha] = frE.evol[fecha] || frResumen(frIDW(frPuntos(F, fecha), 3));
}

let frCargando = null;
function frCargarMapa(){
  if (typeof MAPA_FREATICO !== 'undefined') return Promise.resolve();
  if (frCargando) return frCargando;
  const v = (document.querySelector('meta[name="app-version"]') || {}).content || '1';
  return frCargando = new Promise((ok, mal) => { const s = document.createElement('script'); s.src = `js/mapa-freatico.js?v=${v}`; s.onload = ok; s.onerror = () => { frCargando = null; mal(); }; document.head.appendChild(s); });
}

function renderFreatico(){
  const cont = q('freaticos');
  const F = freatico();
  if (MODO_EDICION) frRevisarServidor();
  if (!F || !frFechas(F).length) {
    cont.innerHTML = `<div class="mod-top"><div class="sim-tit">💧 Niveles freáticos</div></div><div class="nores">Aún no hay lecturas cargadas.${MODO_EDICION ? ' Pon el Excel en <b>Documentos\\SIG\\LECTURA NIVEL FREATICO</b> y pulsa <button type="button" class="mbtn" data-fr-act>🔄 Actualizar lecturas</button>' : ''}</div>`;
    return;
  }
  if (typeof MAPA_FREATICO === 'undefined') {
    cont.innerHTML = `<div class="mod-top"><div class="sim-tit">💧 Niveles freáticos</div></div><div class="nores">Cargando cartografía…</div>`;
    frCargarMapa().then(() => vistaActual === 'freat' && renderFreatico()).catch(() => { cont.querySelector('.nores').textContent = '⚠ No se pudo cargar la cartografía. Revisa la conexión y vuelve a abrir.'; });
    return;
  }
  const fechas = frFechas(F);
  if (!fechas.includes(frE.fecha)) frE.fecha = fechas[fechas.length - 1];
  const i = fechas.indexOf(frE.fecha), ant = fechas[i - 1];
  // La interpolación tarda ~1 s: primero un aviso y luego el cálculo
  if (!frE.cache[frE.fecha]) {
    if (!cont.querySelector('.fr-calc')) cont.insertAdjacentHTML('afterbegin', '<div class="fr-calc">⏳ Calculando el mapa de isobatas…</div>');
    setTimeout(() => { frCalculo(F, frE.fecha); if (vistaActual === 'freat') renderFreatico(); }, 30);
    return;
  }
  const {P, R} = frCalculo(F, frE.fecha);
  const Ra = ant ? frResumenRapido(F, ant) : null;
  const conDato = P.filter(p => p.v != null), prom = conDato.length ? sum(conDato, p => p.v) / conDato.length : 0;
  const tot = R.total || 1, pct = c => R.clases[c] / tot * 100;
  const opF = fechas.slice().reverse().map(f => `<option value="${f}" ${f === frE.fecha ? 'selected' : ''}>${frFecha(f)}</option>`).join('');
  // Cambio vs la lectura anterior (la anterior puede venir de la malla gruesa: se compara en % del área)
  const dif = (c) => { if (!Ra || !Ra.total) return ''; const d = R.clases[c] - Ra.clases[c] / Ra.total * R.total; if (Math.abs(d) < 0.5) return '<span class="meta">= igual</span>'; const malo = c < 2 ? d > 0 : d < 0; return `<span style="color:${malo ? 'var(--red)' : 'var(--green)'}">${d > 0 ? '▲' : '▼'} ${frNum(Math.abs(d), 0)} ha</span>`; };
  const hacs = Object.entries(R.hac).map(([h, c]) => ({h, c, t:c.reduce((a, b) => a + b, 0)})).sort((a, b) => (b.c[0] + b.c[1]) / b.t - (a.c[0] + a.c[1]) / a.t);
  const criticas = R.suertes.filter(s => s.v < 0.5).sort((a, b) => a.v - b.v);
  // Pozos: lectura actual vs anterior
  const Lant = ant ? F.lecturas[ant] : {};
  const pozos = P.filter(p => !frE.hac || p.h === frE.hac).map(p => ({...p, va:frVal(Lant[p.n])})).sort((a, b) => (a.v ?? 9) - (b.v ?? 9));
  const hacPozos = [...new Set(P.map(p => p.h))].sort();
  const leidos = conDato.length, secos = P.filter(p => p.raw === 'S').length;

  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">💧 Niveles freáticos · Mapa de isobatas</div>
      <div class="sim-subt">${P.length} pozos de observación · lecturas quincenales · interpolación IDW recortada a las suertes${F.archivo ? ` · fuente: ${esc(F.archivo)}` : ''}</div></div>
      <div class="fr-acc">${MODO_EDICION ? '<button type="button" class="mbtn" data-fr-act title="Lee otra vez el Excel de Documentos\\SIG\\LECTURA NIVEL FREATICO">🔄 Actualizar lecturas</button>' : ''}
      <button type="button" class="mbtn mbtn-ghost" data-fr-png title="Descargar el mapa como imagen">⬇ Descargar mapa</button></div></div>
    <div class="fr-fechas">
      <button type="button" class="mbtn mbtn-ghost" data-fr-mov="-1" ${i ? '' : 'disabled'} title="Lectura anterior">◀</button>
      <label class="fchip"><span>Lectura del</span><select id="fr-fecha" class="fsel on">${opF}</select></label>
      <button type="button" class="mbtn mbtn-ghost" data-fr-mov="1" ${i < fechas.length - 1 ? '' : 'disabled'} title="Lectura siguiente">▶</button>
      <span class="meta">${leidos} de ${P.length} pozos leídos${secos ? ` · ${secos} secos (> 2 m)` : ''}${ant ? ` · anterior: ${frFecha(ant)}` : ''}</span>
    </div>
    <div class="sim-kpis fr-kpis">
      <div class="sim-kpi"><div class="l">Nivel promedio pozos</div><div class="v">${frNum(prom)} m</div><div class="s">${FR_CLASES[frClase(prom)].n.toLowerCase()}</div></div>
      ${FR_CLASES.map((c, k) => `<div class="sim-kpi fr-k" style="--c:${c.c}"><div class="l">${c.n} <small>${c.r} m</small></div><div class="v">${frNum(R.clases[k], 0)} ha</div><div class="s">${frNum(pct(k), 1)}% ${dif(k)}</div></div>`).join('')}
    </div>
    <div class="fr-grid">
      <div class="sim-card abierta fr-mapa-card">
        <div class="fr-capas">
          ${[['pozos', 'Pozos'], ['suertes', 'Límites de suertes'], ['agua', 'Red hídrica'], ['etiquetas', 'Lecturas en el mapa']].map(([k, l]) => `<label><input type="checkbox" data-fr-capa="${k}" ${frE.capas[k] ? 'checked' : ''}> ${l}</label>`).join('')}
          <span class="fr-zoom"><button type="button" class="plegar-todo" data-fr-zoom="1.5" title="Acercar">＋</button><button type="button" class="plegar-todo" data-fr-zoom="0.667" title="Alejar">－</button>
          <button type="button" class="plegar-todo" data-fr-ajustar title="Ver todo el mapa">⤢ Ver todo</button></span>
        </div>
        <div class="fr-mapa" id="fr-mapa"><canvas id="fr-cv"></canvas><div class="fr-tip" id="fr-tip" hidden></div>
          <div class="fr-ley">${FR_CLASES.map(c => `<span><i style="background:${c.c}"></i>${c.r}</span>`).join('')}<span class="meta">m de profundidad</span></div></div>
        <div class="meta fr-ayuda">＋/－, Ctrl + rueda del ratón o dos dedos para acercar · arrastra para moverte · toca un pozo para ver su historia</div>
      </div>
      <div class="fr-lado">
        <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Área por intervalo</b> <span class="meta">· ${frFecha(frE.fecha)}</span></div>
          <div class="fr-dist">${frDona(R)}
          <table class="sim-t fr-tab"><thead><tr><th>Profundidad (m)</th><th class="n">Área (ha)</th><th class="n">%</th></tr></thead>
          <tbody>${FR_CLASES.map((c, k) => `<tr><td><span class="fr-sw" style="background:${c.c}"></span>${c.r}</td><td class="n b">${frNum(R.clases[k])}</td><td class="n">${frNum(pct(k), 1)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td><td class="n b">${frNum(R.total)}</td><td class="n">100</td></tr></tfoot></table></div></div>
        <div class="sim-card abierta" id="fr-pozo-card">${frPozoHTML(F)}</div>
      </div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Evolución del área por rango</b> <span class="meta">· % del área de las suertes en cada lectura (último año) · clic en una barra para verla</span></div>
      <div id="fr-evol" class="fr-evol"><div class="meta" style="padding:10px">Calculando…</div></div></div>
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Por hacienda</b> <span class="meta">· ordenadas de más a menos área crítica + subcrítica</span></div>
        <div class="fr-hacs">${hacs.map(x => `<div class="fr-hac" title="${esc(x.h)}: ${FR_CLASES.map((c, k) => `${c.n} ${frNum(x.c[k], 1)} ha`).join(' · ')}"><b>${esc(x.h)}</b>
          <div class="fr-bar">${x.c.map((v, k) => v ? `<div style="flex:${v};background:${FR_CLASES[k].c}"></div>` : '').join('')}</div>
          <span>${frNum((x.c[0] + x.c[1]) / x.t * 100, 0)}%</span></div>`).join('')}</div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Suertes en nivel crítico</b> <span class="meta">· promedio de la suerte &lt; 0,5 m</span></div>
        <div class="sim-tw" style="max-height:340px"><table class="sim-t"><thead><tr><th>Suerte</th><th>Hacienda</th><th class="n">Área (ha)</th><th class="n">Nivel (m)</th></tr></thead>
        <tbody>${criticas.map(s => `<tr data-fr-sue="${s.i}" style="cursor:pointer"><td class="lab" style="font-family:var(--mono)">${esc(s.cod)}</td><td>${esc(s.h)}</td><td class="n">${frNum(s.ha)}</td><td class="n b" style="color:var(--red)">${frNum(s.v)}</td></tr>`).join('') || '<tr><td colspan="4" class="nores">Ninguna suerte en nivel crítico 👍</td></tr>'}</tbody>
        ${criticas.length ? `<tfoot><tr><td colspan="2">${criticas.length} suertes</td><td class="n b">${frNum(sum(criticas, s => s.ha))}</td><td></td></tr></tfoot>` : ''}</table></div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Lecturas por pozo</b> <span class="meta">· de más superficial a más profundo · clic para ver su historia</span>
      <label class="fchip" style="margin-left:auto"><span>Hacienda</span><select id="fr-hac" class="fsel ${frE.hac ? 'on' : ''}"><option value="">Todas</option>${hacPozos.map(h => `<option ${h === frE.hac ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label></div>
      <div class="sim-tw" style="max-height:420px"><table class="sim-t"><thead><tr><th>Pozo</th><th>Hacienda</th><th>Sector</th><th>Zona</th><th class="n">${frFecha(frE.fecha, false)}</th><th class="n">${ant ? frFecha(ant, false) : 'Anterior'}</th><th class="n">Cambio</th><th>Estado</th></tr></thead>
      <tbody>${pozos.map(p => { const c = p.v != null ? FR_CLASES[frClase(p.v)] : null, d = p.v != null && p.va != null ? p.v - p.va : null;
        return `<tr data-fr-pozo="${p.n}" style="cursor:pointer" class="${frE.pozo === p.n ? 'fr-sel' : ''}"><td class="b">${p.n}</td><td>${esc(p.h)}</td><td>${esc(p.s)}</td><td>${esc(p.z)}</td>
        <td class="n b">${p.raw === 'S' ? 'Seco' : p.v != null ? frNum(p.v) : '<span class="meta">—</span>'}</td><td class="n">${p.va != null ? frNum(p.va) : '<span class="meta">—</span>'}</td>
        <td class="n">${d == null || Math.abs(d) < 0.005 ? '<span class="meta">—</span>' : `<span style="color:${d < 0 ? 'var(--red)' : 'var(--green)'}" title="${d < 0 ? 'El agua subió' : 'El agua bajó'}">${d < 0 ? '▲' : '▼'} ${frNum(Math.abs(d))}</span>`}</td>
        <td>${c ? `<span class="ag-est" style="--c:${c.c}">${c.n}</span>` : '<span class="meta">sin lectura</span>'}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  frMapaIniciar();
  frEvolucion(F, fechas);
}

// Torta de distribución (SVG)
function frDona(R){
  let a0 = -Math.PI / 2; const t = R.total || 1, r = 52, c = 60;
  const arcos = R.clases.map((v, k) => { const ang = v / t * Math.PI * 2; if (!v) return ''; const a1 = a0 + ang;
    const p = ang >= Math.PI * 2 - 1e-6 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="${FR_CLASES[k].c}"/>` :
      `<path d="M${c},${c} L${c + r * Math.cos(a0)},${c + r * Math.sin(a0)} A${r},${r} 0 ${ang > Math.PI ? 1 : 0} 1 ${c + r * Math.cos(a1)},${c + r * Math.sin(a1)} Z" fill="${FR_CLASES[k].c}"><title>${FR_CLASES[k].r} m: ${frNum(v / t * 100, 1)}%</title></path>`;
    const am = a0 + ang / 2; a0 = a1;
    return p + (v / t > 0.05 ? `<text x="${c + r * 0.62 * Math.cos(am)}" y="${c + r * 0.62 * Math.sin(am) + 3}" text-anchor="middle">${frNum(v / t * 100, 1)}%</text>` : ''); }).join('');
  return `<svg class="fr-dona" viewBox="0 0 120 120">${arcos}</svg>`;
}

// Historia de un pozo (gráfico de líneas con las franjas de colores)
function frPozoHTML(F){
  const p = frE.pozo != null && F.pozos.find(x => x[0] === frE.pozo);
  if (!p) return `<div class="sim-card-h" style="cursor:default"><b>Historia de un pozo</b></div><div class="meta" style="padding:12px">Toca un pozo en el mapa o en la tabla para ver cómo ha variado su nivel.</div>`;
  const fechas = frFechas(F), pts = fechas.map(f => ({f, raw:F.lecturas[f][p[0]], v:frVal(F.lecturas[f][p[0]])})).filter(x => x.v != null);
  const W = 340, H = 170, ml = 30, mr = 8, mt = 8, mb = 22;
  const t0 = Date.parse(fechas[0]), t1 = Date.parse(fechas[fechas.length - 1]) || t0 + 1;
  const X = f => ml + (Date.parse(f) - t0) / ((t1 - t0) || 1) * (W - ml - mr), Y = v => mt + v / 2 * (H - mt - mb);
  const bandas = FR_CLASES.map((c, k) => { const a = [0, 0.5, 1, 1.5][k], b = [0.5, 1, 1.5, 2][k]; return `<rect x="${ml}" y="${Y(a)}" width="${W - ml - mr}" height="${Y(b) - Y(a)}" fill="${c.c}" opacity=".18"/>`; }).join('');
  const linea = pts.map((x, k) => `${k ? 'L' : 'M'}${X(x.f).toFixed(1)},${Y(x.v).toFixed(1)}`).join('');
  const anios = [...new Set(fechas.map(f => f.slice(0, 4)))].map(a => { const x = X(`${a}-01-01`); return x >= ml ? `<line x1="${x}" x2="${x}" y1="${mt}" y2="${H - mb}" stroke="#94a3b8" stroke-dasharray="2 3"/><text x="${x + 2}" y="${H - 8}">${a}</text>` : ''; }).join('');
  const ult = pts[pts.length - 1], prom = pts.length ? sum(pts, x => x.v) / pts.length : 0;
  return `<div class="sim-card-h" style="cursor:default"><b>Pozo ${p[0]}</b> <span class="meta">· ${esc(p[3])} · sector ${esc(p[4])} · zona ${esc(p[5])}</span><button type="button" class="plegar-todo" data-fr-cerrar-pozo style="margin-left:auto">✕</button></div>
    <svg class="fr-hist" viewBox="0 0 ${W} ${H}">${bandas}${anios}
      ${[0, 0.5, 1, 1.5, 2].map(v => `<text x="${ml - 4}" y="${Y(v) + 3}" text-anchor="end">${frNum(v, 1)}</text>`).join('')}
      <path d="${linea}" fill="none" stroke="#0f172a" stroke-width="1.4"/>
      ${pts.map(x => `<circle cx="${X(x.f).toFixed(1)}" cy="${Y(x.v).toFixed(1)}" r="${x.f === frE.fecha ? 4 : 2}" fill="${FR_CLASES[frClase(x.v)].c}" stroke="#0f172a" stroke-width=".6"><title>${frFecha(x.f)}: ${x.raw === 'S' ? 'seco' : frNum(x.v) + ' m'}</title></circle>`).join('')}
    </svg>
    <div class="fr-pozo-dat"><span>Última: <b>${ult ? (ult.raw === 'S' ? 'seco' : frNum(ult.v) + ' m') : '—'}</b>${ult ? ` (${frFecha(ult.f)})` : ''}</span><span>Promedio: <b>${frNum(prom)} m</b></span><span>Mínimo: <b>${pts.length ? frNum(Math.min(...pts.map(x => x.v))) : '—'} m</b></span><span>${pts.length} lecturas</span></div>`;
}

// Evolución: % del área por rango en cada lectura del último año (IDW con malla más gruesa, por partes)
function frEvolucion(F, fechas){
  const ult = fechas[fechas.length - 1], desde = new Date(Date.parse(ult) - 365 * 864e5).toISOString().slice(0, 10);
  const lista = fechas.filter(f => f >= desde && Object.keys(F.lecturas[f]).length >= 50);
  const clave = lista.join(',') + '|' + (F.fechaArchivo || '');
  if (frE.evolFechas !== clave) { frE.evol = {}; frE.evolFechas = clave; }
  const dibujar = () => {
    const el = q('fr-evol'); if (!el) return;
    el.innerHTML = `<div class="fr-evol-cols">${lista.map(f => { const r = frE.evol[f]; if (!r) return `<div class="fr-ec"><div class="fr-ecb"></div><small>${frFecha(f, false)}</small></div>`;
      const t = r.total || 1;
      return `<button type="button" class="fr-ec ${f === frE.fecha ? 'on' : ''}" data-fr-ir="${f}" title="${frFecha(f)}: ${FR_CLASES.map((c, k) => `${c.n} ${frNum(r.clases[k] / t * 100, 1)}%`).join(' · ')}">
        <div class="fr-ecb">${[3, 2, 1, 0].map(k => `<div style="height:${r.clases[k] / t * 100}%;background:${FR_CLASES[k].c}"></div>`).join('')}</div>
        <b>${frNum((r.clases[0] + r.clases[1]) / t * 100, 0)}%</b><small>${frFecha(f, false)}</small></button>`; }).join('')}</div>
      <div class="meta" style="padding:0 10px 8px">El número sobre cada barra es el % del área en nivel crítico + subcrítico (menos de 1 m).</div>`;
    el.scrollLeft = el.scrollWidth;   // lo más reciente a la vista
  };
  dibujar();
  let k = 0;
  const paso = () => {
    if (vistaActual !== 'freat' || frE.evolFechas !== clave) return;
    while (k < lista.length && frE.evol[lista[k]]) k++;
    if (k >= lista.length) return dibujar();
    const f = lista[k];
    frE.evol[f] = frResumenRapido(F, f);
    if (k % 4 === 3) dibujar();
    setTimeout(paso, 0);
  };
  setTimeout(paso, 30);
}

// ── Mapa en canvas: raster del IDW + suertes + red hídrica + pozos, con zoom y arrastre ──
function frRaster(V){
  const G = frMalla(), cv = document.createElement('canvas'); cv.width = G.W; cv.height = G.H;
  const g = cv.getContext('2d'), img = g.createImageData(G.W, G.H), d = img.data;
  const rgb = FR_CLASES.map(c => [parseInt(c.c.slice(1, 3), 16), parseInt(c.c.slice(3, 5), 16), parseInt(c.c.slice(5, 7), 16)]);
  for (let i = 0; i < V.length; i++) { const v = V[i]; if (v !== v) continue; const k = G.idx[i] * 4, c = rgb[frClase(v)]; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; }
  g.putImageData(img, 0, 0);
  return cv;
}
function frMapaIniciar(){
  const caja = q('fr-mapa'), cv = q('fr-cv'); if (!caja || !cv) return;
  const F = freatico(), C = frCalculo(F, frE.fecha), M = MAPA_FREATICO;
  if (!C.raster) C.raster = frRaster(C.V);
  const dpr = window.devicePixelRatio || 1;
  const ancho = caja.clientWidth, alto = Math.min(Math.round(ancho * M.alto / M.ancho), Math.round(window.innerHeight * 0.78));
  cv.width = ancho * dpr; cv.height = alto * dpr; cv.style.height = alto + 'px';
  const ajustar = () => { const s = Math.min(ancho / M.ancho, alto / M.alto) * 0.96; frE.vista = {s, ox:(ancho - M.ancho * s) / 2, oy:(alto - M.alto * s) / 2, ancho, alto}; };
  if (!frE.vista || frE.vista.ancho !== ancho || frE.vista.alto !== alto) ajustar();
  frE.ajustar = () => { ajustar(); dibujar(); };
  const g = cv.getContext('2d');
  const sx = x => frE.vista.ox + x * frE.vista.s, sy = y => frE.vista.oy + (M.alto - y) * frE.vista.s;
  const linea = (r, cerrar) => { for (let k = 0; k < r.length; k += 2) { const x = sx(r[k]), y = sy(r[k + 1]); k ? g.lineTo(x, y) : g.moveTo(x, y); } if (cerrar) g.closePath(); };
  function dibujar(){
    const V = frE.vista;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#eef2f6'; g.fillRect(0, 0, ancho, alto);
    g.imageSmoothingEnabled = false;
    g.drawImage(C.raster, V.ox, V.oy, M.ancho * V.s * (C.raster.width * FR_CELDA / M.ancho), M.alto * V.s * (C.raster.height * FR_CELDA / M.alto));
    if (frE.capas.agua) {
      g.strokeStyle = '#2b7bd6'; g.lineWidth = 1.6; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke();
      g.strokeStyle = '#4f9ae8'; g.lineWidth = 0.9; g.beginPath(); M.canales.forEach(r => linea(r)); g.stroke();
      g.fillStyle = '#8ec5f5'; g.beginPath(); frMalla().agua.forEach(r => linea(r, true)); g.fill();
    }
    if (frE.capas.suertes) { g.strokeStyle = 'rgba(15,23,42,.55)'; g.lineWidth = V.s > 0.12 ? 0.8 : 0.45; g.beginPath(); M.suertes.forEach(s => s[3].forEach(r => linea(r, true))); g.stroke(); }
    if (frE.suerteSel != null) { const s = M.suertes[frE.suerteSel]; g.strokeStyle = '#0f172a'; g.lineWidth = 2.5; g.beginPath(); s[3].forEach(r => linea(r, true)); g.stroke(); }
    if (frE.capas.pozos) {
      const r = Math.max(3, Math.min(7, V.s * 25));
      C.P.forEach(p => {
        const x = sx(p.x), y = sy(p.y);
        g.beginPath(); g.arc(x, y, p.n === frE.pozo ? r + 3 : r, 0, Math.PI * 2);
        g.fillStyle = p.v == null ? '#fff' : FR_CLASES[frClase(p.v)].c; g.fill();
        g.lineWidth = p.n === frE.pozo ? 2.5 : 1.2; g.strokeStyle = p.v == null ? '#64748b' : '#0f172a'; g.stroke();
        if (frE.capas.etiquetas && p.v != null) { g.font = '600 10px system-ui,sans-serif'; g.lineWidth = 3; g.strokeStyle = '#fff'; const t = p.raw === 'S' ? 'S' : frNum(p.v); g.strokeText(t, x + r + 2, y + 3); g.fillStyle = '#0f172a'; g.fillText(t, x + r + 2, y + 3); }
      });
    }
    // Norte y escala
    g.fillStyle = '#0f172a'; g.font = '700 13px system-ui,sans-serif'; g.textAlign = 'center';
    g.beginPath(); g.moveTo(ancho - 24, 14); g.lineTo(ancho - 31, 34); g.lineTo(ancho - 24, 29); g.lineTo(ancho - 17, 34); g.closePath(); g.fill(); g.fillText('N', ancho - 24, 48);
    const km = [0.25, 0.5, 1, 2, 5].find(k => k * 1000 * V.s > 70) || 5, w = km * 1000 * V.s;
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(8, alto - 30, w + 44, 24);
    g.fillStyle = '#0f172a'; g.fillRect(14, alto - 16, w, 4); g.textAlign = 'left'; g.font = '600 11px system-ui,sans-serif'; g.fillText(`${km < 1 ? km * 1000 + ' m' : km + ' km'}`, w + 18, alto - 11);
    g.textAlign = 'start';
  }
  frE.dibujar = dibujar;
  dibujar();
  // Interacción
  const mundo = (px, py) => [(px - frE.vista.ox) / frE.vista.s, M.alto - (py - frE.vista.oy) / frE.vista.s];
  const zoom = (f, px, py) => { const V = frE.vista, ns = Math.max(0.02, Math.min(3, V.s * f)), k = ns / V.s; V.ox = px - (px - V.ox) * k; V.oy = py - (py - V.oy) * k; V.s = ns; dibujar(); };
  const pozoEn = (px, py) => { let mejor = null, d0 = 12 * 12; if (!frE.capas.pozos) return null; C.P.forEach(p => { const dx = frE.vista.ox + p.x * frE.vista.s - px, dy = frE.vista.oy + (M.alto - p.y) * frE.vista.s - py, d = dx * dx + dy * dy; if (d < d0) { d0 = d; mejor = p; } }); return mejor; };
  const suerteEn = (px, py) => { const G = frMalla(), [x, y] = mundo(px, py), gx = Math.floor(x / FR_CELDA), gy = Math.floor((M.alto - y) / FR_CELDA); if (gx < 0 || gy < 0 || gx >= G.W || gy >= G.H) return null; const c = G.celda[gy * G.W + gx]; return c < 0 ? null : c; };
  const tip = q('fr-tip');
  const mostrarTip = (px, py) => {
    const p = pozoEn(px, py); let h = '';
    if (p) h = `<b>Pozo ${p.n}</b> · ${esc(p.h)}<br>${p.raw === 'S' ? 'Seco (más de 2 m)' : p.v != null ? `Nivel: <b>${frNum(p.v)} m</b> · ${FR_CLASES[frClase(p.v)].n}` : 'Sin lectura en esta fecha'}`;
    else { const c = suerteEn(px, py); if (c != null) { const G = frMalla(), si = G.sue[c], s = M.suertes[si], R = C.R.suertes.find(x => x.i === si), v = C.V[c];
      h = `<b>${esc(s[0])}</b> · ${esc(s[1])} · ${frNum(s[2])} ha<br>Aquí: <b>${frNum(v)} m</b> (${FR_CLASES[frClase(v)].n})${R ? `<br>Promedio suerte: ${frNum(R.v)} m` : ''}`; } }
    if (!h) { tip.hidden = true; return; }
    tip.innerHTML = h; tip.hidden = false;
    const L = Math.min(px + 14, ancho - tip.offsetWidth - 4), T = py + 14 + tip.offsetHeight > alto ? py - tip.offsetHeight - 10 : py + 14;
    tip.style.left = Math.max(4, L) + 'px'; tip.style.top = T + 'px';
  };
  frE.zoom = f => zoom(f, ancho / 2, alto / 2);
  // Solo con Ctrl la rueda acerca; sin Ctrl la página baja normal
  cv.onwheel = e => { if (!e.ctrlKey) return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); };
  const toques = new Map(); let arrastre = null, movido = false, pinza = null;
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(); toques.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]); movido = false;
    if (toques.size === 1) arrastre = [e.clientX, e.clientY, frE.vista.ox, frE.vista.oy];
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinza = {d:Math.hypot(a[0] - b[0], a[1] - b[1]), s:frE.vista.s}; arrastre = null; } };
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (toques.has(e.pointerId)) toques.set(e.pointerId, [px, py]);
    if (pinza && toques.size === 2) { const [a, b] = [...toques.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom(pinza.s * d / pinza.d / frE.vista.s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); movido = true; return; }
    if (arrastre) { const dx = e.clientX - arrastre[0], dy = e.clientY - arrastre[1]; if (Math.abs(dx) + Math.abs(dy) > 4) movido = true; if (movido) { frE.vista.ox = arrastre[2] + dx; frE.vista.oy = arrastre[3] + dy; dibujar(); tip.hidden = true; } return; }
    if (e.pointerType === 'mouse') mostrarTip(px, py); };
  const soltar = e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    toques.delete(e.pointerId); if (toques.size < 2) pinza = null;
    if (arrastre && !movido && e.type === 'pointerup') {
      const p = pozoEn(px, py);
      if (p) { frE.pozo = p.n; q('fr-pozo-card').innerHTML = frPozoHTML(F); dibujar(); if (window.innerWidth < 900) q('fr-pozo-card').scrollIntoView({behavior:'smooth', block:'nearest'}); }
      else { const c = suerteEn(px, py); frE.suerteSel = c != null ? frMalla().sue[c] : null; dibujar(); }
      mostrarTip(px, py);
    }
    if (!toques.size) arrastre = null; };
  cv.onpointerup = soltar; cv.onpointercancel = soltar;
  cv.onpointerleave = e => { if (e.pointerType === 'mouse') tip.hidden = true; };
  cv.style.touchAction = 'none';
}

// Imagen para descargar: mapa completo + convenciones + tabla, al estilo del mapa de QGIS
function frDescargarPNG(){
  const F = freatico(), C = frCalculo(F, frE.fecha), M = MAPA_FREATICO, R = C.R;
  if (!C.raster) C.raster = frRaster(C.V);
  const W = 1600, mapH = Math.round((W - 80) * M.alto / M.ancho), H = mapH + 330;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const s = (W - 80) / M.ancho, ox = 40, oy = 40, sx = x => ox + x * s, sy = y => oy + (M.alto - y) * s;
  const linea = (r, cerrar) => { for (let k = 0; k < r.length; k += 2) { const x = sx(r[k]), y = sy(r[k + 1]); k ? g.lineTo(x, y) : g.moveTo(x, y); } if (cerrar) g.closePath(); };
  g.fillStyle = '#eef2f6'; g.fillRect(ox, oy, M.ancho * s, M.alto * s);
  g.imageSmoothingEnabled = false; g.drawImage(C.raster, ox, oy, C.raster.width * FR_CELDA * s, C.raster.height * FR_CELDA * s);
  g.strokeStyle = '#2b7bd6'; g.lineWidth = 2.2; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke();
  g.strokeStyle = '#4f9ae8'; g.lineWidth = 1.2; g.beginPath(); M.canales.forEach(r => linea(r)); g.stroke();
  g.fillStyle = '#8ec5f5'; g.beginPath(); frMalla().agua.forEach(r => linea(r, true)); g.fill();
  g.strokeStyle = 'rgba(15,23,42,.6)'; g.lineWidth = 0.6; g.beginPath(); M.suertes.forEach(x => x[3].forEach(r => linea(r, true))); g.stroke();
  g.strokeStyle = '#0f172a'; g.lineWidth = 2; g.strokeRect(ox, oy, M.ancho * s, M.alto * s);
  g.fillStyle = '#0f172a'; g.beginPath(); g.moveTo(W - 90, 70); g.lineTo(W - 104, 108); g.lineTo(W - 90, 98); g.lineTo(W - 76, 108); g.closePath(); g.fill();
  g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText('N', W - 90, 136);
  g.fillRect(60, oy + M.alto * s - 40, 2000 * s, 8); g.font = '600 18px Arial'; g.textAlign = 'left'; g.fillText('2 km', 70 + 2000 * s, oy + M.alto * s - 30);
  // Pie: convenciones, tabla y título
  const y0 = mapH + 70;
  g.fillStyle = '#0f172a'; g.font = '700 22px Arial'; g.fillText('Profundidad nivel freático (m)', 40, y0);
  FR_CLASES.forEach((c, k) => { g.fillStyle = c.c; g.fillRect(40, y0 + 20 + k * 38, 40, 26); g.strokeStyle = '#0f172a'; g.lineWidth = 1; g.strokeRect(40, y0 + 20 + k * 38, 40, 26);
    g.fillStyle = '#0f172a'; g.font = '20px Arial'; g.fillText(`${c.r}   ${c.n}`, 92, y0 + 40 + k * 38);
    g.textAlign = 'right'; g.font = '700 20px Arial'; g.fillText(`${frNum(R.clases[k])} ha`, 640, y0 + 40 + k * 38); g.font = '20px Arial'; g.fillText(`${frNum(R.clases[k] / (R.total || 1) * 100, 1)}%`, 740, y0 + 40 + k * 38); g.textAlign = 'left'; });
  g.font = '700 20px Arial'; g.fillText('TOTAL', 92, y0 + 192); g.textAlign = 'right'; g.fillText(`${frNum(R.total)} ha`, 640, y0 + 192); g.textAlign = 'left';
  g.font = '700 30px Arial'; g.fillText(`MAPA DE ISÓBATAS · ${frFecha(frE.fecha).toUpperCase()}`, 800, y0 + 10);
  g.font = '20px Arial'; g.fillStyle = '#334155';
  g.fillText('Riopaila Agrícola S.A. · Área de Ingeniería Agrícola', 800, y0 + 50);
  g.fillText(`Interpolación IDW (potencia 2) con ${C.P.filter(p => p.v != null).length} pozos de observación`, 800, y0 + 84);
  g.fillText('Recortado a las suertes · MAGNA-SIRGAS Colombia Oeste', 800, y0 + 118);
  const a = document.createElement('a'); a.download = `Isobatas_${frE.fecha}.png`; a.href = cv.toDataURL('image/png'); a.click();
}

// ── Lecturas desde el servidor (solo editor, en este PC) ──
let frRevisado = false;
function frRevisarServidor(){
  if (frRevisado) return; frRevisado = true;
  fetch(API_BASE + 'api/freatico?info=1', {cache:'no-store', headers:{'X-Comite':'1'}}).then(r => r.ok ? r.json() : null).then(info => {
    const F = freatico();
    if (info && info.ok && (!F || F.archivo !== info.archivo || F.fechaArchivo !== info.fecha)) frActualizar(true);
  }).catch(() => {});
}
function frActualizar(auto){
  if (!auto) toast('⏳ Leyendo el Excel de niveles freáticos…');
  return fetch(API_BASE + 'api/freatico', {cache:'no-store', headers:{'X-Comite':'1'}}).then(r => r.json()).then(d => {
    if (!d || !d.pozos) throw new Error(d && d.error || 'Respuesta no válida');
    const antes = freatico(), nAntes = antes ? frFechas(antes).length : 0;
    modCambio(() => { DB.freatico = d; });
    frE.cache = {}; frE.evol = {}; frE.evolFechas = '';
    const n = frFechas(d).length, ult = frFechas(d).pop();
    frE.fecha = ult;
    toast(`💧 ${d.pozos.length} pozos · ${n} lecturas (última ${frFecha(ult)})${n > nAntes && nAntes ? ` · ${n - nAntes} nuevas` : ''} · recuerda 🚀 Publicar`);
  }).catch(e => { if (!auto) toast('⚠ No se pudo leer el Excel: ' + (e.message || 'servidor apagado')); });
}

q('freaticos').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-fr-act]')) { frActualizar(false); return; }
  if (t.closest('[data-fr-png]')) { frDescargarPNG(); return; }
  const z = t.closest('[data-fr-zoom]'); if (z) { frE.zoom && frE.zoom(+z.dataset.frZoom); return; }
  if (t.closest('[data-fr-ajustar]')) { frE.suerteSel = null; frE.ajustar && frE.ajustar(); return; }
  if (t.closest('[data-fr-cerrar-pozo]')) { frE.pozo = null; q('fr-pozo-card').innerHTML = frPozoHTML(freatico()); frE.dibujar && frE.dibujar(); return; }
  const m = t.closest('[data-fr-mov]'); if (m) { const f = frFechas(freatico()), i = f.indexOf(frE.fecha) + +m.dataset.frMov; if (f[i]) { frE.fecha = f[i]; renderFreatico(); } return; }
  const ir = t.closest('[data-fr-ir]'); if (ir) { frE.fecha = ir.dataset.frIr; renderFreatico(); return; }
  const p = t.closest('[data-fr-pozo]'); if (p) { frE.pozo = +p.dataset.frPozo; q('fr-pozo-card').innerHTML = frPozoHTML(freatico()); frE.dibujar && frE.dibujar(); q('fr-pozo-card').scrollIntoView({behavior:'smooth', block:'nearest'}); return; }
  const s = t.closest('[data-fr-sue]'); if (s) { frE.suerteSel = +s.dataset.frSue; frE.dibujar && frE.dibujar(); q('fr-mapa').scrollIntoView({behavior:'smooth', block:'center'}); }
});
q('freaticos').addEventListener('change', e => {
  if (e.target.id === 'fr-fecha') { frE.fecha = e.target.value; renderFreatico(); }
  else if (e.target.id === 'fr-hac') { frE.hac = e.target.value; renderFreatico(); }
  else if (e.target.dataset.frCapa) { frE.capas[e.target.dataset.frCapa] = e.target.checked; frE.dibujar && frE.dibujar(); }
});
let frRedim = 0;
window.addEventListener('resize', () => { clearTimeout(frRedim); frRedim = setTimeout(() => { if (vistaActual === 'freat' && q('fr-mapa')) frMapaIniciar(); }, 200); });
// Este script carga después de portal.js: si la página abrió en #freaticos o en la portada, redibujar
if (vistaActual === 'freat' || vistaActual === 'portal') renderVista();
