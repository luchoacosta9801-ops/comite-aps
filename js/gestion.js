// Ventana "Gestionar datos": todas las ediciones se guardan al instante.
const overlay=q('modal-overlay'),modalBody=q('modal-body'),modalFooter=q('modal-footer');

function openModal(view){overlay.style.display='flex';document.body.style.overflow='hidden';showView(view);}
function closeModal(){overlay.style.display='none';document.body.style.overflow='';}
overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal();});
q('modal-close').addEventListener('click',closeModal);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.style.display==='flex')closeModal();});
q('btn-gestionar').addEventListener('click',()=>openModal('home'));
q('btn-refresh').addEventListener('click',()=>{
  const btn=q('btn-refresh');
  btn.classList.add('spinning');btn.innerHTML='<span class="r-icon">🔄</span> Refrescando...';btn.disabled=true;
  setTimeout(()=>{
    loadDB();renderAll();
    btn.classList.remove('spinning');btn.innerHTML='🔄 Refrescar';btn.disabled=false;
    toast('✓ Dashboard actualizado');
  },400);
});

function setHeader(icon,title,sub){q('modal-icon').textContent=icon;q('modal-title').textContent=title;q('modal-sub').textContent=sub;}
function opts(list,sel){return list.map(v=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(v)}</option>`).join('');}
const volver=`<button class="mbtn mbtn-ghost" onclick="showView('home')">← Volver</button>`;

function showView(v){
  ({home:renderHome,add:renderAddLote,edit:renderEditLotes,ruta:renderEditRuta,proceso:renderEditProceso,
    params:renderParams,import:renderImport,backup:renderBackup})[v]();
}

// Aplica un cambio, guarda y redibuja
function cambio(fn,{rehacer}={}){fn();save();renderAll();if(rehacer)rehacer();}

// ── Menú ──
function renderHome(){
  setHeader('✏️','Gestionar datos','Los cambios se guardan automáticamente en este navegador');
  const card=(v,i,t,d)=>`<div class="menu-card" onclick="showView('${v}')"><div class="menu-icon">${i}</div><div class="menu-title">${t}</div><div class="menu-desc">${d}</div></div>`;
  modalBody.innerHTML=`<div class="menu-grid">
    ${card('import','📥','Importar Excel semanal','Carga el libro del comité (COMITE APS, RUTA DE SIEMBRA, RUTA SEMANA PASADA) y actualiza todo')}
    ${card('add','➕','Agregar suerte','Añade una suerte nueva al comité APS')}
    ${card('edit','📋','Editar suertes',`Modifica o elimina las ${DB.lotes.length} suertes del comité`)}
    ${card('ruta','🗺️','Ruta de siembra','Reordena, agrega o quita suertes de la ruta vigente')}
    ${card('proceso','🚜','Suertes en proceso','Labor, contratista y observación de cada suerte en proceso')}
    ${card('params','⚙️','Presupuesto y costos','Ppto total, ppto mensual por zona y costos de preparación')}
    ${card('backup','💾','Respaldo y exportar','Descarga Excel o respaldo, restaura o vuelve a los datos iniciales')}
  </div>`;
  modalFooter.innerHTML='';
}

// ── Agregar suerte ──
function renderAddLote(){
  setHeader('➕','Agregar suerte nueva','Completa los datos de la nueva suerte');
  modalBody.innerHTML=`
    <div class="mrow" style="grid-template-columns:1fr 1fr">
      <div><label class="mlabel">Hacienda *</label><select id="f-hac" class="mselect" onchange="q('f-zona').value=zonaDe(this.value)">${opts(hacsActuales())}</select></div>
      <div><label class="mlabel">Zona *</label><select id="f-zona" class="mselect"><option value="1">Zona 1</option><option value="2">Zona 2</option></select></div>
    </div>
    <div class="mrow" style="grid-template-columns:1fr 1fr">
      <div><label class="mlabel">Sector-Suerte *</label><input id="f-sue" class="minput" placeholder="ej: 3110-050" autocomplete="off"></div>
      <div><label class="mlabel">Área APS (ha) *</label><input id="f-area" class="minput" type="number" step="0.01" min="0" placeholder="ej: 12.50"></div>
    </div>
    <div class="mrow" style="grid-template-columns:1fr 1fr">
      <div><label class="mlabel">Cultivo *</label><select id="f-cult" class="mselect"><option value="CAÑA">Caña</option><option value="ARROZ">Arroz</option></select></div>
      <div><label class="mlabel">Días de lucro *</label><input id="f-dias" class="minput" type="number" min="0" placeholder="ej: 280"></div>
    </div>
    <div class="mrow" style="grid-template-columns:1fr 1fr">
      <div><label class="mlabel">Estado *</label><select id="f-est" class="mselect"><option value="PENDIENTE">Pendiente</option><option value="SEMBRADA">Sembrada</option></select></div>
      <div><label class="mlabel">Labor actual (si está en proceso)</label><select id="f-labor" class="mselect"><option value="">— Ninguna —</option>${opts(LABORES)}</select></div>
    </div>
    <div class="mrow" style="grid-template-columns:1fr 1fr">
      <div><label class="mlabel">Variedad siembra</label><select id="f-var" class="mselect">${opts(VARIEDADES)}</select></div>
      <div><label class="mlabel">Presupuesto 2026</label><select id="f-ppto" class="mselect"><option value="SI">Sí (en presupuesto)</option><option value="NO">No (fuera de presupuesto)</option></select></div>
    </div>
    <div class="mrow" style="grid-template-columns:1fr 1fr">
      <div><label class="mlabel">Contratista (si está en proceso)</label><input id="f-cont" class="minput" placeholder="ej: RIOCAST"></div>
      <div><label class="mlabel">Observación</label><input id="f-obs" class="minput" placeholder="ej: 1 pase realizado"></div>
    </div>
    <div id="add-error" class="err" hidden></div>`;
  q('f-zona').value=zonaDe(q('f-hac').value);
  modalFooter.innerHTML=`${volver}<button class="mbtn mbtn-primary" onclick="saveLote()">➕ Agregar suerte</button>`;
}

function saveLote(){
  const g=id=>q(id).value.trim();
  const sue=g('f-sue').toUpperCase(),area=parseFloat(g('f-area')),dias=parseInt(g('f-dias'),10);
  const hac=g('f-hac'),zona=parseInt(g('f-zona'),10),est=g('f-est'),labor=g('f-labor');
  const err=q('add-error'),fail=m=>{err.hidden=false;err.textContent=m;};
  if(!sue)return fail('El campo Sector-Suerte es obligatorio.');
  if(isNaN(area)||area<=0)return fail('El área debe ser un número mayor a 0.');
  if(isNaN(dias)||dias<0)return fail('Los días de lucro deben ser un número (0 o más).');
  if(labor&&est!=='PENDIENTE')return fail('Una suerte con labor en proceso debe estar PENDIENTE.');
  if(labor&&DB.proceso.some(r=>r.sue===sue))return fail(`La suerte ${sue} ya está en proceso (cada suerte pertenece a una sola labor).`);
  cambio(()=>{
    DB.lotes.push({s:sue,h:hac,z:zona,a:+area.toFixed(2),c:g('f-cult'),d:dias,e:est,p:g('f-ppto'),v:g('f-var')});
    if(labor)DB.proceso.push({hac,z:zona,sue,area:+area.toFixed(2),dias,cont:g('f-cont')||'—',labor,obs:g('f-obs')||null,variedad:null});
  });
  closeModal();toast(`✓ Suerte ${sue} agregada`);
}

// ── Editar suertes ──
let editFiltro='';
function renderEditLotes(){
  setHeader('📋','Editar suertes',`${DB.lotes.length} suertes · los cambios se guardan al salir de cada campo`);
  const fl=editFiltro.toLowerCase();
  const rows=DB.lotes.map((l,i)=>[l,i]).filter(([l])=>!fl||l.s.toLowerCase().includes(fl)||l.h.toLowerCase().includes(fl)).map(([l,i])=>`
    <tr>
      <td><span style="font-family:var(--mono);font-size:10px;color:var(--cyan)">${esc(l.s)}</span></td>
      <td><select class="mselect" style="font-size:10px;padding:3px 5px" onchange="setLote(${i},'h',this.value)">${opts(hacsActuales(),l.h)}</select></td>
      <td><select class="mselect" style="font-size:10px;padding:3px 5px;width:48px" onchange="setLote(${i},'z',+this.value)">${[1,2].map(z=>`<option ${l.z===z?'selected':''}>${z}</option>`).join('')}</select></td>
      <td><input class="inline-input" type="number" step="0.01" value="${l.a}" style="width:62px" onchange="setLote(${i},'a',parseFloat(this.value))"></td>
      <td><select class="mselect" style="font-size:10px;padding:3px 5px" onchange="setLote(${i},'c',this.value)">${opts(['CAÑA','ARROZ'],l.c)}</select></td>
      <td><select class="mselect" style="font-size:10px;padding:3px 5px" onchange="setLote(${i},'e',this.value)">${opts(['SEMBRADA','PENDIENTE'],l.e)}</select></td>
      <td><input class="inline-input" type="number" value="${l.d}" style="width:50px" onchange="setLote(${i},'d',parseInt(this.value,10))"></td>
      <td><select class="mselect" style="font-size:10px;padding:3px 5px" onchange="setLote(${i},'p',this.value)">${opts(['SI','NO'],l.p)}</select></td>
      <td><input class="inline-input" value="${esc(l.v)}" style="width:86px" onchange="setLote(${i},'v',this.value.trim().toUpperCase())"></td>
      <td><button onclick="deleteLote(${i})" class="mbtn mbtn-danger" style="padding:3px 8px;font-size:10px" title="Eliminar">🗑</button></td>
    </tr>`).join('');
  modalBody.innerHTML=`
    <input class="minput" id="edit-buscar" placeholder="🔍 Filtrar por suerte o hacienda…" value="${esc(editFiltro)}" style="margin-bottom:10px">
    <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--bdr)">
      <table class="etbl"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Z</th><th>Área</th><th>Cultivo</th><th>Estado</th><th>Días</th><th>Ppto</th><th>Variedad</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted)">Sin coincidencias</td></tr>'}</tbody></table>
    </div>`;
  const b=q('edit-buscar');
  b.addEventListener('input',()=>{editFiltro=b.value;renderEditLotes();const nb=q('edit-buscar');nb.focus();nb.setSelectionRange(nb.value.length,nb.value.length);});
  modalFooter.innerHTML=`${volver}<button class="mbtn mbtn-primary" onclick="showView('add')">➕ Agregar suerte</button>`;
}
function setLote(i,k,v){
  if((k==='a'&&!(v>0))||(k==='d'&&!(v>=0))){toast('⚠ Valor no válido');renderEditLotes();return;}
  cambio(()=>{DB.lotes[i][k]=v;});
}
function deleteLote(i){
  const l=DB.lotes[i];
  if(!confirm(`¿Eliminar la suerte ${l.s} (${l.h}, ${l.c}, ${l.e})?`))return;
  cambio(()=>DB.lotes.splice(i,1),{rehacer:renderEditLotes});
  toast(`🗑 Suerte ${l.s} eliminada`);
}

// ── Ruta de siembra ──
function renderEditRuta(){
  setHeader('🗺️','Ruta de siembra','Usa las flechas para reordenar · edita o quita suertes');
  const btn=(i,to,lbl,off)=>`<button onclick="moveRuta(${i},${to})" ${off?'disabled':''} style="border:1px solid var(--bdr);background:#fff;border-radius:5px;width:26px;height:22px;cursor:${off?'default':'pointer'};color:${off?'var(--bdr2)':'var(--text)'};font-size:11px">${lbl}</button>`;
  const campo=(i,k,lbl,ph,type='text')=>`<div><label class="mlabel">${lbl}</label><input class="minput" type="${type}" value="${esc(DB.ruta[i][k]??'')}" placeholder="${ph}" style="font-size:11px" onchange="setRuta(${i},'${k}',this.value)"></div>`;
  const items=DB.ruta.map((r,i)=>`
    <div style="border:1px solid var(--bdr);border-radius:10px;background:var(--card2);margin-bottom:10px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--bdr);background:#fff">
        <div style="display:flex;flex-direction:column;gap:2px">${btn(i,i-1,'▲',i===0)}${btn(i,i+1,'▼',i===DB.ruta.length-1)}</div>
        <div class="rnum" style="margin:0">${i+1}</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:700">${esc(r.h)} <span style="font-family:var(--mono);font-size:10px;color:var(--cyan)">${esc(r.s)}</span></div>
          <div style="font-size:9.5px;color:var(--muted)">${f2(r.a)} ha · ${r.d} días lucro</div></div>
        <button onclick="deleteRutaItem(${i})" class="mbtn mbtn-danger" style="padding:4px 10px;font-size:10px">🗑 Quitar</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px">
        ${campo(i,'variedad','🌱 Variedad','ej: CC 01-1940')}${campo(i,'semillero','📍 Semillero','ej: 3113-160')}
        ${campo(i,'bandereo','🚩 Bandereo (surcos)','ej: 12','number')}${campo(i,'cont','👤 Contratista','ej: ANDRUSV')}
      </div>
    </div>`).join('');
  const enRuta=new Set(DB.ruta.map(r=>r.s));
  const disp=DB.lotes.filter(l=>l.e==='PENDIENTE'&&!enRuta.has(l.s));
  modalBody.innerHTML=`<div>${items||'<div class="nores">No hay suertes en la ruta</div>'}</div>`+
    (disp.length?`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--bdr)"><div class="mlabel">Agregar suerte pendiente a la ruta</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap"><select id="sel-add-ruta" class="mselect" style="flex:1;min-width:200px">${disp.map(l=>`<option value="${esc(l.s)}">${esc(l.s)} · ${esc(l.h)} · ${f2(l.a)} ha · ${l.d}d lucro</option>`).join('')}</select>
      <button class="mbtn mbtn-primary" onclick="addToRuta()">+ Agregar</button></div></div>`
    :'<div style="margin-top:12px;font-size:10px;color:var(--muted)">Todas las suertes pendientes ya están en la ruta.</div>');
  modalFooter.innerHTML=`${volver}<button class="mbtn mbtn-primary" onclick="closeModal()">✓ Listo</button>`;
}
function setRuta(i,k,v){cambio(()=>{DB.ruta[i][k]=k==='bandereo'?(parseInt(v,10)||null):(v.trim()||null);});}
function moveRuta(from,to){if(to<0||to>=DB.ruta.length)return;cambio(()=>DB.ruta.splice(to,0,DB.ruta.splice(from,1)[0]),{rehacer:renderEditRuta});}
function deleteRutaItem(i){const s=DB.ruta[i].s;if(!confirm(`¿Quitar ${s} de la ruta?`))return;cambio(()=>DB.ruta.splice(i,1),{rehacer:renderEditRuta});toast(`${s} quitada de la ruta`);}
function addToRuta(){
  const s=q('sel-add-ruta').value,l=DB.lotes.find(x=>x.s===s&&x.e==='PENDIENTE');if(!l)return;
  cambio(()=>DB.ruta.push({h:l.h,s:l.s,a:l.a,d:l.d,variedad:null,semillero:null,bandereo:null,cont:null}),{rehacer:renderEditRuta});
  toast(`${s} agregada a la ruta`);
}

// ── Suertes en proceso ──
function renderEditProceso(){
  setHeader('🚜','Suertes en proceso','Cada suerte pertenece a una sola labor');
  const rows=DB.proceso.map((r,i)=>`
    <tr>
      <td><span style="font-family:var(--mono);font-size:10px;color:var(--cyan)">${esc(r.sue)}</span></td>
      <td style="font-size:10px;color:var(--dim)">${esc(r.hac)}</td>
      <td><select class="mselect" style="font-size:10px;padding:3px 5px" onchange="setProc(${i},'labor',this.value)">${opts([...new Set([...LABORES,r.labor])],r.labor)}</select></td>
      <td><input class="inline-input" value="${esc(r.cont)}" style="width:80px" onchange="setProc(${i},'cont',this.value)"></td>
      <td><input class="inline-input" value="${esc(r.obs||'')}" style="width:140px" placeholder="Observación…" onchange="setProc(${i},'obs',this.value)"></td>
      <td><input class="inline-input" value="${esc(r.variedad||'')}" style="width:90px" placeholder="—" onchange="setProc(${i},'variedad',this.value)"></td>
      <td><button onclick="deleteProceso(${i})" class="mbtn mbtn-danger" style="padding:3px 8px;font-size:10px">🗑</button></td>
    </tr>`).join('');
  const enProc=new Set(DB.proceso.map(r=>r.sue));
  const disp=DB.lotes.filter(l=>l.e==='PENDIENTE'&&!enProc.has(l.s));
  modalBody.innerHTML=`
    <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--bdr)">
      <table class="etbl"><thead><tr><th>Suerte</th><th>Hacienda</th><th>Labor</th><th>Contratista</th><th>Observación</th><th>Variedad</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--muted)">Sin suertes en proceso</td></tr>'}</tbody></table>
    </div>`+
    (disp.length?`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--bdr)"><div class="mlabel">Poner en proceso una suerte pendiente</div>
      <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
        <select id="sel-add-proc" class="mselect" style="flex:1;min-width:200px">${disp.map(l=>`<option value="${esc(l.s)}">${esc(l.s)} · ${esc(l.h)} · ${f2(l.a)} ha</option>`).join('')}</select>
        <select id="sel-add-lab" class="mselect" style="width:140px">${opts(LABORES)}</select>
        <button class="mbtn mbtn-primary" onclick="addProceso()">+ Agregar</button></div></div>`:'');
  modalFooter.innerHTML=`${volver}<button class="mbtn mbtn-primary" onclick="closeModal()">✓ Listo</button>`;
}
function setProc(i,k,v){cambio(()=>{DB.proceso[i][k]=k==='cont'?(v.trim()||'—'):(v.trim()||null);});}
function deleteProceso(i){const s=DB.proceso[i].sue;if(!confirm(`¿Quitar ${s} de las suertes en proceso?`))return;cambio(()=>DB.proceso.splice(i,1),{rehacer:renderEditProceso});toast(`${s} quitada de proceso`);}
function addProceso(){
  const s=q('sel-add-proc').value,l=DB.lotes.find(x=>x.s===s&&x.e==='PENDIENTE');if(!l)return;
  cambio(()=>DB.proceso.push({hac:l.h,z:l.z,sue:l.s,area:l.a,dias:l.d,cont:'—',labor:q('sel-add-lab').value,obs:null,variedad:null}),{rehacer:renderEditProceso});
  toast(`${s} en proceso`);
}

// ── Presupuesto y costos ──
function renderParams(){
  setHeader('⚙️','Presupuesto y costos','Valores de las hojas RESUMEN, PPTO 2026 y PANEL CONTROL');
  const mes=(z)=>DB.pptoMensual[z].map((v,i)=>`<div><label class="mlabel" style="font-size:8px">${MESES[i]}</label><input class="minput" type="number" step="0.01" value="${v}" style="padding:5px 6px;font-size:10.5px" onchange="setPptoMes('${z}',${i},this.value)"></div>`).join('');
  const costo=(c,i)=>`<div class="mrow" style="grid-template-columns:1.2fr 1fr 1fr 1.2fr;margin-bottom:8px">
      <input class="minput" value="${esc(c.concepto)}" onchange="setCosto(${i},'concepto',this.value)">
      <input class="minput" type="number" value="${c.real??''}" placeholder="$/ha real" onchange="setCosto(${i},'real',this.value)">
      <input class="minput" type="number" value="${c.ppto??''}" placeholder="$/ha ppto" onchange="setCosto(${i},'ppto',this.value)">
      <input class="minput" type="number" value="${c.total??''}" placeholder="Total $" onchange="setCosto(${i},'total',this.value)">
    </div>`;
  modalBody.innerHTML=`
    <div class="mrow" style="grid-template-columns:1fr 1fr 1fr">
      <div><label class="mlabel">Ppto total 2026 (ha)</label><input class="minput" type="number" step="0.01" value="${DB.meta.pptoTotal}" onchange="setMeta('pptoTotal',parseFloat(this.value))"></div>
      <div><label class="mlabel">Fecha de corte</label><input class="minput" value="${esc(DB.meta.fecha)}" onchange="setMeta('fecha',this.value.trim())"></div>
      <div><label class="mlabel">Semana</label><input class="minput" value="${esc(DB.meta.semana)}" onchange="setMeta('semana',this.value.trim())"></div>
    </div>
    <div class="mlabel" style="margin-top:6px;color:var(--green)">Ppto mensual · Zona 1 (ha)</div>
    <div class="mrow" style="grid-template-columns:repeat(6,1fr);gap:6px">${mes('z1')}</div>
    <div class="mlabel" style="color:var(--amber)">Ppto mensual · Zona 2 (ha)</div>
    <div class="mrow" style="grid-template-columns:repeat(6,1fr);gap:6px">${mes('z2')}</div>
    <div class="mlabel" style="margin-top:6px">Costos de preparación · concepto / $/ha real / $/ha ppto / total $</div>
    ${DB.costos.map(costo).join('')}`;
  modalFooter.innerHTML=`${volver}<button class="mbtn mbtn-primary" onclick="closeModal()">✓ Listo</button>`;
}
function setMeta(k,v){if(k==='pptoTotal'&&!(v>0)){toast('⚠ El presupuesto debe ser mayor a 0');return;}if(!v&&v!==0)return;cambio(()=>{DB.meta[k]=v;});}
function setPptoMes(z,i,v){cambio(()=>{DB.pptoMensual[z][i]=parseFloat(v)||0;});}
function setCosto(i,k,v){cambio(()=>{DB.costos[i][k]=k==='concepto'?v.trim():(v===''?null:parseFloat(v));});}

// ── Importar Excel ──
function renderImport(){
  setHeader('📥','Importar Excel semanal','Hojas: COMITE APS (encabezado fila 5), RUTA DE SIEMBRA, RUTA SEMANA PASADA');
  modalBody.innerHTML=`
    <label class="drop" id="drop"><b>Arrastra aquí el Excel del comité</b>o haz clic para elegir el archivo (.xlsx, .xlsm, .xls)
      <input type="file" id="file-xlsx" accept=".xlsx,.xlsm,.xls" hidden></label>
    <div id="imp-res"></div>
    <div class="note">💡 Nada se cambia hasta que confirmes. Antes de importar se recomienda descargar un respaldo (💾).</div>`;
  modalFooter.innerHTML=volver;
  const drop=q('drop'),inp=q('file-xlsx');
  inp.addEventListener('change',()=>inp.files[0]&&procesarExcel(inp.files[0]));
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)procesarExcel(f);});
}

function procesarExcel(file){
  const res=q('imp-res');
  res.innerHTML='<div class="note">Leyendo '+esc(file.name)+'…</div>';
  leerLibro(file).then(imp=>{
    IMPORT_PENDIENTE=imp;
    const titulos={lotes:'COMITE APS → Detalle de lotes',ruta:'RUTA DE SIEMBRA → Ruta vigente',proceso:'RUTA SEMANA PASADA → Suertes en proceso'};
    const bloque=t=>{
      const r=imp[t],ok=r.hoja&&!r.faltan.length&&r.filas.length;
      let det;
      if(!r.hoja)det=`<div style="font-size:10.5px;color:var(--red)">No se encontró la hoja. Hojas del libro: ${esc(imp.hojas.join(', '))}</div>`;
      else if(r.faltan.length)det=`<div style="font-size:10.5px;color:var(--red)">Hoja "${esc(r.hoja)}": faltan columnas ${r.faltan.map(c=>NOMBRE_CAMPO[c]).join(', ')}.</div>`;
      else{
        const extra=t==='lotes'?(()=>{const s=r.filas.filter(l=>l.e==='SEMBRADA');return ` · ${f2(sum(s,l=>l.a))} ha sembradas · ${r.filas.length-s.length} pendientes`;})():` · ${f2(sum(r.filas,x=>x.a??x.area))} ha`;
        det=`<div style="font-size:10.5px;color:var(--dim)">Hoja "${esc(r.hoja)}" · encabezado en fila ${r.fila} · <b>${r.filas.length} registros</b>${extra}</div>
          <div class="imp-cols">${Object.keys(COLS[t]).filter(c=>!AUXILIARES.has(c)).map(c=>{
            const ok=c in r.columnas||(c==='e'&&r.estadoDerivado);
            const lbl=c==='e'&&r.estadoDerivado?'Estado (por Área Siemb)':NOMBRE_CAMPO[c];
            return`<span class="chip ${ok?'cg':'cr'}">${lbl}${ok?' ✓':' ✗'}</span>`;}).join('')}</div>`;
      }
      return`<div class="imp-sheet ${ok?'ok':'bad'}"><div class="imp-title"><span>${titulos[t]}</span>
        <label style="font-size:10.5px;font-weight:600;display:flex;gap:5px;align-items:center"><input type="checkbox" id="chk-${t}" ${ok?'checked':'disabled'}> Reemplazar</label></div>${det}</div>`;
    };
    const rs=imp.resumen||{},cs=imp.costos;
    const extra=(rs.pptoTotal||cs)?`<div class="imp-sheet ok"><div class="imp-title"><span>RESUMEN y PANEL CONTROL → Ppto y costos</span>
        <label style="font-size:10.5px;font-weight:600;display:flex;gap:5px;align-items:center"><input type="checkbox" id="chk-costos" checked> Reemplazar</label></div>
        <div style="font-size:10.5px;color:var(--dim)">${rs.pptoTotal?`Ppto total: <b>${f2(rs.pptoTotal)} ha</b>`:''}${rs.pptoTotal&&cs?' · ':''}${cs?`Costos: ${cs.map(c=>esc(c.concepto)+' '+money(c.real)+'/ha').join(' · ')}`:''}</div></div>`:'';
    res.innerHTML=`<div style="margin-top:14px">${bloque('lotes')}${bloque('ruta')}${bloque('proceso')}${extra}</div>
      <div class="mrow" style="grid-template-columns:1fr 1fr;margin-top:10px">
        <div><label class="mlabel">Nueva fecha de corte</label><input class="minput" id="imp-fecha" value="${esc(rs.fecha||DB.meta.fecha)}"></div>
        <div><label class="mlabel">Nueva semana</label><input class="minput" id="imp-sem" value="${esc(rs.semana||DB.meta.semana)}"></div>
      </div>`;
    const alguno=['lotes','ruta','proceso'].some(t=>imp[t].filas.length&&!imp[t].faltan.length);
    modalFooter.innerHTML=`${volver}<button class="mbtn mbtn-ghost" onclick="exportarRespaldo()">💾 Respaldo antes</button>`+
      (alguno?`<button class="mbtn mbtn-primary" onclick="confirmarImport()">✓ Aplicar importación</button>`:'');
  }).catch(e=>{res.innerHTML=`<div class="err">No se pudo leer el archivo: ${esc(e.message)}</div>`;});
}
function confirmarImport(){
  const o={};['lotes','ruta','proceso','costos'].forEach(t=>o[t]=q('chk-'+t)?.checked);
  o.fecha=q('imp-fecha').value.trim();o.semana=q('imp-sem').value.trim();
  aplicarImport(o);renderAll();closeModal();toast('✓ Datos importados');
}

// ── Respaldo ──
function renderBackup(){
  const t=DB.meta.actualizado?new Date(DB.meta.actualizado).toLocaleString('es-CO'):'nunca (datos iniciales)';
  setHeader('💾','Respaldo y exportar',`Último guardado: ${t}`);
  const card=(i,tt,d,act)=>`<div class="menu-card" onclick="${act}"><div class="menu-icon">${i}</div><div class="menu-title">${tt}</div><div class="menu-desc">${d}</div></div>`;
  modalBody.innerHTML=`<div class="menu-grid">
    ${card('📊','Descargar Excel','Libro con las hojas COMITE APS, RUTA DE SIEMBRA y RUTA SEMANA PASADA','exportarExcel()')}
    ${card('💾','Descargar respaldo','Archivo .json con todos los datos, para guardar o pasar a otro computador','exportarRespaldo()')}
    ${card('📂','Restaurar respaldo','Carga un archivo .json descargado antes','q(\'file-json\').click()')}
    ${card('🖨️','Imprimir / PDF','Versión para imprimir o guardar como PDF','closeModal();setTimeout(()=>window.print(),200)')}
  </div>
  <input type="file" id="file-json" accept=".json,application/json" hidden>
  <div style="margin-top:18px;padding-top:14px;border-top:1px solid var(--bdr);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
    <div style="font-size:10.5px;color:var(--muted)">Volver a los datos publicados (${esc(SEED.meta.fecha)} · ${esc(SEED.meta.semana)}). Se pierden los cambios hechos aquí.</div>
    <button class="mbtn mbtn-danger" onclick="restablecer()">↺ Restablecer datos</button>
  </div>`;
  q('file-json').addEventListener('change',e=>{
    const f=e.target.files[0];if(!f)return;
    importarRespaldo(f).then(()=>{renderAll();closeModal();toast('✓ Respaldo restaurado');}).catch(err=>toast('⚠ '+err.message));
  });
  modalFooter.innerHTML=volver;
}
function restablecer(){
  if(!confirm('¿Borrar todos los cambios y volver a los datos iniciales? Descarga un respaldo antes si lo necesitas.'))return;
  resetDB();renderAll();closeModal();toast('Datos restablecidos');
}
