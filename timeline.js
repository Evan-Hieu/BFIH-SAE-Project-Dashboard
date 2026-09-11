(() => {
  const $=id=>document.getElementById(id),stages=ManufactureSource.stages;
  let items=[],loaded=false;
  const allowed=()=>!window.WebAuth?.enabled||(WebAuth.can('Timeline')&&WebAuth.can('Manufacture'));
  function render(){
    const message=$('timelineMessage'),body=$('timelineMatrixBody');
    if(!allowed()){body.replaceChildren();message.textContent='You need Timeline and Manufacture access to view Inhouse progress.';return;}
    const query=$('timelineSearch').value.trim().toLowerCase(),project=$('timelineProject').value,status=$('timelineStatus').value;
    const rows=items.filter(x=>(!project||x.Project===project)&&(!query||[x.Project,x.Phase,x.Equipment,x.Spec,x.Type,x.Condition].join(' ').toLowerCase().includes(query))&&(!status||(status==='done')===SaeSource.dispatched(x)));
    message.textContent=!loaded?'Waiting for Inhouse source data…':`${rows.length} of ${items.length} items · 18 stages · Source: SAE Summary Data`;
    body.innerHTML=rows.map((x,index)=>{
      // Layout review: stage cells intentionally remain blank until marking is requested.
      const cells=stages.map(()=>'<td class="matrix-cell"></td>').join('');
      const notes=[x.Condition,x.Remark].filter(Boolean);
      return `<tr><td class="matrix-no">${index+1}</td><th scope="row" class="matrix-identity"><strong>${esc(x.Equipment)} · ${esc(x.Project)}</strong><span>${esc(x.Spec)}</span><small>${esc(x.Phase)} · ${esc(x.Type)} · QTY ${esc(x['KO QTY'])} · NBD ${esc(x.NBD?x.NBD.slice(5).replace('-','/'):'—')}</small></th>${cells}<td class="matrix-remarks">${notes.map(v=>`<div>${esc(v)}</div>`).join('')||'—'}</td></tr>`;
    }).join('')||`<tr><td colspan="21" class="matrix-empty">${loaded?'No matching equipment. Adjust the filters.':'Inhouse progress will appear after source sync.'}</td></tr>`;
  }
  $('timelineMatrixHead').innerHTML='<tr><th class="matrix-no" scope="col">No.</th><th class="matrix-identity" scope="col">Project / Equipment</th>'+stages.map((s,i)=>`<th class="matrix-stage group-${s.group}" scope="col"><div><span class="matrix-stage-number">${String(i+1).padStart(2,'0')}</span><span>${esc(s.label)}</span></div></th>`).join('')+'<th class="matrix-remarks" scope="col">Remarks</th></tr>';
  window.InhouseTimeline={
    update(data,isLoaded=true){items=data;loaded=isLoaded;const project=$('timelineProject'),saved=project.value;project.innerHTML='<option value="">All projects</option>'+[...new Set(items.map(x=>x.Project))].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');project.value=[...project.options].some(o=>o.value===saved)?saved:'';render();},render
  };
  $('timelineSearch').addEventListener('input',render);
  ['timelineProject','timelineStatus'].forEach(id=>$(id).addEventListener('change',render));
  document.addEventListener('webauthchange',()=>{if(!WebAuth.user){items=[];loaded=false;}render();});
})();
