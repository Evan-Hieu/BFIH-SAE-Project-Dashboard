// Compact outside labels with leader lines; full status remains in the tooltip.
const saeDonutLabels = {
  id: 'saeDonutLabels',
  afterDraw(chart) {
    const {ctx,width,height} = chart;
    const dataset = chart.data.datasets[0];
    const total = dataset.data.reduce((sum,value)=>sum+value,0);
    ctx.save();
    if (!total) {
      ctx.fillStyle='#b9cde2';ctx.font='12px Arial';ctx.textAlign='center';
      ctx.fillText('No data available',width/2,height/2);ctx.restore();return;
    }
    const arcs=chart.getDatasetMeta(0).data;
    const center=arcs[0];
    ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold 23px Arial';
    ctx.fillText(String(total),center.x,center.y+2);
    ctx.fillStyle='#b9cde2';ctx.font='10px Arial';ctx.fillText('items',center.x,center.y+18);
    const groups=[[],[]];
    arcs.forEach((arc,i)=>{
      if (!dataset.data[i]) return;
      const angle=(arc.startAngle+arc.endAngle)/2;
      const side=Math.cos(angle)>=0?1:0;
      groups[side].push({arc,i,angle,y:arc.y+Math.sin(angle)*(arc.outerRadius+10)});
    });
    groups.forEach((labels,side)=>{
      labels.sort((a,b)=>a.y-b.y);
      labels.forEach((label,i)=>{label.y=32+(height-56)*(i+.5)/labels.length});
      labels.forEach(({arc,i,angle,y})=>{
        const edge=side?width-5:5;
        const anchor=side?width-78:78;
        const startX=arc.x+Math.cos(angle)*(arc.outerRadius+3);
        const startY=arc.y+Math.sin(angle)*(arc.outerRadius+3);
        const laneX=arc.x+(side?1:-1)*(arc.outerRadius+7);
        const targetY=y-9;
        ctx.strokeStyle='#91abc5';ctx.lineWidth=.9;ctx.beginPath();
        ctx.moveTo(startX,startY);
        ctx.bezierCurveTo(laneX,startY,laneX,targetY,anchor,targetY);
        ctx.stroke();
        ctx.fillStyle=dataset.backgroundColor[i];ctx.beginPath();
        ctx.arc(startX,startY,2,0,Math.PI*2);ctx.fill();
        ctx.textAlign=side?'right':'left';ctx.fillStyle='#e7f0fa';ctx.font='10px Arial';
        const full=chart.data.labels[i];
        const words=full.split(/\s+/);let lines=[''];
        words.forEach(word=>{const last=lines.length-1;const next=(lines[last]+' '+word).trim();if(ctx.measureText(next).width>68&&lines[last])lines.push(word);else lines[last]=next});
        if(lines.length>2){lines=lines.slice(0,2);lines[1]+='…'}
        lines=lines.map(line=>{while(ctx.measureText(line).width>68&&line.length>1)line=line.slice(0,-2)+'…';return line});
        lines.forEach((line,j)=>ctx.fillText(line,edge,y-12+(j-(lines.length-1))*11));
        ctx.fillStyle='#fff';ctx.font='bold 10px Arial';
        ctx.fillText(`${dataset.data[i]} (${Math.round(dataset.data[i]/total*100)}%)`,edge,y+2);
      });
    });
    ctx.restore();
  }
};
