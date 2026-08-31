let importLoaded=false,mfgLoaded=false;let IMPORT=[],MFG=[],importChart=null,mfgChart=null,currentImport=[];document.addEventListener("DOMContentLoaded",init);
function init(){
  document.getElementById("saeNavTitle").onclick=()=>{const button=document.getElementById("saeNavTitle"),open=button.getAttribute("aria-expanded")!=="true";button.setAttribute("aria-expanded",String(open));document.getElementById("saeNavChildren").hidden=!open;};
  bind();times();renderImport([]);renderMfg([]);
  document.querySelectorAll('#importSection .kpi-value,#importSection .kpi-sub').forEach(el=>el.textContent='—');
  set('importPendingCount','Not connected');set('mfgPendingCount','Not connected');
  document.getElementById('importPendingBody').innerHTML='<tr><td colspan="18" class="empty">Click Google Sheet to load SAE data</td></tr>';
  exportButton.disabled=true;
  pinImportColumns();pinManufactureColumns();
  document.querySelectorAll('#manufactureSection .kpi-value,#manufactureSection .kpi-sub').forEach(el=>el.textContent='—');
}
function pinImportColumns(){pinManufactureColumns('importSection');}
function bind(){["yearFilter","monthFilter","weekFilter","fromDate","toDate"].forEach(id=>document.getElementById(id).addEventListener("change",apply));exportButton.onclick=exportCSV;importButton.onclick=()=>alert(UIText.t("Import module will use SAE sheet data after the web is completed."));langEn.onclick=()=>lang("en");langZh.onclick=()=>lang("zh");document.querySelectorAll(".nav-link").forEach(a=>a.onclick=e=>{if(a.dataset.page==="import"||a.dataset.page==="manufacture"){e.preventDefault();document.querySelectorAll(".nav-link").forEach(x=>x.classList.remove("active"));a.classList.add("active");document.getElementById(a.dataset.page==="import"?"importSection":"manufactureSection").scrollIntoView({behavior:"smooth"})}})}
function norm(x){const g=gap(x["NBD"]),p=SaeSource.stage(x);return{...x,_gap:g,_stage:p.stage,_action:p.action,_priority:priority(g,SaeSource.dispatched(x)?"Dispatched":"")}}function gap(v){const d=parse(v);if(!d)return null;const t=new Date();t.setHours(0,0,0,0);return Math.floor((t-d)/86400000)}
function priority(g,d){if(has(d))return{text:"● Dispatched",cls:"p-green"};if(g===null)return{text:"● No NBD",cls:"p-gray"};if(g>0)return{text:"● Overdue",cls:"p-red"};if(g>=-3)return{text:"● Due ≤3d",cls:"p-orange"};if(g>=-7)return{text:"● Due ≤7d",cls:"p-yellow"};return{text:"● Upcoming",cls:"p-green"}}
function times(){yearFilter.innerHTML='<option value="">Year</option>';monthFilter.innerHTML='<option value="">Month</option>';weekFilter.innerHTML='<option value="">Week</option>';[...new Set([...IMPORT,...MFG].map(x=>parse(x["NBD"])).filter(Boolean).map(d=>d.getFullYear()))].sort().forEach(y=>yearFilter.insertAdjacentHTML("beforeend",`<option value="${y}">${y}</option>`));["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].forEach((n,i)=>monthFilter.insertAdjacentHTML("beforeend",`<option value="${i+1}">${n}</option>`));for(let i=1;i<=53;i++)weekFilter.insertAdjacentHTML("beforeend",`<option value="${i}">W${i}</option>`)}
function apply(){const y=+yearFilter.value,m=+monthFilter.value,w=+weekFilter.value,f=fromDate.value,t=toDate.value;const filtered=items=>items.filter(x=>{const d=parse(x["NBD"]);if(y&&(!d||d.getFullYear()!==y))return false;if(m&&(!d||d.getMonth()+1!==m))return false;if(w&&(!d||isoWeek(d)!==w))return false;if(f&&(!d||d<new Date(f+"T00:00:00")))return false;if(t&&(!d||d>new Date(t+"T23:59:59")))return false;return true});if(importLoaded)renderImport(filtered(IMPORT));if(mfgLoaded)renderMfg(filtered(MFG))}
function renderImport(d){d=d.filter(x=>!SaeSource.cancelled(x));currentImport=d;renderKPIs("import",d);renderPending("import",d);renderStatusSummary(d,"importSummaryBody","Category");renderDonut("import",d)}function renderMfg(d){renderKPIs("mfg",d);renderPending("mfg",d);renderManufactureSummary(d);renderManufactureDonut(d)}
function renderKPIs(p,d){const total=d.length,o=d.filter(x=>x._gap!==null&&x._gap>0&&!SaeSource.dispatched(x)).length,d3=d.filter(x=>!SaeSource.dispatched(x)&&x._gap!==null&&x._gap<=0&&x._gap>=-3).length,d7=d.filter(x=>!SaeSource.dispatched(x)&&x._gap!==null&&x._gap<=-4&&x._gap>=-7).length,dis=d.filter(x=>SaeSource.dispatched(x)).length;const ids=p==="import"?["importTotal","importOverdue","importDue3","importDue7","importDispatched"]:["mfgTotal","mfgOverdue","mfgDue3","mfgDue7","mfgDispatched"],pids=p==="import"?["importTotalPct","importOverduePct","importDue3Pct","importDue7Pct","importDispatchedPct"]:["mfgTotalPct","mfgOverduePct","mfgDue3Pct","mfgDue7Pct","mfgDispatchedPct"];[total,o,d3,d7,dis].forEach((v,i)=>set(ids[i],v));[total?"100%":"0%",pct(o,total),pct(d3,total),pct(d7,total),pct(dis,total)].forEach((v,i)=>set(pids[i],v))}
function renderPending(p,d){const rows=d.filter(x=>!SaeSource.dispatched(x)&&!SaeSource.cancelled(x)).sort((a,b)=>(b._gap??-999999)-(a._gap??-999999));set(p==="import"?"importPendingCount":"mfgPendingCount",rows.length+" items");const body=document.getElementById(p==="import"?"importPendingBody":"mfgPendingBody");body.innerHTML=rows.length?rows.map(x=>p==="import"?importPendingRow(x):manufacturePendingRow(x)).join(""):`<tr><td colspan="${p==="import"?18:18}" class="empty">No data available</td></tr>`}
function renderDonut(p,d){
  if(typeof Chart==='undefined')return;
  const done=d.filter(x=>SaeSource.dispatched(x)).length;
  const canvas=document.getElementById('importStatusChart');
  if(importChart)importChart.destroy();
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`${d.length} items: Dispatched ${done}, On-going ${d.length-done}`);
  importChart=new Chart(canvas,{type:'doughnut',plugins:[statusDepth('TNO',d.length)],data:{labels:['Dispatched','On-going'].map(UIText.t),datasets:[{data:[done,d.length-done],backgroundColor:['#1769e0','#26a34a'],borderWidth:2,borderColor:'#fff'}]},options:statusChartOptions()});
}
function exportCSV(){const rows=currentImport.map(x=>[x["Project"],x["Build"],x["Machine/Equipment name"],x["NBD"],x["BFIH site arrive"],x._gap,x._stage,x._action]);const csv=[["Project","Build","Machine","NBD","BFIH Site Arrive","CP Gap","Stage","Action"],...rows].map(r=>r.map(v=>`"${txt(v).replaceAll('"','""')}"`).join(",")).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.download="SAE_import_export.csv";a.click()}
function lang(l){UIText.set(l)}
function isoWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);const y=new Date(Date.UTC(d.getUTCFullYear(),0,1));return Math.ceil((((d-y)/86400000)+1)/7)}function parse(v){const s=txt(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}return null}function date(v){const d=parse(v);return d?`${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`:txt(v)}function has(v){const s=txt(v);return !!s&&s!=="-"&&s.toUpperCase()!=="TBC"}function txt(v){return v==null?"":String(v).trim()}function set(id,v){document.getElementById(id).textContent=v}function pct(n,t){return t?Math.round(n/t*100)+"%":"0%"}function gapcls(v){return v===null?"":v>0?"gap-overdue":v>=-7?"gap-near":"gap-safe"}
// Use source rows only in memory; preserve active filters during refresh.
window.loadSaeItems=function(items){
  const ids=['yearFilter','monthFilter','weekFilter','fromDate','toDate'];
  const saved=ids.map(id=>document.getElementById(id).value);
  IMPORT=items.map(norm);importLoaded=true;
  exportButton.disabled=false;
  times();
  ids.forEach((id,i)=>{const el=document.getElementById(id);if(el.tagName!=='SELECT'||[...el.options].some(o=>o.value===saved[i]))el.value=saved[i]});
  apply();
};
function esc(value){return txt(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function importPendingRow(x){
  return `<tr><td><span class="priority ${x._priority.cls}">${esc(x._priority.text)}</span></td>
    <td>${esc(x['Project'])}</td><td>${esc(x['Build'])}</td><td>${esc(x['Machine/Equipment name'])}</td>
    <td>${esc(x['Spec'])}</td>
    <td>${esc(x['Category'])}</td>
    <td>${esc(x['KO QTY'])}</td>
    <td>${esc(date(x['KO Date']))}</td>
    <td>${esc(date(x['NBD']))}</td>
    <td>${esc(quantity(x['Dispatched Qty']))}</td>
    <td>${esc(quantity(x['Pending qty']))}</td>
    <td>${esc(x['Overall status'])}</td>
    <td>${esc(date(x['Airport ETA']))}</td>
    <td>${esc(x['BFIH site arrive'])}</td>
    <td>${esc(x['Dispatch to Customer'])}</td>
    <td class="${gapcls(x._gap)}">${x._gap===null?'':x._gap>0?'+'+x._gap:x._gap}</td>
    <td class="stage">${esc(x._stage)}</td>
    <td>${esc(x._action)}</td>
  </tr>`;
}
function quantity(value){return txt(value)===''?'—':value}
