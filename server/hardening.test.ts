import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer } from './app';
import { loadConfig,parseOrigins } from './config';
import { Bucket,IpLimits } from './limits';
import { Rooms,type Peer } from './rooms';
import { idleInput,validateCommand,type ServerMessage } from '../shared/protocol';
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean){const start=Date.now();while(!fn()){if(Date.now()-start>3000)throw new Error('Condition timed out');await sleep(5);}}
async function socket(port:number,options:ConstructorParameters<typeof WebSocket>[1]={}){
 const ws=new WebSocket(`ws://127.0.0.1:${port}`,options),messages:ServerMessage[]=[];ws.on('error',()=>{});ws.on('message',raw=>messages.push(JSON.parse(raw.toString()) as ServerMessage));
 await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return {ws,messages};
}
test('production config fails closed and origins are exact, canonical HTTPS origins',()=>{
 assert.throws(()=>loadConfig({NODE_ENV:'production'}),/ALLOWED_ORIGINS/);
 for(const origin of ['*','null','https://game.example/','https://game.example/path','https://user:pass@game.example','http://game.example'])assert.throws(()=>parseOrigins([origin],true));
 const config=loadConfig({NODE_ENV:'production',ALLOWED_ORIGINS:'https://game.example'});assert.equal(config.allowOriginless,false);assert.deepEqual(config.origins,['https://game.example']);
 for(const env of [{PORT:'0'},{PORT:'2567.2'},{ALLOW_ORIGINLESS:'yes'},{HEARTBEAT_MS:'1'},{ALLOWED_ORIGINS:''}])assert.throws(()=>loadConfig(env));
});
test('token buckets do not reset across boundary or reconnect, idle IP entries expire',()=>{
 const b=new Bucket(2,1,0);assert.ok(b.take(0));assert.ok(b.take(0));assert.ok(!b.take(999));assert.ok(b.take(1000));assert.ok(!b.take(1001));
 const ip=new IpLimits(1,2);assert.ok(ip.upgrade('a',0));ip.connected('a',0);assert.ok(!ip.upgrade('a',1));ip.disconnected('a');assert.ok(ip.command('a',0));assert.ok(ip.command('a',0));assert.ok(!ip.command('a',1));ip.sweep(61000);assert.ok(ip.command('a',61001));
});
test('health/readiness, graceful restart notification, refusal of upgrades and idempotent shutdown',async()=>{
 const logs:Record<string,unknown>[]=[];const server=await startServer({port:0,shutdownMs:500,logger:e=>logs.push(e)});
 const c=await socket(server.port,{autoPong:false}),hold=await socket(server.port);hold.ws.pause();
 try{
  assert.equal((await fetch(`http://127.0.0.1:${server.port}/health`)).status,200);assert.equal((await fetch(`http://127.0.0.1:${server.port}/ready`)).status,200);
  assert.equal((await fetch(`http://127.0.0.1:${server.port}/health`,{method:'POST'})).status,405);
  const close=server.close();assert.equal(server.close(),close);await until(()=>c.messages.some(m=>m.type==='error'&&m.fatal===true));
  assert.equal((await fetch(`http://127.0.0.1:${server.port}/ready`)).status,503);
  const rejected=new WebSocket(`ws://127.0.0.1:${server.port}`);rejected.on('error',()=>{});
  const status=await new Promise<number>(resolve=>rejected.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode??0);}));assert.equal(status,503);rejected.terminate();
  await close;assert.equal(server.rooms.rooms.size,0);assert.ok(logs.some(e=>e.event==='server_stopped'));
 }finally{c.ws.terminate();hold.ws.terminate();await server.close();}
});
test('heartbeat failure and unjoined session timeout remove stale clients',async()=>{
 const server=await startServer({port:0,heartbeatMs:30,handshakeMs:90});
 const a=await socket(server.port,{autoPong:false}),b=await socket(server.port);
 try{
  a.ws.send(JSON.stringify({v:1,type:'create',name:'A'}));
  await until(()=>a.ws.readyState===WebSocket.CLOSED);assert.equal(server.metrics.heartbeatTimeouts,1);
  await until(()=>b.ws.readyState===WebSocket.CLOSED);await until(()=>server.wss.clients.size===0);
 }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});
