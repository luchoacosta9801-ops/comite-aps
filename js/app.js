// Render del dashboard, filtros, buscador y encabezado.
const F = {zona:'all',hac:'all',cult:'all',est:'all',ppto:'all',dias:'all'};

function sum(arr,fn){return arr.reduce((s,x)=>s+(fn?fn(x):x),0)}
function q(id){return document.getElementById(id)}
function esc(t){return String(t ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function f2(n){return (+n||0).toFixed(2)}
function money(n){return '$'+Math.round(n||0).toLocaleString('en-US')}

let tt;
function toast(msg){const t=q('toast');t.textContent=msg;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),2200);}
function updateSaveDot(){
  const d=q('save-dot'); if(!d) return;
  const t=DB.meta.actualizado?new Date(DB.meta.actualizado):null;
  d.textContent=t?`Guardado ${t.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}`:'Datos iniciales';
}

function filtered(){
  return DB.lotes.filter(l=>{
    if(F.zona!=='all'&&l.z!=F.zona)return false;
    if(F.hac!=='all'&&l.h!==F.hac)return false;
    if(F.cult!=='all'&&l.c!==F.cult)return false;
    if(F.est!=='all'&&l.e!==F.est)return false;
    if(F.ppto!=='all'&&l.p!==F.ppto)return false;
    if(F.dias==='critico'&&l.d>=100)return false;
    if(F.dias==='alerta'&&(l.d<100||l.d>=200))return false;
    if(F.dias==='normal'&&l.d<200)return false;
    return true;
  });
}
function avC(v){return v>=.85?'var(--green)':v>=.6?'var(--amber)':'var(--red)'}
function cCls(v){return v>=.85?'cg':v>=.6?'ca':'cr'}
function avChip(v){return`<span class="chip ${cCls(v)}">${(v*100).toFixed(0)}%</span>`}
function dc(d){return d<100?'var(--red)':d<200?'var(--amber)':'var(--dim)'}
// Filtros de zona/hacienda aplicados a registros de ruta/proceso
function fueraDeFiltro(hac,z){return (F.zona!=='all'&&z!=F.zona)||(F.hac!=='all'&&hac!==F.hac)}

function renderMeta(){
  const {fecha,semana}=DB.meta;
  q('chip-fecha').textContent=fecha;
  q('chip-sem').textContent=semana;
  q('slbl').textContent=`Indicadores generales · ${fechaLarga(fecha)} · ${semana}`;
  document.querySelectorAll('.sem-tag').forEach(t=>t.textContent=semana.replace(/semana/i,'SEM.'));
  q('footer').textContent=`Comité APS · Riopaila Agrícola · Datos al ${fecha} · ${semana} · Fuentes: PANEL CONTROL · COMITE APS · RESUMEN · PPTO 2026`;
  updateSaveDot();
}

function renderHacSelect(){
  const sel=q('sel-hac'),cur=F.hac;
  sel.innerHTML='<option value="all">Todas las haciendas</option>'+
    hacsActuales().map(h=>`<option value="${esc(h)}">${esc(HAC_LABEL[h]||h)}</option>`).join('');
  sel.value=hacsActuales().includes(cur)?cur:'all';
  F.hac=sel.value;
  sel.className='fsel'+(sel.value!=='all'?' on':'');
}

