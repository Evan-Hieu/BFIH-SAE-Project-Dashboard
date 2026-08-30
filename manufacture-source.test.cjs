const assert=require('node:assert/strict');
const {mapRows}=require('./manufacture-source.js');
const headers=['Project','Phase','Type','Equipment','Spec','KO QTY','KO Date','CM NBD','CM Site','MFG status','Material Status','ACT ETD'];
const first=['TEST','EVT','NB','Test equipment','TEST-001',2,46235,46300,'SITE','','Material pending',''];
const rows=mapRows([headers,[null,null,null,null,8,13],first,[...first.slice(0,11),46260],[]]);
assert.equal(rows.length,2);
assert.equal(rows[0].Equipment,'Test equipment');
assert.equal(rows[0].Spec,'TEST-001');
assert.equal(rows[0].NBD,'2026-10-05');
assert.equal(rows[0]['Overall status'],'Material pending');
assert.equal(rows[1]['Overall status'],'Material pending','ACT ETD alone must not mark complete');
for(const status of ['Dispatched','dispatched','DISPATCHED','Completed - Dispatched to CM']){
 const row=first.slice();row[9]=status;
 assert.equal(mapRows([headers,row])[0]['Overall status'],'Dispatched');
}
const pending=first.slice();pending[9]='Assembly ongoing';
assert.equal(mapRows([headers,pending])[0]['Overall status'],'Assembly ongoing');
assert.throws(()=>mapRows([['Project']]),/columns missing/);
console.log('Manufacture equipment and completion checks passed');
