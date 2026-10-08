import {chromium} from 'playwright';
import fs from 'node:fs';
fs.mkdirSync('qa/frames',{recursive:true});
const b=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const p=await b.newPage({viewport:{width:1120,height:920}});
await p.goto('http://127.0.0.1:8873/?example=1');await p.waitForTimeout(2400);
for(let i=0;i<44;i++){
 if(i===12)await p.getByRole('checkbox',{name:'Complete Finish the first draft',exact:true}).click();
 if(i===30)await p.locator('#undo').click();
 await p.mouse.move(1100,880);
 await p.screenshot({path:`qa/frames/${String(i).padStart(3,'0')}.png`});
 await p.waitForTimeout(90);
}
await b.close();