test('default origin policy rejects hostile origins and configured policy rejects missing origins',async()=>{
 for(const options of [{},{origins:['https://game.example'],allowOriginless:false}]){
  const server=await startServer({port:0,...options});
  const ws=new WebSocket(`ws://127.0.0.1:${server.port}`,Object.keys(options).length?{}:{origin:'https://evil.invalid'});ws.on('error',()=>{});
  try{const status=await new Promise<number>(resolve=>ws.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode??0);}));assert.equal(status,403);}finally{ws.terminate();await server.close();}
 }
});
test('malformed JSON, binary messages, wrong versions, oversized payloads and forged authority close sockets',async()=>{
 const server=await startServer({port:0});const sockets:WebSocket[]=[];
 try{
  for(const payload of ['{',JSON.stringify({v:99,type:'start'}),Buffer.from('{}')]){
   const c=await socket(server.port);sockets.push(c.ws);for(let i=0;i<3;i++)c.ws.send(payload);
   await until(()=>c.ws.readyState===WebSocket.CLOSED);assert.ok(c.messages.some(m=>m.type==='error'));
  }
  const large=await socket(server.port);sockets.push(large.ws);large.ws.send('x'.repeat(2049));await until(()=>large.ws.readyState===WebSocket.CLOSED);
  assert.equal(validateCommand({v:1,type:'input',input:{...idleInput(),health:100,score:999}}),false);
  for(const value of [NaN,Infinity,-Infinity])assert.equal(validateCommand({v:1,type:'input',input:{...idleInput(),pitch:value}}),false);
 }finally{for(const ws of sockets)ws.terminate();await server.close();}
});
test('per-IP connection admission and room guessing budgets persist across sockets',async()=>{
 const server=await startServer({port:0,maxConnectionsPerIp:1,ipCommandBurst:1});const a=await socket(server.port);
 try{
  const rejected=new WebSocket(`ws://127.0.0.1:${server.port}`);rejected.on('error',()=>{});
  const status=await new Promise<number>(resolve=>rejected.once('unexpected-response',(_req,res)=>{res.resume();resolve(res.statusCode??0);}));assert.equal(status,429);rejected.terminate();
  a.ws.send(JSON.stringify({v:1,type:'join',name:'A',code:'AAAAAA'}));await until(()=>a.messages.length>0);
  a.ws.send(JSON.stringify({v:1,type:'join',name:'A',code:'AAAAAB'}));await until(()=>a.ws.readyState===WebSocket.CLOSED);
 }finally{a.ws.terminate();await server.close();}
});
test('unauthorized and duplicate room commands cannot bypass host, readiness or match guards',async()=>{
 const server=await startServer({port:0,countdownSeconds:.01});const a=await socket(server.port),b=await socket(server.port);
 const send=(c:typeof a,m:object)=>c.ws.send(JSON.stringify({v:1,...m}));
 try{
  send(a,{type:'create',name:'A'});await until(()=>a.messages.some(m=>m.type==='welcome'));const wa=a.messages.find(m=>m.type==='welcome');if(wa?.type!=='welcome')throw new Error();
  send(b,{type:'join',name:'B',code:wa.room.code});await until(()=>b.messages.some(m=>m.type==='welcome'));
  send(b,{type:'start'});send(b,{type:'lobby'});await until(()=>b.messages.filter(m=>m.type==='error').length>=2);
  for(const c of [a,b])send(c,{type:'ready',ready:true});await until(()=>a.messages.some(m=>m.type==='state'&&m.room.players.length===2&&m.room.players.every(p=>p.ready)));
  send(a,{type:'start'});send(a,{type:'start'});await until(()=>a.messages.some(m=>m.type==='state'&&m.room.phase==='playing'));
  const r=server.rooms.rooms.get(wa.room.code)!;assert.equal(r.matchId,1);
  send(a,{type:'input',input:{...idleInput(),seq:2,x:1}});send(a,{type:'input',input:{...idleInput(),seq:2,x:-1}});await until(()=>r.members.get(wa.playerId)!.pilot.state.ack===2);assert.equal(r.members.get(wa.playerId)!.pilot.input.x,1);
 }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});
