// Maestro de suertes (#maestro, vista 'maes'): versión digital y didáctica de la hoja MAESTRO del
// "Maestro Suertes ….xlsx" (Documents\COMITE APS\MAESTRO). El editor carga el Excel (o lo trae el servidor) y
// ese pasa a ser el maestro de toda la plataforma: también alimenta días de lucro, "Agregar suerte" y Agronomía.
// Se publica solo lo agronómico (DB.maestroSuertes {archivo, fecha, cols[], filas[][]}); nunca nombres de personas,
// tipo de negociación, kilos, precios ni ingresos.

const MS_COLS = ['s', 'emp', 'zona', 'hac', 'uso', 'estado', 'variedad', 'area', 'siembra', 'ultCorte', 'nCorte', 'ciclo', 'edad', 'edadStd',
  'proxPpto', 'proxEst', 'tchPpto', 'tchAforo', 'tonPpto', 'tonEst', 'tipoFinca', 'zonaAgro', 'lucro', 'rangoEdad', 'sector', 'quema'];
const MS_PAL = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#16a34a', '#db2777', '#0891b2', '#65a30d', '#9333ea', '#ea580c', '#475569'];
const msE = {emp:'RIOP', zona:'', hac:'', uso:'', estado:'', variedad:'', txt:'', color:'variedad', orden:'s', asc:true, mas:false, ficha:null, med:{modo:null, figs:[], cur:null},
  capas:{red:true, agua:true, canales:true, drensec:true, vias:true, surcos:true},
  gps:{on:false, id:null, pos:null, acc:null, centrado:false},
  fondo:(() => { try { return localStorage.getItem('comite-aps:ms-fondo') || 'no'; } catch (e) { return 'no'; } })()};
// Capas del mapa del maestro (MAPA_FREATICO): [clave, nombre, color de la muestra, ayuda]
const MS_CAPAS = [
  ['red', 'Ríos y quebradas', '#2b7bd6', 'Red hídrica (ríos, quebradas, zanjones y acequias)'],
  ['agua', 'Cuerpos de agua', '#8ec5f5', 'Reservorios y lagos'],
  ['canales', 'Canales de riego y drenaje', '#dc2626', 'Canales de riego y drenaje'],
  ['drensec', 'Drenaje secundario', '#0891b2', 'Drenajes secundarios (línea punteada)'],
  ['vias', 'Vías', '#111827', 'Vías de acceso y vías principales'],
  ['surcos', 'Sentido de surco', '#0c4a6e', 'Flechas: hacia dónde corre el agua en cada suerte'],
];

function maestroSuertes(){
  if (DB.maestroSuertes === undefined && typeof SEED !== 'undefined' && SEED.maestroSuertes) DB.maestroSuertes = clone(SEED.maestroSuertes);
  return DB.maestroSuertes || null;
}
let MSF = null;   // filas como objetos (se arma una vez por maestro)
function msFilas(){
  const M = maestroSuertes(); if (!M) return [];
  if (MSF && MSF.de === M) return MSF.L;
  const L = M.filas.map(r => { const o = {}; M.cols.forEach((c, i) => o[c] = r[i]); return o; });
  MSF = {de:M, L}; return L;
}

