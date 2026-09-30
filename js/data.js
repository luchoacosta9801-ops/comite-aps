// Datos iniciales (semana 37 · 7 Sep 2026). La app los copia al navegador la
// primera vez; después se trabaja sobre la copia guardada (ver store.js).
const SEED = {
  meta: {
    fecha: "7 Sep 2026",
    semana: "Semana 37",
    pptoTotal: 555.45, // ha presupuestadas 2026 (% vs ppto = sembradas / pptoTotal)
  },
  // s=suerte h=hacienda z=zona a=área c=cultivo d=días lucro e=estado p=en ppto v=variedad
  // Una suerte puede aparecer dos veces (ej. antes arroz sembrada, ahora caña pendiente).
  lotes: [
    {s:"3110-050",h:"NORMANDIA",   z:2,a:8.33, c:"CAÑA", d:249,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3501-050",h:"RIOPAILA",    z:1,a:8.62, c:"CAÑA", d:285,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3501-052",h:"RIOPAILA",    z:1,a:2.92, c:"CAÑA", d:287,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3501-431",h:"RIOPAILA",    z:1,a:3.17, c:"CAÑA", d:359,e:"PENDIENTE",p:"NO", v:"CC 01-1940"},
    {s:"3501-432",h:"RIOPAILA",    z:1,a:1.87, c:"CAÑA", d:345,e:"PENDIENTE",p:"NO", v:"RENOVACION"},
    {s:"3107-780",h:"LA LUISA",    z:1,a:9.00, c:"CAÑA", d:410,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3107-700",h:"LA LUISA",    z:1,a:7.52, c:"CAÑA", d:436,e:"PENDIENTE",p:"SI", v:"CC 01-1940"},
    {s:"3111-120",h:"PERALONSO",   z:2,a:12.99,c:"CAÑA", d:422,e:"PENDIENTE",p:"SI", v:"VARIAS"},
    {s:"3104-051",h:"VALPARAISO",  z:2,a:5.18, c:"CAÑA", d:418,e:"PENDIENTE",p:"NO", v:"CC 01-1940"},
    {s:"3109-061",h:"VENECIA",     z:2,a:11.43,c:"CAÑA", d:217,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3113-110",h:"SAN NICOLAS", z:2,a:15.24,c:"CAÑA", d:235,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3109-310",h:"VENECIA",     z:2,a:15.77,c:"CAÑA", d:230,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3110-200",h:"NORMANDIA",   z:2,a:17.24,c:"ARROZ",d:202,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3107-390",h:"LA LUISA",    z:1,a:9.87, c:"CAÑA", d:115,e:"SEMBRADA", p:"SI", v:"CC 11-600"},
    {s:"3111-060",h:"PERALONSO",   z:2,a:9.25, c:"CAÑA", d:79, e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3113-070",h:"SAN NICOLAS", z:2,a:17.20,c:"CAÑA", d:294,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3111-052",h:"PERALONSO",   z:2,a:3.40, c:"CAÑA", d:118,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3104-020",h:"VALPARAISO",  z:2,a:10.42,c:"CAÑA", d:249,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3122-321",h:"VENECIA",     z:2,a:5.48, c:"CAÑA", d:167,e:"SEMBRADA", p:"SI", v:"CC 11-600"},
    {s:"3104-070",h:"VALPARAISO",  z:2,a:14.00,c:"CAÑA", d:242,e:"SEMBRADA", p:"SI", v:"RENOVACION"},
    {s:"3233-100",h:"LAGUNAS",     z:1,a:8.10, c:"CAÑA", d:184,e:"SEMBRADA", p:"SI", v:"CC 11-595"},
    {s:"3111-090",h:"PERALONSO",   z:2,a:13.50,c:"ARROZ",d:177,e:"SEMBRADA", p:"NO", v:"VARIAS"},
    {s:"3107-860",h:"LA LUISA",    z:1,a:5.85, c:"CAÑA", d:186,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3106-342",h:"LA LUISA",    z:1,a:5.02, c:"CAÑA", d:188,e:"SEMBRADA", p:"NO", v:"CC 11-595"},
    {s:"3501-540",h:"RIOPAILA",    z:1,a:9.63, c:"CAÑA", d:235,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3440-723",h:"PAILA ARRIBA",z:1,a:7.72, c:"CAÑA", d:304,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3501-050",h:"RIOPAILA",    z:1,a:8.62, c:"ARROZ",d:285,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3501-052",h:"RIOPAILA",    z:1,a:2.92, c:"ARROZ",d:287,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3501-432",h:"RIOPAILA",    z:1,a:1.87, c:"ARROZ",d:345,e:"SEMBRADA", p:"NO", v:"RENOVACION"},
    {s:"3501-431",h:"RIOPAILA",    z:1,a:3.17, c:"ARROZ",d:359,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3111-131",h:"PERALONSO",   z:2,a:15.64,c:"ARROZ",d:247,e:"SEMBRADA", p:"SI", v:"CC 11-595"},
    {s:"3122-050",h:"VENECIA",     z:2,a:17.34,c:"CAÑA", d:375,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3440-711",h:"PAILA ARRIBA",z:1,a:0.44, c:"CAÑA", d:280,e:"SEMBRADA", p:"SI", v:"CC 01-1940"},
    {s:"3122-150",h:"VENECIA",     z:2,a:13.48,c:"CAÑA", d:353,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3110-031",h:"NORMANDIA",   z:2,a:6.13, c:"CAÑA", d:359,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3110-030",h:"NORMANDIA",   z:2,a:7.06, c:"CAÑA", d:349,e:"SEMBRADA", p:"SI", v:"RENOVACION"},
    {s:"3110-110",h:"NORMANDIA",   z:2,a:15.51,c:"CAÑA", d:182,e:"SEMBRADA", p:"NO", v:"RENOVACION"},
    {s:"3111-080",h:"PERALONSO",   z:2,a:16.80,c:"CAÑA", d:262,e:"SEMBRADA", p:"SI", v:"CC 11-600"},
    {s:"3501-520",h:"RIOPAILA",    z:1,a:9.81, c:"CAÑA", d:122,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3501-230",h:"RIOPAILA",    z:1,a:8.50, c:"CAÑA", d:540,e:"SEMBRADA", p:"NO", v:"CC 85-92"},
    {s:"3426-010",h:"MEDIA LUNA",  z:2,a:12.55,c:"CAÑA", d:298,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
    {s:"3418-030",h:"LA PAILA",    z:1,a:16.81,c:"CAÑA", d:377,e:"SEMBRADA", p:"NO", v:"CC 11-600"},
    {s:"3106-361",h:"LA LUISA",    z:1,a:6.50, c:"CAÑA", d:331,e:"SEMBRADA", p:"NO", v:"CC 97-7170"},
    {s:"3426-020",h:"MEDIA LUNA",  z:2,a:9.34, c:"CAÑA", d:291,e:"SEMBRADA", p:"NO", v:"CC 01-1940"},
  ],
  // RUTA DE SIEMBRA vigente (orden = orden de siembra)
  ruta: [
    {h:"VALPARAISO", s:"3104-051",a:5.18, d:418,variedad:"CC 13-2035",             semillero:"3113-080",           bandereo:12,cont:"ANDRUSV"},
    {h:"NORMANDIA",  s:"3110-050",a:8.33, d:249,variedad:"CC 13-2035",             semillero:"3113-080",           bandereo:12,cont:"ANDRUSV"},
    {h:"LA LUISA",   s:"3107-700",a:7.52, d:436,variedad:"CC 13-2035 / CC 110129", semillero:"3107-410 / 3113-080",bandereo:12,cont:"ANDRUSV"},
  ],
  // RUTA SEMANA PASADA: cada suerte en proceso pertenece a UNA sola labor
  proceso: [
    {hac:"PERALONSO",  z:2, sue:"3111-120", area:12.99, dias:422, cont:"RIOCAST", labor:"PULIDA",    obs:"1 PASE REALIZADO",   variedad:null},
    {hac:"RIOPAILA",   z:1, sue:"3501-050", area:8.62,  dias:285, cont:"BIENES",  labor:"DESCEPADA", obs:"2 PASES REALIZADOS", variedad:null},
    {hac:"RIOPAILA",   z:1, sue:"3501-052", area:2.92,  dias:287, cont:"BIENES",  labor:"DESCEPADA", obs:"2 PASES REALIZADOS", variedad:null},
    {hac:"RIOPAILA",   z:1, sue:"3501-431", area:3.17,  dias:359, cont:"BIENES",  labor:"DESCEPADA", obs:"1 PASE REALIZADO",   variedad:null},
    {hac:"RIOPAILA",   z:1, sue:"3501-432", area:1.87,  dias:345, cont:"BIENES",  labor:"DESCEPADA", obs:"1 PASE REALIZADO",   variedad:null},
    {hac:"NORMANDIA",  z:2, sue:"3110-050", area:8.33,  dias:249, cont:"RIOCAST", labor:"SURCADA",   obs:null,                 variedad:null},
    {hac:"LA LUISA",   z:1, sue:"3107-780", area:9.00,  dias:410, cont:"RIOCAST", labor:"SUBSUELO",  obs:"PARCIAL",            variedad:null},
    {hac:"LA LUISA",   z:1, sue:"3107-700", area:7.52,  dias:436, cont:"RIOCAST", labor:"SURCADA",   obs:null,                 variedad:null},
    {hac:"VALPARAISO", z:2, sue:"3104-051", area:5.18,  dias:418, cont:"RIOCAST", labor:"SURCADA",   obs:null,                 variedad:null},
  ],
  // PPTO 2026 mensual (ha): ENE..DIC
  pptoMensual: {
    z1:[45.32,116.75,45.63,0,0,33.03,66.76,41.56,22.26,39.81,9.74,48.35],
    z2:[15.77,47.44,3.40,0,0,33.33,13.35,48.96,21.89,24.98,0,63.46],
  },
  // PANEL CONTROL · costos de preparación ($/ha real, $/ha ppto, total $)
  costos: [
    {concepto:"Preparación", real:1000636, ppto:2334352, total:373167218},
    {concepto:"Nivelación",  real:0,       ppto:null,    total:0},
    {concepto:"Adecuación",  real:159593,  ppto:null,    total:59516913},
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

function zonaDe(hac){ return Z1_HACS.has(hac) ? 1 : 2; }
