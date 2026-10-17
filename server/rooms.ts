import { randomBytes,randomInt,randomUUID,timingSafeEqual } from 'node:crypto';
import { MAX_PLAYERS,PROTOCOL_VERSION,type ClientCommand,type RoomSnapshot,type ServerMessage } from '../shared/protocol.js';
import { Simulation,type Pilot } from './simulation.js';
export type Peer={id:string;send:(message:ServerMessage)=>void;close:(code?:number,reason?:string)=>void;room?:string;playerId?:string};
type Member={pilot:Pilot;token:string;peer?:Peer};
type Room={code:string;hostId:string;phase:RoomSnapshot['phase'];sim:Simulation;members:Map<string,Member>;tick:number;matchId:number;remaining:number;winners:string[];reason:string;lastActive:number};
export type RoomOptions={countdownSeconds?:number;matchSeconds?:number;reconnectSeconds?:number;idleSeconds?:number};
export class Rooms{
 rooms=new Map<string,Room>();now=0;
 readonly options:Required<RoomOptions>;
 constructor(options:RoomOptions={}){this.options={countdownSeconds:3,matchSeconds:120,reconnectSeconds:20,idleSeconds:600,...options};}
 error(peer:Peer,message:string){peer.send({v:PROTOCOL_VERSION,type:'error',message});}
 snapshot(r:Room):RoomSnapshot{return {code:r.code,hostId:r.hostId,phase:r.phase,tick:r.tick,matchId:r.matchId,remaining:r.remaining,winners:[...r.winners],reason:r.reason,players:[...r.members.values()].map(m=>({...m.pilot.state,position:{...m.pilot.state.position},velocity:{...m.pilot.state.velocity}}))};}
 broadcast(r:Room,message:ServerMessage){for(const m of r.members.values())m.peer?.send(message);}
 publish(r:Room){this.broadcast(r,{v:1,type:'state',room:this.snapshot(r)});}
 attach(r:Room,m:Member,peer:Peer){
  // Revoke the old socket before closing it so its delayed close cannot detach the replacement.
  const old=m.peer;if(old){old.room=undefined;old.playerId=undefined;old.close();}
  m.peer=peer;m.token=randomBytes(32).toString('hex');m.pilot.state.connected=true;
  m.pilot.lastInput=-Infinity;m.pilot.state.ack=-1;m.pilot.input.seq=0;
  peer.room=r.code;peer.playerId=m.pilot.state.id;r.lastActive=this.now;
  if(!r.hostId)r.hostId=peer.playerId;
  peer.send({v:1,type:'welcome',playerId:peer.playerId,token:m.token,room:this.snapshot(r)});this.publish(r);
 }
 add(r:Room,peer:Peer,name:string){const id=randomUUID();const m:Member={pilot:r.sim.add(id,name,r.members.size),token:''};r.members.set(id,m);this.attach(r,m,peer);}
 command(peer:Peer,command:ClientCommand){
  if(command.type==='resume'){
   if(peer.room)return this.error(peer,'Leave your current room first.');
   const r=this.rooms.get(command.code),m=r?.members.get(command.playerId);
   if(!r||!m||m.pilot.retired||m.token.length!==command.token.length||!timingSafeEqual(Buffer.from(m.token),Buffer.from(command.token)))return this.error(peer,'Session expired or invalid. Join again from the lobby.');
   if(!m.peer&&this.now-m.pilot.disconnectedAt>this.options.reconnectSeconds)return this.error(peer,'Reconnect window expired.');
   this.attach(r,m,peer);return;
  }
  if(command.type==='create'||command.type==='join'){
   if(peer.room)return this.error(peer,'Leave your current room first.');
   if(command.type==='create'){
    if(this.rooms.size>=32)return this.error(peer,'Server room capacity reached.');
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let code:string;
    do{code=Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}while(this.rooms.has(code));
    const r:Room={code,hostId:'',phase:'lobby',sim:new Simulation(),members:new Map(),tick:0,matchId:0,remaining:0,winners:[],reason:'',lastActive:this.now};this.rooms.set(code,r);this.add(r,peer,command.name);
   }else{
    const r=this.rooms.get(command.code);if(!r)return this.error(peer,'Room not found.');
    if(r.phase!=='lobby')return this.error(peer,'Match already started. Wait for the host to return to lobby.');
    if(r.members.size>=MAX_PLAYERS)return this.error(peer,'Room is full (8 players).');
    this.add(r,peer,command.name);
   }return;
  }
  const r=peer.room?this.rooms.get(peer.room):undefined,m=r?.members.get(peer.playerId??'');
  if(!r||!m||m.peer!==peer)return this.error(peer,'Join a room first.');
  if(command.type!=='input')r.lastActive=this.now;
  switch(command.type){
   case 'leave':this.leave(peer);peer.send({v:1,type:'left'});break;
   case 'ready':if(r.phase!=='lobby')return this.error(peer,'Readiness can only change in lobby.');m.pilot.state.ready=command.ready;this.publish(r);break;
   case 'lobby':
    if(r.hostId!==peer.playerId||r.phase!=='results')return this.error(peer,'Only the host can return results to lobby.');
    for(const [id,member] of r.members)if(member.pilot.retired){r.sim.remove(id);r.members.delete(id);}
    r.phase='lobby';r.remaining=0;r.winners=[];for(const member of r.members.values())member.pilot.state.ready=false;this.publish(r);break;
   case 'start':{
    if(r.hostId!==peer.playerId)return this.error(peer,'Only the host can start.');
    if(r.phase!=='lobby'&&r.phase!=='results')return this.error(peer,'Match already starting or running.');
    const connected=[...r.members.values()].filter(member=>member.peer&&!member.pilot.retired);
    if(connected.length<2)return this.error(peer,'At least two connected players are required.');
    if(r.phase==='lobby'&&connected.some(member=>!member.pilot.state.ready))return this.error(peer,'All connected players must be ready.');
    for(const [id,member] of r.members)if(!member.peer||member.pilot.retired){r.sim.remove(id);r.members.delete(id);}
    r.sim.reset();r.phase='countdown';r.matchId++;r.remaining=this.options.countdownSeconds;r.winners=[];r.reason='';this.publish(r);break;
   }
   case 'input':{
    if(r.phase!=='playing'||!m.pilot.state.alive)return;
    const i=command.input;
    if(i.seq<=m.pilot.state.ack||i.seq-m.pilot.state.ack>10000)return;
    m.pilot.input=i;m.pilot.state.ack=i.seq;m.pilot.lastInput=r.sim.time;break;
   }
  }
 }
 detach(peer:Peer){
  const r=peer.room?this.rooms.get(peer.room):undefined,m=r?.members.get(peer.playerId??'');
  if(!r||!m||m.peer!==peer)return;
  m.peer=undefined;m.pilot.state.connected=false;m.pilot.state.ready=false;m.pilot.disconnectedAt=this.now;m.pilot.lastInput=-Infinity;
  peer.room=undefined;peer.playerId=undefined;r.lastActive=this.now;
  this.host(r);if(r.phase==='countdown'){r.phase='lobby';r.remaining=0;for(const member of r.members.values())member.pilot.state.ready=false;}
  this.publish(r);
 }
 leave(peer:Peer){
  const code=peer.room,id=peer.playerId;this.detach(peer);const r=code?this.rooms.get(code):undefined;
  if(!r||!id)return;const m=r.members.get(id);if(!m)return;
  m.pilot.retired=true;m.token='';
  if(r.phase==='playing'||r.phase==='results')r.sim.eliminate(m.pilot);
  else{r.sim.remove(id);r.members.delete(id);}
  this.host(r);this.finishIfNeeded(r);this.publish(r);this.cleanup(r);
 }
 host(r:Room){if(!r.members.get(r.hostId)?.peer)r.hostId=[...r.members].find(([,m])=>m.peer&&!m.pilot.retired)?.[0]??'';}
 finishIfNeeded(r:Room){
  if(r.phase!=='playing')return;
  const alive=[...r.members.values()].filter(m=>m.pilot.state.alive);
  if(alive.length<=1){r.winners=alive.map(m=>m.pilot.state.id);r.reason=alive.length?'Last pilot standing':'No survivors';r.phase='results';r.lastActive=this.now;}
  else if(r.remaining<=0){
   const best=Math.max(...alive.map(m=>m.pilot.state.score));const leaders=alive.filter(m=>m.pilot.state.score===best);
   const health=Math.max(...leaders.map(m=>m.pilot.state.health));r.winners=leaders.filter(m=>m.pilot.state.health===health).map(m=>m.pilot.state.id);
   r.reason=r.winners.length>1?'Time limit · shared victory':'Time limit · highest score, then hull';r.phase='results';r.lastActive=this.now;
  }
 }
 cleanup(r:Room){
  if((r.phase==='lobby'||r.phase==='results')&&this.now-r.lastActive>this.options.idleSeconds){
   for(const m of r.members.values())if(m.peer){const peer=m.peer;peer.room=undefined;peer.playerId=undefined;peer.send({v:1,type:'error',message:'Room expired due to inactivity. Create or join another room.',fatal:true});peer.close(1000,'Room expired');}
   r.sim.dispose();this.rooms.delete(r.code);return;
  }
  if(!r.members.size||(![...r.members.values()].some(m=>m.peer)&&([...r.members.values()].every(m=>m.pilot.retired)||this.now-r.lastActive>this.options.idleSeconds))){
   r.sim.dispose();this.rooms.delete(r.code);
  }
 }
 tick(dt:number,monotonicSeconds?:number){
  this.now=monotonicSeconds??this.now+dt;
  for(const r of this.rooms.values()){
   const previousPhase=r.phase;r.tick++;
   for(const [id,m] of r.members)if(!m.peer&&!m.pilot.retired&&this.now-m.pilot.disconnectedAt>this.options.reconnectSeconds){
    m.pilot.retired=true;m.token='';if(r.phase==='playing'||r.phase==='results')r.sim.eliminate(m.pilot);else{r.sim.remove(id);r.members.delete(id);}
   }
   this.host(r);
   if(r.phase==='countdown'){r.remaining=Math.max(0,r.remaining-dt);if(r.remaining===0){r.phase='playing';r.remaining=this.options.matchSeconds;}}
   else if(r.phase==='playing'){
    r.remaining=Math.max(0,r.remaining-dt);
    const events=r.sim.step(dt);if(events.length)this.broadcast(r,{v:1,type:'shots',matchId:r.matchId,events});this.finishIfNeeded(r);
   }
   if(r.tick%2===0||r.phase!==previousPhase)this.publish(r);this.cleanup(r);
  }
 }
 dispose(){for(const r of this.rooms.values())r.sim.dispose();this.rooms.clear();}
}
