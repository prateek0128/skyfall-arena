import { useEffect, useRef } from 'react';
import { game } from './store';
type ControlOptions={active:()=>boolean;pause:()=>void;subscribe:(fn:()=>void)=>()=>void};
export function useControls(options?:ControlOptions) {
 const input=useRef({keys:new Set<string>(),yaw:0,pitch:0.04,fire:false});
 useEffect(()=>{
  let dragging=false;
  const active=options?.active??(()=>game.get().phase==='playing');
  const pause=options?.pause??(()=>game.act({type:'pause'}));
  const down=(e:KeyboardEvent)=>{if(e.code==='Escape'&&active()){pause();input.current.keys.clear();input.current.fire=false;document.exitPointerLock();return;}if(active()&&['Space','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();if(active())input.current.keys.add(e.code);};
  const up=(e:KeyboardEvent)=>input.current.keys.delete(e.code);
  const move=(e:MouseEvent)=>{if((document.pointerLockElement||dragging)&&active()){input.current.yaw-=e.movementX*0.002;input.current.pitch=Math.max(-0.9,Math.min(0.85,input.current.pitch-e.movementY*0.002));}};
  const lock=()=>{if(!document.pointerLockElement){input.current.keys.clear();input.current.fire=false;if(active())pause();}};
  const blur=()=>{input.current.keys.clear();input.current.fire=false;if(active()){pause();document.exitPointerLock();}};
  const mouseDown=(e:MouseEvent)=>{if(e.target instanceof HTMLElement&&e.target.closest('button,a'))return;if(active()){if(e.button===2)dragging=true;if(e.button===0)input.current.fire=true;}};
  const mouseUp=()=>{input.current.fire=false;dragging=false;};
  const context=(e:MouseEvent)=>{if(active())e.preventDefault();};
  window.addEventListener('contextmenu',context);
  const unsubscribe=(options?.subscribe??game.subscribe)(()=>{if(!active()){input.current.keys.clear();input.current.fire=false;dragging=false;}});
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('mousemove',move);window.addEventListener('mousedown',mouseDown);window.addEventListener('mouseup',mouseUp);window.addEventListener('blur',blur);document.addEventListener('pointerlockchange',lock);
  return()=>{unsubscribe();window.removeEventListener('contextmenu',context);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('mousemove',move);window.removeEventListener('mousedown',mouseDown);window.removeEventListener('mouseup',mouseUp);window.removeEventListener('blur',blur);document.removeEventListener('pointerlockchange',lock);};
 },[options]);
 return input;
}
