const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
function setup(){
 const els=new Map(),listeners={},pending=[];
 const element=()=>({children:[],textContent:'',value:'',dataset:{},disabled:false,append(...nodes){this.children.push(...nodes);},replaceChildren(...nodes){this.children=nodes;},setAttribute(){}});
 const get=id=>{if(!els.has(id))els.set(id,element());return els.get(id);};
 const areas=['Dashboard','Import','Manufacture','Timeline','Alerts','Search','Calendar','Performance','Notifications','Google Sheet','Audit Log','Settings','User'];
 const actor={id:'admin-id',name:'Admin',username:'admin',email:'admin@example.com',role:'admin',status:'Active',permissions:Object.fromEntries(areas.map(a=>[a,'Edit']))};
 const auth={enabled:true,user:actor,ready:Promise.resolve(),api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject}))};
 const context={document:{getElementById:get,querySelector:get,querySelectorAll:()=>[],createElement:element,addEventListener:(n,f)=>listeners[n]=f},WebAuth:auth,UIText:{t:x=>x}};
 vm.runInNewContext(fs.readFileSync('users.js','utf8'),context);
 return {get,pending,auth,actor,listeners};
}
(async()=>{
 const t=setup();await Promise.resolve();
 assert.equal(t.get('userMessage').textContent,'Loading accounts…');
 assert.equal(t.get('userRows').children[0].children[2].textContent,'Admin');
 assert.equal(t.get('userAdd').disabled,true);
 t.pending[0].resolve({users:[t.actor]});await new Promise(setImmediate);
 assert.equal(t.get('userMessage').textContent,'Accounts loaded.');assert.equal(t.get('userAdd').disabled,false);
 const first=t.get('userReload').onclick(),second=t.get('userReload').onclick();
 t.pending[2].resolve({users:[{...t.actor,name:'Current Admin'}]});await second;
 t.pending[1].resolve({users:[{...t.actor,name:'Stale Admin'}]});await first;
 assert.equal(t.get('userRows').children[0].children[2].textContent,'Current Admin');
 const failed=t.get('userReload').onclick();t.pending[3].reject(Error('Session expired'));await failed;
 assert.match(t.get('userMessage').textContent,/Session expired/);assert.equal(t.get('userAdd').disabled,true);
 assert.equal(t.get('userRows').children[0].children[2].textContent,'Current Admin');
 const late=t.get('userReload').onclick();t.auth.user=null;await t.listeners.webauthchange();
 t.pending[4].resolve({users:[t.actor]});await late;
 assert.equal(t.get('userRows').children[0].children[0].textContent,'Sign in as Admin to manage accounts.');
 assert.equal(t.get('userAdd').disabled,true);
 console.log('PASS loading state, current Admin row, stale response rejection, error retention and logout isolation.');
})().catch(e=>{console.error(e);process.exitCode=1;});

