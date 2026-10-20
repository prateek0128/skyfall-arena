import { test } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Rooms,type Peer } from './rooms';
import type { ServerMessage } from '../shared/protocol';
await RAPIER.init();
function peer(id:string){const messages:ServerMessage[]=[];const p:Peer={id,send:m=>messages.push(m),close:()=>{}};return {p,messages};}
function setup(options={}){const service=new Rooms(options),a=peer('a'),b=peer('b');service.command(a.p,{v:1,type:'create',name:'A'});service.command(b.p,{v:1,type:'join',name:'B',code:a.p.room!});return {service,a,b};}
test('room requires host, two connected ready pilots and enforces capacity',()=>{
 const {service,a,b}=setup();try{
  service.command(a.p,{v:1,type:'start'});assert.equal(service.rooms.get(a.p.room!)!.phase,'lobby');
  for(const p of [a.p,b.p])service.command(p,{v:1,type:'ready',ready:true});
  service.command(b.p,{v:1,type:'start'});assert.equal(service.rooms.get(a.p.room!)!.phase,'lobby');
  for(let i=0;i<6;i++)service.command(peer(String(i)).p,{v:1,type:'join',name:'Extra',code:a.p.room!});
  const extra=peer('extra');service.command(extra.p,{v:1,type:'join',name:'No',code:a.p.room!});assert.equal(extra.p.room,undefined);
 }finally{service.dispose();}
});
test('disconnect migrates host, cancels countdown, rotates reconnect token and cleans empty room',()=>{
 const {service,a,b}=setup({reconnectSeconds:.1});try{
  const welcome=a.messages.find(m=>m.type==='welcome')!;assert.equal(welcome.type,'welcome');if(welcome.type!=='welcome')return;
  const code=a.p.room!;for(const p of [a.p,b.p])service.command(p,{v:1,type:'ready',ready:true});service.command(a.p,{v:1,type:'start'});
  service.detach(a.p);assert.equal(service.rooms.get(code)!.hostId,b.p.playerId);assert.equal(service.rooms.get(code)!.phase,'lobby');
  const replacement=peer('replacement');service.command(replacement.p,{v:1,type:'resume',code,playerId:welcome.playerId,token:welcome.token});assert.equal(replacement.p.playerId,welcome.playerId);
  const resumed=replacement.messages.find(m=>m.type==='welcome');if(resumed?.type!=='welcome')throw new Error();
  assert.deepEqual(resumed.room.players.map(p=>p.name),['A','B']);
  assert.deepEqual(service.snapshot(service.rooms.get(code)!).players.map(p=>p.name),['A','B']);
  const stolen=peer('old');service.command(stolen.p,{v:1,type:'resume',code,playerId:welcome.playerId,token:welcome.token});assert.equal(stolen.p.room,undefined);
  service.detach(replacement.p);service.detach(b.p);service.tick(.2);assert.equal(service.rooms.size,0);
 }finally{service.dispose();}
});
test('rematch, lobby transition, replay input and explicit leave use server state',()=>{
 const {service,a,b}=setup({countdownSeconds:.01,matchSeconds:.05});try{
  for(const p of [a.p,b.p])service.command(p,{v:1,type:'ready',ready:true});service.command(a.p,{v:1,type:'start'});service.tick(.02);
  const r=service.rooms.get(a.p.room!)!,p=r.members.get(a.p.playerId!)!.pilot;
  const input={seq:1,x:1,z:0,yaw:0,pitch:0,thrust:false,boost:false,fire:false};
  service.command(a.p,{v:1,type:'input',input});service.command(a.p,{v:1,type:'input',input:{...input,x:-1}});assert.equal(p.input.x,1);
  service.tick(.06);assert.equal(r.phase,'results');assert.equal(r.winners.length,2);
  service.command(a.p,{v:1,type:'start'});assert.equal(r.phase,'countdown');assert.equal(r.matchId,2);
  service.tick(.02);service.tick(.06);service.command(a.p,{v:1,type:'lobby'});assert.equal(r.phase,'lobby');assert.ok(!p.state.ready);
  service.command(b.p,{v:1,type:'leave'});assert.equal(r.members.size,1);
 }finally{service.dispose();}
});
test('replacement session revokes the prior live socket and rejects stale commands',()=>{
 const {service,a,b}=setup();try{
  const welcome=a.messages.find(m=>m.type==='welcome');if(welcome?.type!=='welcome')throw new Error();
  const replacement=peer('replacement');service.command(replacement.p,{v:1,type:'resume',code:welcome.room.code,playerId:welcome.playerId,token:welcome.token});
  assert.equal(a.p.room,undefined);service.command(a.p,{v:1,type:'ready',ready:true});
  assert.equal(service.rooms.get(welcome.room.code)!.members.get(welcome.playerId)!.pilot.state.ready,false);
  assert.ok(!JSON.stringify(b.messages.filter(m=>m.type==='state')).includes(welcome.token));
 }finally{service.dispose();}
});
test('interleaved ready/start, combat disconnect, results and rematch stay isolated across rooms',()=>{
 const service=new Rooms({countdownSeconds:.01,matchSeconds:.08,reconnectSeconds:.1});
 const groups=[['A','B'],['C','D']].map(names=>{const [a,b]=names.map(peer);service.command(a.p,{v:1,type:'create',name:names[0]});service.command(b.p,{v:1,type:'join',code:a.p.room!,name:names[1]});return {a,b,code:a.p.room!};});
 try{
  for(const {a,b} of groups){
   service.command(a.p,{v:1,type:'ready',ready:true});service.command(b.p,{v:1,type:'ready',ready:true});
   service.command(b.p,{v:1,type:'ready',ready:false});service.command(a.p,{v:1,type:'start'});
   assert.equal(service.rooms.get(a.p.room!)!.phase,'lobby');
   service.command(b.p,{v:1,type:'ready',ready:true});service.command(a.p,{v:1,type:'start'});service.command(a.p,{v:1,type:'start'});
   assert.equal(service.rooms.get(a.p.room!)!.matchId,1);
  }
  service.tick(.02);
  const first=groups[0],second=groups[1],r=service.rooms.get(first.code)!,other=service.rooms.get(second.code)!;
  const welcome=first.a.messages.find(m=>m.type==='welcome');if(welcome?.type!=='welcome')throw new Error();
  const input={seq:1,x:1,z:-1,yaw:0,pitch:0,thrust:true,boost:true,fire:true};
  for(const {a,b} of groups)for(const p of [a.p,b.p])service.command(p,{v:1,type:'input',input});
  service.detach(first.a.p);service.detach(first.a.p);assert.equal(r.hostId,first.b.p.playerId);
  const resumed=peer('resumed');service.command(resumed.p,{v:1,type:'resume',code:first.code,playerId:welcome.playerId,token:welcome.token});
  assert.equal(r.members.size,2);assert.equal(r.hostId,first.b.p.playerId);assert.equal(r.members.get(welcome.playerId)!.pilot.lastInput,-Infinity);
  service.command(resumed.p,{v:1,type:'lobby'});assert.equal(r.phase,'playing');
  service.tick(.09);assert.equal(r.phase,'results');assert.equal(other.phase,'results');
  const winners=[...r.winners];service.tick(.01);assert.deepEqual(r.winners,winners);
  service.detach(first.b.p);assert.equal(r.hostId,resumed.p.playerId);
  service.command(resumed.p,{v:1,type:'lobby'});assert.equal(r.phase,'lobby');assert.equal(other.phase,'results');
  service.command(second.a.p,{v:1,type:'start'});assert.equal(other.matchId,2);assert.equal(r.matchId,1);
  service.command(resumed.p,{v:1,type:'leave'});service.tick(.2);assert.equal(service.rooms.has(first.code),false);assert.equal(service.rooms.has(second.code),true);
 }finally{service.dispose();}
});
test('reconnect grace expiry and room disposal reject old credentials without ghost entries',()=>{
 const {service,a,b}=setup({reconnectSeconds:.1,idleSeconds:.2});try{
  const welcome=a.messages.find(m=>m.type==='welcome');if(welcome?.type!=='welcome')throw new Error();
  const code=a.p.room!;service.detach(a.p);service.tick(.11);
  const retry=peer('retry');service.command(retry.p,{v:1,type:'resume',code,playerId:welcome.playerId,token:welcome.token});
  assert.equal(retry.p.room,undefined);assert.equal(service.rooms.get(code)!.members.size,1);
  service.detach(b.p);service.detach(b.p);service.tick(.3);assert.equal(service.rooms.size,0);
  service.command(retry.p,{v:1,type:'resume',code,playerId:welcome.playerId,token:welcome.token});assert.equal(retry.p.room,undefined);
 }finally{service.dispose();}
});