function render(){
  const data=filtered(),PPTO_TOTAL=DB.meta.pptoTotal;
  const sembL=data.filter(l=>l.e==='SEMBRADA'),pendL=data.filter(l=>l.e!=='SEMBRADA');
  const tot=sum(data,l=>l.a),semb=sum(sembL,l=>l.a);
  const pend=tot-semb,av=tot>0?semb/tot:0,aC=avC(av);
  const dias=data.length?Math.round(sum(data,l=>l.d)/data.length):0;
  const psiL=data.filter(l=>l.p==='SI'),pnoL=data.filter(l=>l.p==='NO');
  const psi=sum(psiL,l=>l.a),pno=sum(pnoL,l=>l.a);

  // KPIs
  const avPpto=PPTO_TOTAL>0?semb/PPTO_TOTAL:0,avPptoC=avC(avPpto);
  q('k-lotes').textContent=data.length;q('k-area').textContent=f2(tot);
  q('k-semb').textContent=f2(semb);q('k-pend').textContent=f2(pend);
  q('k-pend-s').textContent=`${pendL.length} lotes por sembrar`;
  q('k-av').textContent=(avPpto*100).toFixed(1)+'%';q('k-av').style.color=avPptoC;
  q('k-av-s').textContent=`${f2(semb)} / ${f2(PPTO_TOTAL)} ha ppto`;
  q('k-dias').textContent=dias;
  // Caña/Arroz: solo área sembrada
  const canaS=sum(sembL.filter(l=>l.c==='CAÑA'),l=>l.a),arrozS=sum(sembL.filter(l=>l.c==='ARROZ'),l=>l.a);
  q('k-cult').innerHTML=`${canaS.toFixed(0)} <span style="color:var(--cyan)">/${arrozS.toFixed(0)}</span>`;
  q('k-ppto').innerHTML=`${psi.toFixed(0)} <span style="color:var(--red)">/${pno.toFixed(0)}</span>`;
  q('k-semb-s').textContent=tot>0?`${(av*100).toFixed(1)}% del área APS`:'—';
  q('k-semb-b').style.width=(av*100)+'%';q('k-semb-b').style.background=aC;
  q('k-av-b').style.width=Math.min(avPpto*100,100)+'%';q('k-av-b').style.background=avPptoC;
  q('results-pill').textContent=`${data.length} lotes · ${f2(tot)} ha`;

  // Zonas
  function zs(arr){
    const a=sum(arr,l=>l.a),c=sum(arr.filter(l=>l.c==='CAÑA'),l=>l.a),r=sum(arr.filter(l=>l.c==='ARROZ'),l=>l.a);
    const s=sum(arr.filter(l=>l.e==='SEMBRADA'),l=>l.a),p=a-s,v=a>0?s/a:0;return{a,c,r,s,p,v,n:arr.length};
  }
  const z1s=zs(data.filter(l=>l.z===1)),z2s=zs(data.filter(l=>l.z===2)),zts=zs(data);
  const zRow=(lbl,s,cls='')=>`<tr class="${cls}"><td>${lbl}</td><td>${f2(s.c)}</td><td>${f2(s.r)}</td><td>${f2(s.s)}</td><td>${f2(s.p)}</td><td>${f2(s.a)}</td><td>${avChip(s.v)}</td></tr>`;
  q('zona-tbody').innerHTML=zRow('<span class="chip cg">Zona 1</span>',z1s)+zRow('<span class="chip ca">Zona 2</span>',z2s)+zRow('TOTAL',zts,'tot');

  // Donut: solo sembradas
  const circ=2*Math.PI*44,cp=semb>0?canaS/semb:0;
  q('d-cana').setAttribute('stroke-dasharray',`${cp*circ} ${(1-cp)*circ}`);
  q('d-arroz').setAttribute('stroke-dasharray',`${(1-cp)*circ} ${cp*circ}`);q('d-arroz').setAttribute('stroke-dashoffset',String(69-cp*circ));
  q('d-pct').textContent=semb>0?(cp*100).toFixed(1)+'%':'—';
  q('leg-c').textContent=`${f2(canaS)} ha · ${sembL.filter(l=>l.c==='CAÑA').length} lotes sembrados`;
  q('leg-a').textContent=`${f2(arrozS)} ha · ${sembL.filter(l=>l.c==='ARROZ').length} lotes sembrados`;

  const zCard=(lbl,s,acl,mb)=>{const bC=avC(s.v);return`<div class="zcard ${s.a===0?'dim':''}" style="border-color:${acl};${mb?'margin-bottom:11px':''}">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div class="znum" style="color:${bC}">${(s.v*100).toFixed(1)}%</div><span class="chip ${cCls(s.v)}">${lbl}</span>
      </div>
      <div class="zha">${f2(s.a)} ha · ${s.n} lotes · pend. ${f2(s.p)} ha</div>
      <div class="bt"><div class="bf" style="width:${s.v*100}%;background:${bC}"></div></div>
    </div>`;};
  q('zona-cards').innerHTML=zCard('Zona 1',z1s,'rgba(0,135,90,.3)',true)+zCard('Zona 2',z2s,'rgba(180,83,9,.3)',false);

  // Haciendas
  const aH=new Set(data.map(l=>l.h));let hHTML='';
  hacsActuales().forEach(hn=>{
    const hd=data.filter(l=>l.h===hn);
    if(!hd.length&&F.hac==='all')return;
    const ha=sum(hd,l=>l.a),hs=sum(hd.filter(l=>l.e==='SEMBRADA'),l=>l.a),hav=ha>0?hs/ha:0;
    const dim=F.hac!=='all'&&!aH.has(hn)?'dim':'';
    hHTML+=`<div class="hac ${dim}"><div class="hn">${esc(hn)}</div><div class="hb"><div class="bt"><div class="bf" style="width:${hav*100}%;background:${avC(hav)}"></div></div></div><div class="hr"><div class="hha">${f2(ha)} ha</div><div class="hp">${avChip(hav)}</div></div></div>`;
  });
  hHTML+=`<div class="hac" style="border-top:2px solid rgba(0,119,170,.2);margin-top:3px"><div class="hn" style="color:var(--cyan);font-weight:800">TOTAL</div><div class="hb"><div class="bt"><div class="bf" style="width:${av*100}%;background:${aC}"></div></div></div><div class="hr"><div class="hha" style="color:var(--cyan)">${f2(tot)} ha</div><div class="hp">${avChip(av)}</div></div></div>`;
  q('hac-list').innerHTML=hHTML;

  // Tabla lotes
  q('nores').hidden=data.length>0;
  q('lotes-tbody').innerHTML=data.map(l=>{
    const zC=l.z===1?'var(--green)':'var(--amber)',cC=l.c==='CAÑA'?'var(--green)':'var(--cyan)';
    return`<tr data-sue="${esc(l.s)}"><td style="font-family:var(--mono);font-size:10px;color:var(--cyan)">${esc(l.s)}</td><td style="text-align:left;color:var(--dim)">${esc(l.h)}</td><td style="color:${zC};font-weight:700">${l.z}</td><td>${f2(l.a)}</td><td style="color:${cC}">${l.c}</td><td style="color:${dc(l.d)};font-weight:600;font-family:var(--mono)">${l.d}</td><td><span class="chip ${l.e==='SEMBRADA'?'cg':'ca'}" style="font-size:8.5px">${l.e}</span></td><td><span class="chip ${l.p==='SI'?'cg':'cr'}" style="font-size:8.5px">${l.p}</span></td></tr>`;
  }).join('');
  q('lotes-tag').textContent=`${data.length} lotes`;

  renderRuta();
  renderLabores();
  renderVariedades(data,tot);

  q('psi-ha').textContent=f2(psi);q('pno-ha').textContent=f2(pno);
  q('psi-l').textContent=`ha · ${psiL.length} lotes`;q('pno-l').textContent=`ha · ${pnoL.length} lotes`;
  q('dias-avg').textContent=dias+' días';
  const crit=data.filter(l=>l.d<100).length,alt=data.filter(l=>l.d>=100&&l.d<200).length,norm=data.filter(l=>l.d>=200).length,td2=data.length||1;
  q('dias-dist').innerHTML=[['Crítico <100',crit,'var(--red)'],['Alerta 100–200',alt,'var(--amber)'],['Normal >200',norm,'var(--green)']].map(([l,n,c])=>`<div style="display:flex;align-items:center;gap:9px"><div style="width:92px;font-size:9.5px;color:${c}">${l}</div><div style="flex:1"><div class="bt"><div class="bf" style="width:${(n/td2*100)}%;background:${c}"></div></div></div><div style="font-size:9.5px;font-family:var(--mono);color:${c};width:46px;text-align:right">${n} L</div></div>`).join('');

  if(q('acc-body').classList.contains('open'))buildLaborPanels();
}

