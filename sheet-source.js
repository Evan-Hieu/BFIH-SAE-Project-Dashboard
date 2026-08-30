/* Private Sheets data stays in browser memory, never in the repository. */
(function (root) {
  const SHEET_ID = '1KHBzyi9vcIiqwzKOGVtJNZXC6rqULJYyyhvO69XoDuE';
  const dateColumns = new Set([10, 11, 19, 20, 21, 22, 23, 25, 26, 28, 29, 30, 31]);
  const headers = ['S.No','Project','Build','Machine/Equipment name','Spec','Check Duplicate','Category','KO QTY','UOM','Type','KO Date','NBD','Fixture Manufacturer','PIC','Vendor','BFIH site arrive','Dispatch to Customer','PID','FIH PO Number','Target date','Released','Official PO Target date','Official PO Released','Vendor ETD','AWB Bill','Airport ETA','BFIH Actual ETA','CM PO Number','CM Released date','VMI ETA plan','VMI ETA','Dispatched date','Overall status','Remark'];
  const text = value => value == null ? '' : String(value).trim();
  function dateValue(value) {
    if (typeof value !== 'number') return text(value);
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  function mapRows(values) {
    if (!Array.isArray(values) || text(values[0]?.[0]) !== 'S.No' || text(values[0]?.[3]) !== 'Machine/Equipment name' || text(values[0]?.[11]) !== 'NBD' || text(values[0]?.[32]) !== 'Overall status') {
      throw new Error('SAE columns have changed. Check the header row before syncing.');
    }
    return values.slice(1).flatMap((row, index) => {
      if (!text(row[0]) || !text(row[3])) return [];
      const item = {_sourceRow: index + 3};
      headers.forEach((header, column) => { item[header] = dateColumns.has(column) ? dateValue(row[column]) : text(row[column]); });
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
