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
  lotes: {
    s:[/SUERTE/], h:[/HACIENDA/], z:[/^ZONA$/,/ZONA/], a:[/AREA APS/,/AREA/,/^HA$/],
    c:[/CULTIVO/], d:[/DIAS? (DE )?LUCRO/,/LUCRO/,/^DIAS$/], e:[/ESTADO/],
    p:[/PPTO/,/PRESUPUESTO/], v:[/VARIEDAD/],
  },
  ruta: {
    h:[/HACIENDA/], s:[/SUERTE/], a:[/AREA/], d:[/LUCRO/,/^DIAS$/], variedad:[/VARIEDAD/],
    semillero:[/SEMILLERO/], bandereo:[/BANDEREO/], cont:[/CONTRATISTA/,/^CONT/],
  },
  proceso: {
    hac:[/HACIENDA/], z:[/^ZONA$/,/ZONA/], sue:[/SUERTE/], area:[/AREA/], dias:[/LUCRO/,/^DIAS$/],
    cont:[/CONTRATISTA/,/^CONT/], labor:[/^LABOR$/,/LABOR/], obs:[/OBSERVACION/,/^OBS/], variedad:[/VARIEDAD/],
  },
};
const REQUERIDAS = { lotes:['s','h','a','e'], ruta:['h','s','a'], proceso:['hac','sue','area','labor'] };
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
    const hac = h.toUpperCase(), est = norm(get('e'));
    const zona = num(get('z'));
    return {
      s: s.toUpperCase(), h: hac,
      z: zona === 1 || zona === 2 ? zona : zonaDe(hac),
      a: +a.toFixed(2),
      c: /ARROZ/.test(norm(get('c'))) ? 'ARROZ' : 'CAÑA',
      d: Math.round(num(get('d')) || 0),
      e: /SEMBR/.test(est) ? 'SEMBRADA' : 'PENDIENTE',
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
      bandereo: num(get('bandereo')), cont: txt(get('cont')),
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
    };
  }));
}

function aplicarImport(opts){
  const imp = IMPORT_PENDIENTE; if (!imp) return;
  ['lotes','ruta','proceso'].forEach(t => {
    if (opts[t] && imp[t].filas.length) DB[t] = imp[t].filas;
  });
  if (opts.fecha) DB.meta.fecha = opts.fecha;
  if (opts.semana) DB.meta.semana = opts.semana;
  IMPORT_PENDIENTE = null;
  save();
}
