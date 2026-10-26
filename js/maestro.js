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
  const barras = (pares, total, fmt = v => v, max = 12, col = '#0f766e') => `<div class="ms-barras">${pares.slice(0, max).map(([k, v]) => `<div class="ms-bar" title="${esc(fmt(k))}: ${msN(v, 1)} ha"><span>${esc(fmt(k))}</span><div><i style="width:${total ? v / pares[0][1] * 100 : 0}%;background:${col}"></i></div><b>${msN(v, 0)} ha</b><small>${msN(total ? v / total * 100 : 0, 1)}%</small></div>`).join('')}${pares.length > max ? `<div class="meta" style="padding:2px 0">… y ${pares.length - max} más</div>` : ''}</div>`;
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
        <div class="ms-mapa" id="ms-mapa"><canvas id="ms-cv"></canvas><div class="fr-tip" id="ms-tip" hidden></div></div>
        <div class="fr-cley" id="ms-ley"></div>
        <div class="meta" style="padding:0 12px 10px">Pasa el ratón por una suerte para ver sus datos; clic para abrir su ficha. Solo se dibujan las suertes que están en la cartografía.</div></div>
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

// Mapa: las suertes de la cartografía coloreadas según la vista elegida
function msMapa(L){
  const caja = q('ms-mapa'), cv = q('ms-cv'); if (!caja || !cv) return;
  if (typeof MAPA_FREATICO === 'undefined') { caja.insertAdjacentHTML('afterbegin', '<div class="meta" style="padding:12px">Cargando cartografía…</div>'); frCargarMapa().then(() => vistaActual === 'maes' && renderMaestro()); return; }
  const M = MAPA_FREATICO, V = MS_VISTAS[msE.color], porCod = {};
  L.forEach(x => (porCod[x.s] = porCod[x.s] || []).push(x));
  const top = msCuenta(L, 'variedad').slice(0, 9).map(x => x[0]);
  const cats = V.cats || [...new Set(L.map(x => V.cat(x, top)))].sort((a, b) => a === 'Otras' ? 1 : b === 'Otras' ? -1 : 0);
  const color = c => V.esc ? (V.esc[cats.indexOf(c)] || '#cbd5e1') : (c === 'Otras' || c === '—' ? '#cbd5e1' : MS_PAL[cats.indexOf(c) % MS_PAL.length]);
  const dpr = window.devicePixelRatio || 1, ancho = caja.clientWidth, alto = Math.min(Math.round(ancho * M.alto / M.ancho), Math.round(window.innerHeight * 0.72));
  cv.width = ancho * dpr; cv.height = alto * dpr; cv.style.height = alto + 'px';
  const s = Math.min(ancho / M.ancho, alto / M.alto) * 0.96, ox = (ancho - M.ancho * s) / 2, oy = (alto - M.alto * s) / 2;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#eef2f6'; g.fillRect(0, 0, ancho, alto);
  const linea = (r, cerrar) => { for (let k = 0; k < r.length; k += 2) { const x = ox + r[k] * s, y = oy + (M.alto - r[k + 1]) * s; k ? g.lineTo(x, y) : g.moveTo(x, y); } if (cerrar) g.closePath(); };
  g.strokeStyle = '#7fb3e6'; g.lineWidth = 1.2; g.beginPath(); M.rios.forEach(r => linea(r)); g.stroke();
  const cuenta = {};
  M.suertes.forEach(su => {
    const xs = porCod[su[0]], x = xs && (xs.find(y => norm(y.hac).includes(norm(su[1])) || norm(su[1]).includes(norm(y.hac))) || xs[0]);
    g.beginPath(); su[3].forEach(r => linea(r, true));
    if (x) { const c = V.cat(x, top); g.fillStyle = color(c); cuenta[c] = (cuenta[c] || 0) + su[2]; } else g.fillStyle = '#f1f5f9';
    g.fill('evenodd'); g.strokeStyle = 'rgba(15,23,42,.35)'; g.lineWidth = 0.5; g.stroke();
  });
  q('ms-ley').innerHTML = cats.filter(c => cuenta[c]).map(c => `<span><i style="background:${color(c)}"></i>${esc(c)} <small class="meta">${msN(cuenta[c], 0)} ha</small></span>`).join('') + '<span><i style="background:#f1f5f9;border:1px solid #cbd5e1"></i>Sin datos con este filtro</span>';
  // Globo y ficha: celda de la malla → suerte de la cartografía → fila del maestro
  const G = frMalla(), tip = q('ms-tip');
  const enPunto = e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, wx = (px - ox) / s, wy = M.alto - (py - oy) / s;
    const gx = Math.floor(wx / FR_CELDA), gy = Math.floor((M.alto - wy) / FR_CELDA); if (gx < 0 || gy < 0 || gx >= G.W || gy >= G.H) return null;
    const c = G.celda[gy * G.W + gx]; if (c < 0) return null; const su = M.suertes[G.sue[c]], xs = porCod[su[0]];
    return {px, py, su, x:xs && (xs.find(y => norm(y.hac).includes(norm(su[1])) || norm(su[1]).includes(norm(y.hac))) || xs[0])}; };
  cv.onmousemove = e => { const p = enPunto(e); if (!p) { tip.hidden = true; return; }
    const x = p.x; tip.innerHTML = `<b>${esc(p.su[0])}</b> · ${esc(msHacN(p.su[1]))}${x ? `<br>${esc(x.variedad || '—')} · corte ${msN(x.nCorte)} · ${msN(x.edad, 1)} meses<br>${msN(x.area, 2)} ha · próximo corte ${msF(msProx(x))}` : '<br><span style="opacity:.8">Sin datos con este filtro</span>'}`;
    tip.hidden = false; tip.style.left = Math.min(p.px + 14, ancho - tip.offsetWidth - 4) + 'px'; tip.style.top = (p.py + 14 + tip.offsetHeight > alto ? p.py - tip.offsetHeight - 10 : p.py + 14) + 'px'; };
  cv.onmouseleave = () => tip.hidden = true;
  cv.onclick = e => { const p = enPunto(e); if (p && p.x) msFicha(p.x.s + '|' + p.x.hac); };
}

