const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
async function run(){
 const requests=[],endpoint='https://script.google.com/macros/s/test-account-service/exec';
 const context={SAE_AUTH_ENDPOINT:endpoint,Set,Event,AbortSignal,document:{querySelectorAll:()=>[],dispatchEvent(){}},fetch:async(url,options)=>{
  requests.push({url,options});const req=JSON.parse(options.body);
  return {ok:true,json:async()=>({ok:true,data:req.path==='auth/login'?{sessionToken:'synthetic-session',user:{role:'admin',email:'test@example.com'}}:{}})};
 }};context.window=context;
 vm.runInNewContext(fs.readFileSync('auth.js','utf8'),context);
 await context.WebAuth.ready;
 assert.equal(context.WebAuth.enabled,true);assert.equal(context.WebAuth.accountOnly,true);
 await context.WebAuth.login('test-user','synthetic-password');
 await context.WebAuth.api('users');
 assert.equal(requests[0].url,endpoint);
 assert.equal(requests[0].options.credentials,'omit');
 assert.equal(JSON.parse(requests[1].options.body).sessionToken,'synthetic-session');
 assert(!requests[0].url.includes('synthetic-password'));
 await assert.rejects(()=>context.WebAuth.api('google/request',{}),/does not handle/);
 assert.equal(requests.length,2);
 await context.WebAuth.logout();assert.equal(context.WebAuth.user,null);
 context.fetch=async()=>{throw Error('Network failure');};
 await assert.rejects(()=>context.WebAuth.login('admin','admin'),/service unavailable/);
 assert.equal(context.WebAuth.enabled,true);assert.equal(context.WebAuth.user,null);
 console.log('PASS account-only transport, session forwarding, Google exclusion and no demo fallback on failure.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
