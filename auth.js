(() => {
 let enabled=false,user=null;
 async function api(path,body,method=body===undefined?'GET':'POST'){
  const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-SAE-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;
 }
 const changed=()=>{document.querySelectorAll('[data-access-area]').forEach(link=>{link.hidden=enabled&&!!user&&!window.WebAuth.can(link.dataset.accessArea);});document.dispatchEvent(new Event('webauthchange'));};
 window.WebAuth={api,get enabled(){return enabled;},get user(){return user;},can(area,edit=false){return !!user&&(user.role==='admin'||(edit?user.permissions[area]==='Edit':['View','Comment','Edit'].includes(user.permissions[area])));},
  async login(username,password){if(!enabled)throw new Error('Shared account server is not configured.');user=(await api('auth/login',{username,password})).user;changed();return user;},
  async logout(){if(enabled)await api('auth/logout',{});user=null;changed();},
  ready:(async()=>{try{const r=await fetch('/api/auth/config',{cache:'no-store'});if(r.ok&&(await r.json()).enabled){enabled=true;try{user=(await api('auth/me')).user;}catch{}}}catch{}changed();})()
 };
})();
