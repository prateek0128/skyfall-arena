export const LOCAL_ORIGINS=['http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173'];
export function parseOrigins(values:string[],production=false):string[]{
 if(!values.length)throw new Error('ALLOWED_ORIGINS must contain at least one exact origin');
 return [...new Set(values.map(value=>{
  let url:URL;try{url=new URL(value);}catch{throw new Error('ALLOWED_ORIGINS contains an invalid URL');}
  if(!['http:','https:'].includes(url.protocol)||url.origin!==value||url.username||url.password||(production&&url.protocol!=='https:'))throw new Error('ALLOWED_ORIGINS requires exact HTTP(S) origins without paths, credentials, wildcards, or trailing slashes; production requires HTTPS');
  return url.origin;
 }))];
}
function integer(env:NodeJS.ProcessEnv,key:string,fallback:number,min:number,max:number){const raw=env[key];if(raw===undefined)return fallback;if(!/^\d+$/.test(raw))throw new Error(`${key} must be an integer`);const value=Number(raw);if(value<min||value>max)throw new Error(`${key} must be between ${min} and ${max}`);return value;}
function boolean(env:NodeJS.ProcessEnv,key:string,fallback:boolean){if(env[key]===undefined)return fallback;if(!['true','false'].includes(env[key]!))throw new Error(`${key} must be true or false`);return env[key]==='true';}
export function loadConfig(env:NodeJS.ProcessEnv=process.env){
 if(env.NODE_ENV&&!['production','development','test'].includes(env.NODE_ENV))throw new Error('NODE_ENV must be production, development, or test');
 const production=env.NODE_ENV==='production';
 if(production&&!env.ALLOWED_ORIGINS?.trim())throw new Error('ALLOWED_ORIGINS is required in production');
 const origins=parseOrigins(env.ALLOWED_ORIGINS===undefined?LOCAL_ORIGINS:env.ALLOWED_ORIGINS.split(',').map(v=>v.trim()).filter(Boolean),production);
 return {production,port:integer(env,'PORT',2567,1,65535),host:env.HOST??'127.0.0.1',origins,
 allowOriginless:boolean(env,'ALLOW_ORIGINLESS',!production),ipUpgradeBurst:integer(env,'IP_UPGRADE_BURST',40,1,2048),ipCommandBurst:integer(env,'IP_ROOM_COMMAND_BURST',60,1,4096),maxConnectionsPerIp:integer(env,'MAX_CONNECTIONS_PER_IP',32,1,256),
 heartbeatMs:integer(env,'HEARTBEAT_MS',15000,1000,60000),handshakeMs:integer(env,'SESSION_TIMEOUT_MS',10000,1000,60000),
 shutdownMs:integer(env,'SHUTDOWN_MS',5000,100,30000),logIntervalMs:integer(env,'LOG_INTERVAL_MS',30000,1000,300000)};
}
