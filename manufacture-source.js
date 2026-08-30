(function(root){
  const text=v=>v==null?'':String(v).trim();
  const key=v=>text(v).replace(/\s+/g,' ').toLowerCase();
  function date(v){
    if(typeof v==='number'&&v>0&&v<100000)return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
    const s=text(v),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m){const result=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;return Number(m[1])<=12&&Number(m[2])<=31?result:'';}
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
  }
  function mapRows(values){
    if(!Array.isArray(values?.[0]))throw new Error('Manufacture header row is missing');
    const cols=new Map(values[0].map((v,i)=>[key(v),i]));
    const required=['Project','Phase','Type','Equipment','Spec','KO QTY','KO Date','CM NBD','CM Site','MFG status','Material Status','ACT ETD'];
    const missing=required.filter(k=>!cols.has(key(k)));if(missing.length)throw new Error(`Manufacture columns missing: ${missing.join(', ')}`);
    return values.slice(1).flatMap((r,i)=>{
      const get=k=>r[cols.get(key(k))];
      if(!text(get('Project'))||!text(get('Spec')))return [];
      const item={_sourceRow:i+3};
      [...required,'STD Status','RM Status','CNC OS STATUS','RD Drawing Status','Remark'].forEach(k=>item[k]=text(get(k)));
      ['KO Date','CM NBD','ACT ETD'].forEach(k=>item[k]=date(get(k)));
      item.NBD=item['CM NBD'];
      item['Overall status']=/dispatched/i.test(item['MFG status'])?'Dispatched':item['MFG status']||item['Material Status']||'No Status';
      return [item];
    });
  }
  const api={SHEET_ID:'1VXRGCvQp37ppTEpMCmt_sSklmzbH3f2vSH7jkASehDU',mapRows};
  if(typeof module!=='undefined')module.exports=api;else root.ManufactureSource=api;
})(typeof window!=='undefined'?window:globalThis);
