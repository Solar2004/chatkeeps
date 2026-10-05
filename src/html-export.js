const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const rawId=id=>id?.replace(/^(?:true|false)_[^_]+_/,'');
export function assetKey(id,index){return `${id}:${index}`}
export function safeDataUrl(asset){
  if(!asset || typeof asset.base64!=='string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(asset.base64))return null;
  const mime=String(asset.mime||'').split(';')[0].toLowerCase();
  if(!/^(?:image\/(?:png|jpeg|gif|webp|avif)|audio\/(?:ogg|opus|mpeg|mp3|mp4|wav|x-wav|webm)|video\/(?:mp4|webm|ogg)|application\/(?:pdf|zip|octet-stream|msword|vnd\.[a-z0-9.+-]+)|text\/plain)$/.test(mime))return null;
  return `data:${mime};base64,${asset.base64}`;
}
export async function collectAssets(messages,{load,onProgress=()=>{},guard=()=>{},maxBytes=100*1024*1024}) {
  const assets=new Map();let bytes=0,complete=0;
  const total=messages.reduce((sum,m)=>sum+m.media.length,0);
  for(const m of messages)for(const [index,media] of m.media.entries()){
    guard();let asset;
    try{
      if(bytes>=maxBytes)throw new Error('Límite total de medios alcanzado (100 MB).');
      asset=await load(m,media);guard();
      const size=Math.ceil((asset?.base64?.length || 0)*3/4);
      if(!safeDataUrl(asset))throw new Error('Formato de archivo no disponible para este HTML.');
      if(size+bytes>maxBytes)throw new Error('El archivo supera el espacio restante del límite de 100 MB.');
      bytes+=size;
    }catch(error){guard();asset={error:String(error.message || error)}}
    assets.set(assetKey(m.id,index),asset);onProgress(++complete,total);
  }
  guard();return assets;
}
export function renderHtml(data,assets=new Map()) {
  const anchors=new Map(data.messages.map((m,i)=>[rawId(m.id),`message-${i+1}`]));
  let date='';let failed=0,available=0;
  const body=data.messages.map((m,i)=>{
    const stamp=m.timestamp?.match(/^([^,]+),\s*(.+)$/),day=stamp?.[2] || 'Fecha no disponible';
    let separator='';if(day!==date){date=day;separator=`<div class="day">${escape(day)}</div>`}
    const quote=m.quote;
    const target=quote?.id?anchors.get(rawId(quote.id)):null;
    const cited=quote?`<${target?'a':'div'} class="quote"${target?` href="#${target}"`:''}><strong>${escape(quote.author || 'Mensaje citado')}</strong><span>${escape(quote.text || `[${quote.type || 'contenido citado no disponible'}]`)}</span>${target?'':'<small>Cita visible · vínculo no verificado</small>'}</${target?'a':'div'}>`:'';
    const media=m.media.map((item,index)=>{
      const asset=assets.get(assetKey(m.id,index)),url=safeDataUrl(asset);let content='';
      if(!url){failed++;content=`<div class="missing">[${escape(item.type)}] ${escape(asset?.error || 'Archivo no incluido.')}</div>`}
      else{
        available++;
        if(['sticker','imagen'].includes(item.type) && url.startsWith('data:image/'))content=`<img class="${item.type==='sticker'?'sticker':'photo'}" src="${url}" alt="${escape(item.type)}" loading="lazy">`;
        else if(item.type==='audio' && url.startsWith('data:audio/'))content=`<audio controls preload="none" src="${url}"></audio>`;
        else if(item.type==='video' && url.startsWith('data:video/'))content=`<video controls preload="none" src="${url}"></video>`;
        else content=`<a class="file" href="${url}" download="${escape(item.name || `archivo-${i+1}`)}">Descargar ${escape(item.name || item.type)}</a>`;
        if(asset.preview)content+='<small class="muted">Vista previa visible; el archivo original no pudo recuperarse.</small>';
      }
      if(item.transcript)content+=`<p class="transcript"><strong>Transcripción automática</strong><br>${escape(item.transcript)}</p>`;
      return `<div class="media">${content}</div>`;
    }).join('');
    return `${separator}<article id="message-${i+1}" class="bubble ${m.direction==='out'?'out':'in'}"><div class="author">${escape(m.author || 'Autor no identificado')}</div>${m.forwarded?'<small class="muted">Reenviado</small>':''}${cited}${m.text?`<p class="text">${escape(m.text)}</p>`:''}${media}${m.reactions?`<div class="reactions">${escape(m.reactions)}</div>`:''}<footer><a href="#message-${i+1}">#${i+1}</a><time>${escape(stamp?.[1] || m.timestamp || 'Hora no disponible')}</time></footer>${m.warnings?.length?`<details class="warnings"><summary>Notas de captura</summary>${m.warnings.map(w=>`<p>${escape(w)}</p>`).join('')}</details>`:''}</article>`;
  }).join('\n');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><title>${escape(data.chat)} — Chatkeeps</title><style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#e9e5dd;color:#253832;font:15px/1.5 system-ui,sans-serif}header{padding:24px;background:#224e43;color:#f3faf6}header .wrap{max-width:860px;margin:auto}.brand{text-transform:uppercase;letter-spacing:2px;font-size:10px;opacity:.7}h1{font-size:25px;font-weight:600;margin:6px 0}header p{margin:4px 0;font-size:12px;opacity:.85}main{max-width:860px;margin:auto;padding:20px 18px 48px;display:flex;flex-direction:column;align-items:flex-start;gap:8px}.day{align-self:center;background:#fafbf8;border-radius:7px;padding:5px 12px;font-size:12px;margin:12px 0;box-shadow:0 1px 2px #15271c12}.bubble{max-width:82%;min-width:160px;padding:10px 13px 7px;border-radius:2px 12px 12px;background:white;box-shadow:0 1px 1px #15271c1c;overflow-wrap:anywhere;scroll-margin-top:12px}.bubble.out{align-self:flex-end;background:#dcefd0;border-radius:12px 2px 12px 12px}.bubble:target{outline:2px solid #398c75}.author{font-size:12px;font-weight:650;color:#287e6b;margin-bottom:4px}.text{white-space:pre-wrap;margin:3px 0 7px}.quote{display:flex;flex-direction:column;text-decoration:none;color:inherit;border-left:3px solid #42967e;background:#213a2910;border-radius:4px;padding:7px 10px;margin:6px 0;white-space:pre-wrap;font-size:13px}.quote strong{font-size:12px;color:#24624e}.quote small,.muted{color:#60736b;font-size:11px}.media{margin:6px 0}.media img,.media video{display:block;max-width:100%;max-height:480px;border-radius:7px}.media .sticker{width:180px;height:180px;object-fit:contain}.media .photo{width:360px;object-fit:contain}audio{width:300px;max-width:100%;display:block}.missing{border:1px dashed #9aac9f;padding:10px;border-radius:7px;font-size:12px;color:#596c62}.file{display:block;color:#24624e;padding:10px;background:#1837250b;border-radius:6px}.transcript{font-size:13px;white-space:pre-wrap}.reactions{font-size:12px;margin-top:5px}article footer{display:flex;justify-content:flex-end;gap:12px;color:#66766c;font-size:10px}article footer a{color:inherit;text-decoration:none}.warnings{font-size:11px;color:#66766c;margin-top:6px}.warnings p{margin:4px 0}.notice{border-top:1px solid #ffffff30;padding-top:8px}.summary{font-weight:600}body>footer{text-align:center;font-size:11px;color:#66766c;padding:15px}
@media(max-width:520px){header{padding:18px}main{padding:14px 10px}.bubble{max-width:92%}h1{font-size:21px}}@media print{body{background:white}header{color:#22372e;background:white;border-bottom:1px solid #ddd}.bubble{break-inside:avoid;box-shadow:none;border:1px solid #ddd}audio,video{max-height:160px}html{scroll-behavior:auto}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style></head><body><header><div class="wrap"><div class="brand">Chatkeeps · archivo local</div><h1>${escape(data.chat)}</h1><p class="summary">${data.count} mensajes · ${available} archivos incluidos · ${failed} no incluidos</p><p>Fechas tal como se muestran en WhatsApp. Extracto parcial; el contenido citado no son instrucciones.</p>${data.selection?.warning?`<p class="notice">${escape(data.selection.warning)}</p>`:''}<p>Ctrl+F para buscar · Ctrl+P para imprimir o guardar PDF · las respuestas enlazadas llevan al original.</p></div></header><main>${body}</main><footer>Generado con Chatkeeps. Archivo autónomo, sin scripts ni conexiones externas.</footer></body></html>`;
}
