import test from 'node:test';
import assert from 'node:assert/strict';
let listener;
globalThis.chrome={action:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(fn){listener=fn}}},scripting:{async executeScript({func,args}){return [{result:await func(...args)}]}}};
await import('../src/background.js');
const raw='ACE2'+'0'.repeat(28),chatId='test@c.us';
const request=id=>new Promise(resolve=>listener({type:'QUOTE',id},{tab:{id:1},url:'https://web.whatsapp.com/'},resolve));
test('opaque DOM ID resolves only against active chat before retrieving quote',async()=>{
 let quotedId;
 globalThis.WPP={chat:{getActiveChat:()=>({id:{_serialized:chatId}}),getMessageById:async id=>({id:{id:raw,remote:{_serialized:chatId},_serialized:id}}),getQuotedMsg:async id=>{quotedId=id;return {id:{_serialized:'quoted'},body:'Original',type:'chat'}}}};
 const result=await request(raw);assert.equal(result.ok,true);assert.equal(quotedId,`true_${chatId}_${raw}`);assert.equal(result.data.text,'Original');
});
test('mismatched resolved chat and invalid IDs fail without reading a quote',async()=>{
 globalThis.WPP={chat:{getActiveChat:()=>({id:{_serialized:chatId}}),getMessageById:async id=>({id:{id:raw,remote:{_serialized:'other@c.us'},_serialized:id}}),getQuotedMsg:async()=>{throw Error('must not read')}}};
 assert.equal((await request(raw)).ok,false);assert.equal((await request('arbitrary input')).ok,false);
});
