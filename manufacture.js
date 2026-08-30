window.loadManufactureItems=function(items){
  MFG=items.map(x=>({...x,_gap:gap(x.NBD),_priority:priority(gap(x.NBD),x['Overall status']==='Dispatched'?'Dispatched':'')}));
  const ids=['yearFilter','monthFilter','weekFilter'];
  const saved=ids.map(id=>document.getElementById(id).value);
  times();
  ids.forEach((id,i)=>{document.getElementById(id).value=saved[i];});
  mfgLoaded=true;apply();
};
function manufacturePendingRow(x){
  const fields=['Project','Phase','Spec','Type','KO QTY','KO Date','CM NBD','CM Site','MFG status','Material Status','STD Status','RM Status','CNC OS STATUS','RD Drawing Status','ACT ETD','Remark'];
  return `<tr><td><span class="priority ${x._priority.cls}">${esc(x._priority.text)}</span></td>${fields.map(k=>`<td>${esc(['KO Date','CM NBD','ACT ETD'].includes(k)?date(x[k]):x[k])}</td>`).join('')}</tr>`;
}
