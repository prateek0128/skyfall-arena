import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {INITIAL_PLAYER_NAME,PlayerNameField} from './MultiplayerHUD';
test('new multiplayer player names start blank with neutral input guidance',()=>{
 assert.equal(INITIAL_PLAYER_NAME,'');
 const html=renderToStaticMarkup(createElement(PlayerNameField,{onChange:()=>{}}));
 assert.match(html,/value=""/);assert.match(html,/placeholder="Enter your name"/);
 assert.doesNotMatch(html,/value="Pilot"/);assert.match(html,/maxLength="18"/);assert.match(html,/autoComplete="nickname"/);
});
test('name field preserves explicit custom values and an explicitly cleared value',()=>{
 for(const name of ['Anika','Kai_7','']){
  const html=renderToStaticMarkup(createElement(PlayerNameField,{name,onChange:()=>{}}));
  assert.ok(html.includes(`value="${name}"`));
 }
});
