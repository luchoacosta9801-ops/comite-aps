// Maestro de suertes (#maestro, vista 'maes'): versión digital y didáctica de la hoja MAESTRO del
// "Maestro Suertes ….xlsx" (Documents\COMITE APS\MAESTRO). El editor carga el Excel (o lo trae el servidor) y
// ese pasa a ser el maestro de toda la plataforma: también alimenta días de lucro, "Agregar suerte" y Agronomía.
// Se publica solo lo agronómico (DB.maestroSuertes {archivo, fecha, cols[], filas[][]}); nunca nombres de personas,
// tipo de negociación, kilos, precios ni ingresos.

const MS_COLS = ['s', 'emp', 'zona', 'hac', 'uso', 'estado', 'variedad', 'area', 'siembra', 'ultCorte', 'nCorte', 'ciclo', 'edad', 'edadStd',
  'proxPpto', 'proxEst', 'tchPpto', 'tchAforo', 'tonPpto', 'tonEst', 'tipoFinca', 'zonaAgro', 'lucro', 'rangoEdad', 'sector', 'quema'];
const MS_PAL = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#16a34a', '#db2777', '#0891b2', '#65a30d', '#9333ea', '#ea580c', '#475569'];
const msE = {emp:'RIOP', zona:'', hac:'', uso:'', estado:'', variedad:'', txt:'', color:'variedad', orden:'s', asc:true, mas:false, ficha:null};

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
        <div class="ms-zoom"><button type="button" class="plegar-todo" data-ms-zoom="1.6" title="Acercar">＋</button><button type="button" class="plegar-todo" data-ms-zoom="0.625" title="Alejar">－</button><button type="button" class="plegar-todo" data-ms-ajustar title="Ver todo el mapa">⤢ Ver todo</button><span class="meta">Acércate para ver el número de cada suerte</span></div>
        <div class="ms-mapa" id="ms-mapa"><canvas id="ms-cv"></canvas><div class="fr-tip" id="ms-tip" hidden></div></div>
        <div class="fr-cley" id="ms-ley"></div>
        <div class="meta" style="padding:0 12px 10px">＋/－, Ctrl + rueda o dos dedos para acercar · arrastra para moverte · al acercarte aparece el número de cada suerte · toca una suerte para abrir su ficha. Solo se dibujan las suertes que están en la cartografía.</div></div>
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
    g.strokeStyle = '#7fb3e6'; g.lineWidth = 1.2; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke();
    M.suertes.forEach(su => {
      const x = fila(su);
      g.beginPath(); su[3].forEach(r => linea(r, true));
      g.fillStyle = x ? color(V.cat(x, top)) : '#f1f5f9';
      g.fill('evenodd'); g.strokeStyle = 'rgba(15,23,42,.35)'; g.lineWidth = Vw().s > 0.15 ? 0.9 : 0.5; g.stroke();
    });
    if (msE.sel) { const su = M.suertes.filter(x => x[0] === msE.sel); g.strokeStyle = '#0f172a'; g.lineWidth = 3; g.beginPath(); su.forEach(x => x[3].forEach(r => linea(r, true))); g.stroke(); }
    frEtiquetasSuertes(g, sx, sy, Vw().s, ancho, alto);
  }
  msE.dibujar = dibujar;
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
    const x = p.x; tip.innerHTML = `<b>${esc(p.su[0])}</b> · ${esc(msHacN(p.su[1]))}${x ? `<br>${esc(x.variedad || '—')} · corte ${msN(x.nCorte)} · ${msN(x.edad, 1)} meses<br>${msN(x.area, 2)} ha · próximo corte ${msF(msProx(x))}` : '<br><span style="opacity:.8">Sin datos con este filtro</span>'}`;
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
    if (e.pointerType === 'mouse') globo(e.clientX, e.clientY); };
  const soltar = e => { toques.delete(e.pointerId); if (toques.size < 2) pinza = null;
    if (arr && !movido && e.type === 'pointerup') { const p = enPunto(e.clientX, e.clientY); if (p) { msE.sel = p.su[0]; dibujar(); if (p.x) msFicha(p.x.s + '|' + p.x.hac); else globo(e.clientX, e.clientY); } }
    if (!toques.size) arr = null; };
  cv.onpointerup = soltar; cv.onpointercancel = soltar;
  cv.onpointerleave = e => { if (e.pointerType === 'mouse') tip.hidden = true; };
  cv.style.touchAction = 'none';
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
      ${dato('Toneladas ppto', msN(x.tonPpto))}${dato('Toneladas estimadas', msN(x.tonEst))}${dato('Tipo de finca', esc(x.tipoFinca || '—'))}${dato('Zona agroecológica', esc(x.zonaAgro || '—'))}
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
  if (t.closest('[data-ms-ajustar]')) { msE.sel = null; msE.ajustar && msE.ajustar(); return; }
  if (t.closest('.ms-x') || (t.classList && t.classList.contains('ms-fondo'))) { msE.ficha = null; q('ms-ficha').innerHTML = ''; return; }
  const fi = t.closest('[data-ms-ficha]'); if (fi) msFicha(fi.dataset.msFicha);
});
q('maestro').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ms-archivo') { msCargarArchivo(t.files[0]); t.value = ''; return; }
  const k = {'ms-zona':'zona', 'ms-hac':'hac', 'ms-uso':'uso', 'ms-estado':'estado', 'ms-variedad':'variedad'}[t.id];
  if (k) { msE[k] = t.value; renderMaestro(); }
});
let msEspera = 0;
q('maestro').addEventListener('input', e => { if (e.target.id === 'ms-txt') { msE.txt = e.target.value; clearTimeout(msEspera); msEspera = setTimeout(() => redibujarConservando('ms-txt', renderMaestro), 250); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && msE.ficha && q('ms-ficha')) { msE.ficha = null; q('ms-ficha').innerHTML = ''; } });