// Ficha de una suerte: datos y línea de tiempo (siembra → último corte → hoy → próximo corte)
function msFicha(clave){
  const [s, h] = clave.split('|'), x = msFilas().find(y => y.s === s && y.hac === h) || msFilas().find(y => y.s === s);
  const el = q('ms-ficha'); if (!el) return;
  if (!x) { el.innerHTML = ''; msE.ficha = null; return; }
  msE.ficha = clave;
  const hoy = new Date().toISOString().slice(0, 10), pts = [['Siembra', x.siembra, '#16a34a'], ['Último corte', x.ultCorte, '#d97706'], ['Hoy', hoy, '#0f172a'], ['Próximo corte', msProx(x), '#dc2626']].filter(p => p[1]);
  const t = p => Date.parse(p), t0 = Math.min(...pts.map(p => t(p[1]))), t1 = Math.max(...pts.map(p => t(p[1]))), X = d => 4 + (t(d) - t0) / ((t1 - t0) || 1) * 92;
  const otros = msFilas().filter(y => y.s === s && y !== x);
  const dato = (l, v) => `<div><small>${l}</small><b>${v}</b></div>`;
  el.innerHTML = `<div class="ms-fondo" data-ms-cerrar><div class="ms-ficha" role="dialog">
    <button type="button" class="ms-x" data-ms-cerrar title="Cerrar">✕</button>
    <div class="ms-fh"><span class="ms-cod">${esc(x.s)}</span><div><b>${esc(msHacN(x.hac))}</b><small>Zona ${esc(x.zona ?? '—')} · ${esc(x.emp ?? '')} · ${esc(x.uso ?? '')} · ${esc(x.estado ?? '')}</small></div></div>
    <div class="ms-datos">${dato('Área neta', msN(x.area, 2) + ' ha')}${dato('Variedad', esc(x.variedad || '—'))}${dato('N° de corte', msN(x.nCorte))}${dato('Ciclo de vida', msN(x.ciclo))}
      ${dato('Edad hoy', msN(x.edad, 1) + ' meses')}${dato('Edad estándar de corte', msN(x.edadStd, 1) + ' meses')}${dato('TCH presupuesto', msN(x.tchPpto, 1))}${dato('TCH aforo', msN(x.tchAforo, 1))}
      ${dato('Toneladas ppto', msN(x.tonPpto))}${dato('Toneladas estimadas', msN(x.tonEst))}${dato('Tipo de finca', esc(x.tipoFinca || '—'))}${dato('Zona agroecológica', esc(x.zonaAgro || '—'))}
      ${x.lucro ? dato('Días lucro cesante', msN(x.lucro)) : ''}${x.quema ? dato('Restricción de quema', esc(x.quema)) : ''}</div>
    ${x.edad != null && x.edadStd ? `<div class="ms-edad"><small>Edad hoy frente a la edad estándar de corte</small><div><i style="width:${Math.min(100, x.edad / x.edadStd * 100)}%;background:${x.edad >= x.edadStd ? '#dc2626' : '#16a34a'}"></i></div><span>${msN(x.edad / x.edadStd * 100)}%${x.edad >= x.edadStd ? ' · ya cumplió la edad de corte' : ''}</span></div>` : ''}
    <div class="ms-linea"><div class="ms-eje"></div>${pts.map(([l, d, c], i) => `<div class="ms-hito" style="left:${X(d)}%;--c:${c}"><i></i><span class="${i % 2 ? 'abajo' : ''}"><b>${l}</b>${msF(d)}</span></div>`).join('')}</div>
    ${otros.length ? `<div class="meta">También aparece en el maestro como: ${otros.map(o => `${esc(msHacN(o.hac))} (${esc(o.uso || '')}, ${msN(o.area, 2)} ha)`).join(', ')}</div>` : ''}
  </div></div>`;
}

