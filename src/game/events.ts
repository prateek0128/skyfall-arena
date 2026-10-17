import { Vector3 } from 'three';
export type CombatEvent =
 | {type:'beam';from:Vector3;to:Vector3;enemy?:boolean}
 | {type:'impact'|'destroy';at:Vector3}
 | {type:'target';id:number;wave:number};
const listeners=new Set<(event:CombatEvent)=>void>();
export const combat={
 emit:(event:CombatEvent)=>listeners.forEach(fn=>fn(event)),
 subscribe:(fn:(event:CombatEvent)=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
};
// Shared spatial telemetry avoids React updates every frame.
export const pilotPosition=new Vector3(0,2,3);