// ── Lectura del Excel (hoja MAESTRO, encabezado en la fila que empieza con SUERTE) ──
function msLeer(XLSX, buf, nombre){
  const wb = XLSX.read(buf, {type:'array'});
  const hoja = wb.SheetNames.find(n => norm(n) === 'MAESTRO');
  if (!hoja) throw new Error('El archivo no tiene una hoja llamada «MAESTRO».');
  const R = XLSX.utils.sheet_to_json(wb.Sheets[hoja], {header:1, defval:'', raw:true});
  const hi = R.findIndex(r => norm(r[0]) === 'SUERTE'); if (hi < 0) throw new Error('No encontré el encabezado «SUERTE» en la hoja MAESTRO.');
  const H = R[hi].map(h => norm(String(h).replace(/\s+/g, ' ')));
  // Primera columna cuyo título cumple (los repetidos, ej. ZONA o Hacienda, toman la primera)
  const c1 = re => H.findIndex(h => re.test(h));
  const C = {s:0, emp:c1(/^EMPRESA PLANTA$/), emp2:c1(/^EMPRESA$/), zona:c1(/^ZONA$/), hac:c1(/^HACIENDA$/), finca:c1(/^FINCA$/), uso:c1(/^USO DE LA SUERTE/), estado:c1(/^ESTADO$/),
    variedad:c1(/^VARIEDAD$/), area:c1(/^AREA NETA/), siembra:c1(/^FECHA DE SIEMBRA/), ultCorte:c1(/^FECHA DE ULTIMO CORTE/), nCorte:c1(/^NUMERO DE CORTE/), ciclo:c1(/^CICLO DE VIDA/),
    edad:c1(/^EDAD HOY/), edadStd:c1(/^EDAD ESTANDAR/), proxPpto:c1(/^FECHA PROXIMO CORTE PPTO/), proxEst:c1(/^F\. ?ESTIM PROX CORTE/), proxDef:c1(/^FECHA DEL PROXIMO CORTE/),
    tchPpto:c1(/^TCH PPTO/), tchAforo:c1(/^TCH AFORO$/), tchAforo2:c1(/^TCH AFORO \(CAMPO\)/), tonPpto:c1(/^TONELADAS PPTO/), tonEst:c1(/^TONELADAS ESTIMADAS/), tipoFinca:c1(/^TIPO FINCA/),
    zonaAgro:c1(/^ZONA AGROECOLOGICA/), lucro:c1(/^DIAS +LUCRO CESANTE/), rangoEdad:c1(/^RANGO EDADES/), sector:c1(/^SECTOR$/), quema:c1(/^TIPO DE RESTRICCION DE QUEMA/)};
  const iso = v => { if (typeof v === 'number' && v > 20000 && v < 80000) { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : ''; }
    const m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(String(v).trim()); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
  const num = (v, d = 2) => { const x = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return isFinite(x) ? +x.toFixed(d) : null; };
  const txt = v => String(v ?? '').trim();
  const g = (r, k) => C[k] >= 0 ? r[C[k]] : '';
  const filas = [];
  for (let i = hi + 1; i < R.length; i++) {
    const r = R[i], s = codigoSuerte(txt(r[0])); if (!/^\d{4}-\d{3}$/.test(s)) continue;
    const o = {s, emp:txt(g(r, 'emp')) || txt(g(r, 'emp2')), zona:txt(g(r, 'zona')), hac:txt(g(r, 'hac')) || txt(g(r, 'finca')), uso:txt(g(r, 'uso')), estado:txt(g(r, 'estado')),
      variedad:txt(g(r, 'variedad')), area:num(g(r, 'area')), siembra:iso(g(r, 'siembra')), ultCorte:iso(g(r, 'ultCorte')), nCorte:num(g(r, 'nCorte'), 0), ciclo:num(g(r, 'ciclo'), 0),
      edad:num(g(r, 'edad'), 1), edadStd:num(g(r, 'edadStd'), 1), proxPpto:iso(g(r, 'proxPpto')), proxEst:iso(g(r, 'proxEst')) || iso(g(r, 'proxDef')),
      tchPpto:num(g(r, 'tchPpto'), 1), tchAforo:num(g(r, 'tchAforo'), 1) ?? num(g(r, 'tchAforo2'), 1), tonPpto:num(g(r, 'tonPpto'), 0), tonEst:num(g(r, 'tonEst'), 0),
      tipoFinca:txt(g(r, 'tipoFinca')), zonaAgro:txt(g(r, 'zonaAgro')), lucro:num(g(r, 'lucro'), 0), rangoEdad:txt(g(r, 'rangoEdad')), sector:txt(g(r, 'sector')), quema:txt(g(r, 'quema'))};
    if (/^(0|true|false)$/i.test(o.rangoEdad)) o.rangoEdad = '';
    filas.push(MS_COLS.map(c => o[c] === '' ? null : o[c]));
  }
  if (!filas.length) throw new Error('La hoja MAESTRO no trae suertes.');
  // Fecha del maestro: la celda bajo el título (ej. "18 de Octubre de 2026") o la del nombre del archivo
  let fecha = '';
  for (let i = 0; i < Math.min(hi, 6) && !fecha; i++) for (const v of R[i]) { const m = /(\d{1,2}) de ([a-záéíóú]+) de (\d{4})/i.exec(String(v)); if (m) { fecha = `${m[1]} de ${m[2].toLowerCase()} de ${m[3]}`; break; } }
  return {archivo:nombre, fecha, cols:MS_COLS, filas};
}
// Aplica un maestro nuevo: se publica (DB.maestroSuertes) y alimenta el resto de la plataforma
function msAplicar(XLSX, buf, nombre){
  const M = msLeer(XLSX, buf, nombre);
  try { guardarMaestroLocal(leerMaestro(XLSX, buf), nombre); } catch (e) { console.warn(e); }
  modCambio(() => { DB.maestroSuertes = M; });
  MSF = null;
  const cambio = typeof syncMaestroLotes === 'function' && syncMaestroLotes();
  toast(`📚 Maestro cargado: ${M.filas.length} suertes${M.fecha ? ` (${M.fecha})` : ''}${cambio ? ' · días de lucro actualizados' : ''} · recuerda 🚀 Publicar`);
}
function msCargarArchivo(file){
  if (!file) return;
  toast(`⏳ Leyendo ${file.name}…`);
  Promise.all([cargarXLSX(), file.arrayBuffer()]).then(([X, buf]) => msAplicar(X, buf, file.name)).catch(e => toast('⚠ ' + (e.message || e)));
}
// Trae el más reciente de Documents\COMITE APS\MAESTRO (servidor de este PC)
let msRevisado = false;
function msDesdeServidor(forzar){
  const H = {cache:'no-store', headers:{'X-Comite':'1'}};
  return fetch(API_BASE + 'api/maestro?info=1', H).then(r => r.ok ? r.json() : null).then(info => {
    if (!info || !info.ok) throw new Error('sin servidor');
    const M = maestroSuertes();
    if (!forzar && M && M.archivo === info.archivo) return false;
    toast(`⏳ Leyendo ${info.archivo}…`);
    return fetch(API_BASE + 'api/maestro', H).then(r => r.arrayBuffer()).then(buf => cargarXLSX().then(X => { msAplicar(X, buf, info.archivo); return true; }));
  }).catch(e => { if (forzar) toast(e.message === 'sin servidor' ? '⚠ El servidor de este PC está apagado: usa 📥 Cargar Excel del maestro' : '⚠ ' + e.message); return false; });
}

// ── Filtros y utilidades ──
const msF = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} ${frMes[+m[2] - 1]} ${m[1]}` : '—'; };
const msN = (n, d = 0) => n == null ? '—' : (+n).toLocaleString('es-CO', {minimumFractionDigits:d, maximumFractionDigits:d});
const msHacN = h => String(h || '').trim().toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const msProx = x => x.proxEst || x.proxPpto || '';
function msFiltradas(){
  const t = norm(msE.txt);
  return msFilas().filter(x => (!msE.emp || x.emp === msE.emp) && (!msE.zona || String(x.zona) === msE.zona) && (!msE.hac || x.hac === msE.hac) && (!msE.uso || x.uso === msE.uso)
    && (!msE.estado || x.estado === msE.estado) && (!msE.variedad || x.variedad === msE.variedad) && (!t || norm(`${x.s} ${x.hac} ${x.variedad}`).includes(t)));
}
const msCuenta = (L, k) => { const o = {}; L.forEach(x => { const v = x[k] == null || x[k] === '' ? '—' : x[k]; o[v] = (o[v] || 0) + (x.area || 0); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
// Categoría y color de cada suerte según lo que se quiera ver en el mapa
const MS_VISTAS = {
  variedad:{n:'Variedad', cat:(x, top) => top.includes(x.variedad) ? x.variedad : 'Otras'},
  edad:{n:'Edad hoy', cats:['0–3 meses', '3–6', '6–9', '9–12', '12–15', 'más de 15'], cat:x => x.edad == null ? '—' : ['0–3 meses', '3–6', '6–9', '9–12', '12–15', 'más de 15'][Math.min(5, Math.floor(x.edad / 3))], esc:['#dcfce7', '#86efac', '#22c55e', '#eab308', '#f97316', '#b91c1c']},
  corte:{n:'N° de corte', cats:['1', '2', '3', '4', '5', '6', '7', '8 o más'], cat:x => x.nCorte == null ? '—' : x.nCorte >= 8 ? '8 o más' : String(x.nCorte), esc:['#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#7f1d1d']},
  prox:{n:'Próximo corte', cat:x => { const p = msProx(x); if (!p) return '—'; const hoy = new Date(), d = (+p.slice(0, 4) - hoy.getFullYear()) * 12 + (+p.slice(5, 7) - 1 - hoy.getMonth()); return d < 0 ? 'Vencido' : d < 1 ? 'Este mes' : d < 3 ? '1–2 meses' : d < 6 ? '3–5 meses' : d < 12 ? '6–11 meses' : '12 meses o más'; },
    cats:['Vencido', 'Este mes', '1–2 meses', '3–5 meses', '6–11 meses', '12 meses o más'], esc:['#7f1d1d', '#dc2626', '#f97316', '#eab308', '#84cc16', '#15803d']},
  estado:{n:'Estado', cat:x => x.estado || '—'},
};

// ── Vista ──
function renderMaestro(){
  const cont = q('maestro'), M = maestroSuertes();
  if (MODO_EDICION && !msRevisado) { msRevisado = true; msDesdeServidor(false); }
  const top = `<div class="mod-top"><div><div class="sim-tit">📚 Maestro de suertes</div>
      <div class="sim-subt">${M ? `<b>${esc(M.archivo)}</b>${M.fecha ? ` · corte del ${esc(M.fecha)}` : ''} · ${M.filas.length} suertes` : 'Aún no se ha cargado el maestro'} · es la base de datos de suertes de toda la plataforma</div></div>
      ${MODO_EDICION ? `<div class="fr-acc"><button type="button" class="mbtn mbtn-ghost" data-ms-servidor title="Trae el más reciente de Documentos\\COMITE APS\\MAESTRO">🔄 Traer el último de la carpeta</button>
        <label class="mbtn" title="Elegir el Excel del maestro (hoja MAESTRO)">📥 Cargar Excel del maestro<input type="file" id="ms-archivo" accept=".xlsx,.xlsm,.xls" hidden></label></div>` : ''}</div>`;
  if (!M) { cont.innerHTML = top + `<div class="nores">Carga el Excel del maestro de suertes (hoja «MAESTRO») para ver aquí suertes, áreas, variedades, edades y próximos cortes.</div>`; return; }
  const T = msFilas(), L = msFiltradas(), area = sum(L, x => x.area || 0);
  const pond = k => { const A = L.filter(x => x[k] != null && x.area); const w = sum(A, x => x.area); return w ? sum(A, x => x[k] * x.area) / w : null; };
  const ops = (k, base) => [...new Set(base.map(x => x[k]).filter(v => v != null && v !== ''))].sort((a, b) => String(a).localeCompare(String(b), 'es', {numeric:true}));
  const baseEmp = T.filter(x => !msE.emp || x.emp === msE.emp);
  const sel = (id, val, lista, todos, fmt = v => v) => `<label class="fchip"><span>${todos}</span><select id="${id}" class="fsel ${val ? 'on' : ''}"><option value="">Todos</option>${lista.map(v => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(fmt(v))}</option>`).join('')}</select></label>`;
  const barras = (pares, total, fmt = v => v, max = 12, col = '#0f766e') => `<div class="ms-barras">${pares.slice(0, max).map(([k, v]) => `<div class="ms-bar" title="${esc(fmt(k))}: ${msN(v, 1)} ha"><span>${esc(fmt(k))}</span><div><i style="width:${total ? v / Math.max(...pares.map(p => p[1])) * 100 : 0}%;background:${col}"></i></div><b>${msN(v, 0)} ha</b><small>${msN(total ? v / total * 100 : 0, 1)}%</small></div>`).join('')}${pares.length > max ? `<div class="meta" style="padding:2px 0">… y ${pares.length - max} más</div>` : ''}</div>`;
  // Próximos cortes: área y toneladas por mes (12 meses)
  const hoy = new Date(), meses = Array.from({length:12}, (_, i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const porMes = meses.map(m => { const A = L.filter(x => msProx(x).slice(0, 7) === m); return {m, a:sum(A, x => x.area || 0), t:sum(A, x => x.tonEst || x.tonPpto || 0), n:A.length}; });
  const mxM = Math.max(1, ...porMes.map(x => x.a));
  const cortes = msCuenta(L, 'nCorte').sort((a, b) => (+a[0] || 99) - (+b[0] || 99));
  const ord = L.slice().sort((a, b) => { const k = msE.orden, va = a[k], vb = b[k]; const r = va == null ? 1 : vb == null ? -1 : typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', {numeric:true}); return msE.asc ? r : -r; });
  const th = (k, t, n) => `<th class="${n ? 'n' : ''}" data-ms-orden="${k}" style="cursor:pointer">${t}${msE.orden === k ? (msE.asc ? ' ▲' : ' ▼') : ''}</th>`;
  const lim = msE.mas ? ord.length : 150;
  cont.innerHTML = top + `
    <div class="fr-filtros ms-filtros">
      <div class="fr-fg"><span>Empresa</span>${[['RIOP', 'Riopaila'], ['CAST', 'Castilla'], ['', 'Todas']].map(([v, t]) => `<button type="button" class="fr-ch ${msE.emp === v ? 'on' : ''}" data-ms-emp="${v}">${t}</button>`).join('')}</div>
      <div class="ms-sels">
        ${sel('ms-zona', msE.zona, ops('zona', baseEmp), 'Zona', v => 'Zona ' + v)}
        ${sel('ms-hac', msE.hac, ops('hac', baseEmp), 'Hacienda', msHacN)}
        ${sel('ms-uso', msE.uso, ops('uso', baseEmp), 'Uso')}
        ${sel('ms-estado', msE.estado, ops('estado', baseEmp), 'Estado')}
        ${sel('ms-variedad', msE.variedad, ops('variedad', baseEmp), 'Variedad')}
        <input id="ms-txt" class="pr-buscar" placeholder="Buscar suerte, hacienda o variedad…" value="${esc(msE.txt)}">
        ${msE.zona || msE.hac || msE.uso || msE.estado || msE.variedad || msE.txt ? '<button type="button" class="plegar-todo" data-ms-limpiar>✕ Quitar filtros</button>' : ''}
      </div></div>
    <div class="sim-kpis ms-kpis">
      <div class="sim-kpi"><div class="l">Suertes</div><div class="v">${msN(L.length)}</div><div class="s">${new Set(L.map(x => x.hac)).size} haciendas</div></div>
      <div class="sim-kpi"><div class="l">Área neta</div><div class="v">${msN(area, 0)} ha</div><div class="s">${msN(new Set(L.map(x => x.variedad)).size)} variedades</div></div>
      <div class="sim-kpi"><div class="l">Edad promedio</div><div class="v">${msN(pond('edad'), 1)} m</div><div class="s">corte promedio ${msN(pond('nCorte'), 1)}</div></div>
      <div class="sim-kpi"><div class="l">TCH presupuesto</div><div class="v">${msN(pond('tchPpto'), 1)}</div><div class="s">aforo ${msN(pond('tchAforo'), 1)} t/ha</div></div>
      <div class="sim-kpi"><div class="l">Toneladas estimadas</div><div class="v">${msN(sum(L, x => x.tonEst || 0) / 1000, 1)} mil t</div><div class="s">ppto ${msN(sum(L, x => x.tonPpto || 0) / 1000, 1)} mil t</div></div>
    </div>
    <div class="fr-grid">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Mapa de suertes</b>
        <span class="ms-vistas">${Object.entries(MS_VISTAS).map(([k, v]) => `<button type="button" class="fr-ch ${msE.color === k ? 'on' : ''}" data-ms-color="${k}">${v.n}</button>`).join('')}</span></div>
        <div class="ms-zoom"><button type="button" class="plegar-todo" data-ms-zoom="1.6" title="Acercar">＋</button><button type="button" class="plegar-todo" data-ms-zoom="0.625" title="Alejar">－</button><button type="button" class="plegar-todo" data-ms-ajustar title="Ver todo el mapa">⤢ Ver todo</button><button type="button" class="plegar-todo ms-gps-btn ${msE.gps.on ? 'on' : ''}" data-ms-gps title="Muestra en el mapa dónde estás (GPS del celular o del equipo)">📍 Mi ubicación</button>
          <span class="ms-medir"><button type="button" class="plegar-todo ${msE.med.modo === 'lin' ? 'on' : ''}" data-ms-med="lin" title="Toca puntos en el mapa para medir una distancia o trazar una línea">📏 Distancia</button><button type="button" class="plegar-todo ${msE.med.modo === 'area' ? 'on' : ''}" data-ms-med="area" title="Toca los vértices para trazar una figura y medir su área">⬛ Área / figura</button>
          ${msE.med.modo || msE.med.figs.length ? `<button type="button" class="plegar-todo" data-ms-med="deshacer" title="Quitar el último punto">↶</button><button type="button" class="plegar-todo" data-ms-med="fin" title="Terminar esta medida y empezar otra">✔ Terminar</button><button type="button" class="plegar-todo" data-ms-med="borrar" title="Borrar todas las medidas">🗑</button>` : ''}</span></div>
        <div class="ms-capas"><label class="ms-fondo-sel" title="Imagen de fondo para ubicar municipios, pueblos, vías y ríos alrededor">Fondo <select id="ms-fondo">${Object.entries(MS_FONDOS).map(([k, v]) => `<option value="${k}" ${msE.fondo === k ? 'selected' : ''}>${v.n}</option>`).join('')}</select></label><span class="meta">Capas:</span>${MS_CAPAS.map(([k, n, c, t]) => `<button type="button" class="ms-capa ${msE.capas[k] ? 'on' : ''}" data-ms-capa="${k}" title="${t}"><i style="--c:${c}" class="ms-capa-${k}"></i>${n}</button>`).join('')}</div>
        <div class="ms-mapa ${msE.med.modo ? 'midiendo' : ''}" id="ms-mapa"><canvas id="ms-cv"></canvas><div class="fr-tip" id="ms-tip" hidden></div></div>
        <div class="ms-gps-txt" id="ms-gps" ${msE.gps.on ? '' : 'hidden'}></div>
        <div class="ms-medidas" id="ms-med"></div>
        <div class="fr-cley" id="ms-ley"></div>
        <div class="meta" style="padding:0 12px 10px">＋/－, Ctrl + rueda o dos dedos para acercar · arrastra para moverte · al acercarte aparece el número de cada suerte · toca una suerte para abrir su ficha · en «Capas» se prenden o apagan ríos, reservorios, canales, drenaje secundario, vías y el sentido de surco (las flechas muestran hacia dónde corre el agua) · 📏 Distancia y ⬛ Área / figura miden sobre el mapa (en metros, hectáreas y m²); con el teclado: Esc o Enter terminan la figura, otro Esc sale de medir y Ctrl+Z o Retroceso quitan el último punto. Solo se dibujan las suertes que están en la cartografía.</div></div>
      <div class="fr-lado">
        <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Área por variedad</b></div>${barras(msCuenta(L, 'variedad'), area, v => v, 10, '#7c3aed')}</div>
        <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Área por estado</b></div>${barras(msCuenta(L, 'estado'), area, v => v, 8, '#0891b2')}</div>
      </div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Próximos cortes</b> <span class="meta">· área y toneladas estimadas por mes (fecha estimada del maestro)</span></div>
      <div class="ms-meses">${porMes.map(x => `<div class="ms-mes" title="${frMes[+x.m.slice(5) - 1]} ${x.m.slice(0, 4)}: ${x.n} suertes · ${msN(x.a, 1)} ha · ${msN(x.t)} t"><div class="ms-mcol"><i style="height:${x.a / mxM * 100}%"></i></div><b>${msN(x.a, 0)}</b><small>${frMes[+x.m.slice(5) - 1]}${x.m.slice(5) === '01' || x.m === meses[0] ? ' ' + x.m.slice(2, 4) : ''}</small><small class="meta">${x.n} st</small></div>`).join('')}</div></div>
    <div class="fr-grid2">
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Área por hacienda</b></div>${barras(msCuenta(L, 'hac'), area, msHacN, 20)}</div>
      <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Área por número de corte</b> <span class="meta">· las suertes con muchos cortes son candidatas a renovación</span></div>${barras(cortes, area, v => v === '—' ? 'Sin dato' : `Corte ${v}`, 15, '#2563eb')}</div>
    </div>
    <div class="sim-card abierta"><div class="sim-card-h" style="cursor:default"><b>Suertes</b> <span class="meta">· ${L.length} · clic en un título para ordenar, en una fila para ver la ficha</span></div>
      <div class="sim-tw" style="max-height:560px"><table class="sim-t ms-tab"><thead><tr>${th('s', 'Suerte')}${th('hac', 'Hacienda')}${th('zona', 'Zona')}${th('uso', 'Uso')}${th('estado', 'Estado')}${th('variedad', 'Variedad')}${th('area', 'Área', 1)}${th('nCorte', 'Corte', 1)}${th('edad', 'Edad (m)', 1)}${th('siembra', 'Siembra')}${th('ultCorte', 'Último corte')}${th('proxEst', 'Próx. corte')}${th('tchPpto', 'TCH ppto', 1)}${th('tonEst', 'Ton. est.', 1)}</tr></thead>
      <tbody>${ord.slice(0, lim).map(x => `<tr data-ms-ficha="${esc(x.s)}|${esc(x.hac)}" style="cursor:pointer"><td class="lab" style="font-family:var(--mono)">${esc(x.s)}</td><td>${esc(msHacN(x.hac))}</td><td>${esc(x.zona ?? '')}</td><td>${esc(x.uso ?? '')}</td><td>${esc(x.estado ?? '')}</td><td>${esc(x.variedad ?? '')}</td>
        <td class="n b">${msN(x.area, 2)}</td><td class="n">${msN(x.nCorte)}</td><td class="n">${msN(x.edad, 1)}</td><td>${msF(x.siembra)}</td><td>${msF(x.ultCorte)}</td><td>${msF(msProx(x))}</td><td class="n">${msN(x.tchPpto, 1)}</td><td class="n">${msN(x.tonEst)}</td></tr>`).join('') || '<tr><td colspan="14" class="nores">Ninguna suerte con esos filtros.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="6">Total (${L.length})</td><td class="n b">${msN(area, 2)}</td><td colspan="7"></td></tr></tfoot></table></div>
      ${ord.length > lim ? `<div style="padding:8px 12px"><button type="button" class="plegar-todo" data-ms-mas>Ver las ${ord.length} suertes</button></div>` : ''}</div>
    <div id="ms-ficha"></div>`;
  msMapa(L);
  if (msE.gps.on) msGpsTexto(msE.gps.pos ? undefined : '⏳ Buscando tu ubicación…');
  if (msE.ficha) msFicha(msE.ficha);
}

// Mapa: las suertes de la cartografía coloreadas según la vista elegida, con zoom (＋/－, Ctrl + rueda, dos
// dedos), arrastre y el número de cada suerte cuando cabe (al acercarse aparece el código completo)
function msMapa(L){
  const caja = q('ms-mapa'), cv = q('ms-cv'); if (!caja || !cv) return;
  if (typeof MAPA_FREATICO === 'undefined') { caja.insertAdjacentHTML('afterbegin', '<div class="meta" style="padding:12px">Cargando cartografía…</div>'); frCargarMapa().then(() => vistaActual === 'maes' && renderMaestro()); return; }
  const M = MAPA_FREATICO, V = MS_VISTAS[msE.color], porCod = {};
  L.forEach(x => (porCod[x.s] = porCod[x.s] || []).push(x));
  const top = msCuenta(L, 'variedad').slice(0, 9).map(x => x[0]);
  const cats = V.cats || [...new Set(L.map(x => V.cat(x, top)))].sort((a, b) => a === 'Otras' ? 1 : b === 'Otras' ? -1 : 0);
  const color = c => V.esc ? (V.esc[cats.indexOf(c)] || '#cbd5e1') : (c === 'Otras' || c === '—' ? '#cbd5e1' : MS_PAL[cats.indexOf(c) % MS_PAL.length]);
  const fila = su => { const xs = porCod[su[0]]; return xs && (xs.find(y => norm(y.hac).includes(norm(su[1])) || norm(su[1]).includes(norm(y.hac))) || xs[0]); };
  const dpr = window.devicePixelRatio || 1, ancho = caja.clientWidth, alto = Math.min(Math.round(ancho * M.alto / M.ancho), Math.round(window.innerHeight * 0.72));
  cv.width = ancho * dpr; cv.height = alto * dpr; cv.style.height = alto + 'px';
  // Vista (se conserva al cambiar filtros mientras el tamaño sea el mismo)
  const ajustar = () => { const s = Math.min(ancho / M.ancho, alto / M.alto) * 0.96; msE.vista = {s, ox:(ancho - M.ancho * s) / 2, oy:(alto - M.alto * s) / 2, ancho, alto}; };
  if (!msE.vista || msE.vista.ancho !== ancho || msE.vista.alto !== alto) ajustar();
  const g = cv.getContext('2d'), Vw = () => msE.vista;
  const sx = x => Vw().ox + x * Vw().s, sy = y => Vw().oy + (M.alto - y) * Vw().s;
  const linea = (r, cerrar) => { for (let k = 0; k < r.length; k += 2) { const x = sx(r[k]), y = sy(r[k + 1]); k ? g.lineTo(x, y) : g.moveTo(x, y); } if (cerrar) g.closePath(); };
  const cuenta = {};
  M.suertes.forEach(su => { const x = fila(su); if (x) { const c = V.cat(x, top); cuenta[c] = (cuenta[c] || 0) + su[2]; } });
  function dibujar(){
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#eef2f6'; g.fillRect(0, 0, ancho, alto);
    const C = msE.capas, s = Vw().s, conFondo = msE.fondo !== 'no';
    if (conFondo) msFondoDibujar(g, dpr, ancho, alto, Vw());
    if (C.red && !conFondo) { g.strokeStyle = '#7fb3e6'; g.lineWidth = 1.2; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke(); }
    // Con mapa de fondo, las suertes van semitransparentes para que se vea la imagen debajo
    M.suertes.forEach(su => {
      const x = fila(su);
      g.beginPath(); su[3].forEach(r => linea(r, true));
      g.fillStyle = x ? color(V.cat(x, top)) : '#f1f5f9';
      g.globalAlpha = conFondo ? (x ? 0.55 : 0.15) : 1; g.fill('evenodd'); g.globalAlpha = 1;
      g.strokeStyle = conFondo ? 'rgba(255,255,255,.7)' : 'rgba(15,23,42,.35)'; g.lineWidth = Vw().s > 0.15 ? 0.9 : 0.5; g.stroke();
    });
    if (conFondo) msFondoDibujar(g, dpr, ancho, alto, Vw(), 'ref');   // nombres de municipios y lugares
    if (msE.sel) { const su = M.suertes.filter(x => x[0] === msE.sel); g.strokeStyle = '#0f172a'; g.lineWidth = 3; g.beginPath(); su.forEach(x => x[3].forEach(r => linea(r, true))); g.stroke(); }
    // Capas de la cartografía sobre las suertes (cada una se prende o apaga en la barra «Capas»)
    const trazo = (rs, col, w, guion) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(guion || []); g.beginPath(); rs.forEach(r => linea(r)); g.stroke(); g.setLineDash([]); };
    if (C.agua) { g.fillStyle = '#8ec5f5'; g.strokeStyle = '#2b7bd6'; g.lineWidth = 0.8; g.beginPath(); frMalla().agua.forEach(r => linea(r, true)); g.fill(); g.stroke(); }
    if (C.red) trazo(M.rios, '#2b7bd6', s > 0.3 ? 2.2 : 1.4);
    if (C.canales) trazo(M.canales || [], '#dc2626', s > 0.3 ? 2 : 1.2);
    if (C.drensec) trazo(M.drensec || [], '#0891b2', s > 0.3 ? 1.8 : 1.2, [6, 3]);
    if (C.vias) { const V2 = (M.vias || []).map(v => v[1]), w = s > 0.3 ? 2.2 : 1.4, gu = s > 0.3 ? [9, 5] : [6, 4]; trazo(V2, 'rgba(255,255,255,.85)', w + 2, gu); trazo(V2, '#111827', w, gu); }
    if (C.surcos) msSurcosDibujar(g, sx, sy, s);
    msCapasEtiquetas(g, sx, sy, s, ancho, alto);
    frEtiquetasSuertes(g, sx, sy, Vw().s, ancho, alto);
    msGpsDibujar(g, sx, sy, Vw().s);
    msMedDibujar(g, sx, sy);
    if (conFondo) msFondoCredito(g, ancho, alto);
  }
  msE.dibujar = dibujar;
  msE.aMundo = (cx, cy) => { const r = cv.getBoundingClientRect(), W = Vw(); return [(cx - r.left - W.ox) / W.s, M.alto - (cy - r.top - W.oy) / W.s]; };
  msMedPintar();
  msE.zoom = f => zoom(f, ancho / 2, alto / 2);
  msE.ajustar = () => { ajustar(); dibujar(); };
  dibujar();
  q('ms-ley').innerHTML = cats.filter(c => cuenta[c]).map(c => `<span><i style="background:${color(c)}"></i>${esc(c)} <small class="meta">${msN(cuenta[c], 0)} ha</small></span>`).join('') + '<span><i style="background:#f1f5f9;border:1px solid #cbd5e1"></i>Sin datos con este filtro</span>';
  const zoom = (f, px, py) => { const W = Vw(), ns = Math.max(0.02, Math.min(4, W.s * f)), k = ns / W.s; W.ox = px - (px - W.ox) * k; W.oy = py - (py - W.oy) * k; W.s = ns; dibujar(); };
  // Globo y ficha: celda de la malla → suerte de la cartografía → fila del maestro
  const G = frMalla(), tip = q('ms-tip');
  const enPunto = (cx, cy) => { const r = cv.getBoundingClientRect(), px = cx - r.left, py = cy - r.top, W = Vw(), wx = (px - W.ox) / W.s, wy = M.alto - (py - W.oy) / W.s;
    const gx = Math.floor(wx / FR_CELDA), gy = Math.floor((M.alto - wy) / FR_CELDA); if (gx < 0 || gy < 0 || gx >= G.W || gy >= G.H) return null;
    const c = G.celda[gy * G.W + gx]; if (c < 0) return null; const su = M.suertes[G.sue[c]];
    return {px, py, su, x:fila(su)}; };
  const globo = (cx, cy) => { const p = enPunto(cx, cy); if (!p) { tip.hidden = true; return; }
    const x = p.x, ss = msSentido(p.su[0], p.su[1]);
    tip.innerHTML = `<b>${esc(p.su[0])}</b> · ${esc(msHacN(p.su[1]))}${x ? `<br>${esc(x.variedad || '—')} · corte ${msN(x.nCorte)} · ${msN(x.edad, 1)} meses<br>${msN(x.area, 2)} ha · próximo corte ${msF(msProx(x))}` : '<br><span style="opacity:.8">Sin datos con este filtro</span>'}${ss ? `<br>Surco: ${msSentidoTxt(ss)}` : ''}`;
    tip.hidden = false; tip.style.left = Math.max(4, Math.min(p.px + 14, ancho - tip.offsetWidth - 4)) + 'px'; tip.style.top = (p.py + 14 + tip.offsetHeight > alto ? p.py - tip.offsetHeight - 10 : p.py + 14) + 'px'; };
  cv.onwheel = e => { if (!e.ctrlKey) return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top); };
  const toques = new Map(); let arr = null, movido = false, pinza = null;
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(); toques.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]); movido = false;
    if (toques.size === 1) arr = [e.clientX, e.clientY, Vw().ox, Vw().oy];
    if (toques.size === 2) { const [a, b] = [...toques.values()]; pinza = {d:Math.hypot(a[0] - b[0], a[1] - b[1]), s:Vw().s}; arr = null; } };
  cv.onpointermove = e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    if (toques.has(e.pointerId)) toques.set(e.pointerId, [px, py]);
    if (pinza && toques.size === 2) { const [a, b] = [...toques.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); zoom(pinza.s * d / pinza.d / Vw().s, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); movido = true; return; }
    if (arr) { const dx = e.clientX - arr[0], dy = e.clientY - arr[1]; if (Math.abs(dx) + Math.abs(dy) > 5) movido = true; if (movido) { Vw().ox = arr[2] + dx; Vw().oy = arr[3] + dy; dibujar(); tip.hidden = true; } return; }
    if (msE.med.modo && e.pointerType === 'mouse') { msE.med.cursor = msE.aMundo(e.clientX, e.clientY); dibujar(); return; }
    if (e.pointerType === 'mouse') globo(e.clientX, e.clientY); };
  const soltar = e => { toques.delete(e.pointerId); if (toques.size < 2) pinza = null;
    if (arr && !movido && e.type === 'pointerup' && msE.med.modo) { msMedPunto(msE.aMundo(e.clientX, e.clientY), Vw().s); dibujar(); msMedPintar(); }
    else if (arr && !movido && e.type === 'pointerup') { const p = enPunto(e.clientX, e.clientY); if (p) { msE.sel = p.su[0]; dibujar(); if (p.x) msFicha(p.x.s + '|' + p.x.hac); else globo(e.clientX, e.clientY); } }
    if (!toques.size) arr = null; };
  cv.onpointerup = soltar; cv.onpointercancel = soltar;
  cv.onpointerleave = e => { if (e.pointerType === 'mouse') { tip.hidden = true; if (msE.med.cursor) { msE.med.cursor = null; dibujar(); } } };
  cv.style.touchAction = 'none';
}

