import {test} from 'node:test';
import assert from 'node:assert/strict';
import {network} from './network';
import type {RoomSnapshot,ServerMessage} from '../../shared/protocol';
class Socket{
 static OPEN=1;static all:Socket[]=[];readyState=0;sent:string[]=[];
 onopen?:()=>void;onmessage?:(e:{data:string})=>void;onerror?:()=>void;onclose?:(e:{code:number})=>void;
 constructor(public url:string){Socket.all.push(this);}
 send(s:string){this.sent.push(s);}close(){this.readyState=3;this.onclose?.({code:1006});}
 open(){this.readyState=1;this.onopen?.();}message(m:ServerMessage){this.onmessage?.({data:JSON.stringify(m)});}
}
const room:RoomSnapshot={code:'AAAAAA',hostId:'host',phase:'playing',tick:10,matchId:1,remaining:90,winners:[],reason:'',players:[]};
const token='a'.repeat(64),playerId='11111111-1111-4111-8111-111111111111';
test('client recovery preserves identity, rotates credentials, deduplicates shots and exits stale sessions',t=>{
 const descriptors=new Map(['WebSocket','location','sessionStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const storage=new Map<string,string>();
 Object.defineProperties(globalThis,{WebSocket:{configurable:true,value:Socket},location:{configurable:true,value:{hostname:'localhost',protocol:'http:'}},sessionStorage:{configurable:true,value:{setItem:(k:string,v:string)=>storage.set(k,v),getItem:(k:string)=>storage.get(k),removeItem:(k:string)=>storage.delete(k)}}});
 t.mock.timers.enable({apis:['setTimeout']});
 const latest=()=>Socket.all.at(-1)!;
 const welcome=(s:Socket,rotated=token)=>s.message({v:1,type:'welcome',playerId,token:rotated,room});
 try{
  network.connect('create','Custom');let s=latest();s.open();assert.equal(JSON.parse(s.sent[0]).name,'Custom');welcome(s);
  s.close();assert.equal(network.get().status,'reconnecting');t.mock.timers.tick(250);s=latest();s.open();assert.equal(JSON.parse(s.sent[0]).token,token);
  welcome(s,'b'.repeat(64));assert.equal(network.get().playerId,playerId);assert.equal(network.get().room?.code,room.code);
  assert.equal(JSON.parse(storage.get('skyfall-session-v1')!).token,'b'.repeat(64));
  let count=0;const off=network.onShot(()=>count++);
  const shot={id:1,shooter:playerId,from:{x:0,y:0,z:0},to:{x:1,y:1,z:1},hit:null,eliminated:false};
  s.message({v:1,type:'shots',matchId:1,events:[shot,shot]});assert.equal(count,1);
  s.message({v:1,type:'shots',matchId:1,events:[{...shot,id:2,hit:'enemy',eliminated:true}]});
  assert.ok(Number.isFinite(network.get().killAt));assert.equal(count,2);off();
  s.close();t.mock.timers.tick(250);s=latest();s.open();s.message({v:1,type:'error',message:'Session expired or invalid. Join again from the lobby.'});
  assert.equal(network.get().room,null);assert.equal(network.get().status,'offline');assert.equal(storage.size,0);assert.match(network.get().error,/Session expired/);
  // Fresh room creation remains available after an expired/restarted server session.
  network.connect('create','New');s=latest();s.open();welcome(s);
  s.message({v:1,type:'error',message:'Server restarting. This room will end.',fatal:true});
  const total=Socket.all.length;t.mock.timers.tick(20000);assert.equal(Socket.all.length,total);assert.equal(network.get().room,null);
  network.connect('create','Retry');s=latest();s.open();welcome(s);s.close();
  for(let i=0;i<8;i++){t.mock.timers.tick(2000);latest().close();}
  assert.equal(network.get().status,'offline');assert.equal(network.get().room,null);assert.match(network.get().error,/Unable to restore/);assert.equal(storage.size,0);
  network.connect('create','Timeout');s=latest();t.mock.timers.tick(5000);assert.equal(s.readyState,3);assert.match(network.get().error,/timed out/);welcome(s);assert.equal(network.get().room,null);
  // Even a browser that never dispatches close after a timeout must recover.
  network.connect('create','Stalled');s=latest();s.close=()=>{s.readyState=2;};t.mock.timers.tick(5000);assert.equal(network.get().status,'offline');
  network.connect('create','Replace');s=latest();s.open();welcome(s);s.onclose?.({code:4001});assert.equal(network.get().room,null);assert.match(network.get().error,/another connection/);
 }finally{network.leave();t.mock.timers.reset();for(const [k,d] of descriptors){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}}
});
