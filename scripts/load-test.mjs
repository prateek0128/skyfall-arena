import { fork } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { cpus,platform,arch,release } from 'node:os';
import { writeFile } from 'node:fs/promises';
import { WebSocket } from 'ws';
import RAPIER from '@dimforge/rapier3d-compat';
import * as arena from '../dist-server/shared/arena.js';
import {AimMirror,CombatDriver,activityChecks} from './load-scenario.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(v=>v.replace(/^--/,'').split('=')));
for(const key of Object.keys(args))if(!['rooms','players','seconds','warmup','output','fire','scenario'].includes(key))throw new Error(`Unknown option --${key}`);
function integer(key,fallback,min,max){const n=Number(args[key]??fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`--${key} must be an integer ${min}..${max}`);return n;}
if(args.fire!==undefined&&!['true','false'].includes(args.fire))throw new Error('--fire must be true or false');
const fire=args.fire==='true',scenario=args.scenario??'skirmish';
if(!['skirmish','legacy'].includes(scenario))throw new Error('--scenario must be skirmish or legacy');
if(fire&&scenario==='skirmish')await RAPIER.init();
const mirrors=new Map();let measurementStart=0;
const roomCount=integer('rooms',4,1,32),players=integer('players',8,2,8),duration=integer('seconds',30,5,120),warmup=integer('warmup',5,1,30);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const dist=values=>{const s=[...values].sort((a,b)=>a-b);return {count:s.length,p50:s[Math.floor((s.length-1)*.5)]??0,p95:s[Math.floor((s.length-1)*.95)]??0,p99:s[Math.floor((s.length-1)*.99)]??0,max:s.at(-1)??0};};
const child=fork(new URL('./load-server.mjs',import.meta.url),[],{stdio:['ignore','ignore','inherit','ipc']});
let childFailure;
child.on('exit',code=>{if(code&&code!==0)childFailure=new Error(`Server exited ${code}`);});
const replies=[];child.on('message',m=>replies.push(m));
async function reply(type){const started=performance.now();while(performance.now()-started<15000){if(childFailure)throw childFailure;const index=replies.findIndex(m=>m.type===type);if(index>=0)return replies.splice(index,1)[0];await sleep(10);}throw new Error(`Server IPC timed out: ${type}`);}
const bots=[];let inputTimer,measuring=false,unexpectedDisconnects=0,errors=[];
async function bot(port,index){
 const socket=new WebSocket(`ws://127.0.0.1:${port}`,{origin:'http://load.invalid'});
 const b={socket,index,room:null,id:'',seq:0,welcomes:0,times:[],messages:[],start:null,basePosition:null,ackStart:0,shotStart:0,maxDistance:0,lastMeasuredTick:-1,nonPlaying:0,minimumAlive:players,windows:[],lastShotAt:0,maxShotGapMs:0,lastShots:0,lastAck:0,lastPosition:null,driver:new CombatDriver(),intents:{cover:0,skirmish:0,unsafe:0,stale:0}};bots.push(b);
 socket.on('message',raw=>{
  const m=JSON.parse(raw.toString());
  if(m.type==='error')errors.push(m.message);
  if(m.type==='welcome'){b.id=m.playerId;b.welcomes++;}
  if(m.type==='state'||m.type==='welcome'){
   b.room=m.room;b.receivedAt=performance.now();const p=m.room.players.find(p=>p.id===b.id);
   if(p&&!b.basePosition)b.basePosition={...p.position};
   if(measuring&&m.type==='state'){
    const now=performance.now();b.times.push(now);b.minimumAlive=Math.min(b.minimumAlive,m.room.players.filter(p=>p.alive).length);
    if(p){const slot=Math.floor((now-measurementStart)/1000);const w=b.windows[slot]??={acks:0,shots:0,distance:0};w.acks+=Math.max(0,p.ack-b.lastAck);w.shots+=Math.max(0,p.shots-b.lastShots);if(b.lastPosition)w.distance+=Math.hypot(p.position.x-b.lastPosition.x,p.position.y-b.lastPosition.y,p.position.z-b.lastPosition.z);if(p.shots>b.lastShots){b.maxShotGapMs=Math.max(b.maxShotGapMs,now-b.lastShotAt);b.lastShotAt=now;}b.lastAck=p.ack;b.lastShots=p.shots;b.lastPosition={...p.position};}
    if(m.room.phase!=='playing')b.nonPlaying++;
    if(m.room.tick<=b.lastMeasuredTick)errors.push('Non-increasing snapshot tick');b.lastMeasuredTick=m.room.tick;
    if(p&&b.start)b.maxDistance=Math.max(b.maxDistance,Math.hypot(p.position.x-b.start.x,p.position.y-b.start.y,p.position.z-b.start.z));
   }
  }
 });
 socket.on('error',e=>errors.push(e.message));socket.on('close',()=>{if(measuring)unexpectedDisconnects++;});
 await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
 return b;
}
function send(b,message){if(b.socket.readyState===WebSocket.OPEN)b.socket.send(JSON.stringify({v:1,...message}));}
async function until(predicate,label){const at=performance.now();while(!predicate()){if(performance.now()-at>15000||childFailure||errors.length)throw childFailure??new Error(`${label}: ${errors.join('; ')}`);await sleep(10);}}
try{
 const {port}=await reply('listening');
 for(let r=0;r<roomCount;r++){
  const host=await bot(port,0);send(host,{type:'create',name:`Host ${r}`});await until(()=>host.welcomes===1,'Create');
  const group=[host];
  for(let p=1;p<players;p++){const b=await bot(port,p);send(b,{type:'join',name:`Pilot ${p}`,code:host.room.code});await until(()=>b.welcomes===1,'Join');group.push(b);}
  for(const b of group)send(b,{type:'ready',ready:true});await until(()=>host.room.players.length===players&&host.room.players.every(p=>p.ready),'Ready');send(host,{type:'start'});
  await until(()=>group.every(b=>b.room?.phase==='playing'),'Start');
 }
 const driverStart=performance.now();
 inputTimer=setInterval(()=>{
  for(const b of bots){const p=b.room?.players.find(p=>p.id===b.id);if(!p)continue;
   // Bounded feedback movement keeps every pilot alive and all rooms simulating.
   const mirror=fire&&scenario==='skirmish'?(mirrors.get(b.room.code)??(()=>{const m=new AimMirror(RAPIER,arena);mirrors.set(b.room.code,m);return m;})()):null;
   if(mirror)mirror.update(b.room);
   const aim=mirror?(performance.now()-b.receivedAt>150?{yaw:0,pitch:.85,fire:false,intent:'stale'}:b.driver.choose(b.room,p,b.index,mirror,performance.now()/1000,measuring)):{yaw:0,pitch:.85,fire,intent:'cover'};
   if(measuring)b.intents[aim.intent]++;
   const amplitude=mirror ? .35 : 1.2;
   // Nearby separated pairs avoid shooting across another pair's flight lane.
   const target=mirror?{x:[-7,-4,3,6,-7,-4,3,6][b.index],z:b.index<4?2:-2}:b.basePosition,age=(performance.now()-driverStart)/1000,dx=target.x+Math.sin(age*2+b.index)*amplitude-p.position.x,dz=target.z+Math.cos(age*2+b.index)*amplitude-p.position.z;
   const localX=dx*Math.cos(aim.yaw)-dz*Math.sin(aim.yaw),localZ=dx*Math.sin(aim.yaw)+dz*Math.cos(aim.yaw);
   send(b,{type:'input',input:{seq:++b.seq,x:Math.abs(localX)<.2?0:Math.sign(localX),z:Math.abs(localZ)<.2?0:Math.sign(localZ),yaw:aim.yaw,pitch:aim.pitch,thrust:p.position.y<5,boost:mirror?age%6<2:b.index%3===0,fire:aim.fire&&(!mirror||measuring)}});
  }
 },1000/30);
 await sleep(warmup*1000);
 for(const b of bots){const p=b.room.players.find(p=>p.id===b.id);b.start={...p.position};b.ackStart=p.ack;b.shotStart=p.shots;b.hitStart=p.hits;b.healthStart=p.health;b.lastShots=p.shots;b.lastAck=p.ack;b.lastPosition={...p.position};}
 child.send({type:'reset'});await reply('reset');measuring=true;const start=performance.now();measurementStart=start;for(const b of bots)b.lastShotAt=start;
 await sleep(duration*1000);const elapsed=(performance.now()-start)/1000;measuring=false;child.send({type:'metrics'});const result=await reply('metrics');
 const hz=bots.map(b=>b.times.length/elapsed),gaps=bots.flatMap(b=>b.times.slice(1).map((t,i)=>t-b.times[i]));
 const pilotChecks=bots.map(b=>{const p=b.room.players.find(p=>p.id===b.id);return {alive:p.alive,health:p.health,ackAdvance:p.ack-b.ackStart,shotsAdvance:p.shots-b.shotStart,maxDistance:b.maxDistance,nonPlayingSnapshots:b.nonPlaying,expectedPlayers:players,minimumAlive:b.minimumAlive,hitsAdvance:p.hits-b.hitStart,healthStart:b.healthStart,damageReceived:b.healthStart-p.health,maxShotGapMs:Math.max(b.maxShotGapMs,performance.now()-b.lastShotAt),windows:Array.from({length:duration},(_,i)=>b.windows[i]??{acks:0,shots:0,distance:0}),intents:b.intents};});
 const verified=pilotChecks.every(p=>activityChecks(p,fire,duration));
 const checks={allPilotsActive:verified,...(fire&&scenario==='skirmish'?{validatedSkirmishEveryPilot:pilotChecks.every(p=>p.hitsAdvance>=2&&p.damageReceived>=50&&p.healthStart===100)}:{}),noDisconnects:unexpectedDisconnects===0,noErrors:errors.length===0,tickP95UnderBudget:result.metrics.tickMs.p95<1000/30,lessThanOnePercentOverBudget:result.metrics.overBudgetTicks/Math.max(1,result.metrics.ticks)<.01,noDroppedSimulationTime:result.metrics.droppedSimulationMs===0,minSnapshotHz:Math.min(...hz)>=13.5,maxSnapshotGapUnder500ms:dist(gaps).max<500};
 const report={generatedAt:new Date().toISOString(),profile:{rooms:roomCount,playersPerRoom:players,connections:bots.length,warmupSeconds:warmup,measurementSeconds:elapsed,inputHz:30,fire,scenario:fire?scenario:'flight',aimPattern:fire&&scenario==='skirmish'?'snapshot-informed safe cover fire plus two authoritative hits per pilot; no server overrides':'legacy fixed forward/upward',activityThresholds:{minAcksPerSecond:15,minShotsPerSecond:fire?4:0,minMovementPerSecond:.03,maxShotGapMs:500},warmupFire:fire&&scenario==='legacy',scope:fire?(scenario==='skirmish'?'Sustained nonlethal cover fire/skirmish, not elimination-heavy combat':'Legacy fixed-aim combat; eliminations expected'):'Flight/snapshot capacity'},environment:{node:process.version,platform:platform(),release:release(),arch:arch(),cpu:cpus()[0]?.model,logicalCpus:cpus().length},method:'Dedicated compiled Node server child; real ws bots in parent on same machine/loopback; no rendering/TLS/WAN. Per-IP admission bursts lifted for co-located bots, all payload/per-socket validation retained.',server:result.metrics,client:{snapshotHz:dist(hz),snapshotGapMs:dist(gaps),unexpectedDisconnects,errors,allPilotsVerifiedActive:verified,pilotChecks},checks,passed:Object.values(checks).every(Boolean)};
 if(args.output)await writeFile(args.output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
}finally{
 measuring=false;clearInterval(inputTimer);for(const m of mirrors.values())m.dispose();for(const b of bots)b.socket.terminate();
 if(child.connected){child.send({type:'stop'});const timeout=setTimeout(()=>child.kill('SIGKILL'),7000);await new Promise(resolve=>child.once('exit',resolve));clearTimeout(timeout);}
}
