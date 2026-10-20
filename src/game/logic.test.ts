import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuelStep, movement, recoveryHealth } from './logic';
test('fuel drains, boost costs more, regeneration is bounded', () => {
 assert.equal(fuelStep(100,true,false,1),77); assert.equal(fuelStep(100,true,true,1),62);
 assert.equal(fuelStep(99,false,false,1),100); assert.equal(fuelStep(1,true,true,1),0);
});
test('diagonal input never increases speed and follows camera yaw',()=>{
 const diagonal=movement(1,1,0,8); assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-8)<1e-9);
 const forward=movement(0,-1,Math.PI/2,8); assert.ok(Math.abs(forward.x+8)<1e-9);
});
test('four falls exhaust health without negative values',()=>{assert.equal(recoveryHealth(25),0);assert.equal(recoveryHealth(0),0);});

import { nextVelocity } from './physics';
test('flight caps ascent and released thrust preserves gravity velocity',()=>{
 assert.ok(nextVelocity({x:0,y:12,z:0},{x:0,z:0},true,true,.1).y-20*.1<=13);
 assert.equal(nextVelocity({x:0,y:-4,z:0},{x:0,z:0},false,false,.1).y,-4);
 const v=nextVelocity({x:0,y:0,z:0},{x:8,z:0},false,false,.1);
 assert.ok(v.x>0&&v.x<8);
});

import { advanceMatch, initialMatch, accuracy, WAVE_SECONDS } from './match';
import type { Match } from './match';
const started=()=>advanceMatch(initialMatch(),{type:'start'});
function clearWave(s:Match){for(let id=0;id<7;id++)s=advanceMatch(s,{type:'kill',id,wave:s.wave});return s;}
test('accuracy handles no shots, misses and hits',()=>{
 assert.equal(accuracy(0,0),0);assert.equal(accuracy(10,7),70);assert.equal(accuracy(3,1),33);
 let s=advanceMatch(started(),{type:'shot'});s=advanceMatch(s,{type:'hit'});
 assert.equal(s.shots,1);assert.equal(s.hits,1);assert.equal(s.score,50);
});
test('kills chain within five seconds, cap at 5x, expire and reject duplicates',()=>{
 let s=advanceMatch(started(),{type:'kill',id:0,wave:1});assert.equal(s.score,300);
 assert.equal(advanceMatch(s,{type:'kill',id:0,wave:1}),s);
 for(let id=1;id<6;id++)s=advanceMatch(s,{type:'kill',id,wave:1});
 assert.equal(s.combo,5);assert.equal(s.score,6000);
 s=advanceMatch(s,{type:'tick',dt:5.1});assert.equal(s.combo,0);
 s=advanceMatch(s,{type:'kill',id:6,wave:1});assert.equal(s.score,6300);
});
test('seven kills advance wave, restore bounded hull and reset wave timer',()=>{
 let s=advanceMatch(started(),{type:'damage',amount:25});s=advanceMatch(s,{type:'tick',dt:20});
 s=clearWave(s);assert.equal(s.wave,2);assert.equal(s.destroyed,7);assert.equal(s.health,90);
 assert.equal(s.remaining,WAVE_SECONDS);assert.deepEqual(s.cleared,[]);assert.equal(s.elapsed,20);
 assert.equal(advanceMatch(s,{type:'kill',id:0,wave:1}),s);
 s=clearWave(s);assert.equal(s.wave,3);assert.equal(s.health,100);
 s=clearWave(s);assert.equal(s.outcome,'victory');assert.equal(s.phase,'over');assert.equal(s.destroyed,21);
});
test('pause freezes timer, damage, shots and progression; resume preserves match',()=>{
 const s=advanceMatch(started(),{type:'pause'});
 for(const action of [{type:'tick',dt:10},{type:'damage',amount:100},{type:'shot'},{type:'kill',id:0,wave:1}] as const)assert.equal(advanceMatch(s,action),s);
 assert.equal(advanceMatch(s,{type:'resume'}).phase,'playing');
 assert.equal(advanceMatch(initialMatch(),{type:'resume'}).phase,'ready');
});
test('timeout and hull loss end the match, terminal states cannot resume or score',()=>{
 for(const s of [advanceMatch(started(),{type:'tick',dt:100}),advanceMatch(started(),{type:'damage',amount:200})]){
  assert.equal(s.phase,'over');assert.equal(s.outcome,'defeat');assert.equal(advanceMatch(s,{type:'resume'}),s);
  assert.equal(advanceMatch(s,{type:'hit'}),s);const restarted=advanceMatch(s,{type:'start'});
  assert.equal(restarted.health,100);assert.equal(restarted.elapsed,0);assert.equal(restarted.score,0);assert.equal(restarted.outcome,null);
 }
});
test('horizontal smoothing is consistent across frame rates, thrust settles predictably',()=>{
 const integrate=(step:number)=>{let v={x:0,y:0,z:0};for(let t=0;t<2-step/2;t+=step){v=nextVelocity(v,{x:8,z:0},true,false,step);v.y-=20*step;}return v;};
 const a=integrate(1/60),b=integrate(1/120);assert.ok(Math.abs(a.x-b.x)<.001);assert.ok(Math.abs(a.y-b.y)<.001);assert.ok(a.y>7.9&&a.y<=8);
});
import { game } from './store';
test('restart resets telemetry and stats while preserving readiness and audio preference',()=>{
 game.set({loaded:true,muted:true,score:999,fuel:1,health:1,shots:8,hits:2});const run=game.get().run;
 game.restart();const s=game.get();assert.equal(s.run,run+1);assert.equal(s.score,0);assert.equal(s.fuel,100);assert.equal(s.health,100);assert.equal(s.shots,0);assert.equal(s.loaded,true);assert.equal(s.muted,true);
});

