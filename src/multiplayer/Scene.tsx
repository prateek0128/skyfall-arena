import { useEffect,useRef } from 'react';
import { useFrame,useThree } from '@react-three/fiber';
import { Group,MeshStandardMaterial,PerspectiveCamera,Vector3 } from 'three';
import { network,useNetwork } from './network';
import { useControls, movementInput } from '../game/controls';
import { updateCamera } from '../game/Camera';
import { combat } from '../game/events';
const options={active:()=>network.get().room?.phase==='playing'&&!network.get().menu&&network.get().status==='connected',pause:()=>network.set({menu:true}),subscribe:network.subscribe};
const normalize=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
function Avatar({id,index}:{id:string;index:number}){
 const group=useRef<Group>(null),flame=useRef<Group>(null),material=useRef<MeshStandardMaterial>(null),hitAt=useRef(-Infinity);
 useEffect(()=>network.onShot(e=>{if(e.hit===id)hitAt.current=performance.now();}),[id]);
 useFrame(()=>{
  const p=network.sample(id,id===network.get().playerId);if(!p||!group.current)return;
  group.current.visible=p.alive;group.current.position.set(p.position.x,p.position.y,p.position.z);group.current.rotation.y=p.yaw;
  if(material.current)material.current.emissiveIntensity=performance.now()-hitAt.current<140?1.8:0;
  if(flame.current){flame.current.visible=p.thrust;flame.current.scale.y=p.boost?1.8:1;}
 });
 return <group ref={group}><mesh castShadow><capsuleGeometry args={[.32,.65,5,10]}/><meshStandardMaterial ref={material} emissive="#b6fff0" emissiveIntensity={0} color={id===network.get().playerId?'#dcece8':['#f2ac73','#acb7ff','#eaa5d4','#d5dd89'][index%4]} metalness={.45} roughness={.4}/></mesh><mesh position={[0,.65,0]}><sphereGeometry args={[.3,16,12]}/><meshStandardMaterial color="#243d50" metalness={.8} roughness={.2}/></mesh><mesh position={[0,.68,-.23]}><boxGeometry args={[.4,.11,.12]}/><meshBasicMaterial color="#70fff1"/></mesh><mesh position={[.42,.05,-.36]}><boxGeometry args={[.14,.18,.6]}/><meshStandardMaterial color="#172d40"/></mesh><group ref={flame}>{[-1,1].map(s=><group key={s} position={[s*.24,0,.3]}><mesh><cylinderGeometry args={[.14,.16,.65,10]}/><meshStandardMaterial color="#273d4c"/></mesh><mesh position={[0,-.65,0]} rotation={[Math.PI,0,0]}><coneGeometry args={[.13,.8,8]}/><meshBasicMaterial color="#67fff1"/></mesh></group>)}</group></group>;
}
export function MultiplayerScene(){
 const net=useNetwork(),controls=useControls(options),sent=useRef(0),match=useRef(-1);
 const {camera,scene}=useThree();
 useEffect(()=>network.onShot(e=>{
  const at=new Vector3(e.to.x,e.to.y,e.to.z);
  combat.emit({type:'beam',from:new Vector3(e.from.x,e.from.y,e.from.z),to:at,enemy:e.shooter!==network.get().playerId});
  if(e.hit)combat.emit({type:'impact',at});
  if(e.eliminated)combat.emit({type:'destroy',at});
 }),[]);
 useEffect(()=>{network.set({loaded:true});return()=>network.set({loaded:false});},[]);
 useEffect(()=>network.subscribe(()=>{const s=network.get();if(s.menu&&document.pointerLockElement)document.exitPointerLock();}),[]);
 useFrame((_,dt)=>{
  const state=network.get(),room=state.room,p=network.sample(state.playerId,true);if(!room||!p)return;
  if(match.current!==room.matchId){controls.current.yaw=p.yaw;controls.current.pitch=p.pitch;match.current=room.matchId;}
  const input=controls.current;
  if(room.phase==='playing'){
   const pos=new Vector3(p.position.x,p.position.y,p.position.z);
   updateCamera(camera as PerspectiveCamera,pos,input.yaw,input.pitch,Math.min(dt,.1),scene.children);
   sent.current+=dt;
   if(sent.current>=1/30){sent.current=0;const active=options.active()&&p.alive,k=input.keys,axes=movementInput(k);
    network.input({x:active?axes.x:0,z:active?axes.z:0,yaw:normalize(input.yaw),pitch:input.pitch,thrust:active&&k.has('Space'),boost:active&&(k.has('ShiftLeft')||k.has('ShiftRight')),fire:active&&input.fire});
   }
  }
 });
 return <>{net.room?.players.map((p,i)=><Avatar key={`${net.room!.matchId}-${p.id}`} id={p.id} index={i}/>)}</>;
}
