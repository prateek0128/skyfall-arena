import { useState } from 'react';
import { MainMenuActions } from './MainMenuActions';
import { game,useGame } from '../game/store';
import { accuracy,DRONES_PER_WAVE,WAVE_COUNT } from '../game/match';
import { unlockAudio } from '../game/audio';
const formatTime=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export function HUD({onMultiplayer}:{onMultiplayer:()=>void}){
 const s=useGame();const [fallback,setFallback]=useState(false);
 const paused=s.phase==='paused',over=s.phase==='over',victory=s.outcome==='victory';
 async function play(restart=false){
  if(!s.loaded)return;
  unlockAudio();
  try{const canvas=document.querySelector('canvas');if(!canvas) return;await canvas.requestPointerLock();setFallback(false);}
  catch{setFallback(true);}
  if(restart)game.restart();else game.act({type:'resume'});
 }
 return <div className={`interface ${s.phase==='playing'&&s.elapsed-s.hurt<.25?'damaged':''} ${s.health<=25?'low-health':''}`}>
  <header><a className="brand" href="#" onClick={e=>e.preventDefault()}><span className="brand-symbol">◈</span> SKYFALL<span className="brand-sub">ARENA</span></a>
   <div className="session"><i/> SURVIVAL <span>/</span> SECTOR 07</div>
   <div className="header-actions"><button className="quiet" aria-label={s.muted?'Unmute sound':'Mute sound'} onClick={()=>game.set({muted:!s.muted})}>{s.muted?'SOUND OFF':'SOUND ON'}</button><button className="quiet" onClick={()=>{if(s.phase==='playing'){game.act({type:'pause'});document.exitPointerLock();}else if(paused)void play();}}>{s.phase==='playing'?'Ⅱ PAUSE':'ESC / MENU'}</button></div>
  </header>
  <div className="location"><span className="eyebrow">STRATOSPHERE COMBAT FACILITY</span><h2>THE DRIFT<span>07</span></h2><p>ALTITUDE 2,400 M <b>•</b> SURVIVAL</p></div>
  <div className="score"><span className="eyebrow">MATCH SCORE</span><strong>{String(s.score).padStart(5,'0')}</strong><span>{s.combo>1?`${s.combo}× COMBO · `:''}{s.destroyed} DRONES DOWN</span></div>
  {s.phase==='playing'&&<>
   <div className={`wave-panel ${s.remaining<15?'urgent':''}`}><span>WAVE {s.wave} / {WAVE_COUNT}</span><strong>{formatTime(s.remaining)}</strong><small>{DRONES_PER_WAVE-s.cleared.length} DRONES REMAIN · ELIMINATE ALL TO ADVANCE</small></div>
   <div className={`crosshair ${s.elapsed-s.hit<.16?'hit':''} ${s.elapsed-s.shot<.1?'shot':''}`}><i/><i/><i/><i/><b/></div>
   <div className="flight-data"><span>{Math.round(s.speed*3.6)}<small>KM/H</small></span><div/><span>{Math.round(s.altitude)}<small>METERS AGL</small></span></div>
   {s.message&&s.elapsed<s.messageUntil&&<div className="notice" role="status">{s.message}</div>}
   <div className="flight-hint">{s.health<=25?'HULL CRITICAL · EVADE INCOMING FIRE':s.fuel<18?'FUEL LOW · RELEASE THRUST TO RECHARGE':fallback?'HOLD RIGHT MOUSE TO LOOK · ESC TO PAUSE':'RED RINGS MARK INCOMING FIRE · KEEP MOVING'}</div>
  </>}
  <footer><div className="telemetry"><div className="meter-label"><span><i className="fuel-icon">ϟ</i> JETPACK FUEL</span><b>{Math.round(s.fuel)}<small>%</small></b></div><div className="meter" role="meter" aria-label="Jetpack fuel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.fuel)}><div style={{width:`${s.fuel}%`,background:s.fuel<18?'#efad6e':undefined}}/></div><div className="health"><span>＋ HULL</span><div>{[0,1,2,3].map(i=><i key={i} className={s.health>i*25?'active':''}/>)}</div><b>{s.health}</b></div></div>
   <div className="key-guide"><div><kbd>W A S D / ↑ ← ↓ →</kbd><span>MOVE</span></div><div><kbd>SPACE</kbd><span>THRUST</span></div><div><kbd>SHIFT</kbd><span>AIR BOOST</span></div><div><kbd>LMB</kbd><span>FIRE</span></div></div><div className="status"><i/> {s.loaded?'SYSTEMS ONLINE':'SYSTEMS LOADING'}<span>PROTOTYPE / 0.2</span></div>
  </footer>
  {s.phase!=='playing'&&<div className="overlay"><section className={`menu ${over?'results-menu':''}`}>
   <div className="eyebrow"><span className="line"/>{over?victory?'MISSION COMPLETE':'MISSION ENDED':paused?'FLIGHT SUSPENDED':'SURVIVAL PROTOCOL'}</div>
   <h1>{over?victory?<>SKY<br/><em>SECURED.</em></>:<>BACK TO<br/><em>THE SKY.</em></>:paused?<>HOLD YOUR<br/><em>ALTITUDE.</em></>:<>OWN THE<br/><em>OPEN SKY.</em></>}</h1>
   <p>{over?s.reason:paused?'Your match is paused. Time, drones, and fuel will resume together.':'Clear three waves of seven drones before each timer expires. Dodge incoming fire, manage fuel, and chain kills within 5 seconds for up to 5× points.'}</p>
   {over?<div className="results" aria-label="Match results"><div><span>SCORE</span><b>{s.score.toLocaleString()}</b></div><div><span>DRONES DESTROYED</span><b>{s.destroyed} / 21</b></div><div><span>SURVIVAL TIME</span><b>{formatTime(s.elapsed)}</b></div><div><span>ACCURACY</span><b>{s.shots?`${accuracy(s.shots,s.hits)}%`:'—'}</b></div><small>{s.hits} HITS / {s.shots} SHOTS · WAVE {s.wave} / {WAVE_COUNT}</small></div>:<div className="mission"><span>0{s.wave}</span><div><b>{paused?'RETURN TO THE FIGHT':'CLEAR. EVADE. ASCEND.'}</b><small>{paused?`${formatTime(s.remaining)} left · ${DRONES_PER_WAVE-s.cleared.length} drones remaining`:'80 seconds per wave · +15 hull between waves'}</small></div></div>}
   {s.phase==='ready'?<MainMenuActions loaded={s.loaded} onSinglePlayer={()=>void play(true)} onMultiplayer={onMultiplayer}/>:<button className="launch" disabled={!s.loaded} onClick={()=>void play(!paused)}>{!s.loaded?'LOADING ARENA…':paused?'RESUME FLIGHT':over?'PLAY AGAIN':'SINGLE PLAYER'}<span>↗</span></button>}
   {over&&<button className="restart" onClick={()=>{document.exitPointerLock();game.home();}}>RETURN TO HOME</button>}
   {paused&&<button className="restart" onClick={()=>void play(true)}>RESTART MATCH</button>}
   <div className="menu-note">MOUSE TO LOOK <span>•</span> ESC TO PAUSE <span>•</span> DESKTOP + KEYBOARD</div>
  </section><div className="side-label">SKYFALL SURVIVAL PROGRAM <span>///</span> EST. 2086</div></div>}
 </div>;
}
