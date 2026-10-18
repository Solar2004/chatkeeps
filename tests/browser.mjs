import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {resolve} from 'node:path';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});

await page.setContent(`<!doctype html><html><head><title>Fixture</title><style>body{margin:0;background:#e9efec;font:14px system-ui}.fixture-chat{margin-left:400px;padding:24px}#pane>[data-id]{margin:10px 0;padding:14px;background:white;border-radius:10px}.fixture-chat header{margin-bottom:20px}.quoted-mention{border-left:3px solid #287e6b;padding:8px;background:#eff5f2;margin-bottom:8px}</style></head><body><div id="app"><div id="main" class="fixture-chat"><header><span dir="auto" title="Ana">Ana</span></header><div id="pane" style="height:500px;overflow-y:auto">
<div data-id="false_chat_a"><div data-pre-plain-text="[09:00, 07/09/2026] Ana: "><span class="selectable-text">Primero</span></div></div>
<div data-id="true_chat_b"><div data-pre-plain-text="[09:01, 07/09/2026] Alex: "><div class="quoted-mention"><span data-testid="author">Ana</span><span class="selectable-text">Primero</span></div><span class="selectable-text">Segundo</span></div></div>
<div data-id="false_chat_c"><div data-pre-plain-text="[09:02, 07/09/2026] Ana: "><span data-icon="ptt-status"></span><span>0:07</span></div></div>
</div></div></div></body></html>`);
await page.evaluate(()=>{globalThis.chrome={runtime:{sendMessage:async req=>({ok:true,data:req.type==='QUOTE'?{id:'false_chat_original',text:'Texto original',source:'test'}:{}}),onMessage:{addListener(){}}}}});
await page.addScriptTag({path:resolve('dist/content.js')});
const panel=page.locator('#chatkeeps-root');
assert.equal(await panel.locator('#panel').isVisible(),false);
assert.equal(await panel.locator('#dock button:visible').count(),1);
await panel.locator('#launcher').click();
await assertVisible(panel.locator('h1'));
assert.equal(await panel.locator('#chat').textContent(),'Ana');
await panel.locator('#quantity').fill('2');await panel.locator('#capture').click();
await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#count').textContent==='2 mensajes');
let preview=await panel.locator('#preview').inputValue();assert.match(preview,/Segundo/);assert.match(preview,/\[audio.*sin transcribir/);assert.match(preview,/Cita · Ana/);assert.match(preview,/> Primero/);assert.doesNotMatch(preview,/AnaPrimero|false_chat_a/);
await panel.locator('#clear').click();await panel.locator('#select').click();
await page.locator('[data-id="false_chat_a"]').click();await page.locator('[data-id="false_chat_c"]').click({modifiers:['Shift']});
assert.equal(await panel.locator('#count').textContent(),'3 mensajes');
await page.screenshot({path:'artifacts/panel.png'});
preview=await panel.locator('#preview').inputValue();assert.ok(preview.indexOf('Primero')<preview.indexOf('Segundo'));
await panel.locator('#advanced > summary').click();
await panel.locator('#quotes').click();await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#preview').value.includes('Texto original'));
// Native text selection must map to complete message rows.
await panel.locator('#clear').click();await page.evaluate(()=>{const n=document.querySelector('[data-id="true_chat_b"] [data-pre-plain-text] > .selectable-text').firstChild;const r=document.createRange();r.selectNodeContents(n);const s=getSelection();s.removeAllRanges();s.addRange(r);document.dispatchEvent(new Event('selectionchange'))});
await panel.locator('#range').click();assert.equal(await panel.locator('#count').textContent(),'1 mensajes');
// Regression: conversation without #main, inside a non-message data-id ancestor.
await page.evaluate(()=>{
 document.querySelector('#main').removeAttribute('id');
 document.querySelector('#app').dataset.id='layout';
 const reply=document.querySelector('.quoted-mention');reply.className='';reply.dataset.testid='reply-context';
 const inner=document.createElement('span');inner.dataset.id='nested-ui';inner.textContent='Segundo';
 document.querySelector('[data-id="true_chat_b"] [data-pre-plain-text] > .selectable-text').replaceChildren(inner);
 const sticker=document.createElement('div');sticker.dataset.id='false_chat_sticker';
 sticker.innerHTML='<div data-pre-plain-text="[09:03, 07/09/2026] Ana: "><img alt="Pegatina" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></div>';
 document.querySelector('#pane').append(sticker);
});
await panel.locator('#clear').click();
await page.locator('[data-id="nested-ui"]').click();
assert.equal(await panel.locator('#count').textContent(),'1 mensajes');
preview=await panel.locator('#preview').inputValue();assert.match(preview,/Cita · Ana/);assert.match(preview,/Primero/);
// An unavailable original must not erase the visible reply.
await page.evaluate(()=>{chrome.runtime.sendMessage=async()=>({ok:true,data:{id:null,text:null,source:'unresolved'}})});
await panel.locator('#quotes').click();
await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#status').textContent.includes('0 de 1 citas'));
assert.match(await panel.locator('#preview').inputValue(),/Primero/);
await page.locator('[data-id="false_chat_sticker"] img').click();
assert.equal(await panel.locator('#count').textContent(),'2 mensajes');
assert.match(await panel.locator('#preview').inputValue(),/\[sticker\]/);
await panel.locator('#quantity').fill('2');await panel.locator('#capture').click();
await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#count').textContent==='2 mensajes' && !document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#capture').disabled);
preview=await panel.locator('#preview').inputValue();assert.match(preview,/\[sticker\]/);assert.match(preview,/\[audio/);assert.doesNotMatch(preview,/Segundo/);
// Actual September 2026 markup: opaque IDs and conv-msg test IDs, no message-in/out classes.
await panel.locator('#clear').click();
await page.evaluate(()=>{
 const all=[...document.querySelectorAll('#pane > [data-id]')];
 all.forEach((row,i)=>{row.dataset.id='ACE2'+String(i).padStart(28,'0');row.dataset.testid='conv-msg-'+row.dataset.id;});
 const quote=document.querySelector('[data-testid="reply-context"]');quote.removeAttribute('data-testid');quote.setAttribute('aria-label','Quoted message');quote.setAttribute('role','button');
 const incoming=document.createElement('span');incoming.dataset.icon='tail-in';all[0].append(incoming);
 const outgoing=document.createElement('span');outgoing.setAttribute('aria-label','You:');all[1].append(outgoing);
 // IDs inside a quote or a random layout node must never become messages.
 const qid=document.createElement('span');qid.dataset.id='false_chat_quoted';quote.append(qid);
});
await panel.locator('#select').click();
await page.locator('[data-testid^="conv-msg-"]').nth(0).click();
await page.locator('[data-testid^="conv-msg-"]').nth(3).click({modifiers:['Shift']});
assert.equal(await panel.locator('#count').textContent(),'4 mensajes');
preview=await panel.locator('#preview').inputValue();assert.match(preview,/Primero/);assert.match(preview,/Cita · Ana/);assert.match(preview,/\[sticker\]/);
await panel.locator('#quantity').fill('2');await panel.locator('#capture').click();
await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#count').textContent==='2 mensajes' && !document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#capture').disabled);
assert.match(await panel.locator('#preview').inputValue(),/\[sticker\]/);
// Selection and copy remain usable with the full panel folded.
await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedForTest=text}}})});
await panel.locator('#select').click();await panel.locator('#close').click();assert.equal(await panel.locator('#panel').isVisible(),false);
await page.locator('[data-testid^="conv-msg-"]').nth(0).click();
assert.equal(await panel.locator('#dock-count').textContent(),'3');
await panel.locator('#launcher').click();await panel.locator('#copy').click();await panel.locator('#close').click();
assert.match(await page.evaluate(()=>window.copiedForTest),/Extracto: 3 mensajes/);
assert.doesNotMatch(await page.evaluate(()=>window.copiedForTest),/ACE2/);
await page.keyboard.press('Escape');assert.equal(await panel.locator('#select').getAttribute('aria-pressed'),'false');
const beforeMove=await panel.locator('#dock').boundingBox();await panel.locator('#launcher').focus();await page.keyboard.press('ArrowRight');
assert.equal(Math.round((await panel.locator('#dock').boundingBox()).x-beforeMove.x),24);
await page.emulateMedia({reducedMotion:'reduce'});
assert.equal(await page.locator('[data-hc-selected="true"]').first().evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
await page.screenshot({path:'artifacts/compact.png'});
await panel.locator('#launcher').click();
await panel.locator('#advanced > summary').click();
await panel.locator('.body').evaluate(el=>{el.scrollTop=0});
await page.screenshot({path:'artifacts/panel.png'});
// The diagnostic report shows structure only: no message text, names or IDs.
await panel.locator('#advanced').evaluate(el=>{el.open=true});await panel.locator('#diagnose').click();
await page.waitForFunction(()=>window.copiedForTest?.startsWith('Chatkeeps 0.6.0'));
const report=await page.evaluate(()=>window.copiedForTest);
assert.match(report,/Estructura <32>:/);assert.match(report,/data-pre-plain-text=…/);assert.doesNotMatch(report,/Primero|Segundo|Ana|ACE2/);
await page.setViewportSize({width:375,height:760});
const panelBounds=await panel.locator('#panel').boundingBox();assert.ok(panelBounds.x>=0 && panelBounds.x+panelBounds.width<=375);
assert.equal(await panel.locator('#dock').isVisible(),false);
await page.screenshot({path:'artifacts/mobile.png'});
await panel.locator('#close').click();
const bounds=await panel.locator('#dock').boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=375);
// Clipboard denial must reopen a visible, selected preview for manual copying.
await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied')}});
await panel.locator('#launcher').click();await panel.locator('#copy').click();assert.equal(await panel.locator('#panel').isVisible(),true);
assert.equal(await panel.locator('#preview').evaluate(el=>el.selectionEnd-el.selectionStart), (await panel.locator('#preview').inputValue()).length);
await panel.locator('#close').click();
// SPA navigation must discard the previous selection and update the header.
await page.evaluate(()=>{document.querySelector('#pane').replaceChildren();document.querySelector('header span').textContent='Otro chat';document.querySelector('header span').title='Otro chat';});
await page.waitForFunction(()=>document.querySelector('#chatkeeps-root').shadowRoot.querySelector('#count').textContent==='0 mensajes');
assert.equal(await panel.locator('#preview').inputValue(),'');
assert.equal(await panel.locator('#dock-count').textContent(),'0');assert.equal(await panel.locator('#copy').isEnabled(),false);
assert.deepEqual(errors,[]);await browser.close();console.log('Navegador: selección, últimos N, cita, audio y texto nativo verificados.');
async function assertVisible(locator){assert.equal(await locator.isVisible(),true)}
