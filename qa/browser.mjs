import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const origin=process.env.TEST_URL||'http://127.0.0.1:8873/';
const errors=[],results=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
const read=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('spiral-tasks:v1')));
const add=async text=>{await p.getByRole('textbox',{name:'New task',exact:true}).fill(text);await p.getByRole('textbox',{name:'New task',exact:true}).press('Enter')};
const check=(name,pass=true)=>{assert.ok(pass,name);results.push(name)};
try{
await p.goto(origin);await p.getByText('A clear page.',{exact:true}).waitFor();
await add('Write a real task');await add('Second task');check('Create tasks',(await read()).tasks.length===2);
await p.getByRole('button',{name:'Edit Write a real task',exact:true}).click();await p.getByRole('textbox',{name:'Edit task',exact:true}).fill('Revised task');await p.getByRole('textbox',{name:'Edit task',exact:true}).press('Enter');check('Edit task',(await read()).tasks[0].text==='Revised task');
let first=(await read()).tasks[0].id;
await p.locator(`[data-id="${first}"] .task-row`).hover();await p.locator(`[data-id="${first}"] [data-action=branch]`).click();await p.getByRole('textbox',{name:'New branch',exact:true}).fill('Child task');await p.getByRole('textbox',{name:'New branch',exact:true}).press('Enter');check('Branch task',(await read()).tasks.find(t=>t.text==='Child task').parent===first);
await p.locator(`[data-id="${first}"] > .task-row`).hover();await p.locator(`[data-id="${first}"] > .task-row [data-action=highlight]`).click();check('Highlight task',(await read()).tasks[0].important);
await p.getByRole('checkbox',{name:'Complete Child task',exact:true}).click();check('Completed child stays checked under its parent',await p.locator(`#tasks [data-id="${first}"] .children`).getByRole('checkbox',{name:'Reopen Child task',exact:true}).count()===1&&await p.locator('#done-tasks .task').count()===0);
await p.getByRole('button',{name:'Undo',exact:true}).first().click();check('Undo completion',!(await read()).tasks.find(t=>t.text==='Child task').done);
await p.getByRole('checkbox',{name:'Complete Revised task',exact:true}).click();check('Completing parent completes branches',(await read()).tasks.filter(t=>t.parent===first||t.id===first).every(t=>t.done));
await p.getByRole('checkbox',{name:'Reopen Child task',exact:true}).click();check('Reopening child reopens parent',!(await read()).tasks.find(t=>t.id===first).done);
await p.reload();check('Reload persists tasks',(await read()).tasks.length===3&&await p.getByRole('button',{name:'Edit Revised task',exact:true}).count()===1);
// Keyboard reorder and branch.
let second=(await read()).tasks.find(t=>t.text==='Second task').id;
await p.locator(`[data-id="${second}"] .drag-handle`).focus();await p.keyboard.press('Alt+ArrowUp');check('Keyboard reorder',(await read()).tasks[0].id===second);
await p.keyboard.press('Alt+ArrowDown');await p.keyboard.press('Alt+ArrowRight');check('Keyboard indent',(await read()).tasks.find(t=>t.id===second).parent===first);await p.keyboard.press('Alt+ArrowLeft');check('Keyboard outdent',(await read()).tasks.find(t=>t.id===second).parent===null);
// Mouse drag above first sibling.
await p.locator(`[data-id="${second}"] > .task-row`).hover();let a=await p.locator(`[data-id="${second}"] > .task-row .drag-handle`).boundingBox(),b=await p.locator(`[data-id="${first}"] > .task-row`).boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+8,b.y+4,{steps:10});await p.mouse.up();check('Pointer drag reorders siblings',(await read()).tasks.filter(t=>!t.parent)[0].id===second);
// Drag horizontally into another task.
a=await p.locator(`[data-id="${second}"] > .task-row .drag-handle`).boundingBox();b=await p.locator(`[data-id="${first}"] > .task-row`).boundingBox();await p.mouse.move(a.x+a.width/2,a.y+a.height/2);await p.mouse.down();await p.mouse.move(b.x+180,b.y+b.height/2,{steps:10});await p.mouse.up();check('Pointer drag creates branch',(await read()).tasks.find(t=>t.id===second).parent===first);
// Literal text, no HTML execution.
await add('<img src=x onerror=alert(1)>');check('User text stays literal',await p.locator('#tasks img').count()===0&&(await read()).tasks.some(t=>t.text==='<img src=x onerror=alert(1)>'));
await p.getByRole('button',{name:'Appearance',exact:true}).click();await p.getByRole('button',{name:'Clay',exact:true}).click();await p.getByRole('button',{name:'Close appearance',exact:true}).click();await p.reload();check('Palette persists',(await read()).settings.backdrop==='warm');
const saved=JSON.stringify(await read());await p.getByRole('button',{name:'More options',exact:true}).click();await p.getByRole('button',{name:'Try an example',exact:true}).click();await p.getByRole('checkbox',{name:'Complete Take the long way home',exact:true}).click();check('Example cannot change real list',JSON.stringify(await read())===saved);await p.getByRole('button',{name:'Use my own list',exact:true}).click();check('Return from example restores list',JSON.stringify(await read())===saved);
await p.getByRole('button',{name:'More options',exact:true}).click();await p.getByRole('button',{name:'Clear all',exact:true}).click();check('Clear all',(await read()).tasks.length===0);await p.locator('#toast button').click();check('Undo clear restores tree',(await read()).tasks.length===4&&(await read()).tasks.find(t=>t.id===second).parent===first);
const p2=await context.newPage();await p2.goto(origin);await add('Synced from another tab');await p2.getByRole('button',{name:'Edit Synced from another tab',exact:true}).waitFor();check('Other tabs receive changes');await p2.close();
for(const width of [320,390,768,1440]){await p.setViewportSize({width,height:900});await p.goto(origin+'?example=1');check(`No horizontal overflow at ${width}px`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.getByRole('button',{name:'Appearance',exact:true}).click();check(`Appearance fits at ${width}px`,await p.locator('dialog[open]').evaluate(el=>{const b=el.getBoundingClientRect();return b.x>=0&&b.right<=innerWidth}));await p.getByRole('button',{name:'Close appearance',exact:true}).click()}
await p.setViewportSize({width:1440,height:1000});await p.emulateMedia({reducedMotion:'no-preference'});await p.goto(origin+'?example=1&theme=black');await p.waitForTimeout(3000);await p.screenshot({path:'qa/after-hours.png',fullPage:true});
const before=await p.screenshot();await p.waitForTimeout(180);const after=await p.screenshot();check('Actual background continuously moves',!before.equals(after));
await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.body.dataset.motion==='off');const frozen=await p.screenshot();await p.waitForTimeout(180);check('Reduced motion freezes field',frozen.equals(await p.screenshot()));
await p.goto(origin+'?example=1&theme=clay');await p.screenshot({path:'qa/clay.png',fullPage:true});await p.goto(origin+'?example=1&theme=paper');await p.screenshot({path:'qa/paper.png',fullPage:true});await p.setViewportSize({width:390,height:844});await p.goto(origin+'?example=1&theme=black');await p.screenshot({path:'qa/mobile.png',fullPage:true});
// Checked subtasks stay in their tree; only whole finished trees can be cleared.
const gc=await browser.newContext({reducedMotion:'reduce'});const gp=await gc.newPage();await gp.goto(origin+'?example=1&theme=black');
await gp.getByRole('checkbox',{name:'Complete Collect the things that spark something',exact:true}).click();
check('Checked step retains its original position',await gp.locator('#tasks [data-id="a"] > .children > .task').evaluateAll(els=>els.map(e=>e.dataset.id).join(','))==='a1,a2');
check('Done section excludes checked steps in unfinished tasks',await gp.locator('#done-tasks .task').count()===1&&await gp.locator('#done-count').innerText()==='01');
check('Progress counts checked steps in unfinished tasks',await gp.locator('#progress').innerText()==='3 / 8');
await gp.locator('#clear-done').click();
check('Clear completed preserves checked steps',await gp.locator('#tasks .task.done').count()===2&&await gp.locator('#done-tasks .task').count()===0);
await gp.locator('#undo').click();check('Undo clear restores completed trees',await gp.locator('#done-tasks [data-id="d"]').count()===1);
await gp.getByRole('checkbox',{name:'Complete Make a small, imperfect first version',exact:true}).click();
check('Last checked step waits for parent completion',await gp.locator('#tasks [data-id="a"] > .children > .task.done').count()===2&&await gp.locator('#done-tasks [data-id="a"]').count()===0);
await gp.getByRole('checkbox',{name:'Complete Give the next idea some room',exact:true}).click();
check('Whole finished tree moves together',await gp.locator('#done-tasks [data-id="a"] > .children > .task.done').count()===2&&await gp.locator('#tasks [data-id="a"]').count()===0);
await gp.getByRole('button',{name:'Collapse branches of Give the next idea some room',exact:true}).click();
check('Completed tree can collapse',await gp.locator('#done-tasks [data-id="a"] .children').count()===0);
await gp.getByRole('button',{name:'Expand branches of Give the next idea some room',exact:true}).click();
await gp.getByRole('checkbox',{name:'Reopen Collect the things that spark something',exact:true}).click();
check('Reopening a step brings back the whole tree',await gp.locator('#tasks [data-id="a"] > .children > .task').count()===2&&await gp.locator('#tasks [data-id="a2"].done').count()===1&&await gp.locator('#done-tasks [data-id="a"]').count()===0);
await gc.close();
// Real touch events exercise drag handles, not HTML drag-and-drop.
const touchContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const tp=await touchContext.newPage();await tp.goto(origin);for(const text of ['Touch one','Touch two']){await tp.locator('#new-task').fill(text);await tp.locator('#new-task').press('Enter')}
const t=await tp.evaluate(()=>JSON.parse(localStorage.getItem('spiral-tasks:v1')).tasks);a=await tp.locator(`[data-id="${t[1].id}"] .drag-handle`).boundingBox();b=await tp.locator(`[data-id="${t[0].id}"] .task-row`).boundingBox();const cdp=await touchContext.newCDPSession(tp);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2+(b.x+8-a.x-a.width/2)*i/8,y:a.y+a.height/2+(b.y+4-a.y-a.height/2)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check('Touch drag reorders tasks',await tp.evaluate(id=>JSON.parse(localStorage.getItem('spiral-tasks:v1')).tasks[0].id===id,t[1].id));await touchContext.close();
// Corrupt persisted data remains untouched.
const bad=await browser.newContext();const bp=await bad.newPage();await bp.goto(origin);await bp.evaluate(()=>localStorage.setItem('spiral-tasks:v1','not valid'));await bp.reload();await bp.locator('#new-task').fill('Temporary');await bp.locator('#new-task').press('Enter');check('Corrupt storage is not overwritten',await bp.evaluate(()=>localStorage.getItem('spiral-tasks:v1'))==='not valid');check('Storage failure is visible',await bp.locator('#footer-state').innerText()==='Storage unavailable. This list is temporary.');await bad.close();
// Exercise browser-tool registration and validation through a simulated registry.
const mc=await browser.newContext();const mp=await mc.newPage();await mp.addInitScript(()=>{window.registeredTools={};Object.defineProperty(document,'modelContext',{value:{registerTool(tool){window.registeredTools[tool.name]=tool}}})});await mp.goto(origin);
await mp.waitForFunction(()=>Object.keys(registeredTools).length===3);
check('Browser tools register',await mp.evaluate(()=>Object.keys(registeredTools).length)===3);
const toolResult=await mp.evaluate(async()=>{const added=await registeredTools.add_tasks.execute({texts:['Tool task']});let rejected=false;try{await registeredTools.add_tasks.execute({texts:['']})}catch{rejected=true}await registeredTools.set_tasks_completed.execute({ids:added.ids,completed:true});return {rejected,tasks:registeredTools.list_tasks.execute().tasks}});check('Browser tools update UI and reject invalid input',toolResult.rejected&&toolResult.tasks.length===1&&toolResult.tasks[0].done);check('Browser tool result is visible',await mp.getByRole('checkbox',{name:'Reopen Tool task',exact:true}).count()===1);await mc.close();
check('No JavaScript errors',errors.length===0);
console.log(JSON.stringify({passed:results.length,results,errors},null,2));fs.writeFileSync('qa/browser-results.json',JSON.stringify({passed:results.length,results,errors},null,2));
}catch(e){console.error(e);console.log('Passed so far:',results);await p.screenshot({path:'qa/failure.png',fullPage:true});process.exitCode=1}finally{await browser.close()}
