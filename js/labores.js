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
  // Colores: primeros puestos de la paleta categórica validada (azul, naranja, aguamarina) para que se distingan en los gráficos
  {k:'rotur',     n:'1ra roturación', c:'1ra rot.', ico:'🚜', tipo:'prog',   col:'#2a78d6', bd:'r1'},
  {k:'rotur2',    n:'2da roturación', c:'2da rot.', ico:'🚜', tipo:'prog',   col:'#eb6834', bd:'r2'},
  {k:'fert',      n:'Fertilización',  c:'Fertiliz.', ico:'🌱', tipo:'prog',   col:'#1baf7a', bd:'fe'},
];
// Contratistas de levante (16 nov 2026); «Otro» deja escribir uno que falte
const LAB_CONTR = ['Bienes y Maquinaria', 'Riocas', 'Camaro', 'Galvil', 'Agromorales'];
// Ventanas por defecto (días después del corte); el editor las cambia en «Parámetros»
const LAB_DEF = {dias:60, despaje:[0, 10], reencalle:[5, 15], rotur:[15, 30], rotur2:[30, 50], fert:[25, 45]};
const LAB_EST = {
  hecha:      {n:'Realizada',  col:'#15803d', bg:'#dcfce7'},
  programada: {n:'Programada', col:'#1d4ed8', bg:'#dbeafe'},
  atrasada:   {n:'Atrasada',   col:'#c2410c', bg:'#ffedd5'},
  pendiente:  {n:'Pendiente',  col:'#b91c1c', bg:'#fee2e2'},
  vencida:    {n:'Pendiente',  col:'#b91c1c', bg:'#fee2e2'},   // se muestra como «Pendiente» (pedido de Luis); el globo dice hace cuánto venció
  proxima:    {n:'Pendiente',  col:'#b91c1c', bg:'#fee2e2'},   // aún no empieza su ventana; se muestra como «Pendiente» (pedido de Luis)
  sindato:    {n:'Sin dato',   col:'#6b7280', bg:'#f3f4f6'},
  noaplica:   {n:'No aplica',  col:'#94a3b8', bg:'#f8fafc'},
};
const labE = {zona:'', hac:'', txt:'', labor:'', estado:'', orden:'excel', progFecha:'', fuente:'', ficha:null, sucio:false};
const LAB_IMPL = ['Subesca', 'Triple'];   // implementos de la roturación única
// Área realizada de una labor: total = área del maestro; parcial = la escrita en la ficha, o la «parcial (ha)» del Excel
const labHaReal = (o, x) => x && x.at === 'parcial' ? (+x.ha || +o.x.par || +o.x.area || 0) : (+o.x.area || 0);

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
  // Suertes agregadas a mano o desde otro Excel (DB.labores.extra): no se borran al recargar el Excel principal;
  // se ocultan solas cuando el Excel ya trae esa suerte con un corte de la misma fecha (±10 días) o posterior
  const enExcel = (s, f) => B && B.filas.some(g => g.s === s && labDias(f, g.f) >= -10);
  const EX = (labDatos().extra || []).filter(f => !enExcel(f.s, f.f));
  EX.forEach((f, i) => { const m = porCod[f.s] || {};
    out.push({x:{s:f.s, hac:m.hac || f.hac || '', zona:f.z ?? m.zona, area:f.a ?? m.area, variedad:f.v || m.variedad, nCorte:f.nc ?? m.nCorte, ultCorte:f.f, zonaAgro:f.za || m.zonaAgro, par:f.par},
      bd:Object.assign({}, f, {sn:1}), fuente:'manual', i:5e5 + i}); });
  const renov = new Set((DB.lotes || []).map(l => l.s + '|' + norm(l.h)));
  ms.filter(x => x.ultCorte && x.estado !== 'PROCESO' && /^(CAÑA|SEMILLA)$/i.test(x.uso || '') && !renov.has(x.s + '|' + norm(x.hac)))
    .forEach(x => { const dd = labDias(x.ultCorte, hoy); if (dd < 0 || dd > P.dias) return;
      // Ya está en el reporte si trae esa suerte con un corte de la misma fecha o posterior (±10 días)
      if (enExcel(x.s, x.ultCorte) || EX.some(f => f.s === x.s && labDias(x.ultCorte, f.f) >= -10)) return;
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
// Tipo de roturación: 'si' = única (subesca o triple), 'no' = 1ra y 2da, 'nr' = no se rotura (plantilla).
// Lo escrito en la ficha manda; si no hay nada y la suerte va en el corte 1 (plantilla), por defecto no se rotura.
const labPlantilla = o => +o.x.nCorte === 1;
const labUnica = o => (o.reg.rotur || {}).unica || (labPlantilla(o) ? 'nr' : '');
function labEstado(o, L){
  const P = labPar(), [d0, d1] = P[L.k], r = o.reg[L.k] || {}, hoy = labHoy(), b = labBD(o, L);
  const v = o.bd && L.bd && !o.bd.sn ? o.bd[L.bd] : undefined, como = labComo(r), un = labUnica(o);
  if (r.r) return {e:'hecha', t:`Hecha ${msF(r.r)}${como}`};
  if (r.tiene === 'si') return {e:'hecha', t:`Hecha${como}`};
  if ((L.k === 'rotur' || L.k === 'rotur2') && un === 'nr') return {e:'noaplica', n:'No se rotura', t:`No se rotura${labPlantilla(o) ? ' · plantilla (corte 1)' : ''}`};
  if (L.k === 'rotur2' && un === 'si') { const r1 = o.reg.rotur || {}; return {e:'noaplica', t:`Única roturación${r1.impl ? ' · ' + r1.impl : ''}`}; }
  if (r.tiene !== 'no' && b === 'hecha') return {e:'hecha', t:o.fuente === 'manual' ? 'Hecha (marcada al agregar la suerte)' : o.bd.sn ? 'Hecha según el Excel (S)' : 'Hecha según el reporte'};
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
    // Las que no aplican (plantillas que no se roturan, 2da de una roturación única) no cuentan en la barra
    const n0 = cuenta('noaplica').length, hech = cuenta('hecha').length, sin = cuenta('sindato').length, tot = (T.length - n0) || 1, pct = n => (n / tot * 100).toFixed(1);
    const haR = sum(cuenta('hecha'), o => labHaReal(o, o.reg[Lb.k]));   // hectáreas realizadas (total o parcial anotada)
    return `<button type="button" class="lab-mini ${labE.labor === Lb.k ? 'on' : ''}" style="--c:${Lb.col}" data-lab-labor="${Lb.k}" data-lab-ir
      title="${esc(`${Lb.n} (${P[Lb.k][0]}–${P[Lb.k][1]} días después del corte): ${urg.length} pendientes (${ven.length} vencidas) · ${cuenta('programada').length} programadas · ${hech} realizadas · ${sin} sin dato en el Excel${n0 ? ` · ${n0} no aplica (${Lb.k === 'rotur' ? 'plantillas que no se roturan' : 'plantillas o roturación única'})` : ''}. Toca para ver todas las suertes.`)}">
      <span class="lab-mini-t">${Lb.ico} <span class="lab-lg">${Lb.n}</span><span class="lab-ct">${Lb.c}</span></span>
      <span class="lab-mini-v"><b>${msN(haL(urg, Lb), 0)} ha</b> pendientes</span>
      <span class="lab-mini-bar"><i style="width:${pct(hech)}%;background:#16a34a"></i><i style="width:${pct(urg.length)}%;background:#dc2626"></i><i style="width:${pct(sin)}%;background:#cbd5e1"></i></span>
      <span class="lab-mini-s"><span class="ok">${msN(haR, 0)} ha realizadas</span> <span class="lab-st">(${hech} suertes)</span> · <span class="pe">${urg.length} suertes pendientes</span>${sin ? ` · ${sin} sin dato` : ''}${n0 ? ` · <span class="lab-st">${n0} no ${Lb.k === 'rotur' ? 'se roturan' : 'aplica'}</span>` : ''}</span></button>`; }).join('');
  // Programa semanal de roturación y fertilización (fechas programadas, de esta semana en adelante)
  const PROG = LAB_LABORES.filter(Lb => Lb.tipo === 'prog'), sem = {};
  T.forEach(o => PROG.forEach(Lb => { const r = o.reg[Lb.k] || {}, e = labEstado(o, Lb).e; if (!r.p || e === 'hecha' || e === 'noaplica') return;
    const w = r.p < hoy ? 'atrasadas' : labLunes(r.p); const s = sem[w] = sem[w] || {}; const z = s[Lb.k] = s[Lb.k] || {n:0, a:0}; z.n++; z.a += labHa(o, Lb); }));
  const semanas = Object.keys(sem).sort((a, b) => a === 'atrasadas' ? -1 : b === 'atrasadas' ? 1 : a < b ? -1 : 1);
  // Tabla
  const ord = [...L].sort((a, b) => labE.orden === 'excel' ? (a.i ?? 1e6) - (b.i ?? 1e6) || b.dd - a.dd : labE.orden === 'hac' ? (a.x.hac + a.x.s).localeCompare(b.x.hac + b.x.s) : labE.orden === 'area' ? (b.x.area || 0) - (a.x.area || 0) : labE.orden === 'nuevas' ? a.dd - b.dd : b.dd - a.dd);
  const chip = s => { const E = LAB_EST[s.e]; return `<span class="lab-chip" style="color:${E.col};background:${E.bg}" title="${esc(s.t)}">${s.n || E.n}</span>`; };
  // En modo editor, cada labor lleva dos botones: Programada y Realizada (el activo va pintado; ninguno = pendiente,
  // con borde rojo). Tocar el activo lo quita. Fuera del modo editor se ve solo el estado.
  const dosBot = (o, Lb, conFechas) => { const s = labEstado(o, Lb), e = s.e, k = esc(o.key), r = o.reg[Lb.k] || {};
    if (!ed || e === 'noaplica') return chip(s);
    const prog = e === 'programada' || e === 'atrasada', hecha = e === 'hecha', tono = hecha ? 'r' : prog ? 'p' : 'x';
    return `<span class="lab-2b lab-2b-${tono}" title="${esc(s.t)}"><button type="button" class="${prog ? 'on' : ''}" data-lab-m="${k}|${Lb.k}|p">Programada</button><button type="button" class="${hecha ? 'on' : ''}" data-lab-m="${k}|${Lb.k}|r">Ejecutada</button></span>${conFechas && (r.p || r.r) ? `<small class="lab-t">${r.r ? `Hecha ${msF(r.r)}` : `Prog. ${msF(r.p)}`}</small>` : ''}`; };
  // Columnas: lo que trae el Excel (1ra, 2da roturación y fertilización)
  const LAB_COLS = LAB_LABORES;
  const LbSel = LAB_LABORES.find(x => x.k === labE.labor);
  // Última columna: ficha 📝 y, en modo editor, «Enviar» a la programación semanal (✓ si ya está en la semana elegida)
  const semPg = labPgSemana(), enSem = new Set((labProg()[semPg] || []).map(r => r.key + '|' + r.lab));
  const fichaBtn = o => { const yaEn = LAB_LABORES.some(Lb => enSem.has(o.key + '|' + Lb.k) && (!LbSel || Lb === LbSel));
    return `<td class="lab-acc-fila"><button type="button" class="plegar-todo lab-fbtn" data-lab-ficha="${esc(o.key)}" title="Ficha de labores: roturación y fertilización (con quién, implemento, producto)">📝</button>${ed ? `<button type="button" class="lab-env${yaEn ? ' ya' : ''}" data-lab-env="${esc(o.key)}" title="${yaEn ? `Ya está en la programación de la semana del ${msF(semPg)} (tócalo para enviar otra labor)` : `Enviar a la programación de la semana del ${msF(semPg)}`}">${yaEn ? '✓ Enviada' : '📤 Enviar'}</button>` : ''}</td>`; };
  const datos = o => `<td class="b lab-cod"><a href="#" data-lab-ficha="${esc(o.key)}" title="Abrir la ficha de labores">${esc(o.x.s)}</a>${o.fuente === 'maestro' ? ' <small class="lab-fu" title="Cosechada según el maestro; aún no está en el Excel de labores pendientes">maestro</small>' : o.fuente === 'manual' ? ' <small class="lab-fu lab-fu-man" title="Agregada a mano o desde otro Excel; aún no está en el Excel de labores pendientes">agregada</small>' : ''}</td>
    <td>${esc(msHacN(o.x.hac)) || '<span class="meta">—</span>'}</td><td>${esc(o.x.zona ?? '')}</td><td>${esc(o.x.zonaAgro || '')}</td><td class="n">${msN(o.x.area, 2)}${o.x.par ? `<small class="lab-t" title="Parcial (ha) según el Excel">parcial ${msN(o.x.par, 2)}</small>` : ''}</td>
    <td>${esc(o.x.variedad || '—')}</td><td class="n">${o.x.nCorte != null ? msN(o.x.nCorte) : esc(o.x.tipo || '')}</td><td>${msF(o.x.ultCorte)}${o.x.desdeSiembra ? '<small class="lab-t">siembra</small>' : ''}</td><td class="n">${o.dd}</td>`;
  const cabDatos = '<th>Suerte</th><th>Hacienda</th><th title="Zona">Z</th><th title="Zona agroecológica">Z. agro</th><th class="n">Área</th><th>Variedad</th><th class="n">Corte</th><th>Cosechada</th><th class="n lab-th2" title="Días de lucro: desde el corte (o la siembra) hasta hoy">Días de<br>lucro</th>';
  // Una labor elegida: una fila por suerte con su estado y, en modo editor, las fechas para programar o marcar hecha
  const filaLabor = (o, Lb) => { const s = labEstado(o, Lb), r = o.reg[Lb.k] || {}, k = esc(o.key), cerrada = s.e === 'noaplica' || (s.e === 'hecha' && !r.r);
    return `<tr>${datos(o)}${Lb.bd ? `<td class="n b">${labPorHacer(s.e) ? msN(labHa(o, Lb), 2) : '<span class="meta">—</span>'}</td>` : ''}<td>${chip(s)}</td>
      ${ed ? `<td class="lab-hecha">${dosBot(o, Lb, true)}</td>` : ''}${fichaBtn(o)}</tr>`; };
  const tabla = LbSel
    ? `<table class="sim-t lab-tab"><thead><tr>${cabDatos}${LbSel.bd ? '<th class="n" title="Hectáreas pendientes">Pend. ha</th>' : ''}<th title="Pasa el mouse sobre el estado para ver el detalle">Estado</th>${ed ? '<th title="Marca la labor como programada o realizada (con la fecha de hoy; otras fechas en la ficha 📝)">Marcar</th>' : ''}<th></th></tr></thead>
      <tbody>${ord.map(o => filaLabor(o, LbSel)).join('') || `<tr><td colspan="16" class="nores">Ninguna suerte con esos filtros.</td></tr>`}</tbody>
      ${ord.length ? `<tfoot><tr><td colspan="4">Total · ${ord.length} suertes</td><td class="n b">${msN(ha(ord), 2)}</td><td colspan="4"></td>${LbSel.bd ? `<td class="n b">${msN(sum(ord.filter(o => labPorHacer(labEstado(o, LbSel).e)), o => labHa(o, LbSel)), 2)}</td>` : ''}<td colspan="${ed ? 3 : 2}"></td></tr></tfoot>` : ''}</table>`
    : `<table class="sim-t lab-tab"><thead><tr>${cabDatos}${LAB_COLS.map(Lb => `<th title="${Lb.n}: ${P[Lb.k][0]}–${P[Lb.k][1]} días después del corte">${Lb.ico} ${Lb.c || Lb.n}</th>`).join('')}<th></th></tr></thead>
      <tbody>${ord.map(o => `<tr>${datos(o)}${LAB_COLS.map(Lb => `<td>${chip(labEstado(o, Lb))}</td>`).join('')}${fichaBtn(o)}</tr>`).join('') || `<tr><td colspan="${10 + LAB_LABORES.length}" class="nores">Ninguna suerte con esos filtros.</td></tr>`}</tbody>
      ${ord.length ? `<tfoot><tr><td colspan="4">Total · ${ord.length} suertes</td><td class="n b">${msN(ha(ord), 2)}</td><td colspan="${5 + LAB_LABORES.length}"></td></tr></tfoot>` : ''}</table>`;
  // Selector de labor (cuántas suertes pendientes tiene cada una con los demás filtros)
  const pendDe = Lb => T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac) && labPorHacer(labEstado(o, Lb).e)).length;
  const selector = `<div class="lab-seg"><button type="button" class="${!LbSel ? 'on' : ''}" data-lab-labor="">Todas</button>${LAB_LABORES.map(Lb => `<button type="button" class="${LbSel === Lb ? 'on' : ''}" style="--c:${Lb.col}" data-lab-labor="${Lb.k}" title="${pendDe(Lb)} pendientes">${Lb.ico} ${Lb.n}</button>`).join('')}</div>`;
  // Botones de estado con su cuenta (con los demás filtros): todas / realizadas / pendientes / vencidas / sin dato
  const base = T.filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac) && (!labE.fuente || o.fuente === labE.fuente));
  const nEst = v => !v ? base.length : base.filter(o => LbSel ? labCumple(labEstado(o, LbSel).e, v) : (() => { const E = LAB_LABORES.map(Lb => labEstado(o, Lb).e); return v === 'hecha' ? E.every(e => labCumple(e, v)) : E.some(e => labCumple(e, v)); })()).length;
  const estBtns = `<div class="lab-pills">${[['', 'Todas'], ['hecha', 'Realizadas'], ['pend', 'Pendientes'], ['sindato', 'Sin dato']].filter(([v]) => v !== 'sindato' || nEst(v) || labE.estado === v).map(([v, t]) =>
    `<button type="button" class="${labE.estado === v ? 'on' : ''} est-${v || 'todas'}" data-lab-est="${v}">${t} <b>${nEst(v)}</b></button>`).join('')}</div>`;
  // De dónde salen los datos: solo en el globo del título (para no llenar la página de texto)
  const origen = !B ? 'Sin Excel de labores pendientes cargado'
    : `${B.sn ? 'Excel' : 'Reporte'} ${B.archivo}${B.hoja ? ` · hoja ${B.hoja}` : ''} (${msF(B.fecha)}): ${nRep} suertes${nMs ? ` + ${nMs} cosechadas según el maestro que el Excel aún no trae` : ''} · ${msN(ha(T), 1)} ha`;
  cont.innerHTML = `
    <div class="lab-top"><div class="sim-tit" title="${esc(origen)}">🚜 Control labores campo${B ? '' : ' <small class="lab-aviso">sin Excel cargado</small>'}${B && B.mod ? `<small class="lab-ver" title="Hora en que se guardó el Excel que muestra el panel">Excel guardado ${labHoraTxt(B.mod)}</small>` : ''}</div>
      <div class="lab-acc">${ed ? `<label class="lab-ico" title="Cargar Excel de labores pendientes">📂<input type="file" id="lab-archivo" accept=".xlsx,.xls,.xlsm" hidden></label>
        <button type="button" class="lab-ico" data-lab-servidor title="Traer el último Excel de Documents\\OPERACIONES CAMPO - LEVANTE">🔄</button>
        <button type="button" class="lab-add-btn" data-lab-add title="Agregar una suerte (por ejemplo, una cosechada hace poco) a mano o desde un Excel">➕ Suerte</button>` : ''}
        <button type="button" class="lab-ico" data-lab-excel title="Descargar en Excel">⬇️</button></div></div>
    <div class="lab-minis">${kpi}</div>
    <div hidden><!-- reemplazado por 📅 Programación semanal (17 nov 2026) -->
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>📅 Programa de roturación y fertilización</b> <span class="meta">· por semana</span></div>
        <div class="sim-tw"><table class="sim-t"><thead><tr><th>Semana</th>${PROG.map(Lb => `<th class="n">${Lb.ico} ${Lb.n}</th>`).join('')}</tr></thead><tbody>
        ${semanas.map(w => { const s = sem[w], c = k => s[k] ? `${s[k].n} st · <b>${msN(s[k].a, 1)} ha</b>` : '<span class="meta">—</span>';
          return `<tr${w === 'atrasadas' ? ' style="background:#fff7ed"' : ''}><td>${w === 'atrasadas' ? '<b style="color:#c2410c">Atrasadas</b>' : `Semana del ${msF(w)}`}</td>${PROG.map(Lb => `<td class="n">${c(Lb.k)}</td>`).join('')}</tr>`; }).join('') || `<tr><td colspan="${PROG.length + 1}" class="nores">Aún no hay labores programadas.</td></tr>`}</tbody></table></div></div>
    </div>
    <div class="sim-card abierta" id="lab-tabla">
      <div class="lab-barra">${selector}${estBtns}<span class="lab-cuenta">${ed && LbSel ? '<span class="lab-ley2"><i style="background:#d03b3b"></i>Pendiente <i style="background:#2a78d6"></i>Programada <i style="background:#0ca30c"></i>Ejecutada</span>' : ''}${L.length} suertes · ${msN(ha(L), 1)} ha</span></div>
      <div class="lab-filtros">
        <input id="lab-txt" class="pr-buscar" placeholder="🔎 Buscar suerte, hacienda o variedad…" value="${esc(labE.txt)}">
        <select id="lab-zona">${opt('', 'Zona', labE.zona)}${opt('1', 'Zona 1', labE.zona)}${opt('2', 'Zona 2', labE.zona)}</select>
        <select id="lab-hac">${opt('', 'Hacienda', labE.hac)}${hacs.map(h => opt(h, msHacN(h), labE.hac)).join('')}</select>
        <select id="lab-orden" title="Orden">${opt('excel', 'Orden del Excel', labE.orden)}${opt('corte', 'Más antiguas', labE.orden)}${opt('nuevas', 'Más recientes', labE.orden)}${opt('hac', 'Por hacienda', labE.orden)}${opt('area', 'Por área', labE.orden)}</select>
        <button type="button" class="lab-ind-btn" data-lab-ind title="Gráficos de lo que muestra la tabla (con estos filtros)">📊 Indicadores</button>
        <button type="button" class="lab-pg-btn" data-lab-pg title="Suertes enviadas a la programación de la semana: labor, contratista, área y día">📅 Programación semanal <b>${(labProg()[semPg] || []).length}</b></button></div>
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
  if (ed && !labRevisado) { labRevisado = true; labDesdeServidor(true); }
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
  const C = {s:col(/^SUERTE$/), z:col(/^ZONA$/), za:col(/^ZONA AGRO/), uso:col(/^USO/), fs:col(/SIEMBRA/), fc:col(/ULTIMO CORTE|ULT CORTE|FECHA (DE )?CORTE/),
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
// Hora local del archivo (AAAA-MM-DDTHH:MM:SS): se guarda en DB.levante.mod para saber si el Excel de la carpeta cambió
// «16 nov 2026, 9:09 p. m.» a partir de AAAA-MM-DDTHH:MM
const labHoraTxt = iso => { const h = +String(iso).slice(11, 13), m = String(iso).slice(14, 16); return `${msF(iso)}${m ? `, ${h % 12 || 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}` : ''}`; };
const labHoraISO = d => `${labISO(d)}T${[d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')}`;
function labCargarArchivo(file){
  if (!file) return; toast(`⏳ Leyendo ${file.name}…`);
  Promise.all([cargarXLSX(), file.arrayBuffer()]).then(([X, buf]) => labAplicar(Object.assign(labLeerReporte(X, buf, file.name, labISO(new Date(file.lastModified))), {mod:labHoraISO(new Date(file.lastModified))}))).catch(e => toast('⚠ ' + (e.message || e)));
}
// auto = true: solo pregunta la hora del Excel de la carpeta y lo trae si es otro archivo o se guardó después del cargado
// (al abrir el panel en modo editor, al recargar la página y al volver a la pestaña); sin avisos si el servidor no está
let labRevisado = false, labTrayendo = false;
function labDesdeServidor(auto){
  if (labTrayendo) return; const H = {cache:'no-store', headers:{'X-Comite':'1'}};
  const traer = () => { labTrayendo = true; const antes = labReporte();
    return fetch(API_BASE + 'api/levante', H).then(r => { if (!r.ok) return r.json().then(j => { throw new Error(j.error || 'No se pudo traer'); });
      const nom = decodeURIComponent(r.headers.get('X-Archivo') || 'reporte.xlsx'), fh = r.headers.get('X-Fecha') || '';
      return Promise.all([cargarXLSX(), r.arrayBuffer()]).then(([X, buf]) => {
        // Mismo archivo y misma hora de guardado: los cambios hechos en Excel aún no se han guardado
        if (!auto && antes && antes.archivo === nom && antes.mod === fh.slice(0, 19)) {
          toast(`ℹ️ El Excel de la carpeta no ha cambiado: sigue guardado el ${labHoraTxt(antes.mod)} · Si hiciste cambios, guárdalo en Excel (Ctrl+G) y vuelve a tocar 🔄`, 9000); return; }
        labAplicar(Object.assign(labLeerReporte(X, buf, nom, fh.slice(0, 10)), {mod:fh.slice(0, 19)})); }); })
      .finally(() => { labTrayendo = false; }); };
  if (!auto) { toast('⏳ Buscando el último Excel de labores pendientes…');
    traer().catch(e => toast('⚠ ' + (e.message === 'Failed to fetch' ? 'El servidor de este PC no responde' : e.message || e))); return; }
  fetch(API_BASE + 'api/levante?info=1', H).then(r => r.ok ? r.json() : null).then(info => {
    if (!info || !info.ok) return; const B = labReporte();
    if (B && B.archivo === info.archivo && B.mod && B.mod >= String(info.fecha).slice(0, 19)) return;
    toast(`🔄 El Excel ${info.archivo} cambió (guardado ${msF(info.fecha)} ${String(info.fecha).slice(11, 16)}): actualizando…`);
    return traer();
  }).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && vistaActual === 'lab' && MODO_EDICION) labDesdeServidor(true); });

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
// Botones Programada / Realizada de la tabla. Programada: pone la fecha de hoy como programada (quita «realizada»).
// Realizada: la da por hecha hoy (si estaba programada, toma esa fecha). Tocar el que ya está activo lo quita;
// si estaba realizada según el Excel (S), queda como «no la tiene» (pendiente).
function labMarcar(key, k, que){
  const o = labSuertes().find(y => y.key === key); if (!o) return;
  const L = LAB_LABORES.find(x => x.k === k), e = labEstado(o, L).e, hoy = labHoy(), r = o.reg[k] || {};
  modCambio(() => {
    if (que === 'p') {
      if (e === 'programada' || e === 'atrasada') { labSet(key, k, 'p', ''); return; }
      labSet(key, k, 'r', ''); if (r.tiene === 'si') labSet(key, k, 'tiene', '');
      if (labEstado(Object.assign({}, o, {reg:(DB.labores.reg || {})[key] || {}}), L).e === 'hecha') labSet(key, k, 'tiene', 'no');
      labSet(key, k, 'p', hoy);
    } else {
      if (e === 'hecha') { labSet(key, k, 'r', ''); labSet(key, k, 'tiene', '');
        if (labEstado(Object.assign({}, o, {reg:(DB.labores.reg || {})[key] || {}}), L).e === 'hecha') labSet(key, k, 'tiene', 'no'); return; }
      labSet(key, k, 'tiene', 'si'); const x = ((DB.labores.reg || {})[key] || {})[k] || {}; if (!x.r) labSet(key, k, 'r', hoy);
    }
  });
}

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
  if (labE.ficha !== key) labE.otro = {};   // «Otro contratista» abierto, por labor, solo mientras se edita esta ficha
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
  const estado = k => { const s = labEstado(o, L(k)), E = LAB_EST[s.e]; return `<span class="lab-chip" style="color:${E.col};background:${E.bg}" title="${esc(s.t)}">${s.n || E.n}</span>`; };
  // Contratista: lista fija (LAB_CONTR) + «Otro…» que abre un campo para escribirlo
  const contr = (k, x, etiqueta) => { const otro = (labE.otro || {})[k] || !!(x.contr && !LAB_CONTR.includes(x.contr));
    return `<label>${etiqueta || 'Contratista'}<select ${dis} data-lfc="${k}"><option value="">— Elegir —</option>${LAB_CONTR.map(c => `<option ${x.contr === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__otro" ${otro ? 'selected' : ''}>Otro…</option></select>
      ${otro ? txt(k, 'contr', LAB_CONTR.includes(x.contr) ? '' : x.contr, 'Escribe el contratista', 'contr') : ''}</label>`; };
  // Área realizada (cuando ya la tiene): total = área del maestro; parcial = escribirla (trae la «parcial (ha)» del Excel)
  const area = (k, x) => !(x.tiene === 'si' || x.r) ? '' : `<div class="lf-q lf-area">Área realizada ${seg(k, 'at', x.at || 'total', [['total', `Total · ${msN(o.x.area, 2)} ha`], ['parcial', 'Parcial']])}
    ${x.at === 'parcial' ? `<span class="lf-ha"><input type="number" inputmode="decimal" step="0.01" min="0" ${dis} data-lft="${k}|ha" value="${esc(x.ha ?? o.x.par ?? '')}" placeholder="0,00"> ha</span>${o.x.par ? `<small class="meta">parcial del Excel: ${msN(o.x.par, 2)} ha</small>` : ''}` : ''}</div>`;
  const pase = (k, x, titulo, conTiene) => `<div class="lf-pase"><div class="lf-pt"><b>${titulo}</b> ${estado(k)}${conTiene ? ` ${exc(k)}` : ''}</div>
    ${conTiene ? `<div class="lf-q">¿Tiene ${titulo.toLowerCase()}? ${seg(k, 'tiene', x.tiene, SINO)}</div>` : ''}
    ${area(k, k === 'rotur' ? rot : x)}
    <div class="lf-campos">${contr(k, x)}<label>Implemento${txt(k, 'impl', x.impl, 'Implemento', 'impl')}</label>${fecha(k, x)}</div></div>`;
  let cuerpoRot = ''; const unica = labUnica(o);
  if (unica === 'nr') cuerpoRot = `<div class="la-info la-auto">🌱 ${labPlantilla(o) ? 'Plantilla (corte 1): ' : ''}<b>no se rotura</b>; la 1ra y la 2da roturación quedan como «no aplica». Si sí se va a roturar, elige «Sí» o «No» arriba.</div>`;
  else if (unica === 'si') cuerpoRot = `<div class="lf-pase"><div class="lf-pt"><b>Roturación única</b> ${estado('rotur')}</div>
      <div class="lf-q">Implemento ${seg('rotur', 'impl', LAB_IMPL.includes(rot.impl) ? rot.impl : '', LAB_IMPL.map(i => [i, i]))}</div>
      ${area('rotur', rot)}
      <div class="lf-campos">${contr('rotur', rot)}${fecha('rotur', rot)}</div></div>`;
  else if (unica === 'no') cuerpoRot = pase('rotur', rot, '1ra roturación', false) + pase('rotur2', rot2, '2da roturación', true);
  else cuerpoRot = `<div class="meta lf-ayuda">Responde si es <b>única roturación</b> (subesca o triple) o si lleva <b>1ra y 2da</b> roturación, para anotar contratista, implemento, área y fecha.</div>`;
  const dl = c => `<datalist id="lf-dl-${c}">${labSugerencias(c).map(v => `<option value="${esc(v)}">`).join('')}</datalist>`;
  el.innerHTML = `<div class="ms-fondo lf-fondo" data-lf-cerrar><div class="ms-ficha lf-ficha" role="dialog" aria-label="Ficha de labores de la suerte ${esc(o.x.s)}">
    <div class="ms-fh"><span class="ms-cod">${esc(o.x.s)}</span><div><b>${esc(msHacN(o.x.hac) || 'Suerte ' + o.x.s)}</b><small>Zona ${esc(o.x.zona ?? '—')} · ${msN(o.x.area, 2)} ha · ${esc(o.x.variedad || '—')}${o.x.nCorte != null ? ` · corte ${msN(o.x.nCorte)}` : ''} · ${o.x.desdeSiembra ? 'sembrada' : 'cosechada'} ${msF(o.x.ultCorte)} (hace ${o.dd} d)${o.x.par ? ` · parcial ${msN(o.x.par, 2)} ha` : ''}</small></div>
      <button type="button" class="ms-x" data-lf-cerrar title="Cerrar (Esc)">✕</button></div>
    <div class="ms-cuerpo">
      ${ed ? '' : '<div class="meta lf-ayuda">Solo lectura: para anotar, entra en modo editor.</div>'}
      <div class="lf-sec" style="--c:#2a78d6"><div class="lf-h">🚜 Roturación ${estado('rotur')} ${exc('rotur')}</div>
        <div class="lf-q">¿Única roturación? ${seg('rotur', 'unica', unica, [['si', 'Sí (subesca o triple)'], ['no', 'No (1ra y 2da)'], ['nr', 'No se rotura']])}</div>
        ${unica === 'si' || unica === 'no' ? `<div class="lf-q">¿Tiene ${unica === 'si' ? 'la roturación' : 'la 1ra roturación'}? ${seg('rotur', 'tiene', rot.tiene, SINO)}</div>` : ''}
        ${cuerpoRot}</div>
      <div class="lf-sec" style="--c:#1baf7a"><div class="lf-h">🌱 Fertilización ${estado('fert')} ${exc('fert')}</div>
        <div class="lf-q">¿Tiene fertilización? ${seg('fert', 'tiene', fer.tiene, SINO)}</div>
        ${area('fert', fer)}
        <div class="lf-campos">${contr('fert', fer, '¿Con quién?')}
          <label>Producto o mezcla${txt('fert', 'prod', fer.prod, 'Ej.: urea + KCl', 'prod')}</label>
          <label>Dosis${txt('fert', 'dosis', fer.dosis, 'Ej.: 6 bultos/ha')}</label>${fecha('fert', fer)}</div></div>
      <div class="lf-sec" style="--c:#64748b"><div class="lf-h">📝 Observaciones</div>
        <textarea ${dis} data-lft="nota|obs" rows="2" placeholder="Notas de la suerte">${esc(nota.obs || '')}</textarea></div>
      <div class="meta lf-ayuda">Lo que respondas aquí manda sobre el Excel. ${ed ? 'Se guarda solo; recuerda 🚀 Publicar.' : ''}</div>
      ${ed && o.fuente === 'manual' ? `<div class="lf-quitar"><button type="button" class="plegar-todo" data-lf-quitar="${esc(o.x.s)}|${esc(o.x.ultCorte)}">🗑 Quitar esta suerte agregada</button></div>` : ''}
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
  const qx = t.closest('[data-lf-quitar]');
  if (qx) { const [s, f] = qx.dataset.lfQuitar.split('|'); if (!confirm(`¿Quitar la suerte ${s} (corte ${msF(f)}) que se agregó? Lo anotado en su ficha también se borra.`)) return;
    labFichaEl().innerHTML = ''; labE.ficha = null; labE.sucio = false;
    modCambio(() => { const D = DB.labores; D.extra = (D.extra || []).filter(x => !(x.s === s && x.f === f)); if (!D.extra.length) delete D.extra; if (D.reg) delete D.reg[`${s}|${f}`]; });
    toast(`🗑 Se quitó la suerte ${s} · recuerda 🚀 Publicar`); return; }
  const b = t.closest('[data-lf]'); if (!b) return;
  const [k, campo, v] = b.dataset.lf.split('|'), actual = ((labSuertes().find(y => y.key === labE.ficha) || {reg:{}}).reg[k] || {})[campo];
  labFichaGuardar(k, campo, actual === v ? '' : v, true);
});
labFichaEl().addEventListener('change', e => {
  const c = e.target.dataset.lfc;
  if (c) { labE.otro = labE.otro || {}; const v = e.target.value;
    if (v === '__otro') { labE.otro[c] = true; const x = ((labSuertes().find(y => y.key === labE.ficha) || {reg:{}}).reg[c] || {}); if (LAB_CONTR.includes(x.contr)) labFichaGuardar(c, 'contr', '', false); labFicha(labE.ficha); }
    else { labE.otro[c] = false; labFichaGuardar(c, 'contr', v, true); }
    return; }
  const d = e.target.dataset.lft; if (!d) return; const [k, campo] = d.split('|'); labFichaGuardar(k, campo, e.target.value.trim(), e.target.type === 'date'); });
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
  if (t.closest('[data-lab-ind]')) { labIndicadores(); return; }
  if (t.closest('[data-lab-pg]')) { labProgramacion(); return; }
  const env = t.closest('[data-lab-env]'); if (env) { labEnviar(env.dataset.labEnv, labE.labor || null); return; }
  const mk = t.closest('[data-lab-m]'); if (mk) { const [s, f, k, que] = mk.dataset.labM.split('|'); labMarcar(`${s}|${f}`, k, que); return; }
  if (t.closest('[data-lab-add]')) { labE.add = null; labAgregar(); return; }
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
    cab.push('¿Tiene roturación?', '¿Única roturación?', 'Roturación · implemento', 'Roturación · contratista', 'Roturación · área realizada (ha)', '¿Tiene 2da roturación?', '2da · implemento', '2da · contratista', '2da · área realizada (ha)',
      '¿Tiene fertilización?', 'Fertilización · contratista', 'Producto o mezcla', 'Dosis', 'Fertilización · área realizada (ha)', 'Observaciones');
    const sino = v => v === 'si' ? 'Sí' : v === 'no' ? 'No' : '';
    const filas = [cab, ...L.map(o => { const f = [o.x.s, msHacN(o.x.hac), o.x.zona ?? '', o.x.zonaAgro || '', +(+o.x.area || 0).toFixed(2), o.x.variedad || '', o.x.nCorte ?? '', o.x.ultCorte, o.dd, o.fuente === 'reporte' ? (sn ? 'Excel labores pendientes' : 'Reporte de levante') : o.fuente === 'manual' ? 'Agregada' : 'Maestro', o.x.par || ''];
      LAB_LABORES.forEach(Lb => { const r = o.reg[Lb.k] || {}; f.push(LAB_EST[labEstado(o, Lb).e].n); if (Lb.bd) f.push(o.bd ? (sn ? String(o.bd[Lb.bd] || '').toUpperCase() : o.bd[Lb.bd] ?? '') : ''); f.push(r.p || '', r.r || ''); });
      const a = o.reg.rotur || {}, b = o.reg.rotur2 || {}, c = o.reg.fert || {};
      const hr = (k, x) => labEstado(o, LAB_LABORES.find(Lb => Lb.k === k)).e === 'hecha' ? +labHaReal(o, x).toFixed(2) : '';
      f.push(sino(a.tiene), sino(a.unica), a.impl || '', a.contr || '', hr('rotur', a), sino(b.tiene), b.impl || '', b.contr || '', hr('rotur2', b), sino(c.tiene), c.contr || '', c.prod || '', c.dosis || '', hr('fert', c), (o.reg.nota || {}).obs || '');
      return f; })];
    XLSX.utils.book_append_sheet(wb, hoja(XLSX, filas), 'Labores');
    XLSX.writeFile(wb, `control-labores-${labHoy()}.xlsx`);
  });
}

