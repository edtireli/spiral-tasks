import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../',import.meta.url));
const publicFiles=['index.html','style.css','app.js','model.js','field.js','engine-field.js','field-gpu.js','boot.js'];

export async function build({sourceDir=project,outputDir=join(project,'docs')}={}){
 const files=await Promise.all(publicFiles.map(async name=>[name,await readFile(join(sourceDir,name),'utf8')]));
 const version=createHash('sha256').update(JSON.stringify(files)).update(await readFile(new URL(import.meta.url))).digest('hex').slice(0,12);
 const assets=join(outputDir,'assets',version);
 await mkdir(assets,{recursive:true});
 // Keep earlier releases available for cached HTML and already-open tabs.
 // Every module in the graph shares this immutable release directory.
 for(const [name,content] of files)if(name!=='index.html')await writeFile(join(assets,name),content);
 const html=files.find(([name])=>name==='index.html')[1]
  .replace('<title>','<meta name="app-build" content="'+version+'">\n  <title>')
  .replace('href="./style.css"',`href="./assets/${version}/style.css"`)
  .replace('src="./app.js"',`src="./assets/${version}/boot.js"`)
  .replace('<div class="shell">','<div class="shell" inert>')
  .replace('id="new-task"','id="new-task" disabled')
  .replace('class="add-submit"','class="add-submit" disabled');
 await writeFile(join(outputDir,'index.html'),html);
 await writeFile(join(outputDir,'release.json'),JSON.stringify({version})+'\n');
 await writeFile(join(outputDir,'.nojekyll'),'');
 return version;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log('GitHub Pages output: docs/ · release '+await build());
}
