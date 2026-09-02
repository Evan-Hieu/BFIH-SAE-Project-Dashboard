const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const flush=()=>new Promise(setImmediate);
function harness(){
 const els=new Map(),listeners={},loaded={tno:[],mfg:[]},calls=[];
 let poll,hold=false,release;
 const element=()=>({textContent:'',append(){},replaceChildren(){}});
 const get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
 const auth={accountOnly:true,enabled:true,user:{id:'viewer',email:'different@example.com'},ready:Promise.resolve(),api:async(path,body,method)=>{
  calls.push({path,body,method});if(hold)await new Promise(r=>release=r);
  return {values:[['Header'],['Shared data']],syncedAt:'2026-08-31T10:00:00Z'};
 }};
 const context={WebAuth:auth,document:{getElementById:get,createElement:element,addEventListener:(n,f)=>(listeners[n]??=[]).push(f),dispatchEvent:e=>(listeners[e.type]||[]).forEach(f=>f()),body:{classList:{contains:()=>true}}},Event,
 SaeSource:{SHEET_ID:'tno',mapRows:x=>x},ManufactureSource:{SHEET_ID:'mfg',mapRows:x=>x},loadSaeItems:x=>loaded.tno=x,loadManufactureItems:x=>loaded.mfg=x,
 SheetEditor:{reset(){}},UIText:{t:x=>x},setInterval:(fn,ms)=>{assert.equal(ms,10000);poll=fn;return 1;},clearInterval(){},fetch(){throw Error('No Google OAuth or direct requests should be needed');}};
 context.window=context;vm.runInNewContext(fs.readFileSync('sheets-sync.js','utf8'),context);
 return {context,auth,loaded,calls,get,poll:()=>poll(),hold:()=>hold=true,release:()=>release()};
}
(async()=>{
 const t=harness();await flush();await flush();
 assert.equal(t.calls.length,2);assert(t.calls.every(c=>c.path==='dashboard/read'&&c.method==='GET'));
 assert.equal(t.loaded.tno[1][0],'Shared data');assert.equal(t.loaded.mfg[1][0],'Shared data');
 assert.equal(t.context.SheetConnection.identity(),null);
 t.poll();await flush();assert.equal(t.calls.length,4);
 t.hold();const inFlight=t.context.SheetConnection.refresh();await flush();
 t.context.SheetConnection.disconnect();t.auth.user=null;t.release();await inFlight;
 assert.equal(t.loaded.tno.length,0);assert.equal(t.loaded.mfg.length,0);
 console.log('PASS automatic viewer data, no Google account, periodic refresh and no late data after logout.');
})().catch(e=>{console.error(e);process.exitCode=1;});
