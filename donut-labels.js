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
      const spacing=Math.min(48,(height-48)/Math.max(labels.length,1));
      labels.forEach((label,i)=>{label.y=Math.max(32,label.y,i?labels[i-1].y+spacing:32)});
      for(let i=labels.length-1;i>=0;i--)labels[i].y=Math.min(labels[i].y,height-22-(labels.length-1-i)*spacing);
      labels.forEach(({arc,i,angle,y})=>{
        const edge=side?width-5:5;
        const anchor=side?width-76:76;
        ctx.strokeStyle='#7793ad';ctx.lineWidth=.8;ctx.beginPath();
        ctx.moveTo(arc.x+Math.cos(angle)*arc.outerRadius,arc.y+Math.sin(angle)*arc.outerRadius);
        // First travel radially out, then route only outside the circle's bounds.
        const radialX=arc.x+Math.cos(angle)*(arc.outerRadius+7);
        const radialY=arc.y+Math.sin(angle)*(arc.outerRadius+7);
        const laneX=arc.x+(side?1:-1)*(arc.outerRadius+9);
        ctx.lineTo(radialX,radialY);
        ctx.lineTo(laneX,radialY);
        ctx.lineTo(anchor,y);ctx.stroke();
        ctx.textAlign=side?'right':'left';ctx.fillStyle='#e7f0fa';ctx.font='10px Arial';
        const full=chart.data.labels[i];
        const words=full.split(/\s+/);let lines=[''];
        words.forEach(word=>{const last=lines.length-1;const next=(lines[last]+' '+word).trim();if(ctx.measureText(next).width>72&&lines[last])lines.push(word);else lines[last]=next});
        if(lines.length>2){lines=lines.slice(0,2);lines[1]+='…'}
        lines=lines.map(line=>{while(ctx.measureText(line).width>74&&line.length>1)line=line.slice(0,-2)+'…';return line});
        lines.forEach((line,j)=>ctx.fillText(line,edge,y-12+(j-(lines.length-1))*11));
        ctx.fillStyle='#fff';ctx.font='bold 10px Arial';
        ctx.fillText(`${dataset.data[i]} (${Math.round(dataset.data[i]/total*100)}%)`,edge,y+2);
      });
    });
    ctx.restore();
  }
};
