const assert=require('node:assert/strict');
const {mapRows}=require('./manufacture-source.js');
const headers=['Project','Phase','Type','Equipment','Spec','KO QTY','KO Date','CM NBD','CM Site','MFG status','ACT ETD','CNC Start Status\n(Plan)\nDRI: Test','CNC End Status\n(Plan)\nDRI: Test','Assembly Start\n(Act.)\nDRI: Test','Assembly End\n(Act.)\nDRI: Test','STD ETA\nDRI: Test','Debug Start\n(Plan)\nDRI: Test','Debug Start\n(Plan)\nDRI: Test'];
const row=['Example','EVT','NB','Mic','EX-001',1,46251,46300,'Site','On-going','',46261,46274,'2026-09-14','2026-09-20','N/A',46284,46290];
const item=mapRows([headers,row])[0];
assert.notEqual(item._production[13].state,'done','Shared Assembly date must not complete Mechanical assembly');
assert.notEqual(item._production[15].state,'done','Duplicate Debug headers must not imply completed debugging');
assert.equal(item._production[17].state,'unknown');
assert.equal(item['Overall status'],'On-going');
const {stages:matrixStages}=require('./manufacture-source.js');
assert.equal(matrixStages.length,18);assert.equal(matrixStages[0].label,'Health Check up');assert.equal(matrixStages[17].label,'ETD');
function matrix(extra={}){
 const source={Project:'TEST',Phase:'EVT',Type:'NB',Equipment:'Mic',Spec:'EX-1','KO QTY':1,'KO Date':'2026-08-01','CM NBD':'2026-10-01','CM Site':'Site','MFG status':'CNC ongoing 78% completed','ACT ETD':'',...extra};
 return mapRows([Object.keys(source),Object.values(source)])[0]._production;
}
let progress=matrix({'STD total Qty':100,'STD Avl/Avd qty':75,'STD Pending qty':25,'RD Drawing Status':'Done','COGS Status':'Not Started','Assembly End (Act.)':'2026-09-10'});
assert.equal(progress[0].state,'unknown');assert.equal(progress[8].text,'75%');assert.equal(progress[9].text,'78%');
assert.equal(progress[2].state,'partial');assert.equal(progress[12].state,'partial');assert.notEqual(progress[13].state,'done');assert.notEqual(progress[14].state,'done');
progress=matrix({'STD total Qty':100,'STD Avl/Avd qty':100,'STD Pending qty':0});assert.equal(progress[8].state,'done');
progress=matrix({'STD total Qty':100,'STD Pending qty':100});assert.equal(progress[8].text,'0%');assert.notEqual(progress[8].state,'not-started');
progress=matrix({'STD total Qty':100,'STD Avl/Avd qty':50,'STD Pending qty':80});assert.equal(progress[8].text,'Check');
progress=matrix({'STD total Qty':0,'STD Avl/Avd qty':0,'STD Pending qty':0,'MFG status':'Out source','CNC complete qty':0});assert.notEqual(progress[8].state,'done');assert.notEqual(progress[9].state,'done');
progress=matrix({'MFG status':'Dispatched'});assert.equal(progress[17].state,'done');assert.equal(progress[0].state,'unknown');assert.notEqual(progress[15].state,'done');
progress=matrix({'MFG status':'Not dispatched','ETD TN (Plan) site 2 Status':'2026-10-01'});assert.equal(progress[17].state,'planned');
progress=matrix({'Health Check up':'Not Started','Mechanical assembly':'Completed','Electrical assembly':'Delayed','SOP prepare':'N/A'});assert.equal(progress[0].state,'not-started');assert.equal(progress[13].state,'done');assert.equal(progress[14].state,'delayed');assert.equal(progress[4].state,'na');
progress=matrix({'Electrical assembly':'Delayed 50%'});assert.equal(progress[14].state,'delayed');assert.equal(progress[14].text,'! 50%');
console.log('PASS 18-stage matrix, percentages, composite stages, missing data, and dispatch isolation.');
