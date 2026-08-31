import assert from 'node:assert/strict';
import {createApp,areas} from './app.mjs';
const origin='http://127.0.0.1:18788';let googleWrites=0,canEdit=true,formula=false;
const fakeGoogle=async(url,opts)=>{const token=opts.headers.Authorization.slice(7);let data={};if(url.includes('tokeninfo'))data={aud:'test-client',expires_in:3600,scope:'https://www.googleapis.com/auth/spreadsheets'};else if(url.includes('userinfo'))data={email:token==='alice'?'alice@example.com':'other@example.com',email_verified:true};else if(url.includes('/drive/'))data={capabilities:{canEdit,canComment:true}};else if(url.includes('values:batchGet'))data={valueRanges:[{values:[[formula?'=1+1':'old']]}]};else if(opts.method==='POST'){googleWrites++;data={updatedCells:1};}return {ok:true,json:async()=>data};};
const app=await createApp({origin,adminPassword:'test-only-admin-12345',adminEmail:'admin@example.com',clientId:'test-client',fetchGoogle:fakeGoogle});await new Promise(r=>app.server.listen(18788,'127.0.0.1',r));
async function call(path,body,cookie='',method=body===undefined?'GET':'POST',requestOrigin=origin){const res=await fetch(origin+'/api/'+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json','X-SAE-Request':'1',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
try{
 assert.equal((await call('users')).status,401);
 assert.equal((await call('auth/login',{username:'admin',password:'wrong'})).status,401);
 const admin=await call('auth/login',{username:'admin',password:'test-only-admin-12345'});assert.equal(admin.status,200);assert.match(admin.cookie,/sae_session=/);
 const permissions=Object.fromEntries(areas.map(a=>[a,a==='Import'?'Edit':a==='Manufacture'?'View':'No access']));
 const created=await call('users',{username:'hubert',name:'Hubert test',email:'alice@example.com',password:'test-only-user-12345',status:'Active',permissions},admin.cookie,'PUT');assert.equal(created.status,200);assert.equal(created.data.user.password,undefined);
 const login=await call('auth/login',{username:'hubert',password:'test-only-user-12345'});assert.equal(login.status,200);
 assert.equal((await call('users',undefined,login.cookie)).status,403);
 assert.equal((await call('google/connect',{accessToken:'other'},login.cookie)).status,403);
 assert.equal((await call('google/connect',{accessToken:'alice'},login.cookie)).status,200);
 const tno='1KHBzyi9vcIiqwzKOGVtJNZXC6rqULJYyyhvO69XoDuE',mfg='1VXRGCvQp37ppTEpMCmt_sSklmzbH3f2vSH7jkASehDU';
 const write=id=>({url:`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`,method:'POST',body:{valueInputOption:'RAW',data:[{range:"'SAE'!D5",values:[['new']]}]}});
 assert.equal((await call('google/request',write(mfg),login.cookie)).status,403);assert.equal(googleWrites,0);
 assert.equal((await call('google/request',write(tno),login.cookie)).status,200);assert.equal(googleWrites,1);
 canEdit=false;assert.equal((await call('google/request',write(tno),login.cookie)).status,403);canEdit=true;
 formula=true;assert.equal((await call('google/request',write(tno),login.cookie)).status,403);formula=false;assert.equal(googleWrites,1);
 assert.equal((await call('google/request',write(tno),login.cookie,'POST','https://evil.example')).status,403);
 await call('users',{...created.data.user,permissions:{...permissions,Import:'View'}},admin.cookie,'PUT');assert.equal((await call('google/request',write(tno),login.cookie)).status,403);assert.equal(googleWrites,1);
 await call('auth/logout',{},login.cookie);assert.equal((await call('auth/me',undefined,login.cookie)).status,401);
 console.log('PASS: password sign-in, admin-only users, email binding, both permission gates, live revocation, formula protection, CSRF and logout.');
}finally{app.close();}
