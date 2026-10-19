export function MainMenuActions({loaded,onSinglePlayer,onMultiplayer}:{loaded:boolean;onSinglePlayer:()=>void;onMultiplayer:()=>void}){
 return <>
  <button className="launch" disabled={!loaded} onClick={onSinglePlayer}>SINGLE PLAYER{!loaded?' · LOADING…':''}<span>↗</span></button>
  <button className="restart" onClick={onMultiplayer}>MULTIPLAYER · PRIVATE ROOMS ↗</button>
 </>;
}
