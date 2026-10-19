import {useEffect,useRef,useState} from 'react';
import {copyRoomCode} from './clipboard';
export function CopyRoomCode({code}:{code:string}){
 const [status,setStatus]=useState<'idle'|'copying'|'copied'|'error'>('idle');
 const request=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 useEffect(()=>{request.current++;setStatus('idle');return()=>{request.current++;clearTimeout(timer.current);};},[code]);
 async function copy(){
  const current=++request.current;clearTimeout(timer.current);setStatus('copying');
  const copied=await copyRoomCode(code,navigator.clipboard);
  if(current!==request.current)return;
  setStatus(copied?'copied':'error');
  timer.current=setTimeout(()=>setStatus('idle'),copied?2000:7000);
 }
 const feedback=status==='copied'?'Copied':status==='error'?'Copy unavailable. Select the room code and press Ctrl+C (⌘C on Mac).':'';
 return <span className="copy-room-control">
  <button type="button" className="copy-room-button" aria-label="Copy room code" title="Copy room code" disabled={status==='copying'} onClick={()=>void copy()}>
   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {status==='copied'?<path d="m5 12 4 4L19 6"/>:<><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>}
   </svg>
  </button>
  <span className={`copy-feedback ${status==='error'?'copy-error':''}`} role="status" aria-live="polite">{feedback}</span>
 </span>;
}
