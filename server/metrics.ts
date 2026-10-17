import { performance,monitorEventLoopDelay } from 'node:perf_hooks';
export function distribution(values:number[]){if(!values.length)return {count:0,p50:0,p95:0,p99:0,max:0};const sorted=[...values].sort((a,b)=>a-b);return {count:values.length,p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.floor((sorted.length-1)*.95)],p99:sorted[Math.floor((sorted.length-1)*.99)],max:sorted.at(-1)!};}
export class Metrics{
 ticks:number[]=[];count=0;overBudget=0;droppedMs=0;snapshots=0;bytes=0;messages=0;rejected=0;heartbeatTimeouts=0;backpressure=0;
 private started=performance.now();private cpu=process.cpuUsage();private loop=monitorEventLoopDelay({resolution:20});
 constructor(){this.loop.enable();}
 tick(ms:number){this.count++;if(ms>1000/30)this.overBudget++;this.ticks[(this.count-1)%18000]=ms;}
 reset(){this.ticks=[];this.count=0;this.overBudget=0;this.droppedMs=0;this.snapshots=0;this.bytes=0;this.messages=0;this.rejected=0;this.heartbeatTimeouts=0;this.backpressure=0;this.started=performance.now();this.cpu=process.cpuUsage();this.loop.reset();}
 snapshot(){const elapsedMs=performance.now()-this.started,cpu=process.cpuUsage(this.cpu),memory=process.memoryUsage();return {elapsedMs,ticks:this.count,tickMs:distribution(this.ticks),overBudgetTicks:this.overBudget,droppedSimulationMs:this.droppedMs,snapshotDeliveries:this.snapshots,outboundBytes:this.bytes,inboundMessages:this.messages,rejected:this.rejected,heartbeatTimeouts:this.heartbeatTimeouts,backpressureDisconnects:this.backpressure,cpuPercentOfOneCore:(cpu.user+cpu.system)/Math.max(1,elapsedMs*10),rssMiB:memory.rss/1048576,peakRssLifetimeMiB:process.resourceUsage().maxRSS/1024,heapMiB:memory.heapUsed/1048576,eventLoopP99Ms:this.loop.percentile(99)/1e6};}
 stop(){this.loop.disable();}
}
