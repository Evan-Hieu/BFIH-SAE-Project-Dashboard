(() => {
  const readScope='https://www.googleapis.com/auth/spreadsheets.readonly';
  const editScope='https://www.googleapis.com/auth/spreadsheets';
  const metadataScope='https://www.googleapis.com/auth/drive.metadata.readonly';
  const identityScope='https://www.googleapis.com/auth/userinfo.email';
  const refreshInterval=60000;
  let session=null,rights=new Map(),timer=null,epoch=0,authBusy=false,refreshBusy=false;
  let sharedRefresh=null;
  const sharedMode=()=>!!window.WebAuth?.accountOnly;
  const sourceKey=id=>id===SaeSource.SHEET_ID?'import':id===ManufactureSource.SHEET_ID?'manufacture':null;
  async function readShared(id){
    const source=sourceKey(id),version=epoch,actor=WebAuth.user?.id;
    if(!source||!actor)throw new Error('Sign in to view status.');
    const result=await WebAuth.api('dashboard/read',{source},'GET');
    if(epoch!==version||WebAuth.user?.id!==actor)throw new Error('Website session changed.');
    if(!Array.isArray(result?.values))throw new Error('Status data could not be loaded.');
    return result;
  }
  async function refreshShared(){
    if(sharedRefresh||!WebAuth.user)return;
    const marker={},version=epoch;sharedRefresh=marker;
    try{for(const source of sources()){
      if(version!==epoch)return;
      try{
        const data=await readShared(source.id);
        source.load(source.parse(data.values));
        document.getElementById(source.status).textContent=source.name+' · Synced '+new Date(data.syncedAt).toLocaleTimeString();
      }catch(e){if(version!==epoch)return;document.getElementById(source.status).textContent=e.message+' · retrying automatically';}
    }}finally{if(sharedRefresh===marker)sharedRefresh=null;}
  }
  const sources=()=>[
    {id:SaeSource.SHEET_ID,range:"'SAE'!A2:AZ",parse:SaeSource.mapRows,load:window.loadSaeItems,status:'syncStatus',name:'TNO'},
    {id:ManufactureSource.SHEET_ID,range:"'SAE Summary Data'!A2:CN",parse:ManufactureSource.mapRows,load:window.loadManufactureItems,status:'mfgSyncStatus',name:'Inhouse'}
  ];
  const valid=()=>session&&Date.now()<session.expiresAt;
  const status=message=>['syncStatus','mfgSyncStatus','googleAccessMessage'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=message;});
  const emit=()=>document.dispatchEvent(new Event('googleaccesschange'));
  function assertSession(s){if(!s||s!==session||Date.now()>=s.expiresAt)throw new Error('Session expired — reconnect Google Sheet');}
  async function request(url,s,options={}){
    assertSession(s);
    if(window.WebAuth?.enabled&&!WebAuth.accountOnly)return WebAuth.api('google/request',{url,method:options.method||'GET',...(options.body?{body:JSON.parse(options.body)}:{})});
    const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(20000)});
    assertSession(s);
    if(!response.ok){const error=new Error(response.status===403?'Google denied access. Check file sharing or protected ranges.':`Google API error (${response.status})`);error.status=response.status;throw error;}
    return response.json();
  }
  async function profile(token){
    const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Cannot verify Google account.');
    const user=await response.json();if(!user.sub||!user.email||user.email_verified!==true)throw new Error('Cannot verify Google account.');return {sub:user.sub,email:user.email};
  }
  function authorize(edit=false,choose=false){
    if(authBusy)return Promise.reject(new Error('Google sign-in is already in progress.'));
    if(!window.google?.accounts?.oauth2)return Promise.reject(new Error('Google sign-in unavailable — reload and retry'));
    if(!window.SAE_GOOGLE_CLIENT_ID)return Promise.reject(new Error('Google Sheets setup required — OAuth client ID missing'));
    const old=session,version=epoch;authBusy=true;
    return new Promise((resolve,reject)=>{
      let settled=false;const finish=(error,user)=>{if(settled)return;settled=true;authBusy=false;error?reject(error):resolve(user);};
      const scopes=[edit?editScope:readScope,metadataScope,identityScope];
      const client=google.accounts.oauth2.initTokenClient({client_id:window.SAE_GOOGLE_CLIENT_ID,scope:scopes.join(' '),include_granted_scopes:false,prompt:choose?'select_account':'',...(old&&!choose?{login_hint:old.user.sub}:{}),
        callback:async response=>{try{
          if(response.error||!response.access_token||!google.accounts.oauth2.hasGrantedAllScopes(response,...scopes))throw new Error('Required Google permissions were not granted.');
          const user=await profile(response.access_token);
          if(version!==epoch)throw new Error('Google session changed. Reconnect before continuing.');
          if(old&&user.sub!==old.user.sub)throw new Error('A different Google account was selected. Use Switch account first.');
          if(WebAuth.enabled){if(user.email.toLowerCase()!==WebAuth.user?.email.toLowerCase())throw new Error('Google email must match the email configured for this website user.');if(!WebAuth.accountOnly)await WebAuth.api('google/connect',{accessToken:response.access_token});}
          session={token:response.access_token,user,edit,expiresAt:Date.now()+Number(response.expires_in)*1000-60000};
          emit();finish(null,user);
        }catch(e){finish(e);}},error_callback:()=>finish(new Error('Google sign-in cancelled or popup blocked — retry Google Sheet'))});
      try{client.requestAccessToken();}catch(e){finish(e);}
    });
  }
  async function checkAccess(id){
    if(!sources().some(s=>s.id===id))throw new Error('Unknown sheet source.');
    const s=session;
    try{
      const file=await request('https://www.googleapis.com/drive/v3/files/'+id+'?fields=id,capabilities(canEdit,canComment)&supportsAllDrives=true',s);
      const caps=file.capabilities||{},access={level:caps.canEdit===true?'Edit':caps.canComment===true?'Comment':'View',canEdit:caps.canEdit===true};rights.set(id,access);emit();return access;
    }catch(e){if(s===session){rights.set(id,{level:e.status===404?'No access':'Unverified',canEdit:false});emit();}throw e;}
  }
  async function refresh(){
    if(sharedMode()){
      if(valid())await Promise.allSettled(sources().map(source=>checkAccess(source.id)));
      return refreshShared();
    }
    if(refreshBusy===session)return;
    if(!valid()){rights.clear();emit();status('Session expired — reconnect Google Sheet');return;}
    const s=session;refreshBusy=s;
    try{await Promise.allSettled(sources().map(async source=>{
      try{await checkAccess(source.id);}catch(e){if(s!==session)return;document.getElementById('googleAccessMessage').textContent='Cannot verify edit rights. Enable Google Drive API and reconnect with metadata permission.';}
      try{
        const payload=await request('https://sheets.googleapis.com/v4/spreadsheets/'+source.id+'/values/'+encodeURIComponent(source.range)+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER',s);
        source.load(source.parse(payload.values));document.getElementById(source.status).textContent=`${source.name} · Synced ${new Date().toLocaleTimeString()}`;
      }catch(e){if(s!==session)return;document.getElementById(source.status).textContent=e.message+' · retrying automatically';}
    }));}finally{if(refreshBusy===s)refreshBusy=false;}
  }
  function clear(){epoch++;session=null;sharedRefresh=null;rights.clear();clearInterval(timer);timer=null;window.SheetEditor?.reset();sources().forEach(s=>s.load([]));emit();}
  function startRefreshTimer(refreshNow){clearInterval(timer);timer=setInterval(()=>{if(!document.hidden)refreshNow();},refreshInterval);}
  function refreshWhenVisible(){
    if(document.hidden)return;
    if(sharedMode()){if(WebAuth.user)refreshShared();}
    else if(valid())refresh();
  }
  async function connect(choose=false){
    if(authBusy)return;
    if(!document.body.classList.contains('signed-in')){status('Sign in to the website first.');return;}
    if(choose){if(!window.SheetEditor?.canLeave())return;clear();}
    try{
      status('Connecting Google account…');
      if(!valid())await authorize(false,choose);
      document.dispatchEvent(new Event('googleconnected'));
      await refresh();startRefreshTimer(refresh);
    }catch(e){status(e.message);const el=document.getElementById('googleLoginMessage');if(el)el.textContent=e.message;}
  }
  window.SheetConnection={
    connect,refresh,checkAccess,disconnect:clear,readShared,sharedMode,
    identity:()=>session?{...session.user}:null,
    access:id=>valid()?{...(rights.get(id)||{level:'Unverified',canEdit:false})}:{level:'Not connected',canEdit:false},
    read:path=>request('https://sheets.googleapis.com/v4/spreadsheets/'+path,session),
    authorizeEdit:async id=>{
      const area=id===SaeSource.SHEET_ID?'Import':'Manufacture';if(!WebAuth.enabled||!WebAuth.can(area,true))throw new Error('Website Edit permission is required.');
      if(!session)throw new Error('Session expired — reconnect Google Sheet');
      if(!session.edit||!valid())await authorize(true);
      const access=await checkAccess(id);if(!access.canEdit)throw new Error('This Google account has no Editor permission for this sheet.');
    },
    write:async(id,data)=>{
      const area=id===SaeSource.SHEET_ID?'Import':'Manufacture';if(!WebAuth.enabled||!WebAuth.can(area,true))throw new Error('Website Edit permission is required.');
      const s=session;assertSession(s);if(!s.edit)throw new Error('Edit permission was not granted.');
      const access=await checkAccess(id);assertSession(s);if(!access.canEdit)throw new Error('This Google account has no Editor permission for this sheet.');
      return request('https://sheets.googleapis.com/v4/spreadsheets/'+id+'/values:batchUpdate',s,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data})});
    }
  };
  function renderAccess(){
    const user=window.SheetConnection.identity();
    // Google identity is separate from the username used to sign in to the website.
    document.getElementById('googleAccountEmail').textContent=user?user.email:sharedMode()&&WebAuth.user?'Shared status loads automatically. Google connection is only needed for editing.':UIText.t('Not connected');
    document.getElementById('googleAccessRows').replaceChildren();
    sources().forEach(source=>{const tr=document.createElement('tr'),access=window.SheetConnection.access(source.id);[source.name,UIText.t(access.level)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});const td=document.createElement('td'),a=document.createElement('a');a.href='https://docs.google.com/spreadsheets/d/'+source.id+'/edit';a.target='_blank';a.rel='noopener';a.textContent=UIText.t('Open Google Sheet');td.append(a);tr.append(td);document.getElementById('googleAccessRows').append(tr);});
  }
  document.addEventListener('googleaccesschange',renderAccess);document.addEventListener('languagechange',renderAccess);
  function autoLoad(){
    if(!sharedMode())return;
    clear();if(!WebAuth.user)return;
    status('Loading shared status…');refreshShared();
    startRefreshTimer(refreshShared);
  }
  document.addEventListener('webauthchange',autoLoad);
  document.addEventListener('visibilitychange',refreshWhenVisible);
  WebAuth.ready?.then(autoLoad);
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('googleSheetLink').onclick=e=>{e.preventDefault();connect();};

    document.getElementById('googleSwitchAccount').onclick=()=>connect(true);
    document.getElementById('googleRecheckAccess').onclick=()=>connect();renderAccess();
  });
})();
