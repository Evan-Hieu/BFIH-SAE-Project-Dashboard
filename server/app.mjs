import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {scrypt as derive,randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const scrypt=promisify(derive),digest=s=>createHash('sha256').update(s).digest('hex');
export const areas=['Dashboard','Import','Manufacture','Timeline','Alerts','Search','Calendar','Performance','Notifications','Google Sheet','Audit Log','Settings','User'];
const levels=['No access','View','Comment','Edit'];
const sources={
 import:{id:'1KHBzyi9vcIiqwzKOGVtJNZXC6rqULJYyyhvO69XoDuE',tab:'SAE',area:'Import'},
 manufacture:{id:'1VXRGCvQp37ppTEpMCmt_sSklmzbH3f2vSH7jkASehDU',tab:'SAE Summary Data',area:'Manufacture'}
};
const fault=(status,message)=>Object.assign(new Error(message),{status});
async function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(password,salt,64)).toString('hex');}
async function verify(password,stored){const [salt,hex]=stored.split(':');return timingSafeEqual(await scrypt(password,salt,64),Buffer.from(hex,'hex'));}
export async function createApp({dbPath=':memory:',origin,adminPassword,adminEmail,clientId,fetchGoogle=fetch,root=resolve(import.meta.dirname,'..')}){
 if(!origin||!clientId)throw Error('APP_ORIGIN and GOOGLE_CLIENT_ID are required.');
 const site=new URL(origin),secure=site.protocol==='https:';
 if(!secure&&!['localhost','127.0.0.1'].includes(site.hostname))throw Error('Public deployment requires HTTPS.');
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,email TEXT NOT NULL UNIQUE,record TEXT NOT NULL,password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);');
 if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
  if(!adminPassword||adminPassword.length<12||!/^\S+@\S+\.\S+$/.test(adminEmail||''))throw Error('First startup requires ADMIN_PASSWORD (12+ characters) and ADMIN_EMAIL.');
  const admin={id:randomUUID(),username:'admin',name:'Admin',email:adminEmail.toLowerCase(),status:'Active',role:'admin',permissions:Object.fromEntries(areas.map(a=>[a,'Edit']))};
  db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(admin.id,admin.username,admin.email,JSON.stringify(admin),await hashPassword(adminPassword));
 }
 const dummy=await hashPassword(randomBytes(32).toString('hex')),tokens=new Map(),attempts=new Map();
 function userSession(req){const raw=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('sae_session='))?.slice(12);if(!raw)return null;const sid=digest(raw),row=db.prepare('SELECT u.record,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=?').get(sid);if(!row||row.expires<Date.now())return null;const user=JSON.parse(row.record);return user.status==='Active'?{sid,user}:null;}
 const can=(user,area,write=false)=>user.role==='admin'||(write?user.permissions[area]==='Edit':levels.indexOf(user.permissions[area])>0);
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw fault(415,'JSON required.');let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>256000)throw fault(413,'Request too large.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fault(400,'Invalid JSON.');}}
 async function google(url,token,options={}){const r=await fetchGoogle(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw fault(r.status===401?401:403,'Google denied access. Check account, file sharing, API setup or protected ranges.');return r.json();}
 const safeFiles=new Set(['index.html','style.css','app.js','auth.js','i18n.js','users.js','login.js','calendar.js','sheet-editor.js','sheets-sync.js','sheet-source.js','manufacture-source.js','manufacture.js','google-config.js','assets/sae-icon.png']);
 const server=http.createServer(async(req,res)=>{try{
  if(req.headers.host!==site.host)throw fault(400,'Invalid host.');
  const url=new URL(req.url,origin),path=url.pathname;
  if(!path.startsWith('/api/')){const name=path==='/'?'index.html':path.slice(1);if(req.method!=='GET'||!safeFiles.has(name))throw fault(404,'Not found.');res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.html':'text/html'})[extname(name)]);res.setHeader('X-Content-Type-Options','nosniff');res.end(await readFile(resolve(root,name)));return;}
  if(req.method!=='GET'&&(req.headers.origin!==site.origin||req.headers['x-sae-request']!=='1'))throw fault(403,'Invalid request origin.');
  if(path==='/api/auth/config'&&req.method==='GET'){json(res,200,{enabled:true});return;}
  if(path==='/api/auth/login'&&req.method==='POST'){
   const b=await body(req),username=String(b.username||'').toLowerCase(),password=String(b.password||'');if(password.length>256)throw fault(400,'Invalid credentials.');
   const ip=req.socket.remoteAddress,key=ip+':'+username,now=Date.now();for(const [k,v]of attempts)if(v.until<now)attempts.delete(k);
   for(const k of [ip,key]){const v=attempts.get(k)||{count:0,until:now+300000};if(v.count>=20)throw fault(429,'Too many attempts. Try again in five minutes.');v.count++;attempts.set(k,v);}
   const row=db.prepare('SELECT * FROM users WHERE username=?').get(username),ok=await verify(password,row?.password||dummy);if(!row||!ok||JSON.parse(row.record).status!=='Active')throw fault(401,'Incorrect username or password.');
   const prior=userSession(req);if(prior){db.prepare('DELETE FROM sessions WHERE id=?').run(prior.sid);tokens.delete(prior.sid);}
   db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
   const raw=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),row.id,now+8*3600000);
   res.setHeader('Set-Cookie',`sae_session=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure?'; Secure':''}`);json(res,200,{user:JSON.parse(row.record)});return;
  }
  const session=userSession(req);if(!session)throw fault(401,'Sign in to the website first.');const {user,sid}=session;
  if(path==='/api/auth/me'&&req.method==='GET'){json(res,200,{user});return;}
  if(path==='/api/auth/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE id=?').run(sid);tokens.delete(sid);res.setHeader('Set-Cookie',`sae_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`);json(res,200,{});return;}
  if(path==='/api/users'){
   if(user.role!=='admin')throw fault(403,'Administrator access required.');
   if(req.method==='GET'){json(res,200,{users:db.prepare('SELECT record FROM users ORDER BY username').all().map(x=>JSON.parse(x.record))});return;}
   const b=await body(req);
   if(req.method==='DELETE'){if(b.id===user.id)throw fault(400,'Cannot delete the signed-in administrator.');db.prepare('DELETE FROM users WHERE id=?').run(b.id);json(res,200,{});return;}
   if(req.method!=='PUT')throw fault(405,'Method not allowed.');
   const existing=b.id?db.prepare('SELECT * FROM users WHERE id=?').get(b.id):null;
   if(b.id&&!existing)throw fault(404,'User not found.');
   const record={id:existing?.id||randomUUID(),username:String(b.username||'').trim().toLowerCase(),name:String(b.name||'').trim(),email:String(b.email||'').trim().toLowerCase(),status:b.status,role:existing?JSON.parse(existing.record).role:'user',permissions:b.permissions};
   if(!/^[a-z0-9._-]{3,64}$/.test(record.username)||!record.name||record.name.length>100||!/^\S+@\S+\.\S+$/.test(record.email)||!['Active','Inactive'].includes(record.status)||!areas.every(a=>levels.includes(record.permissions?.[a])))throw fault(400,'Invalid user fields or permissions.');
   if(record.role==='admin'&&record.status!=='Active')throw fault(400,'Administrator must stay active.');
   for(const field of ['phone','department','notes'])record[field]=String(b[field]||'').slice(0,2000);
   if((!existing||b.password)&&(!(typeof b.password==='string')||b.password.length<12||b.password.length>256))throw fault(400,'Password must contain 12–256 characters.');
   const password=b.password?await hashPassword(b.password):existing.password;
   try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,email=excluded.email,record=excluded.record,password=excluded.password').run(record.id,record.username,record.email,JSON.stringify(record),password);}catch(e){if(e.code?.includes('SQLITE'))throw fault(409,'Username or email already exists.');throw e;}
   if(existing&&(b.password||record.status!=='Active'||record.email!==existing.email))db.prepare('DELETE FROM sessions WHERE user_id=?').run(record.id);
   json(res,200,{user:record});return;
  }
  if(path==='/api/google/connect'&&req.method==='POST'){
   const b=await body(req);if(typeof b.accessToken!=='string'||b.accessToken.length>10000)throw fault(400,'Invalid Google token.');
   const info=await google('https://oauth2.googleapis.com/tokeninfo?access_token='+encodeURIComponent(b.accessToken),b.accessToken);
   if((info.aud||info.issued_to)!==clientId)throw fault(403,'Google token was not issued to this application.');
   const profile=await google('https://openidconnect.googleapis.com/v1/userinfo',b.accessToken);
   if(profile.email_verified!==true||String(profile.email).toLowerCase()!==user.email)throw fault(403,'Google email must match the email configured for this website user.');
   tokens.set(sid,{token:b.accessToken,email:user.email,expires:Date.now()+Math.min(Number(info.expires_in)||0,3600)*1000,scopes:String(info.scope||'').split(' ')});json(res,200,{email:user.email});return;
  }
  if(path==='/api/google/request'&&req.method==='POST'){
   const b=await body(req),target=new URL(b.url),source=Object.values(sources).find(s=>target.pathname.includes('/'+s.id)),isWrite=b.method==='POST';
   if(!source||!can(user,source.area,isWrite))throw fault(403,'Website permission does not allow this operation.');
   const connection=tokens.get(sid);if(!connection||connection.expires<=Date.now()||connection.email!==user.email)throw fault(401,'Reconnect the configured Google account.');
   const accessUrl=`https://www.googleapis.com/drive/v3/files/${source.id}?fields=id,capabilities(canEdit,canComment)&supportsAllDrives=true`;
   if(target.origin==='https://www.googleapis.com'&&target.pathname==='/drive/v3/files/'+source.id&&!isWrite){json(res,200,await google(accessUrl,connection.token));return;}
   const prefix='/v4/spreadsheets/'+source.id+'/values/';
   if(target.origin!=='https://sheets.googleapis.com')throw fault(403,'Unsupported Google resource.');
   if(!isWrite&&target.pathname.startsWith(prefix)){json(res,200,await google(target.href,connection.token));return;}
   if(!isWrite||target.pathname!=='/v4/spreadsheets/'+source.id+'/values:batchUpdate')throw fault(403,'Unsupported operation.');
   if(!connection.scopes.includes('https://www.googleapis.com/auth/spreadsheets'))throw fault(403,'Google edit consent required.');
   const caps=await google(accessUrl,connection.token);if(caps.capabilities?.canEdit!==true)throw fault(403,'Google Sheet Editor permission required.');
   const data=b.body?.data;if(b.body?.valueInputOption!=='RAW'||!Array.isArray(data)||!data.length||data.length>200)throw fault(400,'Save 1–200 cell changes at a time.');
   for(const cell of data){const match=typeof cell.range==='string'&&cell.range.match(/^'([^']+)'!([A-Z]{1,3})(\d+)$/);if(!match||match[1]!==source.tab||Number(match[3])<3||Number(match[3])>100000||cell.values?.length!==1||cell.values[0]?.length!==1||!['string','number','boolean'].includes(typeof cell.values[0][0]))throw fault(400,'Only individual data cells in the configured tab can be edited.');}
   const checkUrl=`https://sheets.googleapis.com/v4/spreadsheets/${source.id}/values:batchGet?valueRenderOption=FORMULA&`+data.map(c=>'ranges='+encodeURIComponent(c.range)).join('&');
   const before=await google(checkUrl,connection.token);if(before.valueRanges?.length!==data.length||before.valueRanges.some(r=>String(r.values?.[0]?.[0]||'').startsWith('=')))throw fault(403,'Formula cells cannot be edited.');
   const latest=userSession(req);if(!latest||!can(latest.user,source.area,true)||latest.user.email!==connection.email)throw fault(403,'Website permissions changed.');
   json(res,200,await google(target.href,connection.token,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data})}));return;
  }
  throw fault(404,'Not found.');
 }catch(e){json(res,e.status||500,{error:e.status?e.message:'Request failed. Please retry.'});}});
 return {server,close:()=>{server.close();db.close();}};
}
