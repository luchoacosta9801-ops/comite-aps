// "Inge Virtual": asistente de preguntas del portal. No usa inteligencia artificial ni envía
// nada fuera de la página: entiende preguntas por palabras clave y responde con los datos
// publicados (comité APS, simulador, agronomía, presupuesto 2027, estructura) y con un
// glosario de labores agrícolas, mecanización, drenajes y obras civiles.

const IV = (() => {
  const n = t => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tiene = (t, ...pal) => pal.some(p => new RegExp('(^|\\W)' + p, 'i').test(t));
  const ha = v => f2(v) + ' ha';
  const lista = a => a.length ? '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>' : '';
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1).toLowerCase();

  // ── Glosario: labores, mecanización, drenajes y obras civiles ──
  const GLOSARIO = [
    {k:['descepada','descepar'], t:'Descepada', d:'Labor que arranca y destruye la cepa (raíces y tocones) del cultivo anterior para renovar la suerte. Se hace con rastras pesadas o descepadoras; se cobra por pase/ha (1, 2 o 3 pases según qué tan dura esté la cepa).'},
    {k:['subsuelo','subsolado','subsolador','subsolar'], t:'Subsuelo', d:'Rompe las capas compactadas del suelo a 50–60 cm de profundidad con brazos (sencillo, parabólico, triple, cenitandem, topo). Mejora la infiltración, el drenaje interno y el enraizamiento. Se cobra por pase/ha y la separación entre brazos (1x1, 2x1, 4x1) define cuánto se trabaja.'},
    {k:['rastra','rastrillo','rastrillada','pulida','pulir'], t:'Rastra y pulida', d:'La rastra (arada de discos de 36") voltea y desmenuza los terrones después del subsuelo. La pulida o rastrillada (discos de 26") deja la cama fina y pareja para surcar. Normalmente la pulida lleva 1–2 pases.'},
    {k:['surcada','surcar','surco','surcador'], t:'Surcada', d:'Abre los surcos donde se siembra la caña (en Riopaila normalmente a 1.5–1.75 m entre surcos). Es la última labor de preparación: una suerte surcada queda lista para siembra.'},
    {k:['nivelacion','nivelar','land plane','landplane','n1','n2','n3','n4'], t:'Nivelación', d:'Corrige el relieve para que el agua de riego corra y drene de forma uniforme. Puede ser por m³ movidos con GPS/láser, por hectárea según el movimiento (bajo < 240 m³/ha, medio 240–400, medio-alto) o con land plane (niveladora de arrastre para el afinado final). En el presupuesto 2027, N1 a N4 indican de mínimo a muy alto movimiento de tierra.'},
    {k:['canterizador','canterizar','cantero'], t:'Canterizador', d:'Implemento que conforma canteros o camas elevadas para mejorar el drenaje superficial en suelos pesados o con nivel freático alto.'},
    {k:['arado cincel','cincel'], t:'Arado cincel', d:'Labranza vertical que afloja el suelo sin voltearlo, a menor profundidad que el subsuelo. Conserva mejor la estructura del suelo que la rastra.'},
    {k:['bandereo','banderear','bandera'], t:'Bandereo', d:'Marcación en campo con banderas (en metros) que guía la siembra, los surcos o los trazos de diseño antes de entrar con la maquinaria.'},
    {k:['semillero','semilla'], t:'Semillero', d:'Suerte que provee la semilla (trozos de tallo) para sembrar otra. En la ruta de siembra se indica de qué semillero sale la semilla de cada suerte.'},
    {k:['dias de lucro','lucro','lucro cesante'], t:'Días de lucro', d:'Días que la suerte lleva sin producir desde el último corte (cosecha) mientras pasa por la renovación. Mientras más días, más se pierde por tener la tierra parada; por eso se priorizan las suertes con más días.'},
    {k:['renovacion','renovar','plantilla','soca'], t:'Renovación', d:'Cuando una suerte de caña baja su producción después de varios cortes (socas), se renueva: se destruye la cepa, se prepara el suelo y se siembra de nuevo (la primera cosecha es la "plantilla"). El comité APS sigue ese proceso: adecuación, preparación y siembra.'},
    {k:['aps','adecuacion','preparacion'], t:'APS', d:'Adecuación, Preparación y Siembra. Agrupa las labores para renovar una suerte: adecuación (topografía, nivelación, drenajes, vías), preparación (descepada, subsuelo, rastra, pulida, surcada) y siembra.'},
    {k:['topografia','levantamiento','altimetrico','planimetrico','perfiles','agform','diseño 3d'], t:'Topografía', d:'Levantamiento altimétrico (alturas) y planimétrico (linderos y áreas) para diseñar nivelación, riego y drenajes. El diseño 3D (AgForm) calcula cortes y rellenos para nivelar con GPS.'},
    {k:['motoniveladora','motoniveladoras'], t:'Motoniveladora', d:'Máquina amarilla con cuchilla central para conformar y mantener vías, cunetas, rondas y terraplenes. Se cobra por hora.'},
    {k:['retroexcavadora','retro','excavadora','miniexcavadora','oruga','enllantada'], t:'Retroexcavadora', d:'Excava canales, zanjas de drenaje, limpia acequias y carga material. La enllantada es más rápida entre sitios; la de oruga (ej. CAT 312) tiene más fuerza y estabilidad en terreno blando. Se cobra por hora.'},
    {k:['bulldozer','buldozer','buldocer','bulldocer','d5','topadora'], t:'Bulldozer', d:'Tractor de orugas con hoja frontal para mover grandes volúmenes de tierra: conformación de lotes, rondas, diques y nivelación gruesa. Se cobra por hora o por m³.'},
    {k:['camabaja','cama baja'], t:'Camabaja', d:'Tractomula con plataforma baja para trasladar maquinaria pesada entre haciendas. Se cobra por movimiento según la distancia (0–5 km, > 5 km).'},
    {k:['balasto','afirmado','recebo'], t:'Balasto', d:'Material granular (piedra y arena) para afirmar vías internas y rampas. El "limpio" tiene menos finos y drena mejor que el "sucio". Se paga por m³ transportado.'},
    {k:['dique','diques','jarillon','terraplen'], t:'Diques', d:'Terraplenes de tierra compactada que protegen las suertes de inundaciones de ríos y zanjones. Se revisan (grietas, filtraciones, madrigueras, erosión), se mantienen y se mejoran con plan anual.'},
    {k:['drenaje','drenajes','entubado','freatico','freatimetro','freatimetrico','conductividad'], t:'Drenajes', d:'Sacan el exceso de agua del suelo. Los estudios freatimétricos miden el nivel del agua subterránea con pozos de observación; la conductividad hidráulica mide qué tan rápido pasa el agua por el suelo. Con eso se diseñan drenajes abiertos (zanjas) o entubados (tubería perforada enterrada).'},
    {k:['riego','acequia','canal','canales','compuerta','sifon'], t:'Riego', d:'En caña se riega casi siempre por gravedad (surcos alimentados por acequias y canales con compuertas o sifones). La nivelación y la pendiente del surco definen qué tan uniforme queda el riego.'},
    {k:['alcantarilla','box culvert','box coulvert','puente','obra de arte','obras civiles','cabezote'], t:'Obras civiles de campo', d:'Obras menores para el riego, el drenaje y las vías: alcantarillas en tubo o box culvert, cabezotes, compuertas, pasos de agua, revestimiento de canales y mantenimiento de infraestructura administrativa y viviendas.'},
    {k:['compactacion','compactado','pisoteo'], t:'Compactación', d:'Endurecimiento del suelo por el paso de maquinaria y cosecha, sobre todo en suelo húmedo. Reduce raíces e infiltración; se corrige con subsuelo y se previene con tráfico controlado y entrando con el suelo en el punto de humedad adecuado.'},
    {k:['abono mecanico','abonar','fertilizacion'], t:'Abono mecánico', d:'Aplicación de fertilizante con abonadora acoplada al tractor, a tasa fija por hectárea, en plantillas o socas (2x1 o 4x1 según los surcos que cubre por pase).'},
    {k:['variedad','variedades','cc 01-1940','cenicana'], t:'Variedades', d:'Las variedades CC (de Cenicaña, Colombia), como CC 01-1940, CC 11-595 o CC 13-2035, se eligen por productividad, contenido de sacarosa y adaptación a cada zona agroecológica.'},
    {k:['zona agroecologica','agroecologica'], t:'Zona agroecológica', d:'Clasificación de cada suerte por suelo y humedad (ej. 1H2). Sirve para escoger la variedad más adecuada.'},
    {k:['combustible','acpm','tanqueo','aforo'], t:'Combustible', d:'Administración del ACPM de la maquinaria: entregas, registro de tanqueos y aforos (medir el consumo real de cada equipo por hora o por hectárea).'},
  ];

  // ── Datos ──
  const haciendas = () => [...new Set([...HACS_BASE, ...DB.lotes.map(l => l.h), ...DB.proceso.map(r => r.hac), ...DB.ruta.map(r => r.h),
    ...((typeof ppto2027 === 'function' && ppto2027().suertes) || []).map(s => s.h)])].filter(Boolean);
  function hacEn(t){
    const H = haciendas().map(h => [h, n(h)]).sort((a, b) => b[1].length - a[1].length);
    const f = H.find(([, h]) => (' ' + t + ' ').includes(' ' + h + ' ')) || H.find(([, h]) => h.length > 4 && t.includes(h.replace(/^la /, '')));
    return f ? f[0] : null;
  }
  const todasSuertes = () => {
    const S = new Map(), add = (s, h) => { if (s && h) S.set(h + '|' + s, {s, h}); };
    DB.lotes.forEach(l => add(l.s, l.h)); DB.proceso.forEach(r => add(r.sue, r.hac)); DB.ruta.forEach(r => add(r.s, r.h));
    ((typeof ppto2027 === 'function' && ppto2027().suertes) || []).forEach(x => add(x.s, x.h));
    return [...S.values()];
  };
  function suertesEn(t, hac){
    const S = todasSuertes();
    const full = t.match(/\b(\d{4})\s*-?\s*(\d{3})\b/);
    if (full) return S.filter(x => x.s === `${full[1]}-${full[2]}` && (!hac || x.h === hac));
    // Número de suerte suelto ("la 050", "suerte 50"), sin confundir con zona, semana, año o cantidades
    const limpio = t.replace(/\b(zona|semana|sem|top|mes|ano|año|las|los)\s+\d+/g, ' ').replace(/\b\d+\s*(ha|has|hectareas|dias|m3|km)\b/g, ' ');
    const nums = [...limpio.matchAll(/\b(\d{1,3})\b/g)].map(m => m[1].padStart(3, '0'));
    if (!nums.length) return [];
    return S.filter(x => nums.includes(x.s.split('-')[1]) && (!hac || x.h === hac));
  }

  function fichaSuerte({s, h}){
    const L = DB.lotes.filter(l => l.s === s && l.h === h), P = DB.proceso.find(r => r.sue === s && r.hac === h);
    const Pa = DB.procesoAnterior && DB.procesoAnterior.items.find(r => r.sue === s && r.hac === h);
    const R = DB.ruta.find(r => r.s === s && r.h === h);
    const Q = ((typeof ppto2027 === 'function' && ppto2027().suertes) || []).find(x => x.s === s && x.h === h);
    const A = typeof agroFilas === 'function' ? agroFilas().filter(x => x.s === s && x.h === h) : [];
    const S = P && typeof simSuerte === 'function' ? simSuerte(P) : null;
    const area = (L[0] && L[0].a) || (P && P.area) || (R && R.a) || (Q && Q.a) || 0;
    const z = (L[0] && L[0].z) || (P && P.z) || (Q && Q.z) || zonaDe(h);
    const dias = (P && P.dias) || (L.find(l => l.e !== 'SEMBRADA') || L[0] || {}).d || (R && R.d);
    const filas = [];
    L.forEach(l => filas.push(`<b>${l.e === 'SEMBRADA' ? '✅ Sembrada' : '⏳ Pendiente de siembra'}</b> · ${esc(cap(l.c))} · ${l.d} días de lucro · variedad ${esc(l.v || '—')}${l.p === 'NO' ? ' · <i>fuera del presupuesto</i>' : ''}`));
    if (P) filas.push(`🚜 En proceso: labor <b>${esc(cap(P.labor))}</b> · contratista ${esc(P.cont || '—')}${P.obs ? ` · "${esc(P.obs)}"` : ''}`);
    if (Pa && P && norm(Pa.labor) !== norm(P.labor)) filas.push(`↩️ La semana anterior (${esc(DB.procesoAnterior.semana)}) estaba en ${esc(cap(Pa.labor))}`);
    if (R) filas.push(`🌱 En ruta de siembra · variedad ${esc(R.variedad || '—')} · semillero ${esc(R.semillero || '—')}${R.bandereo ? ` · bandereo ${R.bandereo} m` : ''} · ${esc(R.cont || '—')}`);
    if (S && S.total) filas.push(`💰 Costo proyectado ${moneyM(S.total)} (${money(S.proy)}/ha) vs ppto ${moneyM(S.pptoTotal)} → ${S.dif >= 0 ? 'ahorro' : 'sobrecosto'} ${money(Math.abs(S.dif))}/ha`);
    A.filter(a => a.fecha || a.obs).forEach(a => filas.push(`📋 Agronomía: ${a.fecha ? 'siembra ' + fechaLarga(a.fecha) : 'sin fecha de siembra'}${a.obs ? ` · "${esc(a.obs)}"` : ''}`));
    if (Q) filas.push(`📅 Presupuesto 2027: renovación en <b>${MESES[Q.mes - 1] || '—'}</b> · ${esc(Q.vAct || '—')} → ${esc(Q.v1 || '—')}${Q.niv ? ` · nivelación ${Q.niv}` : ''}`);
    return {area, z, dias, L, P, R, Q, html:`<div class="iv-ficha"><div class="iv-ficha-t">Suerte <b>${esc(s)}</b> · ${esc(h)} · Z${z} · ${ha(area)}</div>${lista(filas)}
      <button type="button" class="iv-ir" data-iv-sue="${esc(s)}" data-iv-hac="${esc(h)}">Ver en el dashboard →</button></div>`};
  }

  function resumenHacienda(h){
    const L = DB.lotes.filter(l => l.h === h), sem = L.filter(l => l.e === 'SEMBRADA'), pen = L.filter(l => l.e !== 'SEMBRADA');
    const P = DB.proceso.filter(r => r.hac === h), R = DB.ruta.filter(r => r.h === h);
    const Q = ((typeof ppto2027 === 'function' && ppto2027().suertes) || []).filter(x => x.h === h);
    const it = [];
    if (L.length) it.push(`Comité ${esc(DB.meta.semana)}: <b>${sem.length}</b> sembradas (${ha(sum(sem, l => l.a))}) y <b>${pen.length}</b> pendientes (${ha(sum(pen, l => l.a))})`);
    if (P.length) it.push(`En proceso: ${P.map(r => `${esc(r.sue)} (${esc(cap(r.labor))}, ${r.dias} días)`).join(', ')}`);
    if (R.length) it.push(`En ruta de siembra: ${R.map(r => esc(r.s)).join(', ')}`);
    if (Q.length) it.push(`Presupuesto 2027: ${Q.length} suertes · ${ha(sum(Q, x => x.a))}`);
    if (!it.length) return `No encontré datos de <b>${esc(h)}</b> en el comité ni en el presupuesto 2027.`;
    return `<b>Hacienda ${esc(h)}</b> (zona ${zonaDe(h)})${lista(it)}<button type="button" class="iv-ir" data-iv-hac="${esc(h)}">Ver hacienda en el dashboard →</button>`;
  }

  function totales(z){
    const L = DB.lotes.filter(l => !z || l.z === z), sem = L.filter(l => l.e === 'SEMBRADA'), pen = L.filter(l => l.e !== 'SEMBRADA');
    const hs = sum(sem, l => l.a), pptoZ = z ? sum(DB.pptoMensual['z' + z]) : DB.meta.pptoTotal;
    return `<b>${z ? 'Zona ' + z : 'Total'} · ${esc(DB.meta.semana)} (${esc(DB.meta.fecha)})</b>${lista([
      `Sembradas: <b>${ha(hs)}</b> en ${sem.length} suertes (caña ${ha(sum(sem.filter(l => l.c === 'CAÑA'), l => l.a))} · arroz ${ha(sum(sem.filter(l => l.c === 'ARROZ'), l => l.a))})`,
      `Pendientes: <b>${ha(sum(pen, l => l.a))}</b> en ${pen.length} suertes`,
      pptoZ ? `Avance vs presupuesto (${ha(pptoZ)}): <b>${(hs / pptoZ * 100).toFixed(1)}%</b> · faltan ${ha(Math.max(0, pptoZ - hs))}` : '',
      `En proceso: ${DB.proceso.filter(r => !z || r.z === z).length} suertes · en ruta de siembra: ${DB.ruta.filter(r => !z || zonaDe(r.h) === z).length}`,
    ].filter(Boolean))}`;
  }

  function porLaborTxt(lab){
    const P = DB.proceso.filter(r => !lab || norm(r.labor).includes(norm(lab)));
    if (lab && !P.length) return `Ninguna suerte está hoy en <b>${esc(cap(lab))}</b> (${esc(DB.meta.semana)}).`;
    const g = {}; P.forEach(r => (g[cap(r.labor)] = g[cap(r.labor)] || []).push(r));
    return `<b>Suertes en proceso · ${esc(DB.meta.semana)}</b>${lista(Object.entries(g).map(([k, v]) => `<b>${esc(k)}</b> (${ha(sum(v, r => r.area))}): ${v.map(r => `${esc(r.sue)} ${esc(r.hac)} · ${esc(r.cont || '—')}`).join('; ')}`))}`;
  }

  const contratistasTodos = () => [...new Set([...(typeof contratistas === 'function' ? contratistas() : []), ...DB.proceso.map(r => r.cont),
    ...((DB.sim && DB.sim.tarifas) || (typeof simData === 'function' && simData().tarifas) || []).map(t => t.contratista)].filter(Boolean))];
  const tarifas = () => (typeof simData === 'function' ? simData().tarifas : (DB.sim && DB.sim.tarifas)) || [];
  function contratistaEn(t){
    return contratistasTodos().map(c => [c, n(c)]).sort((a, b) => b[1].length - a[1].length)
      .find(([, c]) => t.includes(c) || (c.split(' ')[0].length > 4 && t.includes(c.split(' ')[0])));
  }

  function buscarTarifas(t, cont){
    const ign = new Set('cuanto cuesta vale valor precio tarifa tarifas costo de la el del por en a que y una un con los las pase ha hectarea'.split(' '));
    const pal = t.split(' ').filter(w => w.length > 3 && !ign.has(w));
    const T = tarifas().filter(x => (!cont || x.contratista === cont) && (!pal.length || pal.some(w => n(x.desc).includes(w.slice(0, 5)))));
    if (!T.length) return null;
    return `<b>Tarifas${cont ? ' de ' + esc(cont) : ''}</b> (simulador)${lista(T.slice(0, 10).map(x => `${esc(x.desc)} · <b>${money(x.costo)}</b>/${esc(x.unidad)} · ${esc(x.contratista)}`))}${T.length > 10 ? `<small>…y ${T.length - 10} más en el 💰 Simulador.</small>` : ''}`;
  }

  function personas(t){
    if (typeof estructura !== 'function') return null;
    const E = estructura(), res = [];
    E.personas.forEach(p => { if (p.nombre && n(p.nombre).split(' ').some(w => w.length > 3 && t.includes(w))) res.push(`<b>${esc(p.nombre)}</b> · ${esc(p.cargo)}${p.equipo ? ' · ' + esc(p.equipo) : ''}`); });
    if (tiene(t, 'responsable', 'quien', 'encargado', 'a cargo')) {
      (E.procesos || []).forEach(p => { const k = n(p.especifico + ' ' + p.general); if (t.split(' ').some(w => w.length > 4 && !['responsable', 'encargado', 'quien'].includes(w) && k.includes(w.slice(0, 6)))) res.push(`${esc(p.especifico)} → <b>${esc(p.responsable)}</b>`); });
    }
    return res.length ? `<b>Estructura del área</b>${lista([...new Set(res)].slice(0, 10))}` : null;
  }

  function ppto27(t){
    const P = typeof ppto2027 === 'function' ? ppto2027() : null; if (!P || !(P.suertes || []).length) return 'Aún no hay programa 2027 cargado.';
    const mi = MESES.findIndex(m => t.includes(n(m))), mesesL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const mm = mi >= 0 ? mi : mesesL.findIndex(m => t.includes(m));
    const S = P.suertes.filter(s => mm < 0 || s.mes === mm + 1);
    const tot = sum(S, s => s.a);
    return `<b>Presupuesto APS 2027${mm >= 0 ? ' · ' + cap(mesesL[mm]) : ''}</b>${lista([
      `${S.length} suertes · <b>${ha(tot)}</b> (Z1 ${ha(sum(S.filter(s => s.z === 1), s => s.a))} · Z2 ${ha(sum(S.filter(s => s.z === 2), s => s.a))})`,
      typeof pptoHa2027 === 'function' ? `Inversión estimada: <b>${moneyM(tot * pptoHa2027(P))}</b>` : '',
      mm >= 0 ? S.map(s => `${esc(s.s)} ${esc(s.h)}`).slice(0, 15).join(', ') + (S.length > 15 ? '…' : '') : 'Pregunta por un mes, ej. "¿qué se renueva en marzo 2027?"',
    ].filter(Boolean))}`;
  }

  const AYUDA = `Soy el <b>Inge Virtual</b> 👷. Respondo con los datos publicados del portal y sé de labores, mecanización, drenajes y obras civiles. Prueba:`;
  const EJEMPLOS = ['¿Días de lucro de la 050 de Normandía?', '¿En qué estado está la 3501-050?', '¿Cómo va la zona 2?', '¿Qué suertes están en subsuelo?', '¿Qué es la descepada?', '¿Cuánto cuesta la surcada de Riocast?', 'Ruta de siembra', '¿Qué se renueva en marzo 2027?'];

  function responder(pregunta){
    const t = n(pregunta);
    if (!t) return AYUDA;
    if (/^(hola|buenas|buenos|hey|que mas|saludos)\b/.test(t) && t.split(' ').length < 4) return `¡Hola! ${AYUDA}`;
    if (tiene(t, 'ayuda', 'que sabes', 'que puedes', 'como funciona')) return AYUDA;
    if (tiene(t, 'gracias')) return 'Con gusto 👷. ¿Algo más?';

    const hac = hacEn(t), S = suertesEn(t, hac);
    // 1) Una suerte concreta
    if (S.length === 1) {
      const F = fichaSuerte(S[0]); let frase = '';
      if (tiene(t, 'lucro', 'dias')) frase = F.dias != null ? `La suerte ${esc(S[0].s)} de ${esc(S[0].h)} tiene <b>${F.dias} días de lucro</b>.` : 'No tengo días de lucro para esa suerte.';
      else if (tiene(t, 'estado', 'como va', 'como esta', 'en que va')) frase = F.P ? `Está en <b>${esc(cap(F.P.labor))}</b>.` : F.L.some(l => l.e === 'SEMBRADA') ? 'Está <b>sembrada</b>.' : F.R ? 'Está <b>en ruta de siembra</b>.' : F.L.length ? 'Está <b>pendiente</b> y no aparece en labores esta semana.' : F.Q ? 'No está en el comité actual; está en el <b>programa 2027</b>.' : '';
      else if (tiene(t, 'area', 'hectarea', 'cuantas ha', 'tamano')) frase = `Tiene <b>${ha(F.area)}</b>.`;
      else if (tiene(t, 'variedad')) { const v = (F.R && F.R.variedad) || (F.L[0] && F.L[0].v) || (F.Q && F.Q.v1); frase = v ? `Variedad: <b>${esc(v)}</b>.` : 'No tengo variedad registrada.'; }
      else if (tiene(t, 'contratista', 'quien')) frase = F.P ? `Contratista: <b>${esc(F.P.cont || '—')}</b>.` : F.R ? `Contratista de siembra: <b>${esc(F.R.cont || '—')}</b>.` : '';
      return (frase ? frase + '<br>' : '') + F.html;
    }
    if (S.length > 1) return `Encontré ${S.length} suertes con ese número. ¿Cuál?${lista(S.slice(0, 12).map(x => `<a href="#" class="iv-preg" data-q="${esc(x.s)} ${esc(x.h)}">${esc(x.s)} · ${esc(x.h)}</a>`))}`;
    if (/\b\d{1,3}\b/.test(t) && hac && tiene(t, 'suerte', 'ste', 'la ')) return `No encontré esa suerte en ${esc(hac)}. ${resumenHacienda(hac)}`;

    // 2) Glosario (qué es, para qué sirve…) antes que listas, si lo pide explícito
    const g = GLOSARIO.find(x => x.k.some(k => t.includes(k)));
    const definir = tiene(t, 'que es', 'que son', 'para que', 'como se hace', 'explica', 'definicion', 'significa', 'diferencia', 'cual es la funcion', 'sirve');
    if (g && definir) return `<b>${g.t}</b><br>${g.d}`;

    // 3) Tarifas / costos
    const c = contratistaEn(t);
    if (tiene(t, 'tarifa', 'cuanto cuesta', 'cuanto vale', 'precio', 'valor de')) { const r = buscarTarifas(t, c && c[0]); if (r) return r; }
    if (tiene(t, 'costo', 'simulador', 'sobrecosto', 'ahorro') && typeof simSuertes === 'function') {
      const L = simSuertes(), tot = sum(L, s => s.total), pp = sum(L, s => s.pptoTotal);
      return `<b>Simulador · suertes en proceso</b>${lista([`Costo proyectado <b>${moneyM(tot)}</b> vs presupuesto ${moneyM(pp)} → ${pp - tot >= 0 ? 'ahorro' : 'sobrecosto'} <b>${moneyM(Math.abs(pp - tot))}</b>`,
        ...L.map(s => `${esc(s.r.sue)} ${esc(s.r.hac)}: ${moneyM(s.total)} (${s.dif >= 0 ? 'ahorro' : 'sobrecosto'} ${money(Math.abs(s.dif))}/ha)`)])}`;
    }
    // 4) Contratista
    if (c) {
      const P = DB.proceso.filter(r => r.cont === c[0]), R = DB.ruta.filter(r => r.cont === c[0]), T = tarifas().filter(x => x.contratista === c[0]);
      return `<b>${esc(c[0])}</b>${lista([P.length ? `En proceso: ${P.map(r => `${esc(r.sue)} ${esc(r.hac)} (${esc(cap(r.labor))})`).join(', ')}` : 'Sin suertes en proceso esta semana',
        R.length ? `En ruta de siembra: ${R.map(r => esc(r.s)).join(', ')}` : '', T.length ? `${T.length} tarifas en el simulador (pregunta "tarifas de ${esc(cap(c[0]))}")` : ''].filter(Boolean))}`;
    }
    // 5) Labores en proceso
    const labores = ['descepada', 'nivelacion', 'land plane', 'subsuelo', 'rastra', 'pulida', 'surcada', 'canterizador'];
    const lab = labores.find(l => t.includes(l));
    if (lab && !definir && tiene(t, 'suertes', 'cuales', 'que', 'en ', 'cuantas', 'hay')) return porLaborTxt(lab);
    if (tiene(t, 'labores', 'en proceso', 'proceso')) return porLaborTxt('');
    // 6) Ruta de siembra
    if (tiene(t, 'ruta', 'por sembrar', 'proximas a sembrar', 'siembra esta semana')) return DB.ruta.length
      ? `<b>Ruta de siembra · ${esc(DB.meta.semana)}</b>${lista(DB.ruta.map(r => `${esc(r.s)} ${esc(r.h)} · ${ha(r.a)} · ${esc(r.variedad || '—')} · semillero ${esc(r.semillero || '—')} · ${esc(r.cont || '—')}`))}` : 'No hay suertes en ruta de siembra esta semana.';
    // 7) Presupuesto 2027
    if (tiene(t, '2027', 'renovacion', 'renueva', 'renovar')) return ppto27(t);
    // 8) Personas y procesos
    const pe = personas(t); if (pe) return pe;
    // 9) Mayor lucro / prioridad
    if (tiene(t, 'mas dias', 'mayor', 'prioridad', 'priorizar', 'mas atrasad', 'urgente')) {
      const pen = DB.lotes.filter(l => l.e !== 'SEMBRADA').sort((a, b) => b.d - a.d);
      return `<b>Pendientes con más días de lucro</b>${lista(pen.slice(0, 8).map(l => `${esc(l.s)} ${esc(l.h)} · <b>${l.d} días</b> · ${ha(l.a)}`))}`;
    }
    // 10) Zona / hacienda / totales
    const z = t.match(/\bzona\s*([12])\b/);
    if (hac) return resumenHacienda(hac);
    if (z) return totales(+z[1]);
    if (tiene(t, 'sembrad', 'avance', 'cuantas hectareas', 'total', 'pendiente', 'falta', 'presupuesto', 'ppto', 'cumplimiento', 'resumen', 'como vamos')) return totales(null);
    if (tiene(t, 'agronomia', 'fecha de siembra') && typeof agroFilas === 'function') {
      const A = agroFilas(); return `<b>Gestión Agronomía</b>${lista([`${A.length} suertes · ${ha(sum(A, x => x.a))}`, `${A.filter(x => x.fecha).length} con fecha de siembra registrada`])}`;
    }
    if (g) return `<b>${g.t}</b><br>${g.d}`;
    return `No entendí bien 🤔. Puedo responder sobre suertes (por número y hacienda), haciendas, zonas, labores en proceso, ruta de siembra, costos y tarifas, presupuesto 2027, el equipo, y explicar labores y obras.`;
  }
  return {responder, AYUDA, EJEMPLOS};
})();

