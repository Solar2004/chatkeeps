import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({acceptDownloads:true});
 const errors=[];page.on('pageerror',error=>errors.push(String(error)));
 await page.setContent('<style>body{margin:0}#main{margin-left:420px}#pane{height:350px;overflow-y:auto;overflow-anchor:none}#rows>[data-id]{height:100px;box-sizing:border-box;padding:20px}</style><div id="main"><header><span dir="auto" title="Chat de prueba">Chat de prueba</span></header><div id="pane"><div id="top"></div><div id="rows"></div><div id="bottom"></div></div></div>');
 await page.evaluate(()=>{
  const pane=document.querySelector('#pane'),PHOTO='ACE2'+'5'.repeat(28),PHOTO_KEY=`true_fixture@g.us_${PHOTO}_999@lid`;
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const paint=()=>{
   const start=Math.min(26,Math.floor(pane.scrollTop/100)),end=Math.min(30,start+6);
   document.querySelector('#top').style.height=`${start*100}px`;
   document.querySelector('#bottom').style.height=`${(30-end)*100}px`;
   document.querySelector('#rows').innerHTML=Array.from({length:end-start},(_,offset)=>{
    const n=start+offset;
    const body=n===8?'<img alt="Pegatina">':n===9?'<span data-icon="ptt-status"></span>0:02':`<span class="selectable-text">Mensaje ${n}</span>`;
    // Row 5: a photo without caption, bare ID and nothing readable in the DOM.
    if(n===5)return `<div data-id="${PHOTO}" data-testid="conv-msg-${PHOTO}"></div>`;
    return `<div data-id="${n%2?'true':'false'}_fixture_${n}"><div data-pre-plain-text="[09:${String(n).padStart(2,'0')}, 01/10/2026] ${n%2?'Alex':'Ana'}: ">${body}</div></div>`;
   }).join('');
  };
  pane.addEventListener('scroll',paint);paint();
  globalThis.chrome={runtime:{onMessage:{addListener(){}},sendMessage:async req=>req.type==='DETAILS'?{ok:true,data:req.ids.includes(PHOTO)?{[PHOTO]:{id:PHOTO_KEY,fromMe:true,author:'Alex',t:1790845200,type:'image',text:''}}:{}}:
   req.id===PHOTO_KEY?{ok:true,data:{mime:'image/png',base64:png}}:req.id===PHOTO?{ok:false,error:'Clave incompleta'}:({ok:true,data:req.id.endsWith('_8')?{mime:'image/gif',base64:'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}:{mime:'audio/wav',base64:'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='}})}};
 });
 await page.addScriptTag({path:resolve('dist/content.js')});
 const ui=page.locator('#chatkeeps-root');
 await ui.locator('#launcher').click();await ui.locator('#since').click();
 await page.locator('[data-id="true_fixture_1"]').click();
 await page.waitForFunction(()=>{const s=document.querySelector('#chatkeeps-root').shadowRoot;return s.querySelector('#count').textContent==='29 mensajes' && !s.querySelector('#capture').disabled},{},{timeout:20000}).catch(async error=>{console.error(await ui.locator('#status').textContent(),await ui.locator('#count').textContent(),await page.locator('#pane').evaluate(e=>({top:e.scrollTop,height:e.scrollHeight})));throw error});
 await ui.locator('#launcher').click();
 const preview=await ui.locator('#preview').inputValue();
 assert.match(preview,/· Alex\n  \[imagen\]/);assert.doesNotMatch(preview,/no reconocido/);
 assert.doesNotMatch(preview,/Mensaje 0\n/);assert.match(preview,/Mensaje 1\n/);assert.match(preview,/Mensaje 29/);
 assert.equal(await page.locator('[data-id="true_fixture_1"]').count(),0,'The starting row should have been virtualized away');
 const downloaded=page.waitForEvent('download');await ui.locator('#html').click();
 const download=await downloaded;const html=await readFile(await download.path(),'utf8');
 assert.match(download.suggestedFilename(),/^chatkeeps-.*\.html$/);
 assert.match(html,/29 mensajes · 3 archivos incluidos · 0 no incluidos/);
 const archive=await browser.newPage();await archive.setContent(html);
 assert.equal(await archive.locator('article').count(),29);
 assert.equal(await archive.locator('img.sticker').count(),1);
 assert.equal(await archive.locator('img.photo[src^="data:image/png"]').count(),1);assert.doesNotMatch(html,/baja calidad/);
 assert.equal(await archive.locator('audio[src^="data:audio/"]').count(),1);
 assert.equal(await archive.locator('script').count(),0);
 await archive.screenshot({path:'artifacts/archive.png',fullPage:true});
 await archive.setViewportSize({width:375,height:760});
 assert.ok(await archive.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await ui.locator('#include-media').uncheck();
 const plainDownload=page.waitForEvent('download');await ui.locator('#html').click();
 assert.doesNotMatch(await readFile(await (await plainDownload).path(),'utf8'),/src="data:/);
 // Cancel an in-flight media request without creating an archive.
 await ui.locator('#include-media').check();
 await page.evaluate(()=>{chrome.runtime.sendMessage=()=>new Promise(()=>{})});
 let unwanted=false;page.on('download',()=>{unwanted=true});
 await ui.locator('#html').click();await ui.locator('#cancel').click();
 await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#status').textContent.includes('Exportación cancelada'));
 assert.equal(unwanted,false);assert.deepEqual(errors,[]);
 console.log('Archivo: captura virtualizada hasta el final, HTML, sticker, audio, modo sin archivos, móvil y cancelación verificados.');
}finally{await browser.close()}
