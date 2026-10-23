// Niveles freáticos · filtros (zona, hacienda, año, mes), lluvias y comparativo de varias lecturas.
// Se carga después de js/freatico.js y usa sus funciones (frCalculo, frRes, frPlano, FR_INF_CSS...).
// Lluvias: DB.lluvias {archivos[], ini 'AAAA-MM-DD', hac{HACIENDA:[mm por día desde ini, null = sin dato]}}
// (promedio diario de los pluviómetros de cada hacienda, ponderado por su área de influencia cuando la trae).

// ── Haciendas y zonas (para filtros) ──
const frTitulo = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const frNomHac = k => frTitulo(k);
let FRH = null;
// Haciendas de la cartografía (nombre, zona, área) y la hacienda de cada pozo
function frHaciendas(){
  if (FRH) return FRH;
  const M = MAPA_FREATICO, G = frMalla(), F = freatico();
  const area = {}; M.suertes.forEach(s => area[s[1]] = (area[s[1]] || 0) + s[2]);
  const keys = Object.keys(area), nk = {};
  keys.forEach(k => nk[frNorm(k)] = k);
  // "Morillo 1" → MORILLO, "San Carlos Lt 7" → SAN CARLOS LOTE 7, "LAGUNAS, LUISA 1" → LAGUNAS
  const porNombre = n => {
    let x = frNorm(String(n || '').split(',')[0].replace(/\blt\b/i, 'lote'));
    if (!x) return null; if (nk[x]) return nk[x];
    const y = x.replace(/\d+$/, ''); if (nk[y]) return nk[y];
    return keys.find(k => y.length > 3 && frNorm(k).startsWith(y)) || null;
  };
  const pozoHac = {}, votos = {};
  (F ? F.pozos : []).forEach(p => {
    let k = porNombre(p[3]);
    if (!k) { const [x, y] = frTM(p[1], p[2]), gx = Math.floor((x - M.x0) / FR_CELDA), gy = Math.floor((M.alto - (y - M.y0)) / FR_CELDA);
      if (gx >= 0 && gy >= 0 && gx < G.W && gy < G.H) { const c = G.celda[gy * G.W + gx]; if (c >= 0) k = M.suertes[G.sue[c]][1]; } }
    pozoHac[p[0]] = k;
    if (k && p[5]) { const v = votos[k] = votos[k] || {}; v[p[5]] = (v[p[5]] || 0) + 1; }
  });
  const Z1 = ['LA LUISA', 'LAGUNAS', 'RIOPAILA', 'PAILA ARRIBA', 'LA PAILA', 'ZAMBRANO', 'SAN CARLOS'];
  const zona = {}; keys.forEach(k => { const v = votos[k]; zona[k] = v ? +Object.entries(v).sort((a, b) => b[1] - a[1])[0][0] : (Z1.some(z => k.startsWith(z)) ? 1 : 2); });
  const lista = keys.map(k => ({k, n:frTitulo(k), z:zona[k], ha:area[k]})).sort((a, b) => a.z - b.z || a.n.localeCompare(b.n));
  return FRH = {lista, zona, area, pozoHac, porNombre};
}
// Haciendas que entran con el filtro (null = todas)
function frHacsFiltro(){
  const f = frE.f;
  if (f.h.length) return new Set(f.h);
  if (f.z.length) return new Set(frHaciendas().lista.filter(x => f.z.includes(x.z)).map(x => x.k));
  return null;
}
const frFiltroClave = () => { const f = frE.f; return f.h.length ? 'h:' + f.h.slice().sort().join(',') : f.z.length ? 'z:' + f.z.slice().sort().join(',') : ''; };
let frOKcache = {k:null, v:null};
// Suertes que entran con el filtro (Uint8Array por suerte de la cartografía) o null si no hay filtro espacial
function frOK(){
  const k = frFiltroClave(); if (!k) return null;
  if (frOKcache.k === k) return frOKcache.v;
  const S = frHacsFiltro(), ok = new Uint8Array(MAPA_FREATICO.suertes.length);
  MAPA_FREATICO.suertes.forEach((s, i) => ok[i] = S.has(s[1]) ? 1 : 0);
  return (frOKcache = {k, v:ok}).v;
}
function frPozoOK(p){ const S = frHacsFiltro(); return !S || S.has(frHaciendas().pozoHac[p.n]); }
function frAlcanceTxt(){
  const f = frE.f;
  if (f.h.length) return f.h.length > 4 ? `${f.h.length} haciendas` : f.h.map(frNomHac).join(', ');
  if (f.z.length) return f.z.map(z => 'Zona ' + z).join(' y ');
  return 'Todas las haciendas';
}
// Lecturas que pasan el filtro de año y mes
function frFechasF(F){ const f = frE.f; return frFechas(F).filter(x => (!f.a.length || f.a.includes(x.slice(0, 4))) && (!f.m.length || f.m.includes(+x.slice(5, 7)))); }

function frFiltrosHTML(F){
  const f = frE.f, H = frHaciendas(), anios = [...new Set(frFechas(F).map(x => x.slice(0, 4)))].sort();
  const chip = (g, v, txt, on, t = '') => `<button type="button" class="fr-ch ${on ? 'on' : ''}" data-fr-f="${g}" data-v="${esc(v)}" ${t ? `title="${esc(t)}"` : ''}>${txt}</button>`;
  const L = frLluvias(), algo = f.z.length || f.h.length || f.a.length || f.m.length;
  return `<div class="fr-filtros">
    <div class="fr-modo"><button type="button" class="${frE.modo === 'una' ? 'on' : ''}" data-fr-modo="una">🗺 Una lectura</button><button type="button" class="${frE.modo === 'comp' ? 'on' : ''}" data-fr-modo="comp">📊 Comparar lecturas</button></div>
    <div class="fr-fg"><span>Zona</span>${[1, 2].map(z => chip('z', z, 'Zona ' + z, f.z.includes(z))).join('')}</div>
    <div class="fr-fg"><span>Año</span>${anios.map(a => chip('a', a, a, f.a.includes(a))).join('')}</div>
    <div class="fr-fg"><span>Mes</span>${frMes.map((m, i) => chip('m', i + 1, m, f.m.includes(i + 1))).join('')}</div>
    <details class="fr-fhac" ${f.h.length ? 'open' : ''}><summary>Haciendas${f.h.length ? ` · <b>${f.h.length} elegidas</b>` : ''}</summary>
      ${[1, 2].map(z => `<div class="fr-fg"><span>Zona ${z}</span>${H.lista.filter(x => x.z === z).map(x => chip('h', x.k, x.n, f.h.includes(x.k), `${frNum(x.ha, 0)} ha`)).join('')}</div>`).join('')}</details>
    <div class="fr-fpie">${algo ? '<button type="button" class="plegar-todo" data-fr-limpiar>✕ Quitar filtros</button>' : '<span class="meta">Puedes marcar varias opciones en cada filtro</span>'}
      <span class="fr-llinfo">${L ? `💧 Lluvias: <b>${esc((L.archivos || []).join(', '))}</b> · ${frFecha(L.ini)} – ${frFecha(frDiaF(frDia(L.ini) + frLargoLluvias(L) - 1))}` : '💧 Sin datos de lluvia'}
      ${MODO_EDICION ? `<label class="plegar-todo" title="Reporte de lluvias (Hacienda, Pluviómetro, Fecha, Precipitación) o Ponderado de Precipitaciones (una hoja por mes)">📥 ${L ? 'Agregar' : 'Cargar'} lluvias<input type="file" id="fr-lluvias" accept=".xlsx,.xls,.xlsm,.csv" hidden></label>${L ? '<button type="button" class="plegar-todo" data-fr-sin-lluvias title="Quitar los datos de lluvia">✕</button>' : ''}` : ''}</span></div>
  </div>`;
}

