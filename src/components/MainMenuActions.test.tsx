import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MainMenuActions} from './MainMenuActions';
test('main menu offers both modes without starting a session during render',()=>{
 let launches=0;
 const html=renderToStaticMarkup(createElement(MainMenuActions,{loaded:true,onSinglePlayer:()=>launches++,onMultiplayer:()=>launches++}));
 assert.match(html,/>SINGLE PLAYER</);assert.match(html,/>MULTIPLAYER</);
 assert.equal((html.match(/<button/g)??[]).length,2);assert.doesNotMatch(html,/disabled/);assert.equal(launches,0);
});
test('arena loading disables solo launch while keeping the multiplayer menu accessible',()=>{
 const html=renderToStaticMarkup(createElement(MainMenuActions,{loaded:false,onSinglePlayer:()=>{},onMultiplayer:()=>{}}));
 assert.match(html,/<button class="launch" disabled="">SINGLE PLAYER · LOADING…/);
 assert.match(html,/<button class="launch">MULTIPLAYER/);
});

test('both primary buttons retain their navigation callbacks and matching style',()=>{
 const actions:string[]=[];
 const element=MainMenuActions({loaded:true,onSinglePlayer:()=>actions.push('solo'),onMultiplayer:()=>actions.push('multiplayer')});
 assert.equal(element.props.className,'main-menu-actions');
 const buttons=element.props.children;
 assert.equal(buttons[0].props.className,'launch');assert.equal(buttons[1].props.className,'launch');
 buttons[0].props.onClick();assert.deepEqual(actions,['solo']);
 buttons[1].props.onClick();assert.deepEqual(actions,['solo','multiplayer']);
 const html=renderToStaticMarkup(element);
 assert.equal((html.match(/<span>↗<\/span>/g)??[]).length,2);
 assert.doesNotMatch(html,/PRIVATE ROOMS/);
});
