import { test } from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation,canFire,damage,inBounds } from './simulation';
import { idleInput } from '../shared/protocol';
await RAPIER.init();
test('bounds, cooldown and damage are constrained by server rules',()=>{
 assert.ok(inBounds({x:0,y:1,z:0}));assert.ok(!inBounds({x:91,y:1,z:0}));assert.ok(!inBounds({x:0,y:NaN,z:0}));
 assert.equal(damage(10,25),0);assert.equal(damage(100,-10),100);assert.ok(!canFire(.19,0));assert.ok(canFire(.2,0));
});
test('server simulates normalized flight, solid landing, stale input braking and fall recovery',()=>{
 const s=new Simulation();try{
  const p=s.add('p','Pilot',0);p.input={...idleInput(),x:1,z:1,thrust:true,boost:true};
  for(let i=0;i<30;i++){p.lastInput=s.time;s.step(1/30);}
  assert.ok(p.state.position.y>5);assert.ok(p.state.fuel<65);assert.ok(Math.hypot(p.state.velocity.x,p.state.velocity.z)<=15.01);
  const fuel=p.state.fuel;for(let i=0;i<90;i++)s.step(1/30);
  assert.ok(p.state.fuel>fuel);assert.ok(Math.hypot(p.state.velocity.x,p.state.velocity.z)<.1);
  const before=p.state.health;
  p.body.setTranslation({x:150,y:0,z:0},true);s.step(1/30);assert.equal(p.state.health,before-25);assert.ok(inBounds(p.state.position));
  p.body.setTranslation({x:0,y:5,z:0},true);p.body.setLinvel({x:0,y:0,z:0},true);
  for(let i=0;i<90;i++)s.step(1/30);assert.ok(p.state.position.y>.7&&p.state.position.y<1);
 }finally{s.dispose();}
});
test('server raycast scores hits and eliminations at fire cooldown; cover blocks damage',()=>{
 const s=new Simulation();try{
  const a=s.add('a','A',0),b=s.add('b','B',1);a.input={...idleInput(),fire:true,yaw:-Math.PI/2,pitch:-.12};
  let shots=0;for(let i=0;i<23;i++){a.lastInput=s.time;shots+=s.step(1/30).length;}
  assert.equal(shots,4);assert.equal(b.state.health,0);assert.equal(a.state.hits,4);assert.equal(a.state.eliminations,1);assert.equal(a.state.score,140);
  s.reset();a.body.setTranslation({x:-7,y:1,z:0},true);b.body.setTranslation({x:-7,y:1,z:-12},true);a.input={...idleInput(),fire:true};
  for(let i=0;i<25;i++){a.lastInput=s.time;s.step(1/30);}assert.equal(b.state.health,100);
 }finally{s.dispose();}
});