// ── Lluvias ──
function frLluvias(){
  if (DB.lluvias === undefined && typeof SEED !== 'undefined' && SEED.lluvias) DB.lluvias = clone(SEED.lluvias);
  return DB.lluvias || null;
}
const frDia = f => Math.round(Date.parse(f + 'T00:00:00Z') / 864e5);
const frDiaF = d => new Date(d * 864e5).toISOString().slice(0, 10);
const frLargoLluvias = L => Math.max(0, ...Object.values(L.hac).map(a => a.length));
// Lluvia acumulada (mm) entre dos días (d1 incluido, d2 excluido), promedio de las haciendas ponderado por su área
function frLluviaRango(d1, d2, hacs){
  const L = frLluvias(); if (!L) return null;
  const H = frHaciendas(), base = frDia(L.ini), keys = Object.keys(L.hac).filter(k => !hacs || hacs.has(k));
  if (!keys.length) return null;
  let tot = 0, dias = 0;
  for (let d = d1; d < d2; d++) {
    let s = 0, w = 0;
    for (const k of keys) { const v = L.hac[k][d - base]; if (v == null) continue; const a = H.area[k] || 200; s += v * a; w += a; }
    if (w) { tot += s / w; dias++; }
  }
  return dias >= (d2 - d1) * 0.6 ? tot : null;
}
// Lluvia de los 15 días previos a una lectura
const frLluvia15 = (fecha, hacs) => frLluvias() ? frLluviaRango(frDia(fecha) - 15, frDia(fecha), hacs) : null;
// Texto para el informe
function frTextoLluvia(fecha){
  if (!frLluvias()) return '';
  const S = frHacsFiltro(), d = frDia(fecha), tot = frLluviaRango(d - 15, d, S); if (tot == null) return '';
  const z = [1, 2].map(z => frLluviaRango(d - 15, d, new Set(frHaciendas().lista.filter(x => x.z === z).map(x => x.k))));
  const ult3 = frLluviaRango(d - 3, d, S), ant = frLluviaRango(d - 30, d - 15, S);
  const nivel = tot < 15 ? 'muy bajos' : tot < 40 ? 'bajos' : tot < 90 ? 'moderados' : 'altos';
  return `Durante los 15 días previos al monitoreo realizado el ${frFechaL(fecha)} (período comprendido entre el ${frFechaL(frDiaF(d - 15))} y el ${frFechaL(frDiaF(d - 1))}), las áreas evaluadas registraron acumulados de precipitación ${nivel}, con un promedio de aproximadamente <b>${frNum(tot, 0)} mm</b>${z[0] != null && z[1] != null && !S ? ` (${frNum(z[0], 0)} mm en la Zona 1 y ${frNum(z[1], 0)} mm en la Zona 2)` : ''}. ` +
    (tot < 40 ? 'Estos valores evidencian una escasa oferta hídrica proveniente de las lluvias, por lo que el aporte natural de agua al perfil del suelo fue mínimo' : tot < 90 ? 'Estos valores representan un aporte moderado de agua al perfil del suelo' : 'Estos valores representan un aporte importante de agua al perfil del suelo, que favorece el ascenso de los niveles freáticos') +
    (ult3 != null && ult3 >= 15 ? `. Sin embargo, en los 3 días previos a la lectura se registraron ${frNum(ult3, 0)} mm, que pueden haber elevado temporalmente los niveles observados` : '') +
    (ant != null ? `. En la quincena anterior se habían registrado ${frNum(ant, 0)} mm, ${ant > tot * 1.2 ? 'por lo que el período evaluado fue más seco' : ant < tot * 0.8 ? 'por lo que el período evaluado fue más lluvioso' : 'un comportamiento similar'}` : '') + '.';
}
// Lectura del Excel de lluvias con SheetJS: formato largo (Hacienda/Pluviómetro, Fecha, Precipitación) o
// "Ponderado de Precipitaciones" (una hoja por mes con los días 1-31 en columnas)
async function frLeerLluvias(file){
  const XLSX = await cargarXLSX(), wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'});
  const H = frHaciendas(), datos = {};   // hacienda → fecha → [suma mm×área, suma área]
  // El nombre del pluviómetro suele llevar la hacienda ("Riopaila La Ranchera", "Ukrania Morillo", "1/2 Luna Caseta"):
  // se toma la hacienda de la cartografía más larga que aparezca en el nombre. Los generales ("Riopaila Agrícola") quedan aparte.
  const claves = H.lista.map(x => [frNorm(x.k), x.k]).sort((a, b) => b[0].length - a[0].length);
  const hacDe = n => { const t = frNorm(String(n || '').replace(/1\/2/g, 'media')); if (!t) return null; if (/agricola|castilla/.test(t)) return String(n).trim().toUpperCase();
    const c = claves.find(([nk]) => t.includes(nk)); return c ? c[1] : H.porNombre(n) || String(n).trim().toUpperCase(); };
  const poner = (hac, fecha, mm, area) => {
    if (!fecha || !(mm >= 0) || mm > 400) return;
    const k = hacDe(hac); if (!k) return;
    const D = datos[k] = datos[k] || {}, x = D[fecha] = D[fecha] || [0, 0], a = area > 0 ? area : 1;
    x[0] += mm * a; x[1] += a;
  };
  const fechaDe = v => { if (typeof v === 'number' && v > 30000 && v < 70000) return new Date(Math.round((v - 25569) * 864e5)).toISOString().slice(0, 10);
    const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(String(v || '')); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const m2 = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m2 ? m2[0] : null; };
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const anioArch = +((/20\d\d/.exec(file.name) || [])[0] || 0);
  let filas = 0;
  wb.SheetNames.forEach((nom, si) => {
    if (wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets[si] && wb.Workbook.Sheets[si].Hidden) return;
    const R = XLSX.utils.sheet_to_json(wb.Sheets[nom], {header:1, raw:true, defval:null});
    for (let r = 0; r < Math.min(20, R.length); r++) {
      const row = R[r] || [], n = row.map(frNorm);
      const cF = n.findIndex(x => x.startsWith('fecha')), cMm = n.findIndex(x => x.includes('precip') || x.includes('lluvia') || x === 'mm');
      const cH = n.findIndex(x => x.startsWith('hacienda')), cP = n.findIndex(x => x.startsWith('pluv')), cA = n.findIndex(x => x.startsWith('area'));
      // Formato largo
      if (cF >= 0 && cMm >= 0 && (cH >= 0 || cP >= 0)) {
        for (let i = r + 1; i < R.length; i++) { const x = R[i]; if (!x) continue; const v = +x[cMm]; if (x[cMm] == null || isNaN(v)) continue;
          poner(cH >= 0 ? x[cH] : 'PLUV ' + x[cP], fechaDe(x[cF]), v, 1); filas++; }
        return;
      }
      // Formato mensual: hoja con nombre de mes, encabezado con Hacienda y los días 1..31
      const mes = meses.findIndex(m => frNorm(nom).includes(m));
      const dias = row.map((x, i) => typeof x === 'number' && x >= 1 && x <= 31 && Number.isInteger(x) ? [i, x] : null).filter(Boolean);
      if (mes >= 0 && cH >= 0 && dias.length >= 20) {
        let anio = anioArch;
        if (!anio) for (let j = 0; j < r; j++) { const m = /20\d\d/.exec((R[j] || []).join(' ')); if (m) { anio = +m[0]; break; } }
        if (!anio) anio = new Date().getFullYear();
        // los días van en orden: si una columna baja (31 → 1), las siguientes son del mes siguiente
        let mesCol = mes, prev = 0; const col = dias.map(([i, d]) => { if (d < prev) mesCol++; prev = d; return [i, d, mesCol]; });
        // si el encabezado empieza en días altos y luego reinicia (ej. 19..31,1..4 en la hoja "Febrero 02"), esos días altos son del mes anterior
        const reinicia = col.some(c => c[2] !== mes);
        for (let i = r + 1; i < R.length; i++) { const x = R[i]; if (!x || !x[cH] || /total|acumul|promedio/i.test(String(x[cH]))) continue;
          for (const [c, d, mc] of col) { const v = x[c]; if (v == null || v === '' || isNaN(+v)) continue;
            const m0 = reinicia ? mc - 1 : mc, dt = new Date(Date.UTC(anio, m0, d)); if (dt.getUTCMonth() !== ((m0 % 12) + 12) % 12) continue;
            poner(x[cH], dt.toISOString().slice(0, 10), +v, cA >= 0 ? +x[cA] : 1); filas++; } }
        return;
      }
    }
  });
  return {datos, filas};
}
// Junta lo leído con lo que ya había (los días nuevos reemplazan) y lo guarda compacto
function frGuardarLluvias(nuevo, nombre){
  const F = freatico(), viejo = frLluvias(), dict = {};
  if (viejo) { const b = frDia(viejo.ini); Object.entries(viejo.hac).forEach(([k, a]) => a.forEach((v, i) => { if (v != null) (dict[k] = dict[k] || {})[frDiaF(b + i)] = v; })); }
  Object.entries(nuevo).forEach(([k, D]) => Object.entries(D).forEach(([f, [s, a]]) => (dict[k] = dict[k] || {})[f] = Math.round(s / a * 10) / 10));
  const desde = F ? frDia(frFechas(F)[0]) - 30 : -Infinity;
  let min = Infinity, max = -Infinity;
  Object.values(dict).forEach(D => Object.keys(D).forEach(f => { const d = frDia(f); if (d >= desde) { min = Math.min(min, d); max = Math.max(max, d); } }));
  if (!isFinite(min)) return null;
  const hac = {};
  Object.entries(dict).forEach(([k, D]) => { const a = new Array(max - min + 1).fill(null); let n = 0; Object.entries(D).forEach(([f, v]) => { const d = frDia(f); if (d >= min && d <= max) { a[d - min] = v; n++; } }); if (n) hac[k] = a; });
  const archivos = [...new Set([...(viejo && viejo.archivos || []), nombre])];
  return {archivos, ini:frDiaF(min), hac};
}
function frCargarLluvias(file){
  if (!file) return;
  toast(`⏳ Leyendo lluvias de ${file.name}…`);
  frLeerLluvias(file).then(({datos, filas}) => {
    if (!filas) { toast('⚠ No encontré lluvias en ese Excel (debe tener Fecha + Precipitación + Hacienda, o una hoja por mes con los días)'); return; }
    const L = frGuardarLluvias(datos, file.name);
    if (!L) { toast('⚠ Las lluvias de ese Excel son de antes de las lecturas de niveles'); return; }
    frE.evolFechas = '';
    modCambio(() => { DB.lluvias = L; });
    toast(`💧 Lluvias cargadas: ${Object.keys(L.hac).length} haciendas · ${frFecha(L.ini)} – ${frFecha(frDiaF(frDia(L.ini) + frLargoLluvias(L) - 1))} · recuerda 🚀 Publicar`);
  }).catch(e => { console.error(e); toast('⚠ No se pudo leer el Excel de lluvias: ' + (e.message || e)); });
}