function renderRuta(){
  let rHTML='',rTot=0;
  DB.ruta.forEach((r,i)=>{
    const dim=fueraDeFiltro(r.h,zonaDe(r.h))?'dim':'';
    if(!dim)rTot+=r.a;
    const dC=r.d<100?'var(--red)':r.d<200?'var(--amber)':'var(--green)';
    const tag=(v,st)=>v?`<span style="font-size:8.5px;border-radius:4px;padding:1px 6px;${st}">${v}</span>`:'';
    rHTML+=`<div class="ri ${dim}">
      <div class="rnum">${i+1}</div>
      <div class="rif">
        <div class="rhac">${esc(r.h)} <span style="font-family:var(--mono);font-size:9.5px;color:var(--cyan)">${esc(r.s)}</span></div>
        <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px">
          ${tag(r.variedad&&'🌱 '+esc(r.variedad),'background:rgba(0,135,90,.1);color:var(--green);font-weight:600')}
          ${tag(r.semillero&&'📍 '+esc(r.semillero),'background:rgba(0,119,170,.1);color:var(--cyan)')}
          ${tag(r.bandereo&&'🚩 '+esc(r.bandereo)+' surcos','background:rgba(180,83,9,.1);color:var(--amber)')}
          ${tag(r.cont&&'👤 '+esc(r.cont),'background:var(--card2);color:var(--dim);border:1px solid var(--bdr)')}
        </div>
      </div>
      <div class="rrr"><div class="rha">${f2(r.a)} ha</div><div class="rdias" style="color:${dC}">${r.d} días lucro</div></div>
    </div>`;
  });
  q('ruta-list').innerHTML=rHTML||'<div class="nores">No hay suertes en la ruta</div>';
  q('ruta-tot').textContent=f2(rTot)+' ha';
}

