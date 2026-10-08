import {mkdir,copyFile,writeFile} from 'node:fs/promises';
// Only public application assets are included in the Pages output.
await mkdir('docs',{recursive:true});
for(const file of ['index.html','style.css','app.js','model.js','field.js','engine-field.js'])await copyFile(file,`docs/${file}`);
await writeFile('docs/.nojekyll','');
console.log('GitHub Pages output: docs/');