// Nombres de reservorios, ríos y quebradas, y vías con nombre propio; se saltan los que se taparían entre sí
function msCapasEtiquetas(g, sx, sy, s, ancho, alto){
  const M = MAPA_FREATICO, C = msE.capas, E = [];
  // De lejos solo los ríos y los reservorios con nombre; al acercarse, quebradas, acequias y canales
  if (C.agua && s >= 0.03) (M.agua_nom || []).forEach(a => a[0] && E.push([a[0], a[2], a[3], '#1e3a8a']));
  if (C.red && s >= 0.03) (M.rios_nom || []).forEach(r => (s >= 0.08 || /^Río /.test(r[0])) && E.push([r[0], r[1], r[2], '#1d4ed8']));
  if (C.vias && s >= 0.2) (M.vias || []).forEach(v => { if (!v[0] || /^vía (principal|de acceso)$/i.test(v[0])) return; const r = v[1], k = Math.floor(r.length / 4) * 2; E.push([v[0], r[k], r[k + 1], '#111827']); });
  if (!E.length) return;
  const usados = []; g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  g.font = `italic 600 ${s > 0.3 ? 12 : 11}px Inter, system-ui, sans-serif`;
  E.forEach(([t, x, y, col]) => { const px = sx(x), py = sy(y); if (px < 0 || py < 0 || px > ancho || py > alto) return;
    const w = g.measureText(t).width + 8; if (usados.some(b => Math.abs(b[0] - px) < (b[2] + w) / 2 && Math.abs(b[1] - py) < 15)) return;
    usados.push([px, py, w]); g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 3.5; g.strokeText(t, px, py); g.fillStyle = col; g.fillText(t, px, py); });
  g.restore();
}