q('maestro').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-ms-servidor]')) { msDesdeServidor(true); return; }
  const em = t.closest('[data-ms-emp]'); if (em) { msE.emp = em.dataset.msEmp; msE.zona = msE.hac = msE.uso = msE.estado = msE.variedad = ''; renderMaestro(); return; }
  const co = t.closest('[data-ms-color]'); if (co) { msE.color = co.dataset.msColor; renderMaestro(); return; }
  const or = t.closest('[data-ms-orden]'); if (or) { const k = or.dataset.msOrden; msE.asc = msE.orden === k ? !msE.asc : true; msE.orden = k; renderMaestro(); return; }
  if (t.closest('[data-ms-limpiar]')) { msE.zona = msE.hac = msE.uso = msE.estado = msE.variedad = msE.txt = ''; renderMaestro(); return; }
  if (t.closest('[data-ms-mas]')) { msE.mas = true; renderMaestro(); return; }
  if (t.closest('.ms-x') || (t.classList && t.classList.contains('ms-fondo'))) { msE.ficha = null; q('ms-ficha').innerHTML = ''; return; }
  const fi = t.closest('[data-ms-ficha]'); if (fi) msFicha(fi.dataset.msFicha);
});
q('maestro').addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'ms-archivo') { msCargarArchivo(t.files[0]); t.value = ''; return; }
  const k = {'ms-zona':'zona', 'ms-hac':'hac', 'ms-uso':'uso', 'ms-estado':'estado', 'ms-variedad':'variedad'}[t.id];
  if (k) { msE[k] = t.value; renderMaestro(); }
});
q('maestro').addEventListener('input', e => { if (e.target.id === 'ms-txt') { msE.txt = e.target.value; const p = e.target.selectionStart; renderMaestro(); const i = q('ms-txt'); i.focus(); i.setSelectionRange(p, p); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && msE.ficha && q('ms-ficha')) { msE.ficha = null; q('ms-ficha').innerHTML = ''; } });
