// DOM extraction adapted and hardened from upstream MIT exporter; see UPSTREAM.md.
const QUOTE='.quoted-mention, [data-testid="quoted-message"], [data-testid="quoted-msg"], [data-testid="quoted-message-wrapper"], [data-testid="reply-context"], [data-testid="quoted-message-container"], [aria-label="Quoted message"]';
const SKIP=new Set(['STYLE','SCRIPT','NOSCRIPT','TEMPLATE','SVG','BUTTON']);
export function textOf(node) {
  if(!node)return ''; let out='';
  for(const n of node.childNodes) {
    if(n.nodeType===3)out+=n.data;
    else if(n.nodeName==='IMG')out+=n.alt || '';
    else if(n.nodeName==='BR')out+='\n';
    else if(n.nodeType===1 && !SKIP.has(n.nodeName))out+=textOf(n);
  }
  return out;
}
const MESSAGE='[data-id^="true_"], [data-id^="false_"], [data-testid^="conv-msg-"][data-id]';
export function chatRoot() {
  const legacy=document.querySelector('#main');
  if(legacy)return legacy;
  // Start at actual messages, never at the chat list or a global page header.
  const first=[...document.querySelectorAll(MESSAGE)].find(el=>!el.closest(QUOTE));
  if(!first)return null;
  let parent=first.parentElement;
  while(parent && parent!==document.body && parent.id!=='app') {
    if(parent.querySelector('header'))return parent;
    parent=parent.parentElement;
  }
  // Some layouts put the header outside the conversation region.
  return first.closest('[role="main"], [data-testid="conversation-panel-wrapper"]');
}
export function rows() {
  const main=chatRoot(); if(!main)return [];
  const found=[...main.querySelectorAll(MESSAGE)].filter(el=>!el.closest(QUOTE));
  const seen=new Set(); return found.filter(el=>{
    if(el.parentElement?.closest(MESSAGE))return false;
    if(seen.has(el.dataset.id))return false; seen.add(el.dataset.id);return true;
  });
}
export function chatInfo() {
  const main=chatRoot();const header=main?.querySelector('header');
  const title=header?.querySelector('[data-testid="conversation-info-header-chat-title"], span[dir="auto"], span[title]');
  const name=title?.getAttribute('title') || textOf(title).trim() || 'Chat sin nombre';
  const id=rows()[0]?.dataset.id?.match(/^(?:true|false)_([^_]+)_/)?.[1] || '';
  return {main,name,id,key:id || name};
}
export function scrollPane() {
  let el=rows()[0]?.parentElement;
  while(el && el!==document.body) {
    const css=getComputedStyle(el);
    if(/auto|scroll/.test(css.overflowY) && el.scrollHeight>el.clientHeight+5)return el;
    el=el.parentElement;
  }
  return null;
}
export function extract(row) {
  const id=row.dataset.id;
  const quoteEl=row.querySelector(QUOTE);
  const own=row.cloneNode(true);
  for(const el of own.querySelectorAll(QUOTE))el.remove();
  for(const el of own.querySelectorAll('[data-hc-marker], [data-testid="reactions-container"]'))el.remove();
  const meta=own.matches('[data-pre-plain-text]')?own:own.querySelector('[data-pre-plain-text]');
  const raw=meta?.getAttribute('data-pre-plain-text')?.replace(/[\u200e\u200f]/g,'') || '';
  const match=raw.match(/^\[([^\]]+)\]\s*(.*):\s*$/);
  const outgoing=own.querySelector('[data-icon="tail-out"], [aria-label="You:"]') || [...own.querySelectorAll('svg title')].some(el=>/wds-ic-(read|sent)/.test(el.textContent));
  const incoming=own.querySelector('[data-icon="tail-in"]');
  const direction=id.startsWith('true_') || outgoing?'out':id.startsWith('false_') || incoming?'in':'unknown';
  const visibleAuthor=own.querySelector('[aria-label$=":"]')?.getAttribute('aria-label')?.replace(/:\s*$/,'');
  const m={id,direction,author:match?.[2] || visibleAuthor || (direction==='out'?'Tú':null),timestamp:match?.[1] || null,
    text:'',quote:quoteEl?extractQuote(quoteEl):null,
    media:[],warnings:[],forwarded:!!own.querySelector('[data-icon*="forward"]'),
    reactions:textOf(row.querySelector('[data-testid="reactions-container"]')).trim() || null};
  const spans=[...own.querySelectorAll('.selectable-text')].filter(el=>!el.parentElement?.closest('.selectable-text'));
  m.text=spans.map(textOf).join('\n').trim();
  const add=(type,props={})=>{if(!m.media.some(x=>x.type===type))m.media.push({type,...props})};
  const icons=[...own.querySelectorAll('[data-icon]')].map(el=>el.dataset.icon).join(' ');
  const labels=[...own.querySelectorAll('[aria-label],[alt]')].map(el=>el.getAttribute('aria-label') || el.getAttribute('alt')).join(' ');
  const mediaImages=[...own.querySelectorAll('img')].filter(el=>!el.closest('.selectable-text') && !/emoji/i.test(el.className) && /^(blob:|data:)/.test(el.src));
  if(/sticker|pegatina|figurinha/i.test(icons+' '+labels) || own.querySelector('[data-testid*="sticker"]'))add('sticker');
  if(own.querySelector('audio') || /audio|ptt|voice/.test(icons) || /mensaje de voz|mensagem de voz|voice message/i.test(labels)){
    const dur=textOf(own).match(/\b\d{1,2}:\d{2}\b/)?.[0];
    add('audio',{duration:dur,transcription_status:'pending'});
  }
  if(own.querySelector('video') || /media-play|video/.test(icons))add('video');
  const file=textOf(own).match(/([^\n<>/\\]+?\.(?:pdf|docx?|xlsx?|pptx?|csv|zip|rar|txt|mp3|ogg|wav))\b/i)?.[1]?.trim();
  if(/document/.test(icons) || own.querySelector('[data-testid*="document"]'))add('documento',{name:file});
  if(mediaImages.length && !m.media.some(x=>['sticker','video','documento'].includes(x.type)))add('imagen');
  // Ephemeral local previews stay out of text/JSON; HTML may use one if the original expired.
  for(const media of m.media)if(['sticker','imagen'].includes(media.type) && mediaImages[0])media.preview_url=mediaImages[0].src;
  if(!m.timestamp){
    m.timestamp=[...own.querySelectorAll('span')].map(el=>el.textContent.trim()).find(s=>/^\d{1,2}:\d{2}(\s?[ap]\.?m\.?)?$/i.test(s)) || null;
    m.warnings.push('Fecha completa no disponible en el DOM.');
  }
  if(!m.author)m.warnings.push('Autor no identificado en el DOM.');
  if([...row.querySelectorAll('[role="button"],button')].some(e=>/^(leer más|ler mais|read more|ver más)$/i.test(e.textContent.trim())))m.warnings.push('Texto posiblemente truncado; abre «Leer más» y vuelve a capturar.');
  if(!m.text && !m.media.length){
    if(/recalled|revoked|delete/.test(icons) || /mensaje eliminado|mensagem apagada|message was deleted/i.test(textOf(own)))m.text='[mensaje eliminado]';
    else m.warnings.push('Contenido no reconocido; consulta el mensaje original.');
  }
  return m;
}

function extractQuote(el) {
  const authorEl=el.querySelector('[data-testid="author"]');
  const bodyEls=[...el.querySelectorAll('.selectable-text')].filter(n=>!authorEl?.contains(n) && !n.parentElement?.closest('.selectable-text'));
  // Preserve legacy quotes as-is when the DOM cannot separate their author.
  const fallback=el.cloneNode(true);fallback.querySelector('[data-testid="author"]')?.remove();
  const text=bodyEls.length?bodyEls.map(textOf).join('\n').trim():textOf(fallback).trim();
  const labels=[...el.querySelectorAll('[aria-label],[alt]')].map(n=>n.getAttribute('aria-label') || n.getAttribute('alt')).join(' ');
  return {id:el.querySelector('[data-id]')?.dataset.id || null,
    author:authorEl?textOf(authorEl).trim():null,text,
    type:/sticker|pegatina|figurinha/i.test(labels)?'sticker':null,source:'visible'};
}