// Suertes en proceso filtradas por zona/hacienda, agrupadas por su única labor
function procesoFiltrado(){return DB.proceso.filter(r=>!fueraDeFiltro(r.hac,r.z))}
function porLabor(arr){
  const m={};arr.forEach(r=>{(m[r.labor]=m[r.labor]||[]).push(r)});return m;
}

function renderLabores(){
  const arr=procesoFiltrado(),tot=sum(arr,r=>r.area);
  const m=porLabor(arr);
  q('lab-n').textContent=`${arr.length} lotes pendientes`;
  q('lab-ha').textContent=f2(tot)+' ha';
  q('acc-tag').textContent=`${arr.length} suertes · ${f2(tot)} ha`;
  const orden=l=>{const i=ORDEN_LAB.indexOf(l);return i<0?99:i;};
  const rows=Object.entries(m).map(([n,it])=>[n,sum(it,r=>r.area),it.length]).sort((a,b)=>orden(a[0])-orden(b[0]));
  q('lab-list').innerHTML=rows.length?rows.map(([n,a,l])=>`<div class="li"><div class="ln">${esc(n)}</div><div class="lb"><div class="bt"><div class="bf" style="width:${tot?a/tot*100:0}%;background:var(--green)"></div></div></div><div class="lv">${f2(a)} ha</div><div class="ll">${l}L</div></div>`).join(''):'<div class="nores">Sin suertes en proceso</div>';
}

