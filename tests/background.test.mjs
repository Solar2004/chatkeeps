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
const groupId='123@g.us',groupKey=`true_${groupId}_${raw}_999@lid`;
const groupMsg={id:{id:raw,fromMe:true,remote:{_serialized:groupId},_serialized:groupKey},type:'image',caption:'',body:'/9j/thumbnail',t:1792294800,isForwarded:false};
const send=msg=>new Promise(resolve=>listener(msg,{tab:{id:1},url:'https://web.whatsapp.com/'},resolve));
test('details find group messages by bare ID and never return a thumbnail as text',async()=>{
 globalThis.WPP={chat:{getActiveChat:()=>({id:{_serialized:groupId},msgs:{getModelsArray:()=>[groupMsg]}})},profile:{getMyProfileName:()=>'RAlexander'}};
 const result=await send({type:'DETAILS',ids:[raw,'not valid','B'.repeat(20)]});
 assert.equal(result.ok,true);assert.deepEqual(Object.keys(result.data),[raw]);
 assert.deepEqual(result.data[raw],{id:groupKey,fromMe:true,author:'RAlexander',t:1792294800,type:'image',subtype:null,text:'',forwarded:false,filename:null,duration:null,quoted:null});
});
test('media download uses the full group key instead of a hand-built one',async()=>{
 let asked;
 globalThis.WPP={chat:{getActiveChat:()=>({id:{_serialized:groupId},msgs:{getModelsArray:()=>[groupMsg]}}),getMessageById:async()=>{throw Error('must not guess')},downloadMedia:async id=>{asked=id;return new Blob(['jpeg'],{type:'image/jpeg'})}}};
 const result=await send({type:'MEDIA',id:raw});
 assert.equal(result.ok,true);assert.equal(asked,groupKey);assert.equal(result.data.mime,'image/jpeg');
});