// ── Sentido de surco: capa Direccion_de_Surco.shp (MAPA_FREATICO.surcos_lonlat, flechas en lon/lat). Cada flecha
// pasa a metros y se asigna a la suerte donde cae su punto medio (celda de la malla). El agua corre de a hacia b ──
function msSurcos(){
  if (msE.surcosC) return msE.surcosC;
  const M = MAPA_FREATICO, G = frMalla(), out = [];
  (M.surcos_lonlat || []).forEach(r => {
    const [x1, y1] = frTM(r[1], r[0]), [x2, y2] = frTM(r[3], r[2]), a = [x1 - M.x0, y1 - M.y0], b = [x2 - M.x0, y2 - M.y0];
    const gx = Math.floor((a[0] + b[0]) / 2 / FR_CELDA), gy = Math.floor((M.alto - (a[1] + b[1]) / 2) / FR_CELDA);
    const c = gx >= 0 && gy >= 0 && gx < G.W && gy < G.H ? G.celda[gy * G.W + gx] : -1;
    out.push({a, b, su:c < 0 ? -1 : G.sue[c]});
  });
  return msE.surcosC = out;
}
const MS_RUMBOS = [['norte', '↑'], ['noreste', '↗'], ['este', '→'], ['sureste', '↘'], ['sur', '↓'], ['suroeste', '↙'], ['oeste', '←'], ['noroeste', '↖']];
// Sentido de una suerte: promedio de sus flechas (rumbo desde el norte); "mixto" si las flechas apuntan a lados distintos
function msSentido(cod, hac){
  if (typeof MAPA_FREATICO === 'undefined' || !MAPA_FREATICO.surcos_lonlat) return null;
  const k = cod + '|' + (hac || ''), C = msE.sentidoC = msE.sentidoC || {};
  if (k in C) return C[k];
  const S = MAPA_FREATICO.suertes, mismo = S.map((su, i) => [su, i]).filter(([su]) => su[0] === cod);
  const conHac = hac ? mismo.filter(([su]) => norm(hac).includes(norm(su[1])) || norm(su[1]).includes(norm(hac))) : [];
  const ids = new Set((conHac.length ? conHac : mismo).map(([, i]) => i));
  const F = msSurcos().filter(f => ids.has(f.su));
  if (!F.length) return C[k] = null;
  let vx = 0, vy = 0; F.forEach(f => { const dx = f.b[0] - f.a[0], dy = f.b[1] - f.a[1], d = Math.hypot(dx, dy) || 1; vx += dx / d; vy += dy / d; });
  const az = (Math.atan2(vx, vy) * 180 / Math.PI + 360) % 360, r = MS_RUMBOS[Math.round(az / 45) % 8];
  return C[k] = {n:F.length, az, txt:r[0], fl:r[1], mixto:Math.hypot(vx, vy) / F.length < 0.7};
}
const msSentidoTxt = S => S ? `${S.fl} hacia el ${S.txt}${S.mixto ? ' (varios sentidos)' : ''}` : '';
function msSurcosDibujar(g, sx, sy, s){
  const F = msSurcos(); if (!F.length) return;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const trazo = (col, w, conPunta) => { g.strokeStyle = g.fillStyle = col; g.lineWidth = w;
    F.forEach(f => { let x1 = sx(f.a[0]), y1 = sy(f.a[1]), x2 = sx(f.b[0]), y2 = sy(f.b[1]), L = Math.hypot(x2 - x1, y2 - y1);
      // En la capa miden ~50 m: en pantalla se estiran desde su centro hasta un largo legible
      if (s >= 0.12 && L > 0 && L < minL) { const k = minL / L / 2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2; x1 = mx - (x2 - x1) * k; y1 = my - (y2 - y1) * k; x2 = 2 * mx - x1; y2 = 2 * my - y1; L = minL; }
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      if (!conPunta || L < 6) return;
      const h = Math.min(9, L * 0.4), an = Math.atan2(y2 - y1, x2 - x1);
      g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - h * Math.cos(an - 0.5), y2 - h * Math.sin(an - 0.5)); g.lineTo(x2 - h * Math.cos(an + 0.5), y2 - h * Math.sin(an + 0.5)); g.closePath(); g.fill(); g.stroke(); }); };
  const w = s > 0.3 ? 2 : s >= 0.12 ? 1.5 : 1, minL = s > 0.3 ? 30 : 20;
  trazo('rgba(255,255,255,.85)', w + 2, true); trazo('#0c4a6e', w, true);
  g.restore();
}

