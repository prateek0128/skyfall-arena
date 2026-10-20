export function MainMenuActions({loaded,onSinglePlayer,onMultiplayer}:{loaded:boolean;onSinglePlayer:()=>void;onMultiplayer:()=>void}){
 return <div className="main-menu-actions">
  <button className="launch" disabled={!loaded} onClick={onSinglePlayer}>SINGLE PLAYER{!loaded?' · LOADING…':''}<span>↗</span></button>
  <button className="launch" onClick={onMultiplayer}>MULTIPLAYER<span>↗</span></button>
 </div>;
}
