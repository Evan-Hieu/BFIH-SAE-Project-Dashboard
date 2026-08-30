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
function pinManufactureColumns(){
  const table=document.querySelector('#manufactureSection table');
  const viewport=table.parentElement;
  const rail=document.createElement('div');
  rail.className='mfg-horizontal-scroll';rail.tabIndex=0;
  rail.setAttribute('aria-label','Scroll Manufacture details horizontally');
  const track=document.createElement('div');rail.append(track);viewport.after(rail);
  const headers=Array.from(table.tHead.rows[0].cells).slice(0,9);
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
