// Importa el libro semanal de Excel: hojas COMITE APS, RUTA DE SIEMBRA y
// RUTA SEMANA PASADA. Las columnas se reconocen por nombre (sin tildes ni
// mayúsculas), así que el orden en la hoja no importa.

function norm(t){
  return String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
}
function num(v){
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v ?? '').replace(/\s/g,'').replace(',', '.'));
  return isNaN(n) ? null : n;
}
function txt(v){ const t = String(v ?? '').trim(); return t || null; }

// Para cada campo: lista de patrones (sobre el encabezado normalizado).
// Se toma la primera columna que cumpla alguno; el orden de los patrones importa.
const COLS = {
  // En el libro real: "sect-sue" trae la suerte completa (3110-050); "Suerte" solo el número.
  // No hay columna Estado: sembrada = "Área Siemb" con hectáreas (pendiente = "X")
  // u OBSERVACIÓN "SEMBRADA".
  lotes: {
    s:[/^SECT SUE$/,/SECT.*SUE/,/SUERTE/], h:[/HACIENDA/], z:[/^ZONA$/], a:[/AREA APS/,/^AREA/,/^HA$/],
    c:[/CULTIVO/], d:[/DIAS? (DE )?LUCRO/,/LUCRO/,/^DIAS$/], e:[/^ESTADO$/],
    siemb:[/AREA SIEMB/], obsE:[/^OBSERVACION$/],
    p:[/PPTO/,/PRESUPUESTO/], v:[/VARIEDAD/],
  },
  ruta: {
    h:[/HACIENDA/], s:[/SECT.*SUE/,/SUERTE/], a:[/AREA APS/,/^AREA/], d:[/LUCRO/,/^DIAS$/], variedad:[/VARIEDAD/],
    semillero:[/SEMILLERO/], bandereo:[/BANDEREO/], cont:[/CONTRATISTA/,/^CONT/],
  },
  proceso: {
    hac:[/HACIENDA/], z:[/^ZONA$/], sue:[/SECT.*SUE/,/SUERTE/], area:[/AREA APS/,/^AREA/], dias:[/LUCRO/,/^DIAS$/],
    cont:[/CONTRATISTA/,/^CONT/], labor:[/^LABOR$/], obs:[/OBSERVACION/,/^OBS/], variedad:[/VARIEDAD/],
  },
};
const REQUERIDAS = { lotes:['s','h','a'], ruta:['h','s','a'], proceso:['hac','sue','area','labor'] };
// Campos auxiliares que no se muestran como columnas en la vista previa
const AUXILIARES = new Set(['siemb','obsE']);
const HOJAS = {
  lotes:   { nombres:[/COMITE APS/,/COMITE/], filaPreferida:4 },  // header en fila 5
  ruta:    { nombres:[/RUTA DE SIEMBRA/,/^RUTA SIEMBRA/] },
  proceso: { nombres:[/RUTA SEMANA PASADA/,/SEMANA PASADA/] },
};
const NOMBRE_CAMPO = {
  s:'Suerte',h:'Hacienda',z:'Zona',a:'Área',c:'Cultivo',d:'Días lucro',e:'Estado',p:'Ppto',v:'Variedad',
  variedad:'Variedad',semillero:'Semillero',bandereo:'Bandereo',cont:'Contratista',
  hac:'Hacienda',sue:'Suerte',area:'Área',dias:'Días lucro',labor:'Labor',obs:'Observación',
};

function buscarHoja(wb, tipo){
  const pats = HOJAS[tipo].nombres;
  for (const p of pats) {
    const n = wb.SheetNames.find(sn => p.test(norm(sn)));
    if (n) return n;
  }
  return null;
}

function mapearColumnas(headerRow, tipo){
  const heads = headerRow.map(norm), map = {};
  const usadas = new Set();
  for (const [campo, pats] of Object.entries(COLS[tipo])) {
    outer: for (const p of pats) {
      for (let i = 0; i < heads.length; i++) {
        if (!usadas.has(i) && heads[i] && p.test(heads[i])) { map[campo] = i; usadas.add(i); break outer; }
      }
    }
  }
  return map;
}

