// Control de labores de levante (#labores, vista 'lab', se abre desde el dashboard del Comité APS).
// Base actual (16 nov 2026): hoja «Hoja1 (2)» del libro «Maestro Suertes y labores pendientes 2026 ….xlsx»
// (Documents\OPERACIONES CAMPO - LEVANTE): una fila por suerte pendiente de levante, sacada del maestro, con
// SUERTE, ZONA, Zona Agroecologica, USO, FECHA DE SIEMBRA, FECHA DE ULTIMO CORTE, Dias, NUMERO DE CORTE, VARIEDAD,
// AREA NETA HA y a la derecha 1ra (roturación), 2da (roturación) y abono (fertilización) con s = la tiene (hecha),
// n = no la tiene (pendiente), vacía = el Excel no lo dice; «parcial (ha)» opcional. La fecha de referencia es la
// más reciente entre siembra y último corte (las plantillas cuentan desde la siembra). Se marca con sn:1 en cada fila.
// En la ficha de cada suerte (📝) se responde: ¿tiene roturación? ¿única? (subsolador / triple) o 1ra y 2da con
// contratista e implemento; ¿tiene fertilización? ¿con quién? ¿qué producto o mezcla? Lo que se responde en la
// ficha manda sobre el Excel. Se guarda en DB.labores.reg[clave][labor] junto a p (programada) y r (hecha):
//   rotur: {tiene, unica, impl, contr}, rotur2: {tiene, impl, contr}, fert: {tiene, contr, prod, dosis}, nota: {obs}
// Formato anterior (sigue funcionando): el reporte de labores pendientes de Operaciones Campo · Levante (labores_pendientes_AAAA-MM-DD.xlsx, hoja BD,
// en Documents\OPERACIONES CAMPO - LEVANTE): una fila por suerte cosechada (o por corte parcial) con el área pendiente
// de 1ra labor (roturación), 2da labor y fertilización: columnas H, K y N: área > 0 = pendiente; 0 o vacía = hecha.
// Se cruza con el maestro de suertes (hacienda, variedad, número de corte) y se suman las suertes que el maestro da
// por cosechadas en los últimos N días y que el reporte aún no trae. Despaje y reencalle son alertas por días
// después del corte (no vienen en el reporte; si ya se roturó, se dan por hechas).
// Datos: DB.levante {archivo, fecha (del reporte), filas:[{s, z, za, a, f (corte), r1, r2, fe, tipo, i1, c1, i2, c2, cf}]}
//        DB.labores {params:{dias, despaje:[d0,d1], …}, reg:{'suerte|corte': {labor:{p, r}}}}  (p = programada, r = hecha)
// Las fechas de corte del reporte se calculan con la columna Días (desde la fecha del reporte), porque la columna
// Fecha Inicio viene mezclada: texto dd/mm/aaaa y fechas que Excel volteó (día por mes).

const LAB_LABORES = [
  // Despaje y reencalle (alertas por días después del corte) se quitaron el 16 nov 2026 a pedido de Luis
  {k:'rotur',     n:'1ra roturación', c:'1ra rot.', ico:'🚜', tipo:'prog',   col:'#0369a1', bd:'r1'},
  {k:'rotur2',    n:'2da roturación', c:'2da rot.', ico:'🚜', tipo:'prog',   col:'#0e7490', bd:'r2'},
  {k:'fert',      n:'Fertilización',  c:'Fertiliz.', ico:'🌱', tipo:'prog',   col:'#15803d', bd:'fe'},
];
// Ventanas por defecto (días después del corte); el editor las cambia en «Parámetros»
const LAB_DEF = {dias:60, despaje:[0, 10], reencalle:[5, 15], rotur:[15, 30], rotur2:[30, 50], fert:[25, 45]};
const LAB_EST = {
  hecha:      {n:'Realizada',  col:'#15803d', bg:'#dcfce7'},
  programada: {n:'Programada', col:'#1d4ed8', bg:'#dbeafe'},
  atrasada:   {n:'Atrasada',   col:'#c2410c', bg:'#ffedd5'},
  pendiente:  {n:'Pendiente',  col:'#a16207', bg:'#fef9c3'},
  vencida:    {n:'Vencida',    col:'#b91c1c', bg:'#fee2e2'},
  proxima:    {n:'Próxima',    col:'#64748b', bg:'#f1f5f9'},
  sindato:    {n:'Sin dato',   col:'#6b7280', bg:'#f3f4f6'},
  noaplica:   {n:'No aplica',  col:'#94a3b8', bg:'#f8fafc'},
};
const labE = {zona:'', hac:'', txt:'', labor:'', estado:'', orden:'excel', progFecha:'', fuente:'', ficha:null, sucio:false};
const LAB_IMPL = ['Subsolador', 'Triple'];   // implementos de la roturación única

function labDatos(){
  if (DB.labores === undefined && typeof SEED !== 'undefined' && SEED.labores) DB.labores = clone(SEED.labores);
  return DB.labores || {params:{}, reg:{}};
}
function labReporte(){
  if (DB.levante === undefined && typeof SEED !== 'undefined' && SEED.levante) DB.levante = clone(SEED.levante);
  return DB.levante || null;
}
const labPar = () => Object.assign({}, LAB_DEF, labDatos().params || {});
const labISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const labHoy = () => labISO(new Date());
const labDias = (a, b) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 864e5);
const labMenos = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - n); return labISO(d); };
const labLunes = iso => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return labISO(d); };