// ── Mapa de fondo (como Google Earth): mosaicos de Esri (imagen satelital o mapa de calles) con los nombres de
// municipios y lugares encima. Los mosaicos vienen en Web Mercator: cada uno se ubica por sus esquinas pasadas a
// metros MAGNA (frTM) y se dibuja con una transformación afín (incluye el pequeño giro entre las dos proyecciones) ──
const MS_FONDOS = {
  no:   {n:'Sin fondo'},
  sat:  {n:'🛰 Satélite', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max:19,
         ref:'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', cred:'Imágenes © Esri, Maxar, Earthstar Geographics'},
  mapa: {n:'🗺 Mapa', url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', max:19, cred:'Mapa © Esri, HERE, Garmin, OpenStreetMap'},
};
const MS_TILES = new Map();   // url → Image (se guardan las ya bajadas)
let msTileEspera = 0;
function msTile(url){
  let im = MS_TILES.get(url);
  if (!im) { im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { cancelAnimationFrame(msTileEspera); msTileEspera = requestAnimationFrame(() => msE.dibujar && msE.dibujar()); }; im.src = url; MS_TILES.set(url, im);
    if (MS_TILES.size > 800) MS_TILES.delete(MS_TILES.keys().next().value); }
  return im.complete && im.naturalWidth ? im : null;
}
function msFondoDibujar(g, dpr, ancho, alto, W, capa){
  const F = MS_FONDOS[msE.fondo]; if (!F || !F.url || !(W.s > 0) || !(ancho > 0) || !(alto > 0)) return;
  const tpl = capa === 'ref' ? F.ref : F.url; if (!tpl) return;
  const M = MAPA_FREATICO, aMundo = (px, py) => [(px - W.ox) / W.s + M.x0, M.alto - (py - W.oy) / W.s + M.y0];
  const ll = [aMundo(0, 0), aMundo(ancho, 0), aMundo(0, alto), aMundo(ancho, alto)].map(p => frTMinv(p[0], p[1]));
  const lat0 = Math.min(...ll.map(p => p[0])), lat1 = Math.max(...ll.map(p => p[0])), lon0 = Math.min(...ll.map(p => p[1])), lon1 = Math.max(...ll.map(p => p[1]));
  // Nivel de zoom: un pixel del mosaico ≈ un pixel de pantalla (sin pasar de ~150 mosaicos)
  const latM = (lat0 + lat1) / 2, mpp = 1 / (W.s * dpr);
  let z = Math.max(3, Math.min(F.max, Math.round(Math.log2(156543.03 * Math.cos(latM * Math.PI / 180) / mpp))));
  if (!Number.isFinite(z) || ![lat0, lat1, lon0, lon1].every(Number.isFinite)) return;   // (sin esto, un mapa de ancho 0 dejaba el ciclo sin fin)
  const tx = (lon, z) => (lon + 180) / 360 * 2 ** z, ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
  let x0, x1, y0, y1;
  for (;;) { x0 = Math.floor(tx(lon0, z)); x1 = Math.floor(tx(lon1, z)); y0 = Math.floor(ty(lat1, z)); y1 = Math.floor(ty(lat0, z)); if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 150 || !(z > 3)) break; z--; }
  const lonDe = (x, z) => x / 2 ** z * 360 - 180, latDe = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;
  const aPant = (lat, lon) => { const [x, y] = frTM(lat, lon); return [W.ox + (x - M.x0) * W.s, W.oy + (M.alto - (y - M.y0)) * W.s]; };
  g.save(); g.imageSmoothingEnabled = true;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const im = msTile(tpl.replace('{z}', z).replace('{y}', y).replace('{x}', x)); if (!im) continue;
    const nw = aPant(latDe(y, z), lonDe(x, z)), ne = aPant(latDe(y, z), lonDe(x + 1, z)), sw = aPant(latDe(y + 1, z), lonDe(x, z));
    // medio pixel de más para que no se vean rayas entre mosaicos
    g.setTransform(dpr * (ne[0] - nw[0]) / 255.5, dpr * (ne[1] - nw[1]) / 255.5, dpr * (sw[0] - nw[0]) / 255.5, dpr * (sw[1] - nw[1]) / 255.5, dpr * nw[0], dpr * nw[1]);
    g.drawImage(im, 0, 0, 256, 256);
  }
  g.restore(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function msFondoCredito(g, ancho, alto){
  const F = MS_FONDOS[msE.fondo]; if (!F || !F.cred) return;
  g.save(); g.font = '10px system-ui,Segoe UI,Arial'; const w = g.measureText(F.cred).width + 10;
  g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(ancho - w, alto - 16, w, 16); g.fillStyle = '#334155'; g.textBaseline = 'middle'; g.fillText(F.cred, ancho - w + 5, alto - 8); g.restore();
}

// ── Mi ubicación: GPS del navegador (celular o equipo) sobre el mapa. La posición se queda en este navegador:
// no se guarda ni se publica. Se pasa de lat/lon a MAGNA (frTM) y se dice en qué suerte está ──
function msGps(encender){
  const G = msE.gps;
  if (!encender) { if (G.id != null) navigator.geolocation.clearWatch(G.id); Object.assign(G, {on:false, id:null, pos:null, acc:null, centrado:false}); renderMaestro(); return; }
  if (!navigator.geolocation) { toast('⚠ Este navegador no permite conocer la ubicación'); return; }
  G.on = true; G.centrado = false; renderMaestro(); msGpsTexto('⏳ Buscando tu ubicación… (acepta el permiso de ubicación si el navegador lo pide)');
  G.id = navigator.geolocation.watchPosition(p => {
    if (vistaActual !== 'maes' || !G.on) { msGps(false); return; }
    if (typeof MAPA_FREATICO === 'undefined') return;
    const M = MAPA_FREATICO, [x, y] = frTM(p.coords.latitude, p.coords.longitude);
    G.pos = [x - M.x0, y - M.y0]; G.acc = p.coords.accuracy || null;
    if (!G.centrado) { G.centrado = true; msGpsCentrar(); } else if (msE.dibujar) msE.dibujar();
    msGpsTexto();
  }, err => {
    const m = err.code === 1 ? 'No diste permiso de ubicación. Actívalo en el candado de la barra de direcciones del navegador.' : err.code === 3 ? 'El GPS no respondió a tiempo; sigue intentando…' : 'No se pudo obtener la ubicación.';
    if (err.code === 1) { msGps(false); toast('⚠ ' + m); } else msGpsTexto('⚠ ' + m);
  }, {enableHighAccuracy:true, maximumAge:5000, timeout:30000});
}
// Centra el mapa en la ubicación (y acerca si está muy lejos)
function msGpsCentrar(){
  const G = msE.gps, W = msE.vista, M = MAPA_FREATICO; if (!G.pos || !W) return;
  const fuera = G.pos[0] < -2000 || G.pos[1] < -2000 || G.pos[0] > M.ancho + 2000 || G.pos[1] > M.alto + 2000;
  if (fuera) { toast('📍 Estás fuera del área del mapa'); return; }
  W.s = Math.max(W.s, 0.35); W.ox = W.ancho / 2 - G.pos[0] * W.s; W.oy = W.alto / 2 - (M.alto - G.pos[1]) * W.s;
  if (msE.dibujar) msE.dibujar();
}
function msGpsTexto(msg){
  const el = q('ms-gps'); if (!el) return; el.hidden = false;
  if (msg) { el.innerHTML = msg; return; }
  const G = msE.gps, M = MAPA_FREATICO, F = frMalla(); if (!G.pos) return;
  const gx = Math.floor(G.pos[0] / FR_CELDA), gy = Math.floor((M.alto - G.pos[1]) / FR_CELDA);
  const c = gx >= 0 && gy >= 0 && gx < F.W && gy < F.H ? F.celda[gy * F.W + gx] : -1, su = c >= 0 ? M.suertes[F.sue[c]] : null;
  const fuera = G.pos[0] < 0 || G.pos[1] < 0 || G.pos[0] > M.ancho || G.pos[1] > M.alto;
  const ss = su && typeof msSentido === 'function' ? msSentido(su[0], su[1]) : null;
  el.innerHTML = `📍 ${su ? `Estás en la suerte <b>${esc(su[0])}</b> · ${esc(msHacN(su[1]))}${ss ? ` · surco ${msSentidoTxt(ss)}` : ''}` : fuera ? 'Estás <b>fuera del área del mapa</b>' : 'No estás dentro de una suerte (vía, canal o zona sin cartografía)'}
    ${G.acc ? `<span class="meta">· precisión ±${msN(G.acc)} m</span>` : ''} <button type="button" class="plegar-todo" data-ms-gps-centrar>⌖ Centrar</button>
    ${su ? `<button type="button" class="plegar-todo" data-ms-ficha="${esc(su[0])}|${esc(su[1])}">Ver ficha</button>` : ''}`;
}
// Punto azul con el círculo de precisión
function msGpsDibujar(g, sx, sy, s){
  const G = msE.gps; if (!G.on || !G.pos) return;
  const x = sx(G.pos[0]), y = sy(G.pos[1]), r = G.acc ? Math.max(8, G.acc * s) : 0;
  g.save();
  if (r) { g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fillStyle = 'rgba(37,99,235,.15)'; g.fill(); g.strokeStyle = 'rgba(37,99,235,.5)'; g.lineWidth = 1; g.stroke(); }
  g.beginPath(); g.arc(x, y, 7, 0, 2 * Math.PI); g.fillStyle = '#2563eb'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
  g.restore();
}

// ── Medir sobre el mapa: distancias (líneas) y áreas (figuras). La cartografía está en metros (MAGNA Colombia Oeste),
// así que las medidas salen directas: longitud por suma de tramos y área por la fórmula del polígono (Gauss) ──
const msLargo = (pts, cerrar) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (cerrar && pts.length > 2) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return s; };
const msArea = pts => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
const msMetros = m => m >= 1000 ? `${msN(m / 1000, 2)} km` : `${msN(m, 0)} m`;
function msMedPunto(p, escala){
  const M = msE.med; let f = M.cur != null ? M.figs[M.cur] : null;
  if (!f || f.tipo !== M.modo || f.fin) { f = {tipo:M.modo, pts:[]}; M.figs.push(f); M.cur = M.figs.length - 1; }
  // En una figura, tocar cerca del primer punto la cierra
  if (f.tipo === 'area' && f.pts.length >= 3 && Math.hypot(p[0] - f.pts[0][0], p[1] - f.pts[0][1]) * escala < 14) { f.fin = true; M.cur = null; return; }
  f.pts.push(p);
}
function msMedDibujar(g, sx, sy){
  const M = msE.med; if (!M.figs.length) return;
  M.figs.forEach((f, i) => {
    const activa = i === M.cur, pts = activa && M.cursor && M.modo === f.tipo ? [...f.pts, M.cursor] : f.pts, col = f.tipo === 'area' ? '#7c3aed' : '#ea580c';
    if (!pts.length) return;
    g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(sx(p[0]), sy(p[1])) : g.moveTo(sx(p[0]), sy(p[1])));
    if (f.tipo === 'area' && pts.length > 2) { g.closePath(); g.fillStyle = 'rgba(124,58,237,.18)'; g.fill(); }
    g.setLineDash(activa ? [6, 4] : []); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.strokeStyle = col; g.lineWidth = 2.5; g.stroke(); g.setLineDash([]);
    f.pts.forEach((p, k) => { g.beginPath(); g.arc(sx(p[0]), sy(p[1]), k === 0 ? 5 : 4, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = col; g.stroke(); });
    // Rótulo con la medida
    const txt = f.tipo === 'area' && pts.length > 2 ? `${msN(msArea(pts) / 1e4, 2)} ha` : msMetros(msLargo(pts));
    const ult = f.tipo === 'area' && pts.length > 2 ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : pts[pts.length - 1];
    if (pts.length > 1) { g.font = '700 13px Arial'; const w = g.measureText(txt).width, x = sx(ult[0]) + (f.tipo === 'area' ? -w / 2 : 8), y = sy(ult[1]) + (f.tipo === 'area' ? 5 : -8);
      g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(x - 4, y - 13, w + 8, 18); g.fillStyle = col; g.fillText(txt, x, y); }
  });
}
function msMedPintar(){
  const el = q('ms-med'); if (!el) return;
  const M = msE.med, F = M.figs.filter(f => f.pts.length > 1);
  el.innerHTML = M.modo && !F.length ? `<div class="meta">${M.modo === 'area' ? '⬛ Toca los vértices de la figura sobre el mapa. Para cerrarla toca el primer punto o ✔ Terminar.' : '📏 Toca los puntos de la línea sobre el mapa. ✔ Terminar para empezar otra.'} Arrastra para moverte sin marcar.</div>` :
    F.map((f, i) => f.tipo === 'area' && f.pts.length > 2
      ? `<span class="ms-m-a">⬛ Figura ${i + 1}: <b>${msN(msArea(f.pts) / 1e4, 2)} ha</b> <small>(${msN(msArea(f.pts), 0)} m²) · perímetro ${msMetros(msLargo(f.pts, true))}</small></span>`
      : `<span class="ms-m-l">📏 Línea ${i + 1}: <b>${msMetros(msLargo(f.pts))}</b> <small>· ${f.pts.length - 1} tramo${f.pts.length > 2 ? 's' : ''}</small></span>`).join('');
}