// Busca la fila de encabezados: la preferida si sirve, si no la que más columnas reconozca.
function detectarEncabezado(rows, tipo){
  const req = REQUERIDAS[tipo], pref = HOJAS[tipo].filaPreferida;
  const ok = i => rows[i] && req.every(c => c in mapearColumnas(rows[i], tipo));
  if (pref != null && ok(pref)) return pref;
  let best = -1, bestN = 0;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    if (!rows[i]) continue;
    const n = Object.keys(mapearColumnas(rows[i], tipo)).length;
    if (n > bestN && ok(i)) { best = i; bestN = n; }
  }
  return best;
}

function convertirFila(tipo, get){
  if (tipo === 'lotes') {
    const s = txt(get('s')), h = txt(get('h')), a = num(get('a'));
    if (!s || !h || !a) return null;
    const hac = h.toUpperCase(), zona = num(get('z'));
    const sembrada = /SEMBR/.test(norm(get('e'))) || num(get('siemb')) > 0 || /SEMBR/.test(norm(get('obsE')));
    return {
      s: s.toUpperCase(), h: hac,
      z: zona === 1 || zona === 2 ? zona : zonaDe(hac),
      a: +a.toFixed(2),
      c: /ARROZ/.test(norm(get('c'))) ? 'ARROZ' : 'CAÑA',
      d: Math.round(num(get('d')) || 0),
      e: sembrada ? 'SEMBRADA' : 'PENDIENTE',
      p: /^(SI|S|X|1)$/.test(norm(get('p'))) ? 'SI' : 'NO',
      v: txt(get('v')) ? txt(get('v')).toUpperCase() : 'SIN DATO',
    };
  }
  if (tipo === 'ruta') {
    const s = txt(get('s')), h = txt(get('h')), a = num(get('a'));
    if (!s || !h || !a) return null;
    return {
      h: h.toUpperCase(), s: s.toUpperCase(), a: +a.toFixed(2), d: Math.round(num(get('d')) || 0),
      variedad: txt(get('variedad')), semillero: txt(get('semillero')),
      bandereo: num(get('bandereo')), cont: txt(get('cont')) || contratistaDefecto(),
    };
  }
  const sue = txt(get('sue')), hac = txt(get('hac')), area = num(get('area')), labor = txt(get('labor'));
  if (!sue || !hac || !area || !labor) return null;
  const H = hac.toUpperCase(), zona = num(get('z'));
  return {
    hac: H, z: zona === 1 || zona === 2 ? zona : zonaDe(H), sue: sue.toUpperCase(),
    area: +area.toFixed(2), dias: Math.round(num(get('dias')) || 0),
    cont: txt(get('cont')) || '—',
    labor: norm(labor).split(' ')[0],   // una sola labor por suerte
    obs: txt(get('obs')), variedad: txt(get('variedad')),
  };
}

function leerHoja(XLSX, wb, tipo){
  const nombre = buscarHoja(wb, tipo);
  const res = { tipo, hoja: nombre, filas: [], columnas: {}, faltan: [], fila: null };
  if (!nombre) return res;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header:1, defval:'', raw:true });
  const hi = detectarEncabezado(rows, tipo);
  if (hi < 0) { res.faltan = REQUERIDAS[tipo]; return res; }
  res.fila = hi + 1;
  const map = mapearColumnas(rows[hi], tipo);
  res.columnas = map;
  res.faltan = REQUERIDAS[tipo].filter(c => !(c in map));
  // Estado deducido de "Área Siemb" / OBSERVACIÓN cuando no hay columna Estado
  res.estadoDerivado = tipo === 'lotes' && !('e' in map) && ('siemb' in map || 'obsE' in map);
  if (tipo === 'lotes' && !('e' in map) && !res.estadoDerivado) res.faltan.push('e');
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i];
    const get = campo => campo in map ? r[map[campo]] : '';
    // Filas de total/subtotal no son suertes
    if (r.some(v => /^(SUB)?TOTAL/.test(norm(v)))) continue;
    const o = convertirFila(tipo, get);
    if (o) res.filas.push(o);
  }
  return res;
}

