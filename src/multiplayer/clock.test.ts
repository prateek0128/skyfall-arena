import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatMatchTime} from './clock';
test('fractional multiplayer countdown never renders sixty seconds',()=>{
 for(const [seconds,label] of [[120,'2:00'],[119.99,'2:00'],[119,'1:59'],[60.01,'1:01'],[60,'1:00'],[59.99,'1:00'],[.01,'0:01'],[0,'0:00']] as const)assert.equal(formatMatchTime(seconds),label);
});
