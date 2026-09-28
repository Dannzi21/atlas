/** Pure graph utilities shared by the app, API and tests. */
export const KINDS = ['idea', 'learning', 'project', 'reference'];
export const COLORS = {idea:'#fba77d',learning:'#a7a7f8',project:'#83d8c8',reference:'#c2d77e'};
/** Find room for both a planet and its caption, without moving existing thoughts. */
export function findOpenPosition(notes, preferred={x:0,y:0}) {
  const free=p=>Math.abs(p.x)<=10000&&Math.abs(p.y)<=10000&&notes.every(n=>Math.abs(n.x-p.x)>=320||Math.abs(n.y-p.y)>=200);
  if(free(preferred))return {...preferred};
  for(let ring=1;ring<=100;ring++){
    const count=ring*12;
    for(let i=0;i<count;i++){
      const angle=i/count*Math.PI*2;
      const p={x:preferred.x+Math.cos(angle)*ring*100,y:preferred.y+Math.sin(angle)*ring*100};
      if(free(p))return p;
    }
  }
  throw Error('No free space nearby. Tidy the map before adding another thought.');
}
export function tidyPositions(notes) {
  const placed=[];
  for(const note of [...notes].sort((a,b)=>Math.hypot(a.x,a.y)-Math.hypot(b.x,b.y)||a.id.localeCompare(b.id))){
    placed.push({id:note.id,...findOpenPosition(placed,{x:note.x,y:note.y})});
  }
  return placed;
}
export function searchNotes(notes, query='', kind='all', tag='') {
  const words=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return notes.filter(note => (kind==='all'||note.kind===kind) && (!tag||note.tags.includes(tag)) && words.every(word => [note.title,note.body,...note.tags].join(' ').toLowerCase().includes(word)));
}
export function neighbors(noteId, links) {
  return [...new Set(links.flatMap(link=>link.from===noteId?[link.to]:link.to===noteId?[link.from]:[]))];
}
/** Breadth-first search finds a shortest route in an unweighted, undirected graph. */
export function shortestPath(from,to,links) {
  if(from===to)return [from];
  const adjacency=new Map();
  for(const {from:a,to:b} of links){if(!adjacency.has(a))adjacency.set(a,[]);if(!adjacency.has(b))adjacency.set(b,[]);adjacency.get(a).push(b);adjacency.get(b).push(a);}
  const queue=[from],previous=new Map([[from,null]]);
  for(let index=0;index<queue.length;index++){
    for(const next of adjacency.get(queue[index])||[]){
      if(previous.has(next))continue;previous.set(next,queue[index]);
      if(next===to){const path=[to];let cursor=to;while(previous.get(cursor)!==null){cursor=previous.get(cursor);path.push(cursor);}return path.reverse();}
      queue.push(next);
    }
  }
  return [];
}
export function validateNote(value,{partial=false}={}) {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('A note must be an object.');
  const result={};
  if(!partial||'title' in value){if(typeof value.title!=='string'||!value.title.trim()||value.title.trim().length>100)throw Error('Give your thought a title of 1–100 characters.');result.title=value.title.trim();}
  if(!partial||'body' in value){if(typeof value.body!=='string'||value.body.length>20000)throw Error('Notes can contain up to 20,000 characters.');result.body=value.body;}
  if(!partial||'kind' in value){if(!KINDS.includes(value.kind))throw Error('Choose a valid thought type.');result.kind=value.kind;}
  if(!partial||'tags' in value){if(!Array.isArray(value.tags)||value.tags.length>8||value.tags.some(t=>typeof t!=='string'||!t.trim()||t.trim().length>30))throw Error('Use up to eight tags, each 1–30 characters.');result.tags=[...new Set(value.tags.map(t=>t.trim().toLowerCase()))];}
  for(const key of ['x','y']){if(!partial||key in value){if(typeof value[key]!=='number'||!Number.isFinite(value[key])||Math.abs(value[key])>10000)throw Error('Coordinates must be finite and within the map.');result[key]=value[key];}}
  return result;
}
export function validateSnapshot(value) {
  if(!value||value.version!==1||!Array.isArray(value.notes)||!Array.isArray(value.links))throw Error('Choose an Atlas version 1 JSON export.');
  if(value.notes.length>500||value.links.length>2000)throw Error('An import can contain up to 500 thoughts and 2,000 connections.');
  const ids=new Set();
  const notes=value.notes.map(note=>{if(typeof note.id!=='string'||!note.id||note.id.length>80||ids.has(note.id))throw Error('Thought IDs must be unique.');ids.add(note.id);return {id:note.id,...validateNote(note)};});
  const pairs=new Set();
  const links=value.links.map(link=>{if(!ids.has(link.from)||!ids.has(link.to)||link.from===link.to)throw Error('Connections must join two different imported thoughts.');const pair=[link.from,link.to].sort().join('::');if(pairs.has(pair))throw Error('Duplicate connection.');pairs.add(pair);return {from:link.from,to:link.to};});
  return {version:1,notes,links};
}
export function seededWorkspace() {
  const definitions=[
    ['creative-engine','The creative engine','idea',0,0,['creativity','systems'],'Good ideas rarely arrive alone. They grow at the intersection of things we already know.\n\nThis universe is a place to capture those fragments, connect them, and discover what becomes possible.\n\nTry dragging a planet, editing a thought, or connecting two ideas. These sample thoughts are yours to change.'],
    ['generative-art','Art that writes itself','project',-240,-160,['creativity','code'],'Build a generative art studio where a simple set of rules produces something unexpected.\n\nExplore particle systems, color fields, and noise. Give people a seed they can share to recreate an artwork.'],
    ['graph-theory','The shape of a connection','learning',250,-135,['systems','code'],'A graph is a collection of nodes and edges. In Atlas, thoughts are nodes and connections are edges.\n\nBreadth-first search finds the shortest path between two thoughts. Try “Find a route” to see it in action.'],
    ['quiet-design','Design for a quieter mind','reference',-280,80,['design','focus'],'The best interface does not ask for all your attention. It creates room for your intention.\n\nStudy negative space, contrast, and progressive disclosure. What can stay hidden until it is needed?'],
    ['tiny-habits','Small actions, compounding','idea',225,150,['focus','systems'],'A tiny action repeated consistently can change the shape of a year.\n\nWhat would happen if we made learning feel like tending a garden, instead of climbing a leaderboard?'],
    ['sound-garden','A garden made of sound','project',-60,260,['creativity','design'],'An ambient music instrument where each plant grows a different sound. The composition evolves with the garden.\n\nAn experiment in interfaces that invite play instead of demanding productivity.'],
    ['data-stories','Give data a human voice','learning',420,35,['design','code'],'A visualization is an argument about what matters.\n\nBefore drawing a chart, write the question it should help someone answer. Then choose the simplest honest representation.'],
    ['curiosity','Collect better questions','idea',-420,-35,['creativity','focus'],'What surprised you today?\nWhat did you assume that might not be true?\nWhat would this look like if it were easy?\n\nA useful question can outlive its first answer.'],
    ['local-first','Own your digital space','reference',55,-290,['systems','code'],'Software can be useful without requiring an account or sending your thoughts to someone else’s server.\n\nAtlas stores its full workspace in a local SQLite database when you run its server. The standalone preview uses this browser’s storage.']
  ];
  const now=new Date().toISOString();
  const notes=definitions.map(([id,title,kind,x,y,tags,body])=>({id,title,kind,x,y,tags,body,revision:1,createdAt:now,updatedAt:now}));
  const pairs=[['creative-engine','generative-art'],['creative-engine','graph-theory'],['creative-engine','quiet-design'],['creative-engine','tiny-habits'],['creative-engine','sound-garden'],['graph-theory','data-stories'],['generative-art','curiosity'],['curiosity','quiet-design'],['quiet-design','sound-garden'],['local-first','graph-theory'],['tiny-habits','sound-garden'],['local-first','creative-engine']];
  return {version:1,notes,links:pairs.map(([from,to],i)=>({id:'seed-link-'+i,from,to,createdAt:now}))};
}
