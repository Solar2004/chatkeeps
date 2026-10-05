import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const profile=await mkdtemp(join(tmpdir(),'whatsapp-context-extension-'));const extension=resolve('dist');
let context;
try{
 context=await chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`,'--no-sandbox']});
 const page=context.pages()[0] || await context.newPage();await page.goto('https://web.whatsapp.com/',{waitUntil:'domcontentloaded',timeout:90000});
 await page.locator('#hermes-whatsapp-context').waitFor({state:'attached',timeout:60000});
 assert.match(await page.locator('#hermes-whatsapp-context').locator('h1').textContent(),/Chatkeeps/);
 await page.waitForFunction(()=>typeof globalThis.WPP?.chat?.getQuotedMsg==='function' && typeof globalThis.WPP?.chat?.downloadMedia==='function',null,{timeout:30000});
 const waApi=await page.evaluate(()=>({quote:typeof WPP.chat.getQuotedMsg,media:typeof WPP.chat.downloadMedia}));assert.deepEqual(waApi,{quote:'function',media:'function'});
 const workers=context.serviceWorkers();assert.ok(workers.length>=1,'El service worker MV3 no arrancó.');
 console.log('MV3 real: manifiesto, service worker, WA-JS y panel inyectados en web.whatsapp.com.');
}finally{await context?.close();await rm(profile,{recursive:true,force:true})}