function renderVariedades(data,tot){
  const vm={};data.forEach(l=>{vm[l.v]=(vm[l.v]||0)+l.a;});
  const vs=Object.entries(vm).sort((a,b)=>b[1]-a[1]),tv=tot||1;
  q('var-list').innerHTML=vs.length?vs.map(([v,a],i)=>{const p=a/tv,c=VCLRS[i%VCLRS.length];return`<div class="vrow"><div class="vdot" style="background:${c}"></div><div class="vname">${esc(v)}</div><div class="vb"><div class="bt"><div class="bf" style="width:${p*100}%;background:${c}"></div></div></div><div class="vha">${f2(a)}</div><div class="vpct">${(p*100).toFixed(1)}%</div></div>`;}).join(''):'<div class="nores">Sin datos</div>';
}

function renderPPTO(){
  const {z1,z2}=DB.pptoMensual,zt=z1.map((v,i)=>v+(z2[i]||0));
  const tots=[z1,z2,zt].map(a=>sum(a));
  let h='<div class="mh">Zona</div>'+MESES.map(m=>`<div class="mh">${m}</div>`).join('')+'<div class="mh mt">TOTAL</div>';
  [{l:'ZONA 1',d:z1,c:'var(--green)'},{l:'ZONA 2',d:z2,c:'var(--amber)'},{l:'TOTAL',d:zt,c:'var(--cyan)'}].forEach((row,ri)=>{
    h+=`<div class="mc ml" style="color:${row.c}">${row.l}</div>`;
    h+=row.d.map(v=>`<div class="mc ${v>0?'mv':''} ${v>80?'mh2':''}" style="${v>0?'color:'+row.c:''}">${v===0?'—':f2(v)}</div>`).join('');
    h+=`<div class="mc mt">${f2(tots[ri])}</div>`;
  });
  q('mg').innerHTML=h;
  q('mg-foot').innerHTML=`Total 2026: <span style="color:var(--cyan);font-weight:700">${f2(tots[2])} ha</span> · Zona 1: <span style="color:var(--green)">${f2(tots[0])} ha</span> · Zona 2: <span style="color:var(--amber)">${f2(tots[1])} ha</span>`;
}

function renderCostos(){
  const c=DB.costos,real=sum(c,x=>x.real),total=sum(c,x=>x.total);
  const pptoRef=c.find(x=>x.ppto)?.ppto||0;
  const fila=(x)=>`<div class="cr2"><div class="cl">${esc(x.concepto)}</div><div class="cvs"><div class="creal">${money(x.real)}</div><div class="cppto">${x.ppto?'vs '+money(x.ppto):'—'}</div><div class="ctot">${money(x.total)}</div></div></div>`;
  q('costos').innerHTML=`<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;margin-bottom:11px;font-size:8.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:700;padding-bottom:7px;border-bottom:2px solid var(--bdr)"><div>Concepto</div><div>$/ha Real</div><div>$/ha Ppto</div><div>Total $</div></div>`+
    c.map(fila).join('')+
    `<div class="cr2" style="border-top:2px solid rgba(0,119,170,.2);margin-top:3px;padding-top:9px"><div class="cl" style="color:var(--cyan);font-weight:800">TOTAL</div><div class="cvs"><div class="creal" style="color:var(--cyan)">${money(real)}</div><div class="cppto">${pptoRef?'vs '+money(pptoRef):'—'}</div><div class="ctot" style="color:var(--cyan);font-weight:700">${money(total)}</div></div></div>`+
    (pptoRef?`<div style="margin-top:12px;padding:8px 11px;background:rgba(0,135,90,.05);border:1px solid rgba(0,135,90,.2);border-radius:7px;font-size:9.5px;color:var(--dim)">${real<=pptoRef?'Ahorro':'Sobrecosto'} vs ppto: <span style="color:${real<=pptoRef?'var(--green)':'var(--red)'};font-weight:700;font-family:var(--mono)">${real<=pptoRef?'+':'-'}${money(Math.abs(pptoRef-real))}/ha</span> &nbsp;·&nbsp; Ejecución: <span style="color:var(--amber);font-weight:700">${(real/pptoRef*100).toFixed(1)}%</span> del ppto</div>`:'');
}

