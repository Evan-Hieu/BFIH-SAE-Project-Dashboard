let ALL = [];
let statusChart = null;
let projectChart = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  try {
    const response = await fetch("sae_data.json?ts=" + Date.now());
    if (!response.ok) throw new Error("sae_data.json not found");
    const raw = await response.json();
    ALL = Array.isArray(raw) ? raw.map(normalizeItem) : [];
    buildFilters();
    render(ALL);
    document.getElementById("lastUpdated").textContent = new Date().toLocaleString();
  } catch (err) {
    console.error(err);
    document.getElementById("pendingBody").innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:30px;color:#dc2626">Cannot load sae_data.json</td></tr>';
  }
}

function bindEvents() {
  ["projectFilter","buildFilter","picFilter","stageFilter"].forEach(id => {
    document.getElementById(id).addEventListener("change", filterData);
  });
  document.getElementById("searchInput").addEventListener("input", filterData);
  document.getElementById("resetButton").addEventListener("click", () => {
    ["projectFilter","buildFilter","picFilter","stageFilter"].forEach(id => document.getElementById(id).value = "");
    document.getElementById("searchInput").value = "";
    render(ALL);
  });
}

function normalizeItem(x) {
  const gap = cpGap(x["NBD"]);
  const pending = pendingStage(x);
  return {...x, _gap: gap, _stage: pending.stage, _action: pending.action, _priority: priority(gap, x["Dispatched date"])};
}

function cpGap(value) {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.floor((today - d) / 86400000);
}

function priority(gap, dispatched) {
  if (hasValue(dispatched)) return {text:"● Dispatched", cls:"p-green"};
  if (gap === null) return {text:"● No NBD", cls:"p-gray"};
  if (gap > 0) return {text:"● Overdue", cls:"p-red"};
  if (gap >= -3) return {text:"● Due ≤3d", cls:"p-orange"};
  if (gap >= -7) return {text:"● Due ≤7d", cls:"p-yellow"};
  return {text:"● Upcoming", cls:"p-green"};
}

function pendingStage(x) {
  const type = txt(x["Type"]).toLowerCase();
  if (type === "inhouse") return {stage:"Project / Inhouse Follow-up", action:"Check execution progress vs NBD"};
  if (!hasValue(x["FIH PO Number"])) return {stage:"FIH PO Pending", action:"Follow up FIH PO number"};
  if (hasValue(x["Target date"]) && !hasValue(x["Released"])) return {stage:"FIH PO Release Pending", action:"Follow up FIH PO release"};
  if (hasValue(x["Official PO Target date"]) && !hasValue(x["Official PO Released"])) return {stage:"Official PO Pending", action:"Follow up Official PO release"};
  if (!hasValue(x["Vendor ETD"])) return {stage:"Vendor ETD Pending", action:"Confirm Vendor ETD"};
  if (!hasValue(x["AWB Bill"])) return {stage:"AWB Pending", action:"Get AWB / shipment confirmation"};
  if (!hasValue(x["BFIH Actual ETA"]) && !hasValue(x["BFIH site arrive"])) return {stage:"BFIH Arrival Pending", action:"Track shipment / confirm BFIH arrival"};
  if (!hasValue(x["CM PO Number"])) return {stage:"CM PO Pending", action:"Follow up CM PO"};
  if (!hasValue(x["CM Released date"])) return {stage:"CM Release Pending", action:"Follow up CM release"};
  if (!hasValue(x["VMI ETA plan"])) return {stage:"VMI ETA Plan Pending", action:"Confirm VMI ETA plan"};
  if (!hasValue(x["VMI ETA"])) return {stage:"VMI Arrival Pending", action:"Confirm VMI ETA / arrival"};
  if (!hasValue(x["Dispatched date"])) return {stage:"Dispatch Pending", action:"Push dispatch to customer"};
  return {stage:"Completed", action:"-"};
}

function buildFilters() {
  fillSelect("projectFilter", ALL.map(x => x["Project"]));
  fillSelect("buildFilter", ALL.map(x => x["Build"]));
  fillSelect("picFilter", ALL.map(x => x["PIC"]));
  fillSelect("stageFilter", ALL.map(x => x._stage));
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  [...new Set(values.filter(hasValue).map(txt))].sort().forEach(v => {
    const op = document.createElement("option");
    op.value = v; op.textContent = v; el.appendChild(op);
  });
}

