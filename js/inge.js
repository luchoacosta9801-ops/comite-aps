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
    // ── Suelos ──
    {k:['textura','arcilla','arcilloso','limo','limoso','arenoso','franco'], t:'Textura del suelo', d:'Proporción de arena, limo y arcilla. Los suelos arcillosos retienen más agua y nutrientes pero drenan lento y se compactan; los arenosos drenan rápido y retienen poco; los francos son los más equilibrados para la caña.'},
    {k:['densidad aparente'], t:'Densidad aparente', d:'Masa de suelo seco por volumen (g/cm³). Valores altos (más de 1.5–1.6 en suelos finos) indican compactación y restricción de raíces.'},
    {k:['penetrometro','resistencia a la penetracion'], t:'Penetrómetro', d:'Instrumento que mide la resistencia del suelo a la penetración (kPa o MPa) para ubicar capas compactadas y decidir profundidad de subsuelo. Por encima de ~2 MPa las raíces crecen con dificultad.'},
    {k:['capacidad de campo','punto de marchitez','agua disponible','humedad del suelo'], t:'Humedad del suelo', d:'Capacidad de campo: agua que queda tras drenar el exceso. Punto de marchitez: humedad en que la planta ya no puede extraer agua. La diferencia es el agua disponible, base para programar el riego.'},
    {k:['materia organica'], t:'Materia orgánica', d:'Restos vegetales y animales descompuestos. Mejora estructura, retención de agua y nutrientes. Dejar residuos de cosecha (trash) y aplicar compost o cachaza ayuda a mantenerla.'},
    {k:['ph','acidez','salinidad','sodicidad','encalado','cal agricola','yeso'], t:'pH, salinidad y enmiendas', d:'El pH indica acidez (la caña va bien entre 5.5 y 7.5). La salinidad se mide con la conductividad eléctrica y el sodio con el PSI. Se corrigen con enmiendas: cal para acidez, yeso agrícola para sodio, más buen drenaje para lavar sales.'},
    {k:['erosion','escorrentia','carcava'], t:'Erosión', d:'Pérdida de suelo por agua o viento. Se controla con buena nivelación, pendientes suaves de surco, cobertura y obras de manejo de aguas (cunetas, disipadores, trinchos).'},
    {k:['curvas de nivel','pendiente','cota','altimetria'], t:'Pendiente y curvas de nivel', d:'La pendiente es el desnivel por distancia (%, o m por cada 100 m). Las curvas de nivel unen puntos de igual cota. En riego por surcos se buscan pendientes suaves y uniformes (del orden de 0.1–0.5 %) para que el agua avance sin erosionar.'},
    // ── Riego y drenaje ──
    {k:['evapotranspiracion','eto','etc','kc','coeficiente de cultivo'], t:'Evapotranspiración', d:'Agua que pierde el cultivo por evaporación del suelo y transpiración. ETc = ETo × Kc: la ETo sale del clima y el Kc depende de la etapa del cultivo. Es la base para calcular cuánta agua regar.'},
    {k:['lamina de riego','lamina','frecuencia de riego','turno de riego'], t:'Lámina y frecuencia de riego', d:'La lámina es la altura de agua aplicada (mm; 1 mm = 10 m³/ha). La frecuencia es cada cuántos días se riega, según el agua disponible del suelo y el consumo del cultivo.'},
    {k:['eficiencia de riego','eficiencia'], t:'Eficiencia de riego', d:'Porcentaje del agua aplicada que realmente queda para el cultivo. Gravedad por surcos ~40–60 %, aspersión ~70–80 %, goteo ~90 %. Se mejora con nivelación, surcos de longitud adecuada y riego alterno o con caudal reducido.'},
    {k:['caudal','litros por segundo','l s','aforo de canal','vertedero','parshall','molinete'], t:'Caudal y aforos', d:'Caudal es el volumen de agua por tiempo (L/s o m³/s). Se afora con vertederos, canaletas Parshall, molinete o método volumétrico. Q = V × A (velocidad por área de la sección).'},
    {k:['manning','seccion hidraulica','canal trapezoidal','talud'], t:'Diseño de canales', d:'Los canales se dimensionan con la ecuación de Manning (caudal según sección, pendiente y rugosidad n). En tierra se usan secciones trapezoidales con taludes 1:1 a 1.5:1; revestidos en concreto soportan más velocidad sin erosión.'},
    {k:['aspersion','goteo','riego localizado','pivote','cañon','microaspersion'], t:'Métodos de riego', d:'Gravedad (surcos), aspersión (cañones, pivotes, enrolladores) y localizado (goteo superficial o subterráneo). El goteo ahorra más agua y permite fertirriego, pero cuesta más instalar y mantener.'},
    {k:['nivel freatico','tabla de agua','piezometro','pozo de observacion'], t:'Nivel freático', d:'Profundidad del agua subterránea. En caña conviene mantenerlo por debajo de ~1–1.2 m; si sube, las raíces se asfixian. Se monitorea con pozos de observación o piezómetros.'},
    {k:['drenaje superficial','drenaje subterraneo','zanja','colector','espaciamiento de drenes'], t:'Tipos de drenaje', d:'Superficial: saca el agua encharcada (zanjas, cunetas, nivelación). Subterráneo: baja el nivel freático con zanjas profundas o tubería perforada; el espaciamiento entre drenes se calcula con la conductividad hidráulica y la recarga (ej. ecuación de Hooghoudt). Los drenes descargan a colectores.'},
    {k:['reservorio','jaguey','pozo profundo','bombeo','bomba'], t:'Fuentes y bombeo', d:'El agua viene de ríos (bocatomas), pozos profundos o reservorios. Una bomba se elige por caudal y altura dinámica total (m); su potencia aproximada es P (kW) ≈ Q (m³/s) × H (m) × 9.81 / eficiencia.'},
    // ── Maquinaria y mecanización ──
    {k:['potencia','hp','caballos','toma de fuerza','tdf','pto'], t:'Potencia del tractor', d:'Se mide en HP o kW (1 HP ≈ 0.746 kW). La potencia en la barra de tiro es menor que la del motor por pérdidas de patinaje y rodadura. La toma de fuerza (TDF) mueve implementos rotativos a 540 o 1000 rpm.'},
    {k:['patinaje','lastre','lastrado'], t:'Patinaje y lastre', d:'Patinaje es cuánto giran las ruedas sin avanzar. Lo ideal en labranza es 10–15 %; más patinaje gasta combustible y compacta. Se corrige con lastre (pesos o agua en llantas) o bajando la carga.'},
    {k:['capacidad operativa','capacidad de campo operativa','rendimiento operativo','ha por hora','eficiencia de campo'], t:'Capacidad operativa', d:'Hectáreas por hora que hace un equipo: ancho de trabajo (m) × velocidad (km/h) ÷ 10 × eficiencia de campo (giros, tiempos muertos; típico 65–85 %). Sirve para programar frentes y estimar costos.'},
    {k:['costo horario','costo de maquinaria','depreciacion'], t:'Costo de maquinaria', d:'Costo por hora = costos fijos (depreciación, intereses, seguros) + variables (combustible, lubricantes, llantas, reparaciones, operador). Dividido por la capacidad operativa da el costo por hectárea.'},
    {k:['mantenimiento preventivo','mantenimiento','horometro','engrase'], t:'Mantenimiento de maquinaria', d:'Preventivo por horas de horómetro (cambio de aceites y filtros, engrase, revisión de llantas y rodamientos). Reduce varadas en plena preparación y alarga la vida útil.'},
    {k:['agricultura de precision','gps','rtk','piloto automatico','trafico controlado'], t:'Agricultura de precisión', d:'Uso de GPS/RTK (precisión de centímetros), piloto automático y mapas para nivelar, surcar recto y controlar el tráfico (la maquinaria siempre por las mismas huellas), reduciendo compactación y traslapes.'},
    {k:['drone','dron','fotogrametria','ortofoto','lidar'], t:'Drones y fotogrametría', d:'Los drones generan ortofotos y modelos de elevación para medir áreas, revisar germinación, detectar encharcamientos y apoyar el diseño de nivelación y drenajes.'},
    {k:['sig','gis','qgis','arcgis','shapefile','sistema de informacion geografica'], t:'SIG', d:'Sistema de Información Geográfica: mapas de suertes con sus datos (área, variedad, suelos, labores). Permite planear rutas de maquinaria, drenajes y renovación.'},
    {k:['cosecha mecanizada','cosechadora','alce','corte mecanico'], t:'Cosecha mecanizada', d:'La cosechadora corta y pica la caña en trozos y la descarga a vagones. Exige surcos y bordes bien conformados, sin piedras ni tocones, y suelo con humedad adecuada para no compactar.'},
    // ── Caña y siembra ──
    {k:['siembra','sembrar','chorrillo','trozos','yemas','esquejes'], t:'Siembra de caña', d:'Se siembran trozos de tallo (esquejes) con 2–3 yemas, a chorrillo continuo en el fondo del surco, y se tapan con poca tierra. Se calculan unas 8–10 t de semilla por hectárea; la semilla debe venir sana de semilleros jóvenes.'},
    {k:['germinacion','resiembra','fallas','poblacion'], t:'Germinación y resiembra', d:'Se evalúa a las 4–6 semanas contando brotes o metros de falla. Si las fallas son grandes se resiembra pronto para no perder población.'},
    {k:['macollamiento','macolla','ahijamiento'], t:'Macollamiento', d:'Etapa en que la planta produce nuevos tallos desde la base. Necesita buena humedad, luz y nitrógeno; define cuántos tallos molibles tendrá la suerte.'},
    {k:['madurante','maduracion','sacarosa','brix','pol'], t:'Maduración', d:'Etapa final en que la caña acumula sacarosa. Se mide con Brix y Pol. A veces se aplica madurante químico semanas antes de cosecha para concentrar azúcar.'},
    {k:['tch','tah','toneladas de caña','productividad','rendimiento'], t:'TCH y TAH', d:'TCH: toneladas de caña por hectárea. TAH: toneladas de azúcar por hectárea (TCH × rendimiento). Son los indicadores principales de productividad de una suerte.'},
    {k:['edad de corte','meses de corte','ciclo'], t:'Edad de corte', d:'Meses desde la siembra o el corte anterior hasta la cosecha (en el valle del Cauca normalmente 12–14 meses).'},
    {k:['arroz','rotacion','rotar cultivos'], t:'Rotación con arroz', d:'Sembrar arroz u otro cultivo entre ciclos de caña rompe ciclos de plagas y enfermedades, aprovecha la adecuación y genera ingresos mientras la suerte se renueva.'},
    {k:['malezas','herbicida','preemergente','control de malezas'], t:'Control de malezas', d:'Las malezas compiten fuerte en los primeros 3–4 meses. Se controlan con herbicidas preemergentes y posemergentes, cultivo mecánico y buena población de caña que cierre rápido.'},
    {k:['fertilizacion','nitrogeno','fosforo','potasio','urea','npk'], t:'Fertilización', d:'Nitrógeno, fósforo y potasio según análisis de suelo y foliar. El nitrógeno se aplica normalmente entre los 2 y 4 meses; el fósforo conviene al fondo del surco en la siembra.'},
    {k:['plagas','diatraea','barrenador','salivazo','control biologico'], t:'Plagas', d:'Las principales en caña son el barrenador (Diatraea) y el salivazo. Se manejan sobre todo con control biológico (moscas y avispas parasitoides), monitoreo y variedades tolerantes.'},
    // ── Ingeniería civil ──
    {k:['concreto','hormigon','resistencia del concreto','psi','mpa','fc'], t:'Concreto', d:'Mezcla de cemento, arena, grava y agua. Su resistencia (f\'c) se da en MPa o psi a 28 días: 21 MPa (3000 psi) es común en obras menores. Mientras menos agua (relación agua/cemento baja), más resistente. Hay que curarlo (mantenerlo húmedo) al menos 7 días.'},
    {k:['dosificacion','mezcla 1 2 3','proporcion de mezcla','bultos de cemento'], t:'Dosificación del concreto', d:'Mezclas típicas por volumen: 1:2:3 (cemento:arena:grava) para unos 3000 psi, y 1:2:4 para unos 2500 psi. Como referencia, 1 m³ de concreto 1:2:3 lleva unos 7 bultos de 50 kg de cemento. Para obras importantes se diseña la mezcla.'},
    {k:['acero de refuerzo','varilla','hierro','estribos','recubrimiento'], t:'Acero de refuerzo', d:'Las varillas (3/8", 1/2", 5/8"…) toman la tracción que el concreto no resiste. Deben llevar recubrimiento de concreto (≈ 5–7.5 cm en contacto con suelo o agua) para no oxidarse; los estribos amarran y resisten cortante.'},
    {k:['slump','asentamiento','cono de abrams','cilindros','ensayo de concreto'], t:'Slump y ensayos del concreto', d:'El slump o asentamiento (cono de Abrams) mide la manejabilidad del concreto fresco: 7–10 cm es típico para obras vaciadas a mano. La resistencia se verifica con cilindros fallados a 7, 14 y 28 días.'},
    {k:['mortero','pañete','repello','pega'], t:'Mortero', d:'Mezcla de cemento, arena y agua (sin grava) para pegar ladrillo o bloque y para pañetes. Proporciones comunes 1:3 a 1:5 según el uso.'},
    {k:['mamposteria','ladrillo','bloque'], t:'Mampostería', d:'Muros de ladrillo o bloque pegados con mortero. La confinada lleva columnetas y vigas de amarre en concreto reforzado para resistir sismo.'},
    {k:['cimentacion','zapata','cimiento','viga de cimentacion','pilote'], t:'Cimentación', d:'Transmite las cargas al suelo. Zapatas aisladas o corridas para obras livianas; pilotes cuando el suelo firme está profundo. Se desplanta sobre suelo firme, nunca sobre relleno sin compactar o capa orgánica.'},
    {k:['compactacion de suelos','proctor','vibrocompactador','rana','canguro','rodillo'], t:'Compactación de rellenos', d:'Los rellenos se compactan en capas de 15–30 cm con humedad cercana a la óptima del ensayo Proctor; se exige normalmente 90–95 % del Proctor. Rana o canguro en sitios estrechos, vibrocompactador en vías y terraplenes.'},
    {k:['vias','via interna','carreteable','afirmado','subrasante','base granular','bombeo de via'], t:'Vías internas', d:'Estructura: subrasante compactada, subbase y base granular (afirmado o balasto). Llevan bombeo (inclinación transversal del 2–4 %) y cunetas para sacar el agua: el agua es el principal enemigo de una vía.'},
    {k:['cuneta','cunetas','badén','baden'], t:'Cunetas y badenes', d:'Las cunetas recogen el agua de la vía y la llevan a un drenaje. El badén es un paso de agua a nivel de la vía, revestido, para cruces de agua poco frecuentes.'},
    {k:['tuberia','tubo de concreto','pvc','novafort','diametro de alcantarilla'], t:'Tuberías y alcantarillas', d:'Las alcantarillas en tubo de concreto o PVC estructural (tipo Novafort) se dimensionan por el caudal de diseño. Necesitan buena cama de apoyo, relleno compactado por capas y una cobertura mínima (≈ 0.6 m bajo vías de maquinaria pesada) o una losa de protección.'},
    {k:['muro de contencion','gavion','gaviones','enrocado','proteccion de orillas'], t:'Muros y protección de orillas', d:'Muros de contención en concreto o gaviones (canastas de malla rellenas de piedra), que son flexibles y drenantes. El enrocado protege orillas de ríos y zanjones contra la socavación.'},
    {k:['socavacion','socavar'], t:'Socavación', d:'Erosión del lecho o de las orillas por la fuerza del agua, que deja sin apoyo cimientos, alcantarillas o diques. Se previene con enrocado, dentellones, disipadores y velocidades de agua controladas.'},
    {k:['disipador','caida','rapida','escalones'], t:'Disipadores de energía', d:'Estructuras (caídas, rápidas escalonadas, pozos amortiguadores) que bajan la velocidad del agua en cambios de nivel para evitar erosión aguas abajo.'},
    {k:['movimiento de tierras','corte y relleno','volumen de tierra','m3 de tierra','abundamiento','esponjamiento'], t:'Movimiento de tierras', d:'Se calcula el volumen de corte y relleno a partir de la topografía (secciones o modelo 3D). Al excavar la tierra se esponja (+20–30 % de volumen suelto) y al compactar se reduce; hay que tenerlo en cuenta para volquetas y rellenos.'},
    {k:['presupuesto de obra','apu','analisis de precios unitarios','cantidades de obra'], t:'Presupuesto de obra', d:'Se arma con las cantidades de obra (m³, m², ml, und) por sus análisis de precios unitarios (APU: materiales, equipo, mano de obra y transporte), más administración, imprevistos y utilidad (AIU) si es contratada.'},
    {k:['interventoria','supervision de obra','bitacora','acta de obra'], t:'Supervisión de obra', d:'Verificar que la obra se haga según diseño, especificaciones, cantidades y cronograma: bitácora diaria, control de materiales, ensayos (cilindros de concreto, densidades de campo), actas de avance y de recibo.'},
    {k:['seguridad','sst','trabajo en alturas','excavaciones seguras','epp'], t:'Seguridad en obra', d:'Elementos de protección personal, señalización, permisos para trabajos de alto riesgo (alturas, excavaciones de más de 1.5 m con entibado o taludes, trabajos en caliente) y distancia segura alrededor de maquinaria en movimiento.'},
    {k:['geotextil','geomembrana','geomalla'], t:'Geosintéticos', d:'Geotextil: separa y filtra (evita que el suelo fino se mezcle con el material granular o tape un dren). Geomembrana: impermeabiliza reservorios y canales. Geomalla: refuerza bases de vías y rellenos.'},
    {k:['impermeabilizacion','filtracion','fuga de canal','revestimiento'], t:'Revestimiento de canales', d:'Revestir en concreto, geomembrana o suelo-cemento reduce las pérdidas por infiltración, el mantenimiento y la erosión. Conviene donde el canal pasa por suelos arenosos o de alta filtración.'},
    {k:['unidades','conversion','hectarea','plaza','fanegada','cuadra'], t:'Unidades de área', d:'1 ha = 10.000 m². En el valle se usa la plaza (≈ 0.64 ha = 6.400 m²) y la fanegada o cuadra (≈ 0.64 ha en el Valle; en otras regiones varía). 1 m³/ha = 0.1 mm de lámina.'},
  ];

  // Concepto del glosario: palabra completa (admite plural) y gana la clave más larga,
  // así "eficiencia de riego" no se confunde con "riego" ni "sig" con "siguiente"
  const CLAVES = GLOSARIO.flatMap(g => g.k.map(k => [n(k), g]));
  function buscarConcepto(t){
    const T = ' ' + t + ' ';
    let mejor = null, largo = 0;
    CLAVES.forEach(([k, g]) => { if (k.length > largo && new RegExp(' ' + k.replace(/[-]/g, '\\-') + '(s|es)? ').test(T)) { mejor = g; largo = k.length; } });
    return mejor && Object.assign({largo}, mejor);
  }

  // ── Utilidades ──
  const MESL = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const mesEn = t => { const i = MESL.findIndex(m => new RegExp('\\b' + m + '\\b').test(t)); return i >= 0 ? i + 1 : 0; };
  const zonaEn = t => { const m = t.match(/\bzona\s*([12])\b/); return m ? +m[1] : 0; };
  const fn = (nombre) => typeof window[nombre] === 'function' || typeof globalThis[nombre] === 'function';
  const ir = (vista, txt) => `<button type="button" class="iv-ir" data-iv-mod="${vista}">${txt || 'Abrir'} →</button>`;
  const STOP = new Set('que cual cuales cuanto cuanta cuantos cuantas como donde cuando quien quienes por para de del la las el los un una unos unas y o a en es son esta estan hay me mi se lo le les al con sin sobre mas menos muy ya tiene tienen tengo dime dame saber quiero ver favor porfa porfavor puedes podrias sabes hacer hace hizo va van fue ser esto eso este ese esa'.split(' '));
  const palabras = t => t.split(' ').filter(w => w.length > 2 && !STOP.has(w));
  const raiz = w => w.length > 5 ? w.slice(0, w.length > 7 ? 6 : 5) : w;

  // ── Datos del comité ──
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
    ((DB.ppto2026 && DB.ppto2026.suertes) || []).forEach(x => add(x.s, typeof hacDeSuerte === 'function' ? hacDeSuerte(x.s) : ''));
    return [...S.values()];
  };
  function suertesEn(t, hac){
    const S = todasSuertes();
    const full = t.match(/\b(\d{4})\s*-?\s*(\d{3})\b/);
    if (full) return S.filter(x => x.s === `${full[1]}-${full[2]}` && (!hac || x.h === hac));
    if (!/\b(suerte|ste|la|el)\s+\d{1,3}\b|\b\d{3}\b/.test(t)) return [];
    const limpio = t.replace(/\b(zona|semana|sem|top|mes|ano|año|las|los|primeras|primeros)\s+\d+/g, ' ').replace(/\b\d+\s*(ha|has|hectareas|dias|m3|km|m|millones|mm|hp|kva|l s|%)\b/g, ' ').replace(/\b20\d\d\b/g, ' ');
    const nums = [...limpio.matchAll(/\b(\d{1,3})\b/g)].map(m => m[1].padStart(3, '0'));
    if (!nums.length) return [];
    return S.filter(x => nums.includes(x.s.split('-')[1]) && (!hac || x.h === hac));
  }

  function fichaSuerte({s, h}){
    const L = DB.lotes.filter(l => l.s === s && l.h === h), P = DB.proceso.find(r => r.sue === s && r.hac === h);
    const Pa = DB.procesoAnterior && DB.procesoAnterior.items.find(r => r.sue === s && r.hac === h);
    const R = DB.ruta.find(r => r.s === s && r.h === h);
    const Q = ((typeof ppto2027 === 'function' && ppto2027().suertes) || []).find(x => x.s === s && x.h === h);
    const P26 = ((DB.ppto2026 && DB.ppto2026.suertes) || []).find(x => x.s === s);
    const A = typeof agroFilas === 'function' ? agroFilas().filter(x => x.s === s && x.h === h) : [];
    const M = ((DB.maestro && DB.maestro.lotes) || {})[h + '|' + s];
    const S = P && typeof simSuerte === 'function' ? simSuerte(P) : null;
    const area = (L[0] && L[0].a) || (P && P.area) || (R && R.a) || (Q && Q.a) || (P26 && P26.a) || 0;
    const z = (L[0] && L[0].z) || (P && P.z) || (Q && Q.z) || (P26 && P26.z) || zonaDe(h);
    const lp = L.find(l => l.e !== 'SEMBRADA') || L[0];
    const dias = lp ? dl(lp) : P ? P.dias : R ? R.d : null;
    const filas = [];
    L.forEach(l => filas.push(`<b>${l.e === 'SEMBRADA' ? '✅ Sembrada' : '⏳ Pendiente de siembra'}</b> · ${esc(cap(l.c))} · <b>${dl(l)} días de lucro</b>${dlMaestro(l) == null ? ' (comité)' : ' (maestro)'} · variedad ${esc(l.v || '—')}`));
    if (P) filas.push(`🚜 En proceso: labor <b>${esc(cap(P.labor))}</b>${P.cont && P.cont !== '—' ? ' · contratista ' + esc(P.cont) : ''}${P.obs ? ` · "${esc(P.obs)}"` : ''}`);
    if (Pa && P && norm(Pa.labor) !== norm(P.labor)) filas.push(`↩️ La semana anterior (${esc(DB.procesoAnterior.semana)}) estaba en ${esc(cap(Pa.labor))}`);
    if (R) filas.push(`🌱 En ruta de siembra · variedad ${esc(R.variedad || '—')} · semillero ${esc(R.semillero || '—')}${R.bandereo ? ` · bandereo ${R.bandereo} m` : ''}${R.cont ? ' · ' + esc(R.cont) : ''}`);
    if (M) filas.push(`📚 Maestro: corte <b>${fechaLarga(M[0]) || '—'}</b> · siembra ${fechaLarga(M[1]) || '—'}`);
    if (P26) filas.push(`📋 Presupuesto 2026: <b>sí</b> · ${f2(P26.a)} ha · mes ${MESES[P26.mes - 1] || '—'}${P26.motivo ? ` · ${esc(P26.motivo)}` : ''}`);
    else if (L.length) filas.push(`📋 Presupuesto 2026: <b>no está</b> en la lista`);
    if (S && S.total) filas.push(`💰 Costo proyectado ${moneyM(S.total)} (${money(S.proy)}/ha) vs ppto ${moneyM(S.pptoTotal)} → ${S.dif >= 0 ? 'ahorro' : 'sobrecosto'} ${money(Math.abs(S.dif))}/ha`);
    A.filter(a => a.fecha || a.obs).forEach(a => filas.push(`🌱 Agronomía: ${a.fecha ? 'siembra real ' + fechaLarga(a.fecha) : 'sin fecha de siembra real'}${a.lucro != null && a.lucro >= 0 ? ` · ${a.lucro} días de lucro real` : ''}${a.obs ? ` · "${esc(a.obs)}"` : ''}`));
    if (Q) filas.push(`📅 Presupuesto 2027: renovación en <b>${MESES[Q.mes - 1] || '—'}</b> · ${esc(Q.vAct || '—')} → ${esc(Q.v1 || '—')}${Q.niv ? ` · nivelación ${Q.niv}` : ''}`);
    return {area, z, dias, L, P, R, Q, M, P26, html:`<div class="iv-ficha"><div class="iv-ficha-t">Suerte <b>${esc(s)}</b> · ${esc(h)} · Z${z} · ${ha(area)}</div>${lista(filas)}
      ${L.length ? `<button type="button" class="iv-ir" data-iv-sue="${esc(s)}" data-iv-hac="${esc(h)}">Ver en el dashboard →</button>` : ''}</div>`};
  }

  function resumenHacienda(h, t){
    const L = DB.lotes.filter(l => l.h === h), sem = L.filter(l => l.e === 'SEMBRADA'), pen = L.filter(l => l.e !== 'SEMBRADA');
    const P = DB.proceso.filter(r => r.hac === h), R = DB.ruta.filter(r => r.h === h);
    const Q = ((typeof ppto2027 === 'function' && ppto2027().suertes) || []).filter(x => x.h === h);
    const it = [];
    if (L.length) it.push(`Comité ${esc(DB.meta.semana)}: <b>${L.length}</b> suertes · <b>${sem.length}</b> sembradas (${ha(sum(sem, l => l.a))}) y <b>${pen.length}</b> pendientes (${ha(sum(pen, l => l.a))})`);
    if (P.length) it.push(`En proceso: ${P.map(r => `${esc(r.sue)} (${esc(cap(r.labor))}${r.cont && r.cont !== '—' ? ', ' + esc(r.cont) : ''})`).join(', ')}`);
    if (R.length) it.push(`En ruta de siembra: ${R.map(r => esc(r.s)).join(', ')}`);
    if (Q.length) it.push(`Presupuesto 2027: ${Q.length} suertes · ${ha(sum(Q, x => x.a))}`);
    if (!it.length) return `No encontré datos de <b>${esc(h)}</b> en el comité ni en el presupuesto 2027.`;
    return `<b>Hacienda ${esc(h)}</b> (zona ${zonaDe(h)})${lista(it)}<button type="button" class="iv-ir" data-iv-hac="${esc(h)}">Ver hacienda en el dashboard →</button>`;
  }

  function totales(z){
    const L = DB.lotes.filter(l => !z || l.z === z), sem = L.filter(l => l.e === 'SEMBRADA'), pen = L.filter(l => l.e !== 'SEMBRADA');
    const hs = sum(sem, l => l.a), pptoZ = z ? sum(DB.pptoMensual['z' + z]) : DB.meta.pptoTotal;
    const dT = L.length ? Math.round(sum(L, dl) / L.length) : 0, dP = pen.length ? Math.round(sum(pen, dl) / pen.length) : null;
    return `<b>${z ? 'Zona ' + z : 'Resumen'} · ${esc(DB.meta.semana)} (${esc(DB.meta.fecha)})</b>${lista([
      `Sembradas: <b>${ha(hs)}</b> en ${sem.length} suertes (caña ${ha(sum(sem.filter(l => l.c === 'CAÑA'), l => l.a))} · arroz ${ha(sum(sem.filter(l => l.c === 'ARROZ'), l => l.a))})`,
      `Pendientes: <b>${ha(sum(pen, l => l.a))}</b> en ${pen.length} suertes`,
      pptoZ ? `Avance vs presupuesto (${ha(pptoZ)}): <b>${(hs / pptoZ * 100).toFixed(1)}%</b> · faltan ${ha(Math.max(0, pptoZ - hs))}` : '',
      `Días de lucro promedio: <b>${dT}</b> (todas)${dP != null ? ` · <b>${dP}</b> (pendientes)` : ''}`,
      `En proceso: ${DB.proceso.filter(r => !z || r.z === z).length} suertes · en ruta de siembra: ${DB.ruta.filter(r => !z || zonaDe(r.h) === z).length}`,
    ].filter(Boolean))}${ir('aps', 'Ver el dashboard')}`;
  }

  function porLaborTxt(lab){
    const P = DB.proceso.filter(r => !lab || norm(r.labor).includes(norm(lab)));
    if (lab && !P.length) return `Ninguna suerte está hoy en <b>${esc(cap(lab))}</b> (${esc(DB.meta.semana)}).`;
    if (!P.length) return `No hay suertes en proceso en ${esc(DB.meta.semana)}.`;
    const g = {}; P.forEach(r => (g[cap(r.labor)] = g[cap(r.labor)] || []).push(r));
    return `<b>Suertes en proceso · ${esc(DB.meta.semana)}</b>${lista(Object.entries(g).map(([k, v]) => `<b>${esc(k)}</b> (${ha(sum(v, r => r.area))}): ${v.map(r => `${esc(r.sue)} ${esc(r.hac)}${r.cont && r.cont !== '—' ? ' · ' + esc(r.cont) : ''}`).join('; ')}`))}`;
  }
  function comparativoTxt(){
    const A = DB.procesoAnterior; if (!A || !A.items) return 'No tengo la semana anterior cargada.';
    const cambios = DB.proceso.map(r => { const a = A.items.find(x => x.sue === r.sue && x.hac === r.hac); return !a ? `${esc(r.sue)} ${esc(r.hac)}: <b>nueva</b> en ${esc(cap(r.labor))}` : norm(a.labor) !== norm(r.labor) ? `${esc(r.sue)} ${esc(r.hac)}: ${esc(cap(a.labor))} → <b>${esc(cap(r.labor))}</b>` : null; }).filter(Boolean);
    const salieron = A.items.filter(a => !DB.proceso.some(r => r.sue === a.sue && r.hac === a.hac)).map(a => `${esc(a.sue)} ${esc(a.hac)}: salió de proceso (estaba en ${esc(cap(a.labor))})`);
    const todo = [...cambios, ...salieron];
    return `<b>${esc(A.semana)} → ${esc(DB.meta.semana)}</b>${todo.length ? lista(todo) : '<br>Sin cambios de labor entre las dos semanas.'}`;
  }

  // Contratistas: nombres reales (se ignoran "—" y vacíos, que antes coincidían con todo)
  const contratistasTodos = () => [...new Set([...(typeof contratistas === 'function' ? contratistas() : []), ...DB.proceso.map(r => r.cont), ...DB.ruta.map(r => r.cont),
    ...((DB.sim && DB.sim.tarifas) || (typeof simData === 'function' && simData().tarifas) || []).map(t => t.contratista)])].filter(c => c && n(c).length >= 3);
  const tarifas = () => (typeof simData === 'function' ? simData().tarifas : (DB.sim && DB.sim.tarifas)) || [];
  function contratistaEn(t){
    const T = ' ' + t + ' ';
    return contratistasTodos().map(c => [c, n(c)]).sort((a, b) => b[1].length - a[1].length)
      .find(([, c]) => T.includes(' ' + c + ' ') || (c.split(' ')[0].length > 4 && T.includes(' ' + c.split(' ')[0] + ' ')));
  }
  function buscarTarifas(t, cont){
    const ign = new Set('cuanto cuesta vale valor precio tarifa tarifas costo de la el del por en a que y una un con los las pase ha hectarea'.split(' '));
    const pal = t.split(' ').filter(w => w.length > 3 && !ign.has(w) && !(cont && n(cont).includes(w)));
    const T = tarifas().filter(x => (!cont || x.contratista === cont) && (!pal.length || pal.some(w => n(x.desc).includes(w.slice(0, 5)))));
    if (!T.length) return null;
    return `<b>Tarifas${cont ? ' de ' + esc(cont) : ''}</b> (simulador)${lista(T.slice(0, 10).map(x => `${esc(x.desc)} · <b>${money(x.costo)}</b>/${esc(x.unidad)} · ${esc(x.contratista)}`))}${T.length > 10 ? `<small>…y ${T.length - 10} más en el 💰 Simulador.</small>` : ''}${ir('simulador', 'Abrir el simulador')}`;
  }

  // ── Personas: estructura del área + directorios de los protocolos ──
  function gente(){
    const G = [];
    if (typeof estructura === 'function') estructura().personas.forEach(p => { if (p.nombre || p.cargo) G.push({nombre:p.nombre || 'Por asignar', cargo:p.cargo, extra:p.equipo, tel:'', fuente:'Estructura del área'}); });
    if (typeof protocolos === 'function') protocolos().forEach(pr => (pr.directorio || []).forEach(c => { if (c.nombre || c.cargo) G.push({nombre:c.nombre, cargo:c.cargo, extra:'', tel:c.tel || '', fuente:'Directorio · ' + pr.titulo.split('·')[0].trim()}); }));
    return G;
  }
  function personasTxt(t){
    const W = palabras(t).filter(w => !['telefono','celular','numero','contacto','cargo','persona','jefe','coordinador','coordinadora','analista','quien','quienes'].includes(w));
    const quiereTel = tiene(t, 'telefono', 'celular', 'numero', 'contacto', 'llamar');
    const G = gente(); if (!G.length) return null;
    const puntua = p => { const N = n(p.nombre), C = n(p.cargo); let s = 0;
      W.forEach(w => { if ((' ' + N + ' ').includes(' ' + w)) s += 3; else if (C.includes(raiz(w))) s += 2; });
      const z = t.match(/zona\s*([12])/); if (z && C.includes('zona ' + z[1])) s += 3;
      if (tiene(t, 'jefe') && C.includes('jefe')) s += 1; if (tiene(t, 'coordinador', 'coordinadora') && C.includes('coordinador')) s += 1; if (tiene(t, 'analista') && C.includes('analista')) s += 1;
      return s; };
    const R = G.map(p => [puntua(p), p]).filter(([s]) => s >= 2).sort((a, b) => b[0] - a[0]);
    if (!R.length) return null;
    const top = R[0][0], vistos = new Set();
    const lineas = R.filter(([s]) => s >= top - 1).map(([, p]) => p).filter(p => { const k = n(p.nombre + p.cargo); if (vistos.has(k)) return false; vistos.add(k); return true; }).slice(0, 6)
      .map(p => `<b>${esc(p.nombre)}</b> · ${esc(p.cargo || '')}${p.tel ? ` · <a href="tel:${esc(p.tel.replace(/[^\d+]/g, ''))}">📞 ${esc(p.tel)}</a>` : quiereTel ? ' · <i>sin teléfono registrado</i>' : ''}<br><small>${esc(p.fuente)}</small>`);
    return `<b>Personas</b>${lista(lineas)}${quiereTel && !R.some(([, p]) => p.tel) ? '<small>Los teléfonos se agregan en el directorio del protocolo (modo editor).</small><br>' : ''}${ir('estructura', 'Ver la estructura del área')}`;
  }
  function procesosTxt(t){
    if (typeof estructura !== 'function') return null;
    const W = palabras(t).filter(w => !['responsable','encargado','quien','proceso','procesos','cargo'].includes(w));
    const R = (estructura().procesos || []).map(p => [W.filter(w => n(p.especifico + ' ' + p.general).includes(raiz(w))).length, p]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    return R.length ? `<b>Procesos y responsables</b>${lista(R.slice(0, 8).map(([, p]) => `${esc(p.especifico)} → <b>${esc(p.responsable)}</b> <small>(${esc(p.general)})</small>`))}${ir('estructura', 'Ver procesos')}` : null;
  }

  // ── Protocolos y proyectos ──
  function protocoloEn(t){
    if (typeof protocolos !== 'function') return null;
    const W = palabras(t);
    const R = protocolos().map(p => { const k = n(`${p.titulo} ${p.tipo} ${p.activa}`); return [W.filter(w => k.includes(raiz(w))).length + (k.includes('dique') && tiene(t, 'dique', 'rompe', 'ruptura', 'inunda') ? 2 : 0) + (p.datos && tiene(t, '2017', 'hectarea', 'cuantas', 'simulacion', 'afectad', 'invierno', 'invernal') ? 3 : 0), p]; })
      .filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    return R.length ? R[0][1] : null;
  }
  function protocoloTxt(p, t){
    const pasos = String(p.pasos || '').split('\n').filter(s => s.trim()).map(s => { const [a, r] = s.split('|').map(x => x.trim()); return `${esc(a)}${r ? ` <small>(${esc(r)})</small>` : ''}`; });
    const datos = tiene(t, 'dato', 'cifra', 'hectarea', 'area', '2017', 'inund', 'simulacion', 'cuantas', 'afectad');
    const D = String(p.datos || '').split('\n').filter(s => s.includes(':'));
    return `<b>🚨 ${esc(p.titulo)}</b>${p.borrador ? ' <small>(borrador)</small>' : ''}<br><small>Se activa: ${esc(p.activa || '—')}</small>
      ${datos && D.length ? lista(D.map(esc)) : `<ol class="iv-ol">${pasos.map(x => `<li>${x}</li>`).join('')}</ol>`}
      ${p.insumos && !datos ? `<small>Insumos: ${esc(String(p.insumos).split('\n').join(', '))}</small><br>` : ''}
      <button type="button" class="iv-ir" data-iv-pr="${esc(p.id)}">▶ Ver presentación</button>`;
  }
  function proyectoEn(t){
    if (typeof proyectos !== 'function') return null;
    const W = palabras(t).filter(w => !['proyecto','proyectos','obra','obras','ejecutado','ejecutados','costo','costó','inversion','cuanto','estado'].includes(w));
    const R = proyectos().map(p => { const k = n(`${p.nombre} ${p.tipo} ${p.hacienda} ${p.cantidad}`); return [W.filter(w => k.includes(raiz(w))).length, p]; }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    return R.length ? R[0][1] : null;
  }
  function proyectoTxt(p){
    const ppto = +p.ppto || 0, cost = +p.inversion || 0;
    const D = String(p.datos || '').split('\n').filter(s => s.includes(':')).slice(0, 6);
    return `<b>🏗️ ${esc(p.nombre)}</b> <small>· ${esc(p.tipo)} · ${esc(p.estado || 'Ejecutado')} · ${esc(p.anio || '')}</small>${lista([
      p.descripcion ? esc(p.descripcion) : '',
      ppto ? `Presupuesto: <b>${moneyM(ppto)}</b>` : '', cost ? `Costo / inversión: <b>${moneyM(cost)}</b>${ppto ? ` (${cost - ppto >= 0 ? '+' : '−'}${(Math.abs(cost - ppto) / ppto * 100).toFixed(1)}%)` : ''}` : '',
      ...D.map(esc), p.resultado ? `Resultado: ${esc(p.resultado)}` : ''].filter(Boolean))}
      <button type="button" class="iv-ir" data-iv-proy="${esc(p.id)}">▶ Ver presentación</button>`;
  }

  // ── Presupuesto 2026 (cruce con el comité) ──
  function ppto26Txt(t){
    if (typeof pptoCruce !== 'function' || !(DB.ppto2026 && DB.ppto2026.suertes)) return 'Aún no está cargada la hoja «PPTO 2026».';
    const {filas, fuera} = pptoCruce(), z = zonaEn(t), m = mesEn(t);
    const F = filas.filter(f => (!z || f.z === z) && (!m || f.mes === m));
    const ha_ = e => sum(F.filter(f => !e || f.est === e), f => f.a), tot = ha_() || 1, hoyMes = new Date().getMonth() + 1;
    if (tiene(t, 'fuera')) return `<b>Sembradas fuera del presupuesto 2026</b> (${fuera.length} · ${ha(sum(fuera, l => l.a))})${lista(fuera.slice(0, 15).map(l => `${esc(l.s)} ${esc(l.h)} · ${ha(l.a)}`))}${ir('pptodet', 'Ver detalle')}`;
    if (tiene(t, 'atrasad', 'retrasad', 'vencid', 'demorad')) {
      const A = F.filter(f => f.mes && f.mes < hoyMes && f.est !== 'Sembrada').sort((a, b) => a.mes - b.mes);
      return `<b>Suertes del presupuesto 2026 con el mes ya pasado y sin sembrar</b> (${A.length} · ${ha(sum(A, f => f.a))})${lista(A.slice(0, 15).map(f => `${esc(f.s)} ${esc(f.h)} · ${ha(f.a)} · ${MESES[f.mes - 1]} · ${esc(f.est)}`))}${A.length > 15 ? `<small>…y ${A.length - 15} más.</small><br>` : ''}${ir('pptodet', 'Ver detalle')}`;
    }
    if (tiene(t, 'faltan', 'que falta', 'pendientes', 'sin iniciar', 'por sembrar') && tiene(t, 'cuales', 'que suertes', 'lista', 'listado')) {
      const A = F.filter(f => f.est !== 'Sembrada').sort((a, b) => a.mes - b.mes);
      return `<b>Del presupuesto 2026 faltan ${A.length} suertes (${ha(sum(A, f => f.a))})</b>${lista(A.slice(0, 15).map(f => `${esc(f.s)} ${esc(f.h)} · ${ha(f.a)} · ${MESES[f.mes - 1] || '—'} · ${esc(f.est)}`))}${A.length > 15 ? `<small>…y ${A.length - 15} más.</small><br>` : ''}${ir('pptodet', 'Ver detalle')}`;
    }
    const sem = ha_('Sembrada'), curso = ha_('En proceso') + ha_('En ruta de siembra');
    return `<b>Presupuesto 2026${z ? ' · zona ' + z : ''}${m ? ' · ' + cap(MESL[m - 1]) : ''}</b>${lista([
      `Presupuestado: <b>${ha(tot)}</b> (${F.length} suertes)`,
      `Sembrado: <b>${ha(sem)}</b> · ${(sem / tot * 100).toFixed(1)}%`,
      `En proceso / ruta: ${ha(curso)} · en arroz: ${ha(ha_('En arroz'))}`,
      `Falta: <b>${ha(tot - sem - curso)}</b> · ${((tot - sem - curso) / tot * 100).toFixed(1)}% (sin iniciar ${ha(ha_('Sin iniciar'))})`,
      !m && !z ? `Fuera del presupuesto se sembraron ${ha(sum(fuera, l => l.a))}` : ''].filter(Boolean))}${ir('pptodet', 'Ver detalle')}`;
  }

  function ppto27(t){
    const P = typeof ppto2027 === 'function' ? ppto2027() : null; if (!P || !(P.suertes || []).length) return 'Aún no hay programa 2027 cargado.';
    const mm = mesEn(t), h = hacEn(t), z = zonaEn(t);
    const S = P.suertes.filter(s => (!mm || s.mes === mm) && (!h || s.h === h) && (!z || s.z === z));
    const tot = sum(S, s => s.a);
    return `<b>Presupuesto APS 2027${mm ? ' · ' + cap(MESL[mm - 1]) : ''}${h ? ' · ' + esc(h) : ''}${z ? ' · zona ' + z : ''}</b>${lista([
      `${S.length} suertes · <b>${ha(tot)}</b> (Z1 ${ha(sum(S.filter(s => s.z === 1), s => s.a))} · Z2 ${ha(sum(S.filter(s => s.z === 2), s => s.a))})`,
      typeof pptoHa2027 === 'function' ? `Inversión estimada: <b>${moneyM(tot * pptoHa2027(P))}</b> (${money(pptoHa2027(P))}/ha)` : '',
      mm || h ? S.map(s => `${esc(s.s)} ${esc(s.h)}`).slice(0, 15).join(', ') + (S.length > 15 ? '…' : '') : 'Pregunta por un mes o hacienda, ej. "¿qué se renueva en marzo 2027?"',
    ].filter(Boolean))}${ir('ppto', 'Abrir presupuesto 2027')}`;
  }

  function lucroTxt(t){
    const z = zonaEn(t), h = hacEn(t);
    const L = DB.lotes.filter(l => (!z || l.z === z) && (!h || l.h === h)), pen = L.filter(l => l.e !== 'SEMBRADA'), sem = L.filter(l => l.e === 'SEMBRADA');
    const prom = A => A.length ? Math.round(sum(A, dl) / A.length) : '—';
    return `<b>Días de lucro${z ? ' · zona ' + z : ''}${h ? ' · ' + esc(h) : ''}</b> <small>(según maestro ${esc((DB.maestro && DB.maestro.fecha) || '')})</small>${lista([
      `Promedio todas: <b>${prom(L)} días</b> (${L.length} suertes)`,
      `Pendientes (corte → hoy): <b>${prom(pen)} días</b> (${pen.length})`,
      `Sembradas (corte → siembra): <b>${prom(sem)} días</b> (${sem.length})`,
      `Dato del comité: ${L.length ? Math.round(sum(L, l => l.d) / L.length) : '—'} días`])}
      <small>Pendientes con más días: ${pen.slice().sort((a, b) => dl(b) - dl(a)).slice(0, 4).map(l => `${esc(l.s)} (${dl(l)})`).join(', ') || '—'}</small>`;
  }

  // ── Cómo usar la plataforma (sin datos privados ni el enlace de editor) ──
  const COMO = [
    {k:['publicar','publico','subir cambios','que vean'], r:'Los cambios los hace el administrador en <b>modo editor</b>: se edita y luego <b>🚀 Publicar</b>. En 1–2 minutos los ven todos y las pestañas abiertas se actualizan solas.'},
    {k:['agregar suerte','agrego una suerte','nueva suerte','añadir suerte'], r:'En modo editor: <b>✏️ Editar → ➕ Agregar suerte</b>. Se escribe el sector-suerte (ej. 3113070) y hacienda, zona, área, cultivo, variedad y días se llenan solos desde el maestro de suertes.'},
    {k:['importar','excel semanal','actualizar comite','cargar comite','semana nueva'], r:'En modo editor: <b>✏️ Editar → 📥 Importar Excel semanal</b>, se elige el .xlsm del comité y luego <b>🚀 Publicar</b>. Trae lotes, ruta, labores, costos y la hoja PPTO 2026.'},
    {k:['maestro','cargar maestro'], r:'El <b>maestro de suertes</b> se toma solo del PC del administrador (carpeta COMITE APS\\MAESTRO, el más reciente). En Agronomía también está <b>📥 Cargar maestro</b>. Con él se calculan los días de lucro (sembradas: corte → siembra; pendientes: corte → hoy).'},
    {k:['descargar','excel','exportar'], r:'En el dashboard, botón <b>📊 Excel</b>: descarga el resumen con los filtros que tengas puestos.'},
    {k:['filtro','filtrar'], r:'En la barra superior del dashboard hay filtros por zona, hacienda, cultivo, estado, presupuesto y días de lucro. <b>✕ Limpiar</b> los quita.'},
    {k:['presentacion','diapositiva'], r:'En <b>Proyectos ejecutados</b> y <b>Protocolos de emergencia</b>, cada tarjeta tiene <b>▶ Ver presentación</b>: se pasa con las flechas, deslizando en el celular, y Esc para cerrar.'},
    {k:['ver detalle','cruce','presupuesto vs'], r:'En el dashboard, recuadro <b>% vs Presupuesto → 🔎 Ver detalle</b>: cruza la hoja PPTO 2026 con lo sembrado y en proceso (qué se hizo y qué falta, por mes y por suerte).'},
    {k:['buscar','buscador'], r:'Arriba está el <b>buscador del portal</b>: temas, personas, procesos, haciendas y suertes.'},
    {k:['editar protocolo','directorio','telefono','cambiar nombre'], r:'En modo editor, en <b>Protocolos de emergencia</b> se abre la tarjeta y se editan pasos, insumos, mapas y el <b>directorio</b> (nombre, cargo, teléfono); luego 🚀 Publicar.'},
    {k:['proyecto nuevo','agregar proyecto'], r:'En modo editor, <b>Proyectos ejecutados → + Nuevo proyecto</b>: nombre, tipo, hacienda, presupuesto, costo, cifras, problema, solución y costos. La presentación se arma sola.'},
    {k:['celular','movil','telefono movil'], r:'La página funciona en el celular: el menú se compacta, las tablas pasan a tarjetas y las presentaciones se deslizan con el dedo.'},
  ];
  function comoTxt(t){
    const R = COMO.map(c => [c.k.filter(k => t.includes(n(k))).length, c]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]);
    return R.length ? `<b>Cómo se hace</b><br>${R[0][1].r}` : null;
  }

  // ── Búsqueda general en toda la plataforma (último recurso antes de "no entendí") ──
  function documentos(){
    const D = [];
    (typeof TEMAS !== 'undefined' ? TEMAS : []).forEach(m => D.push({tit:m.t, txt:m.d + ' ' + m.k, res:`<b>${esc(m.t)}</b><br>${esc(m.d)}${ir(m.ir)}`}));
    if (typeof protocolos === 'function') protocolos().forEach(p => D.push({tit:p.titulo, txt:`${p.titulo} ${p.tipo} ${p.activa} ${p.pasos} ${p.insumos || ''} ${p.datos || ''}`, res:`🚨 <b>${esc(p.titulo)}</b><br><small>${esc(p.activa || '')}</small><br><button type="button" class="iv-ir" data-iv-pr="${esc(p.id)}">▶ Ver presentación</button>`}));
    if (typeof proyectos === 'function') proyectos().forEach(p => D.push({tit:p.nombre, txt:`${p.nombre} ${p.tipo} ${p.hacienda} ${p.descripcion || ''} ${p.diagnostico || ''} ${p.solucion || ''} ${p.datos || ''} ${p.resultado || ''}`, res:`🏗️ <b>${esc(p.nombre)}</b><br><small>${esc(p.descripcion || '')}</small><br><button type="button" class="iv-ir" data-iv-proy="${esc(p.id)}">▶ Ver presentación</button>`}));
    if (typeof estructura === 'function') (estructura().procesos || []).forEach(p => D.push({tit:p.especifico, txt:`${p.especifico} ${p.general} ${p.nucleo}`, res:`⚙️ ${esc(p.especifico)} → <b>${esc(p.responsable)}</b> <small>(${esc(p.general)})</small>`}));
    GLOSARIO.forEach(g => D.push({tit:g.t, txt:`${g.t} ${g.k.join(' ')} ${g.d}`, res:`📘 <b>${esc(g.t)}</b><br>${esc(g.d)}`}));
    COMO.forEach(c => D.push({tit:'Cómo se hace', txt:c.k.join(' ') + ' ' + c.r.replace(/<[^>]+>/g, ''), res:c.r}));
    return D;
  }
  function buscarTodo(t){
    const W = palabras(t).map(raiz); if (!W.length) return null;
    const R = documentos().map(d => { const tx = n(d.txt), ti = n(d.tit); return [W.reduce((s, w) => s + (ti.includes(w) ? 3 : tx.includes(w) ? 1 : 0), 0), d]; })
      .filter(([s]) => s >= Math.min(2, W.length)).sort((a, b) => b[0] - a[0]).slice(0, 3);
    return R.length ? `Esto es lo que encontré en la plataforma:${lista(R.map(([, d]) => d.res))}` : null;
  }

  const AYUDA = `Soy el <b>Inge Virtual</b> 👷. Conozco toda la plataforma: comité APS, presupuesto 2026 y 2027, días de lucro, agronomía, simulador, proyectos, protocolos de emergencia, el equipo y conceptos de ingeniería agrícola y civil. Prueba:`;
  const EJEMPLOS = ['Resumen de la semana', '¿Cuánto falta del presupuesto 2026?', '¿Qué suertes están atrasadas?', 'Días de lucro de las pendientes', '¿Qué hacer si se rompe un dique?', '¿Quién es el jefe de zona 1?', '¿Cuánto costó el drenaje de San Nicolás?', '¿En qué estado está la 3111-131?', 'Comparación con la semana pasada', '¿Qué es la descepada?'];

  function responder(pregunta){
    const t = n(pregunta);
    if (!t) return AYUDA;
    if (/^(hola|buenas|buenos|hey|que mas|saludos)\b/.test(t) && t.split(' ').length < 4) return `¡Hola! ${AYUDA}`;
    if (tiene(t, 'gracias', 'listo', 'perfecto') && t.split(' ').length < 4) return 'Con gusto 👷. ¿Algo más?';
    if (tiene(t, 'ayuda', 'que sabes', 'que puedes', 'que preguntas')) return AYUDA;

    // 1) Cómo usar la plataforma
    if (/^(como|donde|de que forma)\b/.test(t) && !tiene(t, 'va ', 'van ', 'esta ', 'vamos')) { const r = comoTxt(t); if (r) return r; }

    const hac = hacEn(t), S = suertesEn(t, hac), z = zonaEn(t);
    // 2) Una suerte concreta
    if (S.length === 1) {
      const F = fichaSuerte(S[0]); let frase = '';
      if (tiene(t, 'lucro', 'dias')) frase = F.dias != null ? `La suerte ${esc(S[0].s)} de ${esc(S[0].h)} tiene <b>${F.dias} días de lucro</b>.` : 'No tengo días de lucro para esa suerte.';
      else if (tiene(t, 'corte')) frase = F.M && F.M[0] ? `Último corte (maestro): <b>${fechaLarga(F.M[0])}</b>.` : 'No tengo la fecha de corte de esa suerte.';
      else if (tiene(t, 'siembra', 'sembro', 'sembrada', 'se siembra')) frase = F.L.some(l => l.e === 'SEMBRADA') ? `Está <b>sembrada</b>${F.M && F.M[1] ? ` (maestro: ${fechaLarga(F.M[1])})` : ''}.` : F.R ? 'Está <b>en ruta de siembra</b>.' : 'Aún <b>no está sembrada</b>.';
      else if (tiene(t, 'estado', 'como va', 'como esta', 'en que va', 'que pasa')) frase = F.P ? `Está en <b>${esc(cap(F.P.labor))}</b>.` : F.L.some(l => l.e === 'SEMBRADA') ? 'Está <b>sembrada</b>.' : F.R ? 'Está <b>en ruta de siembra</b>.' : F.L.length ? 'Está <b>pendiente</b> y no aparece en labores esta semana.' : F.P26 ? 'Está en el <b>presupuesto 2026</b> pero <b>no aparece en el comité</b> (sin iniciar).' : F.Q ? 'Está en el <b>programa 2027</b>.' : '';
      else if (tiene(t, 'presupuesto', 'ppto')) frase = F.P26 ? `Sí está en el presupuesto 2026 (${MESES[F.P26.mes - 1] || '—'}).` : 'No está en el presupuesto 2026.';
      else if (tiene(t, 'area', 'hectarea', 'cuantas ha', 'tamano')) frase = `Tiene <b>${ha(F.area)}</b>.`;
      else if (tiene(t, 'variedad')) { const v = (F.R && F.R.variedad) || (F.L[0] && F.L[0].v) || (F.Q && F.Q.v1); frase = v ? `Variedad: <b>${esc(v)}</b>.` : 'No tengo variedad registrada.'; }
      else if (tiene(t, 'contratista', 'quien')) frase = F.P && F.P.cont && F.P.cont !== '—' ? `Contratista: <b>${esc(F.P.cont)}</b>.` : F.R && F.R.cont ? `Contratista de siembra: <b>${esc(F.R.cont)}</b>.` : 'No tiene contratista asignado esta semana.';
      return (frase ? frase + '<br>' : '') + F.html;
    }
    if (S.length > 1) return `Encontré ${S.length} suertes con ese número. ¿Cuál?${lista(S.slice(0, 12).map(x => `<a href="#" class="iv-preg" data-q="${esc(x.s)} ${esc(x.h)}">${esc(x.s)} · ${esc(x.h)}</a>`))}`;

    // 3) Definiciones explícitas ("qué es…")
    const g = buscarConcepto(t);
    const definir = tiene(t, 'que es', 'que son', 'para que', 'como se hace', 'explica', 'definicion', 'significa', 'diferencia', 'cual es la funcion', 'sirve', 'como se calcula', 'como calcular', 'tipos de', 'recomend', 'como se mide', 'cada cuanto', 'cuantos bultos', 'que tan');
    if (g && definir && !tiene(t, 'promedio')) return `<b>${g.t}</b><br>${g.d}`;

    // 4) Protocolos de emergencia
    if (tiene(t, 'protocolo', 'emergencia', 'que hacer si', 'que hago si', 'se rompe', 'ruptura', 'incendio', 'derrame', 'accidente', 'ola invernal', 'invierno', 'creciente', 'inund', 'libro de reaccion')) {
      if (tiene(t, 'que protocolos', 'cuales protocolos', 'protocolos hay', 'lista de protocolos') || (tiene(t, 'protocolos') && !protocoloEn(t))) {
        return `<b>Protocolos de emergencia</b>${lista(protocolos().map(p => `${esc(p.titulo)}${p.borrador ? ' <small>(borrador)</small>' : ''} <a href="#" class="iv-preg" data-q="protocolo ${esc(p.titulo)}">ver</a>`))}${ir('proto', 'Abrir protocolos')}`;
      }
      const p = protocoloEn(t); if (p) return protocoloTxt(p, t);
    }
    // 5) Personas y cargos
    if (tiene(t, 'quien', 'jefe', 'coordinador', 'coordinadora', 'analista', 'tecnico', 'telefono', 'celular', 'contacto', 'numero de', 'especialista', 'practicante', 'maestro de obra', 'cargo')) {
      const r = personasTxt(t); if (r) return r;
      if (tiene(t, 'responsable', 'encargado', 'a cargo', 'quien')) { const r2 = procesosTxt(t); if (r2) return r2; }
    }
    if (tiene(t, 'responsable', 'encargado', 'a cargo de', 'procesos')) { const r = procesosTxt(t); if (r) return r; }
    // 6) Proyectos ejecutados
    const pj = proyectoEn(t);
    if (tiene(t, 'proyecto', 'obra', 'ejecutad', 'ranchera', 'bombeo', 'drenaje entubado', 'estacion') || (pj && tiene(t, 'costo', 'costó', 'inversion', 'cuanto', 'estado'))) {
      if (pj) return proyectoTxt(pj);
      const L = typeof proyectos === 'function' ? proyectos() : [];
      if (L.length) return `<b>Proyectos ejecutados</b> (${L.length} · ${moneyM(sum(L, p => +p.inversion || 0))})${lista(L.map(p => `${esc(p.nombre)} · ${esc(p.estado || '')} <a href="#" class="iv-preg" data-q="proyecto ${esc(p.nombre)}">ver</a>`))}${ir('proy', 'Abrir proyectos')}`;
    }
    // 7) Presupuesto 2026 (cruce) y 2027
    if (tiene(t, '2027', 'renueva', 'renovar') && !tiene(t, '2026')) return ppto27(t);
    if (tiene(t, 'presupuesto', 'ppto', 'atrasad', 'retrasad', 'fuera de presupuesto', 'cumplimiento') && !tiene(t, '2027')) return ppto26Txt(t);
    // 8) Días de lucro
    if (tiene(t, 'lucro', 'dias promedio') && !tiene(t, 'agronomia', 'real')) return lucroTxt(t);
    // 9) Agronomía
    if (tiene(t, 'agronomia', 'fecha de siembra real', 'lucro cesante real', 'lucro real') && typeof agroFilas === 'function') {
      const A = agroFilas(), PL = typeof promedioLucro === 'function' ? promedioLucro(A) : null, PM = typeof promedioLucro === 'function' ? promedioLucro(A, 'mLucro') : null;
      return `<b>Gestión Agronomía</b>${lista([`${A.length} suertes · ${ha(sum(A, x => x.a))}`, `${A.filter(x => x.fecha).length} con fecha de siembra real registrada`,
        PM && PM.prom != null ? `Lucro cesante promedio (maestro): <b>${Math.round(PM.prom)} días</b>` : '', PL && PL.prom != null ? `Lucro cesante real: <b>${Math.round(PL.prom)} días</b>` : ''].filter(Boolean))}${ir('agro', 'Abrir agronomía')}`;
    }
    // 10) Costos, tarifas y simulador
    const c = contratistaEn(t);
    if (tiene(t, 'tarifa', 'cuanto cuesta', 'cuanto vale', 'precio', 'valor de')) {
      if (tiene(t, 'hectarea', 'preparar', 'preparacion') && !c) {
        const Pp = (DB.sim && DB.sim.ppto) || [], tot = sum(Pp, l => (+l.cant || 0) * (+l.costo || 0));
        if (Pp.length) return `<b>Costo presupuestado de preparación por hectárea</b>${lista(Pp.map(l => `${esc(l.labor)}: ${l.cant} pases × ${money(l.costo)} = <b>${money(l.cant * l.costo)}</b>`))}Total: <b>${money(tot)}/ha</b>${ir('simulador', 'Abrir el simulador')}`;
      }
      const r = buscarTarifas(t, c && c[0]); if (r) return r;
    }
    if (tiene(t, 'costo', 'simulador', 'sobrecosto', 'ahorro', 'inversion') && typeof simSuertes === 'function') {
      const L = simSuertes(), tot = sum(L, s => s.total), ppT = sum(L, s => s.pptoTotal);
      return `<b>Simulador · suertes en proceso</b>${lista([`Costo proyectado <b>${moneyM(tot)}</b> vs presupuesto ${moneyM(ppT)} → ${ppT - tot >= 0 ? 'ahorro' : 'sobrecosto'} <b>${moneyM(Math.abs(ppT - tot))}</b>`,
        ...L.map(s => `${esc(s.r.sue)} ${esc(s.r.hac)}: ${moneyM(s.total)} (${s.dif >= 0 ? 'ahorro' : 'sobrecosto'} ${money(Math.abs(s.dif))}/ha)`)])}${ir('simulador', 'Abrir el simulador')}`;
    }
    if (c) {
      const P = DB.proceso.filter(r => r.cont === c[0]), R = DB.ruta.filter(r => r.cont === c[0]), T = tarifas().filter(x => x.contratista === c[0]);
      return `<b>${esc(c[0])}</b>${lista([P.length ? `En proceso: ${P.map(r => `${esc(r.sue)} ${esc(r.hac)} (${esc(cap(r.labor))})`).join(', ')}` : 'Sin suertes en proceso esta semana',
        R.length ? `En ruta de siembra: ${R.map(r => esc(r.s)).join(', ')}` : '', T.length ? `${T.length} tarifas en el simulador (pregunta "tarifas de ${esc(cap(c[0]))}")` : ''].filter(Boolean))}`;
    }
    // 11) Labores, comparativo, ruta, arroz
    if (tiene(t, 'semana pasada', 'semana anterior', 'comparacion', 'comparativo', 'que cambio', 'cambios')) return comparativoTxt();
    const labores = ['descepada', 'nivelacion', 'land plane', 'subsuelo', 'rastra', 'pulida', 'surcada', 'canterizador'];
    const lab = labores.find(l => t.includes(l));
    if (lab && !definir) return porLaborTxt(lab);
    if (tiene(t, 'labores', 'en proceso', 'proceso', 'labor')) return porLaborTxt('');
    if (tiene(t, 'ruta', 'por sembrar', 'proximas a sembrar', 'siembra esta semana', 'semillero', 'bandereo')) return DB.ruta.length
      ? `<b>Ruta de siembra · ${esc(DB.meta.semana)}</b>${lista(DB.ruta.map(r => `${esc(r.s)} ${esc(r.h)} · ${ha(r.a)} · ${esc(r.variedad || '—')} · semillero ${esc(r.semillero || '—')}${r.cont ? ' · ' + esc(r.cont) : ''}`))}` : 'No hay suertes en ruta de siembra esta semana.';
    if (tiene(t, 'arroz')) {
      const A = DB.lotes.filter(l => l.c === 'ARROZ' && (!z || l.z === z));
      return `<b>Suertes con arroz</b> (${A.length} · ${ha(sum(A, l => l.a))})${lista(A.map(l => `${esc(l.s)} ${esc(l.h)} · ${ha(l.a)} · ${l.e === 'SEMBRADA' ? 'sembrada' : 'pendiente'}`))}`;
    }
    // 12) Rankings
    if (tiene(t, 'mas area', 'mayor area', 'mas grande', 'mas hectareas')) { const L = DB.lotes.slice().sort((a, b) => b.a - a.a); return `<b>Suertes con más área</b>${lista(L.slice(0, 6).map(l => `${esc(l.s)} ${esc(l.h)} · <b>${ha(l.a)}</b> · ${l.e.toLowerCase()}`))}`; }
    if (tiene(t, 'mas dias', 'mayor', 'prioridad', 'priorizar', 'mas atrasad', 'urgente', 'mas lucro')) {
      const pen = DB.lotes.filter(l => l.e !== 'SEMBRADA').sort((a, b) => dl(b) - dl(a));
      return `<b>Pendientes con más días de lucro</b>${lista(pen.slice(0, 8).map(l => `${esc(l.s)} ${esc(l.h)} · <b>${dl(l)} días</b> · ${ha(l.a)}`))}`;
    }
    // 13) Hacienda / zona / resumen
    if (hac) return resumenHacienda(hac, t);
    if (z) return totales(z);
    if (tiene(t, 'sembrad', 'avance', 'cuantas hectareas', 'total', 'pendiente', 'falta', 'resumen', 'como vamos', 'como va', 'semana', 'llevamos', 'indicador')) return totales(0);
    // 14) Personas por nombre suelto ("luis acosta")
    { const r = personasTxt(t); if (r) return r; }
    if (g) return `<b>${g.t}</b><br>${g.d}`;
    // 15) Búsqueda en toda la plataforma
    const b = buscarTodo(t); if (b) return b;
    return `No encontré eso todavía 🤔. Puedo responder sobre: <b>suertes</b> (por número y hacienda), <b>haciendas y zonas</b>, <b>resumen de la semana</b>, <b>presupuesto 2026</b> (qué falta, atrasadas), <b>2027</b>, <b>días de lucro</b>, <b>labores</b> y <b>ruta</b>, <b>costos y tarifas</b>, <b>proyectos</b>, <b>protocolos de emergencia</b>, <b>personas y cargos</b>, y conceptos de ingeniería (pregunta "¿qué es…?").`;
  }
  return {responder, AYUDA, EJEMPLOS};
})();