// ── Comparar varias lecturas ──
const FR_MAX_COMP = 6;
function frRenderComparativo(cont, F){
  const fechasF = frFechasF(F);
  frE.sel = frE.sel.filter(f => F.lecturas[f]).slice(0, FR_MAX_COMP);
  if (!frE.sel.length) frE.sel = fechasF.slice(-2);
  const sel = frE.sel.slice().sort();
  const falta = sel.filter(f => !frE.cache[f]);
  if (falta.length) {
    if (!cont.querySelector('.fr-calc')) cont.insertAdjacentHTML('afterbegin', '<div class="fr-calc"></div>');
    cont.querySelector('.fr-calc').textContent = `⏳ Calculando mapas: ${sel.length - falta.length + 1} de ${sel.length}…`;
    setTimeout(() => { frCalculo(F, falta[0]); if (vistaActual === 'freat' && frE.modo === 'comp') renderFreatico(); }, 30);
    return;
  }
  const S = frHacsFiltro(), filas = sel.map(f => { const R = frRes(F, f), P = frCalculo(F, f).P.filter(p => frPozoOK(p) && p.v != null);
    return {f, R, t:R.total || 1, P, prom:P.length ? sum(P, p => p.v) / P.length : null, ll:frLluvia15(f, S)}; });
  const hayLl = filas.some(x => x.ll != null);
  // Selector de lecturas agrupado por año (las del filtro de año/mes)
  const porAnio = {}; fechasF.slice().reverse().forEach(f => (porAnio[f.slice(0, 4)] = porAnio[f.slice(0, 4)] || []).push(f));
  const selector = Object.entries(porAnio).sort((a, b) => b[0].localeCompare(a[0])).map(([a, L]) => `<div class="fr-fg"><span>${a}</span>${L.map(f => `<button type="button" class="fr-ch ${frE.sel.includes(f) ? 'on' : ''}" data-fr-sel="${f}">${frFecha(f, false)}</button>`).join('')}</div>`).join('');
  const pc = (x, k) => x.R.clases[k] / x.t * 100, malo = x => pc(x, 0) + pc(x, 1);
  // Haciendas: % crítico + subcrítico en cada lectura
  const hk = [...new Set(filas.flatMap(x => Object.keys(x.R.hac)))].sort((a, b) => frNomHac(a).localeCompare(frNomHac(b)));
  const hp = (x, h) => { const c = x.R.hac[h]; if (!c) return null; const t = c.reduce((a, b) => a + b, 0); return t ? (c[0] + c[1]) / t * 100 : null; };
  const color = p => p == null ? '' : `background:${p >= 30 ? '#fecaca' : p >= 15 ? '#fed7aa' : p >= 5 ? '#fef9c3' : '#dcfce7'}`;
  // Pozos que más cambiaron entre la primera y la última lectura
  const pri = filas[0], ult = filas[filas.length - 1];
  const mapaPri = {}; pri.P.forEach(p => mapaPri[p.n] = p.v);
  const cambios = ult.P.filter(p => mapaPri[p.n] != null).map(p => ({p, d:p.v - mapaPri[p.n]}));
  const subieron = cambios.filter(x => x.d <= -0.1).sort((a, b) => a.d - b.d).slice(0, 8), bajaron = cambios.filter(x => x.d >= 0.1).sort((a, b) => b.d - a.d).slice(0, 8);
  const mapas = filas.map(x => `<figure class="fr-mm"><img src="${frPlano(frCalculo(F, x.f), 700, 0, false).cv.toDataURL('image/jpeg', 0.85)}" alt="Isóbatas ${frFecha(x.f)}"><figcaption><b>${frFecha(x.f)}</b> · ${frNum(malo(x), 1)}% crítico + subcrítico${x.ll != null ? ` · 💧 ${frNum(x.ll, 0)} mm` : ''}</figcaption></figure>`).join('');

  cont.innerHTML = `
    <div class="mod-top"><div><div class="sim-tit">💧 Niveles freáticos · Comparativo</div>
      <div class="sim-subt">${esc(frAlcanceTxt())} · ${sel.length} lecturas comparadas · interpolación IDW recortada a las suertes</div></div>
      <div class="fr-acc"><button type="button" class="mbtn mbtn-ghost" data-fr-cosecha>🌾 Cosecha vs niveles</button></div></div>
    ${frFuenteHTML()}
    ${frFiltrosHTML(F)}
    <div class="sim-card abierta fr-selcard"><div class="sim-card-h" style="cursor:default"><b>Lecturas a comparar</b> <span class="meta">· elige de 2 a ${FR_MAX_COMP} (usa los filtros de año y mes para encontrarlas)</span>
      <span class="fr-zoom"><button type="button" class="plegar-todo" data-fr-rapido="2">Últimas 2</button><button type="button" class="plegar-todo" data-fr-rapido="4">Últimas 4</button>
      <button type="button" class="plegar-todo" data-fr-rapido="mes" title="La lectura del mismo mes en cada año">Mismo mes cada año</button><button type="button" class="plegar-todo" data-fr-rapido="0">Limpiar</button></span></div>
      <div class="fr-selfechas">${selector || '<div class="meta">No hay lecturas con ese filtro de año / mes.</div>'}</div></div>
    ${sel.length < 2 ? '<div class="nores">Elige al menos 2 lecturas para comparar.</div>' : `
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Resumen por lectura</b> <span class="meta">· área (ha) y % por condición</span></div>
      <div class="sim-tw"><table class="sim-t fr-ctab"><thead><tr><th>Lectura</th>${hayLl ? '<th class="n">💧 Lluvia 15 d (mm)</th>' : ''}<th class="n">Pozos</th><th class="n">Nivel prom. (m)</th>${FR_CLASES.map(c => `<th class="n"><span class="fr-sw" style="background:${c.c}"></span>${c.n}</th>`).join('')}<th class="n">Crít.+Subcrít.</th></tr></thead>
      <tbody>${filas.map((x, i) => `<tr><td class="b">${frFecha(x.f)}</td>${hayLl ? `<td class="n">${x.ll != null ? frNum(x.ll, 0) : '—'}</td>` : ''}<td class="n">${x.P.length}</td><td class="n">${x.prom != null ? frNum(x.prom) : '—'}</td>
        ${FR_CLASES.map((c, k) => `<td class="n">${frNum(x.R.clases[k], 0)} <small class="meta">${frNum(pc(x, k), 1)}%</small></td>`).join('')}
        <td class="n b">${frNum(malo(x), 1)}%${i ? (() => { const d = malo(x) - malo(filas[i - 1]); return Math.abs(d) < 0.5 ? '' : ` <small style="color:${d > 0 ? 'var(--red)' : 'var(--green)'}">${d > 0 ? '▲' : '▼'}${frNum(Math.abs(d), 1)}</small>`; })() : ''}</td></tr>`).join('')}</tbody></table></div>
      ${frGraficoComp(filas, hayLl)}</div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Mapas de isóbatas</b></div><div class="fr-mms">${mapas}</div></div>
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Por hacienda</b> <span class="meta">· % del área en crítico + subcrítico</span></div>
        <div class="sim-tw" style="max-height:420px"><table class="sim-t fr-ctab"><thead><tr><th>Hacienda</th>${filas.map(x => `<th class="n">${frFecha(x.f, false)}${filas.some(y => y.f.slice(0, 4) !== x.f.slice(0, 4)) ? ` '${x.f.slice(2, 4)}` : ''}</th>`).join('')}<th class="n">Cambio</th></tr></thead>
        <tbody>${hk.map(h => { const v = filas.map(x => hp(x, h)), d = v[v.length - 1] != null && v[0] != null ? v[v.length - 1] - v[0] : null;
          return `<tr><td>${esc(frNomHac(h))}</td>${v.map(p => `<td class="n" style="${color(p)}">${p != null ? frNum(p, 0) + '%' : '—'}</td>`).join('')}<td class="n b">${d == null || Math.abs(d) < 0.5 ? '<span class="meta">=</span>' : `<span style="color:${d > 0 ? 'var(--red)' : 'var(--green)'}">${d > 0 ? '▲' : '▼'} ${frNum(Math.abs(d), 0)}</span>`}</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Pozos con más cambio</b> <span class="meta">· entre ${frFecha(pri.f)} y ${frFecha(ult.f)}</span></div>
        <div class="fr-cambios"><div><h4>▲ El agua subió</h4>${subieron.map(x => `<div><b>Pozo ${x.p.n}</b> ${esc(x.p.h)} <span>${frNum(mapaPri[x.p.n])} → ${frNum(x.p.v)} m</span></div>`).join('') || '<div class="meta">Ninguno subió más de 10 cm</div>'}</div>
        <div><h4>▼ El agua bajó</h4>${bajaron.map(x => `<div><b>Pozo ${x.p.n}</b> ${esc(x.p.h)} <span>${frNum(mapaPri[x.p.n])} → ${frNum(x.p.v)} m</span></div>`).join('') || '<div class="meta">Ninguno bajó más de 10 cm</div>'}</div></div></div>
    </div>
    <div class="fr-inf fr-inf-c"><button type="button" class="mbtn" data-fr-informe-comp>📄 Generar informe comparativo · ${sel.length} lecturas</button>
      <span class="meta">Informe con las ${sel.length} lecturas${hayLl ? ', las lluvias' : ''}, mapas, tablas, análisis por hacienda y pozos, y conclusiones${frFiltroClave() ? ` (solo ${esc(frAlcanceTxt())})` : ''}</span></div>`}`;
}
// Gráfico: barras 100% por lectura y, si hay, la lluvia de los 15 días previos (línea azul, eje derecho)
function frGraficoComp(filas, hayLl){
  const W = 760, H = 250, ml = 40, mr = hayLl ? 46 : 12, mt = 14, mb = 34, n = filas.length, bw = Math.min(70, (W - ml - mr) / n * 0.55);
  const X = i => ml + (i + 0.5) * (W - ml - mr) / n, Y = p => mt + (100 - p) / 100 * (H - mt - mb);
  const mx = hayLl ? Math.max(10, ...filas.map(x => x.ll || 0)) * 1.15 : 1, YL = v => mt + (1 - v / mx) * (H - mt - mb);
  const barras = filas.map((x, i) => { let acc = 0; return [3, 2, 1, 0].map(k => { const p = x.R.clases[k] / x.t * 100, y0 = Y(acc + p), y1 = Y(acc); acc += p; return `<rect x="${X(i) - bw / 2}" y="${y0}" width="${bw}" height="${Math.max(0, y1 - y0)}" fill="${FR_CLASES[k].c}"><title>${FR_CLASES[k].n}: ${frNum(p, 1)}%</title></rect>`; }).join('')
    + `<text x="${X(i)}" y="${H - mb + 14}" text-anchor="middle" class="b">${frFecha(x.f, false)}</text><text x="${X(i)}" y="${H - mb + 26}" text-anchor="middle">${x.f.slice(0, 4)}</text>`; }).join('');
  const linea = hayLl ? `<path d="${filas.map((x, i) => x.ll == null ? '' : `${i && filas[i - 1].ll != null ? 'L' : 'M'}${X(i)},${YL(x.ll)}`).join('')}" fill="none" stroke="#1d4ed8" stroke-width="2.2"/>
    ${filas.map((x, i) => x.ll == null ? '' : `<circle cx="${X(i)}" cy="${YL(x.ll)}" r="4" fill="#1d4ed8"/><text x="${X(i) + 6}" y="${YL(x.ll) - 6}" fill="#1d4ed8" class="b">${frNum(x.ll, 0)} mm</text>`).join('')}
    ${[0, 0.5, 1].map(f => `<text x="${W - mr + 4}" y="${YL(mx * f) + 3}" fill="#1d4ed8">${frNum(mx * f, 0)}</text>`).join('')}` : '';
  return `<svg class="fr-cgraf" viewBox="0 0 ${W} ${H}">${[0, 25, 50, 75, 100].map(p => `<line x1="${ml}" x2="${W - mr}" y1="${Y(p)}" y2="${Y(p)}" stroke="#e2e8f0"/><text x="${ml - 5}" y="${Y(p) + 3}" text-anchor="end">${p}%</text>`).join('')}${barras}${linea}</svg>
    <div class="fr-cley">${FR_CLASES.map(c => `<span><i style="background:${c.c}"></i>${c.n}</span>`).join('')}${hayLl ? '<span><i style="background:#1d4ed8;height:3px"></i>Lluvia 15 días previos (mm)</span>' : ''}</div>`;
}
// Rápidos del selector
function frSelRapido(F, modo){
  const L = frFechasF(F);
  if (modo === '0') frE.sel = [];
  else if (modo === 'mes') {
    const ref = (frE.sel.slice().sort().pop() || L[L.length - 1] || ''), mes = ref.slice(5, 7), dia = +ref.slice(8, 10);
    const porAnio = {}; L.filter(f => f.slice(5, 7) === mes).forEach(f => { const a = f.slice(0, 4), d = Math.abs(+f.slice(8, 10) - dia); if (!porAnio[a] || d < porAnio[a][1]) porAnio[a] = [f, d]; });
    frE.sel = Object.values(porAnio).map(x => x[0]).sort().slice(-FR_MAX_COMP);
  } else frE.sel = L.slice(-(+modo));
}

// ── Informe comparativo ──
function frInformeComparativo(){
  const F = freatico(), sel = frE.sel.slice().sort(); if (sel.length < 2) return;
  const S = frHacsFiltro(), alcance = frFiltroClave() ? frAlcanceTxt() : '';
  const filas = sel.map(f => { const R = frRes(F, f), P = frCalculo(F, f).P.filter(p => frPozoOK(p) && p.v != null); return {f, R, t:R.total || 1, P, ll:frLluvia15(f, S)}; });
  const hayLl = filas.some(x => x.ll != null), pc = (x, k) => x.R.clases[k] / x.t * 100, malo = x => pc(x, 0) + pc(x, 1);
  const pri = filas[0], ult = filas[filas.length - 1], n1 = (x, d = 1) => frNum(x, d), ha2 = x => frNum(x, 2);
  const peor = filas.reduce((a, b) => malo(b) > malo(a) ? b : a), mejor = filas.reduce((a, b) => malo(b) < malo(a) ? b : a);
  const hoy = new Date(), hoyTxt = `${frMesL[hoy.getMonth()].replace(/^./, c => c.toUpperCase())} ${hoy.getDate()} del ${hoy.getFullYear()}`;
  const abs = u => new URL(u, document.baseURI).href, logo = abs('img/logo-riopaila.png');
  const portada = DB.portada && DB.portada.imagen ? DB.portada.imagen : abs('img/portada.svg');
  const lista = sel.map(frFechaL).join(', ').replace(/, ([^,]*)$/, ' y $1');
  const editable = (txt, ph) => `<p class="ed${txt ? '' : ' vacio'}" contenteditable="true" data-ph="${ph}">${txt}</p>`;
  const cambio = (a, b) => Math.abs(b - a) < 0.5 ? 'se mantuvo prácticamente igual' : b > a ? `aumentó ${n1(b - a)} puntos porcentuales` : `disminuyó ${n1(a - b)} puntos porcentuales`;
  const hk = [...new Set(filas.flatMap(x => Object.keys(x.R.hac)))];
  const hp = (x, h) => { const c = x.R.hac[h]; if (!c) return null; const t = c.reduce((a, b) => a + b, 0); return t ? (c[0] + c[1]) / t * 100 : null; };
  const hacC = hk.map(h => ({h, a:hp(pri, h), b:hp(ult, h)})).filter(x => x.a != null && x.b != null).map(x => ({...x, d:x.b - x.a}));
  const empeoraron = hacC.filter(x => x.d >= 5).sort((a, b) => b.d - a.d).slice(0, 5), mejoraron = hacC.filter(x => x.d <= -5).sort((a, b) => a.d - b.d).slice(0, 5);
  const mapaPri = {}; pri.P.forEach(p => mapaPri[p.n] = p.v);
  const cambios = ult.P.filter(p => mapaPri[p.n] != null).map(p => ({p, d:p.v - mapaPri[p.n]}));
  const subieron = cambios.filter(x => x.d <= -0.2).sort((a, b) => a.d - b.d), bajaron = cambios.filter(x => x.d >= 0.2).sort((a, b) => b.d - a.d);
  const conLl = filas.filter(x => x.ll != null);
  let corr = null;
  if (conLl.length >= 3) { const xs = conLl.map(x => x.ll), ys = conLl.map(malo), mx = sum(xs, v => v) / xs.length, my = sum(ys, v => v) / ys.length;
    const sxy = sum(xs.map((v, i) => (v - mx) * (ys[i] - my)), v => v), sxx = sum(xs, v => (v - mx) ** 2), syy = sum(ys, v => (v - my) ** 2); corr = sxx && syy ? sxy / Math.sqrt(sxx * syy) : null; }
  const pLluvia = hayLl ? `La Tabla 1 resume la precipitación acumulada en los 15 días previos a cada lectura. ${(() => { const mxL = conLl.reduce((a, b) => b.ll > a.ll ? b : a), mnL = conLl.reduce((a, b) => b.ll < a.ll ? b : a);
      return `El período más lluvioso fue el previo a la lectura del ${frFechaL(mxL.f)} (${n1(mxL.ll, 0)} mm), con ${n1(malo(mxL))}% del área en condiciones críticas y subcríticas, y el más seco el previo al ${frFechaL(mnL.f)} (${n1(mnL.ll, 0)} mm), con ${n1(malo(mnL))}%.`; })()}${corr != null ? ` Entre las lecturas comparadas, la relación entre la lluvia de los 15 días previos y el área con niveles críticos y subcríticos es ${Math.abs(corr) >= 0.7 ? 'fuerte' : Math.abs(corr) >= 0.4 ? 'moderada' : 'débil'} (r = ${n1(corr, 2)})${corr >= 0.4 ? ', lo que confirma que el ascenso de los niveles freáticos responde principalmente a las lluvias' : corr <= -0.4 ? ', una relación inversa que sugiere que otros factores (riegos, estado de la red de drenaje) dominan el comportamiento' : ', por lo que el comportamiento de los niveles también depende de otros factores como los riegos y el estado de la red de drenaje'}.` : ''}` : '';
  const pGeneral = `Entre la lectura del ${frFechaL(pri.f)} y la del ${frFechaL(ult.f)}, el área en condiciones críticas y subcríticas ${cambio(malo(pri), malo(ult))} (de ${n1(malo(pri))}% a ${n1(malo(ult))}%), mientras que el área en condición normal ${cambio(pc(pri, 3), pc(ult, 3))} (de ${n1(pc(pri, 3))}% a ${n1(pc(ult, 3))}%). ` +
    (filas.length > 2 ? `La lectura más desfavorable del período fue la del ${frFechaL(peor.f)}, con ${n1(malo(peor))}% del área (${ha2(peor.R.clases[0] + peor.R.clases[1])} ha) con niveles a menos de 1 m, y la más favorable la del ${frFechaL(mejor.f)}, con ${n1(malo(mejor))}%.` : '') +
    (malo(ult) > malo(pri) + 0.5 ? ' Esta tendencia indica un ascenso general de los niveles freáticos que debe contrastarse con las precipitaciones, los riegos y el estado de los canales.' : malo(ult) < malo(pri) - 0.5 ? ' Esta tendencia indica una mejoría en la evacuación del agua del perfil del suelo.' : ' El comportamiento general se mantiene estable.');
  const pHac = (empeoraron.length ? `Las haciendas con mayor aumento del área crítica y subcrítica fueron ${empeoraron.map(x => `<b>${esc(frNomHac(x.h))}</b> (de ${n1(x.a, 0)}% a ${n1(x.b, 0)}%)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}, que deben priorizarse en la revisión de la red de drenaje. ` : 'Ninguna hacienda aumentó en más de 5 puntos su área crítica y subcrítica. ') +
    (mejoraron.length ? `En cambio, ${mejoraron.map(x => `<b>${esc(frNomHac(x.h))}</b> (de ${n1(x.a, 0)}% a ${n1(x.b, 0)}%)`).join(', ').replace(/, ([^,]*)$/, ' y $1')} ${mejoraron.length === 1 ? 'presentó' : 'presentaron'} una mejoría.` : '');
  const pPozos = `De los ${cambios.length} pozos leídos en ambas fechas, en ${subieron.length} el agua subió más de 20 cm y en ${bajaron.length} bajó más de 20 cm.${subieron.length ? ` Los mayores ascensos se presentaron en ${subieron.slice(0, 5).map(x => `el pozo ${x.p.n} de ${esc(x.p.h)} (${frNum(mapaPri[x.p.n])} → ${frNum(x.p.v)} m)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : ''}`;
  const concl = [
    `En el período comparado (${frFechaL(pri.f)} a ${frFechaL(ult.f)}), el área con niveles freáticos críticos y subcríticos ${cambio(malo(pri), malo(ult))}, pasando de ${ha2(pri.R.clases[0] + pri.R.clases[1])} ha a ${ha2(ult.R.clases[0] + ult.R.clases[1])} ha.`,
    filas.length > 2 ? `La condición más desfavorable se presentó el ${frFechaL(peor.f)} (${n1(malo(peor))}% crítico + subcrítico) y la más favorable el ${frFechaL(mejor.f)} (${n1(malo(mejor))}%).` : '',
    hayLl && corr != null ? `La relación entre las lluvias de los 15 días previos y el área afectada fue ${Math.abs(corr) >= 0.7 ? 'fuerte' : Math.abs(corr) >= 0.4 ? 'moderada' : 'débil'} (r = ${n1(corr, 2)}).` : '',
    empeoraron.length ? `Las haciendas ${empeoraron.slice(0, 3).map(x => esc(frNomHac(x.h))).join(', ').replace(/, ([^,]*)$/, ' y $1')} presentaron el mayor deterioro y deben priorizarse en el mantenimiento de canales y drenajes.` : '',
    'Se recomienda mantener el monitoreo quincenal y las labores de mantenimiento de la infraestructura de drenaje, con especial atención antes de las temporadas de lluvia.',
  ].filter(Boolean);
  const mapas = filas.map(x => `<figure><img src="${frPlano(frCalculo(F, x.f), 900, 0, true).cv.toDataURL('image/jpeg', 0.85)}" alt=""><figcaption><b>${frFechaCorta(x.f)}</b> · ${n1(malo(x))}% crít.+subcrít.${x.ll != null ? ` · ${n1(x.ll, 0)} mm` : ''}</figcaption></figure>`).join('');
  const thF = filas.map(x => `<th>${frFechaCorta(x.f)}</th>`).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe comparativo de isóbatas ${frFechaCorta(pri.f)} a ${frFechaCorta(ult.f)}</title>
<style>${FR_INF_CSS}
  .mapas{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.mapas figure{margin:0;break-inside:avoid}.mapas img{width:100%;border:1px solid #cbd5e1}.mapas figcaption{font-size:9pt;text-align:center}
  .graf{width:100%}.graf text{font-size:10px;fill:#334155}.graf .b{font-weight:700}
  .heat td{font-size:9.5pt;padding:1mm 2mm}
  .fr-cley{display:flex;gap:5mm;justify-content:center;font-size:9pt;margin:1mm 0 4mm}.fr-cley i{display:inline-block;width:5mm;height:3.5mm;margin-right:1.5mm;vertical-align:-0.5mm}
</style></head><body>
<img class="logo-pie" src="${logo}" alt="">
<div class="barra"><b>Informe comparativo de isóbatas</b><span>Puedes corregir cualquier texto haciendo clic sobre él. Los espacios en gris son para completar.</span><button onclick="print()">🖨 Imprimir / Guardar PDF</button></div>
<div class="hoja portada"><div class="foto" style="background-image:url('${portada}')"></div><div class="velo"></div>
  <div class="caja"><div class="logo"><img src="${logo}" alt="Riopaila Agrícola"></div>
    <div class="pill t">Informe Comparativo<br>de Isóbatas</div>
    <div class="pill s">${frFechaL(pri.f)} a ${frFechaL(ult.f)}${alcance ? `<br>${esc(alcance)}` : ''}</div>
    <div class="pill s">Área de Ingeniería Agrícola<br><br><span contenteditable="true" class="ed">${hoyTxt}</span></div></div></div>

<div class="hoja"><h2>Objetivo</h2>
<p class="ed" contenteditable="true">El presente informe tiene como objetivo comparar el comportamiento espacial de las isóbatas correspondientes a los monitoreos del ${lista} ${alcance ? `en ${esc(alcance)}` : 'en las haciendas pertenecientes a Riopaila Agrícola'}, con el fin de identificar la evolución de los sectores vulnerables por excesos hídricos${hayLl ? ', su relación con las precipitaciones' : ''} y orientar las decisiones de mantenimiento y gestión de la red de drenaje agrícola.</p>
<h2>Metodología</h2>
<p class="ed" contenteditable="true">Las lecturas de nivel freático se obtuvieron mediante mediciones directas en la red de pozos de observación. Para cada fecha se generó el mapa de zonificación por interpolación Inverse Distance Weighting (IDW) recortado a las suertes, clasificando el área en las condiciones Crítico (0,0 – 0,5 m), Subcrítico (0,5 – 1,0 m), Regular (1,0 – 1,5 m) y Normal (1,5 – 2,0 m).${hayLl ? ' La precipitación corresponde al acumulado de los 15 días previos a cada lectura, promediado por hacienda según el registro de los pluviómetros.' : ''}</p>
<p class="cap"><b>Tabla 1.</b> Áreas por condición de nivel freático en cada lectura${hayLl ? ' y lluvia de los 15 días previos' : ''}.</p>
<table><tr><th>Lectura</th>${hayLl ? '<th>Lluvia 15 d (mm)</th>' : ''}${FR_INF.map((c, k) => `<th style="background:${['#ff0000', '#ffc000', '#ffff00', '#92d050'][k]};color:${k ? '#111' : '#fff'}">${c.n} (ha)</th>`).join('')}<th>Crít.+Subcrít. (%)</th></tr>
${filas.map(x => `<tr><td>${frFechaCorta(x.f)}</td>${hayLl ? `<td>${x.ll != null ? n1(x.ll, 0) : '—'}</td>` : ''}${[0, 1, 2, 3].map(k => `<td>${ha2(x.R.clases[k])}</td>`).join('')}<td><b>${n1(malo(x))}</b></td></tr>`).join('')}</table>
<div class="graf">${frGraficoComp(filas, hayLl).replace('</i>Bueno<', '</i>Normal<')}</div>
<div class="pie"><img src="${logo}" alt=""><span>1</span></div></div>

<div class="hoja"><h2>Mapas de isóbatas</h2><div class="mapas">${mapas}</div>
<div class="ley">${FR_CLASES.map((c, k) => `<span><i style="background:${c.c}"></i>${FR_INF[k].n} ${c.r} m</span>`).join('')}</div>
<div class="pie"><img src="${logo}" alt=""><span>2</span></div></div>

<div class="hoja"><h2>Análisis comparativo</h2>
<p class="ed" contenteditable="true">${pGeneral}</p>
${hayLl ? `<p class="ed" contenteditable="true">${pLluvia}</p>` : editable('', 'Análisis de precipitaciones del período (no hay datos de lluvia cargados en el panel)…')}
<p class="ed" contenteditable="true">${pHac}</p>
<p class="cap"><b>Tabla 2.</b> Porcentaje del área en condición crítica y subcrítica por hacienda.</p>
<table class="heat"><tr><th>Hacienda</th>${thF}<th>Cambio</th></tr>
${hk.sort((a, b) => frNomHac(a).localeCompare(frNomHac(b))).map(h => { const v = filas.map(x => hp(x, h)), d = v[v.length - 1] != null && v[0] != null ? v[v.length - 1] - v[0] : null;
  return `<tr><td style="text-align:left">${esc(frNomHac(h))}</td>${v.map(p => `<td style="${p == null ? '' : `background:${p >= 30 ? '#fecaca' : p >= 15 ? '#fed7aa' : p >= 5 ? '#fef9c3' : '#dcfce7'}`}">${p != null ? n1(p, 0) : '—'}</td>`).join('')}<td><b>${d == null ? '—' : Math.abs(d) < 0.5 ? '0' : (d > 0 ? '+' : '') + n1(d, 0)}</b></td></tr>`; }).join('')}</table>
<p class="ed" contenteditable="true">${pPozos}</p>
${editable('', 'Observaciones de campo del período (riegos, obras de drenaje, limpieza de canales…)')}
<div class="pie"><img src="${logo}" alt=""><span>3</span></div></div>

<div class="hoja"><h2>Conclusiones</h2>
<ul class="c">${concl.map(c => `<li class="ed" contenteditable="true">${c}</li>`).join('')}</ul>
${editable('', 'Conclusiones o recomendaciones adicionales…')}
<div class="pie"><img src="${logo}" alt=""><span>4</span></div></div>
<script>document.querySelectorAll('.ed').forEach(e => e.addEventListener('input', () => e.classList.toggle('vacio', !e.textContent.trim())));</script>
</body></html>`;
  frAbrirInforme(html);
}
function frAbrirInforme(html){
  const w = window.open('', '_blank');
  if (!w) { toast('⚠ El navegador bloqueó la ventana del informe: permite las ventanas emergentes para esta página'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

// ── Eventos de filtros, modo, comparativo y lluvias ──
q('freaticos').addEventListener('click', e => {
  const t = e.target;
  const ch = t.closest('[data-fr-f]');
  if (ch) {
    const g = ch.dataset.frF, v = g === 'z' || g === 'm' ? +ch.dataset.v : ch.dataset.v, L = frE.f[g], i = L.indexOf(v);
    i >= 0 ? L.splice(i, 1) : L.push(v);
    if (g === 'h' && frE.f.h.length) frE.f.z = [];
    if (g === 'z' && frE.f.z.length) frE.f.h = [];
    frE.vista = null; renderFreatico(); return;
  }
  if (t.closest('[data-fr-limpiar]')) { frE.f = {z:[], h:[], a:[], m:[]}; renderFreatico(); return; }
  const md = t.closest('[data-fr-modo]'); if (md) { frE.modo = md.dataset.frModo; if (frE.modo === 'comp' && !frE.sel.length) frE.sel = [frE.fecha]; renderFreatico(); return; }
  const sf = t.closest('[data-fr-sel]');
  if (sf) { const f = sf.dataset.frSel, i = frE.sel.indexOf(f); if (i >= 0) frE.sel.splice(i, 1); else if (frE.sel.length >= FR_MAX_COMP) { toast(`Máximo ${FR_MAX_COMP} lecturas: quita una primero`); return; } else frE.sel.push(f); renderFreatico(); return; }
  const rp = t.closest('[data-fr-rapido]'); if (rp) { frSelRapido(freatico(), rp.dataset.frRapido); renderFreatico(); return; }
  if (t.closest('[data-fr-informe-comp]')) { frInformeComparativo(); return; }
  if (t.closest('[data-fr-sin-lluvias]')) { if (confirm('¿Quitar los datos de lluvia del panel?')) { frE.evolFechas = ''; modCambio(() => { DB.lluvias = null; }); } }
});
q('freaticos').addEventListener('change', e => { if (e.target.id === 'fr-lluvias') { frCargarLluvias(e.target.files[0]); e.target.value = ''; } });
