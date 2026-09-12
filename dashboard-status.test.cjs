const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const els={};const ctx={document:{addEventListener(){},getElementById(id){return els[id]??=( {} )}},window:{},SaeSource:require('./sheet-source.js')};vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),ctx);
const rows=[1,0,-3,-4,-5,-6,-7,-30,null].map(_gap=>({_gap,'Overall status':'On-going'}));rows.push({_gap:1,'Overall status':'Dispatched'},{_gap:-5,'Overall status':'Dispatched'});
for(const prefix of ['import','mfg']){ctx.renderKPIs(prefix,rows);assert.deepEqual(['Total','Overdue','Due3','Due7','Dispatched'].map(k=>els[prefix+k].textContent),[11,1,4,3,2]);ctx.renderPending(prefix,[]);assert.equal(els[prefix+'PendingCount'].textContent,'0 items');}
assert.equal(ctx.priority(-5,'').text,'● Due ≤5d');assert.equal(ctx.priority(-6,'').text,'● On Track');assert.equal(ctx.priority(null,'').text,'● No NBD');assert.equal(ctx.priority(1,'Dispatched').text,'● Dispatched');assert.equal(ctx.gapcls(-5),'gap-near');assert.equal(ctx.gapcls(-6),'gap-safe');
console.log('PASS TNO/Inhouse KPI counts, due boundary at 5/6 days, dispatched exclusion and missing NBD.');
