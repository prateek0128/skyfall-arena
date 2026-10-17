import { startServer } from './app.js';
import { loadConfig } from './config.js';
try{
 const config=loadConfig();
 const server=await startServer({...config,logger:event=>console.log(JSON.stringify(event))});
 for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void server.close().then(()=>process.exit(0),()=>process.exit(1));});
}catch(error){console.error(JSON.stringify({time:new Date().toISOString(),event:'startup_failure',error:error instanceof Error?error.message:'unknown'}));process.exitCode=1;}
