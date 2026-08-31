// The same mutually exclusive buckets drive the KPI cards and both donuts.
const KPI_STATUS_LABELS=['Overdue','Due ≤ 3 Days','Due ≤ 7 Days','Dispatched'];
const KPI_STATUS_COLORS=['#ef2b1f','#f58213','#eeb308','#26a34a'];
function kpiTint(hex,amount){
  const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16));
  return `rgb(${rgb.map(v=>Math.round(amount>=0?v+(255-v)*amount:v*(1+amount))).join(',')})`;
}
function kpiStatusCounts(items){
  const counts=[0,0,0,0];
  items.forEach(item=>{
    if(SaeSource.dispatched(item))counts[3]++;
    else if(item._gap!==null&&Number.isFinite(item._gap)){
      if(item._gap>0)counts[0]++;
      else if(item._gap>=-3)counts[1]++;
      else if(item._gap>=-7)counts[2]++;
    }
  });
  return counts;
}
function createStatusDonut(canvas,label,items){
  const values=kpiStatusCounts(items),included=values.reduce((a,b)=>a+b,0);
  canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`${label}: ${included}/${items.length} items in four KPI groups. ${KPI_STATUS_LABELS.map((name,i)=>`${name}: ${values[i]}`).join(', ')}`);
  const tilt=.62;
  const plugin={
    id:'tiltedKpiDonut',
    afterDatasetUpdate(chart){
      const area=chart.chartArea,arcs=chart.getDatasetMeta(0).data;
      const radius=Math.max(1,Math.min((area.right-area.left-26)/2,(area.bottom-area.top-36)/(2*tilt)));
      const x=(area.left+area.right)/2,y=(area.top+area.bottom-20)/2;
      chart.$kpiCenter={x,y,radius};
      const separation=values.filter(Boolean).length>1?Math.min(5,radius*.05):0;
      arcs.forEach(arc=>{
        const angle=(arc.startAngle+arc.endAngle)/2;
        Object.assign(arc,{x:x+Math.cos(angle)*separation,y:y+Math.sin(angle)*separation*tilt,outerRadius:radius,innerRadius:radius*.51});
      });
    },
    beforeDatasetsDraw(chart){
      const {ctx}=chart,arcs=chart.getDatasetMeta(0).data;
      if(!arcs.length)return false;
      const center=chart.$kpiCenter,depth=Math.max(6,Math.min(21,center.radius*.22));
      // Cast a soft shadow; the hole itself stays open, not filled by a dark disk.
      ctx.save();ctx.translate(center.x,center.y+depth+3);ctx.scale(1,tilt);
      ctx.shadowColor='rgba(30,48,64,.18)';ctx.shadowBlur=9;ctx.shadowOffsetY=3;
      ctx.beginPath();ctx.arc(0,0,center.radius,0,Math.PI*2);ctx.arc(0,0,center.radius*.51,0,Math.PI*2,true);
      ctx.fillStyle='rgba(30,48,64,.06)';ctx.fill();ctx.restore();
      // Lit side walls and a glossy top replace the flat fill and thick white outline.
      for(let z=depth;z>=0;z--){
        if(included)arcs.forEach((arc,i)=>{
          if(!values[i])return;
          ctx.save();ctx.translate(arc.x,arc.y+z);ctx.scale(1,tilt);ctx.translate(-arc.x,-arc.y);
          const options=arc.options,color=KPI_STATUS_COLORS[i],r=arc.outerRadius;
          const fill=ctx.createLinearGradient(arc.x-r,arc.y-r,arc.x+r*.6,arc.y+r);
          if(z){
            const shade=z/depth;
            fill.addColorStop(0,kpiTint(color,.26-shade*.15));
            fill.addColorStop(.5,kpiTint(color,-.12-shade*.14));
            fill.addColorStop(1,kpiTint(color,-.26-shade*.13));
          }else{
            fill.addColorStop(0,kpiTint(color,.78));
            fill.addColorStop(.35,kpiTint(color,.55));
            fill.addColorStop(.7,kpiTint(color,.14));
            fill.addColorStop(1,color);
          }
          arc.options={...options,backgroundColor:fill,borderWidth:z?0:.7,borderColor:kpiTint(color,.65)};
          arc.draw(ctx);arc.options=options;
          if(!z){
            // Fine bevel along the outside catches light without a white dividing band.
            ctx.beginPath();ctx.arc(arc.x,arc.y,r-1,arc.startAngle+.006,arc.endAngle-.006);
            ctx.strokeStyle=kpiTint(color,.68);ctx.lineWidth=.8;ctx.stroke();
          }
          ctx.restore();
        });
        else {ctx.save();ctx.translate(center.x,center.y+z);ctx.scale(1,tilt);ctx.beginPath();ctx.arc(0,0,center.radius,0,Math.PI*2);ctx.arc(0,0,center.radius*.51,0,Math.PI*2,true);ctx.fillStyle=z?'#c5ced8':'#e8edf2';ctx.fill();ctx.restore();}
      }
      ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#102e50';
      const font=Math.max(10,Math.min(17,center.radius*.51*.38));
      ctx.font=`700 ${font}px Arial`;ctx.fillText(label,center.x,center.y-font*.6);
      ctx.font=`800 ${font+2}px Arial`;ctx.fillText(String(included),center.x,center.y+font*.65);
      ctx.restore();return false;
    },
    beforeEvent(chart,args){
      const e=args.event,arcs=chart.getDatasetMeta(0).data,center=arcs[0];
      if(!center)return false;
      const index=e.type==='mouseout'?-1:arcs.findIndex((arc,i)=>values[i]>0&&arc.inRange(e.x,arc.y+(e.y-arc.y)/tilt));
      chart.tooltip.setActiveElements(index<0?[]:[{datasetIndex:0,index}],{x:e.x,y:e.y});
      chart.render();return false;
    }
  };
  return new Chart(canvas,{type:'doughnut',plugins:[plugin],data:{labels:KPI_STATUS_LABELS.map(UIText.t),datasets:[{data:values,backgroundColor:KPI_STATUS_COLORS,borderWidth:0,hoverOffset:0,spacing:1}]},options:{
    responsive:true,maintainAspectRatio:false,animation:false,rotation:-110,cutout:'57%',layout:{padding:4},
    plugins:{legend:{position:'bottom',onClick:()=>{},labels:{boxWidth:10,boxHeight:10,padding:9,font:{size:10},generateLabels(chart){return KPI_STATUS_LABELS.map((name,index)=>({text:`${UIText.t(name)} · ${values[index]}`,fillStyle:KPI_STATUS_COLORS[index],strokeStyle:KPI_STATUS_COLORS[index],lineWidth:0,index,hidden:false}));}}},
      subtitle:{display:true,position:'bottom',text:`${included}/${items.length} ${UIText.t('items')} · 4 KPI`,font:{size:10},color:'#64748b',padding:{top:3,bottom:2}},
      tooltip:{callbacks:{label(context){return `${context.label}: ${context.raw} (${items.length?Math.round(context.raw/items.length*100):0}% ${UIText.t('Total Items')})`;}}}}
  }});
}