test('abrupt disconnect expiry invalidates tokens and frees an abandoned active room',async()=>{
 const server=await startServer({port:0,countdownSeconds:.01,reconnectSeconds:.08});const a=await socket(server.port),b=await socket(server.port);
 try{
  a.ws.send(JSON.stringify({v:1,type:'create',name:'A'}));await until(()=>a.messages.some(m=>m.type==='welcome'));const wa=a.messages.find(m=>m.type==='welcome');if(wa?.type!=='welcome')throw new Error();
  b.ws.send(JSON.stringify({v:1,type:'join',name:'B',code:wa.room.code}));await until(()=>b.messages.some(m=>m.type==='welcome'));
  for(const c of [a,b])c.ws.send(JSON.stringify({v:1,type:'ready',ready:true}));await until(()=>a.messages.some(m=>m.type==='state'&&m.room.players.length===2&&m.room.players.every(p=>p.ready)));
  a.ws.send(JSON.stringify({v:1,type:'start'}));await until(()=>a.messages.some(m=>m.type==='state'&&m.room.phase==='playing'));a.ws.terminate();b.ws.terminate();
  await until(()=>server.rooms.rooms.size===0);const c=await socket(server.port);
  c.ws.send(JSON.stringify({v:1,type:'resume',code:wa.room.code,playerId:wa.playerId,token:wa.token}));await until(()=>c.messages.some(m=>m.type==='error'));c.ws.terminate();
 }finally{a.ws.terminate();b.ws.terminate();await server.close();}
});
test('room expiry uses monotonic housekeeping time even if simulation catch-up is bounded',()=>{
 const rooms=new Rooms({reconnectSeconds:20});rooms.now=100;
 const peer:Peer={id:'x',send:()=>{},close:()=>{}};rooms.command(peer,{v:1,type:'create',name:'A'});rooms.detach(peer);
 rooms.tick(1/30,121);assert.equal(rooms.rooms.size,0);rooms.dispose();
});
test('simulation failure flips health and readiness and produces an operational error log',async()=>{
 const events:Record<string,unknown>[]=[];const server=await startServer({port:0,logger:e=>events.push(e)});
 try{
  server.rooms.tick=()=>{throw new Error('controlled test failure');};
  await until(()=>events.some(e=>e.event==='simulation_failure'));
  assert.equal((await fetch(`http://127.0.0.1:${server.port}/ready`)).status,503);
  assert.equal((await fetch(`http://127.0.0.1:${server.port}/health`)).status,503);
 }finally{await server.close();}
});
test('server restart does not resurrect an old room or reconnect credential',async()=>{
 const old=await startServer({port:0});const a=await socket(old.port);let welcome:Extract<ServerMessage,{type:'welcome'}>;
 try{a.ws.send(JSON.stringify({v:1,type:'create',name:'A'}));await until(()=>a.messages.some(m=>m.type==='welcome'));welcome=a.messages.find(m=>m.type==='welcome') as typeof welcome;}finally{a.ws.terminate();await old.close();}
 const fresh=await startServer({port:0});const b=await socket(fresh.port);
 try{
  b.ws.send(JSON.stringify({v:1,type:'resume',code:welcome.room.code,playerId:welcome.playerId,token:welcome.token}));
  await until(()=>b.messages.some(m=>m.type==='error'));assert.equal(fresh.rooms.rooms.size,0);assert.ok(!b.messages.some(m=>m.type==='welcome'));
 }finally{b.ws.terminate();await fresh.close();}
});
test('inactive connected lobbies expire with a fatal notice and release room resources',()=>{
 const rooms=new Rooms({idleSeconds:.1});const messages:ServerMessage[]=[];let closed=0;
 const peer:Peer={id:'x',send:m=>messages.push(m),close:()=>{closed++;}};
 rooms.command(peer,{v:1,type:'create',name:'A'});rooms.tick(.2);
 assert.equal(rooms.rooms.size,0);assert.equal(peer.room,undefined);assert.equal(closed,1);assert.ok(messages.some(m=>m.type==='error'&&m.fatal));rooms.dispose();
});
test('startup bind failure releases its scheduler and can be retried on another port',async()=>{
 const a=await startServer({port:0});try{await assert.rejects(startServer({port:a.port}),/EADDRINUSE/);const b=await startServer({port:0});await b.close();}finally{await a.close();}
});
