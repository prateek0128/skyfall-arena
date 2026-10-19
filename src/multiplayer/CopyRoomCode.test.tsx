import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CopyRoomCode} from './CopyRoomCode';
import {copyRoomCode} from './clipboard';
test('copy writes the exact current code and preserves clipboard method binding',async()=>{
 const clipboard={value:'',async writeText(value:string){this.value=value;}};
 assert.equal(await copyRoomCode('399ZJG',clipboard),true);assert.equal(clipboard.value,'399ZJG');
 assert.equal(await copyRoomCode('NEXT42',clipboard),true);assert.equal(clipboard.value,'NEXT42');
});
test('missing clipboard and denied/rejected writes fail gracefully and can be retried',async()=>{
 assert.equal(await copyRoomCode('399ZJG',undefined),false);
 assert.equal(await copyRoomCode('399ZJG',{writeText(){throw new Error('Denied');}}),false);
 assert.equal(await copyRoomCode('399ZJG',{writeText:async()=>{throw new Error('NotAllowedError');}}),false);
 assert.equal(await copyRoomCode('399ZJG',{writeText:async()=>{}}),true);
});
test('copy control is a labelled keyboard button with decorative SVG and polite feedback',()=>{
 const html=renderToStaticMarkup(createElement(CopyRoomCode,{code:'399ZJG'}));
 assert.match(html,/<button type="button"[^>]*aria-label="Copy room code"/);assert.match(html,/<svg[^>]*aria-hidden="true"/);assert.match(html,/role="status" aria-live="polite"/);
});
