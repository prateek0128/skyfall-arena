/** Harness-only aim planning. This mirror can choose inputs, never change server state. */
const normalize=v=>{const n=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/n,y:v.y/n,z:v.z/n};};
const add=(a,d,n)=>({x:a.x+d.x*n,y:a.y+d.y*n,z:a.z+d.z*n});
export function targetAim(shooter,target){
 const dx=target.position.x-shooter.position.x,dz=target.position.z-shooter.position.z,r=Math.hypot(dx,dz);
 const y=target.position.y+.35;
 let low=-.9,high=.85;
 for(let i=0;i<35;i++){const mid=(low+high)/2;const viewY=shooter.position.y+1.2+35/41+r*Math.tan(mid)-r/(41*Math.cos(mid));if(viewY<y)low=mid;else high=mid;}
 return {yaw:Math.atan2(-dx,-dz),pitch:(low+high)/2};
}
export class AimMirror{
 constructor(R,arena){
  this.R=R;this.world=new R.World({x:0,y:0,z:0});this.guard=new R.World({x:0,y:0,z:0});this.players=new Map();this.staticHandles=new Set();this.tick=-1;
  for(const world of [this.world,this.guard]){
   for(const [x,y,z,w,d] of arena.platforms){const c=world.createCollider(R.ColliderDesc.cuboid(w/2,.7,d/2).setTranslation(x,y-.7,z));if(world===this.world)this.staticHandles.add(c.handle);}
   for(const [x,y,z,w,h,d] of arena.obstacles){const c=world.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z));if(world===this.world)this.staticHandles.add(c.handle);}
  }
 }
 update(room){
  if(this.tick===room.tick)return;this.tick=room.tick;
  for(const p of room.players){
   let pair=this.players.get(p.id);if(!pair){pair={actual:this.world.createCollider(this.R.ColliderDesc.capsule(.45,.38)),guard:this.guard.createCollider(this.R.ColliderDesc.capsule(1,.95))};this.players.set(p.id,pair);}
   for(const c of [pair.actual,pair.guard]){c.setTranslation(p.position);c.setEnabled(p.alive);}
  }
  this.world.step();this.guard.step();
 }
 trace(p,aim){
  const R=this.R,self=this.players.get(p.id);if(!self)return;
  const direction={x:-Math.sin(aim.yaw)*Math.cos(aim.pitch),y:Math.sin(aim.pitch),z:-Math.cos(aim.yaw)*Math.cos(aim.pitch)};
  const pivot={x:p.position.x,y:p.position.y+1.2,z:p.position.z};let camera=add(pivot,direction,-6);camera.y++;
  const offset={x:camera.x-pivot.x,y:camera.y-pivot.y,z:camera.z-pivot.z},back=normalize(offset);
  const cover=this.world.castRay(new R.Ray(pivot,back),Math.hypot(offset.x,offset.y,offset.z),true,undefined,undefined,self.actual,undefined,c=>this.staticHandles.has(c.handle));
  if(cover)camera=add(pivot,back,Math.max(.5,cover.timeOfImpact-.3));
  const look=add(pivot,direction,35),view=normalize({x:look.x-camera.x,y:look.y-camera.y,z:look.z-camera.z});
  const aimHit=this.world.castRay(new R.Ray(camera,view),100,true,undefined,undefined,self.actual);
  const aimPoint=add(camera,view,aimHit?.timeOfImpact??100),from={x:p.position.x,y:p.position.y+.55,z:p.position.z};
  const weapon=normalize({x:aimPoint.x-from.x,y:aimPoint.y-from.y,z:aimPoint.z-from.z});
  const hit=this.world.castRay(new R.Ray(from,weapon),100,true,undefined,undefined,self.actual);
  const id=hit?[...this.players].find(([,pair])=>pair.actual.handle===hit.collider.handle)?.[0]:undefined;
  return {camera,view,aimDistance:aimHit?.timeOfImpact??100,from,direction:weapon,distance:hit?.timeOfImpact??100,hitId:id??null,impact:!!hit&&!id};
 }
 safe(p,aim,allowedTarget=null){
  const shot=this.trace(p,aim);if(!shot||shot.hitId&&shot.hitId!==allowedTarget)return false;
  const self=this.players.get(p.id);
  // Enlarged capsules guard against snapshot age and motion; cover still occludes.
  const cameraGuard=this.guard.castRay(new this.R.Ray(shot.camera,shot.view),shot.aimDistance+.01,true,undefined,undefined,self.guard,undefined,c=>!allowedTarget||c.handle!==this.players.get(allowedTarget)?.guard.handle);
  if(cameraGuard&&[...this.players.values()].some(pair=>pair.guard.handle===cameraGuard.collider.handle))return false;
  const guard=this.guard.castRay(new this.R.Ray(shot.from,shot.direction),shot.distance+.01,true,undefined,undefined,self.guard,undefined,c=>!allowedTarget||c.handle!==this.players.get(allowedTarget)?.guard.handle);
  return !guard||![...this.players.values()].some(pair=>pair.guard.handle===guard.collider.handle);
 }
 safeAim(p,preferred){
  const candidates=[preferred,...Array.from({length:12},(_,i)=>({yaw:-Math.PI+i*Math.PI/6,pitch:-.85})),...Array.from({length:12},(_,i)=>({yaw:-Math.PI+i*Math.PI/6,pitch:.85}))].filter(Boolean);
  return candidates.find(aim=>this.safe(p,aim))??null;
 }
 dispose(){this.world.free();this.guard.free();}
}
/** One attacker per victim. Short bursts seek two hits; ordinary snapshots stop
 * targeting at half hull. This is bot strategy, not a server-side damage limit.
 * A stale prediction can still cause collateral damage and fail the run.
 */
