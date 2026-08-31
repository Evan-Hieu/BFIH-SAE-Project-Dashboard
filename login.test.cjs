const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function scenario(failure,blocked=false){
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false,focus(){},classList:{add(){},remove(){}}});return elements.get(id);};
 let signedIn=true,disconnects=0,calls=0,finish;
 const pending=new Promise((resolve,reject)=>finish=()=>failure?reject(Error('Expired session')):resolve());
 const context={document:{getElementById:el,querySelector:el,querySelectorAll:()=>[],body:{classList:{add(){signedIn=true;},remove(){signedIn=false;}}}},
 WebAuth:{enabled:true,user:null,ready:Promise.resolve(),logout(){calls++;return pending;}},
 SheetEditor:{canLeave:()=>!blocked},SheetConnection:{disconnect(){disconnects++;}},sessionStorage:{removeItem(){throw Error('Storage blocked');}},UIText:{t:x=>x,set(){}},Event,alert(){}};
 context.window=context;context.dispatchEvent=()=>{};
 vm.runInNewContext(fs.readFileSync('login.js','utf8'),context);await Promise.resolve();
 const run=el('.logout').onclick({preventDefault(){}});
 if(blocked){await run;assert.equal(signedIn,true);assert.equal(calls,0);return;}
 assert.equal(signedIn,false);assert.equal(disconnects,1);assert.equal(el('#loginForm button[type="submit"]').disabled,true);
 finish();await run;assert.equal(el('#loginForm button[type="submit"]').disabled,false);
 assert.equal(signedIn,false);assert.equal(calls,1);
 assert.equal(el('loginError').textContent.includes('could not confirm'),failure);
}
(async()=>{await scenario(false);await scenario(true);await scenario(false,true);console.log('PASS immediate logout, failed/expired server session, blocked storage, and unsaved-edit guard.');})().catch(e=>{console.error(e);process.exitCode=1;});
