import {mergeOrder,preferRicher} from './core.js';

// Read before every scroll: virtualized rows can be removed on the next frame.
// The caller supplies the chat guard, so cancellation never crosses conversations.
export async function captureForward({startId,read,pane,guard,progress,
  wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=()=>Date.now(),
  maxMs=300000,maxMessages=20000}) {
  const messages=new Map();let order=[],started=false,stable=0,previousEnd='';
  const deadline=now()+maxMs;let warning='';
  while(true){
    guard();const batch=read();const ids=batch.map(m=>m.id);
    if(!started){const first=ids.indexOf(startId);if(first<0)throw new Error('El mensaje inicial ya no está visible. Vuelve a elegirlo.');started=true;}
    const previous=new Set(order);
    order=mergeOrder(order,ids,'after');order=order.slice(order.indexOf(startId));
    for(const m of batch)if(order.includes(m.id))messages.set(m.id,preferRicher(messages.get(m.id),m));
    progress(order.map(id=>messages.get(id)));
    if(order.length>=maxMessages){warning=`Captura parcial: se alcanzó el límite de ${maxMessages} mensajes.`;break}
    if(now()>=deadline){warning='Captura parcial: se alcanzó el límite de espera. Puedes exportar lo recogido.';break}
    const viewport=pane();
    if(!viewport){warning='Se capturaron los mensajes cargados; no se pudo verificar si hay mensajes posteriores.';break}
    const atEnd=viewport.scrollHeight-viewport.clientHeight-viewport.scrollTop<5;
    const end=`${order.at(-1)}:${viewport.scrollHeight}`;
    if(atEnd && end===previousEnd)stable++;else stable=0;
    previousEnd=end;
    if(stable>=4){warning='Se alcanzó el final cargado de WhatsApp. El historial que WhatsApp no haya sincronizado puede faltar.';break}
    // Missing overlap means a jump or an external scroll, not proof of a contiguous range.
    if(previous.size && ids.length && !ids.some(id=>previous.has(id))){
      warning='Captura parcial: WhatsApp saltó un tramo sin mensajes comunes. Vuelve al inicio y repite sin desplazar el chat durante la captura.';break;
    }
    if(!atEnd)viewport.scrollTop+=Math.max(1,viewport.clientHeight*.55);
    await wait(atEnd?650:220);
  }
  guard();return {messages:order.map(id=>messages.get(id)),warning};
}
