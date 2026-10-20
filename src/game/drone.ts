/** Bounded, deterministic variation; warning time always includes a fixed dodge window. */
export function droneProfile(wave:number,id:number){
 const level=Math.max(1,Math.min(3,wave));
 return {speed:.55+level*.23,radius:1+level*.35,warning:1.1-level*.1,lockWindow:.45,
  cooldown:5-level*.65+id*.12,tracking:.35+(level-1)*.1};
}
export function droneCooldown(wave:number,id:number,attack:number){
 return droneProfile(wave,id).cooldown+.35*Math.sin(id*1.7+attack*2.4);
}
