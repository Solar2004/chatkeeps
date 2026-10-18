const allowedId = value => typeof value === 'string' && /^(?:(?:true|false)_[\w@.:-]+|[A-Za-z0-9]{12,128})$/.test(value) && value.length < 512;
import {repeatMessage} from './repeat-message.js';
import {messageDetails,resolveMessageId} from './message-details.js';
async function inPage(tabId, func, args) {
  const [{result}] = await chrome.scripting.executeScript({target:{tabId}, world:'MAIN', func, args});
  if(result?.__error) throw new Error(result.__error);
  return result;
}
async function resolveId(tabId,id) {
  if(/^(true|false)_/.test(id))return id;
  return inPage(tabId,resolveMessageId,[id]);
}
chrome.action.onClicked.addListener(async tab=>{
  if(!tab.id || !tab.url?.startsWith('https://web.whatsapp.com/'))return;
  try{await chrome.tabs.sendMessage(tab.id,{type:'TOGGLE'})}catch{
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  }
});
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  (async()=>{
    if(!sender.tab?.id || !sender.url?.startsWith('https://web.whatsapp.com/'))throw new Error('Solicitud rechazada fuera de WhatsApp Web.');
    if(msg.type==='REPEAT_TARGET')return inPage(sender.tab.id,()=>globalThis.WPP?.chat?.getActiveChat?.()?.id?._serialized || null,[]);
    if(msg.type==='REPEAT')return inPage(sender.tab.id,repeatMessage,[msg.command,msg.options]);
    if(msg.type==='DETAILS'){
      if(!Array.isArray(msg.ids) || msg.ids.length>500)throw new Error('Lista de mensajes no válida.');
      const ids=msg.ids.filter(allowedId);
      return ids.length?inPage(sender.tab.id,messageDetails,[ids]):{};
    }
    if(msg.type==='QUOTE'){
      if(!allowedId(msg.id))throw new Error('ID de mensaje no válido.');
      const result=await inPage(sender.tab.id,async id=>{
        try{
          if(!globalThis.WPP?.chat?.getQuotedMsg)throw new Error('WA-JS no está listo. Espera unos segundos y prueba otra vez.');
          const q=await WPP.chat.getQuotedMsg(id);if(!q)return {id:null,text:null,source:'unresolved'};
          const body=typeof q.body==='string'?q.body:null;
          return {id:q.id?._serialized || (q.id == null ? null : String(q.id)),text:body,type:q.type || 'unknown',author:(()=>{try{const c=q.senderObj;return c?.isMe?(WPP.profile?.getMyProfileName?.() || null):c?.name || c?.pushname || c?.verifiedName || c?.formattedName || null}catch{return null}})(),timestamp:Number.isFinite(q.t)?q.t:null,source:'wa-js'};
        }catch(e){return {__error:String(e?.message || e)}}
      },[await resolveId(sender.tab.id,msg.id)]);
      return result;
    }
    if(msg.type==='MEDIA'){
      if(!allowedId(msg.id))throw new Error('ID de mensaje no válido.');
      return await inPage(sender.tab.id,async id=>{
        try{
          if(!globalThis.WPP?.chat?.downloadMedia)throw new Error('WA-JS no está listo. Espera unos segundos y prueba otra vez.');
          const blob=await WPP.chat.downloadMedia(id);if(!blob)throw new Error('WhatsApp no devolvió el archivo. Puede haber caducado.');
          if(blob.size>20*1024*1024)throw new Error('El archivo supera 20 MB. No se incluirá en la exportación.');
          const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
          for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
          return {base64:btoa(binary),mime:blob.type || 'application/octet-stream',size:blob.size};
        }catch(e){return {__error:String(e?.message || e)}}
      },[await resolveId(sender.tab.id,msg.id)]);
    }
    if(msg.type==='TRANSCRIBE'){
      if(typeof msg.token!=='string' || msg.token.length<20 || msg.token.length>200)throw new Error('Clave local no válida.');
      if(typeof msg.base64!=='string' || msg.base64.length>36_000_000)throw new Error('Audio ausente o demasiado grande.');
      const response=await fetch('http://127.0.0.1:8766/transcribe',{method:'POST',headers:{'Authorization':`Bearer ${msg.token}`,'Content-Type':'application/json'},body:JSON.stringify({audio:msg.base64,mime:msg.mime || 'application/octet-stream'})});
      const data=await response.json().catch(()=>({error:`HTTP ${response.status}`}));if(!response.ok)throw new Error(data.error || `HTTP ${response.status}`);
      return {text:String(data.text || ''),language:data.language || null,duration:data.duration || null};
    }
    throw new Error('Operación desconocida.');
  })().then(data=>respond({ok:true,data})).catch(e=>respond({ok:false,error:String(e?.message || e)}));
  return true;
});
