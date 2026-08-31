(() => {
 const key='bfih-sae-demo-session',password=document.getElementById('loginPassword'),error=document.getElementById('loginError');
 function show(){document.body.classList.add('signed-in');password.value='';error.textContent='';const badge=document.querySelector('.signed-user');badge.textContent=WebAuth.user?.name||'Admin (demo)';badge.title=WebAuth.user?.username||'Local preview';window.dispatchEvent(new Event('resize'));}
 WebAuth.ready.then(()=>{
  document.getElementById('loginDisclaimer').textContent=WebAuth.enabled?'Sign in with the username and password created by your administrator. Connect Google Sheet separately after signing in.':'Shared account server is not configured. Admin/admin opens the local preview only; it does not create shared accounts or grant edit permission.';
  if(WebAuth.user)show();else if(!WebAuth.enabled){try{if(sessionStorage.getItem(key)==='Admin')show();}catch{}}
 });
 document.getElementById('loginForm').onsubmit=async event=>{
  event.preventDefault();const button=event.submitter;button.disabled=true;
  try{await WebAuth.ready;const username=document.getElementById('loginUser').value.trim();if(WebAuth.enabled){await WebAuth.login(username,password.value);}else{if(username.toLowerCase()!=='admin'||password.value!=='admin')throw Error('Shared account server is not configured.');try{sessionStorage.setItem(key,'Admin');}catch{}}show();}catch(e){error.textContent=UIText.t(e.message);password.value='';}finally{button.disabled=false;}
 };
 document.querySelector('.logout').onclick=async event=>{event.preventDefault();if(!window.SheetEditor.canLeave())return;try{await WebAuth.logout();sessionStorage.removeItem(key);location.reload();}catch(e){error.textContent=e.message;}};
 document.getElementById('loginEn').onclick=()=>UIText.set('en');document.getElementById('loginZh').onclick=()=>UIText.set('zh');
})();
