import React from 'react';
import ReactDOM from 'react-dom/client';
const World=React.lazy(()=>import('./game/World'));
import { HUD } from './components/HUD';
import { MultiplayerHUD } from './multiplayer/MultiplayerHUD';
import { game,useGame } from './game/store';
import './style.css';
class GameBoundary extends React.Component<{children:React.ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<div className="fallback"><h1>Unable to initialize the arena</h1><p>A desktop browser with WebGL2 support is required.</p><button onClick={()=>location.reload()}>Try again</button></div>:this.props.children;}}
function App(){
 const [multiplayer,setMultiplayer]=React.useState(false);const solo=useGame();
 return <><React.Suspense fallback={<div className="loading" role="status">INITIALIZING FLIGHT SYSTEMS…</div>}><World multiplayer={multiplayer}/></React.Suspense>{multiplayer?<MultiplayerHUD onSolo={()=>setMultiplayer(false)}/>:<><HUD/>{solo.phase!=='playing'&&<button className="mode-switch" onClick={()=>{game.act({type:'pause'});setMultiplayer(true);}}>PRIVATE MULTIPLAYER ↗</button>}</>}</>;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><GameBoundary><App/></GameBoundary></React.StrictMode>);
