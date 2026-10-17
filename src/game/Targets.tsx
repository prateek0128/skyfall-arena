import { simulationDelta } from './physics';
import { useEffect,useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BallCollider,RigidBody,type RapierRigidBody,useRapier } from '@react-three/rapier';
import { Group,Mesh,MeshStandardMaterial,Vector3 } from 'three';
import { game } from './store';
import { combat,pilotPosition } from './events';
import { sound } from './audio';
const locations:[number,number,number][]=[[0,3,-9],[-19,6,-13],[18,8,-17],[0,11,-30],[-17,13,-33],[21,15,-34],[0,19,-51]];
function Target({position,id,wave}:{position:[number,number,number];id:number;wave:number}){
 const body=useRef<RapierRigidBody>(null),mesh=useRef<Group>(null),warning=useRef<Mesh>(null),material=useRef<MeshStandardMaterial>(null);
 const hp=useRef(2+wave),dead=useRef(false),time=useRef(0),flash=useRef(0),charge=useRef(0),cooldown=useRef(3+id*.45);
 const locked=useRef(new Vector3()),at=useRef(new Vector3(...position));
 const {world,rapier}=useRapier();
 useEffect(()=>combat.subscribe(e=>{
  if(e.type!=='target'||e.id!==id||e.wave!==wave||dead.current||game.get().phase!=='playing')return;
  hp.current--;flash.current=.16;
  game.act({type:'hit'});game.set({hit:game.get().elapsed});
  combat.emit({type:'impact',at:at.current});sound('hit');
  if(hp.current<=0){dead.current=true;body.current?.setEnabled(false);if(mesh.current)mesh.current.visible=false;if(warning.current)warning.current.visible=false;
   combat.emit({type:'destroy',at:at.current});sound('destroy');game.act({type:'kill',id,wave});
   if(game.get().wave===wave&&game.get().phase==='playing')game.notify(`DRONE DISABLED · ${game.get().combo}× COMBO`,2);
  }
 }),[id,wave]);
 useFrame((_,rawDt)=>{
  if(game.get().phase!=='playing'||dead.current||!body.current)return;
  const dt=simulationDelta(rawDt);time.current+=dt;flash.current=Math.max(0,flash.current-dt);
  const t=time.current*(.55+wave*.23)+id*1.7;
  // Sentry bob, lateral strafe, and elliptical orbit; all bounded near platforms.
  const radius=1+wave*.35;
  at.current.set(position[0]+(id%3===0?Math.sin(t)*.5:Math.sin(t)*radius),position[1]+Math.sin(t*(id%3===1?1.8:1))*.6,position[2]+(id%3===2?Math.cos(t)*radius*.7:0));
  body.current.setNextKinematicTranslation(at.current);
  if(mesh.current){mesh.current.rotation.y+=dt;mesh.current.scale.setScalar(1+flash.current*.7);}
  if(material.current){material.current.color.set(flash.current>0?'#ffffff':id%3===0?'#d6754d':id%3===1?'#bf965b':'#a36caa');material.current.emissiveIntensity=charge.current>0?1.5:.35;}
  if(charge.current>0){
   charge.current-=dt;
   if(warning.current){warning.current.visible=true;warning.current.position.copy(locked.current).sub(at.current);warning.current.scale.setScalar(.7+charge.current);}
   if(charge.current<=0){
    const direction=locked.current.clone().sub(at.current).normalize();
    const ray=new rapier.Ray(at.current,direction);const hit=world.castRay(ray,40,true,undefined,undefined,undefined,body.current);
    const endpoint=at.current.clone().addScaledVector(direction,hit?.timeOfImpact??40);
    combat.emit({type:'beam',from:at.current,to:endpoint,enemy:true});
    if((hit?.collider.parent()?.userData as {pilot?:boolean}|undefined)?.pilot){game.act({type:'damage',amount:6+wave*2});game.set({hurt:game.get().elapsed});sound('damage');}
    cooldown.current=5-wave*.65+id*.12;if(warning.current)warning.current.visible=false;
   }
  }else{
   cooldown.current-=dt;
   if(cooldown.current<=0&&pilotPosition.distanceTo(at.current)<34){locked.current.copy(pilotPosition);charge.current=1.1-wave*.1;}
  }
 });
 return <RigidBody ref={body} type="kinematicPosition" position={position} colliders={false} userData={{target:id,wave}}><BallCollider args={[.86]}/><group ref={mesh}><mesh><icosahedronGeometry args={[.75,1]}/><meshStandardMaterial ref={material} color="#d6754d" emissive="#e87945" emissiveIntensity={.35} metalness={.65} roughness={.3}/></mesh><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[1,.06,6,24]}/><meshBasicMaterial color="#ffc080"/></mesh><mesh position={[0,0,.68]}><sphereGeometry args={[.19,12,8]}/><meshBasicMaterial color="#fff1b8"/></mesh></group><mesh ref={warning} visible={false}><torusGeometry args={[.6,.045,6,24]}/><meshBasicMaterial color="#ff6655" depthTest={false} transparent opacity={.8}/></mesh></RigidBody>;
}
export function Targets({wave}:{wave:number}){return <>{locations.map((p,i)=><Target key={`${wave}-${i}`} position={p} id={i} wave={wave}/>)}</>;}
