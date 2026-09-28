import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {AppError} from './store.mjs';
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const PUBLIC_FILES=new Set(['index.html','styles.css','graph.js','universe.js','app.js','icon.svg']);
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
async function body(req){
  if(!(req.headers['content-type']||'').startsWith('application/json'))throw new AppError(415,'Use application/json.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>2_000_000)throw new AppError(413,'The request is too large.');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError(400,'The request contains invalid JSON.');}
}
export function createApp(store,publicDir){
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
    try{
      const host=req.headers.host||'';
      if(!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host))throw new AppError(403,'This server accepts local requests only.');
      const url=new URL(req.url,'http://'+host);const path=url.pathname;const method=req.method;
      if(!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!=='http://'+host)throw new AppError(403,'Cross-origin changes are not allowed.');
      if(path==='/api/workspace'&&method==='GET')return json(res,200,store.snapshot());
      if(path==='/api/notes'&&method==='POST')return json(res,201,store.insert(await body(req)));
      const noteMatch=path.match(/^\/api\/notes\/([a-zA-Z0-9_-]+)$/);
      if(noteMatch&&method==='PUT')return json(res,200,store.update(noteMatch[1],await body(req)));
      if(noteMatch&&method==='DELETE'){const input=await body(req);store.delete(noteMatch[1],input.revision);return json(res,200,{ok:true});}
      if(path==='/api/links'&&method==='POST'){const input=await body(req);return json(res,201,store.connect(input.from,input.to));}
      const linkMatch=path.match(/^\/api\/links\/([a-zA-Z0-9_-]+)$/);
      if(linkMatch&&method==='DELETE'){store.disconnect(linkMatch[1]);return json(res,200,{ok:true});}
      if(path==='/api/import'&&method==='POST')return json(res,201,store.import(await body(req)));
      if(path.startsWith('/api/'))throw new AppError(404,'API route not found.');
      if(!['GET','HEAD'].includes(method))throw new AppError(405,'Method not allowed.');
      const file=path==='/'?'index.html':path.slice(1);if(!PUBLIC_FILES.has(file))throw new AppError(404,'File not found.');
      const data=await readFile(resolve(publicDir,file));res.writeHead(200,{'Content-Type':TYPES[extname(file)],'Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:data);
    }catch(error){const status=error.status||((error instanceof TypeError||error.message?.includes('SQLITE'))?500:400);if(status===500)console.error(error);json(res,status,{error:status===500?'An internal error occurred.':error.message});}
  });
}
