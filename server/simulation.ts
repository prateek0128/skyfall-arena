import RAPIER from '@dimforge/rapier3d-compat';
import { platforms,obstacles,spawn } from '../shared/arena.js';
import { fuelStep,movement,nextVelocity } from '../shared/flight.js';
import { idleInput,type Input,type PlayerSnapshot,type ShotEvent } from '../shared/protocol.js';
export const FIRE_INTERVAL=.2,SHOT_DAMAGE=25;
export const inBounds=(p:{x:number;y:number;z:number})=>Number.isFinite(p.x+p.y+p.z)&&Math.abs(p.x)<=90&&Math.abs(p.z)<=110&&p.y<=65&&p.y>=-22;
export function damage(health:number,amount:number){return Math.max(0,health-Math.max(0,amount));}
export const canFire=(now:number,last:number)=>now-last>=FIRE_INTERVAL-1e-8;
export class Pilot{
 body:RAPIER.RigidBody;
 input:Input=idleInput();lastInput=-Infinity;lastShot=-Infinity;exhausted=false;retired=false;disconnectedAt=0;
 state:PlayerSnapshot;
 constructor(world:RAPIER.World,id:string,name:string,index:number){
  const position=spawn(index);
  this.body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x,position.y,position.z).lockRotations().setLinearDamping(.1));
  world.createCollider(RAPIER.ColliderDesc.capsule(.45,.38).setFriction(.2),this.body);
  this.state={id,name,connected:true,ready:false,position,velocity:{x:0,y:0,z:0},yaw:position.x<0?-Math.PI/2:Math.PI/2,pitch:-.12,fuel:100,health:100,score:0,hits:0,shots:0,eliminations:0,alive:true,thrust:false,boost:false,ack:-1};
 }
}
export class Simulation{
 world=new RAPIER.World({x:0,y:-20,z:0});pilots=new Map<string,Pilot>();time=0;shotId=0;
 constructor(){
  for(const [x,y,z,w,d] of platforms)this.world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,.7,d/2).setTranslation(x,y-.7,z));
  for(const [x,y,z,w,h,d] of obstacles)this.world.createCollider(RAPIER.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z));
 }
 add(id:string,name:string,index:number){const p=new Pilot(this.world,id,name,index);this.pilots.set(id,p);return p;}
 reset(){let index=0;for(const p of this.pilots.values()){
  const connected=p.state.connected,ready=p.state.ready,id=p.state.id,name=p.state.name;
  this.world.removeRigidBody(p.body);const fresh=new Pilot(this.world,id,name,index++);
  p.body=fresh.body;p.state={...fresh.state,connected,ready};p.input=idleInput();p.lastInput=-Infinity;p.lastShot=-Infinity;p.exhausted=false;
 }this.time=0;this.shotId=0;}
 remove(id:string){const p=this.pilots.get(id);if(p){this.world.removeRigidBody(p.body);this.pilots.delete(id);}}
 eliminate(p:Pilot,attacker?:Pilot){
  if(!p.state.alive)return;
  p.state.health=0;p.state.alive=false;p.state.thrust=false;p.state.boost=false;p.body.setEnabled(false);
  if(attacker&&attacker!==p){attacker.state.eliminations++;attacker.state.score+=100;}
 }
 step(dt:number):ShotEvent[]{
  this.time+=dt;this.world.timestep=dt;
  for(const p of this.pilots.values()){
   if(!p.state.alive)continue;
   const i=p.state.connected&&this.time-p.lastInput<.25?p.input:{...idleInput(),yaw:p.state.yaw,pitch:p.state.pitch};
   p.state.yaw=i.yaw;p.state.pitch=i.pitch;
   if(p.exhausted&&p.state.fuel>18)p.exhausted=false;
   const thrust=i.thrust&&!p.exhausted&&p.state.fuel>0;
   p.state.thrust=thrust;p.state.boost=thrust&&i.boost;
   p.state.fuel=fuelStep(p.state.fuel,thrust,i.boost,dt);if(p.state.fuel===0)p.exhausted=true;
   const desired=movement(i.x,i.z,i.yaw,p.state.boost?15:8);
   p.body.setLinvel(nextVelocity(p.body.linvel(),desired,thrust,i.boost,dt),true);
  }
  this.world.step();
  for(const p of this.pilots.values()){
   if(!p.state.alive)continue;
   let pos=p.body.translation();
   if(!inBounds(pos)){
    p.state.health=damage(p.state.health,25);
    if(p.state.health===0){this.eliminate(p);continue;}
    const start=spawn([...this.pilots.keys()].indexOf(p.state.id));
    p.body.setTranslation(start,true);p.body.setLinvel({x:0,y:0,z:0},true);p.state.fuel=100;p.exhausted=false;pos=start;
   }
   p.state.position={...pos};p.state.velocity={...p.body.linvel()};
  }
  const events:ShotEvent[]=[];
  // Stable iteration makes simultaneous tick trades deterministic.
  for(const p of this.pilots.values()){
   if(!p.state.alive||!p.state.connected||this.time-p.lastInput>=.25||!p.input.fire||!canFire(this.time,p.lastShot))continue;
   p.lastShot=this.time;p.state.shots++;
   const {yaw,pitch,position}=p.state;
   const aim={x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};
   const pivot={x:position.x,y:position.y+1.2,z:position.z};
   const camera={x:pivot.x-aim.x*6,y:pivot.y-aim.y*6+1,z:pivot.z-aim.z*6};
   const normalize=(v:{x:number;y:number;z:number})=>{const length=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/length,y:v.y/length,z:v.z/length};};
   const offset={x:camera.x-pivot.x,y:camera.y-pivot.y,z:camera.z-pivot.z},back=normalize(offset);
   const cover=this.world.castRay(new RAPIER.Ray(pivot,back),Math.hypot(offset.x,offset.y,offset.z),true,undefined,undefined,undefined,p.body,(c:RAPIER.Collider)=>!c.parent());
   if(cover){const distance=Math.max(.5,cover.timeOfImpact-.3);camera.x=pivot.x+back.x*distance;camera.y=pivot.y+back.y*distance;camera.z=pivot.z+back.z*distance;}
   const view=normalize({x:pivot.x+aim.x*35-camera.x,y:pivot.y+aim.y*35-camera.y,z:pivot.z+aim.z*35-camera.z});
   const aimHit=this.world.castRay(new RAPIER.Ray(camera,view),100,true,undefined,undefined,undefined,p.body);
   const aimDistance=aimHit?.timeOfImpact??100;
   const aimPoint={x:camera.x+view.x*aimDistance,y:camera.y+view.y*aimDistance,z:camera.z+view.z*aimDistance};
   const from={x:position.x,y:position.y+.55,z:position.z};
   const dir=normalize({x:aimPoint.x-from.x,y:aimPoint.y-from.y,z:aimPoint.z-from.z});
   const hit=this.world.castRay(new RAPIER.Ray(from,dir),100,true,undefined,undefined,undefined,p.body);
   const distance=hit?.timeOfImpact??100;
   const to={x:from.x+dir.x*distance,y:from.y+dir.y*distance,z:from.z+dir.z*distance};
   const target=hit?[...this.pilots.values()].find(other=>other.body.handle===hit.collider.parent()?.handle&&other.state.alive):undefined;
   let eliminated=false;
   if(target){p.state.hits++;p.state.score+=10;target.state.health=damage(target.state.health,SHOT_DAMAGE);if(target.state.health===0){this.eliminate(target,p);eliminated=true;}}
   events.push({id:++this.shotId,shooter:p.state.id,from,to,hit:target?.state.id??null,eliminated});
  }
  return events;
 }
 dispose(){this.world.free();}
}
