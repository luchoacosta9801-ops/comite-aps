// Datos publicados (semana 40 · 30 Sep 2026), tomados de "30092026 - Comite APS.xlsm".
// La app los copia al navegador; si se publica un corte nuevo (meta.corte distinto),
// reemplaza lo guardado en el navegador (ver store.js).
const SEED = {
  meta: {
    fecha: "30 Sep 2026",
    semana: "Semana 40",
    corte: "2026-09-30",
    pptoTotal: 555.45, // ha presupuestadas a septiembre (RESUMEN); % vs ppto = sembradas / pptoTotal
  },
  // s=suerte h=hacienda z=zona a=área c=cultivo d=días lucro e=estado p=en ppto v=variedad
  // Una suerte puede aparecer dos veces (ej. antes arroz sembrada, ahora caña pendiente).
  lotes: [
    {s:"3110-050",h:"NORMANDIA",  z:2,a:8.33, c:"CAÑA", d:273,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3501-050",h:"RIOPAILA",   z:1,a:8.62, c:"CAÑA", d:309,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3501-052",h:"RIOPAILA",   z:1,a:2.92, c:"CAÑA", d:311,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3111-200",h:"PERALONSO",  z:2,a:12.44,c:"CAÑA", d:381,e:"PENDIENTE",p:"NO", v:"CC 01-1940"},
    {s:"3111-090",h:"PERALONSO",  z:2,a:12.95,c:"CAÑA", d:201,e:"PENDIENTE",p:"NO", v:"VARIAS"},
    {s:"3111-131",h:"PERALONSO",  z:2,a:15.03,c:"CAÑA", d:271,e:"PENDIENTE",p:"SI", v:"CC 11-595"},
    {s:"3107-780",h:"LA LUISA",   z:1,a:9.00, c:"CAÑA", d:434,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3501-431",h:"RIOPAILA",   z:1,a:3.17, c:"CAÑA", d:383,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3501-432",h:"RIOPAILA",   z:1,a:1.87, c:"CAÑA", d:369,e:"SEMBRADA", p:"NO", v:"RENOVACION"},
    {s:"3111-120",h:"PERALONSO",  z:2,a:12.99,c:"CAÑA", d:446,e:"SEMBRADA", p:"SI", v:"VARIAS"},
    {s:"3107-700",h:"LA LUISA",   z:1,a:7.52, c:"CAÑA", d:460,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3104-051",h:"VALPARAISO", z:2,a:5.18, c:"CAÑA", d:442,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3109-061",h:"VENECIA",    z:2,a:11.43,c:"CAÑA", d:241,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3113-110",h:"SAN NICOLAS",z:2,a:15.24,c:"CAÑA", d:259,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3109-310",h:"VENECIA",    z:2,a:15.77,c:"CAÑA", d:254,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3110-200",h:"NORMANDIA",  z:2,a:17.24,c:"ARROZ",d:202,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3107-390",h:"LA LUISA",   z:1,a:9.87, c:"CAÑA", d:115,e:"SEMBRADA", p:"SI", v:"CC 11-600"},
    {s:"3111-060",h:"PERALONSO",  z:2,a:9.25, c:"CAÑA", d:79, e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3113-070",h:"SAN NICOLAS",z:2,a:17.20,c:"CAÑA", d:294,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3111-052",h:"PERALONSO",  z:2,a:3.40, c:"CAÑA", d:118,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3104-020",h:"VALPARAISO", z:2,a:10.42,c:"CAÑA", d:273,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3122-321",h:"VENECIA",    z:2,a:5.51, c:"CAÑA", d:191,e:"SEMBRADA", p:"SI", v:"CC 11-600"},
    {s:"3104-070",h:"VALPARAISO", z:2,a:14.29,c:"CAÑA", d:266,e:"SEMBRADA", p:"SI", v:"RENOVACION"},
    {s:"3233-100",h:"LAGUNAS",    z:1,a:7.88, c:"CAÑA", d:208,e:"SEMBRADA", p:"SI", v:"CC 11-595"},
    {s:"3111-090",h:"PERALONSO",  z:2,a:12.95,c:"ARROZ",d:201,e:"SEMBRADA", p:"NO", v:"VARIAS"},
    {s:"3107-860",h:"LA LUISA",   z:1,a:5.73, c:"CAÑA", d:210,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3106-342",h:"LA LUISA",   z:1,a:4.84, c:"CAÑA", d:212,e:"SEMBRADA", p:"NO", v:"CC 11-595"},
    {s:"3501-540",h:"RIOPAILA",   z:1,a:10.11,c:"CAÑA", d:259,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3440-723",h:"PAILA ARRIBA",z:1,a:7.63, c:"CAÑA", d:328,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3501-050",h:"RIOPAILA",   z:1,a:8.62, c:"ARROZ",d:309,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3501-052",h:"RIOPAILA",   z:1,a:2.92, c:"ARROZ",d:311,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3501-432",h:"RIOPAILA",   z:1,a:1.87, c:"ARROZ",d:369,e:"SEMBRADA", p:"NO", v:"RENOVACION"},
    {s:"3501-431",h:"RIOPAILA",   z:1,a:3.17, c:"ARROZ",d:383,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3111-131",h:"PERALONSO",  z:2,a:15.03,c:"ARROZ",d:271,e:"SEMBRADA", p:"SI", v:"CC 11-595"},
    {s:"3122-050",h:"VENECIA",    z:2,a:16.83,c:"CAÑA", d:399,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3440-711",h:"PAILA ARRIBA",z:1,a:0.44, c:"CAÑA", d:304,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3122-150",h:"VENECIA",    z:2,a:13.49,c:"CAÑA", d:377,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3110-031",h:"NORMANDIA",  z:2,a:5.91, c:"CAÑA", d:383,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3110-030",h:"NORMANDIA",  z:2,a:6.91, c:"CAÑA", d:373,e:"SEMBRADA", p:"SI", v:"RENOVACION"},
    {s:"3110-110",h:"NORMANDIA",  z:2,a:15.51,c:"CAÑA", d:182,e:"SEMBRADA", p:"NO", v:"RENOVACION"},
    {s:"3111-080",h:"PERALONSO",  z:2,a:15.26,c:"CAÑA", d:286,e:"SEMBRADA", p:"SI", v:"CC 11-600"},
    {s:"3501-520",h:"RIOPAILA",   z:1,a:9.81, c:"CAÑA", d:122,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3501-230",h:"RIOPAILA",   z:1,a:8.50, c:"CAÑA", d:564,e:"SEMBRADA", p:"NO", v:"CC 85-92"},
    {s:"3426-010",h:"MEDIA LUNA", z:2,a:13.48,c:"CAÑA", d:322,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3418-030",h:"LA PAILA",   z:1,a:16.59,c:"CAÑA", d:401,e:"SEMBRADA", p:"NO", v:"CC 11-600"},
    {s:"3106-361",h:"LA LUISA",   z:1,a:6.25, c:"CAÑA", d:355,e:"SEMBRADA", p:"NO", v:"CC 97-7170"},
    {s:"3426-020",h:"MEDIA LUNA", z:2,a:10.26,c:"CAÑA", d:315,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
  ],
  // RUTA DE SIEMBRA vigente (orden = orden de siembra)
  ruta: [
    {h:"NORMANDIA", s:"3110-050", a:8.33, d:273, variedad:"CC 13-2035", semillero:"3113-080", bandereo:12, cont:"ANDRUSV"},
    {h:"RIOPAILA",  s:"3501-052", a:2.92, d:311, variedad:null, semillero:null, bandereo:null, cont:null},
    {h:"RIOPAILA",  s:"3501-050", a:8.62, d:309, variedad:null, semillero:null, bandereo:null, cont:null},
  ],
  // RUTA SEMANA PASADA: cada suerte en proceso pertenece a UNA sola labor
  proceso: [
    {hac:"PERALONSO", z:2, sue:"3111-200", area:12.44, dias:381, cont:"RIOCAST", labor:"DESCEPADA", obs:"SIN INICIAR", variedad:null},
    {hac:"PERALONSO", z:2, sue:"3111-090", area:12.95, dias:201, cont:"RIOCAST", labor:"DESCEPADA", obs:"SIN INICIAR", variedad:null},
    {hac:"PERALONSO", z:2, sue:"3111-131", area:15.03, dias:271, cont:"RIOCAST", labor:"DESCEPADA", obs:"SIN INICIAR", variedad:null},
    {hac:"RIOPAILA",  z:1, sue:"3501-050", area:8.62,  dias:309, cont:"BIENES",  labor:"SURCADA",   obs:null,          variedad:null},
    {hac:"RIOPAILA",  z:1, sue:"3501-052", area:2.92,  dias:311, cont:"BIENES",  labor:"SURCADA",   obs:null,          variedad:null},
    {hac:"NORMANDIA", z:2, sue:"3110-050", area:8.33,  dias:273, cont:"RIOCAST", labor:"SURCADA",   obs:null,          variedad:null},
  ],
  // PPTO 2026 mensual (ha): ENE..DIC
  pptoMensual: {
    z1:[45.32,116.75,45.63,0,0,33.03,66.76,41.56,22.26,39.81,9.74,48.35],
    z2:[15.77,47.44,3.40,0,0,33.33,13.35,48.96,21.89,24.98,0,63.46],
  },
  // PANEL CONTROL · costos de preparación ($/ha real, $/ha ppto, total $)
  costos: [
    {concepto:"Preparación", real:1007086, ppto:2324317, total:452815870},
    {concepto:"Nivelación",  real:0,       ppto:null,    total:0},
    {concepto:"Adecuación",  real:167124,  ppto:null,    total:75143916},
  ],
};

const HACS_BASE = ["PERALONSO","VENECIA","NORMANDIA","RIOPAILA","LA LUISA","SAN NICOLAS","VALPARAISO","MEDIA LUNA","LA PAILA","PAILA ARRIBA","LAGUNAS"];
const Z1_HACS = new Set(["LA LUISA","LAGUNAS","RIOPAILA","PAILA ARRIBA","LA PAILA"]);
const LABORES = ["DESCEPADA","TOPOGRAFIA","SUBSUELO","RASTRA","PULIDA","SURCADA","NIVELACION"];
const VARIEDADES = ["CC 01-1940","CC 11-600","CC 11-595","RENOVACION","CC 85-92","CC 97-7170","VARIAS"];
const LABOR_COLORS = {
  SURCADA:'#0077aa', NIVELACION:'#7c3aed', SUBSUELO:'#b45309',
  DESCEPADA:'#00875a', TOPOGRAFIA:'#0369a1', RASTRA:'#6d28d9', PULIDA:'#c2410c'
};
const MESES = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];
const VCLRS = ['#00875a','#0077aa','#b45309','#6d28d9','#c2410c','#64748b','#0369a1'];

// Nombres de hacienda tal como se muestran en el filtro
const HAC_LABEL = {
  "PERALONSO":"Peralonso","VENECIA":"Venecia","NORMANDIA":"Normandia","RIOPAILA":"Riopaila",
  "SAN NICOLAS":"S. Nicolás","LA LUISA":"La Luisa","VALPARAISO":"Valparaíso","MEDIA LUNA":"Media Luna",
  "LA PAILA":"La Paila","PAILA ARRIBA":"Paila Arriba","LAGUNAS":"Lagunas"
};
// Orden de las labores en el panel "Avance labores"
const ORDEN_LAB = ["DESCEPADA","PULIDA","SURCADA","SUBSUELO","TOPOGRAFIA","RASTRA","NIVELACION"];
const MESES_LARGOS = {ENE:"Enero",FEB:"Febrero",MAR:"Marzo",ABR:"Abril",MAY:"Mayo",JUN:"Junio",
  JUL:"Julio",AGO:"Agosto",SEP:"Septiembre",OCT:"Octubre",NOV:"Noviembre",DIC:"Diciembre"};

function zonaDe(hac){ return Z1_HACS.has(hac) ? 1 : 2; }
// "7 Sep 2026" → "7 Septiembre 2026" (otros formatos se dejan igual)
function fechaLarga(f){
  return String(f).replace(/\b([A-Za-zÁÉÍÓÚáéíóú]{3})\b/, m => MESES_LARGOS[m.toUpperCase()] || m);
}