// ── Panel plegable de labores ──
let laborActiva=null;
function buildLaborPanels(){
  const m=porLabor(procesoFiltrado()),labs=Object.keys(m);
  if(!labs.includes(laborActiva))laborActiva=labs[0]||null;
  q('labor-tabs').innerHTML=labs.map(lab=>{
    const it=m[lab],a=sum(it,x=>x.area),clr=LABOR_COLORS[lab]||'#0077aa';
    return`<div class="ltab ${lab===laborActiva?'active':''}" data-lab="${esc(lab)}"><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${clr};margin-right:6px;vertical-align:middle"></span>${esc(lab)} <span style="font-size:9px;opacity:.65;font-weight:400">(${f2(a)} ha · ${it.length} suerte${it.length>1?'s':''})</span></div>`;
  }).join('');
  q('labor-panels').innerHTML=labs.length?labs.map(lab=>{
    const it=m[lab],a=sum(it,x=>x.area),clr=LABOR_COLORS[lab]||'#0077aa',hacs=[...new Set(it.map(x=>x.hac))];
    const rows=it.map(r=>`<tr>
        <td style="text-align:left;color:var(--dim)">${esc(r.hac)}</td>
        <td style="font-family:var(--mono);font-size:10px;color:${clr};text-align:left">${esc(r.sue)}</td>
        <td style="color:${r.z===1?'var(--green)':'var(--amber)'};font-weight:700">${r.z}</td>
        <td>${f2(r.area)}</td>
        <td style="font-family:var(--mono);color:${r.dias<200?'var(--amber)':'var(--dim)'}">${r.dias}</td>
        <td style="color:var(--dim);font-size:10px;text-align:left">${esc(r.cont)}</td>
        <td style="text-align:left">${r.obs?`<span style="font-size:9px;color:var(--amber)">${esc(r.obs)}</span>`:'<span style="color:var(--muted);font-size:9px">—</span>'}</td>
        <td style="text-align:left">${r.variedad?`<span style="font-size:9px;color:var(--violet)">${esc(r.variedad)}</span>`:'<span style="color:var(--muted);font-size:9px">—</span>'}</td>
      </tr>`).join('');
    return`<div class="lpanel ${lab===laborActiva?'active':''}" data-lab="${esc(lab)}">
      <div class="lsummary">
        <div class="lscard"><div class="lscard-lbl">Área total</div><div class="lscard-val" style="color:${clr}">${f2(a)}</div><div class="lscard-sub">ha en ${esc(lab.toLowerCase())}</div></div>
        <div class="lscard"><div class="lscard-lbl">Suertes</div><div class="lscard-val" style="color:${clr}">${it.length}</div><div class="lscard-sub">lotes en esta labor</div></div>
        <div class="lscard"><div class="lscard-lbl">Haciendas</div><div class="lscard-val" style="color:${clr}">${hacs.length}</div><div class="lscard-sub">${esc(hacs.join(' · '))}</div></div>
      </div>
      <div class="ltbl-wrap"><table>
        <thead><tr><th style="text-align:left">Hacienda</th><th style="text-align:left">Suerte</th><th>Z</th><th>Área (ha)</th><th>Días lucro</th><th style="text-align:left">Contratista</th><th style="text-align:left">Observación</th><th style="text-align:left">Variedad</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }).join(''):'<div class="nores">Sin suertes en proceso para los filtros seleccionados.</div>';
  drawLaborPie(m);
}

function drawLaborPie(m){
  const svg=q('pie-labor'),legend=q('pie-legend');
  const cx=80,cy=80,r=62,ri=32;
  const entries=Object.entries(m).map(([lab,it])=>({lab,area:sum(it,x=>x.area),clr:LABOR_COLORS[lab]||'#999'}));
  const total=sum(entries,e=>e.area);
  if(!total){svg.innerHTML='';legend.innerHTML='';return;}
  let a0=-Math.PI/2;
  const slices=entries.map(e=>{const ang=e.area/total*2*Math.PI,s={...e,a0,a1:a0+ang,pct:e.area/total};a0+=ang;return s;});
  const P=(ang,rad)=>[cx+rad*Math.cos(ang),cy+rad*Math.sin(ang)];
  const arc=s=>{
    // Un solo segmento de 360° no se puede dibujar como arco: se parte en dos
    const a1=s.pct>=.9999?s.a1-0.0001:s.a1;
    const [x1,y1]=P(s.a0,r),[x2,y2]=P(a1,r),[xi1,yi1]=P(s.a0,ri),[xi2,yi2]=P(a1,ri),lg=a1-s.a0>Math.PI?1:0;
    return`M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${lg},0 ${xi1},${yi1} Z`;
  };
  svg.innerHTML=slices.map(s=>{
    const mid=(s.a0+s.a1)/2,[lx,ly]=P(mid,(r+ri)/2);
    return`<path d="${arc(s)}" fill="${s.clr}" stroke="#fff" stroke-width="2" style="cursor:pointer" data-lab="${esc(s.lab)}"><title>${esc(s.lab)}: ${f2(s.area)} ha (${(s.pct*100).toFixed(1)}%)</title></path>`+
      (s.pct>.1?`<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff" font-family="Inter" pointer-events="none">${(s.pct*100).toFixed(0)}%</text>`:'');
  }).join('')+
  `<text x="${cx}" y="${cy-6}" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text)" font-family="JetBrains Mono">${total.toFixed(1)}</text>
   <text x="${cx}" y="${cy+8}" text-anchor="middle" font-size="8" fill="var(--muted)" font-family="Inter">ha total</text>`;
  legend.innerHTML=slices.map(s=>`<div style="display:flex;align-items:center;gap:7px;cursor:pointer" data-lab="${esc(s.lab)}">
      <div style="width:10px;height:10px;border-radius:2px;background:${s.clr};flex-shrink:0"></div>
      <div style="flex:1;font-size:9.5px;font-weight:600;color:var(--text)">${esc(s.lab)}</div>
      <div style="font-size:9.5px;font-family:var(--mono);color:var(--dim)">${f2(s.area)} ha</div>
      <div style="font-size:9px;color:var(--muted);width:32px;text-align:right">${(s.pct*100).toFixed(1)}%</div>
    </div>`).join('');
}