// Ficha de una suerte: ventana sobre la página (con su título fijo, se desplaza por dentro y se puede arrastrar)
// con los datos y el ciclo actual (último corte → hoy → próximo corte)
function msFicha(clave){
  const [s, h] = clave.split('|'), x = msFilas().find(y => y.s === s && y.hac === h) || msFilas().find(y => y.s === s);
  const el = q('ms-ficha'); if (!el) return;
  if (!x) { el.innerHTML = ''; msE.ficha = null; return; }
  msE.ficha = clave;
  const dia = d => Math.round(Date.parse(d + 'T00:00:00Z') / 864e5), hoyS = new Date().toISOString().slice(0, 10), hoy = dia(hoyS);
  const ult = x.ultCorte, prox = msProx(x);
  // Ciclo actual: del último corte (o la siembra si aún no tiene cortes) al próximo corte
  const ini = ult || x.siembra, fin = prox;
  let ciclo = '';
  if (ini && fin && dia(fin) > dia(ini)) {
    const tot = dia(fin) - dia(ini), va = Math.max(0, Math.min(tot, hoy - dia(ini))), pct = va / tot * 100, faltan = dia(fin) - hoy;
    const estado = faltan < 0 ? `<b style="color:#dc2626">Vencido hace ${-faltan} días</b>` : faltan === 0 ? '<b style="color:#dc2626">Se corta hoy</b>' : `Faltan <b>${faltan} días</b>`;
    ciclo = `<div class="ms-ciclo"><div class="ms-ciclo-t"><b>Ciclo actual</b><span>${estado}</span></div>
      <div class="ms-ciclo-bar"><i style="width:${pct}%;background:${faltan < 0 ? '#dc2626' : faltan <= 30 ? '#f59e0b' : '#16a34a'}"></i><em style="left:${pct}%" title="Hoy"></em></div>
      <div class="ms-ciclo-f"><div><small>${ult ? 'Último corte' : 'Siembra'}</small><b>${msF(ini)}</b></div>
        <div style="text-align:center"><small>Hoy</small><b>${msF(hoyS)}</b><small>${msN(x.edad, 1)} meses de edad</small></div>
        <div style="text-align:right"><small>Próximo corte${x.proxEst ? ' (estimado)' : ''}</small><b>${msF(fin)}</b>${x.proxPpto && x.proxEst && x.proxPpto !== x.proxEst ? `<small>ppto ${msF(x.proxPpto)}</small>` : ''}</div></div></div>`;
  }
  const otros = msFilas().filter(y => y.s === s && y !== x);
  const dato = (l, v) => `<div><small>${l}</small><b>${v}</b></div>`;
  el.innerHTML = `<div class="ms-fondo" data-ms-cerrar><div class="ms-ficha" role="dialog" aria-label="Ficha de la suerte ${esc(x.s)}">
    <div class="ms-fh" title="Arrastra para mover la ventana"><span class="ms-cod">${esc(x.s)}</span><div><b>${esc(msHacN(x.hac))}</b><small>Zona ${esc(x.zona ?? '—')} · ${esc(x.emp ?? '')} · ${esc(x.uso ?? '')} · ${esc(x.estado ?? '')}</small></div>
      <button type="button" class="ms-x" data-ms-cerrar title="Cerrar (Esc)">✕</button></div>
    <div class="ms-cuerpo">
    ${ciclo}
    <div class="ms-datos">${dato('Área neta', msN(x.area, 2) + ' ha')}${dato('Variedad', esc(x.variedad || '—'))}${dato('N° de corte', msN(x.nCorte))}${dato('Ciclo de vida', msN(x.ciclo))}
      ${dato('Edad hoy', msN(x.edad, 1) + ' meses')}${dato('Edad estándar de corte', msN(x.edadStd, 1) + ' meses')}${dato('TCH presupuesto', msN(x.tchPpto, 1))}${dato('TCH aforo', msN(x.tchAforo, 1))}
      ${dato('Toneladas ppto', msN(x.tonPpto))}${dato('Toneladas estimadas', msN(x.tonEst))}${dato('Tipo de finca', esc(x.tipoFinca || '—'))}${dato('Zona agroecológica', esc(x.zonaAgro || '—'))}${dato('Sentido de surco', esc(msSentidoTxt(msSentido(x.s, x.hac)) || '—'))}
      ${x.lucro ? dato('Días lucro cesante', msN(x.lucro)) : ''}${x.quema ? dato('Restricción de quema', esc(x.quema)) : ''}</div>
    ${x.edad != null && x.edadStd ? `<div class="ms-edad"><small>Edad hoy frente a la edad estándar de corte (${msN(x.edadStd, 1)} meses)</small><div><i style="width:${Math.min(100, x.edad / x.edadStd * 100)}%;background:${x.edad >= x.edadStd ? '#dc2626' : '#16a34a'}"></i></div><span>${msN(x.edad / x.edadStd * 100)}%${x.edad >= x.edadStd ? ' · ya cumplió la edad de corte' : ''}</span></div>` : ''}
    <div class="ms-hist">🌱 Sembrada el <b>${msF(x.siembra)}</b>${x.nCorte != null ? ` · va en el corte <b>${x.nCorte}</b>` : ''}${x.ciclo ? ` · ciclo de vida previsto ${x.ciclo} cortes` : ''}${x.nCorte >= 8 ? ' · <b style="color:#b45309">candidata a renovación</b>' : ''}</div>
    ${otros.length ? `<div class="meta">También aparece en el maestro como: ${otros.map(o => `${esc(msHacN(o.hac))} (${esc(o.uso || '')}, ${msN(o.area, 2)} ha)`).join(', ')}</div>` : ''}
    </div></div></div>`;
  // Arrastrar la ventana desde su título
  const f = el.querySelector('.ms-ficha'), barra = el.querySelector('.ms-fh');
  let ini0 = null, dx = 0, dy = 0;
  barra.onpointerdown = e => { if (e.target.closest('button')) return; ini0 = [e.clientX - dx, e.clientY - dy]; barra.setPointerCapture(e.pointerId); barra.classList.add('arrastrando'); };
  barra.onpointermove = e => { if (!ini0) return; dx = e.clientX - ini0[0]; dy = e.clientY - ini0[1]; f.style.transform = `translate(${dx}px, ${dy}px)`; };
  barra.onpointerup = barra.onpointercancel = () => { ini0 = null; barra.classList.remove('arrastrando'); };
}

