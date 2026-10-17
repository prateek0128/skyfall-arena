import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { WebSocketServer,WebSocket } from 'ws';
import RAPIER from '@dimforge/rapier3d-compat';
import { validateCommand,TICK_RATE,type ServerMessage } from '../shared/protocol.js';
import { Rooms,type Peer,type RoomOptions } from './rooms.js';
import { LOCAL_ORIGINS,parseOrigins } from './config.js';
import { Bucket,IpLimits } from './limits.js';
import { Metrics } from './metrics.js';
let initialized:Promise<void>|undefined;
export type ServerOptions=RoomOptions&{port?:number;host?:string;origins?:string[];allowOriginless?:boolean;maxConnectionsPerIp?:number;ipCommandBurst?:number;ipUpgradeBurst?:number;heartbeatMs?:number;handshakeMs?:number;shutdownMs?:number;logIntervalMs?:number;logger?:(event:Record<string,unknown>)=>void};
export async function startServer(options:ServerOptions={}){
 const origins=parseOrigins(options.origins??LOCAL_ORIGINS),log=(event:string,fields:Record<string,unknown>={})=>options.logger?.({time:new Date().toISOString(),event,...fields});
 initialized??=RAPIER.init();await initialized;
 const rooms=new Rooms(options);rooms.now=performance.now()/1000;
 const metrics=new Metrics(),ips=new IpLimits(options.maxConnectionsPerIp??32,options.ipCommandBurst??60,options.ipUpgradeBurst??40);
 let draining=false,failed=false,lastProgress=performance.now(),closing:Promise<void>|undefined;
 const http=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.writeHead(405,{'Allow':'GET'});res.end();return;}
  if(req.url==='/health'||req.url==='/ready'){
   const ready=!draining&&!failed&&performance.now()-lastProgress<2000,status=req.url==='/health'?!failed:ready;
   res.writeHead(status?200:503,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:status,ready,draining,protocol:1}));
  }else{res.writeHead(draining||failed?503:404);res.end();}
 });
 http.requestTimeout=10000;http.headersTimeout=10000;
 const wss=new WebSocketServer({server:http,maxPayload:2048,perMessageDeflate:false,verifyClient:({origin,req},done)=>{
  const ip=req.socket.remoteAddress??'unknown';
  if(draining||failed||wss.clients.size>=256){metrics.rejected++;done(false,503,'Unavailable');return;}
  if(origin? !origins.includes(origin):!(options.allowOriginless??true)){metrics.rejected++;log('upgrade_rejected',{reason:'origin'});done(false,403,'Origin denied');return;}
  if(!ips.upgrade(ip,performance.now())){metrics.rejected++;log('upgrade_rejected',{reason:'ip_limit'});done(false,429,'Connection rate exceeded');return;}
  done(true);
 }});
 wss.on('error',error=>{failed=true;log('websocket_server_error',{error:error.message});});
 wss.on('connection',(socket,req)=>{
  const ip=req.socket.remoteAddress??'unknown';ips.connected(ip,performance.now());
  const connectionId=randomUUID();log('connection_open',{connectionId,connections:wss.clients.size});
  const send=(message:ServerMessage)=>{if(socket.readyState===WebSocket.OPEN){
   if(socket.bufferedAmount>128*1024){metrics.backpressure++;socket.terminate();return;}
   const data=JSON.stringify(message);metrics.bytes+=Buffer.byteLength(data);if(message.type==='state')metrics.snapshots++;socket.send(data);
  }};
  const peer:Peer={id:connectionId,send,close:(code=4001,reason='Session replaced')=>socket.close(code,reason)};
  const inputRate=new Bucket(60,60,performance.now()),controlRate=new Bucket(10,10,performance.now());
  let violations=0,alive=true;
  const reject=(reason:string)=>{metrics.rejected++;log('command_rejected',{connectionId,reason});socket.close(1008,reason);};
  const heartbeat=setInterval(()=>{if(!alive){metrics.heartbeatTimeouts++;log('heartbeat_timeout',{connectionId});socket.terminate();return;}alive=false;socket.ping();},options.heartbeatMs??15000);heartbeat.unref();
  const handshake=setTimeout(()=>{if(!peer.room){log('session_timeout',{connectionId});socket.close(1008,'Join a room before session timeout');}},options.handshakeMs??10000);handshake.unref();
  socket.on('pong',()=>{alive=true;});
  socket.on('message',(raw,binary)=>{
   if(draining||failed)return;metrics.messages++;
   const now=performance.now();if(!inputRate.take(now)){reject('Input rate exceeded');return;}
   let command:unknown;try{command=binary?null:JSON.parse(raw.toString());}catch{command=null;}
   if(!validateCommand(command)){metrics.rejected++;send({v:1,type:'error',message:'Invalid command or protocol version.'});if(++violations>=3)reject('Invalid commands');return;}
   if(command.type!=='input'&&(!controlRate.take(now)||!ips.command(ip,now))){reject('Room command rate exceeded');return;}
   try{rooms.command(peer,command);}catch(error){failed=true;log('command_failure',{connectionId,error:error instanceof Error?error.message:'unknown'});socket.close(1011,'Server error');}
   if(peer.room)clearTimeout(handshake);
   if(command.type==='leave')socket.close(1000,'Left room');
  });
  socket.on('error',()=>log('socket_error',{connectionId}));
  socket.on('close',code=>{clearInterval(heartbeat);clearTimeout(handshake);ips.disconnected(ip);rooms.detach(peer);log('connection_close',{connectionId,code,connections:wss.clients.size});});
 });
 let last=performance.now(),accumulator=0;
 const timer=setInterval(()=>{
  if(draining||failed)return;
  const now=performance.now(),delta=(now-last)/1000;last=now;metrics.droppedMs+=Math.max(0,delta-.25)*1000;accumulator+=Math.min(.25,delta);
  try{while(accumulator>=1/TICK_RATE){const before=performance.now();rooms.tick(1/TICK_RATE,now/1000);metrics.tick(performance.now()-before);accumulator-=1/TICK_RATE;}lastProgress=performance.now();}
  catch(error){failed=true;log('simulation_failure',{error:error instanceof Error?error.message:'unknown'});}
 },1000/TICK_RATE);
 const operational=setInterval(()=>{ips.sweep(performance.now());log('server_metrics',{...metrics.snapshot(),rooms:rooms.rooms.size,connections:wss.clients.size,ready:!failed&&!draining});},options.logIntervalMs??30000);operational.unref();
 const release=()=>{clearInterval(timer);clearInterval(operational);metrics.stop();};
 try{await new Promise<void>((resolve,reject)=>{http.once('error',reject);http.listen(options.port??2567,options.host??'127.0.0.1',resolve);});}
 catch(error){release();wss.close();rooms.dispose();throw error;}
 log('server_started',{port:(http.address() as {port:number}).port,protocol:1,originCount:origins.length,originless:options.allowOriginless??true});
 const close=()=>closing??=(async()=>{
  draining=true;release();log('server_draining',{rooms:rooms.rooms.size,connections:wss.clients.size});
  for(const socket of wss.clients){if(socket.readyState===WebSocket.OPEN){socket.send(JSON.stringify({v:1,type:'error',message:'Server restarting. This room will end; create a new room after reconnecting.',fatal:true}));socket.close(1012,'Server restart');}}
  const force=setTimeout(()=>{for(const socket of wss.clients)socket.terminate();http.closeAllConnections();},options.shutdownMs??5000);force.unref();
  await new Promise<void>(resolve=>wss.close(()=>resolve()));await new Promise<void>(resolve=>http.close(()=>resolve()));clearTimeout(force);rooms.dispose();log('server_stopped');
 })();
 return {rooms,http,wss,metrics,port:(http.address() as {port:number}).port,close};
}
