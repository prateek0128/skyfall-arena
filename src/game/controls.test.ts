import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindControls,movementInput} from './controls';
import {movement} from '../../shared/flight';
function event(type:string,properties:Record<string,unknown>={}){return Object.assign(new Event(type,{cancelable:true}),properties);}
function fixture(){
 let active=true,paused=0,unlocked=0,subscriber:()=>void=()=>{},unsubscribed=false;
 const input={keys:new Set<string>(),yaw:0,pitch:.04,fire:false};
 const win=new EventTarget();
 const doc=Object.assign(new EventTarget(),{activeElement:null as unknown,pointerLockElement:null,exitPointerLock:()=>{unlocked++;}});
 const cleanup=bindControls(input,{active:()=>active,pause:()=>{paused++;active=false;},subscribe:fn=>{subscriber=fn;return()=>{unsubscribed=true;};}},win as unknown as Window,doc as unknown as Document);
 return {input,win,doc,cleanup,setActive(value:boolean){active=value;subscriber();},get paused(){return paused;},get unlocked(){return unlocked;},get unsubscribed(){return unsubscribed;}};
}
test('arrow directions match existing WASD axes and equivalent keys never stack',()=>{
 for(const [wasd,arrow,expected] of [['KeyW','ArrowUp',{x:0,z:-1}],['KeyS','ArrowDown',{x:0,z:1}],['KeyA','ArrowLeft',{x:-1,z:0}],['KeyD','ArrowRight',{x:1,z:0}]] as const){
  assert.deepEqual(movementInput(new Set([wasd])),expected);assert.deepEqual(movementInput(new Set([arrow])),expected);assert.deepEqual(movementInput(new Set([wasd,arrow])),expected);
 }
 assert.deepEqual(movementInput(new Set(['KeyW','ArrowDown','ArrowLeft','KeyD'])),{x:0,z:0});
});
test('mixed-key diagonals keep the same normalized speed and camera-relative flight',()=>{
 for(const keys of [['ArrowUp','ArrowRight'],['KeyW','ArrowRight'],['KeyW','ArrowUp','KeyD','ArrowRight']]){
  const axes=movementInput(new Set(keys));assert.deepEqual(axes,{x:1,z:-1});
  const velocity=movement(axes.x,axes.z,Math.PI/3,8),wasd=movement(1,-1,Math.PI/3,8);
  assert.deepEqual(velocity,wasd);assert.ok(Math.abs(Math.hypot(velocity.x,velocity.z)-8)<1e-10);
 }
});
test('keydown prevents gameplay scrolling and keyup immediately releases the correct alias',()=>{
 const f=fixture();try{
  for(const code of ['ArrowUp','KeyW','ArrowRight','Space','ShiftLeft']){const e=event('keydown',{code});f.win.dispatchEvent(e);assert.equal(e.defaultPrevented,true);}
  assert.deepEqual(movementInput(f.input.keys),{x:1,z:-1});
  f.win.dispatchEvent(event('keyup',{code:'KeyW'}));assert.equal(movementInput(f.input.keys).z,-1);
  f.win.dispatchEvent(event('keyup',{code:'ArrowUp'}));f.win.dispatchEvent(event('keyup',{code:'ArrowRight'}));assert.deepEqual(movementInput(f.input.keys),{x:0,z:0});
  f.win.dispatchEvent(event('keyup',{code:'Space'}));f.win.dispatchEvent(event('keyup',{code:'ShiftLeft'}));assert.equal(f.input.keys.size,0);
  f.setActive(false);const e=event('keydown',{code:'ArrowDown'});f.win.dispatchEvent(e);assert.equal(e.defaultPrevented,false);assert.equal(f.input.keys.size,0);
 }finally{f.cleanup();}
});
test('blur, Escape and gameplay exit clear movement, thrust, boost and shooting',()=>{
 for(const trigger of ['blur','escape','overlay']){const f=fixture();try{
  for(const code of ['KeyW','ArrowUp','Space','ShiftRight'])f.win.dispatchEvent(event('keydown',{code}));f.win.dispatchEvent(event('mousedown',{button:0}));assert.equal(f.input.fire,true);
  if(trigger==='blur')f.win.dispatchEvent(event('blur'));else if(trigger==='escape')f.win.dispatchEvent(event('keydown',{code:'Escape'}));else f.setActive(false);
  assert.equal(f.input.keys.size,0);assert.equal(f.input.fire,false);if(trigger!=='overlay'){assert.equal(f.paused,1);assert.equal(f.unlocked,1);}
 }finally{f.cleanup();}}
});
test('UI focus clears held input and arrows remain available for menu navigation',()=>{
 const f=fixture();try{
  f.win.dispatchEvent(event('keydown',{code:'ArrowLeft'}));f.input.fire=true;
  const target={closest:()=>({})};f.doc.activeElement=target;
  const focus=event('focusin');Object.defineProperty(focus,'target',{value:target});f.doc.dispatchEvent(focus);
  assert.equal(f.input.keys.size,0);assert.equal(f.input.fire,false);assert.equal(f.paused,1);
  const arrow=event('keydown',{code:'ArrowUp'});f.win.dispatchEvent(arrow);assert.equal(arrow.defaultPrevented,false);
 }finally{f.cleanup();}
});
test('focused controls also block input without a focus event; cleanup removes every listener',()=>{
 const f=fixture();f.doc.activeElement={closest:()=>({})};f.win.dispatchEvent(event('keydown',{code:'KeyW'}));assert.equal(f.input.keys.size,0);assert.equal(f.paused,1);
 f.doc.activeElement=null;f.setActive(true);f.cleanup();assert.equal(f.unsubscribed,true);
 const key=event('keydown',{code:'ArrowUp'});f.win.dispatchEvent(key);f.win.dispatchEvent(event('mousedown',{button:0}));f.win.dispatchEvent(event('blur'));assert.equal(key.defaultPrevented,false);assert.equal(f.input.keys.size,0);assert.equal(f.input.fire,false);assert.equal(f.paused,1);
});
test('drag mouse-look, shooting and release work as before; blur clears drag state',()=>{
 const f=fixture();try{
  f.win.dispatchEvent(event('mousedown',{button:2}));f.win.dispatchEvent(event('mousemove',{movementX:20,movementY:10}));assert.equal(f.input.yaw,-.04);assert.ok(f.input.pitch<.04);
  f.win.dispatchEvent(event('mousedown',{button:0}));assert.equal(f.input.fire,true);f.win.dispatchEvent(event('mouseup'));assert.equal(f.input.fire,false);
  f.win.dispatchEvent(event('mousedown',{button:2}));f.win.dispatchEvent(event('blur'));f.setActive(true);const yaw=f.input.yaw;f.win.dispatchEvent(event('mousemove',{movementX:20,movementY:10}));assert.equal(f.input.yaw,yaw);
 }finally{f.cleanup();}
});
