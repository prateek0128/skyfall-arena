import { simulationDelta } from './physics';
import { useEffect,useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D, Vector3 } from 'three';
import { combat } from './events';
import { game } from './store';
type Particle={at:Vector3;velocity:Vector3;life:number;max:number;color:string;size:number};
const MAX_PARTICLES=220,MAX_BEAMS=28;
export function Effects({active}:{active?:boolean}={}){
 const particles=useRef<Particle[]>([]),beams=useRef<{from:Vector3;to:Vector3;life:number;enemy:boolean}[]>([]);
 const dots=useRef<InstancedMesh>(null),lines=useRef<InstancedMesh>(null);
 const dummy=useRef(new Object3D()),color=useRef(new Color());
 useEffect(()=>combat.subscribe(e=>{
  if(e.type==='beam'){beams.current.push({...e,from:e.from.clone(),to:e.to.clone(),life:.13,enemy:!!e.enemy});if(beams.current.length>MAX_BEAMS)beams.current.shift();}
  else if(e.type==='impact'||e.type==='destroy'){
   const count=e.type==='destroy'?36:9;
   for(let i=0;i<count;i++){const life=e.type==='destroy'?.8:.3;particles.current.push({at:e.at.clone(),velocity:new Vector3(Math.sin(i*12.9),Math.cos(i*5.3),Math.sin(i*7.1)).multiplyScalar(e.type==='destroy'?7:3),life,max:life,color:e.type==='destroy'?'#ffb05f':'#99ffe4',size:e.type==='destroy'?.13:.07});}
   particles.current=particles.current.slice(-MAX_PARTICLES);
  }
 }),[]);
 useFrame((_,rawDt)=>{
  const dt=(active??(game.get().phase==='playing'))?simulationDelta(rawDt):0;
  const object=dummy.current;
  let alive=0;for(const p of particles.current){p.life-=dt;if(p.life<=0)continue;p.at.addScaledVector(p.velocity,dt);p.velocity.y-=dt*6;particles.current[alive++]=p;}particles.current.length=alive;
  if(dots.current){dots.current.count=particles.current.length;particles.current.forEach((p,i)=>{object.position.copy(p.at);object.rotation.set(0,0,0);object.scale.setScalar(p.size*p.life/p.max);object.updateMatrix();dots.current!.setMatrixAt(i,object.matrix);dots.current!.setColorAt(i,color.current.set(p.color));});dots.current.instanceMatrix.needsUpdate=true;if(dots.current.instanceColor)dots.current.instanceColor.needsUpdate=true;}
  let visible=0;for(const b of beams.current){b.life-=dt;if(b.life>0)beams.current[visible++]=b;}beams.current.length=visible;
  if(lines.current){lines.current.count=beams.current.length;beams.current.forEach((b,i)=>{object.position.copy(b.from).lerp(b.to,.5);object.lookAt(b.to);object.scale.set(.035,.035,b.from.distanceTo(b.to));object.updateMatrix();lines.current!.setMatrixAt(i,object.matrix);lines.current!.setColorAt(i,color.current.set(b.enemy?'#ff785b':'#8ffff0'));});lines.current.instanceMatrix.needsUpdate=true;if(lines.current.instanceColor)lines.current.instanceColor.needsUpdate=true;}
 });
 return <><instancedMesh ref={dots} args={[undefined,undefined,MAX_PARTICLES]} frustumCulled={false}><icosahedronGeometry args={[1,0]}/><meshBasicMaterial toneMapped={false}/></instancedMesh><instancedMesh ref={lines} args={[undefined,undefined,MAX_BEAMS]} frustumCulled={false}><boxGeometry args={[1,1,1]}/><meshBasicMaterial toneMapped={false}/></instancedMesh></>;
}
