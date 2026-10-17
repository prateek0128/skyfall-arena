import { game } from './store';
let context:AudioContext|undefined;
export function unlockAudio(){try{context??=new AudioContext();void context.resume().catch(()=>{});}catch{/* Audio is optional on unsupported browsers. */}}
export function sound(kind:'shot'|'hit'|'destroy'|'damage'|'wave'){
 if(!context||context.state!=='running'||game.get().muted)return;
 const osc=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
 const tones={shot:[750,240,.07],hit:[1100,550,.09],destroy:[180,35,.32],damage:[100,45,.18],wave:[400,950,.25]}[kind];
 osc.type=kind==='destroy'?'sawtooth':'triangle';osc.frequency.setValueAtTime(tones[0],now);osc.frequency.exponentialRampToValueAtTime(tones[1],now+tones[2]);
 gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+tones[2]);
 osc.connect(gain);gain.connect(context.destination);osc.start();osc.stop(now+tones[2]);osc.onended=()=>{osc.disconnect();gain.disconnect();};
}
