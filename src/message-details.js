// Self-contained: executed in WhatsApp's MAIN world by chrome.scripting.
// WhatsApp's message models keep what its DOM omits for photo-only rows:
// sender, exact time, type and caption. IDs it does not know are left out.
export async function messageDetails(ids) {
 try {
  const WPP=globalThis.WPP,chat=WPP?.chat?.getActiveChat?.(),chatId=chat?.id?._serialized;
  if(!chatId)throw Error('WA-JS no está listo. Espera unos segundos y vuelve a intentarlo.');
  // DOM IDs may be the bare stanza ID; group keys also end with the participant.
  const rawOf=id=>String(id).replace(/^(?:true|false)_[^_]+_/,'').split('_')[0];
  const index=new Map();
  const add=m=>{const key=m?.id;if(key?.id && (key.remote?._serialized || String(key.remote))===chatId && !index.has(key.id))index.set(key.id,m)};
  chat.msgs?.getModelsArray?.().forEach(add);
  if(ids.some(id=>!index.has(rawOf(id))))WPP.whatsapp?.MsgStore?.getModelsArray?.().forEach(add);
  let me=null;try{me=WPP.profile?.getMyProfileName?.() || null}catch{}
  const contact=wid=>{try{return wid?WPP.whatsapp?.ContactStore?.get?.(wid) || null:null}catch{return null}};
  const nameOf=c=>c?.isMe?me:c?.name || c?.pushname || c?.verifiedName || c?.formattedName || null;
  const textOf=m=>{
   const type=String(m?.type || '');
   if(type==='chat')return typeof m.body==='string'?m.body:'';
   if(type==='poll_creation')return typeof m.pollName==='string'?m.pollName:'';
   // Media bodies can hold a base64 thumbnail; only the caption is text.
   return typeof m.caption==='string'?m.caption:'';
  };
  const out={};
  for(const id of ids){
   const m=index.get(rawOf(id));if(!m)continue;
   const fromMe=!!m.id.fromMe,q=m.quotedMsg;
   let sender=null;if(!fromMe){try{sender=m.senderObj || contact(m.author || m.from)}catch{sender=contact(m.author || m.from)}}
   out[id]={id:m.id._serialized,fromMe,author:fromMe?me:nameOf(sender) || (typeof m.notifyName==='string'?m.notifyName:null),
    t:Number.isFinite(m.t)?m.t:null,type:String(m.type || ''),subtype:m.subtype?String(m.subtype):null,text:textOf(m),
    forwarded:!!m.isForwarded,filename:typeof m.filename==='string'?m.filename:null,
    duration:Number(m.duration)>0?Number(m.duration):null,
    quoted:m.quotedStanzaID?{id:String(m.quotedStanzaID),type:q?.type?String(q.type):null,text:q?textOf(q) || null:null,
     author:m.quotedParticipant?nameOf(contact(m.quotedParticipant)):null}:null};
  }
  return out;
 }catch(error){return {__error:String(error?.message || error)}}
}

// Finds the full serialized key of a bare DOM ID among loaded messages first;
// building the key by hand misses group messages, whose key names the participant.
export async function resolveMessageId(raw) {
 try {
  const WPP=globalThis.WPP,chat=WPP?.chat?.getActiveChat?.(),chatId=chat?.id?._serialized;
  if(!chatId || !WPP.chat.getMessageById)throw Error('WA-JS no puede resolver este ID en el chat abierto. Se conserva el contenido visible.');
  const own=m=>m?.id?.id===raw && (m.id.remote?._serialized || String(m.id.remote))===chatId;
  const loaded=chat.msgs?.getModelsArray?.().find(own) || WPP.whatsapp?.MsgStore?.getModelsArray?.().find(own);
  if(loaded?.id?._serialized)return loaded.id._serialized;
  for(const fromMe of [true,false]){
   try{
    const msg=await WPP.chat.getMessageById(`${fromMe}_${chatId}_${raw}`);
    if(WPP.chat.getActiveChat()?.id?._serialized!==chatId)throw Error('Chat cambiado.');
    if(msg?.id?.id===raw && msg.id.remote?._serialized===chatId)return msg.id._serialized;
   }catch{}
  }
  throw Error('Original no disponible para este mensaje. Se conserva la cita visible.');
 }catch(error){return {__error:String(error?.message || error)}}
}
