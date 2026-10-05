import test from 'node:test';
import assert from 'node:assert/strict';
import {repeatMessage} from '../src/repeat-message.js';
const options={text:'Te amo ❤️',seconds:2,count:2,expectedChat:'test@c.us'};
function setup(t,send=async()=>{}){
 delete globalThis.__chatkeepsRepeat;
 let chat='test@c.us';
 globalThis.WPP={chat:{getActiveChat:()=>({id:{_serialized:chat}}),sendTextMessage:send}};
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']});
 t.after(()=>{repeatMessage('stop');delete globalThis.__chatkeepsRepeat;delete globalThis.WPP});
 return id=>{chat=id};
}
test('waits first interval, sends fixed text/recipient and stops at count',async t=>{
 const sent=[];setup(t,async(...args)=>sent.push(args));
 assert.equal(repeatMessage('start',options).active,true);
 assert.equal(sent.length,0);t.mock.timers.tick(2000);await Promise.resolve();
 assert.equal(sent.length,1);assert.deepEqual(sent[0],['test@c.us','Te amo ❤️',{createChat:false}]);
 t.mock.timers.tick(2000);await Promise.resolve();
 assert.equal(repeatMessage('status').sent,2);assert.equal(repeatMessage('status').active,false);
 t.mock.timers.tick(10000);assert.equal(sent.length,2);
});
test('switching chats or stopping prevents future sends',async t=>{
 const sent=[];const change=setup(t,async()=>sent.push(1));
 repeatMessage('start',options);change('other@c.us');t.mock.timers.tick(250);
 change('test@c.us');t.mock.timers.tick(5000);assert.equal(sent.length,0);
 repeatMessage('start',options);repeatMessage('stop');t.mock.timers.tick(5000);assert.equal(sent.length,0);
});
test('pending sends never overlap; stop cannot restart until completion',async t=>{
 let finish;const sent=[];setup(t,()=>{sent.push(1);return new Promise(resolve=>{finish=resolve})});
 repeatMessage('start',options);t.mock.timers.tick(2000);t.mock.timers.tick(10000);
 assert.equal(sent.length,1);repeatMessage('stop');assert.match(repeatMessage('start',options).__error,/en curso/);
 finish();await Promise.resolve();t.mock.timers.tick(10000);assert.equal(sent.length,1);
 assert.equal(repeatMessage('status').pending,false);
});
test('send failure stops without retries and invalid input never schedules',async t=>{
 let calls=0;setup(t,async()=>{calls++;throw Error('offline')});
 for(const override of [{text:' '},{seconds:0},{seconds:1.5},{count:0},{count:101},{expectedChat:'other@c.us'}])assert.ok(repeatMessage('start',{...options,...override}).__error);
 repeatMessage('start',options);t.mock.timers.tick(2000);await Promise.resolve();
 assert.equal(repeatMessage('status').active,false);t.mock.timers.tick(10000);assert.equal(calls,1);
});
