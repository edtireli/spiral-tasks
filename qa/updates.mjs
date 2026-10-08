import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {build} from '../scripts/build.mjs';
import {DEFAULT_SETTINGS,STORAGE_KEY} from '../model.js';

const root=await mkdtemp(join(tmpdir(),'spiral-update-test-'));
const output=join(root,'site');
const files=['index.html','style.css','app.js','model.js','field.js','engine-field.js','field-gpu.js','boot.js'];
const results=[],errors=[],requests=[];
const check=(name,ok=true)=>{assert.ok(ok,name);results.push(name)};
let browser,server,oldHTML,stale=false,alwaysStale=false,manifestFailure=false;
try{
 for(const file of files)await copyFile(new URL('../'+file,import.meta.url),join(root,file));
 const source=await readFile(join(root,'app.js'),'utf8');
 await writeFile(join(root,'app.js'),source+'\ndocument.documentElement.dataset.testRelease="one";\n');
 const first=await build({sourceDir:root,outputDir:output});
 oldHTML=await readFile(join(output,'index.html'));
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');requests.push(url.pathname+url.search);
  if(!url.pathname.startsWith('/spiral-tasks/')){res.writeHead(404).end();return}
  const name=url.pathname.slice('/spiral-tasks/'.length)||'index.html';
  if(name.includes('..')){res.writeHead(400).end();return}
  if(name==='release.json'&&manifestFailure){res.writeHead(503).end();return}
  try{
   const body=name==='index.html'&&stale&&(alwaysStale||!url.searchParams.has('_v'))?oldHTML:await readFile(join(output,name));
   const type={'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html'}[extname(name)]||'text/plain';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=3600'});res.end(body);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/spiral-tasks/`;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const ready=async()=>{await page.waitForFunction(()=>document.querySelector('.shell')?.inert===false&&document.querySelector('#progress')?.textContent.includes('/'))};
 await page.goto(url);await ready();
 const saved={version:1,settings:{...DEFAULT_SETTINGS,backdrop:'slate'},tasks:[
  {id:'parent',parent:null,text:'My saved project',done:false,important:true,collapsed:false,completedAt:0},
  {id:'child',parent:'parent',text:'Already finished step',done:true,important:false,collapsed:false,completedAt:123},
  {id:'next',parent:'parent',text:'Next step',done:false,important:false,collapsed:false,completedAt:0}
 ]};
 await page.evaluate(({key,state})=>localStorage.setItem(key,state),{key:STORAGE_KEY,state:JSON.stringify(saved)});
 await page.reload();await ready();
 check('First release loads and reads existing saved tasks',await page.locator('[data-id="child"] .check').getAttribute('aria-checked')==='true');
 const before=await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY);
 // Build a new module graph, but deliberately keep serving the old HTML at the normal URL.
 await writeFile(join(root,'app.js'),source+'\ndocument.documentElement.dataset.testRelease="two";\n');
 await writeFile(join(root,'model.js'),(await readFile(join(root,'model.js'),'utf8'))+'\n// New module revision.\n');
 const second=await build({sourceDir:root,outputDir:output});
 check('Changing an imported module creates a different release URL',first!==second);
 check('Cached release assets remain available',(await readFile(join(output,'assets',first,'app.js'),'utf8')).includes('testRelease="one"'));
 stale=true;requests.length=0;
 await page.reload();await page.waitForURL('**?_v='+second);await ready();
 check('Old cached HTML opens the latest release',await page.locator('html').getAttribute('data-test-release')==='two');
 check('Update preserves the saved list byte for byte',await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===before);
 check('Checked subtask remains under the saved parent',await page.locator('#tasks [data-id="parent"] > .children [data-id="child"].done').count()===1&&await page.locator('#done-tasks [data-id="child"]').count()===0);
 check('Saved appearance survives',await page.locator('meta[name="theme-color"]').getAttribute('content')==='#151b21');
 for(const name of ['app.js','model.js','field.js','engine-field.js','field-gpu.js','style.css'])check('Fresh release URL: '+name,requests.includes(`/spiral-tasks/assets/${second}/${name}`));
 check('Release check bypasses cached manifest',requests.some(path=>/release\.json\?check=\d+$/.test(path)));
 async function backup(){
  await page.getByRole('button',{name:'More options',exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();
  const download=await pending;check('Backup has a recognizable filename',download.suggestedFilename()==='spiral-tasks-backup.json');
  return JSON.parse(await readFile(await download.path(),'utf8'));
 }
 assert.deepEqual(await backup(),saved);check('Backup includes the complete tree and preferences');
 check('Downloading backup leaves stored data untouched',await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===before);
 await page.goto(url+'?example=1&theme=black');await page.waitForURL('**_v='+second);await ready();
 assert.deepEqual(await backup(),saved);check('Example-mode backup contains the real saved list');
 // A failed manifest request must not block use of the cached release or write to storage.
 manifestFailure=true;await page.goto(url);await ready();
 check('Failed update check still opens the available app',await page.locator('[data-id="parent"]').count()===1);
 check('Failed update check preserves data',await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===before);
 manifestFailure=false;alwaysStale=true;
 await page.goto(url+'?case=loop');await page.waitForURL('**&_v='+second);await ready();
 check('Stale HTML after redirect cannot cause a reload loop',await page.locator('html').getAttribute('data-test-release')==='one');
 check('Reload-loop fallback preserves data',await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEY)===before);
 check('No JavaScript errors',errors.length===0);
 const report={passed:results.length,results,errors};console.log(JSON.stringify(report,null,2));
 await writeFile(new URL('./update-results.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
}finally{
 await browser?.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(root,{recursive:true,force:true});
}
