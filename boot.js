// A cached page can discover a new release without touching browser storage.
// Runs before the interface is editable; never reloads an in-progress list.
const current=document.querySelector('meta[name="app-build"]')?.content;
let redirect=false;
try{
 const manifest=new URL('../../release.json',import.meta.url);
 manifest.searchParams.set('check',Date.now());
 const response=await fetch(manifest,{cache:'no-store',signal:AbortSignal.timeout(3000)});
 if(response.ok){
  const {version}=await response.json();
  const url=new URL(location.href);
  if(/^[a-f0-9]{12}$/.test(version)&&version!==current&&url.searchParams.get('_v')!==version){
   url.searchParams.set('_v',version);
   redirect=true;
   location.replace(url);
  }
 }
}catch{
 // A failed update check still opens the available release and saved list.
}
if(!redirect){
 try{
  await import('./app.js');
  document.querySelector('#new-task').disabled=false;
  document.querySelector('.add-submit').disabled=false;
  document.querySelector('.shell').inert=false;
 }catch(error){
  document.querySelector('#footer-state').textContent='Couldn’t load the app. Reload to try again. Your saved list hasn’t been cleared.';
  console.error(error);
 }
}
