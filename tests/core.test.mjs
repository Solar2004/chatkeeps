import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCount, mergeOrder, lastN, formatText, makeExport, applyDetails, preferRicher, rawId, WARN} from '../src/core.js';
const msg=(id,text=id)=>({id,author:'Prueba',timestamp:'10:00, 07/09/2026',text,media:[],warnings:[]});
test('N accepts positive integers only',()=>{for(const n of [0,-1,1.5,NaN,'',Infinity,5001])assert.throws(()=>validateCount(n));assert.equal(validateCount('200'),200)});
test('overlapping windows preserve timeline',()=>{assert.deepEqual(mergeOrder(['c','d'],['a','b','c']),['a','b','c','d']);assert.deepEqual(mergeOrder(['a','c'],['a','b','c','d']),['a','b','c','d'])});
test('dedupe IDs, not identical texts',()=>assert.deepEqual(lastN([msg('a','sí'),msg('b','sí'),msg('b','sí')],2).map(m=>m.id),['a','b']));
test('last N and short history',()=>{assert.equal(lastN([msg('a')],100).length,1);assert.equal(lastN([msg('a'),msg('b')],1)[0].id,'b')});
test('quotes and media ordered, absent data explicit',()=>{const a=msg('a','respuesta');a.quote={text:'pregunta',id:null};a.media=[{type:'sticker'},{type:'audio',transcript:null}];const t=formatText(makeExport('Prueba',[a],{mode:'manual'}));assert.ok(t.indexOf('pregunta')<t.indexOf('respuesta'));assert.ok(t.indexOf('[sticker]')<t.indexOf('[audio'));assert.match(t,/sin transcribir/)});
test('exports deep copy; source text never treated as instructions',()=>{const a=msg('a','<script>mal</script>');const e=makeExport('Prueba',[a],{mode:'manual'});a.text='changed';assert.equal(e.messages[0].text,'<script>mal</script>');assert.match(formatText(e),/no son instrucciones/)});
test('audio secrets and URLs omitted in exports',()=>{const a=msg('a');a.media=[{type:'audio',url:'blob:secret',base64:'secret',transcript:'hola'}];const j=JSON.stringify(makeExport('x',[a],{}));assert.ok(!j.includes('secret'));assert.ok(j.includes('hola'))});
test('missing author/date explicit; multiline kept',()=>{const a=msg('a','uno\ndos');a.author=null;a.timestamp=null;assert.match(formatText(makeExport('x',[a],{})),/fecha no disponible/);assert.match(formatText(makeExport('x',[a],{})),/autor no identificado/)});