export class CombatDriver{
 constructor(){this.nextAttempt=0;this.burstUntil=0;this.burstAim=null;this.burstTarget=null;this.lastSafe=null;this.attempts=0;this.unsafeFrames=0;}
 choose(room,p,index,mirror,now,allowHits){
  const target=room.players[room.players.length%2===0?(index^1):(index+1)%room.players.length];
  if(this.burstAim&&now<this.burstUntil&&target?.id===this.burstTarget&&target.health>=75&&mirror.safe(p,this.burstAim,target.id))return {...this.burstAim,fire:true,intent:'skirmish'};
  this.burstAim=null;
  if(allowHits&&target?.alive&&target.health>=75&&p.hits<2&&now>=this.nextAttempt){
   const center=targetAim(p,target);
   const aim=[0,-.06,.06,-.12,.12,-.2,.2,-.35,.35].flatMap(offset=>[0,-.035,.035].map(yawOffset=>({yaw:Math.atan2(Math.sin(center.yaw+yawOffset),Math.cos(center.yaw+yawOffset)),pitch:Math.max(-.9,Math.min(.85,center.pitch+offset))}))).find(candidate=>mirror.trace(p,candidate)?.hitId===target.id&&mirror.safe(p,candidate,target.id));
   this.nextAttempt=now+.73;
   if(aim){this.burstAim=aim;this.burstTarget=target.id;this.burstUntil=now+.3;this.attempts++;return {...aim,fire:true,intent:'skirmish'};}
  }
  const aim=mirror.safeAim(p,this.lastSafe);if(aim){this.lastSafe=aim;return {...aim,fire:true,intent:'cover'};}
  this.unsafeFrames++;return {yaw:0,pitch:.85,fire:false,intent:'unsafe'};
 }
}
export function activityChecks(p,fire,seconds){
 return p.alive&&p.minimumAlive===p.expectedPlayers&&p.ackAdvance>0&&(!fire||p.shotsAdvance>=Math.floor(seconds*4))&&p.maxDistance>.5&&p.nonPlayingSnapshots===0&&(!fire||p.maxShotGapMs<=500)&&p.windows.length===Math.floor(seconds)&&Array.from(p.windows).every(w=>w&&w.acks>=15&&(!fire||w.shots>=4)&&w.distance>.03);
}
