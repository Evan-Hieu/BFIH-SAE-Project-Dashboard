window.loadManufactureItems=function(items){
  MFG=items.map(x=>({...x,_gap:gap(x.NBD),_priority:priority(gap(x.NBD),x['Overall status']==='Dispatched'?'Dispatched':'')}));
  const ids=['yearFilter','monthFilter','weekFilter'];
  const saved=ids.map(id=>document.getElementById(id).value);
  times();
  ids.forEach((id,i)=>{document.getElementById(id).value=saved[i];});
  mfgLoaded=true;apply();
};
function manufacturePendingRow(x){
  const fields=['Project','Phase','Equipment','Spec','Type','KO QTY','KO Date','CM NBD','CM Site','MFG status','Material Status','STD Status','RM Status','CNC OS STATUS','RD Drawing Status','ACT ETD','Remark'];
  return `<tr><td><span class="priority ${x._priority.cls}">${esc(x._priority.text)}</span></td>${fields.map(k=>`<td>${esc(['KO Date','CM NBD','ACT ETD'].includes(k)?date(x[k]):x[k])}</td>`).join('')}</tr>`;
}
function pinManufactureColumns(section='manufactureSection'){
  const table=document.querySelector('#'+section+' .pending table');
  const viewport=table.parentElement;
  const rail=document.createElement('div');
  rail.className='mfg-horizontal-scroll';rail.tabIndex=0;
  rail.setAttribute('aria-label','Scroll details horizontally');
  const track=document.createElement('div');rail.append(track);viewport.after(rail);
  const headers=Array.from(table.tHead.rows[0].cells).slice(0,5);
  const update=()=>{
    let left=0;
    headers.forEach((cell,index)=>{table.style.setProperty(`--mfg-pin-${index+1}`,`${left}px`);left+=cell.getBoundingClientRect().width;});
    rail.style.marginLeft=`${left}px`;
    rail.style.width=`${Math.max(0,viewport.clientWidth-left)}px`;
    track.style.width=`${Math.max(0,viewport.clientWidth-left)+Math.max(0,viewport.scrollWidth-viewport.clientWidth)}px`;
    rail.scrollLeft=viewport.scrollLeft;
  };
  rail.addEventListener('scroll',()=>{if(Math.abs(viewport.scrollLeft-rail.scrollLeft)>1)viewport.scrollLeft=rail.scrollLeft;});
  viewport.addEventListener('scroll',()=>{if(Math.abs(rail.scrollLeft-viewport.scrollLeft)>1)rail.scrollLeft=viewport.scrollLeft;});
  const observer=new ResizeObserver(update);
  Array.from(table.tHead.rows[0].cells).forEach(cell=>observer.observe(cell));
  observer.observe(viewport);update();
}
function renderStatusSummary(items,bodyId,field){
  const category=x=>{const type=String(x[field]||'').trim().toUpperCase();return type==='NB'?'NB':/^RF(?:\s|$)/.test(type)?'RF':'Other';};
  const rows=['NB','RF','Other'].map(type=>[type,items.filter(x=>category(x)===type)]);
  rows.push(['Total',items]);
  document.getElementById(bodyId).innerHTML=rows.map(([label,data])=>{
    const done=data.filter(x=>SaeSource.dispatched(x)).length;
    return `<tr><th scope="row">${label}</th>${[data.length,data.length-done,done].map(value=>`<td>${value}</td>`).join('')}</tr>`;
  }).join('');
}
function renderManufactureSummary(items){renderStatusSummary(items,'mfgSummaryBody','Type');}
function statusChartOptions(){return {responsive:true,maintainAspectRatio:false,cutout:'64%',layout:{padding:{top:3,bottom:8}},plugins:{legend:{position:'right',labels:{boxWidth:9,font:{size:10},generateLabels(chart){return Chart.overrides.doughnut.plugins.legend.labels.generateLabels(chart).map(label=>({...label,text:label.text+' · '+chart.data.datasets[0].data[label.index]}));}}},tooltip:{enabled:true}}};}
function renderManufactureDonut(items){
  if(typeof Chart==='undefined')return;
  if(mfgChart)mfgChart.destroy();
  const done=items.filter(x=>SaeSource.dispatched(x)).length;
  const canvas=document.getElementById('mfgStatusChart');
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`${items.length} items: Dispatched ${done}, On-going ${items.length-done}`);
  const depth=statusDepth('Inhouse',items.length);
  mfgChart=new Chart(canvas,{type:'doughnut',plugins:[depth],data:{labels:['Dispatched','On-going'].map(UIText.t),datasets:[{data:[done,items.length-done],backgroundColor:['#26a34a','#eeb308'],borderColor:'#fff',borderWidth:2,hoverOffset:3}]},options:statusChartOptions()});
}
document.addEventListener('languagechange',()=>{[importChart,mfgChart].filter(Boolean).forEach(chart=>{chart.data.labels=['Dispatched','On-going'].map(UIText.t);chart.update();});});

function statusDepth(label,total){return {id:'statusDepth',beforeDatasetsDraw(chart){const ctx=chart.ctx;ctx.save();ctx.translate(0,7);ctx.filter='brightness(0.62)';chart.getDatasetMeta(0).data.forEach(arc=>arc.draw(ctx));ctx.restore();},afterDraw(chart){const arc=chart.getDatasetMeta(0).data[0];if(!arc)return;const ctx=chart.ctx,r=arc.innerRadius;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#102e50';ctx.font='700 '+Math.min(23,r*.34)+'px Arial';ctx.fillText(label,arc.x,arc.y-17);ctx.font='800 '+Math.min(28,r*.4)+'px Arial';ctx.fillText(String(total),arc.x,arc.y+12);ctx.fillStyle='#64748b';ctx.font='11px Arial';ctx.fillText(UIText.t('items'),arc.x,arc.y+34);ctx.restore();}};}
