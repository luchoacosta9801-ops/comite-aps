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
// ok (opcional): suertes que entran (filtro de zona / hacienda)
function frResumen(V, ok = null){
  const G = frMalla(), M = MAPA_FREATICO, nS = M.suertes.length;
  const clases = [0, 0, 0, 0], hac = {}, suma = new Float64Array(nS), cnt = new Int32Array(nS), porCl = new Int32Array(nS * 4);
  for (let i = 0; i < V.length; i++) {
    const v = V[i]; if (v !== v) continue;
    const s = G.sue[i]; if (ok && !ok[s]) continue;
    porCl[s * 4 + frClase(v)]++; suma[s] += v; cnt[s]++;
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
// f: filtros (z zonas, h haciendas de la cartografía, a años, m meses); modo 'una' lectura o 'comp' comparar varias (sel)
const frE = {fecha:'', capas:{pozos:true, suertes:true, agua:true, etiquetas:false}, pozo:null, vista:null, cache:{}, evol:{}, evolV:{}, evolFechas:'',
  f:{z:[], h:[], a:[], m:[]}, modo:'una', sel:[]};
function frCalculo(F, fecha){
  if (frE.cache[fecha]) return frE.cache[fecha];
  const P = frPuntos(F, fecha), V = frIDW(P), R = frResumen(V);
  return frE.cache[fecha] = {P, V, R, rf:{}, rasters:{}};
}
// Resumen de una lectura con el filtro de zona/hacienda puesto
function frRes(F, fecha){
  const C = frCalculo(F, fecha), ok = frOK(); if (!ok) return C.R;
  const k = frFiltroClave(); return C.rf[k] = C.rf[k] || frResumen(C.V, ok);
}
// Resumen con malla gruesa (1 de cada 3x3 celdas): para la evolución y la comparación con la lectura anterior
function frResumenRapido(F, fecha){
  if (frE.cache[fecha]) return frRes(F, fecha);
  const k = fecha + '|' + frFiltroClave();
  if (!frE.evol[k]) { const V = frE.evolV[fecha] = frE.evolV[fecha] || frIDW(frPuntos(F, fecha), 3); frE.evol[k] = frResumen(V, frOK()); }
  return frE.evol[k];
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
    cont.innerHTML = `<div class="mod-top"><div class="sim-tit">💧 Niveles freáticos</div></div>${frFuenteHTML()}<div class="nores">Aún no hay lecturas cargadas.${MODO_EDICION ? ' Pon el Excel en <b>Documentos\\SIG\\LECTURA NIVEL FREATICO</b> y pulsa <b>📥 Cargar último Excel</b>.' : ''}</div>`;
    return;
  }
  if (typeof MAPA_FREATICO === 'undefined') {
    cont.innerHTML = `<div class="mod-top"><div class="sim-tit">💧 Niveles freáticos</div></div><div class="nores">Cargando cartografía…</div>`;
    frCargarMapa().then(() => vistaActual === 'freat' && renderFreatico()).catch(() => { cont.querySelector('.nores').textContent = '⚠ No se pudo cargar la cartografía. Revisa la conexión y vuelve a abrir.'; });
    return;
  }
  const fechas = frFechas(F);
  // Comparar varias lecturas: lo arma js/freatico-comp.js
  if (frE.modo === 'comp') { frRenderComparativo(cont, F); return; }
  const fechasF = frFechasF(F).length ? frFechasF(F) : fechas;   // con el filtro de año / mes
  if (!fechasF.includes(frE.fecha)) frE.fecha = fechasF[fechasF.length - 1];
  const i = fechasF.indexOf(frE.fecha), ant = fechas[fechas.indexOf(frE.fecha) - 1];
  // La interpolación tarda ~1 s: primero un aviso y luego el cálculo
  if (!frE.cache[frE.fecha]) {
    if (!cont.querySelector('.fr-calc')) cont.insertAdjacentHTML('afterbegin', '<div class="fr-calc">⏳ Calculando el mapa de isobatas…</div>');
    setTimeout(() => { frCalculo(F, frE.fecha); if (vistaActual === 'freat') renderFreatico(); }, 30);
    return;
  }
  const P = frCalculo(F, frE.fecha).P.filter(frPozoOK), R = frRes(F, frE.fecha);
  const Ra = ant ? frResumenRapido(F, ant) : null;
  const conDato = P.filter(p => p.v != null), prom = conDato.length ? sum(conDato, p => p.v) / conDato.length : 0;
  const tot = R.total || 1, pct = c => R.clases[c] / tot * 100;
  const opF = fechasF.slice().reverse().map(f => `<option value="${f}" ${f === frE.fecha ? 'selected' : ''}>${frFecha(f)}</option>`).join('');
  // Cambio vs la lectura anterior (la anterior puede venir de la malla gruesa: se compara en % del área)
  const dif = (c) => { if (!Ra || !Ra.total) return ''; const d = R.clases[c] - Ra.clases[c] / Ra.total * R.total; if (Math.abs(d) < 0.5) return '<span class="meta">= igual</span>'; const malo = c < 2 ? d > 0 : d < 0; return `<span style="color:${malo ? 'var(--red)' : 'var(--green)'}">${d > 0 ? '▲' : '▼'} ${frNum(Math.abs(d), 0)} ha</span>`; };
  const hacs = Object.entries(R.hac).map(([h, c]) => ({h, c, t:c.reduce((a, b) => a + b, 0)})).sort((a, b) => (b.c[0] + b.c[1]) / b.t - (a.c[0] + a.c[1]) / a.t);
  const criticas = R.suertes.filter(s => s.v < 0.5).sort((a, b) => a.v - b.v);
  // Pozos: lectura actual vs anterior
  const Lant = ant ? F.lecturas[ant] : {};
  const pozos = P.map(p => ({...p, va:frVal(Lant[p.n])})).sort((a, b) => (a.v ?? 9) - (b.v ?? 9));
  const leidos = conDato.length, secos = P.filter(p => p.raw === 'S').length;
  const ll = frLluvia15(frE.fecha, frHacsFiltro());

  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">💧 Niveles freáticos · Mapa de isobatas</div>
      <div class="sim-subt">${esc(frAlcanceTxt())} · ${P.length} pozos de observación · lecturas quincenales · interpolación IDW recortada a las suertes</div></div>
      <div class="fr-acc"><button type="button" class="mbtn mbtn-ghost" data-fr-cosecha title="Cruzar suertes cosechadas con los niveles freáticos">🌾 Cosecha vs niveles</button>
        <button type="button" class="mbtn mbtn-ghost" data-fr-png title="Descargar el mapa como imagen">⬇ Descargar mapa</button></div></div>
    ${frFuenteHTML()}
    ${frFiltrosHTML(F)}
    <div class="fr-fechas">
      <button type="button" class="mbtn mbtn-ghost" data-fr-mov="-1" ${i ? '' : 'disabled'} title="Lectura anterior">◀</button>
      <label class="fchip"><span>Lectura del</span><select id="fr-fecha" class="fsel on">${opF}</select></label>
      <button type="button" class="mbtn mbtn-ghost" data-fr-mov="1" ${i < fechasF.length - 1 ? '' : 'disabled'} title="Lectura siguiente">▶</button>
      <span class="meta">${leidos} de ${P.length} pozos leídos${secos ? ` · ${secos} secos (> 2 m)` : ''}${ant ? ` · anterior: ${frFecha(ant)}` : ''}${ll != null ? ` · <b class="fr-llv">💧 ${frNum(ll, 0)} mm</b> de lluvia en los 15 días previos` : ''}</span>
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
        <div class="fr-inf"><button type="button" class="mbtn" data-fr-informe>📄 Generar informe de isóbatas · ${frFecha(frE.fecha)}</button>
          <span class="meta">Informe con objetivo, metodología, mapa, áreas por condición, ${frLluvias() ? 'lluvias, ' : ''}análisis, pozos críticos y conclusiones${frFiltroClave() ? ` (solo ${esc(frAlcanceTxt())})` : ''}, listo para imprimir o guardar en PDF</span></div>
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
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Evolución del área por rango</b> <span class="meta">· % del área en cada lectura (${frE.f.a.length || frE.f.m.length ? 'lecturas del filtro de año / mes' : 'último año'}) · clic en una barra para verla</span></div>
      <div id="fr-evol" class="fr-evol"><div class="meta" style="padding:10px">Calculando…</div></div></div>
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Por hacienda</b> <span class="meta">· ordenadas de más a menos área crítica + subcrítica</span></div>
        <div class="fr-hacs">${hacs.map(x => `<div class="fr-hac" title="${esc(x.h)}: ${FR_CLASES.map((c, k) => `${c.n} ${frNum(x.c[k], 1)} ha`).join(' · ')}"><b>${esc(frNomHac(x.h))}</b>
          <div class="fr-bar">${x.c.map((v, k) => v ? `<div style="flex:${v};background:${FR_CLASES[k].c}"></div>` : '').join('')}</div>
          <span>${frNum((x.c[0] + x.c[1]) / x.t * 100, 0)}%</span></div>`).join('')}</div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Suertes en nivel crítico</b> <span class="meta">· promedio de la suerte &lt; 0,5 m</span></div>
        <div class="sim-tw" style="max-height:340px"><table class="sim-t"><thead><tr><th>Suerte</th><th>Hacienda</th><th class="n">Área (ha)</th><th class="n">Nivel (m)</th></tr></thead>
        <tbody>${criticas.map(s => `<tr data-fr-sue="${s.i}" style="cursor:pointer"><td class="lab" style="font-family:var(--mono)">${esc(s.cod)}</td><td>${esc(frNomHac(s.h))}</td><td class="n">${frNum(s.ha)}</td><td class="n b" style="color:var(--red)">${frNum(s.v)}</td></tr>`).join('') || '<tr><td colspan="4" class="nores">Ninguna suerte en nivel crítico 👍</td></tr>'}</tbody>
        ${criticas.length ? `<tfoot><tr><td colspan="2">${criticas.length} suertes</td><td class="n b">${frNum(sum(criticas, s => s.ha))}</td><td></td></tr></tfoot>` : ''}</table></div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Lecturas por pozo</b> <span class="meta">· ${esc(frAlcanceTxt())} · de más superficial a más profundo · clic para ver su historia</span></div>
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
// Lecturas que muestra la evolución: las del filtro de año/mes (hasta 40) o, sin filtro, las del último año
function frFechasEvol(F, fechas){
  const f = frE.f;
  if (f.a.length || f.m.length) return frFechasF(F).slice(-40);
  const ult = fechas[fechas.length - 1], desde = new Date(Date.parse(ult) - 365 * 864e5).toISOString().slice(0, 10);
  return fechas.filter(x => x >= desde && Object.keys(F.lecturas[x]).length >= 50);
}
function frEvolucion(F, fechas){
  const lista = frFechasEvol(F, fechas), fk = frFiltroClave();
  const clave = lista.join(',') + '|' + (F.fechaArchivo || '') + '|' + fk;
  frE.evolFechas = clave;
  const listo = f => frE.cache[f] || frE.evol[f + '|' + fk];
  const ok = frOK(), hacsLl = frHacsFiltro();
  const dibujar = () => {
    const el = q('fr-evol'); if (!el) return;
    el.innerHTML = `<div class="fr-evol-cols">${lista.map(f => { if (!listo(f)) return `<div class="fr-ec"><div class="fr-ecb"></div><small>${frFecha(f, false)}</small></div>`;
      const r = frResumenRapido(F, f), t = r.total || 1, ll = frLluvia15(f, hacsLl);
      return `<button type="button" class="fr-ec ${f === frE.fecha ? 'on' : ''}" data-fr-ir="${f}" title="${frFecha(f)}: ${FR_CLASES.map((c, k) => `${c.n} ${frNum(r.clases[k] / t * 100, 1)}%`).join(' · ')}${ll != null ? ` · lluvia 15 días previos: ${frNum(ll, 0)} mm` : ''}">
        <div class="fr-ecb">${[3, 2, 1, 0].map(k => `<div style="height:${r.clases[k] / t * 100}%;background:${FR_CLASES[k].c}"></div>`).join('')}</div>
        <b>${frNum((r.clases[0] + r.clases[1]) / t * 100, 0)}%</b><small>${frFecha(f, lista.some(x => x.slice(0, 4) !== f.slice(0, 4)) ? true : false).replace(/ (\d{2})(\d{2})$/, " '$2")}</small>${ll != null ? `<i class="fr-ll" title="Lluvia de los 15 días previos">💧${frNum(ll, 0)}</i>` : ''}</button>`; }).join('') || '<div class="meta" style="padding:10px">No hay lecturas con ese filtro de año / mes.</div>'}</div>
      <div class="meta" style="padding:0 10px 8px">El número sobre cada barra es el % del área en nivel crítico + subcrítico (menos de 1 m)${frLluvias() ? '; 💧 = lluvia acumulada de los 15 días previos (mm)' : ''}.</div>`;
    el.scrollLeft = el.scrollWidth;   // lo más reciente a la vista
  };
  dibujar();
  let k = 0;
  const paso = () => {
    if (vistaActual !== 'freat' || frE.evolFechas !== clave) return;
    while (k < lista.length && listo(lista[k])) k++;
    if (k >= lista.length) return dibujar();
    frResumenRapido(F, lista[k]);
    if (k % 4 === 3) dibujar();
    setTimeout(paso, 0);
  };
  setTimeout(paso, 30);
}

// ── Mapa en canvas: raster del IDW + suertes + red hídrica + pozos, con zoom y arrastre ──
// Raster del IDW; con filtro, las suertes que no entran quedan en gris
function frRaster(V, ok = null){
  const G = frMalla(), cv = document.createElement('canvas'); cv.width = G.W; cv.height = G.H;
  const g = cv.getContext('2d'), img = g.createImageData(G.W, G.H), d = img.data;
  const rgb = FR_CLASES.map(c => [parseInt(c.c.slice(1, 3), 16), parseInt(c.c.slice(3, 5), 16), parseInt(c.c.slice(5, 7), 16)]);
  for (let i = 0; i < V.length; i++) { const v = V[i]; if (v !== v) continue; const k = G.idx[i] * 4, c = ok && !ok[G.sue[i]] ? [214, 219, 226] : rgb[frClase(v)]; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; }
  g.putImageData(img, 0, 0);
  return cv;
}
// Raster de una lectura con el filtro actual (se guarda por filtro)
function frRasterDe(C){ const k = frFiltroClave(); return C.rasters[k] = C.rasters[k] || frRaster(C.V, frOK()); }
function frMapaIniciar(){
  const caja = q('fr-mapa'), cv = q('fr-cv'); if (!caja || !cv) return;
  const F = freatico(), C = frCalculo(F, frE.fecha), M = MAPA_FREATICO;
  const raster = frRasterDe(C);
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
    g.drawImage(raster, V.ox, V.oy, raster.width * FR_CELDA * V.s, raster.height * FR_CELDA * V.s);
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

// Plano completo en un canvas (para la imagen descargable y el informe). Con pozos: puntos y número de los críticos.
function frPlano(C, W, pieH = 0, conPozos = false){
  const M = MAPA_FREATICO;
  const raster = frRasterDe(C);
  const mapH = Math.round((W - 80) * M.alto / M.ancho), H = mapH + 80 + pieH;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const s = (W - 80) / M.ancho, ox = 40, oy = 40, sx = x => ox + x * s, sy = y => oy + (M.alto - y) * s, k = W / 1600;
  const linea = (r, cerrar) => { for (let i = 0; i < r.length; i += 2) { const x = sx(r[i]), y = sy(r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } if (cerrar) g.closePath(); };
  g.fillStyle = '#eef2f6'; g.fillRect(ox, oy, M.ancho * s, M.alto * s);
  g.imageSmoothingEnabled = false; g.drawImage(raster, ox, oy, raster.width * FR_CELDA * s, raster.height * FR_CELDA * s);
  g.strokeStyle = '#2b7bd6'; g.lineWidth = 2.2 * k; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke();
  g.strokeStyle = '#4f9ae8'; g.lineWidth = 1.2 * k; g.beginPath(); M.canales.forEach(r => linea(r)); g.stroke();
  g.fillStyle = '#8ec5f5'; g.beginPath(); frMalla().agua.forEach(r => linea(r, true)); g.fill();
  g.strokeStyle = 'rgba(15,23,42,.6)'; g.lineWidth = 0.6 * k; g.beginPath(); M.suertes.forEach(x => x[3].forEach(r => linea(r, true))); g.stroke();
  if (conPozos) C.P.forEach(p => {
    if (p.v == null || !frPozoOK(p)) return;
    const x = sx(p.x), y = sy(p.y), cr = p.v < 0.5;
    g.beginPath(); g.arc(x, y, (cr ? 7 : 4) * k, 0, Math.PI * 2); g.fillStyle = FR_CLASES[frClase(p.v)].c; g.fill(); g.lineWidth = 1.2 * k; g.strokeStyle = '#0f172a'; g.stroke();
    if (cr) { g.font = `700 ${16 * k}px Arial`; g.lineWidth = 4 * k; g.strokeStyle = '#fff'; g.strokeText(p.n, x + 9 * k, y + 5 * k); g.fillStyle = '#0f172a'; g.fillText(p.n, x + 9 * k, y + 5 * k); }
  });
  g.strokeStyle = '#0f172a'; g.lineWidth = 2 * k; g.strokeRect(ox, oy, M.ancho * s, M.alto * s);
  g.fillStyle = '#0f172a'; g.beginPath(); g.moveTo(W - 90 * k, 70 * k); g.lineTo(W - 104 * k, 108 * k); g.lineTo(W - 90 * k, 98 * k); g.lineTo(W - 76 * k, 108 * k); g.closePath(); g.fill();
  g.font = `700 ${26 * k}px Arial`; g.textAlign = 'center'; g.fillText('N', W - 90 * k, 136 * k);
  g.fillRect(60, oy + M.alto * s - 40 * k, 2000 * s, 8 * k); g.font = `600 ${18 * k}px Arial`; g.textAlign = 'left'; g.fillText('2 km', 70 + 2000 * s, oy + M.alto * s - 30 * k);
  return {cv, g, mapH};
}
// Imagen para descargar: mapa completo + convenciones + tabla, al estilo del mapa de QGIS
function frDescargarPNG(){
  const F = freatico(), C = frCalculo(F, frE.fecha), R = frRes(F, frE.fecha);
  const {cv, g, mapH} = frPlano(C, 1600, 250);
  const y0 = mapH + 70;
  g.fillStyle = '#0f172a'; g.font = '700 22px Arial'; g.fillText('Profundidad nivel freático (m)', 40, y0);
  FR_CLASES.forEach((c, k) => { g.fillStyle = c.c; g.fillRect(40, y0 + 20 + k * 38, 40, 26); g.strokeStyle = '#0f172a'; g.lineWidth = 1; g.strokeRect(40, y0 + 20 + k * 38, 40, 26);
    g.fillStyle = '#0f172a'; g.font = '20px Arial'; g.fillText(`${c.r}   ${c.n}`, 92, y0 + 40 + k * 38);
    g.textAlign = 'right'; g.font = '700 20px Arial'; g.fillText(`${frNum(R.clases[k])} ha`, 640, y0 + 40 + k * 38); g.font = '20px Arial'; g.fillText(`${frNum(R.clases[k] / (R.total || 1) * 100, 1)}%`, 740, y0 + 40 + k * 38); g.textAlign = 'left'; });
  g.font = '700 20px Arial'; g.fillText('TOTAL', 92, y0 + 192); g.textAlign = 'right'; g.fillText(`${frNum(R.total)} ha`, 640, y0 + 192); g.textAlign = 'left';
  g.font = '700 30px Arial'; g.fillText(`MAPA DE ISÓBATAS · ${frFecha(frE.fecha).toUpperCase()}`, 800, y0 + 10);
  g.font = '20px Arial'; g.fillStyle = '#334155';
  g.fillText('Riopaila Agrícola S.A. · Área de Ingeniería Agrícola', 800, y0 + 50);
  g.fillText(`Interpolación IDW (potencia 2,75) con ${C.P.filter(p => p.v != null).length} pozos de observación`, 800, y0 + 84);
  g.fillText('Recortado a las suertes · MAGNA-SIRGAS Colombia Oeste', 800, y0 + 118);
  const a = document.createElement('a'); a.download = `Isobatas_${frE.fecha}.png`; a.href = cv.toDataURL('image/png'); a.click();
}

// ── Informe de isóbatas (como el informe del área): se arma con la lectura del plano que se está viendo ──
// Abre una página aparte, lista para imprimir o guardar en PDF. Los textos se pueden corregir allí mismo y las
// partes que la plataforma no conoce (lluvias, riego, observaciones de campo) quedan como espacios para escribir.
const FR_INF = [
  {n:'Crítico',    d:'Existe una saturación total del suelo.',                 col:'Rojo'},
  {n:'Subcrítico', d:'El suelo se encuentra muy húmedo.',                      col:'Naranja'},
  {n:'Regular',    d:'El agua se encuentra disponible para raíces profundas.', col:'Amarillo'},
  {n:'Normal',     d:'Profundidad óptima.',                                    col:'Verde'},
];
const frMesL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const frFechaL = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? `${+m[3]} de ${frMesL[+m[2] - 1]} de ${m[1]}` : '—'; };
const frFechaCorta = f => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || ''); return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}` : ''; };
// Mini gráfico de la historia de un pozo hasta la fecha del informe (últimas 10 lecturas)
function frMiniHist(F, n, hasta){
  const fe = frFechas(F).filter(f => f <= hasta), pts = fe.map(f => ({f, raw:F.lecturas[f][n], v:frVal(F.lecturas[f][n])})).filter(x => x.v != null).slice(-10);
  if (pts.length < 2) return '';
  const W = 300, H = 120, ml = 28, mr = 8, mt = 8, mb = 20, X = i => ml + i / (pts.length - 1) * (W - ml - mr), Y = v => mt + v / 2 * (H - mt - mb);
  return `<svg viewBox="0 0 ${W} ${H}" class="mini">${FR_CLASES.map((c, k) => `<rect x="${ml}" y="${Y(k / 2)}" width="${W - ml - mr}" height="${Y(0.5) - Y(0)}" fill="${c.c}" opacity=".2"/>`).join('')}
    ${[0, 1, 2].map(v => `<text x="${ml - 4}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
    <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join('')}" fill="none" stroke="#0f172a" stroke-width="1.5"/>
    ${pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${p.f === hasta ? 4.5 : 3}" fill="${FR_CLASES[frClase(p.v)].c}" stroke="#0f172a" stroke-width=".7"/>
      ${i % 2 === pts.length % 2 || p.f === hasta ? `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${frFecha(p.f, false)}</text>` : ''}`).join('')}</svg>`;
}
// Estilos de los informes (isóbatas, comparativo y cosecha): hoja carta, títulos en píldora, textos editables
const FR_INF_CSS = `
  @page{size:letter;margin:20mm 22mm 26mm;@bottom-right{content:counter(page);font:10pt Arial}}
  @page:first{margin:0;@bottom-right{content:none}}
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;background:#e5e7eb;font-size:11.5pt;line-height:1.55}
  .hoja{background:#fff;width:216mm;min-height:279mm;margin:12px auto;padding:20mm 22mm 26mm;position:relative;box-shadow:0 2px 12px rgba(0,0,0,.15)}
  .pie{position:absolute;left:22mm;right:22mm;bottom:10mm;display:flex;justify-content:space-between;align-items:flex-end}
  .pie img{height:13mm}
  .portada{padding:0;overflow:hidden;color:#0f172a}
  .portada .foto{position:absolute;inset:0;background:#1e3a5f center/cover no-repeat}
  .portada .velo{position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,.15),rgba(255,255,255,0) 60%)}
  .portada .caja{position:absolute;left:18mm;top:40mm;display:flex;flex-direction:column;gap:12mm}
  .portada .logo{display:flex;align-items:center;gap:5mm;background:rgba(255,255,255,.85);padding:4mm 6mm;border-radius:6mm;width:max-content}
  .portada .logo img{height:22mm}
  .pill{background:rgba(226,232,240,.92);border-radius:8mm;padding:4mm 8mm;width:max-content;max-width:110mm}
  .pill.t{font-size:22pt;font-weight:600}
  .pill.s{font-size:12pt;font-weight:600;line-height:1.5}
  h2{display:inline-block;background:linear-gradient(90deg,#dfe5ec,#9db2c7);border-radius:0 6mm 6mm 6mm;padding:2.5mm 9mm 2.5mm 7mm;font-size:14pt;margin:4mm 0 5mm -4mm}
  h4{margin:0 0 1mm;font-size:11.5pt}
  p{text-align:justify;margin:0 0 3.5mm}
  table{border-collapse:collapse;margin:3mm auto 5mm;font-size:10.5pt}
  th,td{border:1px solid #333;padding:1.5mm 3mm;text-align:center}
  th{background:#a8c8ec}
  .cap{font-size:11pt}
  .plano{display:block;max-width:100%;max-height:165mm;margin:2mm auto;border:1px solid #cbd5e1}
  .ley{display:flex;gap:6mm;justify-content:center;font-size:9.5pt;margin-bottom:3mm}
  .ley i{display:inline-block;width:5mm;height:3.5mm;border:1px solid #333;margin-right:1.5mm;vertical-align:-0.5mm}
  .pozo{display:grid;grid-template-columns:1fr 78mm;gap:5mm;align-items:start;border-top:1px solid #e2e8f0;padding:3mm 0;break-inside:avoid}
  .mini{width:100%}.mini text{font-size:8.5px;fill:#475569}
  ul.c{padding-left:5mm}ul.c li{margin-bottom:3mm;text-align:justify}
  .ed{outline:none;border-radius:2mm;transition:background .2s}
  .ed:hover,.ed:focus{background:#fef9c3}
  .ed.vacio:empty::before{content:attr(data-ph);color:#94a3b8;font-style:italic}
  .barra{position:sticky;top:0;z-index:5;background:#0f172a;color:#fff;padding:8px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px}
  .barra button{background:#0369a1;color:#fff;border:0;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer;font-size:13px}
  td.c0{background:#ff0000;color:#fff}td.c1{background:#ffc000}td.c2{background:#ffff00}td.c3{background:#92d050}
  .logo-pie{display:none}
  @media print{body{background:#fff}.barra{display:none}.hoja{margin:0;box-shadow:none;width:auto;min-height:auto;padding:0;page-break-after:always}
    .pie{display:none}.logo-pie{display:block;position:fixed;left:0;bottom:-18mm;height:12mm}
    .portada{width:216mm;height:279mm;page-break-after:always;position:relative;z-index:2;background:#fff}.ed.vacio:empty{display:none}}
`;
function frInforme(){
  const F = freatico(); if (!F) return;
  const fe = frFechas(F), fecha = frE.fecha, i = fe.indexOf(fecha), ant = fe[i - 1];
  const C = frCalculo(F, fecha), R = frRes(F, fecha), Ra = ant ? frResumenRapido(F, ant) : null, tot = R.total || 1;
  const pc = k => R.clases[k] / tot * 100, ha = k => R.clases[k];
  const fav = pc(2) + pc(3), malo = pc(0) + pc(1), haMalo = ha(0) + ha(1);
  const pctA = k => Ra && Ra.total ? Ra.clases[k] / Ra.total * 100 : null;
  const malA = Ra ? pctA(0) + pctA(1) : null;
  const n1 = (x, d = 1) => frNum(x, d), ha2 = x => frNum(x, 2);
  const leidos = C.P.filter(p => p.v != null && frPozoOK(p));
  const Lant = ant ? F.lecturas[ant] : {};
  const criticos = leidos.filter(p => p.v < 0.5).map(p => ({...p, va:frVal(Lant[p.n])})).sort((a, b) => a.v - b.v);
  const subcrit = leidos.filter(p => p.v >= 0.5 && p.v < 1);
  // Pozos que estaban críticos en la lectura anterior y ya no
  const salieron = leidos.filter(p => p.v >= 0.5 && frVal(Lant[p.n]) != null && frVal(Lant[p.n]) < 0.5);
  const hacs = Object.entries(R.hac).map(([h, c]) => ({h, c, t:c.reduce((a, b) => a + b, 0)})).filter(x => x.t > 0)
    .map(x => ({...x, p:(x.c[0] + x.c[1]) / x.t * 100})).sort((a, b) => b.p - a.p);
  const hacMal = hacs.filter(x => x.p >= 10).slice(0, 5);
  const crSue = R.suertes.filter(s => s.v < 0.5).sort((a, b) => a.v - b.v);
  const estado = fav >= 85 ? 'favorable' : fav >= 65 ? 'aceptable' : 'desfavorable';
  const hoy = new Date(), hoyTxt = `${frMesL[hoy.getMonth()].replace(/^./, c => c.toUpperCase())} ${hoy.getDate()} del ${hoy.getFullYear()}`;
  const abs = u => new URL(u, document.baseURI).href;
  const logo = abs('img/logo-riopaila.png');
  const portada = abs('img/portada-informe-nf.svg');   // ilustración del nivel freático (pozo, raíces, lámina de agua)
  const plano = frPlano(C, 1500, 0, true).cv.toDataURL('image/jpeg', 0.9), alcance = frFiltroClave() ? frAlcanceTxt() : '';
  const editable = (txt, ph) => `<p class="ed${txt ? '' : ' vacio'}" contenteditable="true" data-ph="${ph}">${txt}</p>`;
  const cambio = (a, b) => a == null ? '' : Math.abs(b - a) < 0.5 ? 'se mantuvo prácticamente igual' : b > a ? `aumentó ${n1(b - a)} puntos porcentuales` : `disminuyó ${n1(a - b)} puntos porcentuales`;

  // Textos de análisis según los resultados (mismo enfoque del informe del área)
  const pGeneral = `La zonificación de niveles freáticos evidencia un comportamiento hidráulico <b>${estado}</b>, ya que el <b>${n1(fav)}%</b> del área evaluada presenta condiciones regulares y normales, mientras que el <b>${n1(malo)}%</b> corresponde a condiciones subcríticas y críticas. ` +
    (fav >= 85 ? 'Esta distribución indica que la red de drenaje está funcionando adecuadamente en la mayor parte de Riopaila Agrícola, permitiendo mantener el nivel freático a profundidades compatibles con el desarrollo normal del sistema radicular de los cultivos.'
      : fav >= 65 ? 'Aunque la mayor parte del área conserva condiciones aceptables, existen sectores con restricciones de drenaje que requieren atención para evitar que el nivel freático continúe ascendiendo.'
      : 'Esta distribución evidencia restricciones de drenaje importantes, con una proporción alta del área bajo niveles freáticos superficiales que pueden afectar el desarrollo del cultivo.');
  const pNormal = `La condición normal, que representa el <b>${n1(pc(3))}%</b> del área total (${ha2(ha(3))} ha), corresponde a la situación más favorable agronómicamente, pues existe una adecuada zona de aireación para las raíces y se favorece una exploración radicular más profunda. Adicionalmente, estas profundidades permiten una adecuada reserva hídrica en el suelo sin generar condiciones de saturación.`;
  const pRegular = `La categoría regular, con <b>${n1(pc(2))}%</b> (${ha2(ha(2))} ha), presenta condiciones aceptables para el cultivo al reflejar una menor capacidad de almacenamiento ante eventos de lluvia intensa. En estas áreas es recomendable mantener un seguimiento permanente, ya que incrementos en las precipitaciones o limitaciones en la evacuación del agua podrían provocar ascensos del nivel freático hacia categorías menos favorables.`;
  const pSub = `En las condiciones subcríticas, con un <b>${n1(pc(1))}%</b> (${ha2(ha(1))} ha), comienza a evidenciarse una reducción de la zona radicular disponible, lo que puede limitar el crecimiento de las raíces, afectar la absorción de nutrientes y aumentar la susceptibilidad del cultivo al estrés por exceso de humedad. Estas áreas constituyen zonas de vigilancia prioritaria dentro del sistema de drenaje.`;
  const pCrit = ha(0) >= 0.5 ? `Finalmente, la condición crítica, identificada en <b>${ha2(ha(0))} ha</b> (${n1(pc(0))}%), refleja una saturación cercana a la superficie del suelo. Bajo estas condiciones existe un alto riesgo de deficiencia de oxígeno en las raíces, restricciones en las labores agrícolas y potenciales pérdidas en productividad. ${pc(0) < 5 ? 'Aunque la extensión es relativamente baja, estas' : 'Estas'} áreas requieren especial atención para identificar obstrucciones en la red de drenaje en donde se acumula el agua.`
    : 'Finalmente, no se identificaron áreas en condición crítica en esta lectura, lo que indica que no hay sectores con saturación cercana a la superficie del suelo.';
  const pDesempeno = `En términos de desempeño del drenaje, ${fav >= 85 ? 'los resultados pueden considerarse positivos, dado que' : fav >= 65 ? 'los resultados son aceptables, dado que' : 'los resultados requieren atención, dado que solo'} cerca de ${Math.round(pc(3) / 10)} de cada diez hectáreas evaluadas presentan condiciones óptimas y ${pc(2) >= 33 ? 'más de un tercio' : `el ${n1(pc(2))}%`} se encuentra en condiciones aceptables. ` +
    (malo < 10 ? 'La baja proporción de áreas críticas y subcríticas indica que los problemas de drenaje son localizados y no generalizados. ' : '') +
    `${haMalo >= 0.5 ? `Sin embargo, la presencia de aproximadamente <b>${ha2(haMalo)} ha</b> bajo condiciones críticas y subcríticas sugiere la necesidad de mantener actividades de monitoreo, limpieza y mantenimiento de la infraestructura hidráulica para evitar que estos sectores aumenten su extensión durante periodos de mayores precipitaciones.` : 'Se recomienda mantener las actividades de monitoreo y mantenimiento de la infraestructura hidráulica.'}`;
  const pCompara = Ra ? `Respecto a la lectura anterior del ${frFechaL(ant)}, el área en condiciones críticas y subcríticas ${cambio(malA, malo)} (de ${n1(malA)}% a ${n1(malo)}%), y el área en condición normal ${cambio(pctA(3), pc(3))} (de ${n1(pctA(3))}% a ${n1(pc(3))}%). ${malo > malA + 0.5 ? 'Este ascenso de los niveles freáticos debe contrastarse con las precipitaciones y los riegos del periodo.' : malo < malA - 0.5 ? 'Esta mejoría indica una evacuación adecuada del agua en el perfil del suelo durante el periodo.' : 'El comportamiento se mantiene estable entre ambas lecturas.'}` : '';
  const pHac = hacMal.length ? `Por hacienda, las mayores proporciones de área en condición crítica y subcrítica se presentan en ${hacMal.map(x => `<b>${esc(x.h)}</b> (${n1(x.p, 0)}%)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}, por lo que estos sectores deben priorizarse en la revisión de canales, desagües y estructuras de drenaje.` : 'Ninguna hacienda presenta más del 10% de su área en condición crítica o subcrítica.';
  const pPozos = criticos.length ? `En la lectura del ${frFechaL(fecha)}, <b>${criticos.length}</b> ${criticos.length === 1 ? 'pozo presentó' : 'pozos presentaron'} condición crítica (menos de 0,5 m) y ${subcrit.length} condición subcrítica. A continuación se muestra el desempeño de los pozos críticos en sus últimas lecturas.${salieron.length ? ` Respecto a la lectura anterior, ${salieron.length === 1 ? 'el pozo' : 'los pozos'} ${salieron.map(p => p.n).join(', ')} ${salieron.length === 1 ? 'salió' : 'salieron'} de la condición crítica.` : ''}`
    : `En la lectura del ${frFechaL(fecha)} ningún pozo presentó condición crítica (menos de 0,5 m); ${subcrit.length} ${subcrit.length === 1 ? 'pozo se encuentra' : 'pozos se encuentran'} en condición subcrítica.`;
  const fichaPozo = p => { const tend = p.va == null ? '' : Math.abs(p.v - p.va) < 0.05 ? `se mantuvo estable respecto a la lectura anterior (${frNum(p.va)} m)` : p.v < p.va ? `el nivel subió ${frNum(p.va - p.v)} m respecto a la lectura anterior (${frNum(p.va)} m)` : `el nivel bajó ${frNum(p.v - p.va)} m respecto a la lectura anterior (${frNum(p.va)} m)`;
    const sue = (() => { const G = frMalla(), M = MAPA_FREATICO, gx = Math.floor(p.x / FR_CELDA), gy = Math.floor((M.alto - p.y) / FR_CELDA); if (gx < 0 || gy < 0 || gx >= G.W || gy >= G.H) return ''; const c = G.celda[gy * G.W + gx]; return c < 0 ? '' : M.suertes[G.sue[c]][0]; })();
    return `<div class="pozo"><div><h4>Pozo ${p.n} · ${esc(p.h)}</h4><p>Sector ${esc(p.s)}${sue ? ` · suerte ${esc(sue)}` : ''} · Zona ${esc(p.z)}. Lectura: <b>${frNum(p.v)} m</b> (condición crítica)${tend ? `; ${tend}` : ''}.</p>
      ${editable('', 'Observación de campo (ej.: suerte en riego, canal obstruido, lluvia reciente…)')}</div>${frMiniHist(F, p.n, fecha)}</div>`; };
  const concl = [
    `El monitoreo de niveles freáticos realizado el ${frFechaL(fecha)} evidenció condiciones ${estado}s de drenaje, con el ${n1(fav)}% del área evaluada clasificada en condiciones normal y regular.`,
    pc(3) >= pc(2) ? `La condición normal predominó en el área de estudio, representando el ${n1(pc(3))}% de la superficie total, lo que indica una adecuada profundidad del nivel freático para el desarrollo del cultivo y una buena aireación radicular.`
      : `La condición regular predominó en el área de estudio (${n1(pc(2))}%), por lo que se recomienda vigilar estos sectores ante eventos de lluvia intensa.`,
    `Las áreas con condiciones críticas y subcríticas representaron ${malo < 10 ? 'únicamente ' : ''}el ${n1(malo)}% del área evaluada (${ha2(haMalo)} ha)${malo < 10 ? ', lo que sugiere que los problemas asociados a niveles freáticos superficiales se presentan de manera localizada' : ', una proporción que requiere intervenciones en la red de drenaje'}.`,
    Ra ? `Frente a la lectura del ${frFechaL(ant)}, el área crítica y subcrítica ${cambio(malA, malo)}.` : '',
    hacMal.length ? `Las haciendas ${hacMal.slice(0, 3).map(x => esc(x.h)).join(', ').replace(/, ([^,]*)$/, ' y $1')} concentran la mayor proporción de área con restricciones de drenaje y deben priorizarse en el mantenimiento.` : '',
    criticos.length ? `Los pozos ${criticos.map(p => p.n).join(', ').replace(/, ([^,]*)$/, ' y $1')} presentaron condición crítica; se recomienda verificar en campo su causa (riego, obstrucciones o lluvias) y continuar con su seguimiento.` : '',
    'Se recomienda mantener las labores de monitoreo, mantenimiento y conservación de la infraestructura de drenaje para garantizar la estabilidad de las condiciones observadas y minimizar la expansión de áreas con restricciones de drenaje.',
  ].filter(Boolean);

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de Isóbatas ${frFechaCorta(fecha)}</title>
<style>${FR_INF_CSS}</style></head><body>
<img class="logo-pie" src="${logo}" alt="">
<div class="barra"><b>Informe de Isóbatas ${frFechaCorta(fecha)}</b><span>Puedes corregir cualquier texto haciendo clic sobre él. Los espacios en gris son para completar (si quedan vacíos no salen impresos).</span><button onclick="print()">🖨 Imprimir / Guardar PDF</button></div>

<div class="hoja portada"><div class="foto" style="background-image:url('${portada}')"></div><div class="velo"></div>
  <div class="caja"><div class="logo"><img src="${logo}" alt="Riopaila Agrícola"></div>
    <div class="pill t">Informe Isóbatas</div>${alcance ? `<div class="pill s">${esc(alcance)}</div>` : ''}
    <div class="pill s">Área de Ingeniería Agrícola<br><br><span contenteditable="true" class="ed">${hoyTxt}</span></div></div></div>

<div class="hoja"><h2>Objetivo</h2>
<p class="ed" contenteditable="true">El presente informe tiene como objetivo principal realizar un análisis riguroso y detallado sobre el comportamiento espacial de las isóbatas correspondientes al monitoreo del ${frFechaL(fecha)} ${frFiltroClave() ? `en ${esc(frAlcanceTxt())} de Riopaila Agrícola` : 'en las haciendas pertenecientes a Riopaila Agrícola'}. A través de la zonificación de los niveles freáticos, se busca identificar sectores vulnerables por excesos hídricos para optimizar la toma de decisiones operativas en el mantenimiento y gestión de la red de drenaje agrícola, garantizando la óptima aireación radicular del cultivo de caña de azúcar. Es por esto que la descripción de las condiciones de estos niveles se presenta en la tabla 1.</p>
<p class="cap"><b>Tabla 1.</b> Descripción de las condiciones de niveles freáticos junto con su rango y color representativo en el mapa.</p>
<table><tr><th>Condición</th><th>Descripción</th><th>Rango de<br>profundidad (m)</th><th>Color representante<br>de la condición</th></tr>
${FR_INF.map((c, k) => `<tr><td>${c.n}</td><td>${c.d}</td><td>${FR_CLASES[k].r.replace(/,/g, '.').replace(' - ', ' – ')}</td><td>${c.col}</td></tr>`).join('')}</table>
<h2>Metodología</h2>
<p class="ed" contenteditable="true">Las lecturas de nivel freático fueron obtenidas mediante mediciones directas en campo utilizando la red de pozos de observación distribuida estratégicamente dentro de las haciendas evaluadas (${leidos.length} pozos leídos el ${frFechaL(fecha)}). Posteriormente, la información recopilada fue procesada mediante el método de interpolación espacial Inverse Distance Weighting (IDW), permitiendo representar de manera continua la distribución de los niveles freáticos dentro de las suertes y generar el mapa de zonificación correspondiente, en el que se identifican las diferentes zonas de acuerdo con sus condiciones freáticas.</p>
<div class="pie"><img src="${logo}" alt=""><span>1</span></div></div>

<div class="hoja"><h2>Análisis de precipitaciones</h2>
${frTextoLluvia(fecha) ? `<p class="ed" contenteditable="true">${frTextoLluvia(fecha)}</p>` : ''}${editable('', `Escribe aquí ${frTextoLluvia(fecha) ? 'más detalles sobre' : ''} las lluvias de los 15 días previos a la lectura del ${frFechaL(fecha)} (acumulado por zona y su efecto en los niveles)…`)}
<h2>Análisis de niveles freáticos del ${frFechaL(fecha).replace(/ de \d{4}$/, '')}</h2>
<p class="ed" contenteditable="true">El mapa de zonificación elaborado a partir de las lecturas, bajo el nombre de Mapa de Isóbatas ${frFechaCorta(fecha)}, muestra la distribución espacial de las distintas condiciones de nivel freático presentes en las haciendas evaluadas. El procesamiento geoespacial del mapa de zonificación del ${frFechaL(fecha)} arrojó una superficie total evaluada de ${ha2(tot)} ha. Los resultados consolidados y sus respectivas proporciones porcentuales se exponen en la Tabla 2.</p>
<img class="plano" src="${plano}" alt="Mapa de isóbatas">
<div class="ley">${FR_CLASES.map((c, k) => `<span><i style="background:${c.c}"></i>${FR_INF[k].n} ${c.r} m</span>`).join('')}</div>
<p class="cap" style="text-align:center"><b>Mapa de Isóbatas ${frFechaCorta(fecha)}.</b> Los números señalan los pozos en condición crítica.</p>
<div class="pie"><img src="${logo}" alt=""><span>2</span></div></div>

<div class="hoja">
<p class="cap"><b>Tabla 2.</b> Áreas totales por cada condición de nivel freático para la lectura del ${frFechaL(fecha)}.</p>
<table><tr><th colspan="3">Área total por condición de nivel freático</th></tr><tr><th>Condición</th><th>Área total (ha)</th><th>%</th></tr>
${FR_INF.map((c, k) => `<tr><td class="c${k}">${c.n}</td><td>${ha2(ha(k))}</td><td>${n1(pc(k))}</td></tr>`).join('')}
<tr><td><b>Total</b></td><td><b>${ha2(tot)}</b></td><td>100</td></tr></table>
<p class="ed" contenteditable="true">${pGeneral}</p>
<p class="ed" contenteditable="true">${pNormal}</p>
<p class="ed" contenteditable="true">${pRegular}</p>
<p class="ed" contenteditable="true">${pSub}</p>
<p class="ed" contenteditable="true">${pCrit}</p>
<p class="ed" contenteditable="true">${pDesempeno}</p>
${pCompara ? `<p class="ed" contenteditable="true">${pCompara}</p>` : ''}
<p class="ed" contenteditable="true">${pHac}</p>
${hacs.length ? `<p class="cap"><b>Tabla 3.</b> Haciendas con mayor proporción de área en condición crítica y subcrítica.</p>
<table><tr><th>Hacienda</th><th>Crítico (ha)</th><th>Subcrítico (ha)</th><th>Área (ha)</th><th>% crítico + subcrítico</th></tr>
${hacs.slice(0, 8).map(x => `<tr><td style="text-align:left">${esc(x.h)}</td><td>${ha2(x.c[0])}</td><td>${ha2(x.c[1])}</td><td>${ha2(x.t)}</td><td><b>${n1(x.p)}</b></td></tr>`).join('')}</table>` : ''}
<div class="pie"><img src="${logo}" alt=""><span>3</span></div></div>

<div class="hoja"><h2>Seguimiento de pozos críticos</h2>
<p class="ed" contenteditable="true">${pPozos}</p>
${criticos.map(fichaPozo).join('')}
${crSue.length ? `<p class="cap" style="margin-top:4mm"><b>Tabla 4.</b> Suertes con nivel freático promedio en condición crítica.</p>
<table><tr><th>Suerte</th><th>Hacienda</th><th>Área (ha)</th><th>Nivel promedio (m)</th></tr>
${crSue.slice(0, 25).map(s => `<tr><td>${esc(s.cod)}</td><td style="text-align:left">${esc(s.h)}</td><td>${ha2(s.ha)}</td><td>${frNum(s.v)}</td></tr>`).join('')}</table>` : ''}
<div class="pie"><img src="${logo}" alt=""><span>4</span></div></div>

<div class="hoja"><h2>Conclusiones</h2>
<ul class="c">${concl.map(c => `<li class="ed" contenteditable="true">${c}</li>`).join('')}</ul>
${editable('', 'Conclusiones o recomendaciones adicionales…')}
<div class="pie"><img src="${logo}" alt=""><span>5</span></div></div>
<script>document.querySelectorAll('.ed').forEach(e => e.addEventListener('input', () => e.classList.toggle('vacio', !e.textContent.trim())));</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('⚠ El navegador bloqueó la ventana del informe: permite las ventanas emergentes para esta página'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ── Fuente de datos: qué Excel se usa y cómo cargar el último (solo editor) ──
// frE.carpeta = estado del Excel más reciente en Documents\SIG\LECTURA NIVEL FREATICO (lo consulta el servidor)
frE.carpeta = {estado:''};
const frFechaArch = s => s ? frFecha(String(s).slice(0, 10)) : '—';
function frFuenteHTML(){
  const F = freatico(), c = frE.carpeta, fe = F ? frFechas(F) : [];
  const igual = F && c.archivo === F.archivo && c.fecha === F.fechaArchivo;
  const estado = !MODO_EDICION ? '' :
    c.estado === 'revisando' ? '<span class="meta">⏳ Revisando la carpeta…</span>' :
    c.estado === 'cargando' ? '<span class="meta">⏳ Leyendo el Excel…</span>' :
    c.estado === 'apagado' ? '<span class="fr-f-aviso">⚠ El servidor de este PC está apagado: no puedo revisar la carpeta. Usa <b>📂 Elegir Excel</b>.</span>' :
    c.estado === 'vacia' ? '<span class="fr-f-aviso">⚠ No hay ningún Excel en <b>Documentos\\SIG\\LECTURA NIVEL FREATICO</b>.</span>' :
    c.archivo && igual ? '<span class="fr-f-ok">✓ Es el último Excel de la carpeta</span>' :
    c.archivo ? `<span class="fr-f-aviso">🆕 En la carpeta hay uno más reciente: <b>${esc(c.archivo)}</b> (guardado ${frFechaArch(c.fecha)})</span>` : '';
  return `<div class="fr-fuente" id="fr-fuente">
    <div class="fr-f-txt">📄 ${F ? `Trabajando con <b>${esc(F.archivo || 'Excel de niveles')}</b>${F.fechaArchivo ? ` · guardado ${frFechaArch(F.fechaArchivo)}` : ''} · ${fe.length} lecturas (${frFecha(fe[0])} – <b>${frFecha(fe[fe.length - 1])}</b>)` : 'Sin Excel cargado'}
      ${estado ? `<div>${estado}</div>` : ''}
      ${MODO_EDICION && frE.avisos && (frE.avisos.fechas.length || frE.avisos.sinCoord.length) ? `<details class="fr-f-det"><summary>🛠 Revisión del Excel: ${frE.avisos.fechas.length} fechas corregidas${frE.avisos.sinCoord.length ? ` · ${frE.avisos.sinCoord.length} pozos sin coordenadas` : ''}</summary>
        <ul>${frE.avisos.fechas.map(a => `<li>${esc(a)}</li>`).join('')}${frE.avisos.sinCoord.length ? `<li>Pozos sin coordenadas (no salen en el mapa): ${frE.avisos.sinCoord.join(', ')}</li>` : ''}</ul>
        <small class="meta">Las fechas mal escritas en el Excel se corrigen solas según el orden de las columnas y las fechas de campaña. Conviene corregirlas también en el Excel.</small></details>` : ''}</div>
    ${MODO_EDICION ? `<div class="fr-f-btns">
      <button type="button" class="mbtn" data-fr-act title="Toma el Excel más reciente de Documentos\\SIG\\LECTURA NIVEL FREATICO">📥 Cargar último Excel de la carpeta</button>
      <label class="mbtn mbtn-ghost" title="Elegir un Excel de niveles freáticos de cualquier carpeta (se lee aquí mismo, sin servidor)">📂 Elegir Excel…<input type="file" id="fr-archivo" accept=".xlsx,.xlsm" hidden></label></div>` : ''}
  </div>`;
}
const frPintarFuente = () => { const el = q('fr-fuente'); if (el) el.outerHTML = frFuenteHTML(); };

// Al abrir el módulo (y con el botón) se pregunta al servidor cuál es el último Excel; si es otro, se carga solo
let frRevisado = false;
function frRevisarServidor(forzar){
  if (frRevisado && !forzar) return; frRevisado = true;
  frE.carpeta = {estado:'revisando'}; frPintarFuente();
  return fetch(API_BASE + 'api/freatico?info=1', {cache:'no-store', headers:{'X-Comite':'1'}})
    .then(r => r.status === 404 ? {vacia:true} : r.ok ? r.json() : null).then(info => {
      if (!info) throw new Error();
      if (info.vacia) { frE.carpeta = {estado:'vacia'}; frPintarFuente(); return; }
      frE.carpeta = {estado:'', archivo:info.archivo, fecha:info.fecha};
      const F = freatico();
      if (forzar || !F || !F.pozos || !F.pozos.length || F.archivo !== info.archivo || F.fechaArchivo !== info.fecha) return frActualizar(!forzar);
      frPintarFuente();
    }).catch(() => { frE.carpeta = {estado:'apagado'}; frPintarFuente(); if (forzar) toast('⚠ El servidor de este PC está apagado: usa 📂 Elegir Excel'); });
}
function frActualizar(auto){
  const c = frE.carpeta; frE.carpeta = {...c, estado:'cargando'}; frPintarFuente();
  // El servidor entrega el Excel tal cual y aquí se lee (mismo lector que 📂 Elegir Excel)
  return fetch(API_BASE + 'api/freatico', {cache:'no-store', headers:{'X-Comite':'1'}}).then(async r => {
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'el servidor no entregó el Excel'); }
    const nombre = decodeURIComponent(r.headers.get('X-Archivo') || 'niveles.xlsx'), fecha = r.headers.get('X-Fecha') || '';
    const d = await frLeerExcel(await r.blob(), nombre, fecha);
    await frCargarMapa();
    frE.carpeta = {estado:'', archivo:nombre, fecha};
    frAplicar(d);
  }).catch(e => { console.error(e); frE.carpeta = {...c, estado:''}; frPintarFuente(); if (!auto) toast('⚠ No se pudo leer el Excel: ' + (e.message || 'servidor apagado')); });
}
// Completa lo que el Excel no trae con la ubicación fija de los pozos y lo publicado: coordenadas, hacienda,
// sector y zona de cada pozo (las hojas por técnico no las traen) y las fechas antiguas que no vengan en el Excel.
function frCompletar(d){
  // Solo lo publicado (no la copia local: si una carga anterior trajo un error, no se arrastra)
  const viejos = [typeof SEED !== 'undefined' && SEED.freatico].filter(F => F && F.pozos && F.pozos.length);
  const P = {}, lect = {};
  viejos.forEach(F => { F.pozos.forEach(p => { if (p[1] != null) P[p[0]] = p; }); Object.assign(lect, F.lecturas || {}); });
  if (typeof MAPA_FREATICO !== 'undefined') (MAPA_FREATICO.pozos || []).forEach(p => P[p[0]] = p);   // ubicación fija de los pozos (manda)
  const nuevas = new Set(Object.keys(d.lecturas));
  Object.keys(lect).forEach(f => { if (!nuevas.has(f)) d.lecturas[f] = lect[f]; });
  const ids = new Set(); Object.values(d.lecturas).forEach(L => Object.keys(L).forEach(id => ids.add(+id)));
  const out = {}, sinCoord = [];
  d.pozos.forEach(p => out[p[0]] = p);
  ids.forEach(id => { if (!out[id]) out[id] = [id, null, null, '', '', '']; });
  const pozos = Object.values(out).map(p => { const v = P[p[0]];
    // Hacienda/sector/zona: primero los datos fijos del pozo (en las hojas nuevas la "hacienda" es la ruta del técnico)
    const r = [p[0], p[1] ?? (v && v[1]), p[2] ?? (v && v[2]), (v && v[3]) || p[3] || '', (v && v[4]) || p[4] || '', (v && v[5]) || p[5] || ''];
    if (r[1] == null) { sinCoord.push(p[0]); return null; } return r; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const ok = new Set(pozos.map(p => String(p[0]))), lecturas = {};
  Object.keys(d.lecturas).sort().forEach(f => { const L = {}; Object.entries(d.lecturas[f]).forEach(([id, v]) => { if (ok.has(id)) L[id] = v; }); if (Object.keys(L).length >= 10) lecturas[f] = L; });
  return {archivo:d.archivo, fechaArchivo:d.fechaArchivo, pozos, lecturas, sinCoord};
}
// Deja las lecturas nuevas como base del panel (y marca "sin publicar")
function frAplicar(crudo){
  const avisos = crudo.avisos || [], d = frCompletar(crudo), sinCoord = d.sinCoord; delete d.sinCoord;
  if (!d.pozos.length || !frFechas(d).length) { toast('⚠ Ese Excel no trae pozos con lecturas (debe tener "No de pozo" y "Lectura")'); frPintarFuente(); return; }
  const antes = freatico(), fAntes = new Set(antes ? frFechas(antes) : []);
  frE.cache = {}; frE.evol = {}; frE.evolV = {}; frE.evolFechas = ''; FRH = null;
  frE.avisos = {fechas:avisos, sinCoord};
  frE.fecha = frFechas(d).pop();
  modCambio(() => { DB.freatico = d; });
  const nuevas = frFechas(d).filter(f => !fAntes.has(f)).length;
  toast(`💧 ${d.archivo}: ${d.pozos.length} pozos · última lectura ${frFecha(frE.fecha)}${nuevas ? ` · ${nuevas} lecturas nuevas` : ''}${avisos.length ? ` · ${avisos.length} fechas corregidas` : ''} · recuerda 🚀 Publicar`);
}

// ── Lector del Excel en el navegador. El archivo puede pesar ~90 MB y tener hojas de 800 MB de XML,
// así que se descomprime por partes y cada hoja se deja de leer al terminar los datos.
// Entiende: hojas anchas (encabezado "No de pozo" + una columna "Lectura" por fecha, con la fecha en
// alguna de las 3 filas de arriba: BASE DE DATOS y hojas por técnico) y hojas largas (Fecha + Lectura,
// una fila por pozo y fecha: Consolidado). Valores: número = m; SECO = "S" (2 m); LLENO = 0;
// 0, daños y notas = sin lectura.
const frNorm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
const frXml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&');
async function frZip(file){
  const fin = new DataView(await file.slice(Math.max(0, file.size - 65558)).arrayBuffer());
  let p = fin.byteLength - 22; while (p >= 0 && fin.getUint32(p, true) !== 0x06054b50) p--;
  if (p < 0) throw new Error('no es un archivo .xlsx');
  const n = fin.getUint16(p + 10, true), tam = fin.getUint32(p + 12, true), ini = fin.getUint32(p + 16, true);
  const cd = new DataView(await file.slice(ini, ini + tam).arrayBuffer()), dec = new TextDecoder(), E = {};
  for (let i = 0, k = 0; i < n && cd.getUint32(k, true) === 0x02014b50; i++) {
    const ln = cd.getUint16(k + 28, true), lx = cd.getUint16(k + 30, true), lc = cd.getUint16(k + 32, true);
    E[dec.decode(new Uint8Array(cd.buffer, k + 46, ln))] = {met:cd.getUint16(k + 10, true), comp:cd.getUint32(k + 20, true), off:cd.getUint32(k + 42, true)};
    k += 46 + ln + lx + lc;
  }
  return E;
}
async function frFlujo(file, e){
  const h = new DataView(await file.slice(e.off, e.off + 30).arrayBuffer()), ini = e.off + 30 + h.getUint16(26, true) + h.getUint16(28, true);
  let s = file.slice(ini, ini + e.comp).stream();
  if (e.met === 8) s = s.pipeThrough(new DecompressionStream('deflate-raw'));
  return s.pipeThrough(new TextDecoderStream()).getReader();
}
async function frTexto(file, e){ if (!e) return ''; const r = await frFlujo(file, e); let t = ''; for (;;) { const {done, value} = await r.read(); if (done) return t; t += value; } }
// Recorre una hoja fila por fila; fila(n, celdas{columna:valor}) devuelve false para detenerse
async function frFilas(file, e, ss, fila){
  const r = await frFlujo(file, e); let buf = '';
  const col = c => { let n = 0; for (const ch of c) n = n * 26 + ch.charCodeAt(0) - 64; return n; };
  for (;;) {
    const {done, value} = await r.read(); if (done) return;
    buf += value;
    const fin = buf.lastIndexOf('</row>'); if (fin < 0) continue;
    const trozo = buf.slice(0, fin + 6); buf = buf.slice(fin + 6);
    for (const m of trozo.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = +((/\br="(\d+)"/.exec(m[1]) || [])[1] || 0), cel = {};
      for (const c of (m[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = /\br="([A-Z]+)\d*"/.exec(c[1]), t = (/\bt="(\w+)"/.exec(c[1]) || [])[1], cont = c[2] || '';
        if (!ref || t === 'e') continue;
        let v = t === 'inlineStr' ? (/<t[^>]*>([\s\S]*?)<\/t>/.exec(cont) || [])[1] : (/<v>([\s\S]*?)<\/v>/.exec(cont) || [])[1];
        if (v == null) continue;
        v = frXml(v); if (t === 's') v = ss[+v] ?? '';
        cel[col(ref[1])] = v;
      }
      if (fila(rn, cel) === false) { r.cancel().catch(() => {}); return; }
    }
  }
}
async function frLeerExcel(file, nombre, fechaArchivo){
  const E = await frZip(file), ss = [];
  const sst = (await frTexto(file, E['xl/sharedStrings.xml'])).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) ss.push(frXml([...(m[1] || '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const rels = {};
  for (const m of (await frTexto(file, E['xl/_rels/workbook.xml.rels'])).matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (/\bId="([^"]+)"/.exec(m[0]) || [])[1], tg = (/\bTarget="([^"]+)"/.exec(m[0]) || [])[1] || '';
    rels[id] = tg.startsWith('/') ? tg.slice(1) : 'xl/' + tg;
  }
  const hojas = [];
  for (const m of (await frTexto(file, E['xl/workbook.xml'])).matchAll(/<sheet\b[^>]*>/g)) {
    const nom = frXml((/\bname="([^"]*)"/.exec(m[0]) || [])[1] || ''), id = (/\br:id="([^"]+)"/.exec(m[0]) || [])[1];
    if (id && E[rels[id]]) hojas.push({nom, k:frNorm(nom), e:E[rels[id]]});
  }
  if (!hojas.length) throw new Error('no encontré hojas en el archivo');
  const num = v => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? NaN : Number(s); };
  const fecha = d => new Date(Math.round((d - 25569) * 864e5)).toISOString().slice(0, 10);
  const pozoId = v => { const d = num(v); return d > 0 && d < 100000 && Math.abs(d - Math.round(d)) < 1e-9 ? Math.round(d) : null; };
  const valor = v => { if (v == null) return null; const d = num(v);
    if (!isNaN(d)) return d <= 0 || d > 5 ? null : Math.round(d * 100) / 100;
    const n = frNorm(v); return n.startsWith('seco') ? 'S' : n.startsWith('lleno') || n.includes('inund') || n.includes('encharc') ? 0 : null; };
  const pozos = {}, crudas = [], anchas = [];   // crudas: [pozo, fecha (serial), valor, hoja, columna]
  const ponerPozo = (id, c, C) => { const p = pozos[id] = pozos[id] || {h:'', s:'', z:''}, la = num(c[C.lat]), lo = num(c[C.lon]);
    if (la > 3 && la < 6 && lo < -75 && lo > -78) { p.lat = la; p.lon = lo; }
    for (const k of ['h', 's', 'z']) { const v = String(c[C[k]] ?? '').trim(); if (v) p[k] = v; } };
  const encab = c => { const o = {l:[]}; for (const [k, v] of Object.entries(c)) { const x = frNorm(v);
    if (x.startsWith('nopozo') || x.startsWith('nodepozo') || x.startsWith('nodepiez') || x.startsWith('nopiez') || x === 'pozo') o.id = +k;
    else if (x.startsWith('latitud')) o.lat = +k; else if (x.startsWith('longitud')) o.lon = +k; else if (x.startsWith('fecha')) o.f = +k;
    else if (x.startsWith('lectura')) o.l.push(+k); else if (x.startsWith('hacienda')) o.h = +k; else if (x.startsWith('sector')) o.s = +k; else if (x === 'zona') o.z = +k; }
    return o; };
  const leerHoja = (h, hi) => { let C = null, fechas = null, larga = false, vacias = 0; const prev = [];
    return frFilas(file, h.e, ss, (rn, c) => {
      if (!fechas && !larga) {
        const o = encab(c);
        if (o.id && o.l.length) {
          const fs = [];
          for (const k of o.l) for (let i = prev.length - 1; i >= 0; i--) { const d = num(prev[i][k]); if (d > 40000 && d < 60000) { fs.push([k, Math.floor(d)]); break; } }
          if (fs.length) { fechas = fs; anchas.push({nom:h.nom, hi, cols:fs}); } else if (o.f) larga = true;
          if (fechas || larga) { C = o; return true; }
        }
        prev.push(c); if (prev.length > 3) prev.shift();
        return rn < 60;
      }
      const id = pozoId(c[C.id]); if (id == null) return ++vacias < 300;
      if (larga) {
        const d = num(c[C.f]); if (!(d > 40000 && d < 60000)) return ++vacias < 300;
        vacias = 0; ponerPozo(id, c, C); const v = valor(c[C.l[0]]); if (v != null) crudas.push([id, Math.floor(d), v, hi, -1]);
      } else {
        vacias = 0; ponerPozo(id, c, C);
        for (const [k, d] of fechas) { const v = valor(c[k]); if (v != null) crudas.push([id, d, v, hi, k]); }
      }
    }); };
  // Hojas en su orden y al final el Consolidado (manda si hay diferencias); las tablas dinámicas no tienen "No de pozo"
  const esCons = h => h.k.includes('consolidad');   // "Consolidado", "Base Consolidada"
  for (let i = 0; i < hojas.length; i++) if (!esCons(hojas[i])) await leerHoja(hojas[i], i);
  for (let i = 0; i < hojas.length; i++) if (esCons(hojas[i])) await leerHoja(hojas[i], i);

  // Fechas de campaña: las que tienen lecturas de buena parte de los pozos (lectura quincenal)
  const nPozos = Object.keys(pozos).length || 1, freq = {};
  crudas.forEach(x => freq[x[1]] = (freq[x[1]] || 0) + 1);
  // (si dos fechas grandes quedan a menos de 6 días, son la misma campaña leída en dos días: manda la de más lecturas)
  const camp = [];
  Object.keys(freq).map(Number).filter(d => freq[d] >= 0.35 * nPozos).sort((a, b) => freq[b] - freq[a])
    .forEach(d => { if (!camp.some(c => Math.abs(c - d) <= 6)) camp.push(d); });
  camp.sort((a, b) => a - b); const esCamp = new Set(camp);
  // Fechas mal digitadas en las hojas anchas: en cada hoja las columnas van en orden; la secuencia creciente más
  // larga (dando más peso a fechas de campaña) se toma como buena y cada fecha fuera de orden se cambia por la
  // fecha de campaña que le corresponde entre sus vecinas (si no hay una sola opción clara, esa columna se descarta)
  const arreglo = {}, avisos = [];
  for (const A of anchas) {
    const s = A.cols.map(x => x[1]), n = s.length, w = s.map(d => esCamp.has(d) ? 2 : 1), mejor = w.slice(), de = Array(n).fill(-1);
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (s[j] < s[i] && mejor[j] + w[i] > mejor[i]) { mejor[i] = mejor[j] + w[i]; de[i] = j; }
    const ok = new Set(); for (let i = mejor.indexOf(Math.max(...mejor)); i >= 0; i = de[i]) ok.add(i);
    const usadas = new Set(s.filter((d, k) => ok.has(k)));
    for (let a = 0; a < n; ) {
      if (ok.has(a)) { a++; continue; }
      let b = a; while (b < n && !ok.has(b)) b++;
      const lo = a > 0 ? s[a - 1] : -Infinity, hi = b < n ? s[b] : Infinity, cand = camp.filter(d => d > lo && d < hi && !usadas.has(d));
      for (let k = a; k < b; k++) {
        const nueva = cand.length === b - a ? cand[k - a] : null;
        arreglo[A.hi + '|' + A.cols[k][0]] = nueva;
        avisos.push(`Hoja «${A.nom}»: ${frFecha(fecha(s[k]))} → ${nueva ? frFecha(fecha(nueva)) : 'descartada (no se pudo saber la fecha)'}`);
      }
      a = b;
    }
  }
  // Lecturas de una misma campaña tomadas en días cercanos (±6 días) quedan en la fecha de la campaña
  const campana = d => { if (esCamp.has(d)) return d; let m = null; for (const c of camp) if (Math.abs(c - d) <= 6 && (m == null || Math.abs(c - d) < Math.abs(m - d))) m = c; return m ?? d; };
  // Las hojas largas (Base Consolidada) copian las fechas de las hojas por técnico: se les aplica la misma
  // corrección, pozo por pozo
  const porPozo = {};
  for (const [id, d0, , hi, col] of crudas) { const k = hi + '|' + col; if (k in arreglo) porPozo[id + '|' + d0] = arreglo[k]; }
  const lect = {};
  for (const [id, d0, v, hi, col] of crudas) {
    let d = d0; const k = col < 0 ? id + '|' + d0 : hi + '|' + col, M = col < 0 ? porPozo : arreglo;
    if (k in M) { d = M[k]; if (d == null) continue; }
    const f = fecha(campana(d)); (lect[f] = lect[f] || {})[id] = v;
  }
  const lecturas = {};
  Object.keys(lect).sort().forEach(f => { if (Object.keys(lect[f]).length >= 10) lecturas[f] = lect[f]; });
  return {archivo:nombre, fechaArchivo, avisos, lecturas,
    pozos:Object.keys(pozos).map(Number).sort((a, b) => a - b).map(id => { const p = pozos[id]; return [id, p.lat != null ? +p.lat.toFixed(7) : null, p.lon != null ? +p.lon.toFixed(7) : null, p.h, p.s, p.z]; })};
}
function frElegirArchivo(file){
  if (!file) return;
  if (typeof DecompressionStream === 'undefined') { toast('⚠ Este navegador no puede leer el Excel; usa Chrome o Edge actualizados'); return; }
  frE.carpeta = {...frE.carpeta, estado:'cargando'}; frPintarFuente();
  toast(`⏳ Leyendo ${file.name}…`);
  const dl = new Date(file.lastModified), p2 = x => String(x).padStart(2, '0');
  const fechaArch = `${dl.getFullYear()}-${p2(dl.getMonth() + 1)}-${p2(dl.getDate())}T${p2(dl.getHours())}:${p2(dl.getMinutes())}:${p2(dl.getSeconds())}`;
  frLeerExcel(file, file.name, fechaArch).then(d => frCargarMapa().then(() => d)).then(d => { frE.carpeta = {...frE.carpeta, estado:''}; frAplicar(d); })
    .catch(e => { console.error(e); frE.carpeta = {...frE.carpeta, estado:''}; frPintarFuente(); toast('⚠ No se pudo leer ese Excel: ' + (e.message || e)); });
}

q('freaticos').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-fr-act]')) { frRevisarServidor(true); return; }
  if (t.closest('[data-fr-png]')) { frDescargarPNG(); return; }
  if (t.closest('[data-fr-informe]')) { frInforme(); return; }
  if (t.closest('[data-fr-cosecha]')) { irA('nfcos'); return; }
  const z = t.closest('[data-fr-zoom]'); if (z) { frE.zoom && frE.zoom(+z.dataset.frZoom); return; }
  if (t.closest('[data-fr-ajustar]')) { frE.suerteSel = null; frE.ajustar && frE.ajustar(); return; }
  if (t.closest('[data-fr-cerrar-pozo]')) { frE.pozo = null; q('fr-pozo-card').innerHTML = frPozoHTML(freatico()); frE.dibujar && frE.dibujar(); return; }
  const m = t.closest('[data-fr-mov]'); if (m) { const f = frFechasF(freatico()).length ? frFechasF(freatico()) : frFechas(freatico()), i = f.indexOf(frE.fecha) + +m.dataset.frMov; if (f[i]) { frE.fecha = f[i]; renderFreatico(); } return; }
  const ir = t.closest('[data-fr-ir]'); if (ir) { frE.fecha = ir.dataset.frIr; renderFreatico(); return; }
  const p = t.closest('[data-fr-pozo]'); if (p) { frE.pozo = +p.dataset.frPozo; q('fr-pozo-card').innerHTML = frPozoHTML(freatico()); frE.dibujar && frE.dibujar(); q('fr-pozo-card').scrollIntoView({behavior:'smooth', block:'nearest'}); return; }
  const s = t.closest('[data-fr-sue]'); if (s) { frE.suerteSel = +s.dataset.frSue; frE.dibujar && frE.dibujar(); q('fr-mapa').scrollIntoView({behavior:'smooth', block:'center'}); }
});
q('freaticos').addEventListener('change', e => {
  if (e.target.id === 'fr-archivo') { frElegirArchivo(e.target.files[0]); e.target.value = ''; }
  else if (e.target.id === 'fr-fecha') { frE.fecha = e.target.value; renderFreatico(); }
  else if (e.target.dataset.frCapa) { frE.capas[e.target.dataset.frCapa] = e.target.checked; frE.dibujar && frE.dibujar(); }
});
let frRedim = 0;
window.addEventListener('resize', () => { clearTimeout(frRedim); frRedim = setTimeout(() => { if (vistaActual === 'freat' && q('fr-mapa')) frMapaIniciar(); }, 200); });
