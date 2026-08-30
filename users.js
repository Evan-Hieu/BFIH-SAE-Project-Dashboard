(() => {
  'use strict';
  // Planning metadata only. Never use browser storage as an authorization boundary.
  const key='bfih-sae-users-draft-v1', $=id=>document.getElementById(id);
  const areas=['Dashboard','Import','Manufacture','Timeline','Alerts','Search','Calendar','Performance','Notifications','Google Sheet','Audit Log','Settings','User'];
  const levels=['No access','View','Comment','Edit'];
  const levelLabel=level=>level==='No access'?'No':level;
  let users=[], editing=null, writable=true;
  try {
    const data=JSON.parse(localStorage.getItem(key)||'[]');
    if(!Array.isArray(data)||data.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||typeof u.email!=='string'||!['Active','Inactive'].includes(u.status)||!u.permissions||areas.some(a=>!levels.includes(u.permissions[a]))))throw new Error('Invalid saved configuration');
    users=data;
  } catch {
    writable=false;
    $('userMessage').textContent='Cannot read existing configuration. Saving is disabled to protect it. Check browser storage settings.';
    $('userAdd').disabled=true;
  }
  areas.forEach((area,index)=>{
    const label=document.createElement('tr');const heading=document.createElement('th');heading.scope='row';heading.textContent=area;label.append(heading);
    const select=document.createElement('select');select.id=`userAccess${index}`;
    levels.forEach(level=>{const option=document.createElement('option');option.value=level;option.textContent=level;select.append(option);});
    select.hidden=true;heading.append(select);
    levels.forEach(level=>{const cell=document.createElement('td'),radio=document.createElement('input');radio.type='radio';radio.name=`permission${index}`;radio.value=level;radio.setAttribute('aria-label',`${area}: ${levelLabel(level)}`);radio.onchange=()=>select.value=level;cell.append(radio);label.append(cell);});
    $('userPermissions').append(label);
  });
  const headings=$('userTableHead');
  ['ID','Name','Email','Department','Phone','Status',...areas,'Actions'].forEach(text=>{const th=document.createElement('th');th.textContent=text;headings.append(th);});
  function persist(next){
    if(!writable)return false;
    try{localStorage.setItem(key,JSON.stringify(next));users=next;return true;}
    catch{$('userMessage').textContent='Could not save configuration. Check browser storage permissions or available space.';return false;}
  }
  function openForm(user){
    editing=user?.id||null;$('userForm').reset();$('userFormMessage').textContent='';
    $('userDialogTitle').textContent=user?'Edit user':'Add user';
    $('userName').value=user?.name||'';$('userEmail').value=user?.email||'';$('userStatus').value=user?.status||'Active';
    $('userId').value=user?.id||'Auto';
    ['Department','Phone','Notes'].forEach(field=>$(`user${field}`).value=user?.[field.toLowerCase()]||'');
    areas.forEach((area,index)=>{const level=user?.permissions[area]||'No access';$(`userAccess${index}`).value=level;document.querySelectorAll(`input[name="permission${index}"]`).forEach(radio=>radio.checked=radio.value===level);});
    $('userDialog').showModal();$('userName').focus();
  }
  function render(){
    const query=$('userSearch').value.trim().toLowerCase();
    const matching=users.filter(u=>`${u.id} ${u.name} ${u.email} ${u.department||''}`.toLowerCase().includes(query));
    $('userRows').replaceChildren();
    if(!matching.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=7+areas.length;cell.className='empty';cell.textContent=users.length?'No matching users.':'No users yet. Add a user to prepare their access.';row.append(cell);$('userRows').append(row);}
    matching.forEach(user=>{
      const row=document.createElement('tr');
      [user.id,user.name,user.email,user.department||'—',user.phone||'—'].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});
      const inline=(label,options,current,update)=>{
        const cell=document.createElement('td'),select=document.createElement('select');select.disabled=!writable;select.setAttribute('aria-label',`${user.email}: ${UIText.t(label)}`);
        options.forEach(v=>{const option=document.createElement('option');option.value=v;option.textContent=UIText.t(levelLabel(v));select.append(option);});select.value=current;select.dataset.level=current;
        select.onchange=()=>{const latest=users.find(u=>u.id===user.id),next=update(latest,select.value);if(persist(users.map(u=>u.id===user.id?next:u))){select.dataset.level=select.value;$('userMessage').textContent='Draft saved in this browser. Access restrictions are not active yet.';}else select.value=select.dataset.level;};cell.append(select);row.append(cell);
      };
      inline('Status',['Active','Inactive'],user.status,(u,status)=>({...u,status}));
      areas.forEach(area=>inline(area,levels,user.permissions[area],(u,level)=>({...u,permissions:{...u.permissions,[area]:level}})));
      const actions=document.createElement('td');actions.className='user-row-actions';
      const edit=document.createElement('button');edit.className='btn secondary';edit.textContent='Edit';edit.onclick=()=>openForm(users.find(u=>u.id===user.id));
      const remove=document.createElement('button');remove.className='btn secondary user-delete';remove.textContent='Delete';remove.onclick=()=>{
        if(confirm(UIText.locale()==='zh-TW'?`確定刪除 ${user.name} 的草稿？`:`Delete the draft for ${user.name}?`) && persist(users.filter(u=>u.id!==user.id))){render();$('userMessage').textContent='User draft deleted. No account or external access was changed.';}
      };
      edit.disabled=!writable;remove.disabled=!writable;actions.append(edit,remove);row.append(actions);$('userRows').append(row);
    });
  }
  $('userAdd').onclick=()=>openForm();$('userSearch').oninput=render;
  ['userClose','userCancel'].forEach(id=>$(id).onclick=()=>$('userDialog').close());
  $('userForm').onsubmit=event=>{
    event.preventDefault();const name=$('userName').value.trim(), email=$('userEmail').value.trim().toLowerCase();
    if(!name){$('userFormMessage').textContent='Enter a name.';return;}
    if(users.some(u=>u.id!==editing&&u.email.toLowerCase()===email)){$('userFormMessage').textContent='This email already exists. Edit the existing user instead.';return;}
    const number=users.reduce((max,u)=>Math.max(max,Number(u.id.replace('USR-',''))||0),0)+1;
    const user={id:editing||`USR-${String(number).padStart(3,'0')}`,name,email,status:$('userStatus').value,permissions:Object.fromEntries(areas.map((area,index)=>[area,$(`userAccess${index}`).value]))};
    ['Department','Phone','Notes'].forEach(field=>user[field.toLowerCase()]=$(`user${field}`).value.trim());
    if(persist(editing?users.map(u=>u.id===editing?user:u):[...users,user])){$('userDialog').close();render();$('userMessage').textContent='Draft saved in this browser. Access restrictions are not active yet.';}
    else $('userFormMessage').textContent='Could not save. Your entries are still here; check browser storage.';
  };
  document.addEventListener('languagechange',render);
  render();
})();