// Fecha serial de Excel → "30 Sep 2026"
const MES_CORTO = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fechaExcel(serial){
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  return { texto: `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()]} ${d.getUTCFullYear()}`, fecha: d };
}
function semanaISO(d){
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

// RESUMEN: fecha de corte (celda de fecha junto a "DASHBOARD") y ppto total
// (columna "PPTO A …" en la fila TOTAL).
function leerResumen(XLSX, wb){
  const n = wb.SheetNames.find(s => norm(s) === 'RESUMEN'); if (!n) return {};
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header:1, defval:'', raw:true });
  const out = {};
  const serial = (rows[0] || []).find(v => typeof v === 'number' && v > 40000 && v < 60000);
  if (serial) { const f = fechaExcel(serial); out.fecha = f.texto; out.semana = 'Semana ' + semanaISO(f.fecha); }
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const col = rows[i].findIndex(v => /^PPTO\b/.test(norm(v)));
    if (col < 0) continue;
    const tot = rows.slice(i + 1).find(r => r.some(v => norm(v) === 'TOTAL'));
    if (tot && num(tot[col]) > 0) out.pptoTotal = +num(tot[col]).toFixed(2);
    break;
  }
  return out;
}

// PANEL CONTROL: tabla "Concepto | $/ha Real | $/ha Ppto | … | Costo Total $"
function leerCostos(XLSX, wb){
  const n = wb.SheetNames.find(s => norm(s) === 'PANEL CONTROL'); if (!n) return null;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header:1, defval:'', raw:true });
  const hi = rows.findIndex(r => r.some(v => norm(v) === 'CONCEPTO') && r.some(v => /HA REAL/.test(norm(v))));
  if (hi < 0) return null;
  const H = rows[hi].map(norm);
  const ci = H.indexOf('CONCEPTO'), ri = H.findIndex(h => /HA REAL/.test(h)),
        pi = H.findIndex(h => /HA PPTO/.test(h)), ti = H.findIndex(h => /COSTO TOTAL/.test(h));
  const costos = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const c = txt(rows[i][ci]);
    if (!c || /^NOTA/.test(norm(c))) break;
    if (norm(c) === 'TOTAL') continue;
    costos.push({ concepto: c, real: num(rows[i][ri]) || 0, ppto: pi >= 0 ? num(rows[i][pi]) : null, total: ti >= 0 ? (num(rows[i][ti]) || 0) : 0 });
  }
  return costos.length ? costos : null;
}

// "30092026 - Comite APS.xlsm" / "8092026 - Comite APS.xlsm" → fecha de corte.
// Es más confiable que la fecha de RESUMEN, que es una fórmula de "hoy".
function fechaDeNombre(nombre){
  const m = String(nombre).match(/^(\d{1,2})(\d{2})(\d{4})\b/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  if (d.getUTCMonth() !== +m[2] - 1) return null;
  return { fecha: `${d.getUTCDate()} ${MES_CORTO[d.getUTCMonth()]} ${d.getUTCFullYear()}`, semana: 'Semana ' + semanaISO(d) };
}

let IMPORT_PENDIENTE = null;

function leerLibro(file){
  return cargarXLSX().then(XLSX => file.arrayBuffer().then(buf => {
    const wb = XLSX.read(buf, { type:'array' });
    return {
      archivo: file.name,
      hojas: wb.SheetNames,
      lotes: leerHoja(XLSX, wb, 'lotes'),
      ruta: leerHoja(XLSX, wb, 'ruta'),
      proceso: leerHoja(XLSX, wb, 'proceso'),
      resumen: Object.assign(leerResumen(XLSX, wb), fechaDeNombre(file.name) || {}),
      costos: leerCostos(XLSX, wb),
    };
  }));
}

function aplicarImport(opts){
  const imp = IMPORT_PENDIENTE; if (!imp) return;
  // Semana nueva: las labores actuales pasan a ser la "semana anterior" del comparativo
  if (opts.proceso && imp.proceso.filas.length && opts.semana && opts.semana !== DB.meta.semana) {
    DB.procesoAnterior = { fecha: DB.meta.fecha, semana: DB.meta.semana, items: DB.proceso };
  }
  ['lotes','ruta','proceso'].forEach(t => {
    if (opts[t] && imp[t].filas.length) DB[t] = imp[t].filas;
  });
  if (opts.costos && imp.costos) DB.costos = imp.costos;
  if (opts.costos && imp.resumen.pptoTotal) DB.meta.pptoTotal = imp.resumen.pptoTotal;
  if (opts.fecha) DB.meta.fecha = opts.fecha;
  if (opts.semana) DB.meta.semana = opts.semana;
  IMPORT_PENDIENTE = null;
  save();
}
