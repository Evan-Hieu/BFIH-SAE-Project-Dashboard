const {test} = require('node:test');
const assert = require('node:assert/strict');
const source = require('./sheet-source.js');
const header = ['S.No','Project','Build','Machine/Equipment name','Spec','Check Duplicate','Category','KO QTY','UOM','Type','KO Date','NBD','Fixture Manufacturer','PIC','Vendor','BFIH site arrive','Dispatch to Customer','PID','FIH PO Number','Target date','Released','Official PO Target date','Official PO Released','Vendor ETD','AWB Bill','Airport ETA','BFIH Actual ETA','CM PO Number','CM Released date','VMI ETA plan','VMI ETA','Dispatched date','Overall status','Remark'];
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
  assert.throws(()=>source.mapRows([['Unexpected columns']]),/columns missing/);
});

test('new AF and AH quantity columns do not shift dispatch dates or overall status',()=>{
  const names=[...header];const data=row(1);
  data[7]=2;data[31]=46233;data[32]='Partial';data[33]='Keep remark';
  names.splice(31,0,'Dispatched Qty');data.splice(31,0,1);
  names.splice(33,0,'Pending qty');data.splice(33,0,1);
  const [item]=source.mapRows([names,data]);
  assert.equal(item['Dispatched Qty'],'1');assert.equal(item['Pending qty'],'1');
  assert.equal(item['Dispatched date'],'2026-07-30');assert.equal(item['Overall status'],'Partial');assert.equal(item.Remark,'Keep remark');
});
test('matches whitespace aliases and reordered columns, preserving zero quantity',()=>{
  const names=header.map(x=>x==='KO QTY'?'KO\nQTY':x==='Fixture Manufacturer'?'Fixture Manufacturer \n治具廠':x==='FIH PO Number'?'FIH  PO Number':x);
  names.push('Pending qty');const data=row(1);data[7]=5;data[12]='Cancelled';data[18]='PO-TEST';data.push(0);
  const [item]=source.mapRows([names.reverse(),data.reverse()]);
  assert.equal(item['KO QTY'],'5');assert.equal(item['Pending qty'],'0');assert.equal(item['FIH PO Number'],'PO-TEST');assert.equal(source.cancelled(item),true);
});
test('missing optional quantity columns remain blank and duplicate known headers fail',()=>{
  const [item]=source.mapRows([header,row(1)]);assert.equal(item['Pending qty'],'');
  assert.throws(()=>source.mapRows([[...header,'Overall status'],row(1)]),/Duplicate SAE column/);
});