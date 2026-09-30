// Estado de la app guardado en localStorage. Todo cambio pasa por save().
const STORE_KEY = 'comite-aps:v1';
let DB;

function clone(o){ return JSON.parse(JSON.stringify(o)); }

function loadDB(){
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.lotes)) { DB = Object.assign(clone(SEED), d); return; }
    }
  } catch (e) { console.warn('No se pudo leer el guardado local', e); }
  DB = clone(SEED);
}

function save(){
  DB.meta.actualizado = new Date().toISOString();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
  catch (e) { toast('⚠ No se pudo guardar en este navegador'); }
  updateSaveDot();
}

function resetDB(){
  DB = clone(SEED);
  save();
}

function hacsActuales(){
  const set = new Set(HACS_BASE);
  DB.lotes.forEach(l => set.add(l.h));
  DB.proceso.forEach(r => set.add(r.hac));
  return [...set];
}

// ── Respaldo JSON ──
function descargar(nombre, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugSemana(){ return (DB.meta.semana || 'semana').replace(/\s+/g,'-').toLowerCase(); }

function exportarRespaldo(){
  descargar(`comite-aps-${slugSemana()}.json`,
    new Blob([JSON.stringify(DB, null, 2)], {type:'application/json'}));
  toast('✓ Respaldo descargado');
}

function importarRespaldo(file){
  return file.text().then(txt => {
    const d = JSON.parse(txt);
    if (!d || !Array.isArray(d.lotes) || !Array.isArray(d.ruta) || !Array.isArray(d.proceso))
      throw new Error('El archivo no es un respaldo válido del Comité APS.');
    DB = Object.assign(clone(SEED), d);
    save();
  });
}

// ── Excel (SheetJS se carga solo cuando se necesita) ──
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxPromise;
function cargarXLSX(){
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise = xlsxPromise || new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = XLSX_URL;
    s.onload = () => res(window.XLSX);
    s.onerror = () => { xlsxPromise = null; rej(new Error('No se pudo cargar el lector de Excel (¿sin internet?).')); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

function exportarExcel(){
  cargarXLSX().then(XLSX => {
    const wb = XLSX.utils.book_new();
    const lotes = DB.lotes.map(l => ({
      'SUERTE':l.s,'HACIENDA':l.h,'ZONA':l.z,'AREA APS':l.a,'CULTIVO':l.c,
      'DIAS LUCRO':l.d,'ESTADO':l.e,'PPTO 2026':l.p,'VARIEDAD':l.v
    }));
    const ruta = DB.ruta.map((r,i) => ({
      'ORDEN':i+1,'HACIENDA':r.h,'SUERTE':r.s,'AREA':r.a,'DIAS LUCRO':r.d,
      'VARIEDAD':r.variedad||'','SEMILLERO':r.semillero||'','BANDEREO':r.bandereo||'','CONTRATISTA':r.cont||''
    }));
    const proc = DB.proceso.map(r => ({
      'HACIENDA':r.hac,'ZONA':r.z,'SUERTE':r.sue,'AREA':r.area,'DIAS LUCRO':r.dias,
      'CONTRATISTA':r.cont||'','LABOR':r.labor,'OBSERVACION':r.obs||'','VARIEDAD':r.variedad||''
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lotes), 'COMITE APS');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ruta), 'RUTA DE SIEMBRA');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(proc), 'RUTA SEMANA PASADA');
    XLSX.writeFile(wb, `comite-aps-${slugSemana()}.xlsx`);
    toast('✓ Excel descargado');
  }).catch(e => toast('⚠ ' + e.message));
}
