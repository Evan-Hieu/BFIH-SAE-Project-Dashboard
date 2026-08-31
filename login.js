(() => {
 const key='bfih-sae-demo-session',password=document.getElementById('loginPassword'),error=document.getElementById('loginError');
 function show(){['calendarView','usersView','sheetEditorView'].forEach(id=>document.getElementById(id).hidden=true);document.getElementById('dashboardView').hidden=false;document.querySelectorAll('.nav-link[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page==='dashboard'));document.body.classList.add('signed-in');password.value='';error.textContent='';const badge=document.querySelector('.signed-user');badge.textContent=WebAuth.user?.name||'Admin (demo)';badge.title=WebAuth.user?.username||'Local preview';window.dispatchEvent(new Event('resize'));}
 WebAuth.ready.then(()=>{
  document.getElementById('loginDisclaimer').textContent=WebAuth.enabled?'Sign in with the username and password created by your administrator. Project status loads automatically.':'Shared account server is not configured. Admin/admin opens the local preview only; it does not create shared accounts or grant edit permission.';
  if(WebAuth.user)show();else if(!WebAuth.enabled){try{if(sessionStorage.getItem(key)==='Admin')show();}catch{}}
 });
 document.getElementById('loginForm').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{await WebAuth.ready;const username=document.getElementById('loginUser').value.trim();if(WebAuth.enabled){await WebAuth.login(username,password.value);}else{if(username.toLowerCase()!=='admin'||password.value!=='admin')throw Error('Shared account server is not configured.');try{sessionStorage.setItem(key,'Admin');}catch{}}show();}catch(e){error.textContent=UIText.t(e.message);password.value='';}finally{button.disabled=false;}
 };
 let loggingOut=false;
 document.querySelector('.logout').onclick=async event=>{
  event.preventDefault();if(loggingOut)return;
  if(window.SheetEditor&&!SheetEditor.canLeave()){window.alert('Finish the current sheet operation or discard unsaved changes before signing out.');return;}
  loggingOut=true;
  const button=document.querySelector('#loginForm button[type="submit"]');button.disabled=true;
  document.body.classList.remove('signed-in');password.value='';error.textContent='Signing out…';
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  try{sessionStorage.removeItem(key);}catch{}
  try{window.SheetConnection?.disconnect();}catch{}
  try{await WebAuth.logout();error.textContent='';}
  catch{error.textContent='Signed out on this page. The server could not confirm session removal; sign in again if needed.';}
  finally{loggingOut=false;button.disabled=false;document.getElementById('loginUser').focus();}
 };
 document.getElementById('loginEn').onclick=()=>UIText.set('en');document.getElementById('loginZh').onclick=()=>UIText.set('zh');
})();
