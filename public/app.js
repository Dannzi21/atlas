import {KINDS,COLORS,findOpenPosition,tidyPositions,searchNotes,neighbors,shortestPath,validateNote,validateSnapshot,seededWorkspace} from './graph.js';
import {Universe} from './universe.js';

const $=selector=>document.querySelector(selector);
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const state={data:{version:1,notes:[],links:[]},selected:null,kind:'all',tag:'',view:'explore',mode:null,path:[],editing:null,server:false,busy:false};
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),5000);}
const universe=new Universe($('#universe'),{select:selectNote,move:async(id,x,y)=>{const note=state.data.notes.find(n=>n.id===id);if(note)await mutate(()=>request('/api/notes/'+id,'PUT',{x,y,revision:note.revision}),'Position saved.');}});
function filtered(){return searchNotes(state.data.notes,'',state.kind,state.tag);}
function render(){
  const notes=filtered(),ids=new Set(notes.map(n=>n.id));
  universe.set({notes,links:state.data.links.filter(l=>ids.has(l.from)&&ids.has(l.to))},state.selected,state.path);
  $('#map-count').textContent=notes.length+' thoughts in view';$('#map-empty').hidden=notes.length>0;
  $('#total-notes').textContent=state.data.notes.length;$('#count-all').textContent=state.data.notes.length;
  for(const kind of KINDS)$('#count-'+kind).textContent=state.data.notes.filter(n=>n.kind===kind).length;
  $('#connection-count').textContent=state.data.links.length+' CONNECTIONS';
  document.querySelectorAll('[data-kind]').forEach(button=>{button.classList.toggle('active',button.dataset.kind===state.kind);button.setAttribute('aria-pressed',String(button.dataset.kind===state.kind));});
  $('#mobile-kind').value=state.kind;
  const tags=[...new Set(state.data.notes.flatMap(n=>n.tags))].sort();
  $('#tag-list').innerHTML=tags.map(tag=>'<button class="'+(tag===state.tag?'active':'')+'" data-tag="'+escape(tag)+'" aria-pressed="'+(tag===state.tag)+'"># '+escape(tag)+'</button>').join('')||'<span class="search-help">Tags appear as you add thoughts.</span>';
  $('#clear-tag').hidden=!state.tag;
  $('#library').innerHTML=notes.length?notes.map(n=>'<button class="thought-card" data-select="'+escape(n.id)+'"><span class="kind-pill" style="--note-color:'+COLORS[n.kind]+'">'+n.kind+'</span><h3>'+escape(n.title)+'</h3><p>'+escape(n.body.slice(0,120))+(n.body.length>120?'…':'')+'</p><span class="card-tags">'+n.tags.map(t=>'#'+escape(t)).join(' · ')+'</span></button>').join(''):'<p class="search-help">No thoughts match this view. Choose another filter or create a thought.</p>';
  $('#map-view').hidden=state.view!=='explore';$('#library').hidden=state.view!=='library';
  for(const view of ['explore','library']){const button=$('#'+view+'-view');button.classList.toggle('active',state.view===view);button.setAttribute('aria-pressed',String(state.view===view));}
  $('#mode-banner').hidden=!state.mode&&!state.path.length;
  $('#mode-text').textContent=state.mode?(state.mode.type==='connect'?'Choose another thought to connect.':'Choose a destination to find the shortest route.'):(state.path.length?state.path.length+' thoughts along this route.':'');
  renderInspector();
}
function renderInspector(){
  const note=state.data.notes.find(n=>n.id===state.selected);
  if(!note){$('#inspector-content').innerHTML='<p class="inspector-empty">Select a planet or a library card to explore a thought.<br><br>Every connection starts with a little curiosity.</p>';return;}
  const related=neighbors(note.id,state.data.links).map(id=>state.data.notes.find(n=>n.id===id)).filter(Boolean);
  const created=new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric'}).format(new Date(note.createdAt));
  $('#inspector-content').innerHTML='<div class="planet-preview"><img alt="" src="'+universe.texture(note.kind).toDataURL()+'"></div><span class="kind-pill" style="--note-color:'+COLORS[note.kind]+'">'+note.kind+'</span><h2>'+escape(note.title)+'</h2><p class="note-date">Created '+created+'</p><div class="note-body">'+escape(note.body||'An idea waiting to unfold.')+'</div><div class="note-tags">'+note.tags.map(t=>'<span class="tag">#'+escape(t)+'</span>').join('')+'</div><div class="inspector-actions"><button class="edit" data-action="edit">Edit thought ↗</button><button data-action="connect">＋ Connect</button><button data-action="route">Find a route</button></div><div class="connections-title">CONNECTED THOUGHTS / '+related.length+'</div>'+related.map(n=>{const link=state.data.links.find(l=>(l.from===note.id&&l.to===n.id)||(l.to===note.id&&l.from===n.id));return '<div class="connection-row"><button data-select="'+escape(n.id)+'"><span class="connection-dot">↗</span>'+escape(n.title)+'</button><button class="remove-link" data-unlink="'+escape(link.id)+'" aria-label="Disconnect '+escape(n.title)+'">×</button></div>';}).join('')+(!related.length?'<p class="search-help">No connections yet. Follow an interesting thread.</p>':'')+'<button class="delete-note" data-action="delete">Delete this thought</button>';
}
async function request(path,method='GET',payload){
  if(state.server){const res=await fetch(path,{method,headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});const data=await res.json();if(!res.ok)throw Error(data.error||'The request could not be completed.');return data;}
  // Standalone preview uses the same domain validation, with a separate local store.
  const draft=structuredClone(state.data),now=new Date().toISOString();let result;
  if(path==='/api/workspace')return state.data;
  if(path==='/api/notes'&&method==='POST'){if(draft.notes.length>=500)throw Error('The workspace supports up to 500 thoughts.');result={id:crypto.randomUUID(),...validateNote(payload),revision:1,createdAt:now,updatedAt:now};draft.notes.push(result);}
  else if(path.startsWith('/api/notes/')){const id=path.split('/').pop(),index=draft.notes.findIndex(n=>n.id===id);if(index<0)throw Error('Thought not found.');if(payload.revision!==draft.notes[index].revision)throw Error('This thought changed. Refresh before saving.');if(method==='DELETE'){draft.notes.splice(index,1);draft.links=draft.links.filter(l=>l.from!==id&&l.to!==id);}else{result={...draft.notes[index],...validateNote(payload,{partial:true}),revision:payload.revision+1,updatedAt:now};draft.notes[index]=result;}}
  else if(path==='/api/links'){if(payload.from===payload.to||![payload.from,payload.to].every(id=>draft.notes.some(n=>n.id===id)))throw Error('Choose two different thoughts.');result=draft.links.find(l=>(l.from===payload.from&&l.to===payload.to)||(l.to===payload.from&&l.from===payload.to));if(!result){if(draft.links.length>=2000)throw Error('The workspace supports up to 2,000 connections.');result={id:crypto.randomUUID(),from:payload.from,to:payload.to,createdAt:now};draft.links.push(result);}}
  else if(path.startsWith('/api/links/'))draft.links=draft.links.filter(l=>l.id!==path.split('/').pop());
  else if(path==='/api/import'){const clean=validateSnapshot(payload);if(draft.notes.length+clean.notes.length>500||draft.links.length+clean.links.length>2000)throw Error('This import exceeds the workspace limits.');const ids=new Map();for(const note of clean.notes){const id=crypto.randomUUID();ids.set(note.id,id);draft.notes.push({...note,id,createdAt:now,updatedAt:now,revision:1});}for(const link of clean.links)draft.links.push({id:crypto.randomUUID(),from:ids.get(link.from),to:ids.get(link.to),createdAt:now});}
  localStorage.setItem('atlas-preview-v1',JSON.stringify(draft));state.data=draft;return result;
}
async function refresh(){if(state.server)state.data=await request('/api/workspace');if(!state.data.notes.some(n=>n.id===state.selected))state.selected=state.data.notes[0]?.id||null;render();}
async function mutate(operation,message){if(state.busy){toast('Please wait for the current change to finish.');return false;}state.busy=true;try{await operation();await refresh();if(message)toast(message);return true;}catch(error){toast(error.message);if(state.server)try{await refresh();}catch{}return false;}finally{state.busy=false;}}
function selectNote(id){
  if(state.mode){const from=state.mode.from,type=state.mode.type;state.mode=null;if(type==='connect'){if(from===id){render();return toast('Choose a different thought.');}void mutate(()=>request('/api/links','POST',{from,to:id}),'Connection created.');}else{state.path=shortestPath(from,id,state.data.links);if(!state.path.length)toast('These thoughts are not connected yet.');else{state.kind='all';state.tag='';state.view='explore';toast('Found a route with '+(state.path.length-1)+' connections.');}render();}return;}
  state.selected=id;state.path=[];$('#inspector').classList.add('open');render();
}
function editor(note=null){state.editing=note?{id:note.id,revision:note.revision}:null;const form=$('#note-form');form.reset();form.elements.title.value=note?.title||'';form.elements.body.value=note?.body||'';form.elements.kind.value=note?.kind||'idea';form.elements.tags.value=note?.tags.join(', ')||'';$('#editor-label').textContent=note?'EDIT THOUGHT':'NEW THOUGHT';$('#form-error').textContent='';$('#note-dialog').showModal();form.elements.title.focus();}
let confirmCallback=null;
function confirmAction(title,description,callback){$('#confirm-title').textContent=title;$('#confirm-body').textContent=description;confirmCallback=callback;$('#confirm-dialog').showModal();}
$('#confirm-action').onclick=()=>{const callback=confirmCallback;confirmCallback=null;$('#confirm-dialog').close();callback?.();};
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$('#'+button.dataset.close).close());
$('#new-note').onclick=()=>editor();
$('#note-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,fields=Object.fromEntries(new FormData(form));
  const payload={title:fields.title,body:fields.body,kind:fields.kind,tags:fields.tags.split(',').map(t=>t.trim()).filter(Boolean)};
  try{validateNote({...payload,x:0,y:0});}catch(error){$('#form-error').textContent=error.message;return;}
  $('#save-note').disabled=true;
  const editing=state.editing;let result;
  const ok=await mutate(async()=>{result=await request(editing?'/api/notes/'+editing.id:'/api/notes',editing?'PUT':'POST',editing?{...payload,revision:editing.revision}:{...payload,...findOpenPosition(state.data.notes)});},'Thought saved.');
  $('#save-note').disabled=false;
  if(ok){$('#note-dialog').close();state.kind='all';state.tag='';selectNote(result.id);universe.fit();}else $('#form-error').textContent='Could not save. Your draft is still here. If another tab changed this note, close and reopen the editor after copying your draft.';
};
$('#inspector-content').onclick=event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.select)return selectNote(button.dataset.select);
  if(button.dataset.unlink)return confirmAction('Remove this connection?','Both thoughts will remain in your universe.',()=>void mutate(()=>request('/api/links/'+button.dataset.unlink,'DELETE'),'Connection removed.'));
  const note=state.data.notes.find(n=>n.id===state.selected);if(!note)return;
  if(button.dataset.action==='edit')editor(note);
  if(['connect','route'].includes(button.dataset.action)){state.mode={type:button.dataset.action,from:note.id};state.path=[];state.kind='all';state.tag='';$('#inspector').classList.remove('open');render();}
  if(button.dataset.action==='delete')confirmAction('Delete “'+note.title+'”?','This removes the thought and its connections. Export a backup first if you may need them again.',()=>void mutate(()=>request('/api/notes/'+note.id,'DELETE',{revision:note.revision}),'Thought deleted.'));
};
$('#library').onclick=event=>{const card=event.target.closest('[data-select]');if(card)selectNote(card.dataset.select);};
$('#kind-filters').onclick=event=>{const button=event.target.closest('[data-kind]');if(button){state.kind=button.dataset.kind;state.path=[];render();universe.fit();}};
$('#mobile-kind').onchange=event=>{state.kind=event.target.value;render();universe.fit();};
$('#tag-list').onclick=event=>{const button=event.target.closest('[data-tag]');if(button){state.tag=state.tag===button.dataset.tag?'':button.dataset.tag;render();universe.fit();}};
$('#clear-tag').onclick=()=>{state.tag='';render();universe.fit();};
for(const view of ['explore','library'])$('#'+view+'-view').onclick=()=>{state.view=view;render();if(view==='explore')requestAnimationFrame(()=>{universe.resize();universe.fit();});};
$('#close-inspector').onclick=()=>$('#inspector').classList.remove('open');
$('#cancel-mode').onclick=()=>{state.mode=null;state.path=[];render();};
$('#zoom-in').onclick=()=>universe.scale(1.2);$('#zoom-out').onclick=()=>universe.scale(1/1.2);$('#fit').onclick=()=>universe.fit();
function search(){const notes=searchNotes(state.data.notes,$('#search-input').value);$('#search-results').innerHTML=notes.slice(0,30).map(note=>'<button class="search-result" data-select="'+escape(note.id)+'"><strong>'+escape(note.title)+'</strong><span>'+note.kind+' · '+note.tags.map(escape).join(', ')+'</span></button>').join('')||'<p class="search-help">No thoughts found. Try another word.</p>';}
function openSearch(){$('#search-dialog').showModal();$('#search-input').value='';search();$('#search-input').focus();}
$('#search-open').onclick=openSearch;$('#search-input').oninput=search;
$('#search-results').onclick=event=>{const button=event.target.closest('[data-select]');if(button){$('#search-dialog').close();state.kind='all';state.tag='';selectNote(button.dataset.select);}};
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!document.querySelector('dialog[open]'))openSearch();}if(event.key==='Escape'){state.mode=null;state.path=[];render();}});
$('#help-open').onclick=()=>{$('#help-storage').textContent=state.server?'Your workspace is saved in the local SQLite database. Export for a portable backup.':'This standalone preview saves to this browser. Run npm start for the SQLite-backed app. Clearing browser data removes preview notes.';$('#help-dialog').showModal();};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(state.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='atlas-universe-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Universe exported. Keep this file as your backup.');};
$('#import-open').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async event=>{const file=event.target.files[0];event.target.value='';if(!file)return;try{if(file.size>2_000_000)throw Error('Choose a JSON file smaller than 2 MB.');const data=validateSnapshot(JSON.parse(await file.text()));confirmAction('Add '+data.notes.length+' thoughts?','This creates new copies of the imported thoughts and connections. Your existing universe stays intact.',()=>void mutate(()=>request('/api/import','POST',data),'Universe imported.'));}catch(error){toast(error.message);}};
async function boot(){
  try{if(location.protocol==='file:')throw Error();const response=await fetch('/api/workspace',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const data=await response.json();validateSnapshot(data);state.data=data;state.server=true;}catch{
    try{const raw=localStorage.getItem('atlas-preview-v1');if(raw){const data=JSON.parse(raw);validateSnapshot(data);state.data=data;}else state.data=seededWorkspace();}catch{state.data=seededWorkspace();toast('Saved preview data could not be loaded. Export your work regularly.');}
  }
  state.selected=state.data.notes.find(n=>n.id==='creative-engine')?.id||state.data.notes[0]?.id||null;
  $('#storage-mode').textContent=state.server?'● LOCAL DATABASE CONNECTED':'◌ PREVIEW · SAVED IN THIS BROWSER';
  render();requestAnimationFrame(()=>{universe.resize();universe.fit();});
}
boot();

$('#tidy').onclick=async()=>{const positions=tidyPositions(state.data.notes);const originals=new Map(state.data.notes.map(n=>[n.id,n]));await mutate(async()=>{for(const p of positions){const n=originals.get(p.id);if(n.x!==p.x||n.y!==p.y)await request('/api/notes/'+p.id,'PUT',{x:p.x,y:p.y,revision:n.revision});}},'Your thoughts have room to breathe.');universe.fit();};