// ── ➕ Agregar suertes (modo editor): a mano (con los datos del maestro) o desde otro Excel ──
// Se guardan en DB.labores.extra [{s, f (fecha de corte), a, par, r1, r2, fe ('s'|'n'), hac, z, za, v, nc}] y se publican
// con el módulo «labores». No se pierden al recargar el Excel principal; cuando ese Excel ya trae la suerte, se ocultan.
function labMaestroDe(s){
  if (typeof msFilas !== 'function') return null;
  const L = msFilas().filter(x => x.s === s); return L.find(x => x.emp === 'RIOP' && /^CAÑA$/i.test(x.uso || '')) || L.find(x => x.emp === 'RIOP') || L[0] || null;
}
const labEnControl = (s, f) => labSuertes().find(o => o.x.s === s && Math.abs(labDias(o.x.ultCorte, f)) <= 10);
function labAgregarExtra(filas){
  const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.extra = D.extra || [];
  filas.forEach(f => { Object.keys(f).forEach(k => (f[k] === undefined || f[k] === '' || f[k] === null) && delete f[k]); D.extra.push(f); });
}
function labAgregar(){
  const el = (() => { let e = document.getElementById('lab-add'); if (!e) { e = document.createElement('div'); e.id = 'lab-add'; document.body.appendChild(e); labAgregarEventos(e); } return e; })();
  const A = labE.add = labE.add || {r1:'n', r2:'n', fe:'n'}, s = frCodSuerte(A.s), m = s ? labMaestroDe(s) : null;
  const ya = s && A.f ? labEnControl(s, A.f) : null;
  const codigos = typeof msFilas === 'function' ? [...new Set(msFilas().filter(x => x.emp === 'RIOP').map(x => x.s))].sort() : [];
  const sn = (k, n) => `<div class="lf-q">¿Tiene ${n}? <span class="lf-seg">${[['s', 'Sí'], ['n', 'No']].map(([v, t]) => `<button type="button" class="${A[k] === v ? 'on' : ''}" data-la-sn="${k}|${v}">${t}</button>`).join('')}</span></div>`;
  el.innerHTML = `<div class="ms-fondo" data-la-cerrar><div class="ms-ficha lf-ficha" role="dialog" aria-label="Agregar suerte">
    <div class="ms-fh"><div><b>➕ Agregar suerte</b><small>Por ejemplo, una cosechada hace poco que el Excel aún no trae</small></div><button type="button" class="ms-x" data-la-cerrar title="Cerrar (Esc)">✕</button></div>
    <div class="ms-cuerpo">
      <div class="lf-sec" style="--c:#2a78d6"><div class="lf-h">✍️ A mano</div>
        <div class="lf-campos"><label>Suerte<input type="text" inputmode="numeric" data-la="s" list="la-dl" value="${esc(A.s || '')}" placeholder="Ej.: 3501-120"></label>
          <label>Fecha de corte<input type="date" data-la="f" value="${esc(A.f || '')}" max="${labHoy()}"></label>
          <label>Área (ha)<input type="number" inputmode="decimal" step="0.01" min="0" data-la="a" value="${esc(A.a ?? '')}"></label>
          <label>Parcial (ha) · opcional<input type="number" inputmode="decimal" step="0.01" min="0" data-la="par" value="${esc(A.par ?? '')}"></label></div>
        ${s ? `<div class="la-info">${m ? `📚 <b>${esc(msHacN(m.hac))}</b> · Zona ${esc(m.zona ?? '—')} · ${msN(m.area, 2)} ha · ${esc(m.variedad || '—')}${m.nCorte != null ? ` · corte ${msN(m.nCorte)}` : ''}${m.ultCorte ? ` · último corte en el maestro: ${msF(m.ultCorte)}` : ''}` : '⚠ Esa suerte no está en el maestro: escribe el área a mano.'}</div>` : A.s ? '<div class="la-info la-mal">Escribe el código completo: sector y suerte, por ejemplo 3501-120.</div>' : ''}
        ${ya ? `<div class="la-info la-mal">Esa suerte ya está en el control (corte ${msF(ya.x.ultCorte)}). Ábrela en la tabla para anotar sus labores.</div>` : ''}
        ${A.auto ? `<div class="la-info la-auto">✓ Del maestro: fecha de corte <b>${msF(A.f)}</b> y área <b>${msN(A.a, 2)} ha</b> (puedes cambiarlas)${A.plantilla ? ' · <b>corte 1 (plantilla): no se rotura</b>' : ''}</div>` : ''}
        <div class="lf-q">¿Roturación única? <span class="lf-seg">${[['si', 'Sí (subesca o triple)'], ['no', 'No (1ra y 2da)'], ['nr', 'No se rotura']].map(([v, t]) => `<button type="button" class="${A.unica === v ? 'on' : ''}" data-la-sn="unica|${v}">${t}</button>`).join('')}</span></div>
        ${A.unica === 'si' ? sn('r1', 'la roturación') : A.unica === 'no' ? sn('r1', '1ra roturación') + sn('r2', '2da roturación') : ''}${sn('fe', 'fertilización')}
        <button type="button" class="lab-ind-btn la-ok" data-la-ok ${s && A.f && !ya ? '' : 'disabled'}>➕ Agregar suerte</button></div>
      <div class="lf-sec" style="--c:#1baf7a"><div class="lf-h">📂 Desde un Excel</div>
        <p class="meta lf-ayuda">Agrega las suertes de otro Excel que aún no están en el control (no reemplaza el Excel principal). Debe tener la columna <b>SUERTE</b> y la <b>FECHA DE ULTIMO CORTE</b> (o de siembra); si trae <b>1ra</b>, <b>2da</b> y <b>abono</b> con S/N, también se toman.</p>
        <label class="plegar-todo pt-file">📂 Elegir Excel…<input type="file" data-la-xl accept=".xlsx,.xls,.xlsm" hidden></label></div>
    </div></div><datalist id="la-dl">${codigos.map(c => `<option value="${c}">`).join('')}</datalist></div>`;
}
// Trae del maestro la fecha del último corte (o de siembra si es más reciente) y el área de la suerte escrita
function labLaLeer(A, foco){
  const s = frCodSuerte(A.s); A.leida = s || null;
  if (s) { A.s = s; const m = labMaestroDe(s);
    if (m) { A.a = m.area != null ? +(+m.area).toFixed(2) : ''; A.f = [m.ultCorte, m.siembra].filter(Boolean).sort().pop() || A.f || ''; A.auto = !!(A.f || A.a);
      A.plantilla = +m.nCorte === 1; A.unica = A.plantilla ? 'nr' : A.unica === 'nr' ? '' : A.unica; }   // corte 1 = plantilla: no se rotura
    else { A.auto = false; } }
  labAgregar();
  if (foco) { const i = document.querySelector('#lab-add [data-la="f"]'); if (i) i.focus(); }
}
function labAgregarCerrar(){ const e = document.getElementById('lab-add'); if (e) e.innerHTML = ''; labE.add = null; }
function labAgregarEventos(e){
  e.addEventListener('click', ev => { const t = ev.target;
    if (t.matches('[data-la-cerrar]') || t.closest('.ms-x')) { labAgregarCerrar(); return; }
    const b = t.closest('[data-la-sn]'); if (b) { const [k, v] = b.dataset.laSn.split('|'); labE.add[k] = v; labAgregar(); return; }
    if (t.closest('[data-la-ok]')) { const A = labE.add, s = frCodSuerte(A.s), m = s ? labMaestroDe(s) || {} : {};
      const a = +String(A.a ?? '').replace(',', '.') || +m.area || 0;
      if (!s || !A.f) { toast('⚠ Falta la suerte o la fecha de corte'); return; }
      if (!a) { toast('⚠ Escribe el área de la suerte'); return; }
      if (labEnControl(s, A.f)) { toast('⚠ Esa suerte ya está en el control'); return; }
      const par = +String(A.par ?? '').replace(',', '.') || undefined;
      modCambio(() => { labAgregarExtra([{s, f:A.f, a, par, r1:A.unica === 'nr' ? undefined : A.r1, r2:A.unica === 'si' || A.unica === 'nr' ? undefined : A.r2, fe:A.fe, hac:m.hac, z:m.zona, za:m.zonaAgro, v:m.variedad, nc:m.nCorte}]);
        if (A.unica) labSet(`${s}|${A.f}`, 'rotur', 'unica', A.unica); });   // única = sí: la 2da roturación no aplica
      labAgregarCerrar(); toast(`➕ Suerte ${s} agregada · recuerda 🚀 Publicar`); labFicha(`${s}|${A.f}`); } });
  e.addEventListener('change', ev => { const t = ev.target;
    if (t.dataset.laXl !== undefined && t.files && t.files[0]) { labAgregarDeExcel(t.files[0]); t.value = ''; return; }
    const k = t.dataset.la; if (!k) return; const A = labE.add; A[k] = t.value.trim();
    if (k === 's') { labLaLeer(A); return; }
    if (k === 'f' || k === 'a') A.auto = false;
    labAgregar(); });
  // Al escribir el código completo (7 cifras) se lee solo del maestro: fecha del último corte y área
  e.addEventListener('input', ev => { const t = ev.target; if (t.dataset.la !== 's') return; const A = labE.add; A.s = t.value.trim();
    if (frCodSuerte(A.s) && frCodSuerte(A.s) !== A.leida) labLaLeer(A, true); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && e.innerHTML) labAgregarCerrar(); });
}
// Lee cualquier Excel con SUERTE + fecha (usa el lector de la hoja de labores; si no la encuentra, busca la fila SUERTE en cada hoja)
function labLeerLista(X, buf, nombre){
  try { return labLeerReporte(X, buf, nombre, labHoy()); } catch (e) {}
  for (const n of X.read(buf, {type:'array', bookSheets:true}).SheetNames) {
    const F = X.utils.sheet_to_json(X.read(buf, {type:'array', sheets:n}).Sheets[n], {header:1, raw:true, defval:''});
    const iH = F.slice(0, 30).findIndex(r => r.some(c => norm(c) === 'SUERTE'));
    if (iH >= 0) try { return labLeerSN(F, iH, n, nombre, labHoy()); } catch (e) {}
  }
  throw new Error('No encontré una hoja con la columna SUERTE y la fecha de corte');
}
function labAgregarDeExcel(file){
  toast(`⏳ Leyendo ${file.name}…`);
  Promise.all([cargarXLSX(), file.arrayBuffer()]).then(([X, buf]) => {
    const R = labLeerLista(X, buf, file.name), nuevas = [], vistas = new Set();
    let ya = 0;
    R.filas.forEach(f => { const k = f.s + '|' + f.f; if (vistas.has(k)) return; vistas.add(k);
      if (labEnControl(f.s, f.f)) { ya++; return; }
      const m = labMaestroDe(f.s) || {}, sn = v => R.sn ? v : v > 0 ? 'n' : v === 0 ? 's' : undefined;
      nuevas.push({s:f.s, f:f.f, a:f.a || m.area, par:f.par, r1:sn(f.r1), r2:sn(f.r2), fe:sn(f.fe), hac:m.hac, z:f.z ?? m.zona, za:f.za || m.zonaAgro, v:m.variedad || f.v, nc:m.nCorte ?? f.nc}); });
    if (!nuevas.length) { toast(`ℹ️ Ese Excel no trae suertes nuevas (${ya} ya están en el control)`, 6000); return; }
    if (!confirm(`¿Agregar ${nuevas.length} suertes nuevas de ${file.name}?${ya ? ` (${ya} ya estaban en el control y no se tocan)` : ''}`)) return;
    modCambio(() => labAgregarExtra(nuevas)); labAgregarCerrar();
    toast(`➕ ${nuevas.length} suertes agregadas desde ${file.name} · recuerda 🚀 Publicar`, 6000);
  }).catch(err => toast('⚠ ' + (err.message || err), 6000));
}

