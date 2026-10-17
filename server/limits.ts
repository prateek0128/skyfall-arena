/** Token buckets prevent window-boundary bursts. Monotonic milliseconds only. */
export class Bucket{
 tokens:number;at:number;
 constructor(readonly capacity:number,readonly perSecond:number,now:number){this.tokens=capacity;this.at=now;}
 take(now:number){this.tokens=Math.min(this.capacity,this.tokens+Math.max(0,now-this.at)*this.perSecond/1000);this.at=now;if(this.tokens<1)return false;this.tokens--;return true;}
}
export class IpLimits{
 private entries=new Map<string,{connections:number;last:number;upgrade:Bucket;commands:Bucket}>();
 constructor(readonly maxConnections=32,readonly commandBurst=60,readonly upgradeBurst=40){}
 private entry(ip:string,now:number){let e=this.entries.get(ip);if(!e){if(this.entries.size>=4096)this.sweep(now);if(this.entries.size>=4096)return; e={connections:0,last:now,upgrade:new Bucket(this.upgradeBurst,2,now),commands:new Bucket(this.commandBurst,10,now)};this.entries.set(ip,e);}e.last=now;return e;}
 upgrade(ip:string,now:number){const e=this.entry(ip,now);return !!e&&e.connections<this.maxConnections&&e.upgrade.take(now);}
 connected(ip:string,now:number){const e=this.entry(ip,now);if(e)e.connections++;}
 disconnected(ip:string){const e=this.entries.get(ip);if(e)e.connections=Math.max(0,e.connections-1);}
 command(ip:string,now:number){return this.entry(ip,now)?.commands.take(now)??false;}
 sweep(now:number){for(const [ip,e] of this.entries)if(!e.connections&&now-e.last>60000)this.entries.delete(ip);}
}