// Suertes del control: las del reporte (cada corte) + las cosechadas según el maestro que el reporte no trae
function labSuertes(){
  if (typeof msFilas !== 'function') return [];
  const P = labPar(), hoy = labHoy(), R = labDatos().reg || {}, B = labReporte();
  const ms = msFilas().filter(x => x.emp === 'RIOP'), porCod = {};
  ms.forEach(x => { const o = porCod[x.s]; if (!o || (/^CAÑA$/i.test(x.uso || '') && !/^CAÑA$/i.test(o.uso || ''))) porCod[x.s] = x; });
  const out = [];
  if (B) B.filas.forEach((f, i) => { const m = porCod[f.s] || {};
    out.push({x:{s:f.s, hac:m.hac || '', zona:f.z ?? m.zona, area:f.a, variedad:m.variedad || f.v, nCorte:m.nCorte ?? f.nc, ultCorte:f.f, zonaAgro:f.za || m.zonaAgro, tipo:f.tipo,
      desdeSiembra:!!(f.fs && f.f === f.fs && f.fs !== f.fc), par:f.par}, bd:f, fuente:'reporte', i}); });
  const renov = new Set((DB.lotes || []).map(l => l.s + '|' + norm(l.h)));
  ms.filter(x => x.ultCorte && x.estado !== 'PROCESO' && /^(CAÑA|SEMILLA)$/i.test(x.uso || '') && !renov.has(x.s + '|' + norm(x.hac)))
    .forEach(x => { const dd = labDias(x.ultCorte, hoy); if (dd < 0 || dd > P.dias) return;
      // Ya está en el reporte si trae esa suerte con un corte de la misma fecha o posterior (±10 días)
      if (B && B.filas.some(f => f.s === x.s && labDias(x.ultCorte, f.f) >= -10)) return;
      out.push({x:{s:x.s, hac:x.hac, zona:x.zona, area:x.area, variedad:x.variedad, nCorte:x.nCorte, ultCorte:x.ultCorte, zonaAgro:x.zonaAgro}, bd:null, fuente:'maestro', i:1e6}); });
  return out.map(o => Object.assign(o, {dd:labDias(o.x.ultCorte, hoy), key:`${o.x.s}|${o.x.ultCorte}`}))
    .map(o => Object.assign(o, {reg:R[o.key] || {}}));
}
// Estado de una labor en una suerte. Orden: hecha a mano → hecha según el reporte (0) → no aplica (casilla vacía) →
// programada (o atrasada si ya pasó la fecha) → por días después del corte: próxima / pendiente / vencida
// Lo que dice el Excel de una labor: 'hecha' | 'pend' | 'sindato' | null (la suerte no viene en el Excel)
function labBD(o, L){
  if (!o.bd || !L.bd) return null;
  const v = o.bd[L.bd];
  if (o.bd.sn) { const b = v === 's' ? 'hecha' : v === 'n' ? 'pend' : 'sindato';
    // 2da roturación sin dato pero la 1ra no está hecha: obviamente falta
    return b === 'sindato' && L.k === 'rotur2' && o.bd.r1 === 'n' && (o.reg.rotur || {}).tiene !== 'si' ? 'pend' : b; }
  return v > 0 ? 'pend' : 'hecha';   // reporte anterior: 0 o casilla vacía = hecha
}
// Cómo se hizo (o se hará): implemento, contratista, producto y dosis escritos en la ficha
const labComo = r => [r.impl, r.contr ? `con ${r.contr}` : '', r.prod, r.dosis].filter(Boolean).map(t => ' · ' + t).join('');
function labEstado(o, L){
  const P = labPar(), [d0, d1] = P[L.k], r = o.reg[L.k] || {}, hoy = labHoy(), b = labBD(o, L);
  const v = o.bd && L.bd && !o.bd.sn ? o.bd[L.bd] : undefined, como = labComo(r);
  if (r.r) return {e:'hecha', t:`Hecha ${msF(r.r)}${como}`};
  if (r.tiene === 'si') return {e:'hecha', t:`Hecha${como}`};
  if (L.k === 'rotur2' && (o.reg.rotur || {}).unica === 'si') { const r1 = o.reg.rotur; return {e:'noaplica', t:`Única roturación${r1.impl ? ' · ' + r1.impl : ''}`}; }
  if (r.tiene !== 'no' && b === 'hecha') return {e:'hecha', t:o.bd.sn ? 'Hecha según el Excel (S)' : 'Hecha según el reporte'};
  if (L.tipo === 'alerta' && o.dd > P.dias) return {e:'noaplica', t:`Corte de hace más de ${P.dias} días: sin seguimiento`};
  if (L.tipo === 'alerta' && labEstado(o, LAB_LABORES.find(x => x.k === 'rotur')).e === 'hecha') return {e:'hecha', t:'Se da por hecha: ya se roturó'};
  const pend = v > 0 ? ` · ${msN(v, 2)} ha pendientes` : '';
  if (r.p) return r.p < hoy ? {e:'atrasada', t:`Programada ${msF(r.p)} · atrasada ${labDias(r.p, hoy)} d${pend}${como}`} : {e:'programada', t:`Programada ${msF(r.p)}${pend}${como}`};
  if (r.tiene !== 'no' && b === 'sindato') return {e:'sindato', t:`El Excel no dice si tiene ${L.n.toLowerCase()} · ${o.dd} d desde ${o.x.desdeSiembra ? 'la siembra' : 'el corte'}`};
  if (o.dd < d0) return {e:'proxima', t:`Empieza en ${d0 - o.dd} d${pend}`};
  if (o.dd <= d1) return {e:'pendiente', t:`Quedan ${d1 - o.dd} d${pend}`};
  return {e:'vencida', t:`Vencida hace ${o.dd - d1} d${pend}`};
}
const labUrgente = e => e === 'pendiente' || e === 'vencida' || e === 'atrasada';
// Por hacer: todo lo que no está hecho ni «no aplica» (incluye próximas y programadas); así cuadra con el reporte
// «Sin dato» (el Excel no dice s ni n) va aparte: no se cuenta como pendiente hasta que se confirme en la ficha
const labPorHacer = e => e !== 'hecha' && e !== 'noaplica' && e !== 'sindato';
// Área que falta de una labor: la del reporte si la trae, si no el área de la suerte
const labHa = (o, L) => o.bd && L.bd && o.bd[L.bd] > 0 ? o.bd[L.bd] : (o.x.area || 0);
// Suertes de la lista a las que se les puede aplicar en bloque: programar (sin hacer ni programar) o marcar como
// hechas (sin hacer y con la ventana ya empezada o programada)
const labBloque = (A, Lb, campo) => A.filter(o => { const r = o.reg[Lb.k] || {}, e = labEstado(o, Lb).e; return e !== 'hecha' && e !== 'noaplica' && (campo === 'p' ? !r.p : e !== 'proxima'); });

// Filtros de la tabla: labE.labor (una labor o todas) y labE.estado: pend (pendientes) / venc (vencidas o atrasadas) /
// prog (programadas) / hecha / '' (todas). Con una labor elegida se mira solo esa; con todas, basta que alguna cumpla
// (y para «hecha», que todas lo estén)
const LAB_ESTADOS = [['pend', 'Pendientes'], ['venc', 'Vencidas o atrasadas'], ['prog', 'Programadas'], ['sindato', 'Sin dato en el Excel'], ['hecha', 'Realizadas'], ['', 'Todas']];
const labCumple = (e, est) => est === 'pend' ? labPorHacer(e) : est === 'sindato' ? e === 'sindato' : est === 'venc' ? (e === 'vencida' || e === 'atrasada')
  : est === 'prog' ? (e === 'programada' || e === 'atrasada') : est === 'hecha' ? (e === 'hecha' || e === 'noaplica') : true;
function labFiltradas(T){
  const t = norm(labE.txt), Lb = LAB_LABORES.find(L => L.k === labE.labor), est = labE.estado;
  return T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac) && (!labE.fuente || o.fuente === labE.fuente)
    && (!t || norm(`${o.x.s} ${o.x.hac} ${o.x.variedad || ''} ${o.x.zonaAgro || ''}`).includes(t))
    && (() => { if (!est) return true;
      if (Lb) return labCumple(labEstado(o, Lb).e, est);
      const E = LAB_LABORES.map(L => labEstado(o, L).e); return est === 'hecha' ? E.every(e => labCumple(e, est)) : E.some(e => labCumple(e, est)); })());
}

