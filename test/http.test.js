import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Store} from '../lib/store.mjs';
import {createApp} from '../lib/http.mjs';
test('API validates mutations, enforces origins, and serves the self-contained app',async()=>{
  const store=new Store(':memory:',{seed:false}),server=createApp(store,fileURLToPath(new URL('../public/',import.meta.url)));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  try{
    const html=await fetch(base).then(r=>r.text());assert.match(html,/atlas-app/);assert.match(html,/atlas-styles/);
    const create=await fetch(base+'/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'API note',body:'Stored',kind:'project',tags:[],x:0,y:0})});assert.equal(create.status,201);const note=await create.json();
    const snapshot=await fetch(base+'/api/workspace').then(r=>r.json());assert.equal(snapshot.notes[0].id,note.id);
    const stale=await fetch(base+'/api/notes/'+note.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Stale',revision:0})});assert.equal(stale.status,409);
    const cross=await fetch(base+'/api/notes',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
    const invalid=await fetch(base+'/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'});assert.equal(invalid.status,400);
    assert.equal((await fetch(base+'/server.mjs')).status,404);assert.equal((await fetch(base+'/data/atlas.sqlite')).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
