// Pointer state lives outside message elements: WhatsApp recycles those while scrolling.
export function installDragSelection({rows,scrollPane,isActive,sync,selectBetween,onDirection,onFinish}) {
  let gesture=null,frame=0,suppressClick=false;
  const root=document.documentElement;
  function cancel(){
    const previous=gesture;gesture=null;cancelAnimationFrame(frame);frame=0;
    if(previous?.dragging)suppressClick=true;
    if(previous && root.hasPointerCapture(previous.pointerId))root.releasePointerCapture(previous.pointerId);
  }
  function sample(g){
    sync();if(gesture!==g || !isActive())return;
    const pane=scrollPane();const clip=pane?.getBoundingClientRect();
    if(clip && (g.x<clip.left || g.x>clip.right))return;
    // Sweep the vertical interval so fast pointer moves do not skip short bubbles.
    const top=Math.max(clip?.top ?? 0,Math.min(g.lastY,g.y));
    const bottom=Math.min(clip?.bottom ?? innerHeight,Math.max(g.lastY,g.y));
    const batch=rows().filter(el=>{const r=el.getBoundingClientRect();return r.bottom>top && r.top<bottom+1 && r.bottom>0 && r.top<innerHeight});
    if(g.y<g.lastY)batch.reverse();
    for(const row of batch){selectBetween(g.lastId,row.dataset.id);g.lastId=row.dataset.id;}
    g.lastY=g.y;
  }
  function tick(time){
    const g=gesture;if(!g?.dragging)return;
    if(time-g.sampledAt>=50){
      g.sampledAt=time;sample(g);if(gesture!==g)return;
      const pane=scrollPane(),box=pane?.getBoundingClientRect();
      if(box && g.x>=box.left && g.x<=box.right){
        const top=Math.max(0,box.top),bottom=Math.min(innerHeight,box.bottom);
        const direction=g.y<top+36?-1:g.y>bottom-36?1:0;
        if(direction){onDirection(direction);pane.scrollTop+=direction*18;}
      }
    }
    if(gesture===g)frame=requestAnimationFrame(tick);
  }
  document.addEventListener('pointerdown',e=>{
    suppressClick=false;
    if(!isActive() || e.button!==0 || e.pointerType==='touch')return;
    sync();const row=rows().find(el=>el.contains(e.target));if(!row)return;
    cancel();suppressClick=false;
    gesture={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,lastY:e.clientY,lastId:row.dataset.id,firstId:row.dataset.id,dragging:false,sampledAt:0};
    e.preventDefault();e.stopImmediatePropagation();
  },true);
  document.addEventListener('pointermove',e=>{
    const g=gesture;if(!g || e.pointerId!==g.pointerId)return;
    if(!(e.buttons&1)){cancel();return;}
    g.x=e.clientX;g.y=e.clientY;
    if(!g.dragging && Math.hypot(g.x-g.startX,g.y-g.startY)>=4){
      g.dragging=true;root.setPointerCapture(g.pointerId);
      selectBetween(g.firstId,g.firstId);frame=requestAnimationFrame(tick);
    }
    if(g.dragging){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('pointerup',e=>{
    const g=gesture;if(!g || e.pointerId!==g.pointerId)return;
    if(g.dragging){g.x=e.clientX;g.y=e.clientY;sample(g);if(gesture===g)onFinish(g.firstId);e.preventDefault();e.stopImmediatePropagation();}
    cancel();
  },true);
  document.addEventListener('pointercancel',cancel,true);
  root.addEventListener('lostpointercapture',()=>{if(gesture?.dragging)cancel()});
  window.addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
  return {cancel,consumeClick(){const value=suppressClick;suppressClick=false;return value}};
}
