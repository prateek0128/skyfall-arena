/** Pure survival rules. All clocks are simulation seconds, so pause freezes them. */
export const WAVE_COUNT = 3;
export const DRONES_PER_WAVE = 7;
export const WAVE_SECONDS = 80;
export const COMBO_SECONDS = 5;
export type Match = {
 phase: 'ready' | 'playing' | 'paused' | 'over';
 outcome: 'victory' | 'defeat' | null;
 reason: string;
 health: number; score: number; shots: number; hits: number;
 destroyed: number; wave: number; cleared: number[];
 elapsed: number; remaining: number; combo: number; lastKill: number;
};
export function initialMatch(): Match {
 return { phase:'ready',outcome:null,reason:'',health:100,score:0,shots:0,hits:0,
 destroyed:0,wave:1,cleared:[],elapsed:0,remaining:WAVE_SECONDS,combo:0,lastKill:-Infinity };
}
export type MatchAction = {type:'start'|'pause'|'resume'|'shot'} | {type:'tick';dt:number}
 | {type:'hit'} | {type:'kill';id:number;wave:number} | {type:'damage';amount:number};
export function accuracy(shots:number,hits:number){return shots>0?Math.min(100,Math.round(hits/shots*100)):0;}
export function advanceMatch(s:Match,a:MatchAction):Match {
 if(a.type==='start')return {...initialMatch(),phase:'playing'};
 if(a.type==='pause')return s.phase==='playing'?{...s,phase:'paused'}:s;
 if(a.type==='resume')return s.phase==='paused'?{...s,phase:'playing'}:s;
 if(s.phase!=='playing')return s;
 switch(a.type){
  case 'shot':return {...s,shots:s.shots+1};
  case 'hit':return {...s,hits:s.hits+1,score:s.score+50};
  case 'damage':{
   const health=Math.max(0,s.health-Math.max(0,a.amount));
   return {...s,health,...(health===0?{phase:'over' as const,outcome:'defeat' as const,reason:'Hull integrity lost'}:{})};
  }
  case 'tick':{
   const dt=Math.min(Math.max(a.dt,0),s.remaining),remaining=Math.max(0,s.remaining-dt);
   return {...s,elapsed:s.elapsed+dt,remaining,combo:s.elapsed+dt-s.lastKill>COMBO_SECONDS?0:s.combo,
    ...(remaining===0?{phase:'over' as const,outcome:'defeat' as const,reason:'Wave time expired'}:{})};
  }
  case 'kill':{
   if(a.wave!==s.wave||a.id<0||a.id>=DRONES_PER_WAVE||s.cleared.includes(a.id))return s;
   const combo=s.elapsed-s.lastKill<=COMBO_SECONDS?Math.min(5,s.combo+1):1;
   const cleared=[...s.cleared,a.id];
   const result={...s,cleared,destroyed:s.destroyed+1,score:s.score+300*combo,combo,lastKill:s.elapsed};
   if(cleared.length<DRONES_PER_WAVE)return result;
   if(s.wave===WAVE_COUNT)return {...result,phase:'over',outcome:'victory',reason:'All 21 drones neutralized'};
   return {...result,wave:s.wave+1,cleared:[],remaining:WAVE_SECONDS,health:Math.min(100,s.health+15)};
  }
 }
}
