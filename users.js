(() => {
  'use strict';
  // Planning metadata only. Never use browser storage as an authorization boundary.
  const key='bfih-sae-users-draft-v1', $=id=>document.getElementById(id);
  const areas=['Dashboard','Import','Manufacture','Timeline','Alerts','Search','Calendar','Performance','Notifications','Google Sheet','Audit Log','Settings','User'];
  const levels=['No access','View','Comment','Edit'];
  const levelLabel=level=>level==='No access'?'No':level;
  const viewerAreas=['Dashboard','Import','Manufacture','Google Sheet'];
  let users=[], editing=null, writable=false, loaded=false;
  let loadState='idle',loadSequence=0,listOwner=null;
  areas.forEach((area,index)=>{
    const label=document.createElement('tr');const heading=document.createElement('th');heading.scope='row';heading.textContent=area;label.append(heading);
    const select=document.createElement('select');select.id=`userAccess${index}`;
    levels.forEach(level=>{const option=document.createElement('option');option.value=level;option.textContent=level;select.append(option);});
    select.hidden=true;heading.append(select);
    levels.forEach(level=>{const cell=document.createElement('td'),radio=document.createElement('input');radio.type='radio';radio.name=`permission${index}`;radio.value=level;radio.setAttribute('aria-label',`${area}: ${levelLabel(level)}`);radio.onchange=()=>select.value=level;cell.append(radio);label.append(cell);});
    $('userPermissions').append(label);
  });
  const headings=$('userTableHead');
  ['ID','Login ID','Name','Email','Department','Phone','Status','Access','Actions'].forEach(text=>{const th=document.createElement('th');th.textContent=text;headings.append(th);});
  let saving=false;
  async function persist(next){if(saving){$('userMessage').textContent='A save is already in progress. Please retry when it finishes.';return false;}saving=true;try{return await persistData(next);}finally{saving=false;}}
  async function persistData(next){
    if(!writable||!loaded){$('userMessage').textContent='Account management is not ready. Please sign in as Admin.';return false;}
    if(WebAuth.enabled){try{
      const removed=users.find(u=>!next.some(n=>n.id===u.id));
      if(removed){await WebAuth.api("users",{id:removed.id},"DELETE");users=users.filter(u=>u.id!==removed.id);}
      else {const changed=next.find(n=>!users.some(u=>u.id===n.id&&JSON.stringify(u)===JSON.stringify(n)));if(changed){const existing=users.some(u=>u.id===changed.id);const saved=(await WebAuth.api("users",{...changed,id:existing?changed.id:undefined},"PUT")).user;users=existing?users.map(u=>u.id===saved.id?saved:u):[...users,saved];}}
      return true;
    }catch(e){$("userMessage").textContent=e.message;return false;}}
    if(!writable)return false;
    try{localStorage.setItem(key,JSON.stringify(next));users=next;return true;}
    catch{$('userMessage').textContent='Could not save configuration. Check browser storage permissions or available space.';return false;}
  }
  function openForm(user){
    if(!writable||!loaded)return;
    editing=user?.id||null;$('userForm').reset();$('userFormMessage').textContent='';
    $('userDialogTitle').textContent=user?'Edit user':'Add user';
    $('userName').value=user?.name||'';$('userEmail').value=user?.email||'';$('userStatus').value=user?.status||'Active';$('userStatus').disabled=user?.role==='admin';$('userEmail').readOnly=user?.role==='admin';
    $('userId').value=user?.id||'Auto';$('userLoginId').value=user?.username||'';$('userNewPassword').value='';$('userNewPassword').disabled=!WebAuth.enabled;$('userLoginId').required=WebAuth.enabled;$('userNewPassword').required=WebAuth.enabled&&!user;
    ['Department','Phone','Notes'].forEach(field=>$(`user${field}`).value=user?.[field.toLowerCase()]||'');
    areas.forEach((area,index)=>{const level=user?.permissions[area]||(viewerAreas.includes(area)?'View':'No access');$(`userAccess${index}`).value=level;document.querySelectorAll(`input[name="permission${index}"]`).forEach(radio=>radio.checked=radio.value===level);});
    $('userDialog').showModal();$('userName').focus();
  }
  function render(){
    const query=$('userSearch').value.trim().toLowerCase();
    const matching=users.filter(u=>`${u.id} ${u.username||''} ${u.name} ${u.email} ${u.department||''}`.toLowerCase().includes(query));
    $('userRows').replaceChildren();
    if(!matching.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=9;cell.className='empty';cell.textContent=users.length?'No matching users.':loadState==='loading'?'Loading accounts…':loadState==='error'?'Could not load accounts. Click Refresh users to try again.':loadState==='denied'?'Sign in as Admin to manage accounts.':loadState==='unavailable'?'Shared account service is not connected.':'Checking account access…';row.append(cell);$('userRows').append(row);}
    matching.forEach(user=>{
      const row=document.createElement('tr');
      [user.id,user.username||'—',user.name,user.email,user.department||'—',user.phone||'—'].forEach(value=>{const cell=document.createElement('td');cell.textContent=value;row.append(cell);});
      const inline=(label,options,current,update)=>{
        const cell=document.createElement('td'),select=document.createElement('select');select.disabled=!writable||(WebAuth.enabled&&user.role==='admin');select.setAttribute('aria-label',`${user.email}: ${UIText.t(label)}`);
        options.forEach(v=>{const option=document.createElement('option');option.value=v;option.textContent=UIText.t(levelLabel(v));select.append(option);});select.value=current;select.dataset.level=current;
        select.onchange=async()=>{select.disabled=true;const latest=users.find(u=>u.id===user.id),next=update(latest,select.value);if(await persist(users.map(u=>u.id===user.id?next:u))){select.dataset.level=select.value;$('userMessage').textContent=WebAuth.enabled?'Account saved on the server.':'Draft saved in this browser. Access restrictions are not active yet.';}else select.value=select.dataset.level;select.disabled=!writable;};cell.append(select);row.append(cell);
      };
      inline('Status',['Active','Inactive'],user.status,(u,status)=>({...u,status}));
      const access=document.createElement('td');access.className='user-access-summary';const allowed=areas.filter(area=>user.permissions[area]!=='No access');access.textContent=user.role==='admin'?'Administrator':!allowed.length?'No access':allowed.every(area=>user.permissions[area]==='View')?'Viewer · '+allowed.join(', '):allowed.map(area=>area+': '+user.permissions[area]).join(' · ');row.append(access);
      const actions=document.createElement('td');actions.className='user-row-actions';
      const edit=document.createElement('button');edit.className='btn secondary';edit.textContent='Edit';edit.onclick=()=>openForm(users.find(u=>u.id===user.id));
      const remove=document.createElement('button');remove.className='btn secondary user-delete';remove.textContent='Delete';remove.onclick=async()=>{
        if(confirm(WebAuth.enabled?`Delete the website account for ${user.name}? Their website access will be revoked.`:UIText.locale()==='zh-TW'?`確定刪除 ${user.name} 的草稿？`:`Delete the draft for ${user.name}?`) && await persist(users.filter(u=>u.id!==user.id))){render();$('userMessage').textContent=WebAuth.enabled?'Website account deleted. Google sharing was not changed.':'User draft deleted. No account or external access was changed.';}
      };
      edit.disabled=!writable;remove.disabled=!writable||(WebAuth.enabled&&user.role==='admin');actions.append(edit,remove);row.append(actions);$('userRows').append(row);
    });
  }
  $('userViewerPreset').onclick=()=>{areas.forEach((area,index)=>{const level=viewerAreas.includes(area)?'View':'No access';$(`userAccess${index}`).value=level;document.querySelectorAll(`input[name="permission${index}"]`).forEach(r=>r.checked=r.value===level);});};
  $('userCopyLink').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname);$('userMessage').textContent='Website link copied. Share it with the user separately from their password.';}catch{$('userMessage').textContent=location.origin+location.pathname;}};
  $('userReload').onclick=loadAccounts;
  $('userAdd').onclick=()=>openForm();$('userSearch').oninput=render;
  ['userClose','userCancel'].forEach(id=>$(id).onclick=()=>$('userDialog').close());
  $('userForm').onsubmit=async event=>{
    event.preventDefault();const name=$('userName').value.trim(), email=$('userEmail').value.trim().toLowerCase();
    if(!name){$('userFormMessage').textContent='Enter a name.';return;}
    if(users.some(u=>u.id!==editing&&u.email.toLowerCase()===email)){$('userFormMessage').textContent='This email already exists. Edit the existing user instead.';return;}
    const number=users.reduce((max,u)=>Math.max(max,Number(u.id.replace('USR-',''))||0),0)+1;
    const user={id:editing||`USR-${String(number).padStart(3,'0')}`,name,email,status:$('userStatus').value,permissions:Object.fromEntries(areas.map((area,index)=>[area,$(`userAccess${index}`).value]))};
    ['Department','Phone','Notes'].forEach(field=>user[field.toLowerCase()]=$(`user${field}`).value.trim());
    user.username=$('userLoginId').value.trim().toLowerCase();if(WebAuth.enabled&&!/^[a-z0-9._-]{3,64}$/.test(user.username)){$('userFormMessage').textContent='Login ID must contain 3–64 letters, numbers, dots, underscores or hyphens.';return;}if(user.username&&users.some(u=>u.id!==editing&&u.username?.toLowerCase()===user.username)){$('userFormMessage').textContent='This Login ID already exists.';return;}if(WebAuth.enabled&&$('userNewPassword').value)user.password=$('userNewPassword').value;
    $('userSave').disabled=true;
    if(await persist(editing?users.map(u=>u.id===editing?user:u):[...users,user])){$('userDialog').close();render();$('userMessage').textContent=WebAuth.enabled?'Account saved on the server. If you changed your own password or email, sign in again.':'Draft saved in this browser. Access restrictions are not active yet.';}
    else $('userFormMessage').textContent=$('userMessage').textContent||'Could not save. Your entries are still here; check browser storage.';
    $('userSave').disabled=false;$('userNewPassword').value='';
  };
  async function loadAccounts(){
    const sequence=++loadSequence,actor=WebAuth.user;
    loaded=false;writable=false;$('userAdd').disabled=true;$('userReload').disabled=false;
    if(listOwner!==actor?.id){users=[];listOwner=actor?.id||null;}
    if(!WebAuth.enabled){loadState='unavailable';$('userMessage').textContent='Shared account service is not connected. Accounts cannot be created for other devices yet.';render();return;}
    $('userSave').textContent='Save account';
    document.querySelector('#usersView .users-draft').textContent='Shared accounts';
    document.querySelector('#usersView .users-legend').textContent='View: read only · Comment: read only (comments not implemented) · Edit: edit supported data · No access: area hidden. Account management is administrator-only.';
    document.querySelector('#usersView > .users-notice').textContent='Create an account here, then share the website link and login details. Status loads automatically after sign-in according to each user’s website permissions. Google connection is only needed for direct Sheet access or editing.';
    document.querySelector('#userDialog .users-notice').textContent='Create a website login. Viewing status does not require Google sign-in. For editing, connect the Google email configured here.';
    if(actor?.role!=='admin'){users=[];loadState='denied';$('userMessage').textContent='Sign in as Admin to manage accounts.';render();return;}
    // The current account came from the authenticated login response, not local drafts.
    if(!users.length)users=[actor];
    loadState='loading';$('userMessage').textContent='Loading accounts…';$('userReload').disabled=true;render();
    try{
      const result=await WebAuth.api('users');
      if(sequence!==loadSequence)return;
      if(!Array.isArray(result?.users)||!result.users.some(u=>u.id===actor.id)||result.users.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||typeof u.email!=='string'||!u.permissions))throw new Error('Account list could not be verified. Please refresh users.');
      users=result.users;loaded=true;writable=true;loadState='ready';$('userMessage').textContent='Accounts loaded.';
    }catch(e){if(sequence!==loadSequence)return;loadState='error';$('userMessage').textContent=e.message+' Click Refresh users to try again. If your session expired, sign in again.';}
    if(sequence!==loadSequence)return;
    $('userAdd').disabled=!writable||!loaded;$('userReload').disabled=false;render();
  }
  WebAuth.ready.then(loadAccounts);document.addEventListener('webauthchange',loadAccounts);
  document.addEventListener('languagechange',render);
  render();
})();
