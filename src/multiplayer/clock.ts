/** Round the whole remaining duration before splitting minutes and seconds. */
export function formatMatchTime(value:number){
 const seconds=Math.ceil(Math.max(0,value));
 return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
