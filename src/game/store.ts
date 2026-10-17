import { useSyncExternalStore } from 'react';
import { advanceMatch, initialMatch, type Match, type MatchAction } from './match';
export type GameState = Match & {
 fuel:number; shot:number; hit:number; hurt:number; altitude:number; speed:number;
 run:number; message:string; messageUntil:number; loaded:boolean; muted:boolean;
};
const telemetry={fuel:100,shot:-Infinity,hit:-Infinity,hurt:-Infinity,altitude:0,speed:0,message:'',messageUntil:0};
let state:GameState={...initialMatch(),...telemetry,run:0,loaded:false,muted:false};
const listeners=new Set<()=>void>();
export const game={
 get:()=>state,
 set:(patch:Partial<GameState>)=>{state={...state,...patch};listeners.forEach(fn=>fn());},
 act:(action:MatchAction)=>{const next=advanceMatch(state,action);if(next!==state)game.set(next);},
 notify:(message:string,seconds=3)=>game.set({message,messageUntil:state.elapsed+seconds}),
 restart:()=>game.set({...advanceMatch(state,{type:'start'}),...telemetry,run:state.run+1}),
 subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},
};
export function useGame(){return useSyncExternalStore(game.subscribe,game.get);}
