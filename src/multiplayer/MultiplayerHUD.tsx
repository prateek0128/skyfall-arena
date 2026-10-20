import { useState } from 'react';
import {CopyRoomCode} from './CopyRoomCode';
import { network,useNetwork } from './network';
import { game,useGame } from '../game/store';
import { unlockAudio } from '../game/audio';
import {formatMatchTime} from './clock';
export const INITIAL_PLAYER_NAME='';
export function PlayerNameField({name=INITIAL_PLAYER_NAME,onChange}:{name?:string;onChange:(name:string)=>void}){
 return <label>PILOT NAME<input value={name} placeholder="Enter your name" maxLength={18} onChange={e=>onChange(e.target.value)} autoComplete="nickname"/></label>;
}
export function MultiplayerHUD({onSolo}:{onSolo:()=>void}){
 const net=useNetwork(),audio=useGame(),[name,setName]=useState(INITIAL_PLAYER_NAME),[code,setCode]=useState('');
 const room=net.room,me=room?.players.find(p=>p.id===net.playerId),host=room?.hostId===net.playerId;
 const busy=net.status==='connecting'||net.status==='reconnecting',playing=room?.phase==='playing';
 const capture=async()=>{unlockAudio();try{await document.querySelector('canvas')?.requestPointerLock();}catch{/* Drag fallback is always supported. */}network.set({menu:false});};
 const leave=()=>{network.leave();document.exitPointerLock();};
 return <div className={`interface multiplayer ${performance.now()-net.hurtAt<250?'damaged':''} ${me&&me.health<=25?'low-health':''}`}>
  <header><div className="brand"><span className="brand-symbol">◈</span> SKYFALL<span className="brand-sub">ARENA</span></div><div className="session"><i/> PRIVATE ARENA <span>/</span> {room?<span className="room-code-value">{room.code}<CopyRoomCode key={room.code} code={room.code}/></span>:'MULTIPLAYER'}</div><div className="header-actions"><button className="quiet" onClick={()=>game.set({muted:!audio.muted})}>{audio.muted?'SOUND OFF':'SOUND ON'}</button><button className="quiet" onClick={()=>{network.set({menu:true});document.exitPointerLock();}}>MENU</button></div></header>
  {playing&&<>
   <div className="wave-panel"><span>LAST PILOT STANDING</span><strong>{formatMatchTime(room.remaining)}</strong><small>{room.players.filter(p=>p.alive).length} / {room.players.length} PILOTS ALIVE · ROOM {room.code}</small></div>
   <div className="score"><span className="eyebrow">YOUR SCORE</span><strong>{me?.score??0}</strong><span>{me?.eliminations??0} ELIMINATIONS</span></div>
   {!net.menu&&me?.alive&&<div className={`crosshair ${performance.now()-net.hitAt<180?'hit':''}`}><i/><i/><i/><i/><b/></div>}
   {performance.now()-net.killAt<1600&&<div className="notice" role="status">ELIMINATION CONFIRMED</div>}
   <div className="flight-hint">{net.status!=='connected'?'CONNECTION LOST · RECONNECTING':!me?.alive?'ELIMINATED · WATCH THE MATCH':'WASD / ARROWS MOVE · SPACE THRUST · SHIFT BOOST · LMB FIRE · ESC MENU · RMB DRAG LOOK'}</div>
   <footer><div className="telemetry"><div className="meter-label"><span>ϟ JETPACK FUEL</span><b>{Math.round(me?.fuel??0)}%</b></div><div className="meter"><div style={{width:`${me?.fuel??0}%`}}/></div><div className="health"><span>＋ HULL</span><b>{me?.health??0}</b></div></div><div className="status"><i/> SERVER AUTHORITATIVE<span>30 HZ SIMULATION / 15 HZ SNAPSHOTS</span></div></footer>
  </>}
  {(!room||room.phase!=='playing'||net.menu)&&<div className="overlay mp-overlay"><section className="mp-panel">
   <div className="eyebrow">{room?<span className="room-code-value">PRIVATE ROOM {room.code}<CopyRoomCode key={room.code} code={room.code}/></span>:'PRIVATE ROOMS · 2–8 PILOTS'}</div>
   <h1>{!room?<>FLY<br/><em>TOGETHER.</em></>:room.phase==='countdown'?<>LAUNCH IN<br/><em>{Math.ceil(room.remaining)}</em></>:room.phase==='results'?<>{room.winners.includes(net.playerId)?'VICTORY.':'MATCH OVER.'}</>:room.phase==='playing'?<>FLIGHT<br/><em>MENU.</em></>:<>READY<br/><em>YOUR SQUAD.</em></>}</h1>
   {!room?<>
    <p>Private free-for-all. The server runs flight, fuel, hits, and scoring. Single-player works independently.</p>
    <PlayerNameField name={name} onChange={setName}/>
    <button className="launch" disabled={busy||!name.trim()||!net.loaded} onClick={()=>{unlockAudio();network.connect('create',name.trim());}}>CREATE ROOM <span>↗</span></button>
    <div className="join-row"><input aria-label="Room code" placeholder="ROOM CODE" value={code} maxLength={6} onChange={e=>setCode(e.target.value.toUpperCase())}/><button className="quiet" disabled={busy||code.length!==6||!name.trim()} onClick={()=>network.connect('join',name.trim(),code)}>JOIN ROOM</button></div>
    <button className="restart" onClick={()=>network.reconnect()}>RECONNECT SAVED SESSION</button>
   </>:<>
    {room.phase==='results'&&<p>{room.reason} · {room.winners.length?room.players.filter(p=>room.winners.includes(p.id)).map(p=>p.name).join(', '):'No winners'}</p>}
    <div className="room-code"><span>INVITE CODE</span><strong>{room.code}</strong><CopyRoomCode key={room.code} code={room.code}/><small>{net.status.toUpperCase()}</small></div>
    <div className="roster" aria-label={room.phase==='results'?'Final scoreboard':'Lobby roster'}><div className="roster-head"><span>PILOT</span><span>{room.phase==='lobby'?'STATUS':'SCORE / KILLS'}</span></div>{[...room.players].sort((a,b)=>room.phase==='results'?b.score-a.score:0).map(p=><div key={p.id} className={`roster-row ${p.id===net.playerId?'self':''}`}><span>{p.name}{p.id===room.hostId?' ♔':''}{p.id===net.playerId?' (you)':''}<small>{p.connected?'CONNECTED':'DISCONNECTED · 20s grace'}{!p.alive&&room.phase!=='lobby'?' · ELIMINATED':''}</small></span><b>{room.phase==='lobby'?p.ready?'READY':'NOT READY':`${p.score} / ${p.eliminations}`}</b></div>)}</div>
    {room.phase==='lobby'&&<><p>Share the room code. Everyone readies up; the host launches. Last survivor wins, or highest score then hull at 2:00.</p><div className="mp-buttons"><button className="quiet" disabled={net.status!=='connected'} onClick={()=>network.send({v:1,type:'ready',ready:!me?.ready})}>{me?.ready?'UNREADY':'READY UP'}</button>{host&&<button className="launch" disabled={!net.loaded||net.status!=='connected'||room.players.filter(p=>p.connected).length<2||room.players.some(p=>p.connected&&!p.ready)} onClick={()=>network.send({v:1,type:'start'})}>START MATCH ↗</button>}</div></>}
    {room.phase==='countdown'&&<p>All pilots launch together. Capture your mouse when the match begins.</p>}
    {room.phase==='playing'&&<><p>The shared match continues while this menu is open. Server flight and fall recovery remain active.</p><button className="launch" disabled={net.status!=='connected'} onClick={()=>void capture()}>{me?.alive?'TAKE CONTROL':'WATCH MATCH'} <span>↗</span></button></>}
    {room.phase==='results'&&host&&<div className="mp-buttons"><button className="launch" disabled={room.players.filter(p=>p.connected).length<2} onClick={()=>network.send({v:1,type:'start'})}>REMATCH ↗</button><button className="quiet" onClick={()=>network.send({v:1,type:'lobby'})}>RETURN TO LOBBY</button></div>}
    {room.phase==='results'&&!host&&<p>Waiting for the host to choose a rematch or return to lobby.</p>}
    <button className="restart" onClick={leave}>LEAVE ROOM</button>
   </>}
   {net.error&&<p className="error" role="alert">{net.error}</p>}
   {net.status==='offline'&&room&&<button className="quiet" onClick={()=>network.reconnect()}>RECONNECT SESSION</button>}
   {busy&&<p role="status">{net.status==='reconnecting'?'Reconnecting your pilot…':'Connecting to game server…'}</p>}
   <button className="solo-link" onClick={()=>{if(room||net.status!=='offline')leave();onSolo();}}>← SINGLE-PLAYER SURVIVAL</button>
  </section></div>}
 </div>;
}
