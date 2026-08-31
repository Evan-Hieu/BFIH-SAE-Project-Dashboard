(() => {
  const $=id=>document.getElementById(id);
  const configs={import:{id:SaeSource.SHEET_ID,tab:'SAE',end:'AZ',gid:378558776,parse:SaeSource.mapRows},manufacture:{id:ManufactureSource.SHEET_ID,tab:'SAE Summary Data',end:'CN',gid:2049248761,parse:ManufactureSource.mapRows}};
  let active='import',snapshot=null,changes=new Map(),selection=null,working=false,statusFilter='all';
  const column=index=>{let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;};
  const value=v=>v==null?'':v;
  const formula=v=>typeof v==='string'&&v.startsWith('=');
  const isDate=(c,v)=>typeof v==='number'&&v>20000&&v<100000&&/date|nbd|eta|etd/i.test(snapshot.headers[c]);
  function displayed(c,v){if(isDate(c,v))return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);return String(value(v));}
  const editable=()=>SheetConnection.access(configs[active].id).canEdit;
  function controls(){const dirty=changes.size>0;$('sheetReview').disabled=!dirty||working||!editable();$('sheetDiscard').disabled=!dirty||working;$('sheetReload').disabled=working;$('sheetAccessLabel').textContent=UIText.t(SheetConnection.access(configs[active].id).level);}
  async function readSource(config){
    const base=config.id+'/values/'+encodeURIComponent(`'${config.tab}'!A2:${config.end}`);
    const raw=await SheetConnection.read(base+'?valueRenderOption=FORMULA&dateTimeRenderOption=SERIAL_NUMBER');
    const computed=await SheetConnection.read(base+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER');
    const verified=await SheetConnection.read(base+'?valueRenderOption=FORMULA&dateTimeRenderOption=SERIAL_NUMBER');
    if(JSON.stringify(raw.values)!==JSON.stringify(verified.values))throw new Error('Sheet changed while loading. Please load it again.');
    return {raw:raw.values||[],values:computed.values||[]};
  }
  async function load(){
    if(working)return;
    if(changes.size&&!confirm(UIText.t('Discard unsaved changes?')))return;
    working=true;controls();$('sheetEditorMessage').textContent='Loading sheet…';
    try{
      const data=await readSource(configs[active]);
      if(!data.raw[0])throw new Error('Sheet headers are missing.');
      snapshot={...data,headers:data.raw[0],rows:configs[active].parse(data.values).map(x=>x._sourceRow)};
      changes.clear();render();$('sheetEditorMessage').textContent=`${snapshot.rows.length} items`;
    }catch(e){$('sheetEditorMessage').textContent=e.message;}
    finally{working=false;controls();}
  }
  function render(){
    const table=$('sheetEditorTable');table.tHead.replaceChildren();table.tBodies[0].replaceChildren();
    const draft=snapshot?snapshot.values.map(row=>row.slice()):[];
    changes.forEach(({row,c,after})=>{draft[row-2]??=[];draft[row-2][c]=after;});
    const statuses=new Map(snapshot?configs[active].parse(draft).map(item=>[item._sourceRow,SaeSource.dispatched(item)]):[]);
    const counts={all:snapshot?.rows.length||0,dispatched:0,pending:0};
    snapshot?.rows.forEach(row=>counts[statuses.get(row)?'dispatched':'pending']++);
    document.querySelectorAll('#sheetStatusFilters button').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.filter===statusFilter));
      button.querySelector('.filter-count').textContent=counts[button.dataset.filter];
    });
    $('sheetFilterCount').textContent='';if(!snapshot)return;
    const header=document.createElement('tr');
    ['#',...snapshot.headers.map((h,c)=>`${column(c)} · ${h||'—'}`)].forEach(text=>{const th=document.createElement('th');th.textContent=text;header.append(th);});table.tHead.append(header);
    const query=$('sheetSearch').value.trim().toLowerCase();
    let visible=0;
    snapshot.rows.forEach(row=>{
      const data=draft[row-2]||[];
      if(statusFilter!=='all'&&statuses.get(row)!==(statusFilter==='dispatched'))return;
      if(query&&!data.some(v=>String(v).toLowerCase().includes(query)))return;
      visible++;
      const tr=document.createElement('tr'),number=document.createElement('th');number.textContent=row;tr.append(number);
      snapshot.headers.forEach((label,c)=>{
        const td=document.createElement('td'),original=value(snapshot.raw[row-2]?.[c]),id=`${row}:${c}`,change=changes.get(id);
        const shown=change?change.after:value(data[c]);td.textContent=displayed(c,shown);td.title=td.textContent;
        if(formula(original)||!label||!editable()){td.className='editor-readonly';td.title=formula(original)?String(original):'Read only';}
        else {td.tabIndex=0;td.setAttribute('aria-label',`${column(c)}${row}: ${label}`);const edit=()=>{if(working)return;selection={row,c,id,original};$('sheetCellTitle').textContent=`${column(c)}${row} · ${label}`;$('sheetCellValue').type=isDate(c,original)?'date':'text';$('sheetCellValue').value=displayed(c,shown);$('sheetCellDialog').showModal();$('sheetCellValue').focus();};td.onclick=edit;td.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();edit();}};}
        if(change)td.classList.add('editor-changed');tr.append(td);
      });table.tBodies[0].append(tr);
    });
    $('sheetFilterCount').textContent=`${visible} / ${snapshot.rows.length}`;
    if(!visible){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=snapshot.headers.length+1;td.textContent=UIText.t('No matching rows.');tr.append(td);table.tBodies[0].append(tr);}
    controls();
  }
  $('sheetCellForm').onsubmit=e=>{
    e.preventDefault();if(!editable()){$('sheetCellDialog').close();return;}const {row,c,id,original}=selection;const input=$('sheetCellValue').value;let after=input;
    if((isDate(c,original)||(/date|nbd|eta|etd/i.test(snapshot.headers[c])&&/^\d{4}-\d{2}-\d{2}$/.test(input)))&&input){const parsed=Date.parse(input+'T00:00:00Z');if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==input){alert(UIText.t('Enter a valid date in YYYY-MM-DD format.'));return;}after=(parsed-Date.UTC(1899,11,30))/86400000;}
    else if(typeof original==='number'&&input.trim()){after=Number(input);if(!Number.isFinite(after)){alert(UIText.t('Enter a valid number.'));return;}}
    else if(typeof original==='boolean'&&input!==''){if(!/^(true|false)$/i.test(input)){alert(UIText.t('Enter true or false.'));return;}after=input.toLowerCase()==='true';}
    else if(/qty|quantity/i.test(snapshot.headers[c])&&input.trim()){after=Number(input);if(!Number.isFinite(after)){alert(UIText.t('Enter a valid number.'));return;}}
    if(/^(project|spec|s\.?no|machine\/equipment name)$/i.test(String(snapshot.headers[c]).trim())&&!String(after).trim()){alert(UIText.t('This identifying field cannot be empty.'));return;}
    if(after===original)changes.delete(id);else changes.set(id,{row,c,before:original,after});
    $('sheetCellDialog').close();render();
  };
  $('sheetCellCancel').onclick=()=>$('sheetCellDialog').close();
  $('sheetSearch').oninput=render;$('sheetReload').onclick=load;
  document.querySelectorAll('#sheetStatusFilters button').forEach(button=>button.onclick=()=>{statusFilter=button.dataset.filter;render();});
  $('sheetDiscard').onclick=()=>{if(confirm(UIText.t('Discard unsaved changes?'))){changes.clear();render();}};
  $('sheetReview').onclick=()=>{
    $('sheetReviewRows').replaceChildren();$('sheetReviewSource').textContent=configs[active].tab;
    changes.forEach(change=>{const tr=document.createElement('tr');[`${column(change.c)}${change.row}`,snapshot.headers[change.c],displayed(change.c,change.before),displayed(change.c,change.after)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});$('sheetReviewRows').append(tr);});
    $('sheetSaveMessage').textContent='';$('sheetReviewDialog').showModal();
  };
  $('sheetReviewCancel').onclick=()=>$('sheetReviewDialog').close();
  $('sheetReviewDialog').addEventListener('cancel',e=>{if(working)e.preventDefault();});
  $('sheetSave').onclick=async()=>{
    if(working||!changes.size)return;
    working=true;controls();$('sheetSave').disabled=true;$('sheetReviewCancel').disabled=true;
    let sent=false,committed=false;
    try{
      $('sheetSaveMessage').textContent='Checking Google permissions and current data…';
      await SheetConnection.authorizeEdit(configs[active].id);
      const cfg=configs[active],latest=await readSource(cfg);
      const normalized=row=>JSON.stringify(Array.from({length:snapshot.headers.length},(_,c)=>value(row?.[c])));
      if(JSON.stringify(latest.raw[0])!==JSON.stringify(snapshot.headers))throw new Error('Sheet columns changed. Reload before editing again.');
      for(const row of new Set([...changes.values()].map(x=>x.row)))if(normalized(latest.raw[row-2])!==normalized(snapshot.raw[row-2]))throw new Error('A source row changed. Reload and review your changes before saving.');
      const data=[...changes.values()].map(x=>({range:`'${cfg.tab}'!${column(x.c)}${x.row}`,values:[[x.after]]}));
      sent=true;await SheetConnection.write(cfg.id,data);committed=true;changes.clear();
      const updated=await readSource(cfg);snapshot={...updated,headers:updated.raw[0],rows:cfg.parse(updated.values).map(x=>x._sourceRow)};
      render();$('sheetReviewDialog').close();$('sheetEditorMessage').textContent='Saved to Google Sheet.';await SheetConnection.refresh();
    }catch(e){
      $('sheetSaveMessage').textContent=committed?'Saved, but refresh failed. Reload the sheet to verify.':sent?'Save result uncertain. Check Google Sheet and reload before retrying.':e.message;
      if(sent){changes.clear();snapshot=null;render();}
    }finally{working=false;$('sheetSave').disabled=false;$('sheetReviewCancel').disabled=false;controls();}
  };
  window.SheetEditor={reset(){snapshot=null;changes.clear();$('sheetCellDialog').close();$('sheetReviewDialog').close();render();controls();},canLeave(){if(working)return false;if(changes.size&&!confirm(UIText.t('Discard unsaved changes?')))return false;changes.clear();controls();return true;},open(page){
    active=page;statusFilter='all';snapshot=null;changes.clear();$('sheetSearch').value='';$('sheetEditorTitle').textContent=page==='import'?'Import':'Manufacture';
    const cfg=configs[page];$('sheetEditorSource').textContent=cfg.tab;$('sheetOriginalLink').href=`https://docs.google.com/spreadsheets/d/${cfg.id}/edit#gid=${cfg.gid}`;
    render();load();
  }};
  window.addEventListener('beforeunload',e=>{if(changes.size||working){e.preventDefault();e.returnValue='';}});
  document.addEventListener('googleaccesschange',()=>{if(!working)render();controls();});
})();