import { simulationDelta } from './physics';
test('match, fuel and controls use the same Rapier delta at low frame rates',()=>{
 assert.equal(simulationDelta(.2),.2);assert.equal(simulationDelta(3),.5);assert.equal(simulationDelta(-1),0);
 let s=started();let fuel=100;
 for(let i=0;i<10;i++){const dt=simulationDelta(.2);s=advanceMatch(s,{type:'tick',dt});fuel=fuelStep(fuel,true,false,dt);}
 assert.ok(Math.abs(s.elapsed-2)<1e-9);assert.ok(Math.abs(fuel-54)<1e-9);
});

import {droneProfile,droneCooldown} from './drone';
test('drone progression is gradual, bounded and always leaves a locked dodge window',()=>{
 for(let wave=1;wave<=3;wave++)for(let id=0;id<7;id++){
  const p=droneProfile(wave,id);assert.ok(p.warning>=.8);assert.ok(p.warning-p.lockWindow>=.35-1e-9);
  assert.ok(p.radius<=2.05+1e-9);assert.ok(p.speed<=1.24+1e-9);
  for(let attack=0;attack<20;attack++)assert.ok(droneCooldown(wave,id,attack)>=2.7);
 }
 assert.ok(droneProfile(3,0).cooldown<droneProfile(2,0).cooldown);
 assert.ok(droneProfile(2,0).cooldown<droneProfile(1,0).cooldown);
 assert.notEqual(droneCooldown(1,0,1),droneCooldown(1,0,2));
});
test('return home clears results and telemetry; retry starts one fresh survival run',()=>{
 game.restart();game.act({type:'damage',amount:100});game.set({fuel:5,hit:1,hurt:1});
 assert.equal(game.get().phase,'over');const run=game.get().run;
 game.home();assert.equal(game.get().phase,'ready');assert.equal(game.get().health,100);assert.equal(game.get().fuel,100);
 assert.equal(game.get().outcome,null);assert.equal(game.get().score,0);assert.equal(game.get().hurt,-Infinity);assert.equal(game.get().run,run+1);
 game.restart();assert.equal(game.get().phase,'playing');assert.equal(game.get().destroyed,0);
});
