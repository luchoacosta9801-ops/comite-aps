// Catálogos y utilidades fijas (los datos publicados están en js/datos.js).
const HACS_BASE = ["PERALONSO","VENECIA","NORMANDIA","RIOPAILA","LA LUISA","SAN NICOLAS","VALPARAISO","MEDIA LUNA","LA PAILA","PAILA ARRIBA","LAGUNAS"];
const Z1_HACS = new Set(["LA LUISA","LAGUNAS","RIOPAILA","PAILA ARRIBA","LA PAILA"]);
const LABORES = ["DESCEPADA","TOPOGRAFIA","SUBSUELO","RASTRA","PULIDA","SURCADA","NIVELACION"];
// Contratistas de la ruta de siembra (la lista se puede editar en la app; se publica en datos.js)
const CONTRATISTAS_BASE = ["ANDRUSV","RIOCAST","BIENES"];
const CONTRATISTA_DEFECTO = "ANDRUSV";
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
// Presupuesto 2026 acumulado (ha) de enero hasta el mes de referencia (la fecha fijada 📌 o hoy), sumando
// DB.pptoMensual; así el "% vs presupuesto" se pone al día solo al cambiar de mes. z = 1 | 2 para una zona
function pptoAlMes(z){
  const P = DB.pptoMensual, ks = Object.keys(MESES_LARGOS);
  if (!P || !P.z1) return {ha:DB.meta.pptoTotal || 0, mes:null, nom:''};
  const f = DB.meta.fechaFija || '', mf = /\b([A-Za-z]{3})\b/.exec(f), af = /\b(20\d\d)\b/.exec(f), hoy = new Date();
  let mes = mf && ks.includes(mf[1].toUpperCase()) ? ks.indexOf(mf[1].toUpperCase()) : hoy.getMonth();
  if ((af ? +af[1] : hoy.getFullYear()) > 2026) mes = 11;
  const ha = (z ? ['z' + z] : ['z1', 'z2']).reduce((s, k) => s + (P[k] || []).slice(0, mes + 1).reduce((a, v) => a + (+v || 0), 0), 0);
  return {ha:+ha.toFixed(2), mes, nom:MESES_LARGOS[ks[mes]].toLowerCase()};
}
// "7 Sep 2026" → "7 Septiembre 2026" (otros formatos se dejan igual)
function fechaLarga(f){
  return String(f).replace(/\b([A-Za-zÁÉÍÓÚáéíóú]{3})\b/, m => MESES_LARGOS[m.toUpperCase()] || m);
}
