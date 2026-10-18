import {validateCount,mergeOrder,makeExport,formatText,applyDetails,preferRicher} from './core.js';
import {rows,extract,chatInfo,scrollPane} from './dom.js';
import css from './panel.css';
import selectionCss from './selection.css';
import {installDragSelection} from './drag-selection.js';
import {captureForward} from './capture-forward.js';
import {collectAssets,renderHtml,mediaIssues,issueLine,issueSummary} from './html-export.js';
if(globalThis.__whatsappContext){globalThis.__whatsappContext.toggle();}else{boot();}
chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='TOGGLE')globalThis.__whatsappContext?.toggle();});
function boot(){
const host=document.createElement('div');host.id='chatkeeps-root';document.documentElement.append(host);
const shadow=host.attachShadow({mode:'open'});
shadow.innerHTML=`<style>${css}</style>
<div id="dock" aria-label="Chatkeeps">
<button id="launcher" aria-label="Abrir Chatkeeps" aria-expanded="false" aria-controls="panel" title="Chatkeeps · arrastra el icono para moverlo"><svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-6 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m8 11 3 3 5-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<span id="dock-count" class="sr-only" aria-label="Mensajes seleccionados">0</span>
<span id="dock-status" class="sr-only" role="status" aria-live="polite"></span></div>
<section id="panel" hidden aria-label="Chatkeeps"><header><div class="head"><div><span class="eyebrow">Guarda tu conversación <small>0.6.0</small></span><h1>Chatkeeps</h1></div><button id="close" class="icon" aria-label="Minimizar panel" title="Plegar al icono">−</button></div><span id="chat">Abre una conversación</span></header><div class="body">
<details id="repeat"><summary>Enviar por intervalos</summary><label for="repeat-text">Mensaje</label><textarea id="repeat-text" maxlength="4096" placeholder="Te amo ❤️"></textarea><div class="row"><label>Segundos<input id="repeat-seconds" type="number" min="1" max="86400" step="1" value="10"></label><label>Veces<input id="repeat-count" type="number" min="1" max="100" step="1" value="5"></label></div><p class="help">Al chat abierto. Cambiar de chat o recargar lo detiene.</p><div class="row"><button id="repeat-start">Iniciar envíos</button><button id="repeat-stop" disabled>Detener</button></div><p id="repeat-status" class="help" role="status">Sin envíos programados.</p></details>
<label for="quantity">Capturar los últimos</label><div class="row presets"><button data-n="10">10</button><button data-n="100">100</button><button data-n="200">200</button><input id="quantity" type="number" min="1" max="5000" step="1" value="100" aria-label="Cantidad de mensajes"><button id="capture">Capturar</button><button id="cancel" hidden disabled>Cancelar</button></div>
<div class="row"><button id="select" aria-pressed="false">Marcar mensajes</button><button id="range">Usar texto marcado</button></div>
<button id="since" class="range-action" aria-pressed="false">Desde un mensaje hasta el final</button>
<p class="help">Marcar: arrastra o haz clic sobre los mensajes; Esc termina. «Desde un mensaje»: pulsa y elige el mensaje inicial.</p>
<div class="preview-head"><label for="preview">Vista previa</label><span id="count">0 mensajes</span><button id="clear" class="quiet">Limpiar</button></div>
<textarea id="preview" readonly placeholder="Captura o marca mensajes para verlos aquí."></textarea>
<details id="advanced"><summary>Citas, audios y exportación</summary>
<div class="row"><button id="quotes" disabled>Completar citas</button><button id="json" disabled>Guardar JSON</button></div>
<button id="txt" disabled>Guardar texto (.txt)</button>
<p class="help">El texto usa referencias cortas. El JSON conserva los IDs originales.</p>
<details><summary>Audios y transcripción local</summary><p class="help">«Obtener audio» usa WA-JS en esta pestaña y descarga el archivo disponible. «Transcribir» lo envía únicamente al servicio local 127.0.0.1:8766. La clave local permanece en memoria hasta recargar la página. No se usa ninguna API de IA externa.</p><label for="token">Clave del servicio local</label><input id="token" type="password" autocomplete="off" placeholder="La imprime iniciar-transcripcion.sh"><div id="audios"></div></details>
<button id="diagnose" disabled>Copiar diagnóstico técnico</button><p class="help">Para reportar fallos. Sin textos, nombres ni números.</p>
<small id="diagnostic"></small></details>
</div><footer><div id="status" role="status" aria-live="polite">Captura o marca mensajes para empezar.</div><label class="check"><input id="include-media" type="checkbox" checked> Incluir archivos en el HTML</label><div class="export-actions"><button id="copy" disabled>Copiar texto</button><button id="html" class="primary" disabled>Exportar HTML</button></div></footer></section>`;
const $=id=>shadow.getElementById(id);
let info=chatInfo(),store=new Map(),order=[],selected=new Map(),mode='manual',warning='',picking=false,anchor=null,range=null,running=false,abort=false,visible=false,fromHere=false;
const audioFiles=new Map();let renderedAudioKey='';
// WhatsApp's own record of each selected message, by DOM ID; null when WA-JS did not know it.
const details=new Map();let detailsJob=Promise.resolve(),detailsTimer=null,detailsNote='';
const highlight=document.createElement('style');highlight.textContent=selectionCss;document.head.append(highlight);
let copyFeedback;
let scrollDirection='before',lastPane=null,lastScrollTop=0;
function readChat(){const current=chatInfo();if(current.main===info.main && current.name===info.name && !current.id && info.id){current.id=info.id;current.key=info.key;}return current}
function status(text,error=false){$('status').textContent=text;$('status').dataset.error=String(error);$('dock-status').textContent=text;$('dock').dataset.error=String(error);$('launcher').title=text}
function selection(){return order.filter(id=>selected.has(id)).map(id=>selected.get(id))}
function output(){return makeExport(info.name,selection(),{mode,warning:warning || null})}
function paint(){for(const el of rows()){
  const chosen=selected.has(el.dataset.id);if(chosen)el.dataset.hcSelected='true';else el.removeAttribute('data-hc-selected');
  if(picking)el.dataset.hcPicking='true';else el.removeAttribute('data-hc-picking');
}}
function refresh(){
 $('chat').textContent=info.name;$('count').textContent=`${selected.size} mensajes`;
 $('dock-count').textContent=String(selected.size);$('dock-count').setAttribute('aria-label',`${selected.size} mensajes seleccionados`);
 $('select').setAttribute('aria-pressed',String(picking));$('select').disabled=running;
 $('since').setAttribute('aria-pressed',String(fromHere));$('since').disabled=running;
 $('dock').dataset.active=String(picking || fromHere || running);
 $('launcher').setAttribute('aria-label',`Abrir Chatkeeps · ${selected.size} mensajes${running?' · trabajando':''}`);
 $('preview').value=selected.size?formatText(output()):'';
 for(const id of ['copy','html','txt','json','quotes','diagnose'])$(id).disabled=!selected.size || running;
 paint();renderAudios();scheduleDetails();
}
function clear(){dragSelection.cancel();fromHere=false;selected.clear();audioFiles.clear();anchor=null;mode='manual';warning='';renderedAudioKey='';refresh()}
function reset(newInfo){abort=true;store.clear();details.clear();detailsNote='';order=[];range=null;scrollDirection='before';lastPane=null;clear();info=newInfo;refresh();status('Has cambiado de chat. Selección anterior descartada.');}
function sync(){
 const current=readChat();
 if(current.main!==info.main || current.key!==info.key){reset(current);}
 $('chat').textContent=current.name;
 $('diagnostic').textContent=current.main?`${rows().length} mensajes visibles detectados.${detailsNote?` ${detailsNote}`:''}`:'No se detecta el contenedor del chat. Recarga WhatsApp; si persiste, su estructura no es compatible.';
 if(!current.main){$('chat').textContent='Abre una conversación';return []}
 const pane=scrollPane();if(pane && pane!==lastPane){lastPane=pane;lastScrollTop=pane.scrollTop;}
 const batch=rows().map(extract);order=mergeOrder(order,batch.map(m=>m.id),scrollDirection);
 for(const m of batch)store.set(m.id,preferRicher(store.get(m.id),m));
 if(order.length>10000){const keep=new Set([...selected.keys(),...order.slice(-5000)]);order=order.filter(id=>keep.has(id));store=new Map(order.map(id=>[id,store.get(id)]));}
 paint();return batch;
}
let repeatPoll,repeatBusy=false;
function showRepeat(state){
 const active=!!(state?.active || state?.pending);
 for(const id of ['repeat-start','repeat-text','repeat-seconds','repeat-count'])$(id).disabled=active;
 $('repeat-stop').disabled=!active;$('dock').dataset.sending=String(active);
 if(state)$('repeat-status').textContent=`${state.sent}/${state.total} · ${state.status}${state.nextAt?` Próximo en ${Math.max(0,Math.ceil((state.nextAt-Date.now())/1000))} s.`:''}`;
 clearTimeout(repeatPoll);if(active)repeatPoll=setTimeout(pollRepeat,1000);
}
async function pollRepeat(){try{showRepeat(await request('REPEAT',{command:'status'}))}catch(e){$('repeat-status').textContent=e.message;repeatPoll=setTimeout(pollRepeat,3000)}}
$('repeat-start').onclick=async()=>{
 if(repeatBusy)return;repeatBusy=true;$('repeat-start').disabled=true;
 try{
  const before=readChat();if(!before.main)throw Error('Abre el chat de destino.');
  const expectedChat=await request('REPEAT_TARGET');const after=readChat();
  if(before.main!==after.main || before.key!==after.key)throw Error('El chat cambió. Vuelve a iniciar.');
  const state=await request('REPEAT',{command:'start',options:{expectedChat,text:$('repeat-text').value,seconds:Number($('repeat-seconds').value),count:Number($('repeat-count').value)}});
  showRepeat(state);
 }catch(e){$('repeat-status').textContent=e.message;$('repeat-start').disabled=false}finally{repeatBusy=false}
};
$('repeat-stop').onclick=async()=>{try{showRepeat(await request('REPEAT',{command:'stop'}))}catch(e){$('repeat-status').textContent=e.message}};
pollRepeat();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function collect(){
 if(running)return;
 let n;try{n=validateCount($('quantity').value)}catch(e){status(e.message,true);return}
 sync();if(!info.main || !rows().length){status('Abre un chat con mensajes. Si ya está abierto, WhatsApp puede haber cambiado su estructura.',true);return}
 clear();picking=false;$('select').setAttribute('aria-pressed','false');mode='last';running=true;abort=false;
 for(const id of ['capture','select','range','clear'])$(id).disabled=true;$('cancel').disabled=false;$('cancel').hidden=false;refresh();
 const identity=info.key,main=info.main;let stopReason='',collected=new Map(),ids=[],newest=null;
 const guard=()=>{const c=readChat();if(abort || c.key!==identity || c.main!==main)throw new Error('Captura cancelada o chat cambiado. No se ha copiado nada.');};
 const harvest=()=>{guard();const batch=rows().map(extract);ids=mergeOrder(ids,batch.map(m=>m.id));for(const m of batch)collected.set(m.id,preferRicher(collected.get(m.id),m));if(newest){const pos=ids.indexOf(newest);if(pos>=0)ids=ids.slice(0,pos+1);}return batch};
 try{
 let pane=scrollPane();if(pane){pane.scrollTop=pane.scrollHeight;await pause(650);guard();pane=scrollPane();if(pane){pane.scrollTop=pane.scrollHeight;await pause(450);}}
 const initial=harvest();newest=initial.at(-1)?.id;if(!newest)throw new Error('No se pudo identificar el último mensaje.');
 const start=Date.now();let stalled=0;
 while(ids.length<n){
   guard();pane=scrollPane();if(!pane){stopReason='No hay más mensajes cargables en esta vista.';break}
   const before=ids.length;pane.scrollTop=Math.max(0,pane.scrollTop-pane.clientHeight*.70);await pause(350);harvest();
   status(`Recogidos ${Math.min(ids.length,n)} de ${n}. Puedes cancelar.`);
   if(ids.length===before){
     stalled++;
     if(pane.scrollTop<5){pane.scrollTop=Math.min(120,pane.clientHeight*.25);await pause(180);pane.scrollTop=0;await pause(700);harvest();}
   }else stalled=0;
   if(stalled>=6){stopReason='WhatsApp no cargó más mensajes. Puede faltar historial; carga mensajes anteriores y vuelve a intentar.';break}
   if(Date.now()-start>120000){stopReason='Límite de espera alcanzado. Reduce la cantidad o carga antes el historial.';break}
 }
 guard();const chosen=ids.slice(-n);order=mergeOrder(order,ids);for(const id of chosen){store.set(id,collected.get(id));selected.set(id,pick(collected.get(id)));}
 warning=chosen.length<n?`${chosen.length} de ${n} solicitados. ${stopReason}`:'';
 status(warning || `${chosen.length} mensajes preparados. Revisa la vista previa antes de copiar.`);
 }catch(e){selected.clear();status(e.message,true)}finally{running=false;$('cancel').disabled=true;$('cancel').hidden=true;for(const id of ['capture','select','range','clear'])$(id).disabled=false;refresh()}
}
function togglePick(){if(running)return;sync();fromHere=false;picking=!picking;if(!picking)dragSelection.cancel();refresh();status(picking?'Arrastra para marcar · bordes para subir/bajar · selección conservada al desplazarte · Esc termina.':'Selección desactivada.')}
function setBusy(value){running=value;for(const id of ['capture','range','clear'])$(id).disabled=value;$('cancel').disabled=!value;$('cancel').hidden=!value;refresh()}
async function collectSince(id){
 clear();picking=false;mode='from-message';abort=false;setBusy(true);
 const identity=info.key,main=info.main;
 const guard=()=>{const current=readChat();if(abort || current.key!==identity || current.main!==main)throw new Error('Captura detenida. Se conserva solo lo recogido del chat original.');};
 try{
  const result=await captureForward({startId:id,read:()=>rows().map(extract),pane:scrollPane,guard,
   progress:batch=>{order=mergeOrder(order,batch.map(m=>m.id),'after');for(const m of batch){store.set(m.id,preferRicher(store.get(m.id),m));selected.set(m.id,pick(store.get(m.id)))}refresh();status(`${selected.size} mensajes desde el inicio. Cargando los posteriores…`);}});
  warning=result.warning;status(`${result.messages.length} mensajes preparados. ${warning}`);
 }catch(e){warning=e.message;status(warning,true)}finally{setBusy(false);sync();refresh()}
}
$('since').onclick=()=>{if(running)return;sync();picking=false;dragSelection.cancel();fromHere=!fromHere;refresh();status(fromHere?'Haz clic en el mensaje inicial. Se incluirá junto con todos los posteriores que WhatsApp cargue.':'Selección de inicio cancelada.');if(fromHere && visible)toggle()};
function selectIds(ids){mode='manual';warning='';for(const id of ids)if(store.has(id) && !selected.has(id))selected.set(id,pick(store.get(id)));refresh();status(`${selected.size} mensajes seleccionados.`)}
const dragSelection=installDragSelection({rows,scrollPane,isActive:()=>picking && !running,sync,
  selectBetween:(from,to)=>{const a=order.indexOf(from),b=order.indexOf(to);if(a<0 || b<0)return;const ids=order.slice(Math.min(a,b),Math.max(a,b)+1);if(ids.some(id=>!selected.has(id)))selectIds(ids)},
  onDirection:direction=>{scrollDirection=direction>0?'after':'before'},onFinish:id=>{anchor=id}});
document.addEventListener('wheel',e=>{if(info.main?.contains(e.target) && e.deltaY)scrollDirection=e.deltaY>0?'after':'before'},{capture:true,passive:true});
document.addEventListener('scroll',e=>{const pane=scrollPane();if(!pane || e.target!==pane)return;if(pane===lastPane && pane.scrollTop!==lastScrollTop)scrollDirection=pane.scrollTop>lastScrollTop?'after':'before';lastPane=pane;lastScrollTop=pane.scrollTop;},{capture:true,passive:true});
document.addEventListener('click',e=>{
 if(dragSelection.consumeClick()){e.preventDefault();e.stopImmediatePropagation();return;}
 if(fromHere && !running && info.main?.contains(e.target)){const row=rows().find(row=>row.contains(e.target));if(row){e.preventDefault();e.stopImmediatePropagation();sync();collectSince(row.dataset.id);}return;}
 if(!picking || running || !info.main?.contains(e.target))return;
 const row=rows().find(row=>row.contains(e.target));if(!row)return;
 e.preventDefault();e.stopImmediatePropagation();sync();const id=row.dataset.id;
 if(e.shiftKey && anchor && order.includes(anchor)){
   const a=order.indexOf(anchor),b=order.indexOf(id);selectIds(order.slice(Math.min(a,b),Math.max(a,b)+1));
 }else{if(selected.has(id))selected.delete(id);else if(store.has(id))selected.set(id,pick(store.get(id)));anchor=id;mode='manual';warning='';refresh();status(`${selected.size} mensajes seleccionados.`)}
},true);
document.addEventListener('selectionchange',()=>{
 const s=getSelection();if(s?.rangeCount && !s.isCollapsed && info.main?.contains(s.anchorNode) && info.main?.contains(s.focusNode))range=s.getRangeAt(0).cloneRange();
});
$('range').onclick=()=>{sync();if(!range){status('Primero arrastra para marcar texto en la conversación.',true);return}
 try{const ids=rows().filter(r=>range.intersectsNode(r)).map(r=>r.dataset.id);if(!ids.length)throw new Error('La selección ya no está visible. Vuelve a marcarla.');selectIds(ids)}catch(e){status(e.message,true)}};
function pick(m){return applyDetails(m,details.get(m.id))}
function scheduleDetails(){
 if(detailsTimer || ![...selected.keys()].some(id=>!details.has(id)))return;
 detailsTimer=setTimeout(()=>{detailsTimer=null;loadDetails()},250);
}
// Fills author, exact time, type and full text from WhatsApp's message models.
// retry=true asks again for IDs WA-JS did not know earlier (e.g. before it was ready).
function loadDetails(retry=false){
 detailsJob=detailsJob.then(async()=>{
  if(retry)for(const [id,d] of details)if(!d)details.delete(id);
  const identity=info.key,missing=[...selected.keys()].filter(id=>!details.has(id));
  if(!missing.length)return;
  let error='';
  for(let i=0;i<missing.length;i+=200){
   const batch=missing.slice(i,i+200);let found={};
   try{found=await request('DETAILS',{ids:batch})}catch(e){error=e.message}
   if(info.key!==identity)return;
   for(const id of batch)details.set(id,found?.[id] || null);
  }
  for(const id of missing)if(details.get(id) && selected.has(id))selected.set(id,applyDetails(selected.get(id),details.get(id)));
  const known=[...selected.keys()].filter(id=>details.get(id)).length;
  detailsNote=`WhatsApp (WA-JS) reconoció ${known} de ${selected.size} mensajes seleccionados.${error?` Error: ${error}`:''}`;
  refresh();
 }).catch(()=>{});
 return detailsJob;
}
async function ready(){status('Completando autores, fechas y archivos con WhatsApp…');await loadDetails(true);sync();refresh()}
async function request(type,payload={}){
 let timer,cancelCheck;
 try{
  const result=await Promise.race([chrome.runtime.sendMessage({type,...payload}),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(new Error('WhatsApp no respondió a tiempo. Puedes volver a intentarlo.')),type==='TRANSCRIBE'?600000:45000);
   cancelCheck=setInterval(()=>{if(running && abort)reject(new Error('Operación cancelada.'))},150);
  })]);
  if(!result?.ok)throw new Error(result?.error || 'La extensión se recargó. Recarga WhatsApp Web.');return result.data;
 }finally{clearTimeout(timer);clearInterval(cancelCheck)}
}
$('quotes').onclick=async()=>{
 const identity=info.key;const targets=selection().filter(m=>m.quote);if(!targets.length){status('No hay citas detectadas en esta selección.');return}
 $('quotes').disabled=true;let completed=0;
 try{status('Recuperando originales citados con WA-JS…');
 for(const m of targets){const q=await request('QUOTE',{id:m.id});if(info.key!==identity)throw new Error('Chat cambiado.');if(selected.has(m.id)){
   if(q && q.source!=='unresolved' && (q.text || q.type && q.type!=='unknown')){
     const visible=selected.get(m.id).quote;
     selected.get(m.id).quote={...visible,...q,author:visible.author || q.author,text:q.text || visible.text};completed++;
   }
 }}status(`${completed} de ${targets.length} citas completadas. Las demás conservan la cita visible. Los originales no cuentan como mensajes seleccionados.`);
 }catch(e){status(`${completed} citas completadas. ${e.message}`,true)}finally{refresh()}
};
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
async function getAudio(id){
 if(audioFiles.has(id))return audioFiles.get(id);
 const identity=info.key;const data=await request('MEDIA',{id});if(info.key!==identity || !selected.has(id))throw new Error('Selección cambiada. Audio descartado.');
 const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:data.mime});audioFiles.set(id,blob);return blob;
}
function renderAudios(){
 const items=selection().filter(m=>m.media.some(x=>x.type==='audio'));
 const key=items.map(m=>m.id).join('|');if(key===renderedAudioKey)return;renderedAudioKey=key;$('audios').replaceChildren();
 if(!items.length){const p=document.createElement('p');p.className='help';p.textContent='Los audios de tu selección aparecerán aquí.';$('audios').append(p)}
 for(const m of items){const div=document.createElement('div');div.className='audio-item';const title=document.createElement('p');title.textContent=`${m.author || 'Autor desconocido'} / ${m.timestamp || 'Sin fecha'}`;div.append(title);
 const controls=document.createElement('div');controls.className='row';div.append(controls);
 for(const [label,act] of [['Obtener audio','get'],['Transcribir','transcribe']]){
 const b=document.createElement('button');b.textContent=label;controls.append(b);b.onclick=async()=>{b.disabled=true;const identity=info.key;try{
   if(act==='transcribe' && !$('token').value.trim())throw new Error('Inicia el servicio local y pega su clave antes de transcribir.');
   status(act==='get'?'Obteniendo audio seleccionado…':'Transcribiendo localmente. La primera vez se descarga el modelo; puede tardar.');
   const blob=await getAudio(m.id);
   if(act==='get'){download(blob,`audio-${m.id.replace(/[^a-z0-9_-]/gi,'_')}.${blob.type.includes('ogg')?'ogg':'bin'}`);status('Audio obtenido y enviado a Descargas.');}
   else{
     const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(blob)});
     const result=await request('TRANSCRIBE',{base64,mime:blob.type,token:$('token').value.trim()});
     if(info.key!==identity || !selected.has(m.id))throw new Error('Chat o selección cambiados. Transcripción descartada.');
     const audio=selected.get(m.id).media.find(x=>x.type==='audio');audio.transcript=result.text;audio.transcription_status='automatic';refresh();status(result.text?'Transcripción incorporada. Revísala: puede contener errores.':'No se detectó voz. El audio sigue sin transcripción.');
   }
 }catch(e){status(e.message,true)}finally{b.disabled=false}};
 }
 const label=document.createElement('label');label.textContent='Si WhatsApp no permite obtenerlo: adjunta el audio descargado';const file=document.createElement('input');file.type='file';file.accept='audio/*,.opus,.ogg';label.append(file);div.append(label);
 file.onchange=()=>{const f=file.files[0];if(!f)return;if(f.size>25*1024*1024){status('Audio demasiado grande: máximo 25 MB.',true);return}audioFiles.set(m.id,f);status('Archivo vinculado a este mensaje para transcripción local.');};$('audios').append(div);
 }
}
async function copy(){sync();refresh();if(!selected.size || running)return;await ready();try{await navigator.clipboard.writeText(formatText(output()));status(`${selected.size} mensajes copiados.`);clearTimeout(copyFeedback);$('copy').textContent='Copiado';copyFeedback=setTimeout(()=>{$('copy').textContent='Copiar texto'},1800)}catch{if(!visible)toggle();$('preview').focus();$('preview').select();status('El navegador bloqueó el portapapeles. Pulsa Ctrl+C para copiar el texto seleccionado.',true)}}
$('copy').onclick=copy;
$('txt').onclick=async()=>{sync();refresh();if(!selected.size)return;await ready();status('Texto enviado a Descargas.');download(new Blob([formatText(output())],{type:'text/plain;charset=utf-8'}),`chatkeeps-${Date.now()}.txt`)};
$('html').onclick=async()=>{
 sync();if(!selected.size || running)return;
 const identity=info.key,main=info.main;abort=false;setBusy(true);
 const guard=()=>{const current=readChat();if(abort || current.key!==identity || current.main!==main)throw new Error('Exportación cancelada. No se ha guardado ningún archivo.');};
 try{
  await ready();guard();
  const snapshot=output(),chosen=selection();
  const assets=$('include-media').checked?await collectAssets(chosen,{guard,
   onProgress:(done,total)=>status(`Preparando archivos: ${done} de ${total}. Puedes cancelar.`),
   load:async(m,media)=>{
    // The serialized key from WA-JS finds group messages that a bare DOM ID misses.
    try{return await request('MEDIA',{id:m.wa_id || m.id})}catch(error){
     if(!media.preview_url || !/^(blob:|data:image\/(png|jpeg|gif|webp);base64,)/.test(media.preview_url))throw error;
     const response=await fetch(media.preview_url);if(!response.ok)throw error;const blob=await response.blob();if(blob.size>20*1024*1024)throw new Error('Vista previa demasiado grande.');
     const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob)});
     return {base64,mime:blob.type,preview:true,reason:error.message};
    }
   }}):new Map();
  guard();download(new Blob([renderHtml(snapshot,assets)],{type:'text/html;charset=utf-8'}),`chatkeeps-${Date.now()}.html`);
  const issues=mediaIssues(snapshot.messages,assets);
  status(issues.length?`HTML guardado. Revisar a mano ${issues.length}: ${issueSummary(issues)}.\n${issues.slice(0,12).map(issueLine).join('\n')}${issues.length>12?`\n… y ${issues.length-12} más (lista completa al inicio del HTML).`:''}`:'HTML guardado. Ábrelo en el navegador para leerlo o imprimirlo.',!!issues.length);
 }catch(e){status(e.message,true)}finally{setBusy(false);sync();refresh()}
};
$('json').onclick=async()=>{await ready();download(new Blob([JSON.stringify(output(),null,2)],{type:'application/json'}),`chatkeeps-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);status('JSON enviado a Descargas. No contiene claves ni archivos de audio.')};
// Structure only: text, names and long digit runs (IDs, phone numbers) are masked.
const mask=value=>String(value || '').replace(/(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{8,}/g,s=>`<${s.length}>`);
function outline(el,depth=0,lines=[]){
 if(lines.length>=70)return lines;
 const bits=[];
 for(const name of ['data-id','data-testid','data-icon','role'])if(el.hasAttribute(name))bits.push(`${name}=${mask(el.getAttribute(name))}`);
 for(const name of ['data-pre-plain-text','aria-label','title','alt'])if(el.hasAttribute(name))bits.push(`${name}=…`);
 if(el.classList?.contains('selectable-text'))bits.push('.selectable-text');
 if(el.nodeName==='IMG')bits.push(`src=${(el.getAttribute('src') || '').split(':')[0] || 'vacío'} ${el.naturalWidth}x${el.naturalHeight}`);
 if(/url\(/.test(el.style?.backgroundImage || ''))bits.push('fondo=imagen');
 const text=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.data.trim()).join('');
 if(text)bits.push(/^\d{1,2}:\d{2}/.test(text)?'texto=hora':`texto(${text.length})`);
 const shown=bits.length || ['IMG','VIDEO','AUDIO','CANVAS'].includes(el.nodeName);
 if(shown)lines.push(`${'  '.repeat(depth)}${el.nodeName.toLowerCase()} ${bits.join(' ')}`);
 if(el.nodeName!=='svg')for(const child of el.children)outline(child,depth+(shown?1:0),lines);
 return lines;
}
$('diagnose').onclick=async()=>{
 sync();await loadDetails(true);
 const visibleRows=new Map(rows().map(row=>[row.dataset.id,row]));
 const ids=selection().map(m=>m.id),sample=[...ids.filter(id=>!details.get(id)),...ids.filter(id=>details.get(id))].filter(id=>visibleRows.has(id)).slice(0,6);
 const report=[`Chatkeeps 0.6.0 · ${navigator.userAgent}`,`Seleccionados: ${ids.length} · filas visibles: ${visibleRows.size}`,detailsNote || 'WA-JS: sin consultar.'];
 for(const id of ids.slice(0,60)){const m=selected.get(id),d=details.get(id);
  report.push(`- ${mask(id)} · dom: dir=${store.get(id)?.direction} autor=${!!store.get(id)?.author} hora=${!!store.get(id)?.timestamp} texto=${store.get(id)?.text?.length || 0} medios=${store.get(id)?.media?.map(x=>x.type).join('+') || '-'} · wa-js: ${d?`${d.type} ${d.fromMe?'propio':'ajeno'} t=${!!d.t}`:'no encontrado'} · avisos=${m.warnings.length}`);}
 for(const id of sample)report.push('',`Estructura ${mask(id)}:`,...outline(visibleRows.get(id)));
 if(!sample.length)report.push('','Desplázate hasta los mensajes problemáticos para incluir su estructura.');
 const text=report.join('\n');
 try{await navigator.clipboard.writeText(text);status('Diagnóstico copiado. Revísalo antes de compartirlo: no incluye textos ni nombres.')}
 catch{download(new Blob([text],{type:'text/plain;charset=utf-8'}),`chatkeeps-diagnostico-${Date.now()}.txt`);status('Diagnóstico enviado a Descargas.')}
};
$('capture').onclick=collect;$('cancel').onclick=()=>{abort=true;status('Cancelando…')};$('select').onclick=togglePick;$('clear').onclick=()=>{clear();status('Selección borrada.');};
shadow.querySelectorAll('[data-n]').forEach(b=>b.onclick=()=>{$('quantity').value=b.dataset.n;collect()});
function toggle(){visible=!visible;$('panel').hidden=!visible;$('dock').hidden=visible;$('launcher').setAttribute('aria-expanded',String(visible));sync();refresh();if(!visible){const r=$('dock').getBoundingClientRect();positionDock(r.left,r.top);$('launcher').focus()}else shadow.querySelector('.body').scrollTop=0}
$('close').onclick=toggle;$('launcher').onclick=toggle;globalThis.__whatsappContext={toggle};
document.addEventListener('keydown',e=>{if(e.key==='Escape' && (picking || fromHere)){dragSelection.cancel();picking=false;fromHere=false;refresh();status('Selección desactivada. Tus mensajes siguen preparados.');}});
let drag=null;
function positionDock(x,y){const dock=$('dock'),rect=dock.getBoundingClientRect();dock.style.left=`${Math.max(8,Math.min(x,innerWidth-rect.width-8))}px`;dock.style.top=`${Math.max(8,Math.min(y,innerHeight-rect.height-8))}px`;dock.style.bottom='auto'}
let movedIcon=false;
$('launcher').onclick=()=>{if(movedIcon){movedIcon=false;return}toggle()};
$('launcher').onpointerdown=e=>{if(e.button!==0)return;const r=$('dock').getBoundingClientRect();movedIcon=false;drag={x:e.clientX-r.left,y:e.clientY-r.top,startX:e.clientX,startY:e.clientY};$('launcher').setPointerCapture(e.pointerId)};
$('launcher').onpointermove=e=>{if(drag && (movedIcon || Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)){movedIcon=true;positionDock(e.clientX-drag.x,e.clientY-drag.y)}};
$('launcher').onpointerup=$('launcher').onpointercancel=$('launcher').onlostpointercapture=()=>{drag=null};
$('launcher').onkeydown=e=>{const delta={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];if(delta){e.preventDefault();const r=$('dock').getBoundingClientRect();positionDock(r.left+delta[0],r.top+delta[1])}};
window.addEventListener('resize',()=>{if(!visible){const r=$('dock').getBoundingClientRect();positionDock(r.left,r.top)}});
$('advanced').ontoggle=()=>{if(!$('advanced').open)shadow.querySelector('.body').scrollTop=0};
let scheduled=false;
new MutationObserver(records=>{if(records.every(r=>host.contains(r.target)))return;if(scheduled || running)return;scheduled=true;setTimeout(()=>{scheduled=false;if(!running)sync()},150)}).observe(document.body,{childList:true,characterData:true,attributes:true,attributeFilter:['data-id','data-pre-plain-text','title'],subtree:true});
sync();refresh();
}
