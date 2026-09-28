import {readFile,writeFile} from 'node:fs/promises';
import {Script} from 'node:vm';
const read=path=>readFile(new URL(path,import.meta.url),'utf8');
let html=await read('./public/index.html');
const css=await read('./public/styles.css');
const sources=await Promise.all(['graph.js','universe.js','app.js'].map(name=>read('./public/'+name)));
const js='(function(){\n'+sources.map(source=>source.replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')).join('\n')+'\n})();';
new Script(js); // Fail the build rather than shipping an invalid bundle.
html=html.replace(/<style id="atlas-styles">[\s\S]*?<\/style>/,()=>'<style id="atlas-styles">\n'+css+'\n</style>');
html=html.replace(/<script id="atlas-app">[\s\S]*?<\/script>/,()=>'<script id="atlas-app">\n'+js.replace(/<\/script/gi,'<\\/script')+'\n</script>');
await writeFile(new URL('./public/index.html',import.meta.url),html);
console.log('Built self-contained Atlas preview.');
