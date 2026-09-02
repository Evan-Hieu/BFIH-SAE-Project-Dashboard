/* Private Sheets data stays in browser memory, never in the repository. */
(function (root) {
  const SHEET_ID = '1KHBzyi9vcIiqwzKOGVtJNZXC6rqULJYyyhvO69XoDuE';
  const dateFields = new Set(['KO Date','NBD','Target date','Released','Official PO Target date','Official PO Released','Vendor ETD','Airport ETA','BFIH Actual ETA','CM Released date','VMI ETA plan','VMI ETA','Dispatched date']);
  const headers = ['S.No','Project','Build','Equipment','Machine/Equipment name','Spec','Check Duplicate','Category','KO QTY','UOM','Type','KO Date','NBD','Fixture Manufacturer','PIC','Vendor','BFIH site arrive','Dispatch to Customer','PID','FIH PO Number','Target date','Released','Official PO Target date','Official PO Released','Vendor ETD','AWB Bill','Airport ETA','BFIH Actual ETA','CM PO Number','CM Released date','VMI ETA plan','VMI ETA','Dispatched date','Overall status','Remark'];
  const text = value => value == null ? '' : String(value).trim();
  const key = value => text(value).toLowerCase().replace(/\s+/g,' ').trim();
  const aliases = new Map([...headers,'Dispatched Qty','Pending qty'].map(name=>[key(name),name]));
  aliases.set('fixture manufacturer 治具廠','Fixture Manufacturer');
  aliases.set('po release taget date','Target date');
  aliases.set('official po taget date','Official PO Target date');
  aliases.set('phase','Build');
  aliases.set('delivered','Dispatched Qty');
  aliases.set('pending','Pending qty');
  aliases.set('status','Overall status');
  function dateValue(value) {
    if (typeof value !== 'number') return text(value);
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  function mapRows(values) {
    if (!Array.isArray(values) || !Array.isArray(values[0])) throw new Error('SAE header row is missing');
    const columns = new Map();
    values[0].forEach((label,column)=>{
      // SAE renamed Category to Type; its other Type (Import/Inhouse) remains.
      // The equipment Type is the column immediately before KO QTY.
      const name=key(label)==='type' && key(values[0][column+1])==='ko qty'
        ? 'Category' : aliases.get(key(label));
      if (!name) return;
      if (columns.has(name)) throw new Error(`Duplicate SAE column: ${name}`);
      columns.set(name,column);
    });
    const required=['S.No','Machine/Equipment name','NBD','Overall status','Spec','KO QTY','Type','Fixture Manufacturer','FIH PO Number','Vendor ETD','AWB Bill','BFIH Actual ETA','CM PO Number','CM Released date','VMI ETA plan','VMI ETA','Dispatched date'];
    const missing=required.filter(name=>!columns.has(name));
    if(missing.length) throw new Error(`SAE columns missing: ${missing.join(', ')}`);
    return values.slice(1).flatMap((row, index) => {
      if (!text(row[columns.get('S.No')]) || !text(row[columns.get('Machine/Equipment name')])) return [];
      const item = {_sourceRow: index + 3};
      [...headers,'Dispatched Qty','Pending qty'].forEach(header => {
        const value=row[columns.get(header)];
        item[header]=dateFields.has(header)?dateValue(value):text(value);
      });
      // Prefer the short name in the new column D, with backward compatibility
      // for older source layouts that only contain Machine/Equipment name.
      item.Equipment=item.Equipment||item['Machine/Equipment name'];
      return [item];
    });
  }
  function dispatched(item) { return text(item['Overall status']).toLowerCase() === 'dispatched'; }
  function cancelled(item) { return text(item['Fixture Manufacturer']).toLowerCase() === 'cancelled'; }
  function stage(item) {
    if (text(item.Type).toLowerCase() === 'inhouse') return {stage:'Project / Inhouse Follow-up',action:'Check execution progress vs NBD'};
    const steps = [
      ['FIH PO Number','FIH PO Pending','Follow up FIH PO number'],
      ['Vendor ETD','Vendor ETD Pending','Confirm Vendor ETD'],
      ['AWB Bill','AWB Pending','Get AWB / shipment confirmation'],
      ['BFIH Actual ETA','BFIH Arrival Pending','Track shipment / confirm BFIH arrival'],
      ['CM PO Number','CM PO Pending','Follow up CM PO'],
      ['CM Released date','CM Release Pending','Follow up CM release'],
      ['VMI ETA plan','VMI ETA Plan Pending','Confirm VMI ETA plan'],
      ['VMI ETA','VMI Arrival Pending','Confirm VMI ETA / arrival'],
      ['Dispatched date','Dispatch Pending','Push dispatch to customer']
    ];
    // Match Tracker: only a blank cell is pending; '-' is not treated as blank.
    for (const [field, label, action] of steps) if (!text(item[field])) return {stage:label,action};
    return {stage:'Overall Status Update Pending',action:'Update overall status'};
  }
  const api = {SHEET_ID,mapRows,dispatched,cancelled,stage};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SaeSource = api;
})(typeof window === 'undefined' ? this : window);
