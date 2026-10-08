import {Field} from './engine-field.js';
// Reuse Spiral's presentation field itself, with a small task-list lifecycle adapter.
export function createField(canvas){
 const field=new Field(canvas,{strength:1,gap:18});
 let enabled=true,moving=true,pauseAt=null;
 function update(){field.stop();field.c.style.visibility=enabled?'visible':'hidden';if(!enabled)return;if(moving&&!document.hidden){if(pauseAt!==null){field.t0+=performance.now()-pauseAt;pauseAt=null}field.start()}else{if(pauseAt===null)pauseAt=performance.now();field.frame()}}
 document.addEventListener('visibilitychange',update);
 addEventListener('resize',()=>{if(!moving)field.frame()});
 return {
 set(s,color){field.background=s.background||'#000000';enabled=s.field;moving=s.motion;field.strength=s.backdrop==='paper'?.5:1;field.tint=s.accent==='yellow'||s.accent==='clay'?null:color;update()},
 pulse(kind='wipe',origin){if(!enabled||!moving||document.hidden)return;field.run({kind,ms:kind==='wipe'?2000:1250,originX:origin?.x??.16,originY:origin?.y??.84})},
 };
}
