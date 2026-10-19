import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),port=Number(process.env.PORT||4207);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({name:'lumen-terrarium',status:'ok'}));return;}
    if(url.pathname==='/api/capture'&&req.method==='POST'){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>24*1024*1024){res.writeHead(413);res.end();return;}chunks.push(chunk);}const {image}=JSON.parse(Buffer.concat(chunks));if(typeof image!=='string'||!image.startsWith('data:image/png;base64,')){res.writeHead(400);res.end();return;}
      const name='Lumen-'+new Date().toISOString().replace(/[:.]/g,'-')+'.png';fs.mkdirSync(path.join(root,'exports'),{recursive:true});fs.writeFileSync(path.join(root,'exports',name),Buffer.from(image.split(',')[1],'base64'));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({name}));return;
    }
    const p=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);
  }catch(e){res.writeHead(500);res.end('Unable to process request');}
}).listen(port,'127.0.0.1',()=>console.log(`Lumen terrarium: http://127.0.0.1:${port}`));
