import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from './app';
import { idleInput,type ClientCommand,type ServerMessage,type RoomSnapshot } from '../shared/protocol';
async function client(port:number){
 const socket=new WebSocket(`ws://127.0.0.1:${port}`);const messages:ServerMessage[]=[];
 socket.on('message',data=>messages.push(JSON.parse(data.toString()) as ServerMessage));
 await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 return {socket,messages,send:(m:ClientCommand)=>socket.send(JSON.stringify(m)),
 wait:async(predicate:(m:ServerMessage)=>boolean,timeout=4000)=>{const start=Date.now();while(Date.now()-start<timeout){const m=messages.find(predicate);if(m)return m;await new Promise(r=>setTimeout(r,10));}throw new Error(`Timed out; last message: ${JSON.stringify(messages.at(-1))}`);}};
}
const state=(phase:RoomSnapshot['phase'])=>(m:ServerMessage)=>m.type==='state'&&m.room.phase===phase;
test('real WebSocket clients join, move, fight, resume with token rotation, finish and rematch',async()=>{
 const server=await startServer({port:0,countdownSeconds:.05,matchSeconds:5,reconnectSeconds:.5});
 const sockets:WebSocket[]=[],timers:ReturnType<typeof setInterval>[]=[];try{
  const a=await client(server.port),b=await client(server.port);sockets.push(a.socket,b.socket);
  a.send({v:1,type:'create',name:'Alpha'});const wa=await a.wait(m=>m.type==='welcome');assert.equal(wa.type,'welcome');if(wa.type!=='welcome')throw new Error();
  b.send({v:1,type:'join',code:wa.room.code,name:'Bravo'});const wb=await b.wait(m=>m.type==='welcome');if(wb.type!=='welcome')throw new Error();
  await a.wait(m=>m.type==='state'&&m.room.players.length===2);
  a.send({v:1,type:'ready',ready:true});b.send({v:1,type:'ready',ready:true});await a.wait(m=>m.type==='state'&&m.room.players.every(p=>p.ready));
  a.send({v:1,type:'start'});await Promise.all([a.wait(state('playing')),b.wait(state('playing'))]);
  let seq=0;const movement=setInterval(()=>a.send({v:1,type:'input',input:{...idleInput(),seq:++seq,x:1}}),40);
  timers.push(movement);
  await a.wait(m=>m.type==='state'&&m.room.players.find(p=>p.id===wa.playerId)!.position.x>-4.5);clearInterval(movement);
  b.socket.close();await a.wait(m=>m.type==='state'&&m.room.players.some(p=>p.id===wb.playerId&&!p.connected));
  const resumed=await client(server.port);sockets.push(resumed.socket);resumed.send({v:1,type:'resume',code:wa.room.code,playerId:wb.playerId,token:wb.token});
  const wr=await resumed.wait(m=>m.type==='welcome');assert.equal(wr.type,'welcome');if(wr.type!=='welcome')throw new Error();assert.equal(wr.playerId,wb.playerId);assert.notEqual(wr.token,wb.token);
  const fire=setInterval(()=>a.send({v:1,type:'input',input:{...idleInput(),seq:++seq,yaw:-Math.PI/2,pitch:-.12,fire:true}}),40);
  timers.push(fire);
  const result=await a.wait(state('results'));clearInterval(fire);if(result.type!=='state')throw new Error();
  assert.equal(result.room.players.find(p=>p.id===wb.playerId)!.health,0);assert.equal(result.room.players.find(p=>p.id===wa.playerId)!.eliminations,1);assert.deepEqual(result.room.winners,[wa.playerId]);
  const otherResult=await resumed.wait(state('results'));if(otherResult.type==='state')assert.deepEqual(otherResult.room,result.room);
  a.send({v:1,type:'start'});await a.wait(m=>m.type==='state'&&m.room.matchId===2&&m.room.phase==='countdown');
  await a.wait(m=>m.type==='state'&&m.room.matchId===2&&m.room.phase==='playing');
  resumed.socket.close();await a.wait(m=>m.type==='state'&&m.room.matchId===2&&m.room.phase==='results');
  a.send({v:1,type:'lobby'});await a.wait(m=>m.type==='state'&&m.room.matchId===2&&m.room.phase==='lobby');
 }finally{for(const timer of timers)clearInterval(timer);for(const socket of sockets)socket.terminate();await server.close();}
});
test('server rejects forged authority and rate floods without affecting another room',async()=>{
 const server=await startServer({port:0,countdownSeconds:.01,matchSeconds:.2});const sockets:WebSocket[]=[];
 try{
  const a=await client(server.port),b=await client(server.port);sockets.push(a.socket,b.socket);
  a.send({v:1,type:'create',name:'One'});b.send({v:1,type:'create',name:'Two'});
  const aw=await a.wait(m=>m.type==='welcome'),bw=await b.wait(m=>m.type==='welcome');if(aw.type!=='welcome'||bw.type!=='welcome')throw new Error();assert.notEqual(aw.room.code,bw.room.code);
  a.socket.send(JSON.stringify({v:1,type:'input',input:{...idleInput(),position:{x:999},damage:100}}));await a.wait(m=>m.type==='error');
  for(let i=0;i<70;i++)a.send({v:1,type:'input',input:{...idleInput(),seq:i}});
  await new Promise<void>(resolve=>a.socket.once('close',()=>resolve()));assert.equal(b.socket.readyState,WebSocket.OPEN);
  assert.equal(server.rooms.rooms.get(bw.room.code)!.members.size,1);
 }finally{for(const socket of sockets)socket.terminate();await server.close();}
});
test('eight real clients respect capacity, transfer host on disconnect, and share timeout results',async()=>{
 const server=await startServer({port:0,countdownSeconds:.05,matchSeconds:.6,reconnectSeconds:.15});
 const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const host=await client(server.port);clients.push(host);host.send({v:1,type:'create',name:'Host'});
  const welcome=await host.wait(m=>m.type==='welcome');if(welcome.type!=='welcome')throw new Error();
  for(let i=1;i<8;i++){const guest=await client(server.port);clients.push(guest);guest.send({v:1,type:'join',code:welcome.room.code,name:`Pilot ${i}`});await guest.wait(m=>m.type==='welcome');}
  const extra=await client(server.port);clients.push(extra);extra.send({v:1,type:'join',code:welcome.room.code,name:'Ninth'});const full=await extra.wait(m=>m.type==='error');assert.equal(full.type,'error');
  for(const c of clients.slice(0,8))c.send({v:1,type:'ready',ready:true});
  await host.wait(m=>m.type==='state'&&m.room.players.length===8&&m.room.players.every(p=>p.ready));host.send({v:1,type:'start'});
  await clients[1].wait(state('playing'));host.socket.close();
  const transferred=await clients[1].wait(m=>m.type==='state'&&m.room.phase==='playing'&&m.room.hostId!==welcome.playerId);assert.equal(transferred.type,'state');
  const results=await Promise.all(clients.slice(1,8).map(c=>c.wait(state('results'))));
  for(const result of results){if(result.type!=='state')throw new Error();assert.equal(result.room.players.length,8);assert.equal(result.room.winners.length,7);assert.ok(!result.room.winners.includes(welcome.playerId));}
 }finally{for(const c of clients)c.socket.terminate();await server.close();}
});
test('configured origin allowlist rejects unexpected browser origins',async()=>{
 const server=await startServer({port:0,origins:['http://localhost:5173']});
 const bad=new WebSocket(`ws://127.0.0.1:${server.port}`,{origin:'http://unexpected.invalid'});bad.on('error',()=>{});
 try{
  const status=await new Promise<number>(resolve=>bad.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode??0);}));assert.equal(status,403);
  const good=new WebSocket(`ws://127.0.0.1:${server.port}`,{origin:'http://localhost:5173'});
  await new Promise<void>((resolve,reject)=>{good.once('open',resolve);good.once('error',reject);});good.terminate();
 }finally{bad.terminate();await server.close();}
});
