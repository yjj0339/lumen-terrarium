import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const options={entryPoints:[path.join(root,'app.js')],bundle:true,format:'iife',minify:true,alias:{three:path.join(root,'vendor/three.module.js')},outfile:path.join(root,'bundle.js'),metafile:true,logLevel:'info'};
if(process.env.ESBUILD_BINARY_PATH){
  execFileSync(process.env.ESBUILD_BINARY_PATH,[options.entryPoints[0],'--bundle','--format=iife','--minify',`--alias:three=${options.alias.three.replaceAll('\\','/')}`,`--outfile=${options.outfile}`,`--metafile=${path.join(root,'tmp/build-meta.json')}`],{cwd:root,stdio:'inherit'});
}else{
  const {build}=await import('esbuild');const result=await build(options);fs.writeFileSync(path.join(root,'tmp/build-meta.json'),JSON.stringify(result.metafile));
}
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${fs.readFileSync(path.join(root,'style.css'),'utf8')}</style>`);
html=html.replace('<script src="bundle.js"></script>',()=>`<script>${fs.readFileSync(path.join(root,'bundle.js'),'utf8').replaceAll('</script','<\\/script')}</script>`);
fs.writeFileSync(path.join(root,'一方静谧-直接打开.html'),html);
console.log('Built offline HTML: '+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB');
