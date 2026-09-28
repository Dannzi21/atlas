import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {validateNote,validateSnapshot,seededWorkspace} from '../public/graph.js';

export class AppError extends Error { constructor(status,message){super(message);this.status=status;} }
export class Store {
  constructor(path=':memory:',{seed=true}={}) {
    this.db=new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('idea','learning','project','reference')),
        tags TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS links (
        id TEXT PRIMARY KEY, source TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        target TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, created_at TEXT NOT NULL,
        CHECK(source < target), UNIQUE(source,target)
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE INDEX IF NOT EXISTS links_target ON links(target);`);
    if(seed&&!this.db.prepare('SELECT value FROM settings WHERE key=?').get('initialized')){
      this.transaction(()=>{const data=seededWorkspace();for(const note of data.notes)this.insert(note,note.id);for(const link of data.links)this.connect(link.from,link.to);this.db.prepare('INSERT INTO settings VALUES (?,?)').run('initialized','1');});
    }
  }
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(error){this.db.exec('ROLLBACK');throw error;}}
  decode(row){return row?{id:row.id,title:row.title,body:row.body,kind:row.kind,tags:JSON.parse(row.tags),x:row.x,y:row.y,revision:row.revision,createdAt:row.created_at,updatedAt:row.updated_at}:null;}
  get(id){return this.decode(this.db.prepare('SELECT * FROM notes WHERE id=?').get(id));}
  snapshot(){return {version:1,notes:this.db.prepare('SELECT * FROM notes ORDER BY created_at,id').all().map(row=>this.decode(row)),links:this.db.prepare('SELECT id,source AS "from",target AS "to",created_at AS createdAt FROM links ORDER BY id').all()};}
  insert(input,id=randomUUID()){
    const value=validateNote(input);if(this.db.prepare('SELECT count(*) AS n FROM notes').get().n>=500)throw new AppError(409,'This workspace has reached its 500-thought limit.');
    const now=new Date().toISOString();this.db.prepare('INSERT INTO notes VALUES (?,?,?,?,?,?,?,1,?,?)').run(id,value.title,value.body,value.kind,JSON.stringify(value.tags),value.x,value.y,now,now);return this.get(id);
  }
  update(id,input){
    const current=this.get(id);if(!current)throw new AppError(404,'Thought not found.');
    if(input.revision!==current.revision)throw new AppError(409,'This thought changed in another tab. Refresh before saving again.');
    const value={...current,...validateNote(input,{partial:true})};
    this.db.prepare('UPDATE notes SET title=?,body=?,kind=?,tags=?,x=?,y=?,revision=revision+1,updated_at=? WHERE id=?').run(value.title,value.body,value.kind,JSON.stringify(value.tags),value.x,value.y,new Date().toISOString(),id);return this.get(id);
  }
  delete(id,revision){const current=this.get(id);if(!current)throw new AppError(404,'Thought not found.');if(current.revision!==revision)throw new AppError(409,'This thought changed. Refresh before deleting.');this.db.prepare('DELETE FROM notes WHERE id=?').run(id);}
  connect(from,to){
    if(typeof from!=='string'||typeof to!=='string'||from===to||!this.get(from)||!this.get(to))throw new AppError(400,'Choose two different existing thoughts.');
    const [a,b]=[from,to].sort();const existing=this.db.prepare('SELECT id,source AS "from",target AS "to",created_at AS createdAt FROM links WHERE source=? AND target=?').get(a,b);if(existing)return existing;
    if(this.db.prepare('SELECT count(*) AS n FROM links').get().n>=2000)throw new AppError(409,'This workspace has reached its connection limit.');
    const link={id:randomUUID(),from:a,to:b,createdAt:new Date().toISOString()};this.db.prepare('INSERT INTO links VALUES (?,?,?,?)').run(link.id,a,b,link.createdAt);return link;
  }
  disconnect(id){if(!this.db.prepare('DELETE FROM links WHERE id=?').run(id).changes)throw new AppError(404,'Connection not found.');}
  import(input){const clean=validateSnapshot(input);return this.transaction(()=>{const ids=new Map();for(const note of clean.notes){const created=this.insert(note);ids.set(note.id,created.id);}for(const link of clean.links)this.connect(ids.get(link.from),ids.get(link.to));return this.snapshot();});}
  close(){this.db.close();}
}