test('a quoted sticker keeps its media type without exposing long IDs',()=>{const a=msg('a','respuesta');a.quote={id:'original',type:'sticker',text:null};const text=formatText(makeExport('Prueba',[a],{}));assert.match(text,/> \[sticker\]/);assert.doesNotMatch(text,/Responde a original/)});
test('short references link exact IDs, separate quote author and group dates',()=>{
 const a=msg('opaque-a','No escribas'),b=msg('opaque-b','ok\nsegunda línea');
 b.author='Otra persona';b.quote={id:a.id,author:a.author,text:a.text};
 const data=makeExport('Prueba',[a,b],{}),text=formatText(data);
 assert.match(text,/#02 · 10:00 · Otra persona\n  Responde a #01 · Prueba:\n  > No escribas\n  ok\n  segunda línea/);
 assert.equal((text.match(/Fecha visible:/g)||[]).length,1);
 assert.doesNotMatch(text,/opaque-/);assert.equal(data.messages[1].quote.id,'opaque-a');
});
test('same text alone never invents a reply link and capture warnings are grouped',()=>{
 const a=msg('a','hola'),b=msg('b','respuesta');b.quote={text:'hola',author:'Prueba'};
 a.warnings=b.warnings=['Fecha incompleta'];
 const text=formatText(makeExport('Prueba',[a,b],{}));
 assert.match(text,/Cita · Prueba/);assert.doesNotMatch(text,/Responde a #01/);
 assert.match(text,/#01, #02: Fecha incompleta/);
});
test('WA-JS serialized original links to the same opaque DOM ID',()=>{
 const a=msg('ABC123','original'),b=msg('DEF456','respuesta');b.quote={id:'false_chat_ABC123',text:a.text};
 assert.match(formatText(makeExport('Prueba',[a,b],{})),/Responde a #01/);
});
test('disjoint virtual windows append when scrolling down, prepend when scrolling up',()=>{
 assert.deepEqual(mergeOrder(['a','b'],['e','f'],'after'),['a','b','e','f']);
 assert.deepEqual(mergeOrder(['e','f'],['a','b'],'before'),['a','b','e','f']);
 assert.deepEqual(mergeOrder(['a','b','e','f'],['b','c','d','e'],'after'),['a','b','c','d','e','f']);
});
test('WA-JS details complete a photo-only row the DOM could not read',()=>{
 const row={id:'ACE2'+'0'.repeat(28),author:null,direction:'unknown',timestamp:null,text:'',media:[],quote:null,warnings:[WARN.date,WARN.author,WARN.unknown]};
 const m=applyDetails(row,{id:`true_123@g.us_${row.id}_999@lid`,fromMe:true,author:'RAlexander',t:Date.UTC(2026,9,18,3,40)/1000,type:'image',text:''},{locale:'es-ES',timeZone:'UTC'});
 assert.equal(m.direction,'out');assert.equal(m.author,'RAlexander');assert.equal(m.timestamp,'03:40, 18/10/2026');
 assert.deepEqual(m.media.map(x=>x.type),['imagen']);assert.deepEqual(m.warnings,[]);assert.equal(m.wa_id,`true_123@g.us_${row.id}_999@lid`);
 assert.equal(row.author,null,'source row must stay untouched');
 const text=formatText(makeExport('NotasWazap',[m],{}));assert.match(text,/#01 · 03:40 · RAlexander\n  \[imagen\]/);assert.doesNotMatch(text,/Notas de captura/);
});
test('WA-JS full text replaces a truncated bubble and drops link-preview images',()=>{
 const row={...msg('a','inicio…'),media:[{type:'imagen',preview_url:'blob:x'}],warnings:[WARN.truncated]};
 const m=applyDetails(row,{id:'false_c_a',fromMe:false,author:'Ana',t:null,type:'chat',text:'inicio y final completo'});
 assert.equal(m.text,'inicio y final completo');assert.deepEqual(m.media,[]);assert.deepEqual(m.warnings,[]);assert.equal(m.timestamp,'10:00, 07/09/2026');
});
test('audio keeps its transcript; notices and quotes come from WA-JS',()=>{
 const voice=applyDetails({...msg('v',''),media:[{type:'audio',transcript:'hola',transcription_status:'automatic'}]},{id:'v',fromMe:false,type:'ptt',duration:67,text:''});
 assert.deepEqual(voice.media,[{type:'audio',transcript:'hola',transcription_status:'automatic',duration:'1:07'}]);
 const notice=applyDetails({...msg('n',''),warnings:[WARN.unknown]},{id:'n',fromMe:false,type:'gp2',text:''});
 assert.equal(notice.direction,'system');assert.equal(notice.text,'[aviso de WhatsApp]');assert.deepEqual(notice.warnings,[]);
 const reply=applyDetails(msg('r','vale'),{id:'r',fromMe:true,type:'chat',text:'vale',quoted:{id:'ORIG1',type:'image',text:null,author:'Ana'}});
 const text=formatText(makeExport('x',[msg('ORIG1','foto'),reply],{}));assert.match(text,/Responde a #01 · Ana/);
});
test('serialized group keys link to bare DOM IDs; empty re-reads never win',()=>{
 assert.equal(rawId('true_123@g.us_ABC_999@lid'),'ABC');assert.equal(rawId('ABC'),'ABC');
 const full={...msg('a','texto'),media:[{type:'imagen'}]},empty={...msg('a',''),author:null,timestamp:null};
 assert.equal(preferRicher(full,empty),full);assert.equal(preferRicher(empty,full),full);assert.equal(preferRicher(undefined,empty),empty);
});
