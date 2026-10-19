import { useEffect, useRef } from 'react';
import { game } from './store';
type ControlOptions={active:()=>boolean;pause:()=>void;subscribe:(fn:()=>void)=>()=>void};
type Input={keys:Set<string>;yaw:number;pitch:number;fire:boolean};
const gameplayKeys=new Set(['Space','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const uiSelector='button,a,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"],.overlay';
const isUI=(target:EventTarget|null)=>!!(target as Element|null)?.closest?.(uiSelector);
/** Equivalent keys are alternatives, never additional movement strength. */
export function movementInput(keys:ReadonlySet<string>){
 return {x:Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),
  z:Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'))};
}
/** Bind the same controller for solo and multiplayer; return a complete teardown. */
export function bindControls(input:Input,options:ControlOptions,win:Window=window,doc:Document=document){
 let dragging=false;
 const {active,pause}=options;
 const clear=()=>{input.keys.clear();input.fire=false;dragging=false;};
 const suspend=()=>{clear();if(active()){pause();doc.exitPointerLock();}};
 const down=(e:KeyboardEvent)=>{
  if(e.code==='Escape'&&active()){suspend();return;}
  if(!active()){clear();return;}
  if(isUI(e.target)||isUI(doc.activeElement)){suspend();return;}
  if(gameplayKeys.has(e.code))e.preventDefault();
  input.keys.add(e.code);
 };
 const up=(e:KeyboardEvent)=>input.keys.delete(e.code);
 const move=(e:MouseEvent)=>{if((doc.pointerLockElement||dragging)&&active()){input.yaw-=e.movementX*.002;input.pitch=Math.max(-.9,Math.min(.85,input.pitch-e.movementY*.002));}};
 const lock=()=>{if(!doc.pointerLockElement)suspend();};
 const focus=(e:FocusEvent)=>{if(isUI(e.target))suspend();};
 const mouseDown=(e:MouseEvent)=>{if(isUI(e.target)){clear();return;}if(active()){if(e.button===2)dragging=true;if(e.button===0)input.fire=true;}};
 const mouseUp=()=>{input.fire=false;dragging=false;};
 const context=(e:MouseEvent)=>{if(active())e.preventDefault();};
 const unsubscribe=options.subscribe(()=>{if(!active())clear();});
 win.addEventListener('contextmenu',context);win.addEventListener('keydown',down);win.addEventListener('keyup',up);
 win.addEventListener('mousemove',move);win.addEventListener('mousedown',mouseDown);win.addEventListener('mouseup',mouseUp);
 win.addEventListener('blur',suspend);doc.addEventListener('pointerlockchange',lock);doc.addEventListener('focusin',focus);
 return()=>{
  unsubscribe();clear();win.removeEventListener('contextmenu',context);win.removeEventListener('keydown',down);win.removeEventListener('keyup',up);
  win.removeEventListener('mousemove',move);win.removeEventListener('mousedown',mouseDown);win.removeEventListener('mouseup',mouseUp);
  win.removeEventListener('blur',suspend);doc.removeEventListener('pointerlockchange',lock);doc.removeEventListener('focusin',focus);
 };
}
export function useControls(options?:ControlOptions){
 const input=useRef<Input>({keys:new Set<string>(),yaw:0,pitch:.04,fire:false});
 useEffect(()=>bindControls(input.current,options??{active:()=>game.get().phase==='playing',pause:()=>game.act({type:'pause'}),subscribe:game.subscribe}),[options]);
 return input;
}
