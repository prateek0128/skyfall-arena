import {test} from 'node:test';
import assert from 'node:assert/strict';
import RAPIER from '@dimforge/rapier3d-compat';
import * as arena from '../shared/arena.ts';
import {Simulation} from '../server/simulation.ts';
import {idleInput} from '../shared/protocol.ts';
import {AimMirror,targetAim,CombatDriver,activityChecks} from './load-scenario.mjs';
await RAPIER.init();
function fixture(){const simulation=new Simulation();const a=simulation.add('a','A',0),b=simulation.add('b','B',1);const mirror=new AimMirror(RAPIER,arena);return {simulation,a,b,mirror,close(){mirror.dispose();simulation.dispose();}};}
test('harness aim predicts a hit, resolved only by unchanged authoritative simulation',()=>{
 const f=fixture();try{const room={tick:1,players:[f.a.state,f.b.state]};f.mirror.update(room);const aim=targetAim(f.a.state,f.b.state);assert.equal(f.mirror.trace(f.a.state,aim).hitId,'b');assert.equal(f.b.state.health,100);
 f.a.input={...idleInput(),...aim,fire:true};f.a.lastInput=0;f.simulation.step(1/30);assert.equal(f.a.state.hits,1);assert.equal(f.b.state.health,75);
 }finally{f.close();}
});
test('fixed upward aim can hit a pilot behind the shooter through camera targeting',()=>{
 const f=fixture();try{f.a.state.position={x:0,y:5,z:0};f.b.state.position={x:0,y:4,z:3};f.a.body.setTranslation(f.a.state.position,true);f.b.body.setTranslation(f.b.state.position,true);f.mirror.update({tick:1,players:[f.a.state,f.b.state]});
 const aim={yaw:0,pitch:.85};assert.equal(f.mirror.trace(f.a.state,aim).hitId,'b');assert.equal(f.mirror.safe(f.a.state,aim),false);const safe=f.mirror.safeAim(f.a.state);assert.ok(safe);assert.equal(f.mirror.trace(f.a.state,safe).hitId,null);
 f.a.input={...idleInput(),...aim,fire:true};f.a.lastInput=0;f.simulation.step(1/30);assert.equal(f.b.state.health,75);
 }finally{f.close();}
});
test('skirmish driver stops targeting a half-health buddy; never mutates health',()=>{
 const driver=new CombatDriver(),a={id:'a',hits:2},b={id:'b',health:50,alive:true};const mirror={safeAim:()=>({yaw:1,pitch:-.85}),safe:()=>true,trace:()=>{throw new Error('Must not seek more damage');}};
 assert.equal(driver.choose({players:[a,b]},a,0,mirror,1,true).intent,'cover');assert.equal(b.health,50);
});
test('activity requires continuous movement/fire, every pilot alive and every full window present',()=>{
 const pilot={alive:true,minimumAlive:8,expectedPlayers:8,ackAdvance:150,shotsAdvance:25,maxDistance:2,nonPlayingSnapshots:0,maxShotGapMs:210,windows:Array.from({length:5},()=>({acks:30,shots:5,distance:1}))};
 assert.equal(activityChecks(pilot,true,5),true);
 for(const patch of [{alive:false},{minimumAlive:7},{shotsAdvance:1},{maxShotGapMs:501},{nonPlayingSnapshots:1},{windows:[]},{windows:Array(5)},{windows:[...pilot.windows.slice(1),{acks:30,shots:0,distance:1}]},{windows:[...pilot.windows.slice(1),{acks:30,shots:5,distance:0}]}])assert.equal(activityChecks({...pilot,...patch},true,5),false);
});
