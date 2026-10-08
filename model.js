export const STORAGE_KEY='spiral-tasks:v1';
export const DEFAULT_SETTINGS={accent:'yellow',backdrop:'black',field:true,motion:true};
export const uid=()=>globalThis.crypto?.randomUUID?.()||`t${Date.now()}${Math.random().toString(36).slice(2)}`;
export function example(){return [
{id:'a',parent:null,text:'Give the next idea some room',done:false,important:true,collapsed:false},
{id:'a1',parent:'a',text:'Collect the things that spark something',done:false,important:false,collapsed:false},
{id:'a2',parent:'a',text:'Make a small, imperfect first version',done:false,important:false,collapsed:false},
{id:'b',parent:null,text:'Finish the first draft',done:false,important:true,collapsed:false},
{id:'b1',parent:'b',text:'Find the opening',done:true,important:false,collapsed:false},
{id:'b2',parent:'b',text:'Cut what doesn’t belong',done:false,important:false,collapsed:false},
{id:'c',parent:null,text:'Take the long way home',done:false,important:false,collapsed:false},
{id:'d',parent:null,text:'Leave a little space for tomorrow',done:true,important:false,collapsed:false}
]}
export function descendants(tasks,id){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const t of tasks)if(found.has(t.parent)&&!found.has(t.id)){found.add(t.id);changed=true}}return found}
export function ancestors(tasks,id){const out=[];let t=tasks.find(t=>t.id===id);while(t?.parent){t=tasks.find(x=>x.id===t.parent);if(!t||out.includes(t))break;out.push(t)}return out}
export function setDone(tasks,id,value){const t=tasks.find(t=>t.id===id);if(!t)return;if(value){const ids=descendants(tasks,id);tasks.forEach(t=>{if(ids.has(t.id)){t.done=true;t.completedAt=Date.now()}})}else{t.done=false;delete t.completedAt;ancestors(tasks,id).forEach(p=>{p.done=false;delete p.completedAt})}}
export function moveTask(tasks,id,targetId,mode){const t=tasks.find(t=>t.id===id),target=tasks.find(t=>t.id===targetId);if(!t||!target||t.done||target.done||descendants(tasks,id).has(targetId))return false;const parent=mode==='inside'?targetId:target.parent;const depth=parent?ancestors(tasks,parent).length+1:0;const subtree=descendants(tasks,id);const subtreeDepth=Math.max(...tasks.filter(x=>subtree.has(x.id)).map(x=>ancestors(tasks,x.id).length-ancestors(tasks,id).length));if(depth+subtreeDepth>5)return false;t.parent=parent;if(parent)tasks.find(x=>x.id===parent).collapsed=false;tasks.splice(tasks.indexOf(t),1);let index=tasks.findIndex(x=>x.id===targetId);tasks.splice(index+(mode==='before'?0:1),0,t);return true}
export function validateState(raw){if(!raw||raw.version!==1||!Array.isArray(raw.tasks)||raw.tasks.length>10000)throw Error('Unrecognized saved list');const ids=new Set();for(const t of raw.tasks){if(!t||typeof t.id!=='string'||ids.has(t.id)||typeof t.text!=='string'||!t.text.trim()||t.text.length>500||typeof t.done!=='boolean'||(t.parent!==null&&typeof t.parent!=='string'))throw Error('Invalid task');ids.add(t.id)}const tasks=raw.tasks.map(t=>({id:t.id,parent:t.parent,text:t.text,done:t.done,important:!!t.important,collapsed:!!t.collapsed,completedAt:Number(t.completedAt)||0}));for(const t of tasks){if(t.parent&&!ids.has(t.parent))throw Error('Missing branch');const seen=new Set([t.id]);let p=t;while(p.parent){if(seen.has(p.parent))throw Error('Circular branch');seen.add(p.parent);p=tasks.find(x=>x.id===p.parent)}if(seen.size>6)throw Error('Branch too deep')}
for(const t of tasks)if(!t.done)ancestors(tasks,t.id).forEach(p=>p.done=false);
const settings={...DEFAULT_SETTINGS};if(['yellow','clay','emerald','cyan','violet','rose','mono'].includes(raw.settings?.accent))settings.accent=raw.settings.accent;if(['black','warm','slate','moss','paper'].includes(raw.settings?.backdrop))settings.backdrop=raw.settings.backdrop;for(const k of ['field','motion'])if(typeof raw.settings?.[k]==='boolean')settings[k]=raw.settings[k];return {version:1,tasks,settings}}