function renderLabores(){
  const cont = q('labores'); if (!cont) return;
  const B = labReporte(), ed = MODO_EDICION;
  if (typeof maestroSuertes !== 'function' || (!maestroSuertes() && !B)) { cont.innerHTML = `<div class="nores">Carga el reporte de labores pendientes de levante o el 📚 Maestro de suertes.${ed ? labCargaHTML() : ''}</div>`; return; }
  const P = labPar(), T = labSuertes(), L = labFiltradas(T), hoy = labHoy(), M = maestroSuertes();
  const ha = A => sum(A, o => o.x.area || 0), haL = (A, Lb) => sum(A, o => labHa(o, Lb));
  const hacs = [...new Set(T.map(o => o.x.hac).filter(Boolean))].sort();
  const opt = (v, t, s) => `<option value="${esc(v)}" ${s === v ? 'selected' : ''}>${esc(t)}</option>`;
  const nRep = T.filter(o => o.fuente === 'reporte').length, nMs = T.length - nRep;
  // KPI por labor
  const kpi = LAB_LABORES.map(Lb => { const E = T.map(o => labEstado(o, Lb).e), cuenta = e => T.filter((o, i) => E[i] === e);
    const urg = T.filter((o, i) => labPorHacer(E[i])), ven = T.filter((o, i) => E[i] === 'vencida' || E[i] === 'atrasada');
    // Recuadro compacto: ha pendientes, barra realizadas / pendientes / sin dato y una línea corta (el detalle va en el globo)
    const hech = cuenta('hecha').length + cuenta('noaplica').length, sin = cuenta('sindato').length, tot = T.length || 1, pct = n => (n / tot * 100).toFixed(1);
    return `<button type="button" class="lab-mini ${labE.labor === Lb.k ? 'on' : ''}" style="--c:${Lb.col}" data-lab-labor="${Lb.k}" data-lab-ir
      title="${esc(`${Lb.n} (${P[Lb.k][0]}–${P[Lb.k][1]} días después del corte): ${urg.length} pendientes (${ven.length} vencidas) · ${cuenta('programada').length} programadas · ${hech} realizadas · ${sin} sin dato en el Excel. Toca para ver todas las suertes.`)}">
      <span class="lab-mini-t">${Lb.ico} ${Lb.n}</span>
      <span class="lab-mini-v"><b>${msN(haL(urg, Lb), 1)}</b> ha pendientes</span>
      <span class="lab-mini-bar"><i style="width:${pct(hech)}%;background:#16a34a"></i><i style="width:${pct(urg.length)}%;background:#dc2626"></i><i style="width:${pct(sin)}%;background:#cbd5e1"></i></span>
      <span class="lab-mini-s"><span class="ok">${hech} realizadas</span> · <span class="pe">${urg.length} pendientes</span>${sin ? ` · ${sin} sin dato` : ''}</span></button>`; }).join('');
  // Programa semanal de roturación y fertilización (fechas programadas, de esta semana en adelante)
  const PROG = LAB_LABORES.filter(Lb => Lb.tipo === 'prog'), sem = {};
  T.forEach(o => PROG.forEach(Lb => { const r = o.reg[Lb.k] || {}, e = labEstado(o, Lb).e; if (!r.p || e === 'hecha' || e === 'noaplica') return;
    const w = r.p < hoy ? 'atrasadas' : labLunes(r.p); const s = sem[w] = sem[w] || {}; const z = s[Lb.k] = s[Lb.k] || {n:0, a:0}; z.n++; z.a += labHa(o, Lb); }));
  const semanas = Object.keys(sem).sort((a, b) => a === 'atrasadas' ? -1 : b === 'atrasadas' ? 1 : a < b ? -1 : 1);
  // Tabla
  const ord = [...L].sort((a, b) => labE.orden === 'excel' ? (a.i ?? 1e6) - (b.i ?? 1e6) || b.dd - a.dd : labE.orden === 'hac' ? (a.x.hac + a.x.s).localeCompare(b.x.hac + b.x.s) : labE.orden === 'area' ? (b.x.area || 0) - (a.x.area || 0) : labE.orden === 'nuevas' ? a.dd - b.dd : b.dd - a.dd);
  const chip = s => { const E = LAB_EST[s.e]; return `<span class="lab-chip" style="color:${E.col};background:${E.bg}" title="${esc(s.t)}">${E.n}</span>`; };
  // Lo que dice la casilla del Excel, tal cual (S / N / vacía)
  const xl = (o, Lb) => !Lb.bd || !o.bd ? '' : o.bd.sn ? `<small class="lab-xl">Excel: ${o.bd[Lb.bd] ? String(o.bd[Lb.bd]).toUpperCase() : '—'}</small>` : '';
  // Columnas: lo que trae el Excel (1ra, 2da roturación y fertilización)
  const LAB_COLS = LAB_LABORES;
  const LbSel = LAB_LABORES.find(x => x.k === labE.labor);
  const fichaBtn = o => `<td><button type="button" class="plegar-todo lab-fbtn" data-lab-ficha="${esc(o.key)}" title="Ficha de labores: roturación y fertilización (con quién, implemento, producto)">📝</button></td>`;
  const datos = o => `<td class="b lab-cod"><a href="#" data-lab-ficha="${esc(o.key)}" title="Abrir la ficha de labores">${esc(o.x.s)}</a>${o.fuente === 'maestro' ? ' <small class="lab-fu" title="Cosechada según el maestro; aún no está en el Excel de labores pendientes">maestro</small>' : ''}</td>
    <td>${esc(msHacN(o.x.hac)) || '<span class="meta">—</span>'}</td><td>${esc(o.x.zona ?? '')}</td><td>${esc(o.x.zonaAgro || '')}</td><td class="n">${msN(o.x.area, 2)}${o.x.par ? `<small class="lab-t" title="Parcial (ha) según el Excel">parcial ${msN(o.x.par, 2)}</small>` : ''}</td>
    <td>${esc(o.x.variedad || '—')}</td><td class="n">${o.x.nCorte != null ? msN(o.x.nCorte) : esc(o.x.tipo || '')}</td><td>${msF(o.x.ultCorte)}${o.x.desdeSiembra ? '<small class="lab-t">siembra</small>' : ''}</td><td class="n">${o.dd}</td>`;
  const cabDatos = '<th>Suerte</th><th>Hacienda</th><th title="Zona">Z</th><th title="Zona agroecológica">Z. agro</th><th class="n">Área</th><th>Variedad</th><th class="n">Corte</th><th>Cosechada</th><th class="n" title="Días desde el corte (o la siembra)">Días</th>';
  // Una labor elegida: una fila por suerte con su estado y, en modo editor, las fechas para programar o marcar hecha
  const filaLabor = (o, Lb) => { const s = labEstado(o, Lb), r = o.reg[Lb.k] || {}, k = esc(o.key), cerrada = s.e === 'noaplica' || (s.e === 'hecha' && !r.r);
    return `<tr>${datos(o)}${Lb.bd ? `<td class="n b">${labPorHacer(s.e) ? msN(labHa(o, Lb), 2) : '<span class="meta">—</span>'}</td>` : ''}<td>${chip(s)}${xl(o, Lb)}</td>
      ${ed ? `<td class="lab-hecha">${[r.p ? `<a href="#" data-lab-ficha="${k}" title="Cambiar en la ficha">Prog. ${msF(r.p)}</a>` : '', r.r ? `<a href="#" data-lab-ficha="${k}" title="Cambiar en la ficha">Hecha ${msF(r.r)}</a>` : ''].filter(Boolean).join('<br>')}${!cerrada && !r.r ? `<button type="button" class="plegar-todo" data-lab-hoy="${k}" data-labk="${Lb.k}" title="Marcar como hecha hoy (otras fechas: en la ficha 📝)">✓ Hoy</button>` : ''}</td>` : ''}${fichaBtn(o)}</tr>`; };
  const tabla = LbSel
    ? `<table class="sim-t lab-tab"><thead><tr>${cabDatos}${LbSel.bd ? '<th class="n" title="Hectáreas pendientes">Pend. ha</th>' : ''}<th title="Pasa el mouse sobre el estado para ver el detalle">Estado</th>${ed ? '<th title="Fecha programada o en que se hizo (se cambian en la ficha 📝)">Fechas</th>' : ''}<th></th></tr></thead>
      <tbody>${ord.map(o => filaLabor(o, LbSel)).join('') || `<tr><td colspan="16" class="nores">Ninguna suerte con esos filtros.</td></tr>`}</tbody>
      ${ord.length ? `<tfoot><tr><td colspan="4">Total · ${ord.length} suertes</td><td class="n b">${msN(ha(ord), 2)}</td><td colspan="4"></td>${LbSel.bd ? `<td class="n b">${msN(sum(ord.filter(o => labPorHacer(labEstado(o, LbSel).e)), o => labHa(o, LbSel)), 2)}</td>` : ''}<td colspan="${ed ? 3 : 2}"></td></tr></tfoot>` : ''}</table>`
    : `<table class="sim-t lab-tab"><thead><tr>${cabDatos}${LAB_COLS.map(Lb => `<th title="${Lb.n}: ${P[Lb.k][0]}–${P[Lb.k][1]} días después del corte">${Lb.ico} ${Lb.c || Lb.n}</th>`).join('')}<th></th></tr></thead>
      <tbody>${ord.map(o => `<tr>${datos(o)}${LAB_COLS.map(Lb => `<td>${chip(labEstado(o, Lb))}${xl(o, Lb)}</td>`).join('')}${fichaBtn(o)}</tr>`).join('') || `<tr><td colspan="${10 + LAB_LABORES.length}" class="nores">Ninguna suerte con esos filtros.</td></tr>`}</tbody>
      ${ord.length ? `<tfoot><tr><td colspan="4">Total · ${ord.length} suertes</td><td class="n b">${msN(ha(ord), 2)}</td><td colspan="${5 + LAB_LABORES.length}"></td></tr></tfoot>` : ''}</table>`;
  // Selector de labor (cuántas suertes pendientes tiene cada una con los demás filtros)
  const pendDe = Lb => T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac) && labPorHacer(labEstado(o, Lb).e)).length;
  const selector = `<div class="lab-seg"><button type="button" class="${!LbSel ? 'on' : ''}" data-lab-labor="">Todas</button>${LAB_LABORES.map(Lb => `<button type="button" class="${LbSel === Lb ? 'on' : ''}" style="--c:${Lb.col}" data-lab-labor="${Lb.k}" title="${pendDe(Lb)} pendientes">${Lb.ico} ${Lb.n}</button>`).join('')}</div>`;
  // Botones de estado con su cuenta (con los demás filtros): todas / realizadas / pendientes / vencidas / sin dato
  const base = T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac) && (!labE.fuente || o.fuente === labE.fuente));
  const nEst = v => !v ? base.length : base.filter(o => LbSel ? labCumple(labEstado(o, LbSel).e, v) : (() => { const E = LAB_LABORES.map(Lb => labEstado(o, Lb).e); return v === 'hecha' ? E.every(e => labCumple(e, v)) : E.some(e => labCumple(e, v)); })()).length;
  const estBtns = `<div class="lab-pills">${[['', 'Todas'], ['hecha', 'Realizadas'], ['pend', 'Pendientes'], ['venc', 'Vencidas'], ['sindato', 'Sin dato']].map(([v, t]) =>
    `<button type="button" class="${labE.estado === v ? 'on' : ''} est-${v || 'todas'}" data-lab-est="${v}">${t} <b>${nEst(v)}</b></button>`).join('')}</div>`;
  // De dónde salen los datos: solo en el globo del título (para no llenar la página de texto)
  const origen = !B ? 'Sin Excel de labores pendientes cargado'
    : `${B.sn ? 'Excel' : 'Reporte'} ${B.archivo}${B.hoja ? ` · hoja ${B.hoja}` : ''} (${msF(B.fecha)}): ${nRep} suertes${nMs ? ` + ${nMs} cosechadas según el maestro que el Excel aún no trae` : ''} · ${msN(ha(T), 1)} ha`;
  cont.innerHTML = `
    <div class="lab-top"><div class="sim-tit" title="${esc(origen)}">🚜 Control de labores${B ? '' : ' <small class="lab-aviso">sin Excel cargado</small>'}</div>
      <div class="lab-acc">${ed ? `<label class="lab-ico" title="Cargar Excel de labores pendientes">📂<input type="file" id="lab-archivo" accept=".xlsx,.xls,.xlsm" hidden></label>
        <button type="button" class="lab-ico" data-lab-servidor title="Traer el último Excel de Documents\\OPERACIONES CAMPO - LEVANTE">🔄</button>` : ''}
        <button type="button" class="lab-ico" data-lab-excel title="Descargar en Excel">⬇️</button></div></div>
    <div class="lab-minis">${kpi}</div>
    <div${semanas.length ? '' : ' hidden'}>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>📅 Programa de roturación y fertilización</b> <span class="meta">· por semana</span></div>
        <div class="sim-tw"><table class="sim-t"><thead><tr><th>Semana</th>${PROG.map(Lb => `<th class="n">${Lb.ico} ${Lb.n}</th>`).join('')}</tr></thead><tbody>
        ${semanas.map(w => { const s = sem[w], c = k => s[k] ? `${s[k].n} st · <b>${msN(s[k].a, 1)} ha</b>` : '<span class="meta">—</span>';
          return `<tr${w === 'atrasadas' ? ' style="background:#fff7ed"' : ''}><td>${w === 'atrasadas' ? '<b style="color:#c2410c">Atrasadas</b>' : `Semana del ${msF(w)}`}</td>${PROG.map(Lb => `<td class="n">${c(Lb.k)}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${PROG.length + 1}" class="nores">Aún no hay labores programadas.</td></tr>`}</tbody></table></div></div>
    </div>
    <div class="sim-card abierta" id="lab-tabla">
      <div class="lab-barra">${selector}${estBtns}<span class="lab-cuenta">${L.length} suertes · ${msN(ha(L), 1)} ha</span></div>
      <div class="lab-filtros">
        <input id="lab-txt" class="pr-buscar" placeholder="🔎 Buscar suerte, hacienda o variedad…" value="${esc(labE.txt)}">
        <select id="lab-zona">${opt('', 'Zona', labE.zona)}${opt('1', 'Zona 1', labE.zona)}${opt('2', 'Zona 2', labE.zona)}</select>
        <select id="lab-hac">${opt('', 'Hacienda', labE.hac)}${hacs.map(h => opt(h, msHacN(h), labE.hac)).join('')}</select>
        <select id="lab-orden" title="Orden">${opt('excel', 'Orden del Excel', labE.orden)}${opt('corte', 'Más antiguas', labE.orden)}${opt('nuevas', 'Más recientes', labE.orden)}${opt('hac', 'Por hacienda', labE.orden)}${opt('area', 'Por área', labE.orden)}</select></div>
      ${ed ? `<details class="lab-prog"><summary>⚡ En bloque <span class="meta">· programar o marcar las suertes de la tabla</span></summary>
        <div>Fecha <input type="date" id="lab-pf" value="${esc(labE.progFecha || hoy)}"> <span class="meta">Programar:</span>
          ${PROG.filter(Lb => !LbSel || Lb === LbSel).map(Lb => { const n = labBloque(L, Lb, 'p').length; return `<button type="button" class="plegar-todo" data-lab-bloque="${Lb.k}|p" ${n ? '' : 'disabled'}>${Lb.ico} ${Lb.n} (${n})</button>`; }).join('') || '<span class="meta">—</span>'}
          <span class="meta">Marcar como hechas:</span>
          ${LAB_LABORES.filter(Lb => !LbSel || Lb === LbSel).map(Lb => { const n = labBloque(L, Lb, 'r').length; return `<button type="button" class="plegar-todo" data-lab-bloque="${Lb.k}|r" ${n ? '' : 'disabled'}>✓ ${Lb.n} (${n})</button>`; }).join('')}</div></details>` : ''}
      <div class="sim-tw" style="max-height:640px">${tabla}</div></div>
    ${ed ? `<div class="sim-card"><div class="sim-card-h"><b>⚙️ Parámetros</b> <span class="meta">· ventanas en días después del corte</span></div><div class="sim-card-b lab-par">
      <label>Del maestro, cosechadas en los últimos<input type="number" min="15" max="365" data-lab-par="dias" value="${P.dias}"> días</label>
      ${LAB_LABORES.map(Lb => `<label>${Lb.ico} ${Lb.n}: del día<input type="number" min="0" max="365" data-lab-par="${Lb.k}|0" value="${P[Lb.k][0]}">al<input type="number" min="0" max="365" data-lab-par="${Lb.k}|1" value="${P[Lb.k][1]}"></label>`).join('')}
      <button type="button" class="plegar-todo" data-lab-par-def>↺ Valores por defecto</button>
      ${B ? '<button type="button" class="plegar-todo" data-lab-quitar title="Quitar el Excel cargado (quedan solo las cosechadas según el maestro)">✕ Quitar Excel</button>' : ''}</div></div>` : ''}`;
  if (labE.ficha) labFicha(labE.ficha);
}
const labCargaHTML = () => `<div class="lab-carga"><span>📥 Labores pendientes (Excel «Maestro Suertes y labores pendientes», hoja <b>Hoja1 (2)</b>):</span>
  <label class="plegar-todo pt-file">📂 Cargar Excel…<input type="file" id="lab-archivo" accept=".xlsx,.xls,.xlsm" hidden></label>
  <button type="button" class="plegar-todo" data-lab-servidor title="El más reciente de Documents\\OPERACIONES CAMPO - LEVANTE">🔄 Traer el último de la carpeta</button>
  ${labReporte() ? '<button type="button" class="plegar-todo" data-lab-quitar title="Quitar el Excel cargado (quedan solo las cosechadas según el maestro)">✕ Quitar Excel</button>' : ''}</div>`;

// ── Lectura del Excel ──
// Busca la hoja: primero «Hoja1 (2)» (labores pendientes del maestro: SUERTE + 1ra + 2da + abono), luego BD (reporte
// anterior). El libro del maestro pesa varios MB: se lee solo el encabezado de cada hoja candidata y después la elegida.
const labEsSN = r => r.some(c => norm(c) === 'SUERTE') && r.some(c => /^1RA\b/.test(norm(c))) && r.some(c => /^(ABONO|FERTILIZ)/.test(norm(c))) && !r.some(c => /AREA TOTAL/.test(norm(c)));
const labEsBD = r => r.some(c => norm(c) === 'SUERTE') && r.some(c => /AREA TOTAL/.test(norm(c)));
function labLeerReporte(X, buf, archivo, fechaArchivo){
  const nombres = X.read(buf, {type:'array', bookSheets:true}).SheetNames;
  const pri = n => /^hoja\s*1\s*\(2\)$/i.test(n.trim()) ? 0 : /^bd$/i.test(n.trim()) ? 1 : /\(\d+\)|pend|labor|bd|base/i.test(n) ? 2 : /^hoja/i.test(n) ? 3 : /maestro|^td |semanas/i.test(n) ? 9 : 5;
  for (const n of [...nombres].sort((a, b) => pri(a) - pri(b))) {
    const h = X.read(buf, {type:'array', sheets:n, sheetRows:12}).Sheets[n]; if (!h) continue;
    const F0 = X.utils.sheet_to_json(h, {header:1, raw:true, defval:''});
    const sn = F0.findIndex(labEsSN), bd = F0.findIndex(labEsBD);
    if (sn < 0 && bd < 0) continue;
    const F = X.utils.sheet_to_json(X.read(buf, {type:'array', sheets:n}).Sheets[n], {header:1, raw:true, defval:''});
    return sn >= 0 ? labLeerSN(F, sn, n, archivo, fechaArchivo) : labLeerBD(F, bd, archivo, fechaArchivo);
  }
  throw new Error('No encontré la hoja de labores pendientes (Hoja1 (2) con SUERTE, 1ra, 2da y abono, o la hoja BD)');
}
// Fecha de Excel (número de serie, dd/mm/aaaa o AAAA-MM-DD) → AAAA-MM-DD
function labFechaXL(v){
  if (typeof v === 'number' && v > 20000) return labISO(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4));
  const s = String(v ?? '').trim(); let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return m[0];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}
// Hoja1 (2): una fila por suerte con s/n en 1ra, 2da y abono
function labLeerSN(F, iH, hoja, archivo, fechaArchivo){
  const H = F[iH].map(c => norm(c)), col = re => H.findIndex(h => re.test(h));
  const C = {s:col(/^SUERTE$/), z:col(/^ZONA$/), za:col(/^ZONA AGRO/), uso:col(/^USO/), fs:col(/SIEMBRA/), fc:col(/ULTIMO CORTE|ULT CORTE/),
    nc:col(/NUMERO DE CORTE|^N CORTE|^CORTE$/), v:col(/^VARIEDAD/), a:col(/^AREA/), r1:col(/^1RA\b/), r2:col(/^2DA\b/), fe:col(/^(ABONO|FERTILIZ)/), par:col(/^PARCIAL/)};
  // Fecha del archivo: la del nombre (… 6-11-2026.xlsx o AAAA-MM-DD) o la de la última modificación
  const m1 = /(\d{4})-(\d{2})-(\d{2})/.exec(archivo || ''), m2 = /(\d{1,2})-(\d{1,2})-(\d{4})/.exec(archivo || '');
  const fRep = m1 ? m1[0] : m2 ? `${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}` : (fechaArchivo || labHoy()).slice(0, 10);
  const num = v => v === '' || v == null ? null : isNaN(+String(v).replace(',', '.')) ? null : +String(v).replace(',', '.');
  const SN = v => { const t = norm(v); return t === 'S' || t === 'SI' || t === 'X' ? 's' : t === 'N' || t === 'NO' ? 'n' : undefined; };
  const filas = [], vistas = new Set();
  F.slice(iH + 1).forEach(r => { const s = frCodSuerte(r[C.s]); if (!s) return;
    const fs = C.fs >= 0 ? labFechaXL(r[C.fs]) : null, fc = C.fc >= 0 ? labFechaXL(r[C.fc]) : null;
    const f = [fs, fc].filter(Boolean).sort().pop(); if (!f) return;
    if (vistas.has(s + '|' + f)) return; vistas.add(s + '|' + f);
    const t = i => { if (i < 0) return undefined; const v = String(r[i] ?? '').trim(); return v && !/^total\b/i.test(v) ? v : undefined; };
    const o = {s, sn:1, z:num(r[C.z]) ?? undefined, za:t(C.za), uso:t(C.uso), a:num(r[C.a]) || 0, f, fs:fs || undefined, fc:fc || undefined,
      nc:C.nc >= 0 ? num(r[C.nc]) ?? undefined : undefined, v:t(C.v), r1:C.r1 >= 0 ? SN(r[C.r1]) : undefined, r2:C.r2 >= 0 ? SN(r[C.r2]) : undefined,
      fe:C.fe >= 0 ? SN(r[C.fe]) : undefined, par:C.par >= 0 ? num(r[C.par]) || undefined : undefined};
    Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
    filas.push(o); });
  if (!filas.length) throw new Error(`La hoja ${hoja} no trae suertes`);
  return {archivo, hoja, fecha:fRep, sn:1, filas};
}
// Reporte anterior (labores_pendientes_AAAA-MM-DD.xlsx, hoja BD)
function labLeerBD(F, iH, archivo, fechaArchivo){
  const H = F[iH].map(c => norm(c)), col = re => H.findIndex(h => re.test(h));
  const C = {z:col(/^ZONA$/), za:col(/ZONA.?AGRO/), s:col(/^SUERTE$/), a:col(/AREA.?TOTAL/), f:col(/FECHA/), d:col(/^DIAS$/),
    r1:col(/^1RA LABOR.*AREA/), i1:col(/^1RA LABOR.*IMPLEMENTO/), c1:col(/^1RA LABOR.*CONTRATISTA/),
    r2:col(/^2DA LABOR.*AREA/), i2:col(/^2DA LABOR.*IMPLEMENTO/), c2:col(/^2DA LABOR.*CONTRATISTA/),
    fe:col(/FERTILIZ.*AREA/), cf:col(/FERTILIZ.*CONTRATISTA/), t:col(/TIPO/)};
  // Si los encabezados cambian, las áreas están en H (1ra roturación), K (2da roturación) y N (fertilización)
  if (C.r1 < 0) C.r1 = 7; if (C.r2 < 0) C.r2 = 10; if (C.fe < 0) C.fe = 13;
  if (C.s < 0 || C.d < 0 && C.f < 0) throw new Error('Faltan las columnas Suerte y Días (o Fecha Inicio)');
  // Fecha del reporte: la del nombre del archivo (labores_pendientes_2026-11-05) o la del archivo
  const mf = /(\d{4})-(\d{2})-(\d{2})/.exec(archivo || ''), fRep = mf ? mf[0] : (fechaArchivo || labHoy()).slice(0, 10);
  const num = v => v === '' || v == null ? null : isNaN(+String(v).replace(',', '.')) ? null : +String(v).replace(',', '.');
  const fechaDe = (dias, v) => { if (dias != null) return labMenos(fRep, dias);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim()); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    if (typeof v === 'number' && v > 30000) return labISO(new Date(Math.round((v - 25569) * 864e5) + new Date().getTimezoneOffset() * 6e4)); return null; };
  const filas = [];
  F.slice(iH + 1).forEach(r => { const s = frCodSuerte(r[C.s]); if (!s) return;
    const dias = C.d >= 0 ? num(r[C.d]) : null, f = fechaDe(dias, C.f >= 0 ? r[C.f] : ''); if (!f) return;
    const t = i => { if (i < 0) return undefined; const v = String(r[i] ?? '').trim(); return v && v !== '0' ? v : undefined; };
    const o = {s, z:num(r[C.z]) ?? undefined, za:t(C.za), a:num(r[C.a]) || 0, f, r1:C.r1 >= 0 ? num(r[C.r1]) : null, r2:C.r2 >= 0 ? num(r[C.r2]) : null, fe:C.fe >= 0 ? num(r[C.fe]) : null,
      tipo:t(C.t), i1:t(C.i1), c1:t(C.c1), i2:t(C.i2), c2:t(C.c2), cf:t(C.cf)};
    Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
    filas.push(o); });
  if (!filas.length) throw new Error('La hoja BD no trae suertes');
  return {archivo, fecha:fRep, filas};
}
function labAplicar(R){
  modCambio(() => { DB.levante = R; });
  if (R.sn) { const c = (k, v) => R.filas.filter(f => f[k] === v).length;
    toast(`🚜 ${R.filas.length} suertes de ${R.hoja} · pendientes (n): 1ra roturación ${c('r1', 'n')} · 2da ${c('r2', 'n')} · fertilización ${c('fe', 'n')} · recuerda 🚀 Publicar`); return; }
  const pend = k => sum(R.filas, f => f[k] > 0 ? f[k] : 0);
  toast(`🚜 Reporte cargado: ${R.filas.length} cortes · pendiente 1ra ${msN(pend('r1'), 1)} ha · 2da ${msN(pend('r2'), 1)} ha · fertilización ${msN(pend('fe'), 1)} ha · recuerda 🚀 Publicar`);
}
function labCargarArchivo(file){
  if (!file) return; toast(`⏳ Leyendo ${file.name}…`);
  Promise.all([cargarXLSX(), file.arrayBuffer()]).then(([X, buf]) => labAplicar(labLeerReporte(X, buf, file.name, labISO(new Date(file.lastModified))))).catch(e => toast('⚠ ' + (e.message || e)));
}
function labDesdeServidor(){
  const H = {cache:'no-store', headers:{'X-Comite':'1'}};
  toast('⏳ Buscando el último Excel de labores pendientes…');
  fetch(API_BASE + 'api/levante', H).then(r => { if (!r.ok) return r.json().then(j => { throw new Error(j.error || 'No se pudo traer'); });
    const nom = decodeURIComponent(r.headers.get('X-Archivo') || 'reporte.xlsx'), fe = (r.headers.get('X-Fecha') || '').slice(0, 10);
    return Promise.all([cargarXLSX(), r.arrayBuffer()]).then(([X, buf]) => labAplicar(labLeerReporte(X, buf, nom, fe))); })
    .catch(e => toast('⚠ ' + (e.message === 'Failed to fetch' ? 'El servidor de este PC no responde' : e.message || e)));
}

// Cambios (solo en modo editor): fechas por suerte y labor, programación en bloque y parámetros
function labSet(key, k, campo, valor){
  const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.reg = D.reg || {};
  const r = D.reg[key] = D.reg[key] || {}, x = r[k] = r[k] || {};
  if (valor) x[campo] = valor; else delete x[campo];
  if (campo === 'tiene' && valor === 'no') delete x.r;            // si no la tiene, no puede estar hecha
  if (campo === 'tiene' && valor === 'si' && x.p && !x.r) { x.r = x.p; delete x.p; }   // la programada pasa a hecha
  if (!Object.keys(x).length) delete r[k]; if (!Object.keys(r).length) delete D.reg[key];
  labLimpiar(D);
}
function labPoner(key, k, campo, valor){ modCambio(() => labSet(key, k, campo, valor)); }

// ── Ficha de labores de una suerte (📝): roturación y fertilización ──
// Se dibuja en su propio contenedor (fuera de #labores) para que no se cierre al guardar; la tabla se redibuja al cerrar.
const labFichaEl = () => { let el = document.getElementById('lab-ficha'); if (!el) { el = document.createElement('div'); el.id = 'lab-ficha'; document.body.appendChild(el); } return el; };
// Valores ya escritos en todas las fichas (para sugerir contratistas, implementos y productos)
function labSugerencias(campo){
  const S = new Set(campo === 'impl' ? LAB_IMPL : []);
  Object.values(labDatos().reg || {}).forEach(r => Object.values(r).forEach(x => x && x[campo] && S.add(x[campo])));
  return [...S].sort((a, b) => a.localeCompare(b));
}
function labFicha(key){
  const el = labFichaEl(), o = labSuertes().find(y => y.key === key);
  if (!o) { el.innerHTML = ''; labE.ficha = null; return; }
  labE.ficha = key;
  const ed = MODO_EDICION, dis = ed ? '' : 'disabled', R = o.reg, rot = R.rotur || {}, rot2 = R.rotur2 || {}, fer = R.fert || {}, nota = R.nota || {};
  const L = k => LAB_LABORES.find(x => x.k === k);
  const exc = k => { if (!o.bd) return '<span class="lf-ex">No viene en el Excel</span>';
    const b = o.bd.sn ? ({s:'hecha', n:'pend'})[o.bd[L(k).bd]] || 'sindato' : labBD(o, L(k));   // lo que dice la casilla, tal cual
    return `<span class="lf-ex ${b}">Excel: ${b === 'hecha' ? 'S (la tiene)' : b === 'pend' ? 'N (no la tiene)' : 'sin dato'}</span>`; };
  const seg = (k, campo, val, ops) => `<span class="lf-seg">${ops.map(([v, t]) => `<button type="button" ${dis} class="${val === v ? 'on' : ''}" data-lf="${k}|${campo}|${v}" title="${val === v ? 'Tocar otra vez para quitar la respuesta' : ''}">${t}</button>`).join('')}</span>`;
  const SINO = [['si', 'Sí'], ['no', 'No']];
  const txt = (k, campo, val, ph, lista) => `<input type="text" ${dis} data-lft="${k}|${campo}" value="${esc(val || '')}" placeholder="${ph}"${lista ? ` list="lf-dl-${lista}"` : ''}>`;
  // Fecha: si ya la tiene es la fecha en que se hizo (r); si no, la fecha programada (p)
  const fecha = (k, x) => x.tiene === 'si' || x.r ? `<label>Fecha en que se hizo<input type="date" ${dis} data-lft="${k}|r" value="${esc(x.r || '')}"></label>`
    : `<label>Fecha programada<input type="date" ${dis} data-lft="${k}|p" value="${esc(x.p || '')}"></label>`;
  const estado = k => { const s = labEstado(o, L(k)), E = LAB_EST[s.e]; return `<span class="lab-chip" style="color:${E.col};background:${E.bg}" title="${esc(s.t)}">${E.n}</span>`; };
  const pase = (k, x, titulo, conTiene) => `<div class="lf-pase"><div class="lf-pt"><b>${titulo}</b> ${estado(k)}${conTiene ? ` ${exc(k)}` : ''}</div>
    ${conTiene ? `<div class="lf-q">¿Tiene ${titulo.toLowerCase()}? ${seg(k, 'tiene', x.tiene, SINO)}</div>` : ''}
    <div class="lf-campos"><label>Contratista${txt(k, 'contr', x.contr, '¿Con quién?', 'contr')}</label><label>Implemento${txt(k, 'impl', x.impl, 'Implemento', 'impl')}</label>${fecha(k, x)}</div></div>`;
  let cuerpoRot = '';
  if (rot.unica === 'si') cuerpoRot = `<div class="lf-pase"><div class="lf-pt"><b>Roturación única</b> ${estado('rotur')}</div>
      <div class="lf-q">Implemento ${seg('rotur', 'impl', LAB_IMPL.includes(rot.impl) ? rot.impl : '', LAB_IMPL.map(i => [i, i]))} ${txt('rotur', 'impl', LAB_IMPL.includes(rot.impl) ? '' : rot.impl, 'Otro implemento', 'impl')}</div>
      <div class="lf-campos"><label>Contratista${txt('rotur', 'contr', rot.contr, '¿Con quién?', 'contr')}</label>${fecha('rotur', rot)}</div></div>`;
  else if (rot.unica === 'no') cuerpoRot = pase('rotur', rot, '1ra roturación', false) + pase('rotur2', rot2, '2da roturación', true);
  else cuerpoRot = `<div class="meta lf-ayuda">Responde si es <b>única roturación</b> (subsolador o triple) o si lleva <b>1ra y 2da</b> roturación, para anotar contratista, implemento y fecha.</div>`;
  const dl = c => `<datalist id="lf-dl-${c}">${labSugerencias(c).map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  el.innerHTML = `<div class="ms-fondo lf-fondo" data-lf-cerrar><div class="ms-ficha lf-ficha" role="dialog" aria-label="Ficha de labores de la suerte ${esc(o.x.s)}">
    <div class="ms-fh"><span class="ms-cod">${esc(o.x.s)}</span><div><b>${esc(msHacN(o.x.hac) || 'Suerte ' + o.x.s)}</b><small>Zona ${esc(o.x.zona ?? '—')} · ${msN(o.x.area, 2)} ha · ${esc(o.x.variedad || '—')}${o.x.nCorte != null ? ` · corte ${msN(o.x.nCorte)}` : ''} · ${o.x.desdeSiembra ? 'sembrada' : 'cosechada'} ${msF(o.x.ultCorte)} (hace ${o.dd} d)${o.x.par ? ` · parcial ${msN(o.x.par, 2)} ha` : ''}</small></div>
      <button type="button" class="ms-x" data-lf-cerrar title="Cerrar (Esc)">✕</button></div>
    <div class="ms-cuerpo">
      ${ed ? '' : '<div class="meta lf-ayuda">Solo lectura: para anotar, entra en modo editor.</div>'}
      <div class="lf-sec" style="--c:#0369a1"><div class="lf-h">🚜 Roturación ${estado('rotur')} ${exc('rotur')}</div>
        <div class="lf-q">¿Tiene roturación? ${seg('rotur', 'tiene', rot.tiene, SINO)}</div>
        <div class="lf-q">¿Única roturación? ${seg('rotur', 'unica', rot.unica, [['si', 'Sí (subsolador o triple)'], ['no', 'No (1ra y 2da)']])}</div>
        ${cuerpoRot}</div>
      <div class="lf-sec" style="--c:#15803d"><div class="lf-h">🌱 Fertilización ${estado('fert')} ${exc('fert')}</div>
        <div class="lf-q">¿Tiene fertilización? ${seg('fert', 'tiene', fer.tiene, SINO)}</div>
        <div class="lf-campos"><label>¿Con quién?${txt('fert', 'contr', fer.contr, 'Contratista', 'contr')}</label>
          <label>Producto o mezcla${txt('fert', 'prod', fer.prod, 'Ej.: urea + KCl', 'prod')}</label>
          <label>Dosis${txt('fert', 'dosis', fer.dosis, 'Ej.: 6 bultos/ha')}</label>${fecha('fert', fer)}</div></div>
      <div class="lf-sec" style="--c:#64748b"><div class="lf-h">📝 Observaciones</div>
        <textarea ${dis} data-lft="nota|obs" rows="2" placeholder="Notas de la suerte">${esc(nota.obs || '')}</textarea></div>
      <div class="meta lf-ayuda">Lo que respondas aquí manda sobre el Excel. ${ed ? 'Se guarda solo; recuerda 🚀 Publicar.' : ''}</div>
    </div></div>${dl('contr')}${dl('impl')}${dl('prod')}</div>`;
}
function labFichaCerrar(){ labFichaEl().innerHTML = ''; labE.ficha = null; if (labE.sucio) { labE.sucio = false; renderVista(); } }
// Guarda un dato de la ficha sin redibujar la página (se redibuja al cerrar)
function labFichaGuardar(k, campo, valor, redibujar){
  if (!MODO_EDICION || !labE.ficha) return;
  labSet(labE.ficha, k, campo, valor); save(); renderEstadoEdicion(); labE.sucio = true;
  if (redibujar) labFicha(labE.ficha);
}
labFichaEl().addEventListener('click', e => {
  const t = e.target;
  if (t.matches('[data-lf-cerrar]') || t.closest('.ms-x')) { labFichaCerrar(); return; }
  const b = t.closest('[data-lf]'); if (!b) return;
  const [k, campo, v] = b.dataset.lf.split('|'), actual = ((labSuertes().find(y => y.key === labE.ficha) || {reg:{}}).reg[k] || {})[campo];
  labFichaGuardar(k, campo, actual === v ? '' : v, true);
});
labFichaEl().addEventListener('change', e => { const d = e.target.dataset.lft; if (!d) return; const [k, campo] = d.split('|'); labFichaGuardar(k, campo, e.target.value.trim(), e.target.type === 'date'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && labE.ficha) labFichaCerrar(); });
// Se borran los registros de cortes de hace más de 400 días que ya no están en el control, para no crecer sin fin
function labLimpiar(D){
  const vivas = new Set(labSuertes().map(o => o.key));
  Object.keys(D.reg).forEach(k => { if (!vivas.has(k) && labDias(k.split('|')[1], labHoy()) > 400) delete D.reg[k]; });
}
q('labores').addEventListener('click', e => {
  const t = e.target;
  const ir = t.closest('[data-ir]'); if (ir) { irA(ir.dataset.ir); return; }
  const fi = t.closest('[data-lab-ficha]'); if (fi) { e.preventDefault(); labFicha(fi.dataset.labFicha); return; }
  if (t.closest('[data-lab-excel]')) { labExcel(); return; }
  if (t.closest('[data-lab-servidor]')) { labDesdeServidor(); return; }
  if (t.closest('[data-lab-quitar]')) { if (confirm('¿Quitar el Excel de labores pendientes? Quedan solo las suertes cosechadas según el maestro (lo anotado en las fichas no se borra).')) modCambio(() => { delete DB.levante; }); return; }
  const lb = t.closest('[data-lab-labor]');
  const es = t.closest('[data-lab-est]'); if (es) { labE.estado = es.dataset.labEst; renderLabores(); return; }
  if (lb) { labE.labor = lb.dataset.labLabor; if (lb.hasAttribute('data-lab-ir')) labE.estado = ''; renderLabores(); if (lb.hasAttribute('data-lab-ir')) q('lab-tabla').scrollIntoView({block:'start', behavior:'smooth'}); return; }
  const h = t.closest('[data-lab-hoy]'); if (h) { labPoner(h.dataset.labHoy, h.dataset.labk, 'r', labHoy()); return; }
  const b = t.closest('[data-lab-bloque]');
  if (b) { const [k, campo] = b.dataset.labBloque.split('|'), Lb = LAB_LABORES.find(x => x.k === k), fe = (q('lab-pf') || {}).value; if (!fe) { toast('⚠ Elige la fecha'); return; }
    const A = labBloque(labFiltradas(labSuertes()), Lb, campo), que = campo === 'p' ? `¿Programar ${Lb.n.toLowerCase()} para el ${msF(fe)}` : `¿Marcar ${Lb.n.toLowerCase()} como hecha el ${msF(fe)}`;
    if (!A.length || !confirm(`${que} en ${A.length} suertes (${msN(sum(A, o => labHa(o, Lb)), 1)} ha)?`)) return;
    labE.progFecha = fe;
    modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.reg = D.reg || {}; A.forEach(o => { const r = D.reg[o.key] = D.reg[o.key] || {}; (r[k] = r[k] || {})[campo] = fe; }); });
    toast(`✓ ${A.length} suertes ${campo === 'p' ? 'programadas' : 'marcadas como hechas'} · recuerda 🚀 Publicar`); return; }
  if (t.closest('[data-lab-par-def]')) { modCambio(() => { if (DB.labores) delete DB.labores.params; }); return; }
});
q('labores').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'lab-archivo') { labCargarArchivo(t.files[0]); t.value = ''; return; }
  if (t.dataset.lab) { labPoner(t.dataset.lab, t.dataset.labk, t.dataset.labc, t.value); return; }
  const pa = t.dataset.labPar;
  if (pa) { const v = Math.max(0, Math.round(+t.value || 0)); modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; const P = D.params = Object.assign({}, labPar(), D.params || {});
    if (pa === 'dias') P.dias = Math.max(15, v); else { const [k, i] = pa.split('|'); P[k] = [...P[k]]; P[k][+i] = v; if (P[k][0] > P[k][1]) P[k] = [P[k][1], P[k][0]]; } }); return; }
  if (t.id === 'lab-pf') { labE.progFecha = t.value; return; }
  const k = {'lab-zona':'zona', 'lab-hac':'hac', 'lab-estado':'estado', 'lab-orden':'orden', 'lab-fuente':'fuente'}[t.id]; if (k) { labE[k] = t.value; renderLabores(); }
});
let labEspera = 0;
q('labores').addEventListener('input', e => { if (e.target.id === 'lab-txt') { labE.txt = e.target.value; clearTimeout(labEspera); labEspera = setTimeout(() => redibujarConservando('lab-txt', renderLabores), 250); } });
q('labores').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.lab-kpi[data-lab-labor]')) { e.preventDefault(); e.target.click(); } });

