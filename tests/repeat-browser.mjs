import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {repeatMessage} from '../src/repeat-message.js';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 await page.setContent('<div id="main"><header><span dir="auto" title="Chat de prueba">Chat de prueba</span></header><div data-id="false_test_a"><div data-pre-plain-text="[09:00, 05/10/2026] Ana: "><span class="selectable-text">Hola</span></div></div><div contenteditable="true" id="draft">Mi borrador</div></div>');
 await page.addScriptTag({content:`window.repeatMessage=${repeatMessage.toString()}`});
 await page.evaluate(()=>{
  window.sent=[];window.chatId='test@c.us';
  window.WPP={chat:{getActiveChat:()=>({id:{_serialized:window.chatId}}),sendTextMessage:async(id,text)=>{window.sent.push({id,text})}}};
  window.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async msg=>{
   const data=msg.type==='REPEAT_TARGET'?window.chatId:window.repeatMessage(msg.command,msg.options);
   return data?.__error?{ok:false,error:data.__error}:{ok:true,data};
  }}};
 });
 await page.addScriptTag({path:resolve('dist/content.js')});
 const ui=page.locator('#chatkeeps-root');await ui.locator('#launcher').click();
 await ui.locator('#repeat summary').click();await ui.locator('#repeat-start').click();
 await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#repeat-status').textContent.includes('Escribe un mensaje'));
 await ui.locator('#repeat-text').fill('Te amo ❤️');await ui.locator('#repeat-seconds').fill('1');await ui.locator('#repeat-count').fill('2');
 await ui.locator('#repeat-start').click();await ui.locator('#close').click();
 await page.waitForFunction(()=>window.sent.length===2);
 await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#repeat-status').textContent.includes('completada'));
 assert.deepEqual(await page.evaluate(()=>window.sent),[{id:'test@c.us',text:'Te amo ❤️'},{id:'test@c.us',text:'Te amo ❤️'}]);
 assert.equal(await page.locator('#draft').textContent(),'Mi borrador');
 await ui.locator('#launcher').click();await ui.locator('#repeat-start').click();await ui.locator('#repeat-stop').click();
 await page.waitForFunction(()=>!window.__chatkeepsRepeat.active);
 await ui.locator('#repeat-start').click();await page.evaluate(()=>{window.chatId='other@c.us'});
 await page.waitForFunction(()=>!window.__chatkeepsRepeat.active);
 assert.equal(await page.evaluate(()=>window.sent.length),2);
 console.log('Intervalos UI: validación, texto, destinatario fijo, cantidad, minimizado, borrador intacto, detener y cambio de chat verificados sin envíos reales.');
}finally{await browser.close()}
