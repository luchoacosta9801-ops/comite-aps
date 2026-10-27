// Cosecha vs niveles freáticos (#cosecha-niveles, vista 'nfcos'): cruza las suertes cosechadas (Excel) con los
// niveles freáticos de los días previos al corte, con el método de la hoja "sustento" del Registro de NF:
// a cada suerte se le asigna su pozo de influencia (el más cercano con lecturas), se promedian sus lecturas en la
// ventana antes del corte y se califica: < 0,8 m → 5 (afectación alta) · 0,8–1,2 m → 3 (moderada) · ≥ 1,2 m → 1 (sin afectación).
// Si el Excel trae TCH, compara la producción por criterio para sustentar la afectación.
// Datos: DB.cosechaNF {archivo, mes 'AAAA-MM' (para filas sin fecha), filas[{s, h, a, f, tch, tchp, tche, v, c}]}

const FR_CRIT = [
  {c:5, n:'Afectación alta',  r:'menos de 0,8 m', col:'#dc2626', max:0.8},
  {c:3, n:'Afectación media', r:'0,8 – 1,2 m',    col:'#f59e0b', max:1.2},
  {c:1, n:'Sin afectación',   r:'1,2 m o más',    col:'#16a34a', max:Infinity},
];
const frCrit = v => v == null ? null : v < 0.8 ? 5 : v < 1.2 ? 3 : 1;
const frCritDe = c => FR_CRIT.find(x => x.c === c);
const frcE = {ventana:45, base:'pozo', orden:'crit'};

function frCosecha(){
  if (DB.cosechaNF === undefined && typeof SEED !== 'undefined' && SEED.cosechaNF) DB.cosechaNF = clone(SEED.cosechaNF);
  return DB.cosechaNF || null;
}
// Código de suerte normalizado: 3107430 / "3107-430" / "3107 430" → "3107-430"
const frCodSuerte = v => { const d = String(v ?? '').replace(/\D/g, ''); return d.length === 7 ? d.slice(0, 4) + '-' + d.slice(4) : null; };