function filterData() {
  const p = val("projectFilter"), b = val("buildFilter"), pic = val("picFilter"), stage = val("stageFilter");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();

  const data = ALL.filter(x => {
    if (p && txt(x["Project"]) !== p) return false;
    if (b && txt(x["Build"]) !== b) return false;
    if (pic && txt(x["PIC"]) !== pic) return false;
    if (stage && x._stage !== stage) return false;
    if (q) {
      const haystack = [x["Project"],x["Build"],x["Machine/Equipment name"],x["Spec"],x["PIC"],x["Vendor"],x["Overall status"],x["Remark"]].map(txt).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  render(data);
}

function render(data) {
  renderKPI(data);
  renderPending(data);
  renderDonut(data);
  renderBar(data);
}

function renderKPI(data) {
  const total = data.length;
  const overdue = data.filter(x => !hasValue(x["Dispatched date"]) && x._gap !== null && x._gap > 0).length;
  const due3 = data.filter(x => !hasValue(x["Dispatched date"]) && x._gap !== null && x._gap <= 0 && x._gap >= -3).length;
  const due7 = data.filter(x => !hasValue(x["Dispatched date"]) && x._gap !== null && x._gap <= -4 && x._gap >= -7).length;
  const dispatched = data.filter(x => hasValue(x["Dispatched date"]) || txt(x["Overall status"]).toLowerCase() === "dispatched").length;

  set("totalCount", total); set("overdueCount", overdue); set("due3Count", due3); set("due7Count", due7); set("dispatchedCount", dispatched);
  set("totalPercent", total ? "100%" : "0%");
  set("overduePercent", pct(overdue,total)); set("due3Percent", pct(due3,total)); set("due7Percent", pct(due7,total)); set("dispatchedPercent", pct(dispatched,total));
}

function renderPending(data) {
  const rows = data
    .filter(x => !hasValue(x["Dispatched date"]) && txt(x["Overall status"]).toLowerCase() !== "dispatched")
    .sort((a,b) => (b._gap ?? -999999) - (a._gap ?? -999999));

  set("pendingCount", rows.length + " items");
  const body = document.getElementById("pendingBody");

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:28px;color:#64748b">No pending items</td></tr>';
    return;
  }

  body.innerHTML = rows.map(x => `
    <tr>
      <td><span class="priority ${x._priority.cls}">${esc(x._priority.text)}</span></td>
      <td>${esc(x["Project"])}<br><b>${esc(x["Build"])}</b></td>
      <td>${esc(x["Machine/Equipment name"])}</td>
      <td>${displayDate(x["NBD"])}</td>
      <td>${displayDate(x["BFIH site arrive"])}</td>
      <td class="${gapClass(x._gap)}">${displayGap(x._gap)}</td>
      <td class="stage">${esc(x._stage)}</td>
      <td>${esc(x._action)}</td>
    </tr>
  `).join("");
}

function renderDonut(data) {
  if (typeof Chart === "undefined") return;
  const counts = {};
  data.forEach(x => {
    const s = hasValue(x["Overall status"]) ? txt(x["Overall status"]) : "No Status";
    counts[s] = (counts[s] || 0) + 1;
  });
  if (statusChart) statusChart.destroy();
  statusChart = new Chart(document.getElementById("statusChart"), {
    type:"doughnut",
    data:{labels:Object.keys(counts),datasets:[{data:Object.values(counts),backgroundColor:["#1769e0","#26a34a","#f58213","#ef2b1f","#eeb308","#94a3b8"]}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"58%",plugins:{legend:{position:"right",labels:{boxWidth:10,font:{size:10}}}}}
  });
}

function renderBar(data) {
  if (typeof Chart === "undefined") return;
  const g = {};
  data.forEach(x => {
    const key = `${txt(x["Project"]) || "-"} ${txt(x["Build"]) || "-"}`;
    if (!g[key]) g[key] = {total:0, overdue:0};
    g[key].total++;
    if (!hasValue(x["Dispatched date"]) && x._gap !== null && x._gap > 0) g[key].overdue++;
  });
  const labels = Object.keys(g);
  if (projectChart) projectChart.destroy();
  projectChart = new Chart(document.getElementById("projectChart"), {
    type:"bar",
    data:{labels,datasets:[
      {label:"Total Items",data:labels.map(k=>g[k].total),backgroundColor:"#1769e0"},
      {label:"Overdue",data:labels.map(k=>g[k].overdue),backgroundColor:"#ef2b1f"}
    ]},
    options:{responsive:true,maintainAspectRatio:false,indexAxis:"y",scales:{x:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{labels:{boxWidth:10,font:{size:10}}}}}
  });
}

function hasValue(v){const s=txt(v);return s!==""&&s!=="-"&&s.toLowerCase()!=="null"&&s.toUpperCase()!=="TBC"}
function txt(v){return v===null||v===undefined?"":String(v).trim()}
function val(id){return document.getElementById(id).value}
function set(id,v){document.getElementById(id).textContent=v}
function pct(n,t){return t?Math.round(n/t*100)+"%":"0%"}
function parseDate(v){
  const s=txt(v); if(!s||s.toUpperCase()==="TBC") return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
  if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)){const[m,d,y]=s.split("/").map(Number);return new Date(y,m-1,d)}
  return null;
}
function displayDate(v){if(!txt(v))return"";if(txt(v).toUpperCase()==="TBC")return"TBC";const d=parseDate(v);return d?`${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`:esc(v)}
function displayGap(v){return v===null?"":v>0?`+${v}`:String(v)}
function gapClass(v){return v===null?"":v>0?"gap-overdue":v>=-7?"gap-near":"gap-safe"}
function esc(v){return txt(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
