// Isolated example-only benchmark; not shipped in docs/.
const params=new URL(parent.location.href).searchParams;
const {Field}=await import(params.has('baseline')?'./perf-baseline/engine-field.js':'../engine-field.js');
const original=Field.prototype.frame;
if(params.has('composite')){const style=document.createElement('style');style.textContent='#field{transform:translateZ(0);contain:strict}main:before{filter:none!important;background:radial-gradient(ellipse at 50% 45%,var(--page) 45%,transparent 74%);opacity:.9}dialog::backdrop{backdrop-filter:none}.task.enter{filter:none!important}';document.head.append(style)}
const costs=[],intervals=[];let last=0,record=false;
Field.prototype.frame=function(...args){const start=performance.now();const result=params.has('fieldoff')?undefined:original.apply(this,args);if(record)costs.push(performance.now()-start);return result};
const started=performance.now();
function sample(now){if(now-started>1600)record=true;if(record){if(last)intervals.push(now-last);last=now;if(intervals.length===30){document.querySelector('[aria-label="Complete Finish the first draft"]').click()}if(intervals.length===120){document.querySelector('#undo').click()}}
if(now-started<8000){requestAnimationFrame(sample);return}
function stats(a){a.sort((a,b)=>a-b);return {samples:a.length,medianMs:+a[Math.floor(a.length*.5)]?.toFixed(2),p95Ms:+a[Math.floor(a.length*.95)]?.toFixed(2),maxMs:+a.at(-1)?.toFixed(2),totalMs:+a.reduce((x,y)=>x+y,0).toFixed(2)}}
parent.postMessage({type:'profile',version:params.has('fieldoff')?'no-field':params.has('composite')?'compositing-only':params.has('baseline')?'baseline':'optimized',viewport:[innerWidth,innerHeight],frameWork:stats(costs),displayFrames:stats(intervals),over34ms:intervals.filter(x=>x>34).length,over50ms:intervals.filter(x=>x>50).length,slowFrames:intervals.filter(x=>x>34).map(x=>+x.toFixed(1))},location.origin)
}
requestAnimationFrame(sample);