function switchTab(lab){
  laborActiva=lab;
  document.querySelectorAll('#labor-tabs .ltab,#labor-panels .lpanel').forEach(el=>el.classList.toggle('active',el.dataset.lab===lab));
}
q('acc-labores').addEventListener('click',e=>{
  const t=e.target.closest('[data-lab]');
  if(t){switchTab(t.dataset.lab);return;}
  if(!e.target.closest('#acc-btn'))return;
  const open=q('acc-body').classList.toggle('open');
  q('acc-arrow').classList.toggle('open',open);q('acc-btn').classList.toggle('open',open);
  if(open)buildLaborPanels();
});

// ── Filtros ──
const SELS={zona:'sel-zona',hac:'sel-hac',cult:'sel-cult',est:'sel-est',ppto:'sel-ppto',dias:'sel-dias'};
Object.entries(SELS).forEach(([key,id])=>{
  const el=q(id);
  el.addEventListener('change',()=>{
    F[key]=el.value;
    el.className='fsel'+(el.value!=='all'?' on':'');
    render();
    if(el.value!=='all')toast(el.options[el.selectedIndex].text);
  });
});
q('btn-reset').addEventListener('click',()=>{
  Object.keys(F).forEach(k=>F[k]='all');
  Object.values(SELS).forEach(id=>{q(id).value='all';q(id).className='fsel';});
  busInput.value='';busResults.classList.remove('show');
  render();toast('Filtros limpiados ✓');
});

