(() => {
  'use strict';
  // Explicit demo credentials requested for preview. Not production authentication.
  const key='bfih-sae-demo-session';
  const form=document.getElementById('loginForm');
  const password=document.getElementById('loginPassword');
  const error=document.getElementById('loginError');
  function showDashboard(){
    document.body.classList.add('signed-in');
    password.value='';error.textContent='';
    document.querySelector('.nav-link[data-page="dashboard"]').focus();
    window.dispatchEvent(new Event('resize'));
  }
  try{if(sessionStorage.getItem(key)==='Admin')showDashboard();}catch{}
  document.addEventListener('googleconnected',()=>{try{sessionStorage.removeItem(key);}catch{}showDashboard();});
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(document.getElementById('loginUser').value!=='Admin'||password.value!=='admin'){
      error.textContent='Incorrect password. Please try again.';password.value='';password.focus();return;
    }
    try{sessionStorage.setItem(key,'Admin');}catch{}
    showDashboard();
  });
  document.querySelector('.logout').addEventListener('click',event=>{
    event.preventDefault();
    if(!window.SheetEditor.canLeave())return;
    try{sessionStorage.removeItem(key);}catch{}
    // Reload also discards in-memory Google OAuth tokens, sheet rows and sync timers.
    document.body.classList.remove('signed-in');
    window.location.reload();
  });
  document.getElementById('loginEn').onclick=()=>UIText.set('en');
  document.getElementById('loginZh').onclick=()=>UIText.set('zh');
})();
