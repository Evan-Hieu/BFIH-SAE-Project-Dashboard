const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function harness(){
 const listeners={},els=new Map(),writes=[],state={user:'alice',denied:false,cap:{tno:true,inhouse:false},configs:[]};
 const element=()=>({textContent:'',setAttribute(){},replaceChildren(){},append(){}});
 const doc={getElementById:id=>{if(!els.has(id))els.set(id,element());return els.get(id);},querySelector:()=>element(),createElement:element,addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn),dispatchEvent:e=>(listeners[e.type]||[]).forEach(fn=>fn())};
 const context={document:doc,Event:class{constructor(type){this.type=type;}},Map,Date,Error,Number,Promise,AbortSignal,setInterval:()=>1,clearInterval(){},UIText:{t:x=>x},SAE_GOOGLE_CLIENT_ID:'test',SheetEditor:{canLeave:()=>true,reset(){}},SaeSource:{SHEET_ID:'tno',mapRows:x=>x},ManufactureSource:{SHEET_ID:'inhouse',mapRows:x=>x},loadSaeItems(){},loadManufactureItems(){}};
 context.window=context;
 context.google={accounts:{oauth2:{hasGrantedAllScopes:()=>!state.denyScopes,initTokenClient:config=>{state.configs.push(config);return {requestAccessToken(){config.callback({access_token:state.user,expires_in:3600});}};}}}};
 context.fetch=async(url,opt)=>{
  const token=opt.headers.Authorization.slice(7);
  if(url.includes('userinfo'))return{ok:true,json:async()=>({sub:token,email:token+'@example.com',email_verified:true})};
  if(url.includes('/drive/')){if(state.denied)return{ok:false,status:403};const id=url.includes('/tno?')?'tno':'inhouse';return{ok:true,json:async()=>({capabilities:{canEdit:state.cap[id],canComment:true}})};}
  if(opt.method==='POST')writes.push({url,token,body:JSON.parse(opt.body)});
  return {ok:true,json:async()=>({values:[]})};
 };
 vm.runInNewContext(fs.readFileSync('sheets-sync.js','utf8'),context);
 return{api:context.SheetConnection,state,writes};
}
(async()=>{
 const {api,state,writes}=harness();await api.connect();assert.equal(api.identity().email,'alice@example.com');assert.equal(api.access('tno').canEdit,true);assert.equal(api.access('inhouse').canEdit,false);
 await assert.rejects(()=>api.authorizeEdit('inhouse'),/no Editor/);assert.equal(writes.length,0);
 await api.authorizeEdit('tno');await api.write('tno',[{range:"'SAE'!D5",values:[[4]]}]);assert.equal(writes.length,1);assert.equal(writes[0].body.valueInputOption,'RAW');
 state.cap.tno=false;await assert.rejects(()=>api.write('tno',[]),/no Editor/);assert.equal(writes.length,1);
 state.denied=true;await assert.rejects(()=>api.write('tno',[]),/denied/);assert.equal(api.access('tno').canEdit,false);assert.equal(writes.length,1);
 await assert.rejects(()=>api.checkAccess('other-file'),/Unknown sheet/);
 const denied=harness();denied.state.denyScopes=true;await denied.api.connect();assert.equal(denied.api.identity(),null);assert.equal(denied.api.access('tno').canEdit,false);
 const b=harness();await b.api.connect();b.state.user='bob';await assert.rejects(()=>b.api.authorizeEdit('tno'),/different Google account/);assert.equal(b.api.identity().email,'alice@example.com');assert.equal(b.writes.length,0);
 await b.api.connect(true);assert.equal(b.api.identity().email,'bob@example.com');assert.equal(b.state.configs.at(-1).prompt,'select_account');
 console.log('Verified: per-file rights, Viewer denial, revoked rights, metadata failure, RAW write, account mismatch and explicit switching.');
})().catch(e=>{console.error(e);process.exitCode=1;});
