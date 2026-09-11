(function(root){
  const text=v=>v==null?'':String(v).trim();
  const key=v=>text(v).replace(/\s*DRI\s*:[\s\S]*$/i,'').replace(/\s+/g,' ').toLowerCase();
  const columnName=i=>{let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
  function date(v){
    if(typeof v==='number'&&v>0&&v<100000)return new Date(Date.UTC(1899,11,30)+Math.floor(v)*86400000).toISOString().slice(0,10);
    const s=text(v),m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m){const result=`${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;return Number(m[1])<=12&&Number(m[2])<=31?result:'';}
    return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:'';
  }
  function mapRows(values){
    if(!Array.isArray(values?.[0]))throw new Error('Manufacture header row is missing');
    // Keep the first general Remark; later remarks belong to their own stages.
    const cols=new Map();values[0].forEach((v,i)=>{if(!cols.has(key(v)))cols.set(key(v),i);});
    const required=['Project','Phase','Type','Equipment','Spec','KO QTY','KO Date','CM NBD','CM Site','MFG status','ACT ETD'];
    const missing=required.filter(k=>!cols.has(key(k)));if(missing.length)throw new Error(`Manufacture columns missing: ${missing.join(', ')}`);
    return values.slice(1).flatMap((r,i)=>{
      const get=k=>r[cols.get(key(k))];
      if(!text(get('Project'))||!text(get('Spec')))return [];
      const item={_sourceRow:i+3};
      [...required,'Material Status','STD Status','RM Status','CNC OS STATUS','RD Drawing Status','Remark'].forEach(k=>item[k]=text(get(k)));
      const showDate=v=>date(v)||text(v);
      const summary=entries=>entries.filter(([,v])=>text(v)!=='').map(([label,v])=>`${label}: ${v}`).join('\n');
      const material=(total,arrived,pending,eta)=>summary([
        ['Total',get(total)],['Arrived/available',get(arrived)],['Pending',get(pending)],['ETA',showDate(get(eta))]
      ]);
      item['STD Status']=item['STD Status']||material('STD total Qty','STD Avl/Avd qty','STD Pending qty','STD ETA');
      item['OS/SM Status']=material('OS/SM total Qty','OS/SM Arrived qty','OS/SM Pending qty','OS/SM ETA');
      const rm=get('RM Status');
      item['RM Status']=summary([['Status',typeof rm==='number'?`${Math.round(rm*100)}%`:rm],['Total',get('RM total Qty')],['Arrived',get('CNC RM Arrived qty')],['Pending',get('CNC RM Pending qty')],['ETA',showDate(get('CNC RM ETA'))]]);
      item['CNC Status']=item['CNC OS STATUS']||summary([['Inhouse qty',get('CNC Inhose qty')],['Complete',get('CNC complete qty')],['Pending',get('CNC pending qty')],['End plan',showDate(get('CNC End Status (Plan)'))],['End actual',showDate(get('CNC End Status (Act.)'))]]);
      // Preserve every populated R:CM cell, including repeated Debug headers,
      // with source coordinates rather than guessing their intended meaning.
      item._details=values[0].slice(17,91).flatMap((label,offset)=>{
        const col=offset+17,value=r[col];if(!text(value))return [];
        const name=text(label).replace(/\s+/g,' '),k=key(label);
        const isDate=/date|eta|etd|released|assembly (start|end)|debug start|cnc (start|end) status|sap upload status|npi routing/.test(k)&&!/^flight info/.test(k);
        const display=k==='rm status'&&typeof value==='number'?`${Math.round(value*100)}%`:isDate?showDate(value):text(value);
        return [{column:columnName(col),label:name,value:display}];
      });
      ['KO Date','CM NBD','ACT ETD'].forEach(k=>item[k]=date(get(k)));
      item.NBD=item['CM NBD'];
      const milestone=(label,field,kind='plan')=>({label,[kind+'End']:date(get(field))});
      const period=(label,start,end)=>({label,planStart:date(get(start+' (Plan)')),planEnd:date(get(end+' (Plan)')),actualStart:date(get(start+' (Act.)')),actualEnd:date(get(end+' (Act.)'))});
      item._timeline=[
        milestone('Kick-off','KO Date','actual'),
        milestone('Customer drawing released','Latest CM Drawing Released Date','actual'),
        milestone('RD drawing complete','RD Drawing Complete Date','actual'),
        {label:'SAP upload',planEnd:date(get('SAP Upload status PLAN')),actualEnd:date(get('SAP Upload status Actual'))},
        milestone('Routing released','Routing file Released date','actual'),
        milestone('STD arrival','STD ETA'),milestone('OS/SM arrival','OS/SM ETA'),milestone('Raw material arrival','CNC RM ETA'),
        period('CNC','CNC Start Status','CNC End Status'),
        milestone('Second process','2nd process ETA'),milestone('Supplier kick-off','KO to Supplier Date','actual'),
        milestone('Supplier dispatch','FG Supplier ETD'),
        {label:'TN Site 2 arrival',planEnd:date(get('ETA TN Site2'))},
        period('Assembly','Assembly Start','Assembly End'),
        {label:'Dispatch',planEnd:date(get('ETD TN (Plan) site 2 Status')),actualEnd:date(get('ACT ETD'))},
        milestone('Customer need-by','CM NBD')
      ];
      item['Overall status']=/dispatched/i.test(item['MFG status'])?'Dispatched':item['MFG status']||item['Material Status']||'No Status';
      return [item];
    });
  }
  const api={SHEET_ID:'1VXRGCvQp37ppTEpMCmt_sSklmzbH3f2vSH7jkASehDU',mapRows};
  if(typeof module!=='undefined')module.exports=api;else root.ManufactureSource=api;
})(typeof window!=='undefined'?window:globalThis);
