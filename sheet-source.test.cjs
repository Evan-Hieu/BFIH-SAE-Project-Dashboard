const {test} = require('node:test');
const assert = require('node:assert/strict');
const source = require('./sheet-source.js');
const header = Array(34).fill('');
header[0]='S.No';header[3]='Machine/Equipment name';header[11]='NBD';header[32]='Overall status';
function row(id, type='Import') { const r=Array(34).fill('');r[0]=id;r[3]='Test fixture';r[9]=type;return r; }
test('imports all types and rows after blank separators without deduplicating repeated serials',()=>{
  const values=[header,row(1),[],row(1,'Inhouse'),row(2,'FATP'),row(3,'')];
  const items=source.mapRows(values);
  assert.equal(items.length,4);assert.deepEqual(items.map(x=>x._sourceRow),[3,5,6,7]);
});
test('preserves location text and converts numeric dates with their actual year',()=>{
  const r=row(1);r[11]=46233;r[15]='BLES';
  const [item]=source.mapRows([header,r]);
  assert.equal(item.NBD,'2026-07-30');assert.equal(item['BFIH site arrive'],'BLES');
});
test('partial dispatch remains pending until overall status says dispatched',()=>{
  const item={'Dispatched date':'2026-08-30','Overall status':'1x PO received, dispatch plan 9/1'};
  assert.equal(source.dispatched(item),false);
  assert.equal(source.dispatched({...item,'Overall status':'Dispatched'}),true);
});
test('matches Tracker milestone order and its nonblank dash semantics',()=>{
  const item={'FIH PO Number':'PO-TEST','Vendor ETD':'-','AWB Bill':'TEST','BFIH Actual ETA':'-','CM PO Number':'TEST','CM Released date':'-','VMI ETA plan':'-'};
  assert.equal(source.stage(item).stage,'VMI Arrival Pending');
  item['VMI ETA']='-';assert.equal(source.stage(item).stage,'Dispatch Pending');
  item['Dispatched date']='-';assert.equal(source.stage(item).stage,'Overall Status Update Pending');
});
test('cancelled manufacturer is identified independently of Type',()=>{
  assert.equal(source.cancelled({'Fixture Manufacturer':'Cancelled',Type:'Import'}),true);
  assert.equal(source.stage({Type:'Inhouse'}).stage,'Project / Inhouse Follow-up');
});
test('fails closed when source columns move',()=>{
  assert.throws(()=>source.mapRows([['Unexpected columns']]),/columns have changed/);
});