q('maestro').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-ms-servidor]')) { msDesdeServidor(true); return; }
  const em = t.closest('[data-ms-emp]'); if (em) { msE.emp = em.dataset.msEmp; msE.zona = msE.hac = msE.uso = msE.estado = msE.variedad = ''; renderMaestro(); return; }
  const co = t.closest('[data-ms-color]'); if (co) { msE.color = co.dataset.msColor; renderMaestro(); return; }
  const or = t.closest('[data-ms-orden]'); if (or) { const k = or.dataset.msOrden; msE.asc = msE.orden === k ? !msE.asc : true; msE.orden = k; renderMaestro(); return; }
  if (t.closest('[data-ms-limpiar]')) { msE.zona = msE.hac = msE.uso = msE.estado = msE.variedad = msE.txt = ''; renderMaestro(); return; }
  if (t.closest('[data-ms-mas]')) { msE.mas = true; renderMaestro(); return; }
  const zb = t.closest('[data-ms-zoom]'); if (zb) { msE.zoom && msE.zoom(+zb.dataset.msZoom); return; }
  const md = t.closest('[data-ms-med]');
  if (md) { msMedAccion(md.dataset.msMed); return; }
  if (t.closest('[data-ms-ajustar]')) { msE.sel = null; msE.ajustar && msE.ajustar(); return; }
  if (t.closest('[data-ms-gps]')) { msGps(!msE.gps.on); return; }
  if (t.closest('[data-ms-gps-centrar]')) { msGpsCentrar(); return; }
  const cp = t.closest('[data-ms-capa]');
  if (cp) { const k = cp.dataset.msCapa; msE.capas[k] = !msE.capas[k]; cp.classList.toggle('on', msE.capas[k]); msE.dibujar && msE.dibujar(); return; }
  if (t.closest('.ms-x') || (t.classList && t.classList.contains('ms-fondo'))) { msE.ficha = null; q('ms-ficha').innerHTML = ''; return; }
  const fi = t.closest('[data-ms-ficha]'); if (fi) msFicha(fi.dataset.msFicha);
});
q('maestro').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ms-archivo') { msCargarArchivo(t.files[0]); t.value = ''; return; }
  if (t.id === 'ms-fondo') { msE.fondo = t.value; try { localStorage.setItem('comite-aps:ms-fondo', t.value); } catch (e2) {} msE.dibujar && msE.dibujar(); return; }
  const k = {'ms-zona':'zona', 'ms-hac':'hac', 'ms-uso':'uso', 'ms-estado':'estado', 'ms-variedad':'variedad'}[t.id];
  if (k) { msE[k] = t.value; renderMaestro(); }
});
let msEspera = 0;
q('maestro').addEventListener('input', e => { if (e.target.id === 'ms-txt') { msE.txt = e.target.value; clearTimeout(msEspera); msEspera = setTimeout(() => redibujarConservando('ms-txt', renderMaestro), 250); } });
// Botones de medir (📏 / ⬛ / ↶ / ✔ / 🗑) y sus atajos de teclado
function msMedAccion(a){
  const M = msE.med;
  if (a === 'lin' || a === 'area') { M.modo = M.modo === a ? null : a; M.cur = null; M.cursor = null; }
  else if (a === 'deshacer') { const f = M.cur != null ? M.figs[M.cur] : M.figs[M.figs.length - 1]; if (f) { if (f.fin) f.fin = false; else f.pts.pop(); if (!f.pts.length) { M.figs.splice(M.figs.indexOf(f), 1); M.cur = null; } else M.cur = M.figs.indexOf(f); } }
  else if (a === 'fin') { const f = M.figs[M.cur]; if (f) f.fin = true; M.cur = null; M.figs = M.figs.filter(x => x.pts.length > 1); }
  else if (a === 'salir') { M.modo = null; M.cur = null; M.cursor = null; M.figs = M.figs.filter(x => x.pts.length > 1); M.figs.forEach(x => { x.fin = true; }); }
  else if (a === 'borrar') { M.figs = []; M.cur = null; }
  renderMaestro();
}
// Esc: cierra la ficha; midiendo, termina la figura que se está trazando y, con otro Esc, sale de medir.
// Enter termina la figura; Ctrl+Z o Retroceso quitan el último punto (no actúan si se está escribiendo en un campo)
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && msE.ficha && q('ms-ficha')) { msE.ficha = null; q('ms-ficha').innerHTML = ''; return; }
  if (vistaActual !== 'maes' || !msE.med.modo || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.target.isContentEditable) return;
  const M = msE.med, trazando = M.cur != null && M.figs[M.cur] && !M.figs[M.cur].fin;
  if (e.key === 'Escape') { e.preventDefault(); msMedAccion(trazando ? 'fin' : 'salir'); }
  else if (e.key === 'Enter') { e.preventDefault(); msMedAccion('fin'); }
  else if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'Backspace') { e.preventDefault(); msMedAccion('deshacer'); }
});