function labExcel(){
  cargarXLSX().then(XLSX => {
    const L = labFiltradas(labSuertes()), wb = XLSX.utils.book_new(), P = labPar();
    const cab = ['Suerte', 'Hacienda', 'Zona', 'Zona agroecológica', 'Área (ha)', 'Variedad', 'Corte', 'Fecha de cosecha (o siembra)', 'Días desde el corte', 'Origen'];
    const B = labReporte(), sn = !!(B && B.sn);
    cab.push('Parcial (ha)');
    LAB_LABORES.forEach(Lb => cab.push(`${Lb.n} (${P[Lb.k][0]}–${P[Lb.k][1]} d)`, ...(Lb.bd ? [sn ? `${Lb.n} · Excel (S/N)` : `${Lb.n} · ha pendientes (reporte)`] : []), `${Lb.n} programada`, `${Lb.n} hecha`));
    cab.push('¿Tiene roturación?', '¿Única roturación?', 'Roturación · implemento', 'Roturación · contratista', '¿Tiene 2da roturación?', '2da · implemento', '2da · contratista',
      '¿Tiene fertilización?', 'Fertilización · contratista', 'Producto o mezcla', 'Dosis', 'Observaciones');
    const sino = v => v === 'si' ? 'Sí' : v === 'no' ? 'No' : '';
    const filas = [cab, ...L.map(o => { const f = [o.x.s, msHacN(o.x.hac), o.x.zona ?? '', o.x.zonaAgro || '', +(+o.x.area || 0).toFixed(2), o.x.variedad || '', o.x.nCorte ?? '', o.x.ultCorte, o.dd, o.fuente === 'reporte' ? (sn ? 'Excel labores pendientes' : 'Reporte de levante') : 'Maestro', o.x.par || ''];
      LAB_LABORES.forEach(Lb => { const r = o.reg[Lb.k] || {}; f.push(LAB_EST[labEstado(o, Lb).e].n); if (Lb.bd) f.push(o.bd ? (sn ? String(o.bd[Lb.bd] || '').toUpperCase() : o.bd[Lb.bd] ?? '') : ''); f.push(r.p || '', r.r || ''); });
      const a = o.reg.rotur || {}, b = o.reg.rotur2 || {}, c = o.reg.fert || {};
      f.push(sino(a.tiene), sino(a.unica), a.impl || '', a.contr || '', sino(b.tiene), b.impl || '', b.contr || '', sino(c.tiene), c.contr || '', c.prod || '', c.dosis || '', (o.reg.nota || {}).obs || '');
      return f; })];
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, filas), 'Labores');
    XLSX.writeFile(wb, `control-labores-${labHoy()}.xlsx`);
  });
}

// Resumen para el Inge Virtual y la tarjeta del portal
function labResumen(){
  const T = labSuertes();
  return {n:T.length, ha:sum(T, o => o.x.area || 0), L:LAB_LABORES.map(Lb => { const E = T.map(o => labEstado(o, Lb).e);
    const de = f => T.filter((o, i) => f(E[i]));
    const urg = de(labPorHacer);
    return {Lb, urg, haUrg:sum(urg, o => labHa(o, Lb)), ven:de(e => e === 'vencida' || e === 'atrasada'), prog:de(e => e === 'programada'), hecha:de(e => e === 'hecha'), sin:de(e => e === 'sindato')}; })};
}

// El portal se dibujó antes de cargar este archivo: se redibuja para mostrar la tarjeta y la vista de labores
if (['lab', 'portal'].includes(vistaActual)) renderVista();
