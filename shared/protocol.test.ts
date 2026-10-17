import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand,idleInput } from './protocol';
test('protocol requires exact versioned intent schema',()=>{
 assert.ok(validateCommand({v:1,type:'create',name:'Pilot 7'}));
 for(const value of [{v:2,type:'start'},{v:1,type:'damage',amount:25},{v:1,type:'join',name:'A',code:'ABC123'},{v:1,type:'create',name:'<script>'},{v:1,type:'create',name:' A'},null,[]])assert.equal(validateCommand(value),false);
});
test('inputs reject forged positions, excessive axes, NaN, infinity and invalid sequence',()=>{
 const input=idleInput();assert.ok(validateCommand({v:1,type:'input',input}));
 for(const patch of [{position:{x:100}},{x:2},{yaw:Infinity},{pitch:NaN},{seq:-1},{seq:1.5},{fire:1},{yaw:10}])assert.equal(validateCommand({v:1,type:'input',input:{...input,...patch}}),false);
});

import { websocketUrl } from './websocket-url';
test('frontend endpoint config preserves local preview and single-player-safe errors',()=>{
 assert.equal(websocketUrl(undefined,{protocol:'http:',hostname:'localhost'},true).href,'ws://localhost:2567/');
 assert.equal(websocketUrl(undefined,{protocol:'http:',hostname:'[::1]'},false).href,'ws://[::1]:2567/');
 const page={protocol:'https:',hostname:'game.example'};
 assert.throws(()=>websocketUrl(undefined,page,true),/not configured/);
 for(const value of ['http://server.example','wss://user:pass@server.example','wss://server.example/#secret','ws://server.example'])assert.throws(()=>websocketUrl(value,page,true));
 assert.equal(websocketUrl('wss://server.example/socket',page,true).href,'wss://server.example/socket');
});
