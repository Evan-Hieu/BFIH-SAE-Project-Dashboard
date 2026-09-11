(() => {
  const $=id=>document.getElementById(id),stages=ManufactureSource.stages;
  let items=[],loaded=false,selected=null;
  const allowed=()=>!window.WebAuth?.enabled||(WebAuth.can('Timeline')&&WebAuth.can('Manufacture'));
  const labels={done:'Completed',progress:'In progress',delayed:'Delayed',unknown:'No data',info:'Source information',partial:'Partial information',planned:'Planned ETD',na:'Not applicable','not-started':'Not started'};
  function showDetail(){
    const item=items.find(x=>x._sourceRow===selected?.row),stage=stages[selected?.stage];
    const panel=$('timelineCellDetail');panel.hidden=!item||!stage||!allowed();if(panel.hidden)return;
    const cell=item._production?.[stage.index]||{state:'unknown',text:'—',evidence:[],note:'No source data.'};
    $('timelineCellTitle').textContent=`${item.Equipment} · ${item.Spec} · ${stage.label}`;
    $('timelineCellSummary').textContent=`${labels[cell.state]} · ${cell.text}${cell.note?' — '+cell.note:''}`;
    $('timelineCellEvidence').innerHTML=(cell.evidence||[]).map(e=>`<div><dt>${esc(e.column)}${item._sourceRow} · ${esc(e.label)}</dt><dd>${esc(e.value)}</dd></div>`).join('')||'<p>No matching data in the source sheet.</p>';
  }
  function render(){
    const message=$('timelineMessage'),body=$('timelineMatrixBody');
    if(!allowed()){body.replaceChildren();selected=null;showDetail();message.textContent='You need Timeline and Manufacture access to view Inhouse progress.';return;}
    const query=$('timelineSearch').value.trim().toLowerCase(),project=$('timelineProject').value,status=$('timelineStatus').value;
    const rows=items.filter(x=>(!project||x.Project===project)&&(!query||[x.Project,x.Phase,x.Equipment,x.Spec,x.Type,x.Condition].join(' ').toLowerCase().includes(query))&&(!status||(status==='done')===SaeSource.dispatched(x)));
    message.textContent=!loaded?'Waiting for Inhouse source data…':`${rows.length} of ${items.length} items · 18 stages · Source: SAE Summary Data`;
    body.innerHTML=rows.map((x,index)=>{
      const cells=stages.map((stage,i)=>{const cell=x._production?.[i]||{state:'unknown',text:'—'},label=`${x.Equipment} / ${x.Spec}: ${stage.label} — ${labels[cell.state]} ${cell.text}`;return `<td class="matrix-cell state-${cell.state}"><button type="button" data-row="${x._sourceRow}" data-stage="${i}" aria-label="${esc(label)}" title="${esc(label)}"><span>${esc(cell.text)}</span>${cell.state==='partial'?'<small>partial</small>':''}</button></td>`;}).join('');
      const notes=[x.Condition,x['MFG status'],x.Remark].filter(Boolean);
      return `<tr><td class="matrix-no">${index+1}</td><th scope="row" class="matrix-identity"><strong>${esc(x.Equipment)} · ${esc(x.Project)}</strong><span>${esc(x.Spec)}</span><small>${esc(x.Phase)} · ${esc(x.Type)} · QTY ${esc(x['KO QTY'])} · NBD ${esc(x.NBD?x.NBD.slice(5).replace('-','/'):'—')}</small></th>${cells}<td class="matrix-remarks">${notes.map(v=>`<div>${esc(v)}</div>`).join('')||'—'}</td></tr>`;
    }).join('')||`<tr><td colspan="21" class="matrix-empty">${loaded?'No matching equipment. Adjust the filters.':'Inhouse progress will appear after source sync.'}</td></tr>`;
    if(!rows.some(x=>x._sourceRow===selected?.row))selected=null;showDetail();
  }
  $('timelineMatrixHead').innerHTML='<tr><th class="matrix-no" scope="col">No.</th><th class="matrix-identity" scope="col">Project / Equipment</th>'+stages.map((s,i)=>`<th class="matrix-stage group-${s.group}" scope="col"><div><span class="matrix-stage-number">${String(i+1).padStart(2,'0')}</span><span>${esc(s.label)}</span></div></th>`).join('')+'<th class="matrix-remarks" scope="col">Remarks</th></tr>';
  window.InhouseTimeline={
    update(data,isLoaded=true){items=data;loaded=isLoaded;const project=$('timelineProject'),saved=project.value;project.innerHTML='<option value="">All projects</option>'+[...new Set(items.map(x=>x.Project))].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');project.value=[...project.options].some(o=>o.value===saved)?saved:'';render();},render
  };
  $('timelineSearch').addEventListener('input',render);
  ['timelineProject','timelineStatus'].forEach(id=>$(id).addEventListener('change',render));
  $('timelineMatrixBody').addEventListener('click',e=>{const button=e.target.closest('button[data-stage]');if(!button)return;selected={row:Number(button.dataset.row),stage:Number(button.dataset.stage)};showDetail();$('timelineCellDetail').scrollIntoView({block:'nearest',behavior:'smooth'});});
  $('timelineDetailClose').addEventListener('click',()=>{const row=selected?.row,stage=selected?.stage;selected=null;showDetail();$('timelineMatrixBody').querySelector(`button[data-row="${row}"][data-stage="${stage}"]`)?.focus();});
  document.addEventListener('webauthchange',()=>{if(!WebAuth.user){items=[];loaded=false;selected=null;}render();});
})();
