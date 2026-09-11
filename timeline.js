(() => {
  const $=id=>document.getElementById(id),day=86400000;
  const stamp=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')?Date.parse(s+'T00:00:00Z'):NaN;
  const format=t=>new Date(t).toISOString().slice(0,10);
  const today=()=>{const d=new Date();return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());};
  let items=[],loaded=false,selected='';
  const allowed=()=>!window.WebAuth?.enabled||(WebAuth.can('Timeline')&&WebAuth.can('Manufacture'));
  function render(){
    if(!$('timelineView'))return;
    const message=$('timelineMessage'),list=$('timelineItems'),chart=$('timelineChart');
    if(!allowed()){list.replaceChildren();chart.replaceChildren();message.textContent='You need Timeline and Manufacture access to view Inhouse schedules.';return;}
    const query=$('timelineSearch').value.trim().toLowerCase(),project=$('timelineProject').value,status=$('timelineStatus').value;
    const rows=items.filter(x=>(!project||x.Project===project)&&(!query||[x.Project,x.Phase,x.Equipment,x.Spec,x.Type].join(' ').toLowerCase().includes(query))&&(!status||(status==='done')===SaeSource.dispatched(x)));
    if(!rows.some(x=>String(x._sourceRow)===selected))selected=String(rows[0]?._sourceRow||'');
    message.textContent=!loaded?'Waiting for Inhouse source data…':`${rows.length} of ${items.length} items · Source: SAE Summary Data · Read-only`;
    list.innerHTML=rows.map(x=>`<button type="button" class="timeline-item${String(x._sourceRow)===selected?' selected':''}" data-row="${x._sourceRow}" aria-pressed="${String(x._sourceRow)===selected}"><strong>${esc(x.Equipment)} · ${esc(x.Spec)}</strong><span>${esc(x.Project)} / ${esc(x.Phase)} · ${esc(x.Type)} · QTY ${esc(x['KO QTY'])}</span><span>NBD ${esc(x.NBD||'—')} · ${esc(x['MFG status']||'No status')}</span></button>`).join('');
    const item=rows.find(x=>String(x._sourceRow)===selected);
    if(!item){chart.innerHTML='<p class="timeline-empty">'+(loaded?'No matching equipment. Adjust the filters.':'The schedule will appear when Inhouse data is synced.')+'</p>';return;}
    const stages=item._timeline||[],dates=stages.flatMap(s=>['planStart','planEnd','actualStart','actualEnd'].map(k=>stamp(s[k]))).filter(Number.isFinite);
    const heading=`<div class="timeline-equipment"><h2>${esc(item.Equipment)} · ${esc(item.Spec)}</h2><p>${esc(item.Project)} / ${esc(item.Phase)} · QTY ${esc(item['KO QTY'])} · NBD <strong>${esc(item.NBD||'—')}</strong> · ${esc(item['MFG status'])}</p></div>`;
    if(!dates.length){chart.innerHTML=heading+'<p class="timeline-empty">No dated milestones in the source for this item.</p>';return;}
    const min=Math.min(...dates)-3*day,max=Math.max(...dates)+3*day,span=Math.max(max-min,7*day);
    const pos=t=>Math.max(0,Math.min(100,(t-min)/span*100));
    const tickCount=6,ticks=Array.from({length:tickCount+1},(_,i)=>`<span style="left:${i/tickCount*100}%">${format(min+span*i/tickCount)}</span>`).join('');
    const markers=()=>[[today(),'today','Today'],[stamp(item.NBD),'nbd','NBD']].filter(([t])=>Number.isFinite(t)&&t>=min&&t<=min+span).map(([t,cls,label])=>`<i class="timeline-marker ${cls}" style="left:${pos(t)}%" title="${label}: ${format(t)}"></i>`).join('');
    function lane(stage,kind){
      const start=stamp(stage[kind+'Start']),end=stamp(stage[kind+'End']);
      if(!Number.isFinite(start)&&!Number.isFinite(end))return '';
      const first=Number.isFinite(start)?start:end,last=Number.isFinite(end)?end:start;
      const invalid=last<first;
      const label=`${kind==='plan'?'Plan':'Actual'}: ${stage[kind+'Start']||'—'} → ${stage[kind+'End']||'—'}${invalid?' · End precedes start':''}`;
      if(invalid)return `<span class="timeline-invalid">${esc(label)}</span>`;
      return `<span class="timeline-bar ${kind}${first===last?' milestone':''}" style="left:${pos(first)}%;width:${Math.max(pos(last)-pos(first),0.7)}%" title="${esc(label)}"><span class="sr-only">${esc(label)}</span></span>`;
    }
    const content=stages.map(s=>`<div class="timeline-stage"><div class="timeline-stage-name"><strong>${esc(s.label)}</strong><small>Plan: ${esc(s.planStart||'—')} → ${esc(s.planEnd||'—')}<br>Actual: ${esc(s.actualStart||'—')} → ${esc(s.actualEnd||'—')}</small></div><div class="timeline-track">${markers()}${lane(s,'plan')}${lane(s,'actual')}</div></div>`).join('');
    const debug=(item._details||[]).filter(d=>d.label.toLowerCase().startsWith('debug'));
    chart.innerHTML=heading+`<div class="timeline-legend"><span class="plan">Plan / ETA</span><span class="actual">Actual</span><span class="nbd">NBD</span><span class="today">Today</span></div><div class="timeline-scroll" tabindex="0" aria-label="Inhouse Gantt chart"><div class="timeline-grid"><div class="timeline-axis"><strong>Production stage</strong><div>${ticks}</div></div>${content}</div></div><p class="timeline-note">A dash means no dated value in the source. A point marks a single date; a bar joins an available start and end. Actual dates do not imply the entire item is dispatched.</p>`+(debug.length?`<details class="timeline-source-note"><summary>Debug dates — source headers need clarification</summary><p>These columns currently share the same label; they are not assigned to start/end or plan/actual.</p>${debug.map(d=>`<p>${esc(d.column)} · ${esc(d.label)}: <strong>${esc(d.value)}</strong></p>`).join('')}</details>`:'');
  }
  window.InhouseTimeline={
    update(data,isLoaded=true){items=data;loaded=isLoaded;const project=$('timelineProject'),saved=project.value;project.innerHTML='<option value="">All projects</option>'+[...new Set(items.map(x=>x.Project))].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');project.value=[...project.options].some(o=>o.value===saved)?saved:'';render();},render
  };
  $('timelineSearch').addEventListener('input',render);
  ['timelineProject','timelineStatus'].forEach(id=>$(id).addEventListener('change',render));
  $('timelineItems').addEventListener('click',e=>{const button=e.target.closest('[data-row]');if(button){selected=button.dataset.row;render();}});
  document.addEventListener('webauthchange',()=>{if(!WebAuth.user){items=[];loaded=false;selected='';}render();});
})();
