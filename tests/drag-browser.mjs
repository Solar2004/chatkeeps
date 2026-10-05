import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
try {
const page=await browser.newPage({viewport:{width:1200,height:800}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.setContent(`<!doctype html><style>body{margin:0;font:14px system-ui;background:#edf2ef}#main{margin-left:420px;padding:20px}#pane{height:300px;overflow-y:auto;overflow-anchor:none;border:1px solid #789}#messages>[data-id]{height:60px;box-sizing:border-box;padding:18px;background:white;border-bottom:1px solid #ddd}header{height:60px}</style><div id="app"><div id="main"><header><span title="Prueba" dir="auto">Prueba</span></header><div id="pane"><div id="top"></div><div id="messages"></div><div id="bottom"></div></div></div></div>`);
await page.evaluate(()=>{
 globalThis.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async()=>({ok:false,error:'not needed'})}};
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text}}});
 window.messageClicks=0;document.querySelector('#messages').onclick=()=>window.messageClicks++;
 window.renderWindow=(start,reuse=false)=>{
  const messages=document.querySelector('#messages');
  if(!reuse)messages.replaceChildren();
  for(let i=0;i<7;i++){
   const n=start+i;let el=messages.children[i];
   if(!el){el=document.createElement('div');el.innerHTML='<div data-pre-plain-text=""><span class="selectable-text">text</span></div>';messages.append(el)}
   el.dataset.id=`false_chat_message${n}`;el.dataset.testid=`conv-msg-${n}`;
   el.firstChild.setAttribute('data-pre-plain-text',`[10:${String(n).padStart(2,'0')}, 07/09/2026] Prueba: `);
   el.querySelector('.selectable-text').firstChild.data=`Mensaje ${String(n).padStart(2,'0')}`;
  }
  document.querySelector('#top').style.height=`${start*60}px`;
  document.querySelector('#bottom').style.height=`${(60-start-7)*60}px`;
  window.start=start;
 };
 window.renderWindow(0);
 document.querySelector('#pane').onscroll=()=>{const start=Math.min(53,Math.floor(document.querySelector('#pane').scrollTop/60));if(start!==window.start)window.renderWindow(start,true)};
});
await page.addScriptTag({path:resolve('dist/content.js')});
const panel=page.locator('#hermes-whatsapp-context');
await panel.locator('#launcher').click();
await panel.locator('#select').click();await panel.locator('#close').click();
const count=async()=>Number(await panel.locator('#dock-count').textContent());
const center=async n=>{const r=await page.locator(`[data-id="false_chat_message${n}"]`).boundingBox();return {x:r.x+100,y:r.y+30}};
async function sweep(a,b){const from=await center(a),to=await center(b);await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up()}
await sweep(1,3);assert.equal(await count(),3);assert.equal(await page.evaluate(()=>window.messageClicks),0);
// Further strokes add to, rather than replace, the existing selection.
await sweep(3,0);assert.equal(await count(),4);
// A normal click still removes exactly one message, without opening it.
await page.locator('[data-id="false_chat_message1"]').click();assert.equal(await count(),3);
await page.locator('[data-id="false_chat_message1"]').click();assert.equal(await count(),4);
// Jump down to a non-overlapping viewport, with the same DOM nodes recycled.
const paneBox=await page.locator('#pane').boundingBox();
await page.mouse.move(paneBox.x+120,paneBox.y+140);await page.mouse.wheel(0,1200);
await page.waitForFunction(()=>window.start===20);
assert.equal(await count(),4);await sweep(21,23);assert.equal(await count(),7);
// Unmount every row temporarily: no change of chat, no selection loss.
await page.evaluate(()=>document.querySelector('#messages').replaceChildren());
await page.waitForTimeout(250);assert.equal(await count(),7);
await page.evaluate(()=>window.renderWindow(20));
await page.waitForFunction(()=>document.querySelector('[data-id="false_chat_message21"]')?.dataset.hcSelected==='true');
// Scroll back: restored elements get their highlight, snapshots do not duplicate.
await page.mouse.wheel(0,-1200);await page.waitForFunction(()=>window.start===0);
await page.waitForFunction(()=>document.querySelector('[data-id="false_chat_message1"]')?.dataset.hcSelected==='true');
assert.equal(await count(),7);
await panel.locator('#launcher').click();await panel.locator('#copy').click();await panel.locator('#close').click();
const copied=await page.evaluate(()=>window.copied);assert.ok(copied.indexOf('Mensaje 00')<copied.indexOf('Mensaje 21'));assert.equal((copied.match(/Mensaje 01/g)||[]).length,1);
// Keep holding at the bottom edge: auto-scroll selects newly mounted messages.
const begin=await center(3);await page.mouse.move(begin.x,begin.y);await page.mouse.down();
await page.mouse.move(begin.x,paneBox.y+paneBox.height-8,{steps:3});
await page.waitForFunction(()=>document.querySelector('#pane').scrollTop>200);
await page.mouse.up();assert.ok(await count()>7);
const stopped=await page.locator('#pane').evaluate(el=>el.scrollTop);await page.waitForTimeout(200);assert.equal(await page.locator('#pane').evaluate(el=>el.scrollTop),stopped);
// Capture is attached to the document, so recycling the starting row cannot stop it.
await panel.locator('#launcher').click();await panel.locator('#copy').click();await panel.locator('#close').click();assert.match(await page.evaluate(()=>window.copied),/Mensaje 07/);
// The upper edge also loads earlier messages without replacing the selection.
const beforeUp=await count(),upperStart=await center(await page.evaluate(()=>window.start+1));
await page.mouse.move(upperStart.x,upperStart.y);await page.mouse.down();
await page.mouse.move(upperStart.x,paneBox.y+8,{steps:3});
await page.waitForFunction(()=>document.querySelector('#pane').scrollTop===0);
await page.mouse.up();assert.ok(await count()>=beforeUp);
// Escape stops an in-progress stroke and keeps collected messages.
const currentStart=await page.evaluate(()=>window.start),at=await center(currentStart+1);
await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(at.x,at.y+12);
await page.keyboard.press('Escape');const saved=await count();await page.mouse.move(at.x,paneBox.y+paneBox.height-8);await page.mouse.up();assert.equal(await count(),saved);
// Real chat switches cancel the stroke and clear the old conversation.
await panel.locator('#launcher').click();await panel.locator('#select').click();await panel.locator('#close').click();const startAgain=await center(await page.evaluate(()=>window.start+1));
await page.mouse.move(startAgain.x,startAgain.y);await page.mouse.down();await page.mouse.move(startAgain.x,startAgain.y+10);
await page.evaluate(()=>{document.querySelector('header span').title='Otro chat';document.querySelector('header span').textContent='Otro chat';document.querySelector('#messages').replaceChildren()});
await page.waitForFunction(()=>document.querySelector('#hermes-whatsapp-context').shadowRoot.querySelector('#dock-count').textContent==='0');
await page.mouse.up();assert.equal(await count(),0);assert.deepEqual(errors,[]);
console.log('Arrastre: adición, clic, scroll automático, ventanas sin solapamiento, reciclado, desaparición temporal, orden, deduplicación, Esc y cambio de chat verificados.');
} finally {await browser.close()}