// ── Ventana del chat ──
(function(){
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'iv-fab'; btn.title = 'Inge Virtual: pregúntame sobre suertes, labores y obras';
  btn.innerHTML = '<span>👷</span><b>Inge Virtual</b>';
  const win = document.createElement('div');
  win.className = 'iv-win'; win.hidden = true;
  win.innerHTML = `<div class="iv-h"><span class="iv-av">👷</span><div><b>Inge Virtual</b><small>Ingeniería Agrícola · Riopaila Agrícola</small></div><button type="button" class="iv-x" title="Cerrar">✕</button></div>
    <div class="iv-msgs" id="iv-msgs"></div>
    <form class="iv-f" id="iv-f"><input id="iv-in" type="text" autocomplete="off" placeholder="Escribe tu pregunta…"><button type="submit">➤</button></form>`;
  document.body.append(btn, win);
  const msgs = win.querySelector('#iv-msgs'), inp = win.querySelector('#iv-in');
  const poner = (html, quien) => { const d = document.createElement('div'); d.className = 'iv-m ' + quien; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; };
  const chips = () => `<div class="iv-chips">${IV.EJEMPLOS.map(e => `<button type="button" class="iv-preg" data-q="${esc(e)}">${esc(e)}</button>`).join('')}</div>`;
  let iniciado = false;
  function abrir(si){
    win.hidden = !si; btn.classList.toggle('on', si);
    if (si && !iniciado) { iniciado = true; poner(IV.AYUDA + chips(), 'bot'); }
    if (si) setTimeout(() => inp.focus(), 50);
  }
  function preguntar(txt){
    if (!txt.trim()) return;
    poner(esc(txt), 'yo');
    let r; try { r = IV.responder(txt); } catch (e) { console.error(e); r = 'Tuve un problema leyendo los datos 😕. Intenta de otra forma.'; }
    setTimeout(() => poner(r, 'bot'), 180);
  }
  btn.addEventListener('click', () => abrir(win.hidden));
  win.querySelector('.iv-x').addEventListener('click', () => abrir(false));
  win.querySelector('#iv-f').addEventListener('submit', e => { e.preventDefault(); preguntar(inp.value); inp.value = ''; });
  msgs.addEventListener('click', e => {
    const p = e.target.closest('.iv-preg'); if (p) { e.preventDefault(); preguntar(p.dataset.q); return; }
    const b = e.target.closest('.iv-ir'); if (!b) return;
    const {ivSue:sue, ivHac:hac} = b.dataset;
    if (window.innerWidth < 760) abrir(false);
    irA('aps');
    F.hac = hac; q('sel-hac').value = hac; q('sel-hac').className = 'fsel on'; estadoTabla = 'all'; render();
    const row = sue && [...q('lotes-tbody').querySelectorAll('tr')].find(r => r.dataset.sue === sue);
    if (row) { row.scrollIntoView({behavior:'smooth', block:'center'}); row.style.background = '#fff3cd'; setTimeout(() => row.style.background = '', 1800); }
  });
})();
