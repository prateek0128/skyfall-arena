import { Suspense,useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Arena } from './Arena';
import { Player } from './Player';
import { Targets } from './Targets';
import { useGame } from './store';
import { Effects } from './Effects';
import { MatchController } from './MatchController';
import { MultiplayerScene } from '../multiplayer/Scene';
import { useNetwork } from '../multiplayer/network';
function Atmosphere(){const dots=useMemo(()=>{let seed=42;return Array.from({length:200},()=>{seed=(seed*16807)%2147483647;const x=seed/2147483647;seed=(seed*16807)%2147483647;const y=seed/2147483647;seed=(seed*16807)%2147483647;return [(x-.5)*160,y*65-15,(seed/2147483647-.5)*180];}).flat();},[]);return <><color attach="background" args={['#91b5c8']}/><fog attach="fog" args={['#91b5c8',45,155]}/><hemisphereLight args={['#e2f5ff','#41516b',2.2]}/><directionalLight position={[25,45,15]} intensity={3} color="#fff2d5" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-55} shadow-camera-right={55} shadow-camera-top={55} shadow-camera-bottom={-55}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-19,0]}><planeGeometry args={[1000,1000]}/><meshBasicMaterial color="#d7e7ec"/></mesh>{Array.from({length:18},(_,i)=><mesh key={i} position={[Math.sin(i*7)*90,-17-i%3*2,Math.cos(i*4)*90]} scale={[22,3,12]}><sphereGeometry args={[1,12,8]}/><meshBasicMaterial color={i%2?'#c8dee6':'#d9e8ee'}/></mesh>)}<points><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array(dots),3]}/></bufferGeometry><pointsMaterial color="#e1fcff" size={.065} transparent opacity={.6}/></points></>;}
export function World({multiplayer=false}:{multiplayer?:boolean}){const state=useGame();const net=useNetwork();return <Canvas shadows dpr={[1,1.5]} camera={{position:[22,18,30],fov:65,near:.1,far:250}} gl={{antialias:true}}><Atmosphere/><Suspense fallback={null}><Physics paused={multiplayer||state.phase!=='playing'} gravity={[0,-20,0]} timeStep="vary"><Arena/>{multiplayer?<><MultiplayerScene/><Effects active={net.room?.phase==='playing'}/></>:<><MatchController/><group key={state.run}><Player/><Targets wave={state.wave}/><Effects/></group></>}</Physics></Suspense></Canvas>;}

export default World;
