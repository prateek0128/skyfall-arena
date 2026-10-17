/** Every command is an intent. Positions, damage, timestamps and scores are never accepted. */
export const PROTOCOL_VERSION = 1 as const;
export const TICK_RATE = 30;
export const SNAPSHOT_RATE = 15;
export const MAX_PLAYERS = 8;
export type Vec3 = {x:number;y:number;z:number};
export type Input = {seq:number;x:number;z:number;yaw:number;pitch:number;thrust:boolean;boost:boolean;fire:boolean};
export const idleInput = ():Input=>({seq:0,x:0,z:0,yaw:0,pitch:0,thrust:false,boost:false,fire:false});
export type ClientCommand = {v:1} & (
 | {type:'create';name:string} | {type:'join';name:string;code:string}
 | {type:'resume';code:string;playerId:string;token:string}
 | {type:'ready';ready:boolean} | {type:'start'|'leave'|'lobby'}
 | {type:'input';input:Input});
export type PlayerSnapshot={id:string;name:string;connected:boolean;ready:boolean;position:Vec3;velocity:Vec3;yaw:number;pitch:number;fuel:number;health:number;score:number;hits:number;shots:number;eliminations:number;alive:boolean;thrust:boolean;boost:boolean;ack:number};
export type RoomSnapshot={code:string;hostId:string;phase:'lobby'|'countdown'|'playing'|'results';tick:number;matchId:number;remaining:number;players:PlayerSnapshot[];winners:string[];reason:string};
export type ShotEvent={id:number;shooter:string;from:Vec3;to:Vec3;hit:string|null;eliminated:boolean};
export type ServerMessage={v:1} & (
 | {type:'welcome';playerId:string;token:string;room:RoomSnapshot}
 | {type:'state';room:RoomSnapshot}
 | {type:'shots';matchId:number;events:ShotEvent[]}
 | {type:'error';message:string;fatal?:boolean}
 | {type:'left'});
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
const exact=(x:Record<string,unknown>,keys:string[])=>Object.keys(x).length===keys.length&&keys.every(k=>k in x);
const number=(x:unknown,min:number,max:number)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const name=(x:unknown)=>typeof x==='string'&&x.length>=1&&x.length<=18&&x===x.trim()&&/^[\p{L}\p{N} _-]+$/u.test(x);
const code=(x:unknown)=>typeof x==='string'&&/^[A-HJ-NP-Z2-9]{6}$/.test(x);
export function validateCommand(x:unknown):x is ClientCommand{
 if(!object(x)||x.v!==PROTOCOL_VERSION)return false;
 switch(x.type){
  case 'create':return exact(x,['v','type','name'])&&name(x.name);
  case 'join':return exact(x,['v','type','name','code'])&&name(x.name)&&code(x.code);
  case 'resume':return exact(x,['v','type','code','playerId','token'])&&code(x.code)&&typeof x.playerId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x.playerId)&&typeof x.token==='string'&&/^[a-f0-9]{64}$/.test(x.token);
  case 'ready':return exact(x,['v','type','ready'])&&typeof x.ready==='boolean';
  case 'start':case 'leave':case 'lobby':return exact(x,['v','type']);
  case 'input':{
   const i=x.input;
   return exact(x,['v','type','input'])&&object(i)&&exact(i,['seq','x','z','yaw','pitch','thrust','boost','fire'])
    &&number(i.seq,0,Number.MAX_SAFE_INTEGER)&&Number.isInteger(i.seq)
    &&[-1,0,1].includes(i.x as number)&&[-1,0,1].includes(i.z as number)
    &&number(i.yaw,-Math.PI,Math.PI)&&number(i.pitch,-.9,.85)
    &&typeof i.thrust==='boolean'&&typeof i.boost==='boolean'&&typeof i.fire==='boolean';
  }
  default:return false;
 }
}