// ── Ventana del chat ──
(function(){
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'iv-fab'; btn.title = 'Inge Virtual: pregúntame sobre la plataforma de Ingeniería Agrícola';
  btn.innerHTML = '<span>👷</span><b>Inge Virtual</b>';
  const win = document.createElement('div');
  win.className = 'iv-win'; win.hidden = true;
  win.innerHTML = `<div class="iv-h"><span class="iv-av">👷</span><div><b>Inge Virtual</b><small>Ingeniería Agrícola · Riopaila Agrícola</small></div><button type="button" class="iv-borrar" title="Borrar la conversación">🗑 Borrar chat</button><button type="button" class="iv-x" title="Cerrar">✕</button></div>
    <div class="iv-msgs" id="iv-msgs"></div>
    <form class="iv-f" id="iv-f"><input id="iv-in" type="text" autocomplete="off" placeholder="Escribe tu pregunta…"><button type="submit">➤</button></form>`;
  document.body.append(btn, win);
  const msgs = win.querySelector('#iv-msgs'), inp = win.querySelector('#iv-in');
  const poner = (html, quien) => { const d = document.createElement('div'); d.className = 'iv-m ' + quien; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
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
    const espera = poner('<span class="iv-escribe"><i></i><i></i><i></i></span>', 'bot');
    let r; try { r = IV.responder(txt); } catch (e) { console.error(e); r = 'Tuve un problema leyendo los datos 😕. Intenta de otra forma.'; }
    setTimeout(() => { espera.innerHTML = r; msgs.scrollTop = msgs.scrollHeight; }, 250);
  }
  btn.addEventListener('click', () => abrir(win.hidden));
  win.querySelector('.iv-x').addEventListener('click', () => abrir(false));
  win.querySelector('.iv-borrar').addEventListener('click', () => { msgs.innerHTML = ''; poner(IV.AYUDA + chips(), 'bot'); inp.value = ''; inp.focus(); });
  win.querySelector('#iv-f').addEventListener('submit', e => { e.preventDefault(); preguntar(inp.value); inp.value = ''; });
  msgs.addEventListener('click', e => {
    const p = e.target.closest('.iv-preg'); if (p) { e.preventDefault(); preguntar(p.dataset.q); return; }
    const b = e.target.closest('.iv-ir'); if (!b) return;
    const d = b.dataset, chico = window.innerWidth < 760;
    if (d.ivMod) { if (chico) abrir(false); irA(d.ivMod); return; }
    if (d.ivProy) { const x = proyectos().find(y => y.id === d.ivProy); if (x) abrirPresentacion(x); return; }
    if (d.ivPr) { const x = protocolos().find(y => y.id === d.ivPr); if (x) abrirPresentacion(x, prDiapositivas(x), '🚨 ' + x.titulo); return; }
    if (chico) abrir(false);
    irA('aps');
    F.hac = d.ivHac; q('sel-hac').value = d.ivHac; q('sel-hac').className = 'fsel on'; estadoTabla = 'all'; render();
    const row = d.ivSue && [...q('lotes-tbody').querySelectorAll('tr')].find(r => r.dataset.sue === d.ivSue);
    if (row) { row.scrollIntoView({behavior:'smooth', block:'center'}); row.style.background = '#fff3cd'; setTimeout(() => row.style.background = '', 1800); }
  });
})();
