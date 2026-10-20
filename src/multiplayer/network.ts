import { useSyncExternalStore } from 'react';
import { websocketUrl } from '../../shared/websocket-url';
import { validateCommand,PROTOCOL_VERSION,type ClientCommand,type RoomSnapshot,type ServerMessage,type PlayerSnapshot,type ShotEvent,type Input } from '../../shared/protocol';
import { sound } from '../game/audio';
type Session={code:string;playerId:string;token:string};
type NetworkState={status:'offline'|'connecting'|'connected'|'reconnecting';room:RoomSnapshot|null;playerId:string;error:string;menu:boolean;loaded:boolean;hitAt:number;hurtAt:number;killAt:number};
let state:NetworkState={status:'offline',room:null,playerId:'',error:'',menu:true,loaded:false,hitAt:-Infinity,hurtAt:-Infinity,killAt:-Infinity};
let socket:WebSocket|undefined,session:Session|undefined,retry:ReturnType<typeof setTimeout>|undefined,generation=0,attempts=0,seq=0,lastEvent=0;
let connectionTimer:ReturnType<typeof setTimeout>|undefined,recoveryUntil=0;
function clearConnectionTimer(){if(connectionTimer)clearTimeout(connectionTimer);connectionTimer=undefined;}
function endSession(error:string){
 ++generation;if(retry)clearTimeout(retry);clearConnectionTimer();saveSession();frames.length=0;socket?.close();socket=undefined;
 set({status:'offline',room:null,playerId:'',menu:true,error});
}
const listeners=new Set<()=>void>();
const shotListeners=new Set<(event:ShotEvent)=>void>();
const frames:{at:number;room:RoomSnapshot}[]=[];
function set(patch:Partial<NetworkState>){state={...state,...patch};listeners.forEach(fn=>fn());}
function saveSession(value?:Session){session=value;try{if(value)sessionStorage.setItem('skyfall-session-v1',JSON.stringify(value));else sessionStorage.removeItem('skyfall-session-v1');}catch{/* In-memory reconnect still works if storage is disabled. */}}
function receive(message:ServerMessage){
 if(message.v!==PROTOCOL_VERSION){set({error:'Server protocol is incompatible.'});return;}
 if(message.type==='error'){
  if(message.fatal){endSession(message.message);return;}
  if(state.status==='reconnecting'){endSession(message.message);return;}
  set({error:message.message});return;
 }
 if(message.type==='left'){saveSession();frames.length=0;set({room:null,playerId:'',menu:true});return;}
 if(message.type==='shots'){
  if(message.matchId!==state.room?.matchId)return;
  for(const e of message.events){if(e.id<=lastEvent)continue;lastEvent=e.id;
   shotListeners.forEach(fn=>fn(e));
   if(e.shooter===state.playerId){sound('shot');if(e.hit){set({hitAt:performance.now(),...(e.eliminated?{killAt:performance.now()}:{})});sound(e.eliminated?'destroy':'hit');}}
   if(e.hit===state.playerId){set({hurtAt:performance.now()});sound('damage');}
  }return;
 }
 if(message.type==='welcome'){
  clearConnectionTimer();recoveryUntil=0;saveSession({code:message.room.code,playerId:message.playerId,token:message.token});seq=0;attempts=0;
  set({playerId:message.playerId,status:'connected',error:'',menu:true});
 }
 if(message.type==='state'||message.type==='welcome'){
  const room=message.room;
  if(state.room?.matchId!==room.matchId||state.room?.code!==room.code){frames.length=0;lastEvent=0;seq=0;set({menu:true,hitAt:-Infinity,hurtAt:-Infinity,killAt:-Infinity});}
  frames.push({at:performance.now(),room});if(frames.length>20)frames.shift();
  set({room,...(room.phase!=='playing'?{menu:true}:{})});
 }
}
function open(command?:ClientCommand){
 if(retry)clearTimeout(retry);clearConnectionTimer();
 if(session&&recoveryUntil&&performance.now()>=recoveryUntil){endSession('Reconnect window expired. Create or join a room again.');return;}
 const own=++generation;let handledClose=false;
 socket?.close();set({status:session?'reconnecting':'connecting',error:''});
 let ws:WebSocket;
 try{
  const url=websocketUrl(import.meta.env?.VITE_WS_URL,location,import.meta.env?.PROD??false);
  ws=new WebSocket(url);socket=ws;
 }catch(error){set({status:'offline',menu:true,error:error instanceof Error?error.message:'Cannot open multiplayer connection.'});return;}
 connectionTimer=setTimeout(()=>{if(own!==generation)return;set({error:'Multiplayer connection timed out. Retry or play single-player.'});closed(1006);ws.close();},Math.min(5000,recoveryUntil?Math.max(1,recoveryUntil-performance.now()):5000));
 ws.onopen=()=>{if(own!==generation||handledClose)return;if(!session&&!command)clearConnectionTimer();set({status:session&&!command?'reconnecting':'connected'});
  if(command)ws.send(JSON.stringify(command));else if(session)ws.send(JSON.stringify({v:1,type:'resume',...session}));
 };
 ws.onmessage=e=>{if(own!==generation||handledClose)return;try{receive(JSON.parse(String(e.data)) as ServerMessage);}catch{set({error:'Unreadable server message.'});}};
 ws.onerror=()=>{if(own===generation&&!handledClose)set({error:'Cannot reach multiplayer server. Single-player is still available.'});};
 const closed=(code:number)=>{if(own!==generation||handledClose)return;handledClose=true;clearConnectionTimer();set({status:'offline',menu:true});
  if(code===1008){saveSession();frames.length=0;set({room:null,playerId:'',error:'Multiplayer connection rejected by server policy. Create or join a room again.'});return;}
  if(code===4001){endSession('Session opened in another connection. Create or join a room again.');return;}
  if(session){
   recoveryUntil||=performance.now()+20000;
   if(attempts++<8&&performance.now()<recoveryUntil){set({status:'reconnecting',error:'Connection lost · attempting to restore your session…'});retry=setTimeout(()=>open(),Math.min(2000,250*attempts,Math.max(1,recoveryUntil-performance.now())));}
   else endSession('Unable to restore the session within the reconnect window. Create or join a room again when the server is available.');
  }else if(!state.error)set({error:'Connection closed. Create or join a room again. Single-player is available.'});
 };
 ws.onclose=e=>closed(e.code);
}
export const network={
 get:()=>state,set,
 onShot:(fn:(event:ShotEvent)=>void)=>{shotListeners.add(fn);return()=>{shotListeners.delete(fn);};},
 subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
 send:(command:ClientCommand)=>{if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(command));else set({error:'Not connected. Try reconnecting.'});},
 connect:(type:'create'|'join',name:string,code='')=>{
  saveSession();attempts=0;recoveryUntil=0;frames.length=0;set({room:null,playerId:''});open(type==='create'?{v:1,type,name}:{v:1,type,name,code:code.toUpperCase().trim()});
 },
 reconnect:()=>{if(!session){try{session=JSON.parse(sessionStorage.getItem('skyfall-session-v1')??'null') as Session|null??undefined;}catch{/* Invalid saved session. */}}if(state.status==='reconnecting'||state.status==='connecting')return;if(session&&!validateCommand({v:1,type:'resume',...session}))saveSession();if(!session){set({error:'No saved session in this tab. Create or join a room.'});return;}attempts=0;recoveryUntil=performance.now()+20000;open();},
 leave:()=>{
  network.send({v:1,type:'leave'});saveSession();++generation;clearConnectionTimer();recoveryUntil=0;if(retry)clearTimeout(retry);socket?.close();socket=undefined;frames.length=0;set({status:'offline',room:null,playerId:'',menu:true,error:''});
 },
 input:(input:Omit<Input,'seq'>)=>{if(state.room?.phase==='playing'&&state.status==='connected')network.send({v:1,type:'input',input:{...input,seq:++seq}});},
 sample:(id:string,local:boolean):PlayerSnapshot|undefined=>{
  const latest=frames.at(-1);if(!latest)return;
  const target=performance.now()-(local?35:100);
  let a=frames[0],b=latest;
  for(let i=1;i<frames.length;i++)if(frames[i].at>=target){a=frames[i-1];b=frames[i];break;}
  const x=a.room.players.find(p=>p.id===id),y=b.room.players.find(p=>p.id===id);
  if(!x||!y)return y;
  if(!x.alive||!y.alive)return y;
  const t=Math.max(0,Math.min(1,(target-a.at)/Math.max(1,b.at-a.at)));
  // Teleports such as fall recovery must snap instead of sliding across the arena.
  if(Math.hypot(x.position.x-y.position.x,x.position.y-y.position.y,x.position.z-y.position.z)>6)return y;
  const yaw=x.yaw+Math.atan2(Math.sin(y.yaw-x.yaw),Math.cos(y.yaw-x.yaw))*t;
  return {...y,yaw,position:{x:x.position.x+(y.position.x-x.position.x)*t,y:x.position.y+(y.position.y-x.position.y)*t,z:x.position.z+(y.position.z-x.position.z)*t}};
 },
};
export function useNetwork(){return useSyncExternalStore(network.subscribe,network.get);}
