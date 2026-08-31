(() => {
 let enabled=false,user=null,sessionToken=null,googleToken=null;
 const appsScript=!!(window.google?.script?.run);
 const endpoint=window.SAE_AUTH_ENDPOINT||'';
 const accountPaths=new Set(['auth/config','auth/login','auth/me','auth/logout','users']);
 async function api(path,body,method=body===undefined?'GET':'POST'){
  if(endpoint&&!appsScript){
   if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint))throw new Error('Invalid account service URL.');
   if(!accountPaths.has(path))throw new Error('Account service does not handle Google Sheet data.');
   let result;
   try{
    const response=await fetch(endpoint,{method:'POST',credentials:'omit',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({path,method,body:body??null,sessionToken}),signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw new Error();
    result=await response.json();
   }catch{throw new Error('Account service unavailable. Check deployment access and connection.');}
   if(!result?.ok)throw new Error(result?.error||'Request failed.');
   if(path==='auth/login')sessionToken=result.data.sessionToken;
   if(path==='auth/logout')sessionToken=null;
   return result.data;
  }
  if(appsScript){
   const result=await new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(()=>reject(new Error('Server request failed. Please retry.'))).saeApi({path,method,body:body??null,sessionToken,googleToken:path==='google/request'?googleToken:null}));
   if(!result?.ok)throw new Error(result?.error||'Request failed.');
   if(path==='auth/login')sessionToken=result.data.sessionToken;
   if(path==='google/connect')googleToken=body.accessToken;
   if(path==='auth/logout'){sessionToken=null;googleToken=null;}
   return result.data;
  }
  const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-SAE-Request':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Request failed.');return data;
 }
 const changed=()=>{document.querySelectorAll('[data-access-area]').forEach(link=>{link.hidden=enabled&&!!user&&!window.WebAuth.can(link.dataset.accessArea);});document.dispatchEvent(new Event('webauthchange'));};
 window.WebAuth={api,get enabled(){return enabled;},get accountOnly(){return !!endpoint&&!appsScript;},get user(){return user;},can(area,edit=false){return !!user&&(user.role==='admin'||(edit?user.permissions[area]==='Edit':['View','Comment','Edit'].includes(user.permissions[area])));},
  async login(username,password){if(!enabled)throw new Error('Shared account server is not configured.');user=(await api('auth/login',{username,password})).user;changed();return user;},
  async logout(){try{if(enabled)await api('auth/logout',{});}finally{user=null;sessionToken=null;googleToken=null;changed();}},
  ready:(async()=>{if(appsScript||endpoint){enabled=true;await Promise.resolve();changed();return;}try{const r=await fetch('/api/auth/config',{cache:'no-store'});if(r.ok&&(await r.json()).enabled){enabled=true;try{user=(await api('auth/me')).user;}catch{}}}catch{}changed();})()
 };
})();
