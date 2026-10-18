import test from 'node:test';
import assert from 'node:assert/strict';
import {renderHtml,collectAssets,assetKey,safeDataUrl,mediaIssues,issueLine,issueSummary} from '../src/html-export.js';
import {captureForward} from '../src/capture-forward.js';
const message=(id,media=[])=>({id,author:'Prueba',direction:'out',timestamp:'10:00, 02/10/2026',text:`Texto ${id}`,media,warnings:[]});
test('HTML escapes all conversation content, links replies and embeds media offline',()=>{
 const a=message('a',[{type:'sticker'}]),b=message('b',[{type:'audio'}]);
 a.text='<script>alert(1)</script>';b.quote={id:'a',author:'<img onerror=x>',text:'"quoted"'};
 const assets=new Map([[assetKey('a',0),{mime:'image/webp',base64:'YQ=='}],[assetKey('b',0),{mime:'audio/ogg',base64:'Yg=='}]]);
 const html=renderHtml({chat:'<img src=x onerror=alert(1)>',count:2,messages:[a,b]},assets);
 assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);assert.match(html,/href="#message-1"/);
 assert.match(html,/class="sticker" src="data:image\/webp;base64,YQ=="/);assert.match(html,/<audio controls/);
 assert.ok(!html.includes('src="https://'));assert.match(html,/default-src 'none'/);assert.match(html,/2 archivos incluidos/);
});
test('media collection isolates unavailable files, enforces budget and honors cancellation',async()=>{
 const messages=[message('a',[{type:'audio'}]),message('b',[{type:'sticker'}])];
 const assets=await collectAssets(messages,{load:async m=>{if(m.id==='a')throw Error('Caducado');return {mime:'image/webp',base64:'YQ=='}}});
 assert.match(assets.get('a:0').error,/Caducado/);assert.ok(safeDataUrl(assets.get('b:0')));
 const capped=await collectAssets(messages,{maxBytes:0,load:()=>{throw Error('must not call')}});assert.match(capped.get('a:0').error,/Límite/);
 await assert.rejects(collectAssets(messages,{guard:()=>{throw Error('cancelado')},load:async()=>({})}),/cancelado/);
 assert.equal(safeDataUrl({mime:'text/html',base64:'YQ=='}),null);
 assert.equal(safeDataUrl({mime:'image/png',base64:'" onerror="x'}),null);
});
test('capture starts at chosen message, traverses virtual windows and stops at a stable end',async()=>{
 const all=Array.from({length:8},(_,i)=>message(String(i)));let position=0;
 const viewport={get scrollTop(){return position},set scrollTop(v){position=Math.min(500,v)},clientHeight:300,scrollHeight:800};
 const result=await captureForward({startId:'1',read:()=>all.slice(Math.floor(position/100),Math.floor(position/100)+3),pane:()=>viewport,guard(){},progress(){},wait:async()=>{}});
 assert.deepEqual(result.messages.map(m=>m.id),['1','2','3','4','5','6','7']);
 assert.match(result.warning,/sincronizado/);
});
test('capture never presents skipped windows or cancellation as a complete range',async()=>{
 let reads=0;const viewport={scrollTop:0,clientHeight:10,scrollHeight:100};
 const result=await captureForward({startId:'a',read:()=>++reads===1?[message('a')]:[message('z')],pane:()=>viewport,guard(){},progress(){},wait:async()=>{}});
 assert.match(result.warning,/saltó un tramo/);
 await assert.rejects(captureForward({guard(){throw Error('chat cambiado')}}),/chat cambiado/);
});

test('lista exacta de adjuntos a revisar a mano',()=>{
 const m=(id,ts,media)=>({id,timestamp:ts,author:'Alex',text:'',media,direction:'out'});
 const msgs=[m('a','10:00, 18/10/2026',[{type:'imagen'}]),m('b','10:05, 18/10/2026',[{type:'imagen'}]),m('c','10:09, 18/10/2026',[{type:'documento',name:'f.pdf'}])];
 const assets=new Map([[assetKey('a',0),{base64:'AA==',mime:'image/jpeg'}],[assetKey('b',0),{base64:'AA==',mime:'image/jpeg',preview:true,reason:'msg not found'}],[assetKey('c',0),{error:'Sin descarga'}]]);
 const issues=mediaIssues(msgs,assets);
 assert.deepEqual(issues.map(x=>[x.n,x.kind]),[[2,'miniatura'],[3,'no incluido']]);
 assert.equal(issueLine(issues[1]),'#3 · documento "f.pdf" · 10:09, 18/10/2026 · Alex · no incluido (Sin descarga)');
 assert.equal(issueSummary(issues),'1 imagen miniatura, 1 documento no incluido');
 const html=renderHtml({chat:'x',count:3,messages:msgs},assets);
 assert.match(html,/Revisar a mano: 2/);assert.match(html,/href="#message-2"/);
});