// ── Fecha y semana editables ──
function editableChip(id,campo){
  q(id).addEventListener('click',function handler(){
    const chip=q(id),cur=DB.meta[campo];
    const input=document.createElement('input');
    input.value=cur;input.className='hchip';
    input.style.cssText='border:1px solid rgba(0,119,170,.5);outline:none;width:110px;text-align:center;font-family:var(--sans);background:#fff;color:var(--text)';
    chip.hidden=true;chip.after(input);input.focus();input.select();
    let done=false;
    const fin=ok=>{if(done)return;done=true;
      const v=input.value.trim();input.remove();chip.hidden=false;
      if(ok&&v&&v!==cur){DB.meta[campo]=v;save();renderMeta();toast(`${campo==='fecha'?'Fecha':'Semana'} actualizada: ${v}`);}
    };
    input.addEventListener('blur',()=>fin(true));
    input.addEventListener('keydown',e=>{if(e.key==='Enter')fin(true);if(e.key==='Escape')fin(false);});
  });
}
editableChip('chip-fecha','fecha');
editableChip('chip-sem','semana');

// ── Buscador ──
const busInput=q('buscador'),busResults=q('search-results');
function hl(text,s){
  text=esc(text);if(!s)return text;
  const re=new RegExp(`(${esc(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');
  return text.replace(re,'<mark class="sr-highlight">$1</mark>');
}
busInput.addEventListener('input',()=>{
  const s=busInput.value.trim(),sl=s.toLowerCase();
  if(!s){busResults.classList.remove('show');return;}
  const fuente=[
    ...DB.lotes.map(l=>({sue:l.s,hac:l.h,zona:l.z,area:l.a,est:l.e,fuente:'COMITÉ APS'})),
    ...DB.proceso.map(r=>({sue:r.sue,hac:r.hac,zona:r.z,area:r.area,est:r.labor,fuente:'EN PROCESO'})),
  ];
  const hits=fuente.filter(x=>x.sue.toLowerCase().includes(sl)||x.hac.toLowerCase().includes(sl)).slice(0,10);
  if(!hits.length){busResults.innerHTML=`<div class="sr-empty">Sin resultados para "<b>${esc(s)}</b>"</div>`;busResults.classList.add('show');return;}
  busResults.innerHTML=`<div class="sr-header">${hits.length} resultado${hits.length!==1?'s':''}</div>`+hits.map(x=>`
    <div class="sr-item" data-sue="${esc(x.sue)}" data-hac="${esc(x.hac)}">
      <div class="sr-sue">${hl(x.sue,s)}</div><div class="sr-hac">${hl(x.hac,s)}</div>
      <div class="sr-area">${f2(x.area)} ha</div>
      <div class="sr-chips">
        <span class="chip ${x.zona===1?'cg':'ca'}" style="font-size:8px">Z${x.zona}</span>
        <span class="chip ${x.est==='SEMBRADA'?'cg':x.fuente==='EN PROCESO'?'ca':'cr'}" style="font-size:8px">${esc(x.est)}</span>
        <span class="chip ${x.fuente==='EN PROCESO'?'ca':'cc'}" style="font-size:8px">${x.fuente}</span>
      </div>
    </div>`).join('');
  busResults.classList.add('show');
});
busResults.addEventListener('click',e=>{
  const it=e.target.closest('.sr-item');if(!it)return;
  const {sue,hac}=it.dataset;
  F.hac=hac;q('sel-hac').value=hac;q('sel-hac').className='fsel on';
  busInput.value=sue;busResults.classList.remove('show');
  render();
  const row=[...q('lotes-tbody').querySelectorAll('tr')].find(r=>r.dataset.sue===sue);
  if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.style.background='#fff3cd';setTimeout(()=>row.style.background='',1800);}
  toast(`Suerte ${sue} · ${hac}`);
});
document.addEventListener('click',e=>{if(!busInput.contains(e.target)&&!busResults.contains(e.target))busResults.classList.remove('show');});
busInput.addEventListener('keydown',e=>{if(e.key==='Escape'){busResults.classList.remove('show');busInput.blur();}});

// Redibuja todo tras cualquier cambio de datos
function renderAll(){renderMeta();renderHacSelect();renderPPTO();renderCostos();render();}

loadDB();
renderAll();
