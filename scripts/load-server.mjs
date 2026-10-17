// Dedicated compiled server process. Metrics never require a public HTTP endpoint.
import { startServer } from '../dist-server/server/app.js';
const server=await startServer({port:0,origins:['http://load.invalid'],allowOriginless:false,countdownSeconds:.1,matchSeconds:600,
 maxConnectionsPerIp:256,ipCommandBurst:4096,ipUpgradeBurst:512});
process.send?.({type:'listening',port:server.port});
process.on('message',async message=>{
 if(message.type==='reset'){server.metrics.reset();process.send?.({type:'reset'});}
 if(message.type==='metrics')process.send?.({type:'metrics',metrics:server.metrics.snapshot(),rooms:server.rooms.rooms.size,connections:server.wss.clients.size});
 if(message.type==='stop'){await server.close();process.exit(0);}
});
process.on('disconnect',()=>{void server.close().then(()=>process.exit(0));});
