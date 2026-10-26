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
function frCosechaAnalisis(){
  const K = frCosecha(), F = freatico(); if (!K || !F || typeof MAPA_FREATICO === 'undefined') return null;
  const C = frCentros(), fechas = frFechas(F), ven = frcE.ventana, M = MAPA_FREATICO;
  const pozos = F.pozos.filter(p => p[1] != null).map(p => { const [x, y] = frTM(p[1], p[2]); return {n:p[0], h:p[3], x:x - M.x0, y:y - M.y0}; });
  const puntos = {}, P = f => puntos[f] = puntos[f] || frPuntos(F, f);
  const mesDef = K.mes ? K.mes + '-15' : null;
  const filas = K.filas.map(r => {
    const fc = r.f || mesDef, c = C[r.s], o = {...r, fc, ha:r.a || (c && c.ha) || 0, hac:r.h || (c ? frNomHac(c.h) : '')};
    if (!fc) return {...o, motivo:'sin fecha de corte'};
    if (!c) return {...o, motivo:'suerte no está en la cartografía'};
    const d = frDia(fc);
    let ven2 = fechas.filter(f => { const x = frDia(f); return x <= d && x > d - ven; });
    if (!ven2.length) { const ant = fechas.filter(f => frDia(f) <= d).pop(); if (ant && frDia(ant) > d - ven - 20) ven2 = [ant]; }
    if (!ven2.length) return {...o, motivo:'sin lecturas antes del corte'};
    // Pozo de influencia: el más cercano que tenga lecturas en la ventana
    const cand = pozos.map(p => ({p, d:Math.hypot(p.x - c.x, p.y - c.y)})).sort((a, b) => a.d - b.d);
    let pi = null, vals = [];
    for (const x of cand) { const v = ven2.map(f => frVal(F.lecturas[f][x.p.n])).filter(v => v != null); if (v.length) { pi = x; vals = v; break; } }
    const nPozo = vals.length ? sum(vals, v => v) / vals.length : null;
    const idw = ven2.map(f => frIDWPunto(P(f), c.x, c.y)).filter(v => v != null), nIdw = idw.length ? sum(idw, v => v) / idw.length : null;
    const nivel = frcE.base === 'idw' ? nIdw : nPozo;
    return {...o, ven:ven2, pozo:pi && pi.p.n, dist:pi && pi.d, nPozo, nIdw, nivel, crit:frCrit(nivel), min:vals.length ? Math.min(...vals) : null};
  });
  const ok = filas.filter(x => x.crit), conTch = ok.filter(x => x.tch > 0);
  const por = c => ok.filter(x => x.crit === c), haDe = L => sum(L, x => x.ha || 0);
  const tchP = L => { const w = sum(L, x => x.ha || 1); return L.length ? sum(L, x => x.tch * (x.ha || 1)) / w : null; };
  const refP = L => { const L2 = L.filter(x => x.tchp > 0 || x.tche > 0); const w = sum(L2, x => x.ha || 1); return L2.length ? sum(L2, x => (x.tche || x.tchp) * (x.ha || 1)) / w : null; };
  const resumen = FR_CRIT.map(k => { const L = por(k.c), T = L.filter(x => x.tch > 0); return {...k, n:L.length, ha:haDe(L), tch:tchP(T), ref:refP(T), nT:T.length}; });
  // Relación nivel vs TCH (regresión lineal simple)
  let reg = null;
  if (conTch.length >= 5) { const xs = conTch.map(x => x.nivel), ys = conTch.map(x => x.tch), mx = sum(xs, v => v) / xs.length, my = sum(ys, v => v) / ys.length;
    const sxy = sum(xs.map((v, i) => (v - mx) * (ys[i] - my)), v => v), sxx = sum(xs, v => (v - mx) ** 2), syy = sum(ys, v => (v - my) ** 2);
    if (sxx && syy) reg = {m:sxy / sxx, b:my - sxy / sxx * mx, r:sxy / Math.sqrt(sxx * syy), n:conTch.length}; }
  const meses = {}; ok.forEach(x => { const m = x.fc.slice(0, 7); (meses[m] = meses[m] || {5:0, 3:0, 1:0, ha5:0, n:0}); meses[m][x.crit]++; meses[m].n++; if (x.crit === 5) meses[m].ha5 += x.ha || 0; });
  const hacs = {}; ok.forEach(x => { const h = x.hac || '—'; (hacs[h] = hacs[h] || {5:0, 3:0, 1:0, n:0, ha:0, ha5:0}); hacs[h][x.crit]++; hacs[h].n++; hacs[h].ha += x.ha || 0; if (x.crit === 5) hacs[h].ha5 += x.ha || 0; });
  return {filas, ok, resumen, reg, meses, hacs, conTch, total:{n:ok.length, ha:haDe(ok)}, sin:filas.filter(x => !x.crit)};
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
      <div class="sim-subt">Sustento de afectación: nivel freático de los días previos al corte de cada suerte cosechada (método de pozo de influencia y criterio 5 / 3 / 1)</div></div>
      <div class="fr-acc"><button type="button" class="mbtn mbtn-ghost" data-frc-volver>← Niveles freáticos</button></div></div>`;
  if (!K || !A) { cont.innerHTML = top + fuente + `<div class="sim-card abierta" style="padding:14px 16px;line-height:1.6"><b>¿Cómo funciona?</b><br>
    1. Carga el Excel de suertes cosechadas: basta una columna con la suerte (ej. <i>Sec-Sue</i>, <i>Sector suerte cosechada</i>: 3107-430). Si trae <i>Fecha de corte</i>, <i>Área</i>, <i>TCH real</i> y <i>TCH presupuesto/estimado</i>, se usan.<br>
    2. A cada suerte se le busca su <b>pozo de influencia</b> (el más cercano con lecturas) y se promedian sus lecturas en los días previos al corte.<br>
    3. Criterio: <b style="color:#dc2626">5</b> nivel &lt; 0,8 m (afectación alta) · <b style="color:#f59e0b">3</b> 0,8–1,2 m · <b style="color:#16a34a">1</b> ≥ 1,2 m (sin afectación).<br>
    4. Si hay TCH, se compara la producción de cada grupo para sustentar la afectación, y se genera el informe.</div>`; return; }
  const R = A.resumen, tot = A.total, hayT = A.conTch.length > 0, r1 = R.find(x => x.c === 1), r5 = R.find(x => x.c === 5);
  const pct = n => tot.n ? n / tot.n * 100 : 0;
  const filas = A.filas.slice().sort((a, b) => (b.crit || 0) - (a.crit || 0) || (a.nivel ?? 9) - (b.nivel ?? 9));
  cont.innerHTML = top + fuente + `
    <div class="fr-filtros frc-par">
      <label class="fchip"><span>Ventana antes del corte</span><select id="frc-ven" class="fsel on">${[30, 45, 60, 90].map(d => `<option value="${d}" ${frcE.ventana === d ? 'selected' : ''}>${d} días (~${Math.round(d / 15)} lecturas)</option>`).join('')}</select></label>
      <label class="fchip"><span>Nivel de la suerte</span><select id="frc-base" class="fsel on"><option value="pozo" ${frcE.base === 'pozo' ? 'selected' : ''}>Pozo de influencia (más cercano)</option><option value="idw" ${frcE.base === 'idw' ? 'selected' : ''}>IDW en el centro de la suerte</option></select></label>
      <span class="meta">Criterio: ${FR_CRIT.map(k => `<b style="color:${k.col}">${k.c}</b> ${k.r}`).join(' · ')}</span>
    </div>
    <div class="sim-kpis fr-kpis">
      <div class="sim-kpi"><div class="l">Suertes cosechadas</div><div class="v">${tot.n}</div><div class="s">${frNum(tot.ha, 1)} ha con dato${A.sin.length ? ` · ${A.sin.length} sin dato` : ''}</div></div>
      ${R.map(k => `<div class="sim-kpi fr-k" style="--c:${k.col}"><div class="l">${k.c} · ${k.n} <small>${k.r}</small></div><div class="v">${k.n} <small style="font-size:.5em">suertes</small></div><div class="s">${frNum(pct(k.n), 1)}% · ${frNum(k.ha, 1)} ha${k.tch ? ` · TCH ${frNum(k.tch, 1)}` : ''}</div></div>`).join('')}
    </div>
    ${hayT ? `<div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>TCH real por criterio</b> <span class="meta">· promedio ponderado por área</span></div>${frcGrafTCH(R)}
        ${r1 && r5 && r1.tch && r5.tch ? `<div class="frc-dato">Las suertes con afectación alta produjeron <b>${frNum(r5.tch, 1)} TCH</b>, <b style="color:${r5.tch < r1.tch ? 'var(--red)' : 'var(--green)'}">${frNum(Math.abs(1 - r5.tch / r1.tch) * 100, 1)}% ${r5.tch < r1.tch ? 'menos' : 'más'}</b> que las suertes sin afectación (${frNum(r1.tch, 1)} TCH).</div>` : ''}</div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Nivel freático vs TCH</b> <span class="meta">· cada punto es una suerte</span></div>${frcGrafDisp(A)}
        ${A.reg ? `<div class="frc-dato">Relación ${Math.abs(A.reg.r) >= 0.5 ? 'fuerte' : Math.abs(A.reg.r) >= 0.3 ? 'moderada' : 'débil'} (r = ${frNum(A.reg.r, 2)}, ${A.reg.n} suertes): ${A.reg.m > 0 ? `por cada 10 cm más superficial el nivel, la TCH baja en promedio <b>${frNum(A.reg.m / 10, 1)} t/ha</b>` : 'en estos datos la TCH no baja cuando el nivel es más superficial'}.</div>` : ''}</div>
    </div>` : '<div class="nores" style="margin:0 0 12px">El Excel no trae TCH: se muestra solo la calificación por nivel freático. Si cargas un Excel con «TCH real» se agrega la comparación de producción.</div>'}
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Por mes de corte</b></div>
        <div class="sim-tw"><table class="sim-t"><thead><tr><th>Mes</th><th class="n">Suertes</th>${FR_CRIT.map(k => `<th class="n" style="color:${k.col}">${k.c}</th>`).join('')}<th class="n">% crit. 5</th></tr></thead>
        <tbody>${Object.keys(A.meses).sort().map(m => { const x = A.meses[m]; return `<tr><td>${frMesL[+m.slice(5) - 1]} ${m.slice(0, 4)}</td><td class="n">${x.n}</td>${FR_CRIT.map(k => `<td class="n">${x[k.c]}</td>`).join('')}<td class="n b">${frNum(x[5] / x.n * 100, 0)}%</td></tr>`; }).join('')}</tbody></table></div></div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Por hacienda</b></div>
        <div class="sim-tw" style="max-height:320px"><table class="sim-t"><thead><tr><th>Hacienda</th><th class="n">Suertes</th>${FR_CRIT.map(k => `<th class="n" style="color:${k.col}">${k.c}</th>`).join('')}<th class="n">ha crit. 5</th></tr></thead>
        <tbody>${Object.entries(A.hacs).sort((a, b) => b[1][5] - a[1][5] || b[1].n - a[1].n).map(([h, x]) => `<tr><td>${esc(h)}</td><td class="n">${x.n}</td>${FR_CRIT.map(k => `<td class="n">${x[k.c]}</td>`).join('')}<td class="n b">${frNum(x.ha5, 1)}</td></tr>`).join('')}</tbody></table></div></div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Detalle por suerte</b> <span class="meta">· de más a menos afectada</span></div>
      <div class="sim-tw" style="max-height:480px"><table class="sim-t"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Corte</th><th class="n">Área</th><th>Pozo influencia</th><th class="n">Lecturas</th><th class="n">Nivel pozo (m)</th><th class="n">Nivel IDW (m)</th><th>Criterio</th>${hayT ? '<th class="n">TCH real</th><th class="n">TCH ppto/est</th>' : ''}</tr></thead>
      <tbody>${filas.map(x => `<tr><td class="lab" style="font-family:var(--mono)">${esc(x.s)}</td><td>${esc(x.hac)}</td><td>${x.fc ? frFecha(x.fc) + (x.f ? '' : ' <small class="meta">(mes)</small>') : '—'}</td><td class="n">${x.ha ? frNum(x.ha) : '—'}</td>
        <td>${x.pozo ? `Pozo ${x.pozo} <small class="meta">${frNum(x.dist, 0)} m</small>` : `<span class="meta">${esc(x.motivo || '—')}</span>`}</td><td class="n">${x.ven ? x.ven.length : '—'}</td>
        <td class="n">${x.nPozo != null ? frNum(x.nPozo) : '—'}</td><td class="n">${x.nIdw != null ? frNum(x.nIdw) : '—'}</td>
        <td>${x.crit ? `<span class="ag-est" style="--c:${frCritDe(x.crit).col}">${x.crit} · ${frCritDe(x.crit).n}</span>` : '<span class="meta">—</span>'}</td>
        ${hayT ? `<td class="n b">${x.tch ? frNum(x.tch, 1) : '—'}</td><td class="n">${x.tche || x.tchp ? frNum(x.tche || x.tchp, 1) : '—'}</td>` : ''}</tr>`).join('')}</tbody></table></div></div>
    <div class="fr-inf fr-inf-c"><button type="button" class="mbtn" data-frc-informe>📄 Generar informe de sustento · cosecha vs niveles</button>
      <span class="meta">Informe con objetivo, metodología, criterios, resultados${hayT ? ', comparación de TCH, gráficos' : ''} y detalle de suertes afectadas, listo para imprimir o guardar en PDF</span></div>`;
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
// Dispersión nivel (m) vs TCH real con la línea de tendencia
function frcGrafDisp(A){
  const L = A.conTch, W = 420, H = 230, ml = 36, mr = 10, mt = 10, mb = 30;
  const xm = Math.max(2, ...L.map(x => x.nivel)), y0 = Math.min(...L.map(x => x.tch)) * 0.9, y1 = Math.max(...L.map(x => x.tch)) * 1.05;
  const X = v => ml + v / xm * (W - ml - mr), Y = v => mt + (1 - (v - y0) / ((y1 - y0) || 1)) * (H - mt - mb);
  const bandas = FR_CRIT.map((k, i) => { const a = [0, 0.8, 1.2][i], b = Math.min(xm, [0.8, 1.2, xm][i]); return `<rect x="${X(a)}" y="${mt}" width="${X(b) - X(a)}" height="${H - mt - mb}" fill="${k.col}" opacity=".08"/>`; }).join('');
  const reg = A.reg ? `<line x1="${X(0)}" y1="${Y(A.reg.b)}" x2="${X(xm)}" y2="${Y(A.reg.b + A.reg.m * xm)}" stroke="#0f172a" stroke-width="1.5" stroke-dasharray="5 3"/>` : '';
  return `<svg class="frc-svg" viewBox="0 0 ${W} ${H}">${bandas}
    ${[0, 0.5, 1, 1.5, 2].filter(v => v <= xm).map(v => `<text x="${X(v)}" y="${H - mb + 13}" text-anchor="middle">${frNum(v, 1)}</text>`).join('')}<text x="${(W + ml) / 2}" y="${H - 4}" text-anchor="middle">Nivel freático antes del corte (m)</text>
    ${[y0, (y0 + y1) / 2, y1].map(v => `<text x="${ml - 4}" y="${Y(v) + 3}" text-anchor="end">${frNum(v, 0)}</text>`).join('')}
    ${L.map(x => `<circle cx="${X(x.nivel).toFixed(1)}" cy="${Y(x.tch).toFixed(1)}" r="3.5" fill="${frCritDe(x.crit).col}" opacity=".8"><title>${x.s}: ${frNum(x.nivel)} m · ${frNum(x.tch, 1)} TCH</title></circle>`).join('')}${reg}</svg>`;
}

// ── Informe de sustento ──
function frInformeCosecha(){
  const A = frCosechaAnalisis(), K = frCosecha(); if (!A) return;
  const R = A.resumen, tot = A.total, hayT = A.conTch.length > 0, r1 = R.find(x => x.c === 1), r3 = R.find(x => x.c === 3), r5 = R.find(x => x.c === 5);
  const pct = n => tot.n ? n / tot.n * 100 : 0, n1 = (x, d = 1) => frNum(x, d);
  const fcs = A.ok.map(x => x.fc).sort(), desde = fcs[0], hasta = fcs[fcs.length - 1];
  const periodo = desde && hasta ? (desde.slice(0, 7) === hasta.slice(0, 7) ? `${frMesL[+desde.slice(5, 7) - 1]} de ${desde.slice(0, 4)}` : `${frFechaL(desde)} y el ${frFechaL(hasta)}`) : '';
  const hoy = new Date(), hoyTxt = `${frMesL[hoy.getMonth()].replace(/^./, c => c.toUpperCase())} ${hoy.getDate()} del ${hoy.getFullYear()}`;
  const abs = u => new URL(u, document.baseURI).href, logo = abs('img/logo-riopaila.png');
  const portada = abs('img/portada-informe-nf.svg');   // ilustración del nivel freático (pozo, raíces, lámina de agua)
  const editable = (txt, ph) => `<p class="ed${txt ? '' : ' vacio'}" contenteditable="true" data-ph="${ph}">${txt}</p>`;
  const afect = A.ok.filter(x => x.crit === 5).sort((a, b) => a.nivel - b.nivel);
  const pRes = `Se evaluaron <b>${tot.n}</b> suertes cosechadas${periodo ? ` entre ${desde.slice(0, 7) === hasta.slice(0, 7) ? '' : 'el '}${periodo}` : ''}, con un área de ${n1(tot.ha, 2)} ha. De ellas, <b>${r5.n} (${n1(pct(r5.n))}%, ${n1(r5.ha, 2)} ha)</b> presentaron niveles freáticos menores a 0,8 m en los ${frcE.ventana} días previos al corte (criterio 5, afectación alta), ${r3.n} (${n1(pct(r3.n))}%) se ubicaron entre 0,8 y 1,2 m (criterio 3) y ${r1.n} (${n1(pct(r1.n))}%) tuvieron niveles de 1,2 m o más (criterio 1, sin afectación).` +
    (A.sin.length ? ` ${A.sin.length} suertes no se pudieron evaluar (sin fecha de corte, sin ubicación en la cartografía o sin lecturas cercanas).` : '');
  const pTch = hayT && r1.tch && r5.tch ? `En cuanto a la producción, las suertes con afectación alta obtuvieron un TCH real promedio de <b>${n1(r5.tch)}</b> t/ha, frente a <b>${n1(r1.tch)}</b> t/ha en las suertes sin afectación, es decir, <b>${n1(Math.abs(1 - r5.tch / r1.tch) * 100)}% ${r5.tch < r1.tch ? 'menos' : 'más'}</b>${r3.tch ? `; las suertes con afectación media registraron ${n1(r3.tch)} t/ha` : ''}.` +
    (r5.ref ? ` Frente a su TCH presupuestado o estimado (${n1(r5.ref)} t/ha), las suertes con afectación alta ${r5.tch < r5.ref ? `quedaron ${n1((1 - r5.tch / r5.ref) * 100)}% por debajo` : `lo superaron en ${n1((r5.tch / r5.ref - 1) * 100)}%`}${r1.ref ? `, mientras que las suertes sin afectación ${r1.tch < r1.ref ? `quedaron ${n1((1 - r1.tch / r1.ref) * 100)}% por debajo` : `lo superaron en ${n1((r1.tch / r1.ref - 1) * 100)}%`}` : ''}.` : '') +
    (A.reg ? ` La relación entre el nivel freático previo al corte y el TCH es ${Math.abs(A.reg.r) >= 0.5 ? 'fuerte' : Math.abs(A.reg.r) >= 0.3 ? 'moderada' : 'débil'} (r = ${n1(A.reg.r, 2)})${A.reg.m > 0 ? `: en promedio, por cada 10 cm que el nivel freático está más cerca de la superficie, el TCH disminuye ${n1(A.reg.m / 10)} t/ha` : ''}.` : '') +
    (r5.tch < r1.tch ? ' Estos resultados sustentan que los niveles freáticos superficiales previos a la cosecha están asociados a una menor productividad de las suertes afectadas.' : ' En este grupo de suertes la diferencia de producción no se explica principalmente por el nivel freático, por lo que deben revisarse otros factores (edad, variedad, número de corte, labores).') : '';
  const concl = [
    `El ${n1(pct(r5.n))}% de las suertes cosechadas (${r5.n} suertes, ${n1(r5.ha, 2)} ha) tuvo niveles freáticos críticos (menos de 0,8 m) en los ${frcE.ventana} días previos al corte.`,
    hayT && r1.tch && r5.tch ? `Las suertes con afectación alta produjeron ${n1(Math.abs(1 - r5.tch / r1.tch) * 100)}% ${r5.tch < r1.tch ? 'menos' : 'más'} TCH que las suertes sin afectación (${n1(r5.tch)} vs ${n1(r1.tch)} t/ha).` : '',
    (() => { const h = Object.entries(A.hacs).sort((a, b) => b[1].ha5 - a[1].ha5).filter(x => x[1][5]).slice(0, 3); return h.length ? `Las haciendas con más área cosechada en condición de afectación alta fueron ${h.map(([n, x]) => `${esc(n)} (${n1(x.ha5)} ha)`).join(', ').replace(/, ([^,]*)$/, ' y $1')}.` : ''; })(),
    'Se recomienda priorizar el mantenimiento de drenajes en los sectores de influencia de los pozos con niveles críticos antes de la cosecha, y programar el corte de las suertes afectadas en los períodos de menor nivel freático.',
  ].filter(Boolean);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe cosecha vs niveles freáticos</title>
<style>${FR_INF_CSS}
  .frc-svg{width:100%;max-width:150mm;display:block;margin:2mm auto}.frc-svg text{font-size:10px;fill:#334155}.frc-svg .b{font-weight:700}
  .fr-cley{display:flex;gap:5mm;justify-content:center;font-size:9pt}.fr-cley i{display:inline-block;width:6mm;margin-right:1.5mm;vertical-align:middle}
  .det td,.det th{font-size:9pt;padding:1mm 2mm}
</style></head><body>
<img class="logo-pie" src="${logo}" alt="">
<div class="barra"><b>Informe cosecha vs niveles freáticos</b><span>Puedes corregir cualquier texto haciendo clic sobre él. Los espacios en gris son para completar.</span><button onclick="print()">🖨 Imprimir / Guardar PDF</button></div>
<div class="hoja portada"><div class="foto" style="background-image:url('${portada}')"></div><div class="velo"></div>
  <div class="caja"><div class="logo"><img src="${logo}" alt="Riopaila Agrícola"></div>
    <div class="pill t">Afectación de Cosecha<br>por Niveles Freáticos</div>
    ${periodo ? `<div class="pill s">Suertes cosechadas: ${esc(periodo)}</div>` : ''}
    <div class="pill s">Área de Ingeniería Agrícola<br><br><span contenteditable="true" class="ed">${hoyTxt}</span></div></div></div>

<div class="hoja"><h2>Objetivo</h2>
<p class="ed" contenteditable="true">El presente informe tiene como objetivo sustentar la afectación de las suertes cosechadas${periodo ? ` entre ${desde.slice(0, 7) === hasta.slice(0, 7) ? '' : 'el '}${periodo}` : ''} asociada a los niveles freáticos presentes en los días previos al corte, a partir de la red de pozos de observación, con el fin de soportar técnicamente las diferencias de productividad y orientar las acciones de drenaje antes de la cosecha.</p>
<h2>Metodología</h2>
<p class="ed" contenteditable="true">A cada suerte cosechada se le asignó su <b>pozo de influencia</b>, correspondiente al pozo de observación más cercano con lecturas disponibles. Se calculó el nivel freático promedio de ese pozo en los <b>${frcE.ventana} días previos a la fecha de corte</b> (aproximadamente ${Math.round(frcE.ventana / 15)} lecturas quincenales)${frcE.base === 'idw' ? ' y se tomó como nivel de la suerte el valor interpolado por IDW en su centro' : ''}, y se calificó cada suerte según el criterio de la Tabla 1.</p>
<p class="cap"><b>Tabla 1.</b> Criterio de afectación por nivel freático previo al corte.</p>
<table><tr><th>Criterio</th><th>Nivel freático promedio</th><th>Condición</th></tr>${FR_CRIT.map(k => `<tr><td style="background:${k.col};color:#fff;font-weight:700">${k.c}</td><td>${k.r}</td><td>${k.n}</td></tr>`).join('')}</table>
<h2>Resultados</h2>
<p class="ed" contenteditable="true">${pRes}</p>
<p class="cap"><b>Tabla 2.</b> Suertes cosechadas por criterio de afectación.</p>
<table><tr><th>Criterio</th><th>Suertes</th><th>%</th><th>Área (ha)</th>${hayT ? '<th>TCH real</th><th>TCH ppto/est</th>' : ''}</tr>
${R.map(k => `<tr><td style="background:${k.col};color:#fff;font-weight:700">${k.c} · ${k.n}</td><td>${k.n}</td><td>${n1(pct(k.n))}</td><td>${n1(k.ha, 2)}</td>${hayT ? `<td>${k.tch ? n1(k.tch) : '—'}</td><td>${k.ref ? n1(k.ref) : '—'}</td>` : ''}</tr>`).join('')}
<tr><td><b>Total</b></td><td><b>${tot.n}</b></td><td>100</td><td><b>${n1(tot.ha, 2)}</b></td>${hayT ? '<td></td><td></td>' : ''}</tr></table>
<div class="pie"><img src="${logo}" alt=""><span>1</span></div></div>

${hayT ? `<div class="hoja"><h2>Afectación en la producción</h2>
<p class="ed" contenteditable="true">${pTch}</p>
<p class="cap"><b>Figura 1.</b> TCH real promedio por criterio de afectación (línea punteada: TCH presupuestado o estimado).</p>${frcGrafTCH(R)}
<p class="cap"><b>Figura 2.</b> Nivel freático previo al corte vs TCH real de cada suerte.</p>${frcGrafDisp(A)}
<div class="pie"><img src="${logo}" alt=""><span>2</span></div></div>` : ''}

<div class="hoja"><h2>Suertes con afectación alta</h2>
<p class="cap"><b>Tabla ${hayT ? 3 : 3}.</b> Suertes cosechadas con nivel freático promedio menor a 0,8 m antes del corte.</p>
<table class="det"><tr><th>Suerte</th><th>Hacienda</th><th>Fecha corte</th><th>Área (ha)</th><th>Pozo</th><th>Nivel (m)</th><th>Mín. (m)</th>${hayT ? '<th>TCH real</th><th>TCH ppto/est</th>' : ''}</tr>
${afect.map(x => `<tr><td>${esc(x.s)}</td><td style="text-align:left">${esc(x.hac)}</td><td>${x.fc ? frFechaCorta(x.fc) : '—'}</td><td>${x.ha ? n1(x.ha, 2) : '—'}</td><td>${x.pozo || '—'}</td><td>${n1(x.nivel, 2)}</td><td>${x.min != null ? n1(x.min, 2) : '—'}</td>${hayT ? `<td>${x.tch ? n1(x.tch) : '—'}</td><td>${x.tche || x.tchp ? n1(x.tche || x.tchp) : '—'}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${hayT ? 9 : 7}">Ninguna suerte con afectación alta</td></tr>`}</table>
${editable('', 'Observaciones de campo (riegos, encharcamientos, problemas de cosecha mecánica, labores…)')}
<h2>Conclusiones</h2>
<ul class="c">${concl.map(c => `<li class="ed" contenteditable="true">${c}</li>`).join('')}</ul>
${editable('', 'Conclusiones o recomendaciones adicionales…')}
<div class="pie"><img src="${logo}" alt=""><span>${hayT ? 3 : 2}</span></div></div>
<script>document.querySelectorAll('.ed').forEach(e => e.addEventListener('input', () => e.classList.toggle('vacio', !e.textContent.trim())));</script>
</body></html>`;
  frAbrirInforme(html);
}

q('nfcosecha').addEventListener('click', e => {
  if (e.target.closest('[data-frc-volver]')) { irA('freat'); return; }
  if (e.target.closest('[data-frc-informe]')) frInformeCosecha();
  const h = e.target.closest('[data-frc-hoja]'); if (h && frcE.cand) frUsarHojaCosecha(frcE.cand.archivo, frcE.cand.lista[+h.dataset.frcHoja]);
});
q('nfcosecha').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'frc-archivo') { frCargarCosecha(t.files[0]); t.value = ''; }
  else if (t.id === 'frc-mes') modCambio(() => { DB.cosechaNF.mes = t.value; });
  else if (t.id === 'frc-ven') { frcE.ventana = +t.value; renderCosechaNF(); }
  else if (t.id === 'frc-base') { frcE.base = t.value; renderCosechaNF(); }
});

// Este es el último script del módulo: si la página abrió en #freaticos, #cosecha-niveles o en la portada, redibujar
if (['freat', 'nfcos', 'maes', 'portal'].includes(vistaActual)) renderVista();