// ── 📅 Programación semanal (17 nov 2026) ──
// Desde la tabla, «📤 Enviar» pasa la suerte (con la labor elegida, o la primera pendiente) a la semana que se está viendo.
// En la lista se asigna día, labor, contratista, implemento o producto, área y observación, y se marca «Ejecutada».
// Datos: DB.labores.prog {'AAAA-MM-DD' (lunes): [{id, key, s, hac, z, lab, dia, contr, impl, prod, ha, obs, ok}]}
// Se mantiene en sincronía con la ficha: el día queda como fecha programada (p), contratista / implemento / producto
// se copian a la ficha y «Ejecutada» deja la labor realizada en esa fecha (con el área parcial si es menor).
const labProg = () => labDatos().prog || {};
const labPgSemana = () => labE.sem || labLunes(labHoy());
const labMas = (iso, n) => labMenos(iso, -n);
function labEnviar(key, labK){
  const o = labSuertes().find(y => y.key === key); if (!o) return;
  const Lb = LAB_LABORES.find(L => L.k === labK) || LAB_LABORES.find(L => labPorHacer(labEstado(o, L).e)) || LAB_LABORES[0];
  const w = labPgSemana(), L = labProg()[w] || [];
  if (L.some(r => r.key === key && r.lab === Lb.k)) {
    // Ya enviada con esa labor: si hay otra labor pendiente, se envía esa; si no, se avisa
    const otra = !labK && LAB_LABORES.find(X => X !== Lb && labPorHacer(labEstado(o, X).e) && !L.some(r => r.key === key && r.lab === X.k));
    if (otra) return labEnviar(key, otra.k);
    toast(`ℹ️ ${o.x.s} ya está en la programación de la semana del ${msF(w)} (${Lb.n})`, 4000); return; }
  modCambio(() => { const D = DB.labores = DB.labores || {params:{}, reg:{}}; D.prog = D.prog || {};
    (D.prog[w] = D.prog[w] || []).push({id:Date.now().toString(36) + Math.random().toString(36).slice(2, 5), key, s:o.x.s, hac:o.x.hac, z:o.x.zona, lab:Lb.k, ha:+(+labHa(o, Lb)).toFixed(2)}); });
  toast(`📤 ${o.x.s} → programación de la semana del ${msF(w)} · ${Lb.n}`, 3500);
}
function labProgramacion(){
  const el = (() => { let e = document.getElementById('lab-pg'); if (!e) { e = document.createElement('div'); e.id = 'lab-pg'; document.body.appendChild(e); labPgEventos(e); } return e; })();
  const ed = MODO_EDICION, dis = ed ? '' : 'disabled', w = labPgSemana(), dom = labMas(w, 6), F = labProg()[w] || [];
  const T = labSuertes(), porKey = new Map(T.map(o => [o.key, o]));
  const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const opt = (v, t, s) => `<option value="${esc(v)}" ${s === v ? 'selected' : ''}>${esc(t)}</option>`;
  const contrSel = r => { const otro = r.contr && !LAB_CONTR.includes(r.contr);
    return `<select ${dis} data-pg="${r.id}|contr">${opt('', '— Contratista —', r.contr || '')}${LAB_CONTR.map(c => opt(c, c, r.contr)).join('')}${opt('__otro', 'Otro…', otro || (labE.pgOtro || {})[r.id] ? '__otro' : '')}</select>${otro || (labE.pgOtro || {})[r.id] ? `<input type="text" ${dis} data-pg="${r.id}|contrTxt" value="${esc(otro ? r.contr : '')}" placeholder="Escribe el contratista" list="lf-dl-contr">` : ''}`; };
  const filas = F.map((r, i) => { const o = porKey.get(r.key), Lb = LAB_LABORES.find(L => L.k === r.lab) || LAB_LABORES[0], area = o ? o.x.area : null;
    const queCampo = r.lab === 'fert' ? `<input type="text" ${dis} data-pg="${r.id}|prod" value="${esc(r.prod || '')}" placeholder="Producto o mezcla" list="lf-dl-prod">`
      : `<select ${dis} data-pg="${r.id}|impl">${opt('', '— Implemento —', r.impl || '')}${LAB_IMPL.map(x => opt(x, x, r.impl)).join('')}${r.impl && !LAB_IMPL.includes(r.impl) ? opt(r.impl, r.impl, r.impl) : ''}</select>`;
    return `<tr class="${r.ok ? 'pg-ok' : ''}" style="--c:${Lb.col}">
      <td class="pg-n">${i + 1}</td>
      <td class="pg-s"><b>${esc(r.s)}</b><small>${esc(msHacN(o ? o.x.hac : r.hac) || '')}${(o ? o.x.zona : r.z) != null ? ` · Z${esc(o ? o.x.zona : r.z)}` : ''}${area ? ` · ${msN(area, 2)} ha` : ''}${o ? ` · ${o.dd} d` : ''}</small></td>
      <td data-l="Labor"><select ${dis} data-pg="${r.id}|lab" class="pg-lab">${LAB_LABORES.map(L => opt(L.k, `${L.ico} ${L.n}`, r.lab)).join('')}</select></td>
      <td data-l="Día"><select ${dis} data-pg="${r.id}|dia">${opt('', '— Día —', r.dia || '')}${DIAS.map((d, j) => { const f = labMas(w, j); return opt(f, `${d} ${+f.slice(8)}`, r.dia); }).join('')}</select></td>
      <td class="pg-c" data-l="Contratista">${contrSel(r)}</td>
      <td data-l="${r.lab === 'fert' ? 'Producto o mezcla' : 'Implemento'}">${queCampo}</td>
      <td data-l="Área (ha)"><input type="number" inputmode="decimal" step="0.01" min="0" ${dis} data-pg="${r.id}|ha" value="${esc(r.ha ?? '')}" class="pg-ha"></td>
      <td data-l="Observación"><input type="text" ${dis} data-pg="${r.id}|obs" value="${esc(r.obs || '')}" placeholder="Observación"></td>
      <td class="pg-bot">${ed ? `<button type="button" class="pg-ej ${r.ok ? 'on' : ''}" data-pg-ok="${r.id}" title="${r.ok ? 'Ejecutada (tócalo para deshacer)' : 'Marcar como ejecutada (queda realizada en la ficha)'}">${r.ok ? '✓ Ejecutada' : 'Ejecutada'}</button><button type="button" class="pg-x" data-pg-x="${r.id}" title="Quitar de la programación">🗑</button>` : (r.ok ? '<span class="lab-chip" style="color:#15803d;background:#dcfce7">Ejecutada</span>' : '<span class="lab-chip" style="color:#1d4ed8;background:#dbeafe">Programada</span>')}</td></tr>`; }).join('');
  // Totales de la semana: por labor y por contratista (hectáreas y suertes)
  const tot = (clave, nombre) => { const m = {}; F.forEach(r => { const k = clave(r); const z = m[k] = m[k] || {ha:0, n:0, ok:0}; z.ha += +r.ha || 0; z.n++; if (r.ok) z.ok += +r.ha || 0; });
    return Object.entries(m).sort((a, b) => b[1].ha - a[1].ha).map(([k, z]) => `<span class="pg-tot"><b>${esc(nombre(k))}</b> ${msN(z.ha, 1)} ha · ${z.n} st${z.ok ? ` · <em>${msN(z.ok, 1)} ha ejecutadas</em>` : ''}</span>`).join(''); };
  const haTot = sum(F, r => +r.ha || 0), haOk = sum(F.filter(r => r.ok), r => +r.ha || 0);
  el.innerHTML = `<div class="ms-fondo" data-pg-cerrar><div class="ms-ficha pg-modal" role="dialog" aria-label="Programación semanal">
    <div class="ms-fh"><div><b>📅 Programación semanal</b><small>Semana del ${msF(w)} al ${msF(dom)} · ${F.length} suertes · ${msN(haTot, 1)} ha${haOk ? ` · ${msN(haOk, 1)} ha ejecutadas (${msN(haOk / (haTot || 1) * 100, 0)}%)` : ''}</small></div><button type="button" class="ms-x" data-pg-cerrar title="Cerrar (Esc)">✕</button></div>
    <div class="ms-cuerpo">
      <div class="pg-barra"><span class="pg-sem"><button type="button" data-pg-sem="-7" title="Semana anterior">◀</button><b>Semana del ${msF(w)}</b><button type="button" data-pg-sem="7" title="Semana siguiente">▶</button>${w !== labLunes(labHoy()) ? '<button type="button" data-pg-sem="hoy">Esta semana</button>' : ''}</span>
        <span class="pg-acc"><button type="button" class="plegar-todo" data-pg-xl ${F.length ? '' : 'disabled'}>⬇️ Excel</button><button type="button" class="plegar-todo" data-pg-imp ${F.length ? '' : 'disabled'}>🖨 Imprimir</button></span></div>
      ${F.length ? `<div class="pg-tw"><table class="pg-t"><thead><tr><th>#</th><th>Suerte</th><th>Labor</th><th>Día</th><th>Contratista</th><th>Implemento / producto</th><th>Área (ha)</th><th>Observación</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
        <div class="pg-tots"><div><span class="meta">Por labor:</span>${tot(r => r.lab, k => (LAB_LABORES.find(L => L.k === k) || {}).n || k)}</div><div><span class="meta">Por contratista:</span>${tot(r => r.contr || 'Sin asignar', k => k)}</div></div>`
        : `<div class="li-vacio">No hay suertes en esta semana.${ed ? ' En la tabla, toca <b>📤 Enviar</b> en cada suerte que vaya a trabajarse (con una labor elegida arriba se envía esa labor).' : ''}</div>`}
      ${ed ? '<p class="meta lf-ayuda">El día queda como fecha programada de la labor; contratista, implemento y producto se copian a la ficha 📝; «Ejecutada» la deja realizada. Recuerda 🚀 Publicar.</p>' : ''}
    </div></div><datalist id="lf-dl-contr">${labSugerencias('contr').filter(c => !LAB_CONTR.includes(c)).map(v => `<option value="${esc(v)}">`).join('')}</datalist><datalist id="lf-dl-prod">${labSugerencias('prod').map(v => `<option value="${esc(v)}">`).join('')}</datalist></div>`;
}
function labPgCerrar(){ const e = document.getElementById('lab-pg'); if (e) e.innerHTML = ''; labE.pgOtro = {}; if (labE.sucio) { labE.sucio = false; renderVista(); } }
// Cambia un dato de una fila y lo pasa a la ficha (sin redibujar toda la página; se redibuja al cerrar)
function labPgPoner(id, campo, valor, redibujar){
  if (!MODO_EDICION) return;
  const w = labPgSemana(), L = (DB.labores.prog || {})[w] || [], r = L.find(x => x.id === id); if (!r) return;
  const viejo = Object.assign({}, r);
  if (campo === 'contrTxt') campo = 'contr';
  if (campo === 'ha') valor = valor === '' ? '' : +String(valor).replace(',', '.');
  if (valor === '' || valor == null) delete r[campo]; else r[campo] = valor;
  const k = r.lab, key = r.key;
  if (campo === 'lab') {   // cambió la labor: la fecha programada y lo copiado pasan a la nueva labor
    const v = ((DB.labores.reg || {})[key] || {})[viejo.lab] || {}; if (viejo.dia && v.p === viejo.dia) labSet(key, viejo.lab, 'p', '');
    delete r.impl; delete r.prod; const o = labSuertes().find(y => y.key === key), Lb = LAB_LABORES.find(L => L.k === k); if (o && Lb) r.ha = +(+labHa(o, Lb)).toFixed(2);
    if (r.dia && !r.ok) labSet(key, k, 'p', r.dia); if (r.contr) labSet(key, k, 'contr', r.contr); redibujar = true; }
  if (campo === 'dia' && !r.ok) { const v = ((DB.labores.reg || {})[key] || {})[k] || {}; if (r.dia) labSet(key, k, 'p', r.dia); else if (v.p === viejo.dia) labSet(key, k, 'p', ''); }
  if (campo === 'contr' || campo === 'impl' || campo === 'prod') labSet(key, k, campo, r[campo] || '');
  if (r.ok && campo === 'ha') labPgEjecutar(r, true);
  save(); renderEstadoEdicion(); labE.sucio = true;
  if (redibujar) labProgramacion();
}
// Ejecutada: realizada en la ficha con la fecha del día programado (o hoy) y el área (parcial si es menor que la de la suerte)
function labPgEjecutar(r, si){
  const key = r.key, k = r.lab, o = labSuertes().find(y => y.key === key);
  if (si) { labSet(key, k, 'tiene', 'si'); labSet(key, k, 'r', r.dia || labHoy());
    const area = o ? +o.x.area || 0 : 0;
    if (+r.ha > 0 && area && +r.ha < area - 0.005) { labSet(key, k, 'at', 'parcial'); labSet(key, k, 'ha', String(r.ha)); } else { labSet(key, k, 'at', ''); labSet(key, k, 'ha', ''); }
    if (r.contr) labSet(key, k, 'contr', r.contr); }
  else { labSet(key, k, 'tiene', ''); labSet(key, k, 'r', ''); labSet(key, k, 'at', ''); labSet(key, k, 'ha', ''); if (r.dia) labSet(key, k, 'p', r.dia); }
}
function labPgEventos(e){
  e.addEventListener('click', ev => { const t = ev.target;
    if (t.matches('[data-pg-cerrar]') || t.closest('.ms-x')) { labPgCerrar(); return; }
    const s = t.closest('[data-pg-sem]'); if (s) { const v = s.dataset.pgSem; labE.sem = v === 'hoy' ? labLunes(labHoy()) : labMas(labPgSemana(), +v); labE.pgOtro = {}; labE.sucio = true; labProgramacion(); return; }
    if (t.closest('[data-pg-xl]')) { labPgExcel(); return; }
    if (t.closest('[data-pg-imp]')) { labPgImprimir(); return; }
    if (!MODO_EDICION) return;
    const ok = t.closest('[data-pg-ok]');
    if (ok) { const L = labProg()[labPgSemana()] || [], r = L.find(x => x.id === ok.dataset.pgOk); if (!r) return;
      r.ok = !r.ok; if (!r.ok) delete r.ok; labPgEjecutar(r, !!r.ok); save(); renderEstadoEdicion(); labE.sucio = true; labProgramacion(); return; }
    const x = t.closest('[data-pg-x]');
    if (x) { const w = labPgSemana(), L = DB.labores.prog[w] || [], r = L.find(y => y.id === x.dataset.pgX); if (!r || !confirm(`¿Quitar ${r.s} de la programación de esta semana?`)) return;
      if (r.ok) labPgEjecutar(r, false);
      const v = ((DB.labores.reg || {})[r.key] || {})[r.lab] || {}; if (r.dia && v.p === r.dia) labSet(r.key, r.lab, 'p', '');
      DB.labores.prog[w] = L.filter(y => y !== r); if (!DB.labores.prog[w].length) delete DB.labores.prog[w]; if (!Object.keys(DB.labores.prog).length) delete DB.labores.prog;
      save(); renderEstadoEdicion(); labE.sucio = true; labProgramacion(); } });
  e.addEventListener('change', ev => { const d = ev.target.dataset.pg; if (!d) return; const [id, campo] = d.split('|'), v = ev.target.value.trim();
    if (campo === 'contr' && v === '__otro') { labE.pgOtro = labE.pgOtro || {}; labE.pgOtro[id] = true; labPgPoner(id, 'contr', '', true); return; }
    if (campo === 'contr') { (labE.pgOtro || {})[id] = false; }
    labPgPoner(id, campo, v, campo === 'contr' || campo === 'dia'); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && e.innerHTML) labPgCerrar(); });
}
function labPgFilas(){
  const w = labPgSemana(), porKey = new Map(labSuertes().map(o => [o.key, o]));
  return (labProg()[w] || []).map(r => { const o = porKey.get(r.key), Lb = LAB_LABORES.find(L => L.k === r.lab) || {};
    return {r, o, Lb, hac:msHacN(o ? o.x.hac : r.hac) || '', zona:o ? o.x.zona : r.z, dia:r.dia ? `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(r.dia + 'T00:00:00').getDay()]} ${msF(r.dia)}` : ''}; })
    .sort((a, b) => (a.r.dia || '9').localeCompare(b.r.dia || '9') || (a.Lb.n || '').localeCompare(b.Lb.n || ''));
}
function labPgExcel(){
  cargarXLSX().then(XLSX => { const w = labPgSemana(), F = labPgFilas();
    const filas = [['Programación semanal · Control labores campo'], [`Semana del ${msF(w)} al ${msF(labMas(w, 6))}`], [],
      ['Día', 'Suerte', 'Hacienda', 'Zona', 'Labor', 'Contratista', 'Implemento / producto', 'Área (ha)', 'Estado', 'Observación'],
      ...F.map(f => [f.dia, f.r.s, f.hac, f.zona ?? '', f.Lb.n || f.r.lab, f.r.contr || '', f.r.lab === 'fert' ? (f.r.prod || '') : (f.r.impl || ''), +(+f.r.ha || 0).toFixed(2), f.r.ok ? 'Ejecutada' : 'Programada', f.r.obs || '']),
      [], ['', '', '', '', 'Total', '', '', +sum(F, f => +f.r.ha || 0).toFixed(2)]];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, hoja(XLSX, filas), 'Semana');
    XLSX.writeFile(wb, `programacion-labores-${w}.xlsx`); });
}
function labPgImprimir(){
  const w = labPgSemana(), F = labPgFilas(), v = window.open('', '_blank'); if (!v) { toast('⚠ El navegador bloqueó la ventana de impresión'); return; }
  const porLab = {}; F.forEach(f => { const z = porLab[f.Lb.n || f.r.lab] = porLab[f.Lb.n || f.r.lab] || {ha:0, n:0}; z.ha += +f.r.ha || 0; z.n++; });
  v.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Programación semanal ${w}</title><style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#0f172a;margin:24px}h1{font-size:20px;margin:0}p{margin:4px 0 14px;color:#475569;font-size:13px}
    table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}th{background:#f1f5f9}td.n{text-align:right}
    .tot{margin-top:12px;font-size:12.5px}.firma{margin-top:28px;font-size:12px;color:#475569}@media print{body{margin:10mm}}</style></head><body>
    <h1>📅 Programación semanal · Control labores campo</h1><p>Riopaila Agrícola S.A. · Semana del ${msF(w)} al ${msF(labMas(w, 6))} · ${F.length} suertes · ${msN(sum(F, f => +f.r.ha || 0), 1)} ha</p>
    <table><thead><tr><th>Día</th><th>Suerte</th><th>Hacienda</th><th>Labor</th><th>Contratista</th><th>Implemento / producto</th><th>Área (ha)</th><th>Estado</th><th>Observación</th></tr></thead><tbody>
    ${F.map(f => `<tr><td>${esc(f.dia)}</td><td><b>${esc(f.r.s)}</b></td><td>${esc(f.hac)}</td><td>${esc(f.Lb.n || f.r.lab)}</td><td>${esc(f.r.contr || '')}</td><td>${esc(f.r.lab === 'fert' ? f.r.prod || '' : f.r.impl || '')}</td><td class="n">${msN(f.r.ha, 2)}</td><td>${f.r.ok ? 'Ejecutada' : 'Programada'}</td><td>${esc(f.r.obs || '')}</td></tr>`).join('')}</tbody></table>
    <div class="tot">${Object.entries(porLab).map(([n, z]) => `<b>${esc(n)}:</b> ${msN(z.ha, 1)} ha (${z.n} suertes)`).join(' &nbsp;·&nbsp; ')}</div>
    <div class="firma">Elaborado por: Luis Acosta · Especialista de Ingeniería Agrícola y Operaciones Campo</div>
    <script>setTimeout(() => print(), 300)<\/script></body></html>`);
  v.document.close();
}

// ── 📊 Indicadores: gráficos de las suertes de la tabla (con los filtros de zona, hacienda y búsqueda) ──
// Colores: estados con la paleta de estado (verde realizada, rojo pendiente, gris sin dato); contratistas y labores con
// los puestos de la paleta categórica validada, siempre en el mismo orden (el color sigue al contratista, no a su puesto).
const LAB_IND_EST = [['hecha', 'Realizada', '#0ca30c'], ['pend', 'Pendiente', '#d03b3b'], ['sin', 'Sin dato', '#a3aab5']];
const LAB_CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const LAB_GRIS = '#64748b', LAB_SIN = '#cbd5e1';
const labColorContr = n => n === 'Sin anotar' ? LAB_SIN : LAB_CONTR.includes(n) ? LAB_CAT[LAB_CONTR.indexOf(n)] : LAB_GRIS;
function labIndDatos(){
  const t = norm(labE.txt);
  const A = labSuertes().filter(o => (!labE.zona || String(o.x.zona) === labE.zona) && (!labE.hac || o.x.hac === labE.hac)
    && (!t || norm(`${o.x.s} ${o.x.hac} ${o.x.variedad || ''} ${o.x.zonaAgro || ''}`).includes(t)));
  const suma = (m, k, v) => { m[k] = (m[k] || 0) + v; };
  const impl = {}, prod = {}, hac = {};
  const por = LAB_LABORES.map(Lb => { const d = {Lb, hecha:0, pend:0, sin:0, nH:0, nP:0, nS:0, contr:{}};
    A.forEach(o => { const e = labEstado(o, Lb).e, x = o.reg[Lb.k] || {};
      if (e === 'hecha') { const h = labHaReal(o, x); d.hecha += h; d.nH++;
        suma(d.contr, !x.contr ? 'Sin anotar' : LAB_CONTR.includes(x.contr) ? x.contr : 'Otros', h);
        if (Lb.k !== 'fert') suma(impl, x.impl || 'Sin anotar', h); else suma(prod, x.prod || 'Sin anotar', h); }
      else if (e === 'sindato') { d.sin += o.x.area || 0; d.nS++; }
      else if (labPorHacer(e)) { const h = labHa(o, Lb); d.pend += h; d.nP++; const z = hac[o.x.hac || '—'] = hac[o.x.hac || '—'] || {}; suma(z, Lb.k, h); } });
    return d; });
  return {A, por, impl, prod, hac};
}
// Dona en SVG: items [{n, v, c}]; cada pedazo con su globo
function labDona(items, centro, sub){
  const R = 40, C = 2 * Math.PI * R, I = items.filter(i => i.v > 0), tot = sum(I, i => i.v) || 1, gap = I.length > 1 ? 1.6 : 0;
  let off = 0;
  const segs = I.map(i => { const len = i.v / tot * C, s = `<circle r="${R}" cx="50" cy="50" fill="none" stroke="${i.c}" stroke-width="15" stroke-dasharray="${Math.max(len - gap, 0.01)} ${C}" stroke-dashoffset="${-off}" data-tip="${esc(`${i.n}: ${msN(i.v, 1)} ha · ${msN(i.v / tot * 100, 0)}%`)}"/>`; off += len; return s; }).join('');
  return `<svg viewBox="0 0 100 100" class="li-dona" role="img" aria-label="${esc(sub)}"><g transform="rotate(-90 50 50)"><circle r="${R}" cx="50" cy="50" fill="none" stroke="#f1f5f9" stroke-width="15"/>${segs}</g>
    <text x="50" y="50" text-anchor="middle" class="li-dona-v">${centro}</text><text x="50" y="62" text-anchor="middle" class="li-dona-s">${esc(sub)}</text></svg>`;
}
const labLeyenda = items => `<div class="li-ley">${items.map(i => `<span><i style="background:${i.c}"></i>${esc(i.n)}${i.v != null ? ` <b>${msN(i.v, 1)} ha</b>` : ''}</span>`).join('')}</div>`;
// Barra horizontal apilada: segmentos [{n, v, c}], largo proporcional a max
const labBarra = (segs, max, etiqueta) => { const tot = sum(segs, s => s.v);
  return `<div class="li-fila"><span class="li-fila-n" title="${esc(etiqueta)}">${esc(etiqueta)}</span><div class="li-pista"><div class="li-hbar" style="width:${max ? tot / max * 100 : 0}%">${segs.filter(s => s.v > 0).map(s =>
    `<i style="flex:${s.v};background:${s.c}" data-tip="${esc(`${etiqueta} · ${s.n}: ${msN(s.v, 1)} ha (${msN(s.v / tot * 100, 0)}%)`)}"></i>`).join('')}</div></div><span class="li-fila-v">${msN(tot, 1)}</span></div>`; };
function labIndicadores(){
  const el = (() => { let e = document.getElementById('lab-ind'); if (!e) { e = document.createElement('div'); e.id = 'lab-ind'; document.body.appendChild(e); labIndEventos(e); } return e; })();
  const D = labIndDatos(), haT = sum(D.A, o => o.x.area || 0);
  const filtros = [labE.zona ? `Zona ${labE.zona}` : '', labE.hac ? msHacN(labE.hac) : '', labE.txt ? `«${labE.txt}»` : ''].filter(Boolean).join(' · ') || 'Todas las suertes';
  // Recuadros: % del área realizada por labor
  const tiles = D.por.map(d => { const tot = d.hecha + d.pend + d.sin, p = tot ? d.hecha / tot * 100 : 0;
    return `<div class="li-tile" style="--c:${d.Lb.col}"><span class="li-tile-t">${d.Lb.ico} ${d.Lb.n}</span><b>${msN(p, 0)}%</b><small>${msN(d.hecha, 1)} de ${msN(tot, 1)} ha realizadas</small></div>`; }).join('');
  // 1. Área por labor: realizada / pendiente / sin dato
  const maxL = Math.max(...D.por.map(d => d.hecha + d.pend + d.sin), 0);
  const g1 = D.por.map(d => labBarra(LAB_IND_EST.map(([k, n, c]) => ({n, v:d[k], c})), maxL, d.Lb.n)).join('');
  // 2. Participación por contratista (ha realizadas), una dona por labor
  // Las donas muestran solo lo anotado en las fichas; lo realizado sin anotar va en una nota debajo
  const nota = v => v > 0.005 ? `<div class="li-nota">+ ${msN(v, 1)} ha realizadas sin anotar en la ficha</div>` : '';
  const nombresC = [...LAB_CONTR, 'Otros'];
  const g2 = D.por.map(d => { const I = nombresC.map(n => ({n, v:d.contr[n] || 0, c:labColorContr(n)})), an = sum(I, i => i.v);
    return `<div class="li-dona-c"><div class="li-sub">${d.Lb.ico} ${d.Lb.n}</div>${an ? labDona(I, msN(an, 1), 'ha anotadas') : `<div class="li-vacio">${d.hecha ? 'Sin contratistas anotados' : 'Sin labores realizadas'}</div>`}${nota(d.contr['Sin anotar'] || 0)}</div>`; }).join('');
  const usadosC = nombresC.filter(n => D.por.some(d => d.contr[n]));
  // 3. Implemento (roturaciones realizadas) y 4. productos de fertilización (orden por hectáreas; Subesca y Triple con color fijo)
  const lista = (M, color) => Object.entries(M).filter(([n]) => n !== 'Sin anotar').sort((a, b) => b[1] - a[1]).map(([n, v], i) => ({n, v, c:color(n, i)}));
  const Im = lista(D.impl, (n, i) => LAB_IMPL.includes(n) ? LAB_CAT[LAB_IMPL.indexOf(n)] : LAB_GRIS), Pr = lista(D.prod, (n, i) => LAB_CAT[i] || LAB_GRIS);
  const donaL = (I, M, vacio) => I.length ? `<div class="li-dona-l">${labDona(I, msN(sum(I, i => i.v), 1), 'ha anotadas')}${labLeyenda(I)}</div>${nota(M['Sin anotar'] || 0)}` : `<div class="li-vacio">${vacio}</div>${nota(M['Sin anotar'] || 0)}`;
  // 5. Pendiente por hacienda (apilado por labor)
  const H = Object.entries(D.hac).map(([h, z]) => ({h, z, t:sum(Object.values(z), v => v)})).sort((a, b) => b.t - a.t), maxH = H.length ? H[0].t : 0;
  const g5 = H.slice(0, 14).map(r => labBarra(LAB_LABORES.map(Lb => ({n:Lb.n, v:r.z[Lb.k] || 0, c:Lb.col})), maxH, msHacN(r.h) || r.h)).join('');
  const tarjeta = (tit, sub, cuerpo, ancho) => `<section class="li-card${ancho ? ' li-ancha' : ''}"><h3>${tit}</h3>${sub ? `<p class="li-p">${sub}</p>` : ''}${cuerpo}</section>`;
  el.innerHTML = `<div class="ms-fondo li-fondo" data-li-cerrar><div class="ms-ficha li-modal" role="dialog" aria-label="Indicadores del control de labores">
    <div class="ms-fh"><div><b>📊 Indicadores · Control labores campo</b><small>${esc(filtros)} · ${D.A.length} suertes · ${msN(haT, 1)} ha</small></div><button type="button" class="ms-x" data-li-cerrar title="Cerrar (Esc)">✕</button></div>
    <div class="ms-cuerpo">
      <div class="li-tiles">${tiles}</div>
      <div class="li-grid">
        ${tarjeta('Área realizada vs pendiente por labor', 'Hectáreas · pasa el mouse (o toca) cada color para ver el detalle', `${labLeyenda(LAB_IND_EST.map(([, n, c]) => ({n, c})))}${g1}`, true)}
        ${tarjeta('Participación por contratista', 'Hectáreas realizadas por contratista en cada labor (lo anotado en la ficha 📝)', `${usadosC.length ? labLeyenda(usadosC.map(n => ({n, c:labColorContr(n)}))) : ''}<div class="li-donas">${g2}</div>`, true)}
        ${tarjeta('Implemento en roturación', 'Hectáreas de roturación realizadas (1ra y 2da) por implemento', donaL(Im, D.impl, 'Aún no hay implementos anotados'))}
        ${tarjeta('Productos de fertilización', 'Hectáreas fertilizadas por producto o mezcla', donaL(Pr, D.prod, 'Aún no hay productos anotados'))}
        ${tarjeta('Área pendiente por hacienda', `Hectáreas pendientes por labor${H.length > 14 ? ` · las 14 haciendas con más área (de ${H.length})` : ''}`, H.length ? `${labLeyenda(LAB_LABORES.map(Lb => ({n:Lb.n, c:Lb.col})))}${g5}` : '<div class="li-vacio">Nada pendiente ✓</div>', true)}
      </div>
      <div class="li-tip" hidden></div>
    </div></div></div>`;
}
function labIndCerrar(){ const e = document.getElementById('lab-ind'); if (e) e.innerHTML = ''; }
// Globo de los gráficos: con el mouse sigue el puntero; en el celular aparece al tocar
function labIndEventos(e){
  const tip = () => e.querySelector('.li-tip');
  const mostrar = ev => { const m = ev.target.closest && ev.target.closest('[data-tip]'), T = tip(); if (!T) return;
    if (!m) { T.hidden = true; return; }
    T.textContent = m.dataset.tip; T.hidden = false;
    const w = T.offsetWidth, x = Math.min(ev.clientX + 12, innerWidth - w - 8), y = ev.clientY - T.offsetHeight - 10;
    T.style.left = Math.max(8, x) + 'px'; T.style.top = (y < 8 ? ev.clientY + 16 : y) + 'px'; };
  e.addEventListener('pointermove', mostrar); e.addEventListener('pointerdown', mostrar);
  e.addEventListener('pointerleave', () => { const T = tip(); if (T) T.hidden = true; });
  e.addEventListener('click', ev => { if (ev.target.matches('[data-li-cerrar]') || ev.target.closest('.ms-x')) labIndCerrar(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && e.innerHTML) labIndCerrar(); });
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
