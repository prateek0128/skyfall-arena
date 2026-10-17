/** Public endpoint selection; deliberately independent of DOM and Vite for testing. */
export function websocketUrl(configured:string|undefined,page:{protocol:string;hostname:string},production:boolean){
 const local=['localhost','127.0.0.1','[::1]'].includes(page.hostname);
 if(production&&!configured&&!local)throw new Error('Multiplayer is not configured. Set VITE_WS_URL when building the frontend. Single-player is available.');
 let url:URL;try{url=new URL(configured||`${page.protocol==='https:'?'wss':'ws'}://${page.hostname}:2567`);}catch{throw new Error('Invalid multiplayer WebSocket URL.');}
 if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.hash)throw new Error('Invalid multiplayer WebSocket URL.');
 if((page.protocol==='https:'||(production&&!local))&&url.protocol!=='wss:')throw new Error('Production and HTTPS multiplayer require a secure wss:// endpoint.');
 return url;
}