// ── Lectura del Excel de cosecha (cualquier hoja que tenga una columna de suertes) ──
async function frLeerCosecha(file){
  const XLSX = await cargarXLSX(), wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'});
  const fechaDe = v => { if (typeof v === 'number' && v > 30000 && v < 70000) return new Date(Math.round((Math.floor(v) - 25569) * 864e5)).toISOString().slice(0, 10);
    const m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(String(v || '')); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const m2 = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m2 ? m2[0] : null; };
  const num = v => { const x = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : null; };
  const cand = [];
  wb.SheetNames.forEach((nom, si) => {
    const oculta = !!(wb.Workbook && wb.Workbook.Sheets && wb.Workbook.Sheets[si] && wb.Workbook.Sheets[si].Hidden);
    const R = XLSX.utils.sheet_to_json(wb.Sheets[nom], {header:1, raw:true, defval:null});
    for (let r = 0; r < Math.min(20, R.length); r++) {
      const n = (R[r] || []).map(frNorm), col = (...p) => n.findIndex(x => p.some(f => typeof f === 'function' ? f(x) : x === f));
      const cS = [ 'secsueamortizar', 'secsue', 'sectorsuertecosechada', 'sectorsuerte', 'suerte', 'secste', 'ubicaciontecnica', 'codigo', 'lote']
        .map(k => n.findIndex(x => x === k || (k.length > 5 && x.startsWith(k)))).find(i => i >= 0);
      if (cS == null) continue;
      const filas = [];
      const cF = (() => { const a = col(x => x.includes('fecha') && (x.includes('corte') || x.includes('cosecha'))); return a >= 0 ? a : col(x => x.startsWith('fecha')); })();
      const cT = col('tchreal', x => x === 'tch'), cTp = col(x => x.startsWith('tch') && x.includes('ppto')), cTe = col(x => x.startsWith('tch') && x.includes('estim'));
      const cSec = col('sector'), cA = col(x => x.startsWith('area')), cH = col(x => x.includes('hacienda')), cV = col(x => x.startsWith('variedad')), cC = col(x => x.startsWith('corte') || x === 'numerodecorte' || x === 'cortenumero');
      for (let i = r + 1; i < R.length; i++) {
        const x = R[i]; if (!x) continue; const s = frCodSuerte(x[cS]) || (cSec >= 0 && x[cSec] != null && x[cS] != null ? frCodSuerte(String(x[cSec]) + String(x[cS]).replace(/\D/g, '').padStart(3, '0')) : null); if (!s) continue;
        filas.push({s, h:cH >= 0 && x[cH] ? String(x[cH]).trim() : '', a:cA >= 0 ? num(x[cA]) : null, f:cF >= 0 ? fechaDe(x[cF]) : null,
          tch:cT >= 0 ? num(x[cT]) : null, tchp:cTp >= 0 ? num(x[cTp]) : null, tche:cTe >= 0 ? num(x[cTe]) : null, v:cV >= 0 && x[cV] ? String(x[cV]).trim() : '', c:cC >= 0 ? num(x[cC]) : null});
      }
      // Preferencia: hojas con fecha de corte y TCH, luego visibles, luego con más suertes
      if (filas.length) cand.push({hoja:nom, filas, oculta, conFecha:filas.filter(x => x.f).length,
        puntos:(filas.some(x => x.f) ? 1e7 : 0) + (filas.some(x => x.tch > 0) ? 1e7 : 0) + (oculta ? 0 : 1e6) + filas.length});
      break;
    }
  });
  return cand.sort((a, b) => b.puntos - a.puntos);
}
function frCargarCosecha(file){
  if (!file) return;
  toast(`⏳ Leyendo ${file.name}…`);
  frLeerCosecha(file).then(cand => {
    if (!cand.length) { toast('⚠ No encontré suertes en ese Excel (necesita una columna de suerte, ej. "Sec-Sue" o "Sector suerte", con códigos como 3107-430)'); return; }
    // Si hay varias hojas con suertes, se usa la mejor y se puede cambiar (frcE.cand, solo en esta sesión)
    frcE.cand = cand.length > 1 ? {archivo:file.name, lista:cand} : null;
    frUsarHojaCosecha(file.name, cand[0]);
  }).catch(e => { console.error(e); toast('⚠ No se pudo leer ese Excel: ' + (e.message || e)); });
}
function frUsarHojaCosecha(archivo, d){
  // Un mismo corte repetido (varias filas de la misma suerte y fecha) se deja una vez
  const vistos = new Set(), filas = d.filas.filter(x => { const k = x.s + '|' + (x.f || ''); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const mes = (frCosecha() && frCosecha().mes) || '';
  modCambio(() => { DB.cosechaNF = {archivo, hoja:d.hoja, mes, filas}; });
  const sinF = filas.filter(x => !x.f).length;
  toast(`🌾 ${filas.length} suertes (hoja «${d.hoja}»)${sinF ? ` · ${sinF} sin fecha de corte: elige el mes de cosecha` : ''} · recuerda 🚀 Publicar`);
}

// ── Análisis ──
let FRC = null;   // centro de cada suerte de la cartografía (por código)
function frCentros(){
  if (FRC) return FRC;
  const G = frMalla(), M = MAPA_FREATICO, sx = {}, sy = {}, n = {}, ha = {}, hac = {};
  for (let i = 0; i < G.idx.length; i++) { const s = M.suertes[G.sue[i]], k = s[0]; sx[k] = (sx[k] || 0) + G.cx[i]; sy[k] = (sy[k] || 0) + G.cy[i]; n[k] = (n[k] || 0) + 1; }
  M.suertes.forEach(s => { ha[s[0]] = (ha[s[0]] || 0) + s[2]; hac[s[0]] = s[1]; });
  const C = {}; Object.keys(n).forEach(k => C[k] = {x:sx[k] / n[k], y:sy[k] / n[k], ha:ha[k], h:hac[k]});
  return FRC = C;
}
// Nivel en un punto por IDW (potencia 2,75, como el mapa)
function frIDWPunto(P, x, y){
  let sw = 0, sv = 0;
  for (const p of P) { if (p.v == null) continue; const d2 = (p.x - x) ** 2 + (p.y - y) ** 2; if (d2 < 1) return p.v; const r4 = Math.sqrt(Math.sqrt(d2)), w = 1 / (d2 * r4 * Math.sqrt(r4)); sw += w; sv += w * p.v; }
  return sw ? sv / sw : null;
}
// Fecha que se analiza: la del corte, o el mismo día un año antes (para ver las condiciones del año anterior)
const FRC_ANIO = {
  menos1:'Todas un año antes (mismo día del año anterior)',
  solo2026:'Solo las de 2026 un año antes; las de 2025 en su fecha',
  excel:'Fecha de corte del Excel',
};
frcE.anio = 'menos1';
const frcAnioAntes = f => `${+f.slice(0, 4) - 1}-${f.slice(5) === '02-29' ? '02-28' : f.slice(5)}`;
const frcFechaAnalisis = fc => !fc ? fc : frcE.anio === 'menos1' || (frcE.anio === 'solo2026' && fc >= '2026-01-01') ? frcAnioAntes(fc) : fc;
// Zona agroecológica del maestro (ej. 11H1): grupo de suelo 11 y grupo de humedad H1
const frcZona = za => { const m = /^(\d+)\s*H(\d)$/i.exec(String(za || '').trim()); return m ? {suelo:+m[1], hum:'H' + m[2]} : null; };
const frcMedia = L => L.length ? sum(L, v => v) / L.length : null;
function frcCorr(xs, ys){
  if (xs.length < 5) return null;
  const mx = frcMedia(xs), my = frcMedia(ys), sxy = sum(xs.map((v, i) => (v - mx) * (ys[i] - my)), v => v), sxx = sum(xs, v => (v - mx) ** 2), syy = sum(ys, v => (v - my) ** 2);
  return sxx && syy ? {r:sxy / Math.sqrt(sxx * syy), m:sxy / sxx, b:my - sxy / sxx * mx, n:xs.length} : null;
}
const frcFuerza = r => Math.abs(r) >= 0.5 ? 'fuerte' : Math.abs(r) >= 0.3 ? 'moderada' : 'débil';

function frCosechaAnalisis(){
  const K = frCosecha(), F = freatico(); if (!K || !F || typeof MAPA_FREATICO === 'undefined') return null;
  const C = frCentros(), fechas = frFechas(F), ven = frcE.ventana, M = MAPA_FREATICO;
  const pozos = F.pozos.filter(p => p[1] != null).map(p => { const [x, y] = frTM(p[1], p[2]); return {n:p[0], h:p[3], x:x - M.x0, y:y - M.y0}; });
  const puntos = {}, P = f => puntos[f] = puntos[f] || frPuntos(F, f);
  const mesDef = K.mes ? K.mes + '-15' : null;
  // Maestro (zona agroecológica, variedad) y lluvias por hacienda (si la hacienda no tiene pluviómetro: las de su zona)
  const MS = {}; if (typeof msFilas === 'function') msFilas().forEach(x => { if (!MS[x.s] || x.emp === 'RIOP') MS[x.s] = x; });
  const L = frLluvias(), H = frHaciendas(), memo = {};
  const hacLl = h => { if (!L || !h) return null; if (L.hac[h]) return new Set([h]); const s = new Set(Object.keys(L.hac).filter(k => H.area[k] && H.zona[k] === H.zona[h])); return s.size ? s : null; };
  const llu = (d1, d2, S) => { const k = d1 + '|' + d2 + '|' + [...S].join(); return k in memo ? memo[k] : memo[k] = frLluviaRango(d1, d2, S); };
  // Lluvia "normal" de esa misma ventana: promedio de los demás años con datos
  const lluNormal = (d1, d2, S) => { const v = []; for (let k = -8; k <= 2; k++) { if (!k) continue; const o = Math.round(k * 365.25), x = llu(d1 + o, d2 + o, S); if (x != null) v.push(x); } return v.length >= 2 ? frcMedia(v) : null; };
  const filas = K.filas.map(r => {
    const fc = r.f || mesDef, fa = frcFechaAnalisis(fc), c = C[r.s], ms = MS[r.s], z = frcZona(ms && ms.zonaAgro);
    const o = {...r, fc, fa, ha:r.a || (ms && ms.area) || (c && c.ha) || 0, hac:r.h || (c ? frNomHac(c.h) : ms ? frNomHac(ms.hac) : ''), hk:c && c.h,
      za:ms && ms.zonaAgro || '', suelo:z && z.suelo, hum:z && z.hum, vari:r.v || (ms && ms.variedad) || ''};
    if (!fc) return {...o, motivo:'sin fecha de corte'};
    if (!c) return {...o, motivo:'suerte no está en la cartografía'};
    const d = frDia(fa);
    // Lluvia antes del corte (misma ventana que los niveles) y frente a lo normal de esa época
    const S = hacLl(c.h), lluvia = S ? llu(d - ven, d, S) : null, normal = S && lluvia != null ? lluNormal(d - ven, d, S) : null;
    const l15 = S ? llu(d - 15, d, S) : null;
    Object.assign(o, {lluvia, normal, anom:lluvia != null && normal ? lluvia / normal : null, l15, lluHac:S && S.size === 1 && L.hac[c.h] ? frNomHac(c.h) : S ? 'zona ' + H.zona[c.h] : ''});
    let ven2 = fechas.filter(f => { const x = frDia(f); return x <= d && x > d - ven; });
    if (!ven2.length) { const ant = fechas.filter(f => frDia(f) <= d).pop(); if (ant && frDia(ant) > d - ven - 20) ven2 = [ant]; }
    if (!ven2.length) return {...o, motivo:'sin lecturas antes del corte'};
    // Pozo de influencia: el más cercano que tenga lecturas en la ventana
    const cand = pozos.map(p => ({p, d:Math.hypot(p.x - c.x, p.y - c.y)})).sort((a, b) => a.d - b.d);
    let pi = null, vals = [];
    for (const x of cand) { const v = ven2.map(f => frVal(F.lecturas[f][x.p.n])).filter(v => v != null); if (v.length) { pi = x; vals = v; break; } }
    const nPozo = vals.length ? frcMedia(vals) : null;
    const idw = ven2.map(f => frIDWPunto(P(f), c.x, c.y)).filter(v => v != null), nIdw = idw.length ? frcMedia(idw) : null;
    const nivel = frcE.base === 'idw' ? nIdw : nPozo;
    return {...o, ven:ven2, pozo:pi && pi.p.n, dist:pi && pi.d, nPozo, nIdw, nivel, crit:frCrit(nivel), min:vals.length ? Math.min(...vals) : null};
  });
  const ok = filas.filter(x => x.crit), conTch = ok.filter(x => x.tch > 0);
  const por = c => ok.filter(x => x.crit === c), haDe = L2 => sum(L2, x => x.ha || 0);
  const pond = (L2, f) => { const L3 = L2.filter(x => f(x) != null), w = sum(L3, x => x.ha || 1); return L3.length ? sum(L3, x => f(x) * (x.ha || 1)) / w : null; };
  const tchP = L2 => pond(L2, x => x.tch), refP = L2 => pond(L2.filter(x => x.tchp > 0 || x.tche > 0), x => x.tche || x.tchp);
  const grupo = L2 => ({n:L2.length, ha:haDe(L2), 5:L2.filter(x => x.crit === 5).length, 3:L2.filter(x => x.crit === 3).length, 1:L2.filter(x => x.crit === 1).length,
    ha5:haDe(L2.filter(x => x.crit === 5)), nivel:pond(L2, x => x.nivel), lluvia:pond(L2, x => x.lluvia), normal:pond(L2, x => x.normal), anom:pond(L2, x => x.anom)});
  const resumen = FR_CRIT.map(k => { const L2 = por(k.c), T = L2.filter(x => x.tch > 0); return {...k, ...grupo(L2), tch:tchP(T), ref:refP(T), nT:T.length}; });
  const agrupar = f => { const g = {}; ok.forEach(x => { const k = f(x); if (k != null && k !== '') (g[k] = g[k] || []).push(x); }); const o = {}; Object.keys(g).forEach(k => o[k] = grupo(g[k])); return o; };
  const reg = frcCorr(conTch.map(x => x.nivel), conTch.map(x => x.tch));
  const conLl = ok.filter(x => x.lluvia != null), regLl = frcCorr(conLl.map(x => x.lluvia), conLl.map(x => x.nivel));
  // Serie mensual del período analizado: lluvia del mes (haciendas de las suertes) y nivel promedio de sus pozos
  const fas = ok.map(x => x.fa).sort(), serie = [];
  if (fas.length) {
    const Sll = new Set(); ok.forEach(x => { const S = hacLl(x.hk); if (S) S.forEach(k => Sll.add(k)); });
    const pz = [...new Set(ok.map(x => x.pozo))];
    let [y, m] = frDiaF(frDia(fas[0]) - ven).slice(0, 7).split('-').map(Number); const fin = fas[fas.length - 1].slice(0, 7);
    for (let i = 0; i < 40; i++) {
      const mm = `${y}-${String(m).padStart(2, '0')}`; if (mm > fin) break;
      const d1 = frDia(mm + '-01'), ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1, d2 = frDia(`${ny}-${String(nm).padStart(2, '0')}-01`);
      const lec = fechas.filter(f => f.startsWith(mm)).flatMap(f => pz.map(n => frVal(F.lecturas[f][n])).filter(v => v != null));
      serie.push({m:mm, lluvia:Sll.size ? frLluviaRango(d1, d2, Sll) : null, nivel:frcMedia(lec), n:ok.filter(x => x.fa.startsWith(mm)).length});
      y = ny; m = nm;
    }
  }
  const meses = {}; ok.forEach(x => { const m = x.fa.slice(0, 7); (meses[m] = meses[m] || {5:0, 3:0, 1:0, ha5:0, n:0}); meses[m][x.crit]++; meses[m].n++; if (x.crit === 5) meses[m].ha5 += x.ha || 0; });
  const A = {filas, ok, resumen, reg, regLl, meses, hacs:agrupar(x => x.hac || '—'), suelos:agrupar(x => x.suelo), hums:agrupar(x => x.hum), zonas:agrupar(x => x.za),
    conTch, serie, total:{...grupo(ok)}, sin:filas.filter(x => !x.crit), hayLl:conLl.length > 0, desplazadas:ok.filter(x => x.fa !== x.fc).length};
  ok.forEach(x => x.just = frcJustificar(x, A));
  return A;
}
// Por qué la suerte se vio (o no) afectada, en una frase para el informe
function frcJustificar(x, A){
  const n = (v, d = 2) => frNum(v, d), suelo = x.suelo ? `suelo del grupo ${x.suelo}${x.hum ? `, humedad ${x.hum}` : ''}` : '';
  const sueloRiesgo = x.suelo && A.suelos[x.suelo] && A.suelos[x.suelo].n >= 3 && A.suelos[x.suelo][5] / A.suelos[x.suelo].n >= 0.5;
  const ll = x.lluvia == null ? '' : `${n(x.lluvia, 0)} mm de lluvia en los ${frcE.ventana} días previos${x.anom ? ` (${n(x.anom * 100, 0)}% de lo normal para esa época)` : ''}`;
  const base = `Nivel freático promedio de ${n(x.nivel)} m${x.min != null && x.min < x.nivel - 0.05 ? ` (mínimo ${n(x.min)} m)` : ''} en el pozo ${x.pozo} a ${n(x.dist, 0)} m`;
  if (x.crit === 5) return `${base}: el agua estuvo dentro de la zona de raíces antes del corte.` +
    (ll ? ` Se registraron ${ll}${x.anom >= 1.2 ? ', lluvias por encima de lo normal que explican el ascenso del nivel' : x.anom != null && x.anom < 0.8 ? '; aun con lluvias por debajo de lo normal el nivel se mantuvo superficial, lo que apunta a drenaje insuficiente o aporte de riego / freático regional' : ''}.` : '') +
    (suelo ? ` ${suelo.replace(/^./, c => c.toUpperCase())}${sueloRiesgo ? ', grupo en el que la mayoría de las suertes cosechadas resultó con afectación alta' : ''}.` : '');
  if (x.crit === 3) return `${base}: humedad alta en el perfil, con afectación moderada.${ll ? ` ${ll.replace(/^./, c => c.toUpperCase())}.` : ''}${suelo ? ` ${suelo.replace(/^./, c => c.toUpperCase())}.` : ''}`;
  return `${base}: sin restricción por nivel freático.${ll ? ` ${ll.replace(/^./, c => c.toUpperCase())}.` : ''}`;
}

// ── Mapa de las suertes cosechadas coloreadas por criterio (canvas: vista, informe y PowerPoint) ──
function frcMapa(A, W = 1400){
  const M = MAPA_FREATICO, crit = {}; A.ok.forEach(x => crit[x.s] = Math.max(crit[x.s] || 0, x.crit));
  const pie = Math.round(W * 0.09), mapH = Math.round((W - 60) * M.alto / M.ancho), H = mapH + 40 + pie;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), k = W / 1400;
  const s = (W - 60) / M.ancho, ox = 30, oy = 20, sx = x => ox + x * s, sy = y => oy + (M.alto - y) * s;
  const linea = (r, cerrar) => { for (let i = 0; i < r.length; i += 2) { const x = sx(r[i]), y = sy(r[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } if (cerrar) g.closePath(); };
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#f1f5f9'; g.fillRect(ox, oy, M.ancho * s, M.alto * s);
  M.suertes.forEach(su => { g.beginPath(); su[3].forEach(r => linea(r, true)); const c = crit[su[0]]; g.fillStyle = c ? frCritDe(c).col : '#e2e8f0'; g.fill('evenodd'); });
  g.strokeStyle = 'rgba(15,23,42,.45)'; g.lineWidth = 0.6 * k; g.beginPath(); M.suertes.forEach(x => x[3].forEach(r => linea(r, true))); g.stroke();
  g.strokeStyle = '#2b7bd6'; g.lineWidth = 2 * k; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke();
  g.strokeStyle = '#0f172a'; g.lineWidth = 1.5 * k; g.strokeRect(ox, oy, M.ancho * s, M.alto * s);
  // Norte, escala y convenciones
  g.fillStyle = '#0f172a'; g.beginPath(); g.moveTo(W - 70 * k, 40 * k); g.lineTo(W - 84 * k, 78 * k); g.lineTo(W - 70 * k, 68 * k); g.lineTo(W - 56 * k, 78 * k); g.closePath(); g.fill();
  g.font = `700 ${22 * k}px Arial`; g.textAlign = 'center'; g.fillText('N', W - 70 * k, 104 * k); g.textAlign = 'left';
  g.fillRect(50 * k, oy + M.alto * s - 30 * k, 2000 * s, 7 * k); g.font = `600 ${16 * k}px Arial`; g.fillText('2 km', 58 * k + 2000 * s, oy + M.alto * s - 22 * k);
  const y0 = oy + mapH + 30 * k, items = [...FR_CRIT.map(c => [c.col, `${c.c} · ${c.n} (${c.r})`]), ['#e2e8f0', 'No cosechada / sin dato']];
  g.font = `${17 * k}px Arial`; let x0 = ox;
  items.forEach(([col, t]) => { g.fillStyle = col; g.fillRect(x0, y0, 26 * k, 18 * k); g.strokeStyle = '#0f172a'; g.lineWidth = 1; g.strokeRect(x0, y0, 26 * k, 18 * k); g.fillStyle = '#0f172a'; g.fillText(t, x0 + 34 * k, y0 + 15 * k); x0 += g.measureText(t).width + 70 * k; });
  return cv;
}

// ── Gráficos SVG (vista e informe) ──
// Lluvia antes del corte por criterio frente a lo normal de esa época
function frcGrafLluvia(R){
  const L = R.filter(k => k.lluvia != null); if (!L.length) return '';
  const W = 420, H = 210, ml = 36, mb = 40, mt = 18, mx = Math.max(...L.map(k => Math.max(k.lluvia, k.normal || 0))) * 1.15 || 1;
  const g = (W - ml - 20) / L.length, bw = 30, X = i => ml + 10 + i * g + g / 2, Y = v => mt + (1 - v / mx) * (H - mt - mb);
  return `<svg class="frc-svg" viewBox="0 0 ${W} ${H}">${[0, 0.5, 1].map(f => `<line x1="${ml}" x2="${W - 6}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="#e2e8f0"/><text x="${ml - 4}" y="${Y(mx * f) + 3}" text-anchor="end">${frNum(mx * f, 0)}</text>`).join('')}
    ${L.map((k, i) => `<rect x="${X(i) - bw - 2}" y="${Y(k.lluvia)}" width="${bw}" height="${Y(0) - Y(k.lluvia)}" fill="${k.col}" rx="3"/><text x="${X(i) - bw / 2 - 2}" y="${Y(k.lluvia) - 4}" text-anchor="middle" class="b">${frNum(k.lluvia, 0)}</text>
      ${k.normal ? `<rect x="${X(i) + 2}" y="${Y(k.normal)}" width="${bw}" height="${Y(0) - Y(k.normal)}" fill="#94a3b8" rx="3"/><text x="${X(i) + bw / 2 + 2}" y="${Y(k.normal) - 4}" text-anchor="middle">${frNum(k.normal, 0)}</text>` : ''}
      <text x="${X(i)}" y="${H - mb + 14}" text-anchor="middle" class="b">Criterio ${k.c}</text><text x="${X(i)}" y="${H - mb + 26}" text-anchor="middle">${k.n} suertes</text>`).join('')}</svg>
    <div class="fr-cley"><span><i style="background:#64748b"></i>Lluvia antes del corte (mm, color del criterio)</span><span><i style="background:#94a3b8"></i>Normal de esa época (otros años)</span></div>`;
}
// Barras horizontales apiladas (% de suertes por criterio) para grupos de suelo, humedad o hacienda
function frcGrafGrupos(G, etiqueta, max = 14){
  const E = Object.entries(G).sort((a, b) => b[1][5] / b[1].n - a[1][5] / a[1].n || b[1].n - a[1].n).slice(0, max); if (!E.length) return '';
  const W = 420, fila = 20, mt = 6, ml = 92, mr = 46, H = mt + E.length * fila + 8, X = p => ml + p * (W - ml - mr);
  return `<svg class="frc-svg" viewBox="0 0 ${W} ${H}">${E.map(([k, x], i) => { let acc = 0; const y = mt + i * fila;
    return `<text x="${ml - 6}" y="${y + 13}" text-anchor="end" class="b">${esc(etiqueta(k))}</text>` + FR_CRIT.map(c => { const p = x[c.c] / x.n, r = `<rect x="${X(acc)}" y="${y + 2}" width="${Math.max(0, X(acc + p) - X(acc))}" height="${fila - 5}" fill="${c.col}"><title>${c.c}: ${x[c.c]} suertes</title></rect>${p >= 0.12 ? `<text x="${(X(acc) + X(acc + p)) / 2}" y="${y + 13}" text-anchor="middle" style="fill:#fff;font-weight:700">${x[c.c]}</text>` : ''}`; acc += p; return r; }).join('') +
      `<text x="${W - mr + 4}" y="${y + 13}">${x.n} · ${frNum(x.ha, 0)} ha</text>`; }).join('')}</svg>`;
}
// Serie mensual: lluvia (barras) y nivel freático promedio de los pozos (línea; más arriba = más superficial)
function frcGrafSerie(A){
  const S = A.serie; if (S.length < 2) return '';
  const W = 640, H = 230, ml = 36, mr = 36, mt = 14, mb = 34, n = S.length, bw = (W - ml - mr) / n;
  const lmax = Math.max(50, ...S.map(x => x.lluvia || 0)) * 1.1, X = i => ml + i * bw + bw / 2, Yl = v => mt + (1 - v / lmax) * (H - mt - mb), Yn = v => mt + v / 2 * (H - mt - mb);
  const pts = S.map((x, i) => x.nivel != null ? [X(i), Yn(Math.min(2, x.nivel)), x] : null).filter(Boolean);
  return `<svg class="frc-svg" viewBox="0 0 ${W} ${H}">
    ${[0, 0.8, 1.2, 2].map(v => `<line x1="${ml}" x2="${W - mr}" y1="${Yn(v)}" y2="${Yn(v)}" stroke="${v === 0.8 ? '#dc2626' : v === 1.2 ? '#f59e0b' : '#e2e8f0'}" stroke-dasharray="${v === 0.8 || v === 1.2 ? '4 3' : ''}"/><text x="${W - mr + 4}" y="${Yn(v) + 3}">${frNum(v, 1)} m</text>`).join('')}
    ${[0, lmax / 2, lmax].map(v => `<text x="${ml - 4}" y="${Yl(v) + 3}" text-anchor="end">${frNum(v, 0)}</text>`).join('')}
    ${S.map((x, i) => `${x.lluvia != null ? `<rect x="${X(i) - bw * 0.35}" y="${Yl(x.lluvia)}" width="${bw * 0.7}" height="${Yl(0) - Yl(x.lluvia)}" fill="#60a5fa" opacity=".75"><title>${x.m}: ${frNum(x.lluvia, 0)} mm</title></rect>` : ''}
      <text x="${X(i)}" y="${H - mb + 13}" text-anchor="middle">${frMes[+x.m.slice(5) - 1]}</text>${i === 0 || x.m.endsWith('-01') ? `<text x="${X(i)}" y="${H - mb + 25}" text-anchor="middle" class="b">${x.m.slice(0, 4)}</text>` : ''}
      ${x.n ? `<text x="${X(i)}" y="${mt + 2}" text-anchor="middle" style="font-size:8px;fill:#7c3aed">✂${x.n}</text>` : ''}`).join('')}
    <path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('')}" fill="none" stroke="#0f172a" stroke-width="2"/>
    ${pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${frCritDe(frCrit(p[2].nivel)).col}" stroke="#0f172a" stroke-width=".7"><title>${p[2].m}: ${frNum(p[2].nivel)} m</title></circle>`).join('')}
    </svg>
    <div class="fr-cley"><span><i style="background:#60a5fa"></i>Lluvia del mes (mm)</span><span><i style="background:#0f172a;height:2px"></i>Nivel freático promedio (m, eje derecho)</span><span style="color:#7c3aed">✂ suertes cortadas en el mes</span></div>`;
}
// Barras de TCH por criterio (con la referencia de presupuesto/estimado)
function frcGrafTCH(R){
  const L = R.filter(k => k.tch), W = 420, H = 210, ml = 36, mb = 40, mt = 18, mx = Math.max(...L.map(k => Math.max(k.tch, k.ref || 0))) * 1.15 || 1;
  const bw = 46, X = i => ml + 30 + i * ((W - ml - 40) / Math.max(1, L.length)), Y = v => mt + (1 - v / mx) * (H - mt - mb);
  return `<svg class="frc-svg" viewBox="0 0 ${W} ${H}">${[0, 0.5, 1].map(f => `<line x1="${ml}" x2="${W - 6}" y1="${Y(mx * f)}" y2="${Y(mx * f)}" stroke="#e2e8f0"/><text x="${ml - 4}" y="${Y(mx * f) + 3}" text-anchor="end">${frNum(mx * f, 0)}</text>`).join('')}
    ${L.map((k, i) => `<rect x="${X(i)}" y="${Y(k.tch)}" width="${bw}" height="${Y(0) - Y(k.tch)}" fill="${k.col}" rx="3"/><text x="${X(i) + bw / 2}" y="${Y(k.tch) + 15}" text-anchor="middle" class="b" style="fill:#fff">${frNum(k.tch, 1)}</text>
      ${k.ref ? `<line x1="${X(i) - 4}" x2="${X(i) + bw + 4}" y1="${Y(k.ref)}" y2="${Y(k.ref)}" stroke="#0f172a" stroke-dasharray="4 3" stroke-width="1.5"><title>Presupuesto/estimado: ${frNum(k.ref, 1)}</title></line>` : ''}
      <text x="${X(i) + bw / 2}" y="${H - mb + 14}" text-anchor="middle" class="b">Criterio ${k.c}</text><text x="${X(i) + bw / 2}" y="${H - mb + 26}" text-anchor="middle">${k.nT} suertes</text>`).join('')}</svg>
    <div class="fr-cley"><span><i style="background:none;border-top:2px dashed #0f172a;height:0"></i>TCH presupuesto / estimado</span></div>`;
}
// Dispersión: eje X a elección (nivel o lluvia) contra eje Y (TCH o nivel), con la línea de tendencia
function frcGrafDisp(A, modo = 'tch'){
  const L = modo === 'tch' ? A.conTch : A.ok.filter(x => x.lluvia != null), reg = modo === 'tch' ? A.reg : A.regLl; if (L.length < 2) return '';
  const fx = modo === 'tch' ? x => x.nivel : x => x.lluvia, fy = modo === 'tch' ? x => x.tch : x => x.nivel;
  const W = 420, H = 230, ml = 36, mr = 10, mt = 10, mb = 30;
  const xm = modo === 'tch' ? Math.max(2, ...L.map(fx)) : Math.max(...L.map(fx)) * 1.05 || 1;
  const y0 = modo === 'tch' ? Math.min(...L.map(fy)) * 0.9 : 0, y1 = modo === 'tch' ? Math.max(...L.map(fy)) * 1.05 : Math.max(2, ...L.map(fy));
  const X = v => ml + v / xm * (W - ml - mr), Y = v => mt + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - mt - mb);
  const bandas = modo === 'tch' ? FR_CRIT.map((k, i) => { const a = [0, 0.8, 1.2][i], b = Math.min(xm, [0.8, 1.2, xm][i]); return `<rect x="${X(a)}" y="${mt}" width="${X(b) - X(a)}" height="${H - mt - mb}" fill="${k.col}" opacity=".08"/>`; }).join('')
    : FR_CRIT.map((k, i) => { const a = [0, 0.8, 1.2][i], b = Math.min(y1, [0.8, 1.2, y1][i]); return `<rect x="${ml}" y="${Y(b)}" width="${W - ml - mr}" height="${Y(a) - Y(b)}" fill="${k.col}" opacity=".08"/>`; }).join('');
  const rl = reg ? `<line x1="${X(0)}" y1="${Y(reg.b)}" x2="${X(xm)}" y2="${Y(reg.b + reg.m * xm)}" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="5 3"/>` : '';
  const ticksX = modo === 'tch' ? [0, 0.5, 1, 1.5, 2].filter(v => v <= xm) : [0, xm / 4, xm / 2, xm * 3 / 4, xm];
  return `<svg class="frc-svg" viewBox="0 0 ${W} ${H}">${bandas}
    ${ticksX.map(v => `<text x="${X(v)}" y="${H - mb + 13}" text-anchor="middle">${frNum(v, modo === 'tch' ? 1 : 0)}</text>`).join('')}<text x="${(W + ml) / 2}" y="${H - 4}" text-anchor="middle">${modo === 'tch' ? 'Nivel freático antes del corte (m)' : `Lluvia en los ${frcE.ventana} días antes del corte (mm)`}</text>
    ${[y0, (y0 + y1) / 2, y1].map(v => `<text x="${ml - 4}" y="${Y(v) + 3}" text-anchor="end">${frNum(v, modo === 'tch' ? 0 : 1)}</text>`).join('')}
    ${L.map(x => `<circle cx="${X(fx(x)).toFixed(1)}" cy="${Y(fy(x)).toFixed(1)}" r="3.5" fill="${frCritDe(x.crit).col}" opacity=".8"><title>${x.s}: ${frNum(x.nivel)} m · ${modo === 'tch' ? frNum(x.tch, 1) + ' TCH' : frNum(x.lluvia, 0) + ' mm'}</title></circle>`).join('')}${rl}</svg>`;
}

// ── Vista ──
function renderCosechaNF(){
  const cont = q('nfcosecha'), K = frCosecha(), F = freatico();
  if (typeof MAPA_FREATICO === 'undefined') { cont.innerHTML = '<div class="nores">Cargando cartografía…</div>'; frCargarMapa().then(() => vistaActual === 'nfcos' && renderCosechaNF()); return; }
  const A = frCosechaAnalisis();
  const fuente = `<div class="fr-fuente"><div class="fr-f-txt">🌾 ${K ? `Suertes cosechadas: <b>${esc(K.archivo)}</b>${K.hoja ? ` (hoja «${esc(K.hoja)}»)` : ''} · ${K.filas.length} suertes` : 'Aún no se ha cargado el Excel de suertes cosechadas'}
      ${K && K.filas.some(x => !x.f) ? `<div class="fr-f-aviso">${K.filas.filter(x => !x.f).length} suertes sin fecha de corte en el Excel. Mes de cosecha:
        ${MODO_EDICION ? `<input type="month" id="frc-mes" value="${esc(K.mes || '')}">` : `<b>${esc(K.mes || 'sin definir')}</b>`} <span class="meta">(se toma el día 15)</span></div>` : ''}
      ${MODO_EDICION && frcE.cand && K && frcE.cand.archivo === K.archivo ? `<div class="fr-f-aviso">Ese Excel tiene varias hojas con suertes; usar: ${frcE.cand.lista.map((c, i) => `<button type="button" class="fr-ch ${c.hoja === K.hoja ? 'on' : ''}" data-frc-hoja="${i}">${esc(c.hoja)} · ${c.filas.length}${c.conFecha ? ' con fecha' : ''}${c.oculta ? ' (oculta)' : ''}</button>`).join(' ')}</div>` : ''}</div>
    ${MODO_EDICION ? `<div class="fr-f-btns"><label class="mbtn" title="Excel con las suertes cosechadas: columna de suerte (Sec-Sue / Sector suerte) y, si las tiene, fecha de corte, área, TCH real y TCH presupuesto">📥 ${K ? 'Cambiar' : 'Cargar'} Excel de suertes cosechadas<input type="file" id="frc-archivo" accept=".xlsx,.xls,.xlsm,.csv" hidden></label></div>` : ''}</div>`;
  const top = `<div class="mod-top"><div><div class="sim-tit">🌾 Cosecha vs niveles freáticos</div>
      <div class="sim-subt">Sustento de afectación: nivel freático, lluvias y zona agroecológica antes del corte de cada suerte cosechada (pozo de influencia y criterio 5 / 3 / 1)</div></div>
      <div class="fr-acc"><button type="button" class="mbtn mbtn-ghost" data-frc-volver>← Niveles freáticos</button></div></div>`;
  if (!K || !A) { cont.innerHTML = top + fuente + `<div class="sim-card abierta" style="padding:14px 16px;line-height:1.6"><b>¿Cómo funciona?</b><br>
    1. Carga el Excel de suertes cosechadas: basta una columna con la suerte (ej. <i>Sec-Sue</i>, <i>Sector suerte cosechada</i>: 3107-430). Si trae <i>Fecha de corte</i>, <i>Área</i>, <i>TCH real</i> y <i>TCH presupuesto/estimado</i>, se usan.<br>
    2. A cada suerte se le busca su <b>pozo de influencia</b> (el más cercano con lecturas) y se promedian sus lecturas en los días previos al corte; se suma la lluvia de su hacienda en esos días y se toma su zona agroecológica del maestro.<br>
    3. Criterio: <b style="color:#dc2626">5</b> nivel &lt; 0,8 m (afectación alta) · <b style="color:#f59e0b">3</b> 0,8–1,2 m · <b style="color:#16a34a">1</b> ≥ 1,2 m (sin afectación).<br>
    4. Se genera el informe de sustento (imprimible) y la presentación en PowerPoint.</div>`; return; }
  const R = A.resumen, tot = A.total, hayT = A.conTch.length > 0, r1 = R.find(x => x.c === 1), r5 = R.find(x => x.c === 5);
  const pct = n => tot.n ? n / tot.n * 100 : 0;
  const filas = A.filas.slice().sort((a, b) => (b.crit || 0) - (a.crit || 0) || (a.nivel ?? 9) - (b.nivel ?? 9));
  const fas = A.ok.map(x => x.fa).sort(), card = (t, sub, cuerpo, extra = '') => `<div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>${t}</b> <span class="meta">${sub}</span></div>${cuerpo}${extra}</div>`;
  const sueloL = k => 'Suelo ' + k;
  cont.innerHTML = top + fuente + `
    <div class="fr-filtros frc-par">
      <label class="fchip"><span>Fecha que se analiza</span><select id="frc-anio" class="fsel on">${Object.entries(FRC_ANIO).map(([k, t]) => `<option value="${k}" ${frcE.anio === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="fchip"><span>Ventana antes del corte</span><select id="frc-ven" class="fsel on">${[30, 45, 60, 90].map(d => `<option value="${d}" ${frcE.ventana === d ? 'selected' : ''}>${d} días (~${Math.round(d / 15)} lecturas)</option>`).join('')}</select></label>
      <label class="fchip"><span>Nivel de la suerte</span><select id="frc-base" class="fsel on"><option value="pozo" ${frcE.base === 'pozo' ? 'selected' : ''}>Pozo de influencia (más cercano)</option><option value="idw" ${frcE.base === 'idw' ? 'selected' : ''}>IDW en el centro de la suerte</option></select></label>
      <span class="meta">Criterio: ${FR_CRIT.map(k => `<b style="color:${k.col}">${k.c}</b> ${k.r}`).join(' · ')}</span>
    </div>
    ${A.desplazadas ? `<div class="fr-f-aviso" style="margin:0 0 10px">📅 Se analizan las condiciones de <b>un año antes</b> del corte en ${A.desplazadas} suertes (ej. corte 15 oct 2026 → se miran niveles y lluvias hasta el 15 oct 2025). Período analizado: ${frFecha(fas[0])} a ${frFecha(fas[fas.length - 1])}.</div>` : ''}
    <div class="sim-kpis fr-kpis">
      <div class="sim-kpi"><div class="l">Suertes cosechadas</div><div class="v">${tot.n}</div><div class="s">${frNum(tot.ha, 1)} ha con dato${A.sin.length ? ` · ${A.sin.length} sin dato` : ''}</div></div>
      ${R.map(k => `<div class="sim-kpi fr-k" style="--c:${k.col}"><div class="l">${k.c} · ${k.n} <small>${k.r}</small></div><div class="v">${k.n} <small style="font-size:.5em">suertes</small></div><div class="s">${frNum(pct(k.n), 1)}% · ${frNum(k.ha, 1)} ha${k.lluvia != null ? ` · ${frNum(k.lluvia, 0)} mm` : ''}${k.tch ? ` · TCH ${frNum(k.tch, 1)}` : ''}</div></div>`).join('')}
      ${A.hayLl ? `<div class="sim-kpi"><div class="l">Lluvia antes del corte</div><div class="v">${frNum(tot.lluvia, 0)} <small style="font-size:.5em">mm</small></div><div class="s">${frcE.ventana} días · ${tot.anom ? `${frNum(tot.anom * 100, 0)}% de lo normal` : 'sin histórico'}</div></div>` : ''}
    </div>
    <div class="fr-grid2">
      ${card('Mapa de suertes cosechadas por criterio', '· color según el nivel freático antes del corte', `<img class="frc-mapa" src="${frcMapa(A, 1100).toDataURL('image/png')}" alt="Mapa de suertes por criterio">`)}
      ${card('Lluvia y nivel freático mes a mes', '· período analizado', frcGrafSerie(A) || '<div class="nores">Sin datos suficientes</div>')}
    </div>
    <div class="fr-grid2">
      ${A.hayLl ? card('Lluvia antes del corte por criterio', `· ${frcE.ventana} días previos vs normal`, frcGrafLluvia(R),
        r5.lluvia != null && r1.lluvia != null ? `<div class="frc-dato">Las suertes con afectación alta recibieron <b>${frNum(r5.lluvia, 0)} mm</b>${r5.anom ? ` (${frNum(r5.anom * 100, 0)}% de lo normal)` : ''} frente a ${frNum(r1.lluvia, 0)} mm en las suertes sin afectación.</div>` : '') : ''}
      ${A.hayLl ? card('Lluvia vs nivel freático', '· cada punto es una suerte', frcGrafDisp(A, 'lluvia'),
        A.regLl ? `<div class="frc-dato">Relación ${frcFuerza(A.regLl.r)} (r = ${frNum(A.regLl.r, 2)}): ${A.regLl.m < 0 && Math.abs(A.regLl.r) >= 0.3 ? `a más lluvia, el nivel freático queda más cerca de la superficie (por cada 50 mm, ${frNum(Math.abs(A.regLl.m) * 50 * 100, 0)} cm más arriba)` : 'en estos datos la lluvia no explica por sí sola el nivel: pesa más el drenaje y el freático regional'}.</div>` : '') : ''}
    </div>
    <div class="fr-grid2">
      ${card('Por grupo de suelo', '· zona agroecológica del maestro', frcGrafGrupos(A.suelos, sueloL) || '<div class="nores">Sin zona agroecológica</div>')}
      ${card('Por grupo de humedad', '· zona agroecológica del maestro', frcGrafGrupos(A.hums, k => k) || '<div class="nores">Sin zona agroecológica</div>')}
    </div>
    ${hayT ? `<div class="fr-grid2">
      ${card('TCH real por criterio', '· promedio ponderado por área', frcGrafTCH(R), r1 && r5 && r1.tch && r5.tch ? `<div class="frc-dato">Las suertes con afectación alta produjeron <b>${frNum(r5.tch, 1)} TCH</b>, <b style="color:${r5.tch < r1.tch ? 'var(--red)' : 'var(--green)'}">${frNum(Math.abs(1 - r5.tch / r1.tch) * 100, 1)}% ${r5.tch < r1.tch ? 'menos' : 'más'}</b> que las suertes sin afectación (${frNum(r1.tch, 1)} TCH).</div>` : '')}
      ${card('Nivel freático vs TCH', '· cada punto es una suerte', frcGrafDisp(A), A.reg ? `<div class="frc-dato">Relación ${frcFuerza(A.reg.r)} (r = ${frNum(A.reg.r, 2)}, ${A.reg.n} suertes): ${A.reg.m > 0 ? `por cada 10 cm más superficial el nivel, la TCH baja en promedio <b>${frNum(A.reg.m / 10, 1)} t/ha</b>` : 'en estos datos la TCH no baja cuando el nivel es más superficial'}.</div>` : '')}
    </div>` : '<div class="nores" style="margin:0 0 12px">El Excel no trae TCH: se muestra la calificación por nivel freático, lluvia y suelo. Si cargas un Excel con «TCH real» se agrega la comparación de producción.</div>'}
    <div class="fr-grid2">
      ${card('Por hacienda', '', `<div class="sim-tw" style="max-height:320px"><table class="sim-t"><thead><tr><th>Hacienda</th><th class="n">Suertes</th>${FR_CRIT.map(k => `<th class="n" style="color:${k.col}">${k.c}</th>`).join('')}<th class="n">ha crit. 5</th><th class="n">Nivel (m)</th><th class="n">Lluvia (mm)</th></tr></thead>
        <tbody>${Object.entries(A.hacs).sort((a, b) => b[1][5] - a[1][5] || b[1].n - a[1].n).map(([h, x]) => `<tr><td>${esc(h)}</td><td class="n">${x.n}</td>${FR_CRIT.map(k => `<td class="n">${x[k.c]}</td>`).join('')}<td class="n b">${frNum(x.ha5, 1)}</td><td class="n">${x.nivel != null ? frNum(x.nivel) : '—'}</td><td class="n">${x.lluvia != null ? frNum(x.lluvia, 0) : '—'}</td></tr>`).join('')}</tbody></table></div>`)}
      ${card('Por zona agroecológica', '', `<div class="sim-tw" style="max-height:320px"><table class="sim-t"><thead><tr><th>Zona</th><th class="n">Suertes</th>${FR_CRIT.map(k => `<th class="n" style="color:${k.col}">${k.c}</th>`).join('')}<th class="n">% crit. 5</th><th class="n">Nivel (m)</th><th class="n">Lluvia (mm)</th></tr></thead>
        <tbody>${Object.entries(A.zonas).sort((a, b) => b[1][5] / b[1].n - a[1][5] / a[1].n || b[1].n - a[1].n).map(([z, x]) => `<tr><td class="b">${esc(z)}</td><td class="n">${x.n}</td>${FR_CRIT.map(k => `<td class="n">${x[k.c]}</td>`).join('')}<td class="n b">${frNum(x[5] / x.n * 100, 0)}%</td><td class="n">${x.nivel != null ? frNum(x.nivel) : '—'}</td><td class="n">${x.lluvia != null ? frNum(x.lluvia, 0) : '—'}</td></tr>`).join('')}</tbody></table></div>`)}
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Detalle por suerte</b> <span class="meta">· de más a menos afectada · toca una fila para ver por qué</span></div>
      <div class="sim-tw" style="max-height:520px"><table class="sim-t frc-det"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Corte</th><th>Analizado hasta</th><th class="n">Área</th><th>Zona agro</th><th>Pozo</th><th class="n">Nivel (m)</th><th class="n">Lluvia (mm)</th><th class="n">% normal</th><th>Criterio</th>${hayT ? '<th class="n">TCH real</th>' : ''}</tr></thead>
      <tbody>${filas.map(x => `<tr ${x.just ? `data-frc-just="${esc(x.just)}" style="cursor:pointer"` : ''}><td class="lab" style="font-family:var(--mono)">${esc(x.s)}</td><td>${esc(x.hac)}</td><td>${x.fc ? frFecha(x.fc) + (x.f ? '' : ' <small class="meta">(mes)</small>') : '—'}</td><td>${x.fa && x.fa !== x.fc ? frFecha(x.fa) : '<span class="meta">igual</span>'}</td><td class="n">${x.ha ? frNum(x.ha) : '—'}</td><td>${esc(x.za || '—')}</td>
        <td>${x.pozo ? `${x.pozo} <small class="meta">${frNum(x.dist, 0)} m</small>` : `<span class="meta">${esc(x.motivo || '—')}</span>`}</td>
        <td class="n">${x.nivel != null ? frNum(x.nivel) : '—'}</td><td class="n">${x.lluvia != null ? frNum(x.lluvia, 0) : '—'}</td><td class="n">${x.anom ? `<span style="color:${x.anom >= 1.2 ? 'var(--red)' : x.anom < 0.8 ? '#0369a1' : 'inherit'}">${frNum(x.anom * 100, 0)}%</span>` : '—'}</td>
        <td>${x.crit ? `<span class="ag-est" style="--c:${frCritDe(x.crit).col}">${x.crit} · ${frCritDe(x.crit).n}</span>` : '<span class="meta">—</span>'}</td>
        ${hayT ? `<td class="n b">${x.tch ? frNum(x.tch, 1) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>
    <div class="fr-inf fr-inf-c"><button type="button" class="mbtn" data-frc-informe>📄 Informe de sustento (PDF)</button> <button type="button" class="mbtn" data-frc-ppt style="background:#c2410c;border-color:#c2410c">📊 Presentación PowerPoint</button>
      <span class="meta">Informe detallado con niveles, lluvias, suelos, mapa, justificación por suerte y conclusiones · la presentación sale con gráficos editables en PowerPoint</span></div>`;
}

// ── Informe de sustento (HTML imprimible) ──
function frcTextos(A){
  const R = A.resumen, tot = A.total, hayT = A.conTch.length > 0, r1 = R.find(x => x.c === 1), r3 = R.find(x => x.c === 3), r5 = R.find(x => x.c === 5);
  const pct = n => tot.n ? n / tot.n * 100 : 0, n1 = (x, d = 1) => frNum(x, d);
  const fcs = A.ok.map(x => x.fc).sort(), fas = A.ok.map(x => x.fa).sort();
  const per = (a, b) => a && b ? (a.slice(0, 7) === b.slice(0, 7) ? `${frMesL[+a.slice(5, 7) - 1]} de ${a.slice(0, 4)}` : `el ${frFechaL(a)} y el ${frFechaL(b)}`) : '';
  const periodo = per(fcs[0], fcs[fcs.length - 1]), periodoA = per(fas[0], fas[fas.length - 1]);
  const anioTxt = A.desplazadas ? ` Para evaluar las condiciones del año inmediatamente anterior, ${A.desplazadas === tot.n ? 'a todas las suertes' : `a ${A.desplazadas} de las ${tot.n} suertes`} se les tomó como fecha de referencia el mismo día del año anterior al corte (por ejemplo, un corte del 15 de octubre de 2026 se evaluó con las condiciones hasta el 15 de octubre de 2025); el período analizado quedó entre ${periodoA}.` : '';
  // Grupo con mayor proporción en criterio 5 (con suficientes suertes para que el porcentaje diga algo) y el de más suertes afectadas
  const mayorProp = G => { const E = Object.entries(G), por = m => E.filter(([, x]) => x.n >= m && x[5]).sort((a, b) => b[1][5] / b[1].n - a[1][5] / a[1].n || b[1][5] - a[1][5])[0]; return por(8) || por(3); };
  const sueloTop = mayorProp(A.suelos), humTop = mayorProp(A.hums);
  const sueloMas = Object.entries(A.suelos).sort((a, b) => b[1][5] - a[1][5])[0];
  const pRes = `Se evaluaron <b>${tot.n}</b> suertes cosechadas${periodo ? ` entre ${periodo}` : ''}, con un área de ${n1(tot.ha, 2)} ha. De ellas, <b>${r5.n} (${n1(pct(r5.n))}%, ${n1(r5.ha, 2)} ha)</b> presentaron niveles freáticos menores a 0,8 m en los ${frcE.ventana} días previos a la fecha de referencia (criterio 5, afectación alta), ${r3.n} (${n1(pct(r3.n))}%) se ubicaron entre 0,8 y 1,2 m (criterio 3) y ${r1.n} (${n1(pct(r1.n))}%) tuvieron niveles de 1,2 m o más (criterio 1, sin afectación).` +
    (A.sin.length ? ` ${A.sin.length} suertes no se pudieron evaluar (sin fecha de corte, sin ubicación en la cartografía o sin lecturas cercanas).` : '');
  const pLl = A.hayLl ? `En los ${frcE.ventana} días previos a la fecha de referencia, las suertes evaluadas recibieron en promedio <b>${n1(tot.lluvia, 0)} mm</b> de lluvia${tot.anom ? `, equivalente al <b>${n1(tot.anom * 100, 0)}%</b> de lo normal para esa misma época en los demás años registrados` : ''}. ` +
    (r5.lluvia != null && r1.lluvia != null ? `Las suertes con afectación alta acumularon ${n1(r5.lluvia, 0)} mm${r5.anom ? ` (${n1(r5.anom * 100, 0)}% de lo normal)` : ''}, frente a ${n1(r1.lluvia, 0)} mm${r1.anom ? ` (${n1(r1.anom * 100, 0)}% de lo normal)` : ''} en las suertes sin afectación. ` : '') +
    (A.regLl ? `La relación entre la lluvia y el nivel freático de cada suerte es ${frcFuerza(A.regLl.r)} (r = ${n1(A.regLl.r, 2)})${A.regLl.m < 0 && Math.abs(A.regLl.r) >= 0.3 ? `: a mayor lluvia, el nivel se ubica más cerca de la superficie, con un ascenso aproximado de ${n1(Math.abs(A.regLl.m) * 50 * 100, 0)} cm por cada 50 mm de lluvia` : ': la lluvia por sí sola no explica las diferencias de nivel entre suertes, que dependen principalmente del drenaje, el tipo de suelo y el freático regional'}. ` : '') +
    (r5.anom != null && r5.anom < 0.9 ? 'Que las suertes más afectadas no hayan recibido lluvias por encima de lo normal indica que el nivel superficial se explica principalmente por condiciones de drenaje, riego o aporte del freático regional, y no solo por la precipitación.' : r5.anom >= 1.1 ? 'Las lluvias por encima de lo normal en las suertes más afectadas explican en buena parte el ascenso del nivel freático antes de la cosecha.' : '') : '';
  const pSuelo = sueloTop ? `Según la zona agroecológica del maestro de suertes, el grupo de suelo con mayor proporción de suertes afectadas fue el <b>${sueloTop[0]}</b> (${sueloTop[1][5]} de ${sueloTop[1].n} suertes en criterio 5, nivel promedio ${n1(sueloTop[1].nivel, 2)} m)` +
    (humTop ? `, y el grupo de humedad <b>${humTop[0]}</b> (${humTop[1][5]} de ${humTop[1].n} suertes en criterio 5)` : '') + '.' +
    (sueloMas && sueloMas[1][5] && sueloMas[0] !== sueloTop[0] ? ` El mayor número de suertes con afectación alta se presentó en el grupo de suelo <b>${sueloMas[0]}</b> (${sueloMas[1][5]} suertes, ${n1(sueloMas[1].ha5, 1)} ha).` : '') + ' Los suelos con mayor susceptibilidad al ascenso del nivel freático requieren prioridad en el mantenimiento de drenajes antes de la cosecha.' : '';
  const pTch = hayT && r1.tch && r5.tch ? `En cuanto a la producción, las suertes con afectación alta obtuvieron un TCH real promedio de <b>${n1(r5.tch)}</b> t/ha, frente a <b>${n1(r1.tch)}</b> t/ha en las suertes sin afectación, es decir, <b>${n1(Math.abs(1 - r5.tch / r1.tch) * 100)}% ${r5.tch < r1.tch ? 'menos' : 'más'}</b>${r3.tch ? `; las suertes con afectación media registraron ${n1(r3.tch)} t/ha` : ''}.` +
    (A.reg ? ` La relación entre el nivel freático previo al corte y el TCH es ${frcFuerza(A.reg.r)} (r = ${n1(A.reg.r, 2)})${A.reg.m > 0 ? `: por cada 10 cm que el nivel freático está más cerca de la superficie, el TCH disminuye ${n1(A.reg.m / 10)} t/ha` : ''}.` : '') : '';
  const hacT = Object.entries(A.hacs).sort((a, b) => b[1].ha5 - a[1].ha5).filter(x => x[1][5]).slice(0, 3);
  const concl = [
    `El ${n1(pct(r5.n))}% de las suertes cosechadas (${r5.n} suertes, ${n1(r5.ha, 2)} ha) tuvo niveles freáticos críticos (menos de 0,8 m) en los ${frcE.ventana} días previos a la fecha de referencia, condición en la que el agua ocupa la zona de raíces y limita la aireación del suelo.`,
    A.hayLl && r5.lluvia != null ? `Las suertes con afectación alta recibieron ${n1(r5.lluvia, 0)} mm de lluvia antes del corte${r5.anom ? ` (${n1(r5.anom * 100, 0)}% de lo normal)` : ''}${r1.lluvia != null ? `, frente a ${n1(r1.lluvia, 0)} mm de las no afectadas` : ''}.` : '',
    sueloTop ? `El grupo de suelo ${sueloTop[0]} concentró la mayor proporción de suertes afectadas (${n1(sueloTop[1][5] / sueloTop[1].n * 100, 0)}%).` : '',
    hayT && r1.tch && r5.tch ? `Las suertes con afectación alta produjeron ${n1(Math.abs(1 - r5.tch / r1.tch) * 100)}% ${r5.tch < r1.tch ? 'menos' : 'más'} TCH que las suertes sin afectación (${n1(r5.tch)} vs ${n1(r1.tch)} t/ha).` : '',
    hacT.length ? `Las haciendas con más área cosechada en condición de afectación alta fueron ${hacT.map(([n, x]) => `${esc(n)} (${n1(x.ha5)} ha)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : '',
    'Se recomienda priorizar el mantenimiento de drenajes en los sectores de influencia de los pozos con niveles críticos antes de la cosecha, revisar los riegos programados en esos sectores y planear el corte de las suertes afectadas en los períodos de menor nivel freático.',
  ].filter(Boolean);
  return {periodo, periodoA, anioTxt, pRes, pLl, pSuelo, pTch, concl, r1, r3, r5, pct, hacT, sueloTop};
}
function frInformeCosecha(){
  const A = frCosechaAnalisis(); if (!A) return;
  const R = A.resumen, tot = A.total, hayT = A.conTch.length > 0, T = frcTextos(A), n1 = (x, d = 1) => frNum(x, d);
  const hoy = new Date(), hoyTxt = `${frMesL[hoy.getMonth()].replace(/^./, c => c.toUpperCase())} ${hoy.getDate()} del ${hoy.getFullYear()}`;
  const abs = u => new URL(u, document.baseURI).href, logo = abs('img/logo-riopaila.png'), portada = abs('img/portada-informe-nf.svg');
  const editable = (txt, ph) => `<p class="ed${txt ? '' : ' vacio'}" contenteditable="true" data-ph="${ph}">${txt}</p>`;
  const afect = A.ok.filter(x => x.crit === 5).sort((a, b) => a.nivel - b.nivel), media = A.ok.filter(x => x.crit === 3).sort((a, b) => a.nivel - b.nivel);
  let pag = 0; const pie = () => `<div class="pie"><img src="${logo}" alt=""><span>${++pag}</span></div>`;
  const tablaJust = L => `<table class="det"><tr><th>Suerte</th><th>Hacienda</th><th>Corte</th><th>Zona</th><th>Nivel (m)</th><th>Lluvia (mm)</th><th style="width:48%">Justificación</th></tr>
    ${L.map(x => `<tr><td>${esc(x.s)}</td><td style="text-align:left">${esc(x.hac)}</td><td>${frFechaCorta(x.fc)}</td><td>${esc(x.za || '—')}</td><td>${n1(x.nivel, 2)}</td><td>${x.lluvia != null ? n1(x.lluvia, 0) : '—'}</td><td style="text-align:left">${esc(x.just)}</td></tr>`).join('')}</table>`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe cosecha vs niveles freáticos</title>
<style>${FR_INF_CSS}
  .frc-svg{width:100%;max-width:160mm;display:block;margin:2mm auto}.frc-svg text{font-size:10px;fill:#334155}.frc-svg .b{font-weight:700}
  .fr-cley{display:flex;gap:5mm;justify-content:center;font-size:9pt;flex-wrap:wrap}.fr-cley i{display:inline-block;width:6mm;height:3mm;margin-right:1.5mm;vertical-align:middle}
  .det td,.det th{font-size:8.5pt;padding:1mm 1.5mm}.mapa{width:100%;max-width:170mm;display:block;margin:2mm auto;border:1px solid #cbd5e1}
  .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:3mm 0}.kp div{border-radius:3mm;padding:3mm;color:#fff;text-align:center}.kp b{display:block;font-size:20pt}.kp span{font-size:9pt}
</style></head><body>
<img class="logo-pie" src="${logo}" alt="">
<div class="barra"><b>Informe cosecha vs niveles freáticos</b><span>Puedes corregir cualquier texto haciendo clic sobre él. Los espacios en gris son para completar.</span><button onclick="print()">🖨 Imprimir / Guardar PDF</button></div>
<div class="hoja portada"><div class="foto" style="background-image:url('${portada}')"></div><div class="velo"></div>
  <div class="caja"><div class="logo"><img src="${logo}" alt="Riopaila Agrícola"></div>
    <div class="pill t">Afectación de Cosecha por<br>Niveles Freáticos y Lluvias</div>
    ${T.periodo ? `<div class="pill s">Suertes cosechadas: ${esc(T.periodo)}</div>` : ''}
    <div class="pill s">Área de Ingeniería Agrícola<br><br><span contenteditable="true" class="ed">${hoyTxt}</span></div></div></div>

<div class="hoja"><h2>Objetivo</h2>
<p class="ed" contenteditable="true">Sustentar la afectación de las suertes cosechadas${T.periodo ? ` entre ${T.periodo}` : ''} asociada a los niveles freáticos y a las lluvias presentes en los días previos al corte, considerando el tipo de suelo de cada suerte según su zona agroecológica, con el fin de soportar técnicamente las diferencias de productividad y orientar las acciones de drenaje antes de la cosecha.</p>
<h2>Metodología</h2>
<p class="ed" contenteditable="true">A cada suerte cosechada se le asignó su <b>pozo de influencia</b>, correspondiente al pozo de observación más cercano con lecturas disponibles, y se calculó el nivel freático promedio de ese pozo en los <b>${frcE.ventana} días previos a la fecha de referencia</b> (aproximadamente ${Math.round(frcE.ventana / 15)} lecturas quincenales)${frcE.base === 'idw' ? '; como nivel de la suerte se tomó el valor interpolado por IDW en su centro' : ''}.${T.anioTxt} Para la misma ventana se sumó la <b>lluvia</b> registrada en la hacienda de cada suerte (o el promedio de su zona cuando la hacienda no tiene pluviómetro) y se comparó con la lluvia normal de esa época en los demás años registrados. La <b>zona agroecológica</b> (grupo de suelo y grupo de humedad) se tomó del maestro de suertes. Cada suerte se calificó según la Tabla 1.</p>
<p class="cap"><b>Tabla 1.</b> Criterio de afectación por nivel freático previo al corte.</p>
<table><tr><th>Criterio</th><th>Nivel freático promedio</th><th>Condición</th></tr>${FR_CRIT.map(k => `<tr><td style="background:${k.col};color:#fff;font-weight:700">${k.c}</td><td>${k.r}</td><td>${k.n}</td></tr>`).join('')}</table>
${pie()}</div>

<div class="hoja"><h2>Resultados generales</h2>
<div class="kp"><div style="background:#334155"><b>${tot.n}</b><span>suertes · ${n1(tot.ha, 0)} ha</span></div>${R.map(k => `<div style="background:${k.col}"><b>${k.n}</b><span>criterio ${k.c} · ${n1(T.pct(k.n), 0)}%</span></div>`).join('')}</div>
<p class="ed" contenteditable="true">${T.pRes}</p>
<p class="cap"><b>Tabla 2.</b> Suertes cosechadas por criterio de afectación.</p>
<table><tr><th>Criterio</th><th>Suertes</th><th>%</th><th>Área (ha)</th><th>Nivel prom. (m)</th>${A.hayLl ? '<th>Lluvia (mm)</th><th>% normal</th>' : ''}${hayT ? '<th>TCH real</th><th>TCH ppto/est</th>' : ''}</tr>
${R.map(k => `<tr><td style="background:${k.col};color:#fff;font-weight:700">${k.c} · ${k.n}</td><td>${k.n}</td><td>${n1(T.pct(k.n))}</td><td>${n1(k.ha, 2)}</td><td>${k.nivel != null ? n1(k.nivel, 2) : '—'}</td>${A.hayLl ? `<td>${k.lluvia != null ? n1(k.lluvia, 0) : '—'}</td><td>${k.anom ? n1(k.anom * 100, 0) : '—'}</td>` : ''}${hayT ? `<td>${k.tch ? n1(k.tch) : '—'}</td><td>${k.ref ? n1(k.ref) : '—'}</td>` : ''}</tr>`).join('')}
<tr><td><b>Total</b></td><td><b>${tot.n}</b></td><td>100</td><td><b>${n1(tot.ha, 2)}</b></td><td>${tot.nivel != null ? n1(tot.nivel, 2) : ''}</td>${A.hayLl ? `<td>${tot.lluvia != null ? n1(tot.lluvia, 0) : ''}</td><td>${tot.anom ? n1(tot.anom * 100, 0) : ''}</td>` : ''}${hayT ? '<td></td><td></td>' : ''}</tr></table>
<p class="cap"><b>Figura 1.</b> Suertes cosechadas según el criterio de afectación por nivel freático.</p><img class="mapa" src="${frcMapa(A, 1400).toDataURL('image/png')}" alt="">
${pie()}</div>

<div class="hoja"><h2>Lluvias y niveles freáticos</h2>
${A.hayLl ? `<p class="ed" contenteditable="true">${T.pLl}</p>` : editable('', 'No hay base de lluvias cargada para este período: escribe aquí el análisis de precipitación…')}
<p class="cap"><b>Figura 2.</b> Lluvia mensual y nivel freático promedio de los pozos de influencia en el período analizado.</p>${frcGrafSerie(A)}
${A.hayLl ? `<p class="cap"><b>Figura 3.</b> Lluvia en los ${frcE.ventana} días previos por criterio frente a la lluvia normal de esa época.</p>${frcGrafLluvia(R)}` : ''}
${pie()}</div>

${A.hayLl ? `<div class="hoja"><h2>Relación lluvia – nivel freático</h2>
<p class="cap"><b>Figura 4.</b> Lluvia antes del corte vs nivel freático de cada suerte (color según criterio).</p>${frcGrafDisp(A, 'lluvia')}
<h2>Tipo de suelo y zona agroecológica</h2>
<p class="ed" contenteditable="true">${T.pSuelo}</p>
<p class="cap"><b>Figura 5.</b> Distribución de las suertes por criterio según el grupo de suelo.</p>${frcGrafGrupos(A.suelos, k => 'Suelo ' + k, 12)}
${pie()}</div>` : `<div class="hoja"><h2>Tipo de suelo y zona agroecológica</h2><p class="ed" contenteditable="true">${T.pSuelo}</p>${frcGrafGrupos(A.suelos, k => 'Suelo ' + k, 12)}${pie()}</div>`}

<div class="hoja"><h2>Zonas agroecológicas y haciendas</h2>
<p class="cap"><b>Tabla 3.</b> Suertes por zona agroecológica (grupo de suelo + grupo de humedad).</p>
<table class="det"><tr><th>Zona</th><th>Suertes</th>${FR_CRIT.map(k => `<th>${k.c}</th>`).join('')}<th>% crit. 5</th><th>Nivel (m)</th><th>Lluvia (mm)</th></tr>
${Object.entries(A.zonas).sort((a, b) => b[1][5] / b[1].n - a[1][5] / a[1].n || b[1].n - a[1].n).map(([z, x]) => `<tr><td><b>${esc(z)}</b></td><td>${x.n}</td>${FR_CRIT.map(k => `<td>${x[k.c]}</td>`).join('')}<td>${n1(x[5] / x.n * 100, 0)}</td><td>${x.nivel != null ? n1(x.nivel, 2) : '—'}</td><td>${x.lluvia != null ? n1(x.lluvia, 0) : '—'}</td></tr>`).join('')}</table>
${editable('', 'Descripción de los grupos de suelo y humedad presentes (textura, drenaje natural, profundidad efectiva)…')}
<p class="cap"><b>Tabla 4.</b> Suertes por hacienda.</p>
<table class="det"><tr><th>Hacienda</th><th>Suertes</th>${FR_CRIT.map(k => `<th>${k.c}</th>`).join('')}<th>ha crit. 5</th><th>Nivel (m)</th><th>Lluvia (mm)</th></tr>
${Object.entries(A.hacs).sort((a, b) => b[1][5] - a[1][5] || b[1].n - a[1].n).map(([h, x]) => `<tr><td style="text-align:left">${esc(h)}</td><td>${x.n}</td>${FR_CRIT.map(k => `<td>${x[k.c]}</td>`).join('')}<td>${n1(x.ha5, 2)}</td><td>${x.nivel != null ? n1(x.nivel, 2) : '—'}</td><td>${x.lluvia != null ? n1(x.lluvia, 0) : '—'}</td></tr>`).join('')}</table>
${pie()}</div>

${hayT ? `<div class="hoja"><h2>Afectación en la producción</h2>
<p class="ed" contenteditable="true">${T.pTch}</p>
<p class="cap"><b>Figura.</b> TCH real promedio por criterio de afectación (línea punteada: TCH presupuestado o estimado).</p>${frcGrafTCH(R)}
<p class="cap"><b>Figura.</b> Nivel freático previo al corte vs TCH real de cada suerte.</p>${frcGrafDisp(A)}
${pie()}</div>` : ''}

<div class="hoja"><h2>Justificación por suerte · afectación alta</h2>
<p class="cap"><b>Tabla 5.</b> Suertes con nivel freático promedio menor a 0,8 m antes de la fecha de referencia y sus condiciones.</p>
${afect.length ? tablaJust(afect) : '<p>Ninguna suerte con afectación alta.</p>'}
${editable('', 'Observaciones de campo (riegos, encharcamientos, problemas de cosecha mecánica, labores…)')}
${pie()}</div>

${media.length ? `<div class="hoja"><h2>Justificación por suerte · afectación media</h2>
<p class="cap"><b>Tabla 6.</b> Suertes con nivel freático entre 0,8 y 1,2 m antes de la fecha de referencia.</p>${tablaJust(media)}${pie()}</div>` : ''}

<div class="hoja"><h2>Conclusiones</h2>
<ul class="c">${T.concl.map(c => `<li class="ed" contenteditable="true">${c}</li>`).join('')}</ul>
${editable('', 'Conclusiones o recomendaciones adicionales…')}
${pie()}</div>
<script>document.querySelectorAll('.ed').forEach(e => e.addEventListener('input', () => e.classList.toggle('vacio', !e.textContent.trim())));</script>
</body></html>`;
  frAbrirInforme(html);
}

// ── Presentación PowerPoint (PptxGenJS: gráficos nativos, editables en PowerPoint) ──
const PPTX_URL = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
let pptxPromesa = null;
const cargarPptx = () => window.PptxGenJS ? Promise.resolve(window.PptxGenJS) : pptxPromesa = pptxPromesa || new Promise((res, rej) => {
  const s = document.createElement('script'); s.src = PPTX_URL; s.onload = () => res(window.PptxGenJS); s.onerror = () => { pptxPromesa = null; rej(new Error('No se pudo cargar el generador de PowerPoint (¿sin internet?)')); }; document.head.appendChild(s); });
// Imagen (png o svg) → dataURL png, para incrustarla en la presentación
const frcImagen = (url, ancho) => new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous';
  im.onload = () => { const w = ancho || im.naturalWidth || 800, h = Math.round(w * (im.naturalHeight || 600) / (im.naturalWidth || 800)), cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(im, 0, 0, w, h); res({data:cv.toDataURL('image/png'), w, h}); };
  im.onerror = () => res(null); im.src = url; });
async function frcPowerPoint(){
  const A = frCosechaAnalisis(); if (!A) return;
  toast('⏳ Armando la presentación…');
  let Pptx; try { Pptx = await cargarPptx(); } catch (e) { toast('⚠ ' + e.message); return; }
  const T = frcTextos(A), R = A.resumen, tot = A.total, hayT = A.conTch.length > 0, n1 = (x, d = 1) => frNum(x, d);
  const [logo, portada] = await Promise.all([frcImagen('img/logo-riopaila.png', 400), frcImagen('img/portada-informe-nf.svg', 900)]);
  const mapa = frcMapa(A, 1800), mapaD = mapa.toDataURL('image/png');
  const p = new Pptx(); p.layout = 'LAYOUT_WIDE'; p.title = 'Afectación de cosecha por niveles freáticos y lluvias'; p.company = 'Riopaila Agrícola S.A.';
  const VERDE = '14532D', OSC = '0F172A', GRIS = '64748B', COL = FR_CRIT.map(k => k.col.slice(1)), F = 'Arial', plano = s => s.replace(/<[^>]+>/g, '');
  // Plantilla: barra de título, logo y número de diapositiva
  p.defineSlideMaster({title:'BASE', background:{color:'FFFFFF'}, objects:[
    {rect:{x:0, y:0, w:13.33, h:0.9, fill:{color:VERDE}}},
    {rect:{x:0, y:7.3, w:13.33, h:0.2, fill:{color:'E2E8F0'}}},
    ...(logo ? [{image:{data:logo.data, x:12.2, y:0.08, w:0.9, h:0.9 * logo.h / logo.w}}] : []),
    {text:{text:'Área de Ingeniería Agrícola · Riopaila Agrícola S.A.', options:{x:0.4, y:7.05, w:8, h:0.25, fontSize:9, color:GRIS, fontFace:F}}},
  ], slideNumber:{x:12.6, y:7.02, fontSize:9, color:GRIS}});
  const nueva = titulo => { const s = p.addSlide({masterName:'BASE'}); s.addText(titulo, {x:0.4, y:0.12, w:11.6, h:0.66, fontSize:24, bold:true, color:'FFFFFF', fontFace:F}); return s; };
  const nota = (s, txt, o = {}) => s.addText(plano(txt), {x:0.4, y:6.2, w:12.5, h:0.8, fontSize:12, color:OSC, fontFace:F, valign:'top', ...o});
  const ejes = {catAxisLabelFontSize:11, valAxisLabelFontSize:10, catAxisLabelFontFace:F, valAxisLabelFontFace:F, valGridLine:{color:'E2E8F0', size:0.5}, legendFontSize:11, legendFontFace:F};

  // 1. Portada
  let s = p.addSlide(); s.background = {color:VERDE};
  if (portada) s.addImage({data:portada.data, x:8.4, y:0, w:7.5 * portada.w / portada.h, h:7.5, transparency:15});
  if (logo) s.addImage({data:logo.data, x:0.6, y:0.5, w:1.5, h:1.5 * logo.h / logo.w});
  s.addText('Afectación de cosecha por\nniveles freáticos y lluvias', {x:0.6, y:2.3, w:8, h:1.8, fontSize:36, bold:true, color:'FFFFFF', fontFace:F});
  s.addText(`Suertes cosechadas${T.periodo ? ': ' + T.periodo : ''}`, {x:0.6, y:4.2, w:8, h:0.5, fontSize:18, color:'BBF7D0', fontFace:F});
  if (A.desplazadas) s.addText(`Condiciones evaluadas un año antes del corte (${T.periodoA})`, {x:0.6, y:4.75, w:8, h:0.45, fontSize:14, color:'D1FAE5', italic:true, fontFace:F});
  const hoy = new Date();
  s.addText(`Área de Ingeniería Agrícola · ${frMesL[hoy.getMonth()].replace(/^./, c => c.toUpperCase())} ${hoy.getFullYear()}`, {x:0.6, y:6.4, w:8, h:0.5, fontSize:14, color:'FFFFFF', fontFace:F});

  // 2. Metodología
  s = nueva('Metodología');
  const pasos = [['📍', 'Pozo de influencia', 'Pozo de observación más cercano con lecturas'], ['📏', `Nivel ${frcE.ventana} días antes`, `Promedio de ~${Math.round(frcE.ventana / 15)} lecturas quincenales`], ['🌧', 'Lluvia de la hacienda', 'Misma ventana, comparada con lo normal de la época'], ['🧱', 'Zona agroecológica', 'Grupo de suelo y humedad del maestro']];
  pasos.forEach(([ic, t, d], i) => { const x = 0.4 + i * 3.15;
    s.addShape(p.ShapeType.roundRect, {x, y:1.2, w:2.95, h:2.1, fill:{color:'F0FDF4'}, line:{color:'86EFAC'}, rectRadius:0.15});
    s.addText(ic, {x, y:1.3, w:2.95, h:0.7, fontSize:30, align:'center'});
    s.addText(t, {x:x + 0.1, y:2.0, w:2.75, h:0.5, fontSize:15, bold:true, align:'center', color:VERDE, fontFace:F});
    s.addText(d, {x:x + 0.1, y:2.5, w:2.75, h:0.7, fontSize:11, align:'center', color:OSC, fontFace:F}); });
  FR_CRIT.forEach((k, i) => { const x = 0.4 + i * 4.2;
    s.addShape(p.ShapeType.roundRect, {x, y:3.65, w:4, h:1.2, fill:{color:COL[i]}, line:{color:COL[i]}, rectRadius:0.12});
    s.addText([{text:`Criterio ${k.c}\n`, options:{fontSize:20, bold:true}}, {text:`${k.n} · nivel ${k.r}`, options:{fontSize:13}}], {x, y:3.65, w:4, h:1.2, align:'center', color:'FFFFFF', fontFace:F}); });
  nota(s, A.desplazadas ? `Fecha de referencia: el mismo día del año anterior al corte (ej. corte 15 oct 2026 → condiciones hasta el 15 oct 2025). Período analizado: ${T.periodoA}.` : 'Fecha de referencia: la fecha de corte de cada suerte.', {y:5.2, h:0.9, fontSize:13, italic:true});

  // 3. Resultados generales
  s = nueva('Resultados generales');
  [['Suertes evaluadas', tot.n, `${n1(tot.ha, 0)} ha`, '334155'], ...R.map((k, i) => [`Criterio ${k.c} · ${k.n}`, k.n, `${n1(T.pct(k.n), 0)}% · ${n1(k.ha, 0)} ha`, COL[i]])].forEach(([t, v, sub, c], i) => {
    s.addShape(p.ShapeType.roundRect, {x:0.4, y:1.1 + i * 1.07, w:4.3, h:0.95, fill:{color:c}, line:{color:c}, rectRadius:0.12});
    s.addText([{text:String(v), options:{fontSize:26, bold:true}}, {text:`   ${t}\n`, options:{fontSize:13, bold:true}}, {text:sub, options:{fontSize:12}}], {x:0.55, y:1.1 + i * 1.07, w:4.1, h:0.95, color:'FFFFFF', fontFace:F, valign:'middle'}); });
  s.addChart(p.ChartType.doughnut, [{name:'Suertes', labels:R.map(k => `Criterio ${k.c} · ${k.n}`), values:R.map(k => k.n)}],
    {x:5, y:1.05, w:4.2, h:4.2, chartColors:COL, holeSize:55, showPercent:true, showValue:false, dataLabelColor:'FFFFFF', dataLabelFontSize:13, dataLabelFontBold:true, showLegend:true, legendPos:'b', legendFontSize:11, showTitle:true, title:'Suertes por criterio', titleFontSize:14});
  s.addChart(p.ChartType.bar, [{name:'Área (ha)', labels:R.map(k => `Criterio ${k.c}`), values:R.map(k => +k.ha.toFixed(1))}],
    {x:9.3, y:1.05, w:3.7, h:4.2, barDir:'col', chartColors:COL, showValue:true, dataLabelFontSize:11, dataLabelPosition:'outEnd', showTitle:true, title:'Área (ha)', titleFontSize:14, ...ejes, valAxisHidden:true, valGridLine:{style:'none'}, varyColors:true});
  nota(s, T.pRes, {y:5.45, h:1.5, fontSize:12});

  // 4. Mapa
  s = nueva('¿Dónde están las suertes afectadas?');
  const mh = 6.0, mw = Math.min(12.5, mh * mapa.width / mapa.height);
  s.addImage({data:mapaD, x:(13.33 - mw) / 2, y:1.0, w:mw, h:mw * mapa.height / mapa.width});

  // 5. Lluvia y nivel mes a mes
  const Se = A.serie.filter(x => x.nivel != null || x.lluvia != null);
  if (Se.length >= 2) {
    s = nueva('Lluvia y nivel freático mes a mes');
    const lab = Se.map(x => `${frMes[+x.m.slice(5) - 1]} ${x.m.slice(2, 4)}`);
    const niv = Se.map((x, i) => { if (x.nivel != null) return x.nivel; const a = Se.slice(0, i).reverse().find(y => y.nivel != null), b = Se.slice(i + 1).find(y => y.nivel != null); return a && b ? (a.nivel + b.nivel) / 2 : (a || b || {nivel:0}).nivel; });
    s.addChart([
      {type:p.ChartType.bar, data:[{name:'Lluvia del mes (mm)', labels:lab, values:Se.map(x => x.lluvia != null ? Math.round(x.lluvia) : 0)}], options:{chartColors:['60A5FA'], barGrouping:'clustered'}},
      {type:p.ChartType.line, data:[{name:'Nivel freático promedio (m)', labels:lab, values:niv.map(v => +v.toFixed(2))}], options:{chartColors:[OSC], lineSize:3, lineDataSymbol:'circle', lineDataSymbolSize:8, secondaryValAxis:true, secondaryCatAxis:true}},
    ], {x:0.4, y:1.05, w:12.5, h:4.9, ...ejes, showLegend:true, legendPos:'t',
      valAxes:[{showValAxisTitle:true, valAxisTitle:'Lluvia (mm)', valAxisTitleFontSize:11}, {showValAxisTitle:true, valAxisTitle:'Nivel freático (m) · 0 = superficie', valAxisTitleFontSize:11, valAxisMinVal:0, valAxisMaxVal:2, valAxisOrientation:'maxMin', valGridLine:{style:'none'}}],
      catAxes:[{catAxisTitle:'Mes'}, {catAxisHidden:true}]});
    nota(s, `El nivel freático se grafica con la superficie arriba: cuando la línea sube, el agua está más cerca de las raíces. Umbral de afectación alta: 0,8 m.`, {fontSize:12, italic:true});
  }

  // 6. Lluvia por criterio y relación lluvia–nivel
  if (A.hayLl) {
    s = nueva('Lluvia antes del corte');
    const Rl = R.filter(k => k.lluvia != null);
    s.addChart(p.ChartType.bar, [{name:`Lluvia ${frcE.ventana} días antes (mm)`, labels:Rl.map(k => `Criterio ${k.c}`), values:Rl.map(k => Math.round(k.lluvia))}, {name:'Normal de esa época (mm)', labels:Rl.map(k => `Criterio ${k.c}`), values:Rl.map(k => Math.round(k.normal || 0))}],
      {x:0.4, y:1.05, w:6.2, h:4.9, barDir:'col', barGrouping:'clustered', chartColors:['0369A1', '94A3B8'], showValue:true, dataLabelFontSize:11, dataLabelPosition:'outEnd', showLegend:true, legendPos:'b', ...ejes, showTitle:true, title:'Lluvia por criterio vs normal', titleFontSize:14});
    const Ls = A.ok.filter(x => x.lluvia != null);
    s.addChart(p.ChartType.scatter, [{name:'Lluvia (mm)', values:Ls.map(x => Math.round(x.lluvia))}, {name:'Nivel freático (m)', values:Ls.map(x => +x.nivel.toFixed(2))}],
      {x:6.8, y:1.05, w:6.2, h:4.9, lineSize:0, lineDataSymbol:'circle', lineDataSymbolSize:7, chartColors:['0369A1'], showLegend:false, ...ejes, showTitle:true, title:'Cada suerte: lluvia vs nivel', titleFontSize:14,
        showValAxisTitle:true, valAxisTitle:'Nivel freático (m)', showCatAxisTitle:true, catAxisTitle:`Lluvia ${frcE.ventana} días antes (mm)`, valAxisOrientation:'maxMin', valAxisMinVal:0, valAxisMaxVal:2});
    nota(s, T.pLl, {y:6.0, h:1.0, fontSize:11});
  }

  // 7. Suelos y humedad
  const grp = (G, et) => { const E = Object.entries(G).filter(([, x]) => x.n >= 2).sort((a, b) => b[1][5] / b[1].n - a[1][5] / a[1].n).slice(0, 12); return {lab:E.map(([k]) => et(k)), data:FR_CRIT.map(c => ({name:`Criterio ${c.c}`, labels:E.map(([k]) => et(k)), values:E.map(([, x]) => x[c.c])}))}; };
  const gS = grp(A.suelos, k => 'Suelo ' + k), gH = grp(A.hums, k => k);
  if (gS.lab.length) {
    s = nueva('Tipo de suelo (zona agroecológica)');
    s.addChart(p.ChartType.bar, gS.data, {x:0.4, y:1.05, w:7.6, h:4.95, barDir:'bar', barGrouping:'percentStacked', chartColors:COL, showValue:true, dataLabelFormatCode:'0;;;', valAxisLabelFormatCode:'0%', dataLabelColor:'FFFFFF', dataLabelFontSize:10, showLegend:true, legendPos:'b', ...ejes, showTitle:true, title:'Suertes por criterio según grupo de suelo', titleFontSize:14});
    if (gH.lab.length) s.addChart(p.ChartType.bar, gH.data, {x:8.2, y:1.05, w:4.8, h:4.95, barDir:'bar', barGrouping:'percentStacked', chartColors:COL, showValue:true, dataLabelFormatCode:'0;;;', valAxisLabelFormatCode:'0%', dataLabelColor:'FFFFFF', dataLabelFontSize:10, showLegend:false, ...ejes, showTitle:true, title:'Según grupo de humedad', titleFontSize:14});
    nota(s, T.pSuelo, {y:6.05, h:0.95, fontSize:11});
  }

  // 8. Haciendas
  const Hh = Object.entries(A.hacs).sort((a, b) => b[1].ha - a[1].ha).slice(0, 14);
  s = nueva('Afectación por hacienda');
  s.addChart(p.ChartType.bar, FR_CRIT.map(c => ({name:`Criterio ${c.c} · ${c.n}`, labels:Hh.map(([h]) => h), values:Hh.map(([, x]) => x[c.c])})),
    {x:0.4, y:1.05, w:12.5, h:5.0, barDir:'col', barGrouping:'stacked', chartColors:COL, showValue:true, dataLabelFormatCode:'0;;;', dataLabelColor:'FFFFFF', dataLabelFontSize:10, showLegend:true, legendPos:'t', ...ejes, catAxisLabelRotate:-30, valAxisTitle:'Suertes', showValAxisTitle:true});
  if (T.hacT.length) nota(s, `Más área en afectación alta: ${T.hacT.map(([n, x]) => `${n} (${n1(x.ha5)} ha)`).join(', ')}.`, {y:6.15, h:0.8});

  // 9. TCH (si el Excel lo trae)
  if (hayT) {
    s = nueva('Afectación en la producción (TCH)');
    const Rt = R.filter(k => k.tch);
    s.addChart(p.ChartType.bar, [{name:'TCH real', labels:Rt.map(k => `Criterio ${k.c}`), values:Rt.map(k => +k.tch.toFixed(1))}, {name:'TCH ppto/est', labels:Rt.map(k => `Criterio ${k.c}`), values:Rt.map(k => +(k.ref || 0).toFixed(1))}],
      {x:0.4, y:1.05, w:6.2, h:4.9, barDir:'col', barGrouping:'clustered', chartColors:['0F766E', 'CBD5E1'], showValue:true, dataLabelFontSize:11, showLegend:true, legendPos:'b', ...ejes});
    s.addChart(p.ChartType.scatter, [{name:'Nivel (m)', values:A.conTch.map(x => +x.nivel.toFixed(2))}, {name:'TCH', values:A.conTch.map(x => +x.tch.toFixed(1))}],
      {x:6.8, y:1.05, w:6.2, h:4.9, lineSize:0, lineDataSymbol:'circle', lineDataSymbolSize:7, chartColors:['0F766E'], showLegend:false, ...ejes, showCatAxisTitle:true, catAxisTitle:'Nivel freático antes del corte (m)', showValAxisTitle:true, valAxisTitle:'TCH real'});
    nota(s, T.pTch, {y:6.0, h:1.0, fontSize:11});
  }

  // 10. Suertes con afectación alta (tabla con su justificación resumida)
  const afect = A.ok.filter(x => x.crit === 5).sort((a, b) => a.nivel - b.nivel), porHoja = 11;
  const cab = ['Suerte', 'Hacienda', 'Corte', 'Referencia', 'Zona', 'Pozo', 'Nivel (m)', 'Mín. (m)', 'Lluvia (mm)', '% normal'].map(t => ({text:t, options:{bold:true, color:'FFFFFF', fill:{color:VERDE}, fontSize:11}}));
  for (let i = 0; i < afect.length; i += porHoja) {
    s = nueva(`Suertes con afectación alta${afect.length > porHoja ? ` (${i / porHoja + 1} de ${Math.ceil(afect.length / porHoja)})` : ''}`);
    const filas = afect.slice(i, i + porHoja).map((x, j) => [x.s, x.hac, frFechaCorta(x.fc), frFechaCorta(x.fa), x.za || '—', x.pozo || '—', n1(x.nivel, 2), x.min != null ? n1(x.min, 2) : '—', x.lluvia != null ? n1(x.lluvia, 0) : '—', x.anom ? n1(x.anom * 100, 0) + '%' : '—']
      .map((t, c) => ({text:String(t), options:{fontSize:11, fill:{color:j % 2 ? 'FFFFFF' : 'FEF2F2'}, color:c === 6 ? 'B91C1C' : OSC, bold:c === 6 || c === 0}})));
    s.addTable([cab, ...filas], {x:0.4, y:1.1, w:12.5, colW:[1.15, 2.1, 1.15, 1.25, 0.95, 0.8, 1.15, 1.1, 1.45, 1.4], border:{type:'solid', pt:0.5, color:'CBD5E1'}, fontFace:F, align:'center', valign:'middle', rowH:0.42});
  }
  // 11. Ejemplos de justificación (las 4 suertes más críticas)
  if (afect.length) {
    s = nueva('¿Por qué se afectaron? · casos más críticos');
    afect.slice(0, 4).forEach((x, i) => { const y = 1.1 + i * 1.45;
      s.addShape(p.ShapeType.roundRect, {x:0.4, y, w:12.5, h:1.3, fill:{color:'FEF2F2'}, line:{color:'FCA5A5'}, rectRadius:0.1});
      s.addText([{text:`${x.s} · ${x.hac}\n`, options:{bold:true, fontSize:15, color:'B91C1C'}}, {text:`${n1(x.nivel, 2)} m`, options:{bold:true, fontSize:20, color:'B91C1C'}}], {x:0.55, y, w:2.6, h:1.3, fontFace:F, valign:'middle'});
      s.addText(x.just, {x:3.2, y:y + 0.05, w:9.6, h:1.2, fontSize:12, color:OSC, fontFace:F, valign:'middle'}); });
  }
  // 12. Conclusiones
  s = nueva('Conclusiones y recomendaciones');
  s.addText(T.concl.map(c => ({text:plano(c), options:{bullet:{code:'25CF'}, paraSpaceAfter:10}})), {x:0.6, y:1.2, w:12.1, h:5.6, fontSize:15, color:OSC, fontFace:F, valign:'top'});

  const nombre = `Cosecha vs niveles freaticos ${new Date().toISOString().slice(0, 10)}.pptx`;
  await p.writeFile({fileName:nombre});
  toast(`📊 Presentación lista: ${nombre}`);
}

q('nfcosecha').addEventListener('click', e => {
  if (e.target.closest('[data-frc-volver]')) { irA('freat'); return; }
  if (e.target.closest('[data-frc-informe]')) { frInformeCosecha(); return; }
  if (e.target.closest('[data-frc-ppt]')) { frcPowerPoint().catch(err => { console.error(err); toast('⚠ No se pudo armar la presentación: ' + (err.message || err)); }); return; }
  const j = e.target.closest('[data-frc-just]'); if (j) { alert(j.querySelector('td').textContent + '\n\n' + j.dataset.frcJust); return; }
  const h = e.target.closest('[data-frc-hoja]'); if (h && frcE.cand) frUsarHojaCosecha(frcE.cand.archivo, frcE.cand.lista[+h.dataset.frcHoja]);
});
q('nfcosecha').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'frc-archivo') { frCargarCosecha(t.files[0]); t.value = ''; }
  else if (t.id === 'frc-mes') modCambio(() => { DB.cosechaNF.mes = t.value; });
  else if (t.id === 'frc-ven') { frcE.ventana = +t.value; renderCosechaNF(); }
  else if (t.id === 'frc-base') { frcE.base = t.value; renderCosechaNF(); }
  else if (t.id === 'frc-anio') { frcE.anio = t.value; renderCosechaNF(); }
});

// Este es el último script del módulo: si la página abrió en #freaticos, #cosecha-niveles o en la portada, redibujar
if (['freat', 'nfcos', 'maes', 'portal'].includes(vistaActual)) renderVista();
