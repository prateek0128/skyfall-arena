import { simulationDelta } from './physics';
import { useEffect,useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { game } from './store';
import { sound } from './audio';
export function MatchController(){
 const pending=useRef(0);
 useEffect(()=>{game.set({loaded:true});const unsubscribe=game.subscribe(()=>{
  if(game.get().phase==='over'&&document.pointerLockElement)document.exitPointerLock();
 });return()=>{unsubscribe();game.set({loaded:false});};},[]);
 useFrame((_,dt)=>{
  if(game.get().phase!=='playing'){pending.current=0;return;}
  pending.current+=simulationDelta(dt);
  if(pending.current>=.05){game.act({type:'tick',dt:pending.current});pending.current=0;}
 });
 useEffect(()=>{let previous=game.get().wave;return game.subscribe(()=>{
  const wave=game.get().wave;
  const changed=wave>previous;previous=wave;
  if(changed){game.notify(`WAVE ${wave} · +15 HULL · DRONES REARMED`,3);sound('wave');}
 });},[]);
 return null;
}
