import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, type RapierRigidBody, useRapier } from '@react-three/rapier';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { useControls, movementInput } from './controls';
import { fuelStep, movement } from './logic';
import { game } from './store';
import { nextVelocity, simulationDelta } from './physics';
import { updateCamera } from './Camera';
import { combat, pilotPosition } from './events';
import { sound } from './audio';
export function Player(){
 const body=useRef<RapierRigidBody>(null),visual=useRef<Group>(null),flame=useRef<Group>(null);
 const controls=useControls();const {camera,scene}=useThree();const {world,rapier}=useRapier();
 const fuel=useRef(100),exhausted=useRef(false),clock=useRef(0),lastShot=useRef(-1),report=useRef(0);
 useFrame((_,rawDt)=>{
  if(!body.current)return;const dt=simulationDelta(rawDt),state=game.get(),input=controls.current;
  if(state.phase!=='playing')return;
  clock.current+=dt;
  const pos=body.current.translation();
  pilotPosition.set(pos.x,pos.y,pos.z);
  if(pos.y < -22){
   game.act({type:'damage',amount:25});game.notify(game.get().health?'RECOVERY COMPLETE · −25 HULL':'HULL INTEGRITY LOST');
   body.current.setTranslation({x:0,y:3,z:2},true);body.current.setLinvel({x:0,y:0,z:0},true);
   fuel.current=100;exhausted.current=false;game.set({fuel:100,hurt:state.elapsed});sound('damage');return;
  }
  const k=input.keys;const boost=k.has('ShiftLeft')||k.has('ShiftRight');
  if(exhausted.current&&fuel.current>18)exhausted.current=false;
  const flying=k.has('Space')&&!exhausted.current&&fuel.current>0;
  fuel.current=fuelStep(fuel.current,flying,boost,dt);if(fuel.current===0)exhausted.current=true;
  const axes=movementInput(k);
  const motion=movement(axes.x,axes.z,input.yaw,boost&&flying?15:8);
  const velocity=body.current.linvel();
  body.current.setLinvel(nextVelocity(velocity,motion,flying,boost,dt),true);
  if(visual.current)visual.current.rotation.y=input.yaw;
  if(flame.current){flame.current.visible=flying;flame.current.scale.y=(boost?1.8:1)*(1+Math.sin(clock.current*65)*.15);}
  updateCamera(camera as PerspectiveCamera,new Vector3(pos.x,pos.y,pos.z),input.yaw,input.pitch,dt,scene.children);
  if(input.fire&&clock.current-lastShot.current>.2){
   lastShot.current=clock.current;game.act({type:'shot'});game.set({shot:state.elapsed});sound('shot');
   const direction=new Vector3();camera.getWorldDirection(direction);
   // Camera picks the crosshair aim point. A second ray from the weapon prevents
   // shooting through cover that sits between the avatar and that point.
   const aimRay=new rapier.Ray(camera.position,direction);
   const aimHit=world.castRay(aimRay,100,true,undefined,undefined,undefined,body.current);
   const aimPoint=camera.position.clone().addScaledVector(direction,aimHit?.timeOfImpact??100);
   const muzzle=new Vector3(pos.x,pos.y+.15,pos.z).add(new Vector3(.42,0,-.66).applyAxisAngle(new Vector3(0,1,0),input.yaw));
   const weaponDirection=aimPoint.clone().sub(muzzle).normalize();
   const hit=world.castRay(new rapier.Ray(muzzle,weaponDirection),100,true,undefined,undefined,undefined,body.current);
   const endpoint=muzzle.clone().addScaledVector(weaponDirection,hit?.timeOfImpact??100);
   combat.emit({type:'beam',from:muzzle,to:endpoint});
   if(hit){combat.emit({type:'impact',at:endpoint});const data=hit.collider.parent()?.userData as {target?:number;wave:number}|undefined;
    if(data?.target!==undefined)combat.emit({type:'target',id:data.target,wave:data.wave});
   }
  }
  report.current+=dt;if(report.current>.08){report.current=0;game.set({fuel:fuel.current,altitude:Math.max(0,pos.y-1),speed:Math.hypot(velocity.x,velocity.y,velocity.z)});}
 });
 return <RigidBody ref={body} position={[0,2,3]} colliders={false} enabledRotations={[false,false,false]} linearDamping={.1} friction={.2} name="pilot" userData={{pilot:true}}><CapsuleCollider args={[.45,.38]}/><group ref={visual}><mesh castShadow><capsuleGeometry args={[.32,.65,5,10]}/><meshStandardMaterial color="#e4ebe7" metalness={.45} roughness={.4}/></mesh><mesh position={[0,.65,0]} castShadow><sphereGeometry args={[.3,16,12]}/><meshStandardMaterial color="#243d50" metalness={.8} roughness={.2}/></mesh><mesh position={[0,.68,-.23]}><boxGeometry args={[.4,.11,.12]}/><meshBasicMaterial color="#70fff1"/></mesh>{[-1,1].map(s=><group key={s} position={[s*.24,0,.3]}><mesh castShadow><cylinderGeometry args={[.14,.16,.65,10]}/><meshStandardMaterial color="#273d4c" metalness={.8} roughness={.3}/></mesh></group>)}<group ref={flame} visible={false}>{[-1,1].map(s=><mesh key={s} position={[s*.24,-.65,.3]} rotation={[Math.PI,0,0]}><coneGeometry args={[.13,.8,8]}/><meshBasicMaterial color="#67fff1" transparent opacity={.8}/></mesh>)}</group><mesh position={[.42,.05,-.36]}><boxGeometry args={[.14,.18,.6]}/><meshStandardMaterial color="#172d40"/></mesh></group></RigidBody>;
}
