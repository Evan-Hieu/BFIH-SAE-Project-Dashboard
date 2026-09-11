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
      item._production=production(values[0],r);
      item._timeline=timeline(r);
      item.Condition=text(get('Condition'));
      item['Overall status']=/dispatched/i.test(item['MFG status'])?'Dispatched':item['MFG status']||item['Material Status']||'No Status';
      return [item];
    });
  }
  const stages=[
    ['Health Check up','design'],['STD BOM * RM release','design'],['ME/EE design docs release','design'],['ME routing file, 2D/3D drawing verification,','design'],['SOP prepare','design'],['CNC Routing','design'],
    ['STD &RM Materials confirm avl/Procurment','material'],['CNC parts & Sheet metal Procurement','material'],['STD RFQ & Procurement','material'],
    ['CNC CAD/CAM & manufacture','manufacture'],['2nd process & TPU / Insert mold','manufacture'],['SAP Maintain & PN & BOM status','system'],['COGS & WO','system'],
    ['Mechanical assembly','assembly'],['Electrical assembly','assembly'],['Debugging TNES','quality'],['OQC & Dryrun / Packing','quality'],['ETD','shipment']
  ].map(([label,group],index)=>({label,group,index}));
  function status(value){
    const s=text(value),k=key(s);
    if(!s)return {state:'unknown',text:'—'};
    if(/^(n\/?a|not required|not applicable)$/i.test(s))return {state:'na',text:'N/A'};
    if(/^(not started|not yet started|未開始|未开始|-)$/i.test(s))return {state:'not-started',text:'–'};
    const pct=s.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*%/);
    if(pct&&+pct[1]<=100){const delayed=/\b(delayed|overdue|late)\b/i.test(s)&&!/^not\b/i.test(s);return {state:delayed?'delayed':+pct[1]===100?'done':'progress',text:delayed?`! ${+pct[1]}%`:+pct[1]===100?'✓':`${+pct[1]}%`};}
    if(/^(done|completed?|released|finished|passed|dispatched|✓|100%)$/i.test(s))return {state:'done',text:'✓'};
    if(/\b(delayed|overdue|late)\b/i.test(s)&&!/^not\b/i.test(s))return {state:'delayed',text:'!'};
    if(/ongoing|in progress|shortage|pending|confirming|out\s*source/i.test(k))return {state:'progress',text:'…'};
    return {state:'info',text:'Info'};
  }
  function production(headers,row){
    const cells=names=>headers.flatMap((h,i)=>{
      if(!names.some(n=>key(n)===key(h))||!text(row[i]))return [];
      const isDate=/date|eta|etd|released|assembly (start|end)|debug start|cnc (start|end) status|sap upload status|npi routing/.test(key(h));
      const value=key(h)==='rm status'&&typeof row[i]==='number'?`${Math.round(row[i]*100)}%`:isDate?date(row[i])||text(row[i]):text(row[i]);
      return [{column:columnName(i),label:text(h).replace(/\s+/g,' '),value}];
    });
    const get=name=>row[headers.findIndex(h=>key(h)===key(name))];
    const num=v=>text(v)!==''&&Number.isFinite(Number(v))?Number(v):null;
    const cell=(result,names,note='')=>({...result,evidence:cells(names),note});
    const info=(names,note)=>cell({state:cells(names).length?'info':'unknown',text:cells(names).length?'Info':'—'},names,note);
    const partial=(name,prefix,names,note)=>{const v=get(name);return text(v)?cell({state:'partial',text:prefix+' '+status(v).text},names,note):info(names,note);};
    function quantity(totalName,arrivedName,pendingName,etaName){
      const total=num(get(totalName)),arrived=num(get(arrivedName)),pending=num(get(pendingName));
      const names=[totalName,arrivedName,pendingName,etaName];
      if(total===null||total<=0||arrived===null&&pending===null)return info(names,'A percentage needs a positive total and arrived/available or pending quantity.');
      const have=arrived===null?total-pending:arrived;
      if(have<0||have>total||pending!==null&&(pending<0||pending>total||arrived!==null&&Math.abs(arrived+pending-total)>0.001))return cell({state:'info',text:'Check'},names,'Source quantities are inconsistent; no percentage is inferred.');
      const pct=have===total?100:Math.min(99,Math.round(have/total*100));
      return cell({state:pct===100?'done':'progress',text:pct===100?'✓':pct+'%'},names,`${have} / ${total} arrived or available (${pct}%). This measures material availability, not RFQ approval. ETA alone does not prove arrival.`);
    }
    const fallback=[
      ()=>info([],'No Health Check up status column in the source.'),
      ()=>info(['Quotation BOM'],'Quotation BOM alone does not confirm STD BOM and RM release.'),
      ()=>partial('RD Drawing Status','RD',['RD Drawing Status','RD Drawing Complete Date','Customer Drawing Status','Latest CM Drawing Released Date'],'RD status only. Separate ME/EE release is not confirmed.'),
      ()=>info(['Routing file Released date','Customer Drawing Status','CM Drawing Remark','CM Drawing Version'],'Routing release and drawing status are shown as evidence; 2D/3D verification is not separately confirmed.'),
      ()=>info([],'No SOP preparation status column in the source.'),
      ()=>info(['NPI Routing','Routing file Released date'],'Source routing dates are available; confirmation that they represent CNC Routing is needed.'),
      ()=>info(['STD total Qty','STD Avl/Avd qty','STD Pending qty','RM total Qty','CNC RM Arrived qty','CNC RM Pending qty','RM Status'],'STD and RM availability are separate in the source; no combined completion is inferred.'),
      ()=>quantity('OS/SM total Qty','OS/SM Arrived qty','OS/SM Pending qty','OS/SM ETA'),
      ()=>quantity('STD total Qty','STD Avl/Avd qty','STD Pending qty','STD ETA'),
      ()=>{const names=['MFG status','CNC Inhose qty','CNC complete qty','CNC pending qty','CNC Start Status (Plan)','CNC Start Status (Act.)','CNC End Status (Plan)','CNC End Status (Act.)'];const s=text(get('MFG status'));if(/cnc/i.test(s))return cell(status(s),names,'CNC progress from the source MFG status. A scheduled end date alone does not prove completion.');if(date(get('CNC End Status (Act.)')))return cell({state:'done',text:'✓'},names,'CNC actual end date is recorded.');return info(names,'CNC progress is not stated. Zero in-house quantity does not mean outsourced CNC is complete.');},
      ()=>info(['2nd process Qty','2nd process ETA'],'Quantity and ETA only; TPU / insert mold completion is not confirmed.'),
      ()=>{const names=['SAP PN','SAP Upload status PLAN','SAP Upload status Actual','Quotation BOM'];return date(get('SAP Upload status Actual'))?cell({state:'partial',text:'SAP ✓'},names,'SAP upload actual date is recorded; PN and BOM maintenance completion is not confirmed.'):info(names,'SAP / PN / BOM completion is not fully confirmed.');},
      ()=>partial('COGS Status','COGS',['COGS Status','Dismantling WO'],'COGS status only. Dismantling WO is not assumed to be the production WO.'),
      ()=>info(['Assembly Start (Plan)','Assembly Start (Act.)','Assembly End (Plan)','Assembly End (Act.)'],'The source has shared Assembly columns; Mechanical assembly is not separately identified.'),
      ()=>info([],'The source has shared Assembly columns; Electrical assembly is not separately identified.'),
      ()=>info(['Debug Start (Plan)'],'The four Debug headers are identical. Start/end and plan/actual are not assigned automatically.'),
      ()=>partial('Packaging 打包裝箱','Pack',['Packaging 打包裝箱'],'Packaging status only; OQC and Dryrun are not separately confirmed.'),
      ()=>{const names=['MFG status','Align with Customer ETD','ETD TN (Plan) site 2 Status','ACT ETD'];const actual=date(get('ACT ETD')),planned=date(get('ETD TN (Plan) site 2 Status'))||date(get('Align with Customer ETD'));if(actual||/^dispatched$|^completed\s*-\s*dispatched/i.test(text(get('MFG status'))))return cell({state:'done',text:'✓',date:actual},names,'Dispatch is confirmed by actual ETD or explicit dispatched status.');return cell({state:planned?'planned':'unknown',text:planned?planned.slice(5).replace('-','/'):'—'},names,'Planned ETD is a date, not a completion status.');}
    ];
    return stages.map((stage,i)=>{const direct=get(stage.label);return text(direct)&&i!==17?cell(status(direct),[stage.label],'Explicit stage status from the source.'):fallback[i]();});
  }
  // Timeline coordinates are authoritative, including the duplicate OS/SM ETA label.
  const timelineStages=[
    ['Health Check up','X','Y','design','date'],
    ['BOM & Drawing released','Z','AA','design','date'],
    ['ME/EE 2D/3D verify','AB','','design','date'],
    ['CNC NPI Routing date','AE','AF','design','date'],
    ['STD/RM Start RFQ','AH','AI','material','date'],
    ['CNC OS/SM RFQ date','AJ','AK','material','date'],
    ['STD total Qty','AQ','','material'],
    ['STD Pending qty','AT','','material','',true],
    ['CNC OS/SM total Qty','AW','','material'],
    ['OS/SM ETA','AX','','material','date'],
    ['OS/SM ETA','AZ','','material','',true],
    ['CNC Inhose qty','BH','','manufacture'],
    ['CNC Target date','BK','','manufacture','date'],
    ['CNC pending qty','BN','','manufacture'],
    ['COGS','BP','','system'],
    ['2nd process Qty','BQ','','manufacture'],
    ['2nd process ETA','BR','','manufacture','date'],
    ['Assembly Start plan','CC','','assembly','date'],
    ['Assembly end plan','CE','','assembly','date'],
    ['Debuging Start plan','CH','','quality','date'],
    ['Debuging end plan','CJ','','quality','date'],
    ['OQC & Dryrun /','CM','','quality','date'],
    ['Packing','CN','','quality'],
    ['ETD','CP','','shipment','date']
  ].map(([label,column,colorColumn,group,format,redPositive=false])=>({label,column,colorColumn,group,format,redPositive}));
  const columnIndex=column=>[...column].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;
  function timeline(row){
    return timelineStages.map(stage=>{
      const raw=row[columnIndex(stage.column)],reference=stage.colorColumn?text(row[columnIndex(stage.colorColumn)]):'';
      const display=stage.format==='date'?date(raw)||text(raw):text(raw);
      return {text:display||'—',state:reference?status(reference).state:'unknown',reference,
        redPositive:stage.redPositive&&text(raw)!==''&&Number.isFinite(Number(raw))&&Number(raw)>0};
    });
  }
  const api={SHEET_ID:'1VXRGCvQp37ppTEpMCmt_sSklmzbH3f2vSH7jkASehDU',mapRows,stages,timelineStages,timeline};
  if(typeof module!=='undefined')module.exports=api;else root.ManufactureSource=api;
})(typeof window!=='undefined'?window:globalThis);
