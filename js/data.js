// Catálogos y utilidades fijas (los datos publicados están en js/datos.js).
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
