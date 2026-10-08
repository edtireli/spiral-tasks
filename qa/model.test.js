import test from 'node:test';
import assert from 'node:assert/strict';
import {example,descendants,setDone,moveTask,completedTaskIds,validateState,DEFAULT_SETTINGS} from '../model.js';
const state=tasks=>({version:1,tasks,settings:DEFAULT_SETTINGS});
test('completing a tree and reopening a child preserve ancestor invariants',()=>{const tasks=example();setDone(tasks,'a',true);assert.ok(tasks.filter(t=>descendants(tasks,'a').has(t.id)).every(t=>t.done));setDone(tasks,'a2',false);assert.equal(tasks.find(t=>t.id==='a').done,false);assert.equal(tasks.find(t=>t.id==='a1').done,true)});
test('drag can reparent, order siblings, and outdent without losing children',()=>{const tasks=example();assert.equal(moveTask(tasks,'b','a','inside'),true);assert.equal(tasks.find(t=>t.id==='b').parent,'a');assert.equal(tasks.find(t=>t.id==='b2').parent,'b');assert.equal(moveTask(tasks,'b','a','after'),true);assert.equal(tasks.find(t=>t.id==='b').parent,null);assert.ok(tasks.indexOf(tasks.find(t=>t.id==='b'))>tasks.indexOf(tasks.find(t=>t.id==='a')))});
test('drag rejects a cycle and a completed target',()=>{const tasks=example(),before=JSON.stringify(tasks);assert.equal(moveTask(tasks,'a','a1','inside'),false);assert.equal(moveTask(tasks,'c','d','inside'),false);assert.equal(JSON.stringify(tasks),before)});
test('saved trees reject duplicates, missing parents and cycles',()=>{let tasks=example();assert.throws(()=>validateState(state([...tasks,tasks[0]])));tasks=example();tasks[0].parent='missing';assert.throws(()=>validateState(state(tasks)));tasks=example();tasks[0].parent='a1';assert.throws(()=>validateState(state(tasks)))});
test('saved titles remain literal and unknown preferences are discarded',()=>{const tasks=example();tasks[0].text='<img src=x onerror=alert(1)>';const s=validateState({...state(tasks),settings:{accent:'url(bad)',backdrop:'bad'}});assert.equal(s.tasks[0].text,tasks[0].text);assert.deepEqual(s.settings,DEFAULT_SETTINGS)});
test('over-deep moves are rejected for the entire moved subtree',()=>{const tasks=Array.from({length:6},(_,i)=>({id:String(i),parent:i?String(i-1):null,text:'Depth '+i,done:false}));tasks.push({id:'x',parent:null,text:'X',done:false},{id:'y',parent:'x',text:'Y',done:false});const before=JSON.stringify(tasks);assert.equal(moveTask(tasks,'x','5','inside'),false);assert.equal(JSON.stringify(tasks),before)});

test('only finished top-level trees enter completed, including nested branches',()=>{
 const tasks=example();tasks.push({id:'deep',parent:'a1',text:'Nested step',done:false});
 setDone(tasks,'a1',true);setDone(tasks,'a2',true);
 assert.deepEqual([...completedTaskIds(tasks)],['d']);
 assert.equal(tasks.find(t=>t.id==='a').done,false);
 setDone(tasks,'a',true);const completed=completedTaskIds(tasks);
 assert.deepEqual([...completed].sort(),['a','a1','a2','d','deep']);
 const remaining=tasks.filter(t=>!completed.has(t.id));
 assert.ok(remaining.some(t=>t.id==='b1'&&t.done&&t.parent==='b'));
 setDone(tasks,'deep',false);
 assert.deepEqual([...completedTaskIds(tasks)],['d']);
 assert.ok(tasks.find(t=>t.id==='a2').done);
});
