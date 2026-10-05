// Self-contained: executed in WhatsApp's MAIN world by chrome.scripting.
export function repeatMessage(command, options={}) {
 try {
  const key='__chatkeepsRepeat';
  let state=globalThis[key];
  const snapshot=()=>state?{active:state.active,pending:state.pending,sent:state.sent,total:state.total,nextAt:state.nextAt,chat:state.chat,status:state.status}:null;
  if(command==='status')return snapshot();
  if(command==='stop'){state?.stop('Detenido. Un envío ya iniciado puede completarse.');return snapshot()}
  if(command!=='start')throw Error('Acción no válida.');
  if(state?.active || state?.pending)throw Error('Ya hay un envío en curso. Espera a que termine.');
  const {text,seconds,count,expectedChat}=options;
  if(typeof text!=='string' || !text.trim() || text.length>4096)throw Error('Escribe un mensaje de 1 a 4096 caracteres.');
  if(!Number.isInteger(seconds) || seconds<1 || seconds>86400)throw Error('Intervalo: de 1 a 86400 segundos enteros.');
  if(!Number.isInteger(count) || count<1 || count>100)throw Error('Cantidad: de 1 a 100 mensajes.');
  const api=globalThis.WPP?.chat;
  const activeId=()=>api?.getActiveChat?.()?.id?._serialized;
  if(!api?.sendTextMessage || !expectedChat || activeId()!==expectedChat)throw Error('El chat cambió o WhatsApp todavía no está listo. Vuelve a iniciar.');
  state={active:true,pending:false,sent:0,total:count,chat:expectedChat,nextAt:0,status:'Esperando el primer envío.'};
  globalThis[key]=state;
  let timer,watch;
  state.stop=reason=>{state.active=false;state.nextAt=0;state.status=reason;clearTimeout(timer);clearInterval(watch)};
  const schedule=()=>{state.nextAt=Date.now()+seconds*1000;timer=setTimeout(send,seconds*1000)};
  async function send(){
   if(!state.active)return;
   if(activeId()!==expectedChat){state.stop('Detenido: cambiaste de chat.');return}
   state.pending=true;state.nextAt=0;state.status='Enviando…';
   try{
    await api.sendTextMessage(expectedChat,text,{createChat:false});
    state.sent++;
    if(!state.active)return;
    if(activeId()!==expectedChat){state.stop('Detenido: cambiaste de chat.');return}
    if(state.sent>=count){state.stop('Secuencia completada.');return}
    state.status='Esperando el próximo envío.';schedule();
   }catch{state.stop('Envío no confirmado. Se detuvo sin reintentar para evitar duplicados.');}
   finally{state.pending=false}
  }
  watch=setInterval(()=>{if(activeId()!==expectedChat)state.stop('Detenido: cambiaste de chat.')},250);
  schedule();return snapshot();
 }catch(error){return {__error:String(error.message || error)}}
}
