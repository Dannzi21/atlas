import {COLORS} from './graph.js';

/** Canvas renderer. The graph stays in world coordinates; camera transforms are separate. */
export class Universe {
  constructor(canvas,{select,move}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.select=select;this.move=move;
    this.notes=[];this.links=[];this.selected=null;this.path=[];this.zoom=1;this.pan={x:0,y:0};this.textures=new Map();
    this.stars=Array.from({length:260},(_,i)=>({x:this.random(i+1),y:this.random(i+400),r:this.random(i+800)*1.3+.2}));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown',e=>this.down(e));
    canvas.addEventListener('pointermove',e=>this.pointer(e));
    canvas.addEventListener('pointerup',e=>this.up(e));
    canvas.addEventListener('pointercancel',()=>{this.drag=null;this.draw();});
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.scale(e.deltaY>0?.9:1.1);},{passive:false});
  }
  random(seed){const value=Math.sin(seed*127.1)*43758.5453;return value-Math.floor(value);}
  resize(){const box=this.canvas.getBoundingClientRect();this.w=box.width;this.h=box.height;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*dpr;this.canvas.height=this.h*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);this.draw();}
  set(data,selected,path=[]){this.notes=data.notes;this.links=data.links;this.selected=selected;this.path=path;this.draw();}
  fit(){if(!this.notes.length){this.zoom=1;this.pan={x:0,y:0};return this.draw();}const xs=this.notes.map(n=>n.x),ys=this.notes.map(n=>n.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);this.zoom=Math.max(.35,Math.min(1.1,Math.max(80,this.w-240)/Math.max(1,maxX-minX),Math.max(100,this.h-230)/Math.max(1,maxY-minY)));this.pan={x:-(minX+maxX)/2*this.zoom,y:-(minY+maxY)/2*this.zoom-20};this.draw();}
  scale(factor){const next=Math.max(.12,Math.min(2.8,this.zoom*factor));this.pan.x*=next/this.zoom;this.pan.y*=next/this.zoom;this.zoom=next;this.draw();}
  point(event){const r=this.canvas.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  world(point){return {x:(point.x-this.w/2-this.pan.x)/this.zoom,y:(point.y-this.h/2-this.pan.y)/this.zoom};}
  radius(note){return note.id===this.selected?64:28+Math.min(18,this.links.filter(l=>l.from===note.id||l.to===note.id).length*4);}
  hit(point){const world=this.world(point);return [...this.notes].sort((a,b)=>(a.id===this.selected?-1:0)-(b.id===this.selected?-1:0)).find(n=>Math.hypot(n.x-world.x,n.y-world.y)<this.radius(n)+12);}
  down(event){if(event.button!==0)return;const p=this.point(event),note=this.hit(p);this.drag={start:p,pan:{...this.pan},note:note?{...note}:null,moved:false};this.canvas.setPointerCapture(event.pointerId);}
  pointer(event){const p=this.point(event);if(!this.drag){this.canvas.style.cursor=this.hit(p)?'pointer':'grab';return;}const dx=p.x-this.drag.start.x,dy=p.y-this.drag.start.y;if(Math.hypot(dx,dy)>5)this.drag.moved=true;if(!this.drag.moved)return;this.canvas.style.cursor='grabbing';if(this.drag.note){this.preview={id:this.drag.note.id,x:Math.max(-10000,Math.min(10000,this.drag.note.x+dx/this.zoom)),y:Math.max(-10000,Math.min(10000,this.drag.note.y+dy/this.zoom))};}else this.pan={x:this.drag.pan.x+dx,y:this.drag.pan.y+dy};this.draw();}
  up(){if(!this.drag)return;const drag=this.drag;this.drag=null;if(drag.note){if(drag.moved&&this.preview)this.move(drag.note.id,this.preview.x,this.preview.y);else this.select(drag.note.id);}this.preview=null;this.canvas.style.cursor='grab';this.draw();}
  texture(kind){
    if(this.textures.has(kind))return this.textures.get(kind);
    const image=document.createElement('canvas');image.width=image.height=256;const c=image.getContext('2d'),pixels=c.createImageData(256,256);
    const rgb=COLORS[kind].slice(1).match(/../g).map(x=>parseInt(x,16));
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
      const nx=(x-128)/125,ny=(y-128)/125,rr=nx*nx+ny*ny;if(rr>1)continue;
      const z=Math.sqrt(1-rr),light=Math.max(.06,nx*-.42+ny*-.4+z*.8),warp=Math.sin(nx*7+ny*4)*.13;
      const bands=.64+.18*Math.sin((ny+warp)*39)+.1*Math.sin((ny+warp)*110+nx*9)+.08*this.random(x+y*256);
      const shade=bands*light;const i=(y*256+x)*4;for(let k=0;k<3;k++)pixels.data[i+k]=Math.min(255,rgb[k]*shade+15*light);pixels.data[i+3]=Math.min(255,(1-rr)*9000);
    }
    c.putImageData(pixels,0,0);this.textures.set(kind,image);return image;
  }
  draw(){
    const c=this.ctx;if(!this.w||!this.h)return;c.clearRect(0,0,this.w,this.h);
    const glow=c.createRadialGradient(this.w*.55,this.h*.52,10,this.w*.55,this.h*.52,this.w*.58);glow.addColorStop(0,'#26324840');glow.addColorStop(.45,'#141b3230');glow.addColorStop(1,'#060b1400');c.fillStyle=glow;c.fillRect(0,0,this.w,this.h);
    for(const star of this.stars){c.fillStyle=star.r>1.2?'#8babc3':'#52657c';c.globalAlpha=.25+star.r*.28;c.beginPath();c.arc(star.x*this.w,star.y*this.h,star.r,0,Math.PI*2);c.fill();}c.globalAlpha=1;
    c.save();c.translate(this.w/2+this.pan.x,this.h/2+this.pan.y);c.scale(this.zoom,this.zoom);
    c.strokeStyle='#617a9622';c.lineWidth=1/this.zoom;c.setLineDash([2,8]);for(const r of [150,300,460]){c.beginPath();c.ellipse(0,0,r,r*.7,-.28,0,Math.PI*2);c.stroke();}c.setLineDash([]);
    const map=new Map(this.notes.map(n=>[n.id,this.preview?.id===n.id?{...n,...this.preview}:n]));
    for(const link of this.links){const a=map.get(link.from),b=map.get(link.to);if(!a||!b)continue;const highlighted=this.path.some((id,i)=>i>0&&((id===a.id&&this.path[i-1]===b.id)||(id===b.id&&this.path[i-1]===a.id)));c.strokeStyle=highlighted?'#ffb68a':(a.id===this.selected||b.id===this.selected?'#a6aebc66':'#7089a331');c.lineWidth=(highlighted?2:1)/this.zoom;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;c.fillStyle=highlighted?'#ffc8a1':'#6c7e98';c.beginPath();c.arc(mx,my,2/this.zoom,0,Math.PI*2);c.fill();}
    for(const original of [...this.notes].sort((a,b)=>Number(a.id===this.selected)-Number(b.id===this.selected))){const note=map.get(original.id),r=this.radius(note),selected=note.id===this.selected;
      if(selected){const halo=c.createRadialGradient(note.x,note.y,r*.8,note.x,note.y,r*1.9);halo.addColorStop(0,COLORS[note.kind]+'35');halo.addColorStop(1,COLORS[note.kind]+'00');c.fillStyle=halo;c.fillRect(note.x-r*2,note.y-r*2,r*4,r*4);c.strokeStyle=COLORS[note.kind]+'65';c.lineWidth=1/this.zoom;c.beginPath();c.ellipse(note.x,note.y,r*1.35,r*.36,-.42,0,Math.PI*2);c.stroke();}
      c.drawImage(this.texture(note.kind),note.x-r,note.y-r,r*2,r*2);
      if(selected){c.strokeStyle=COLORS[note.kind]+'66';c.lineWidth=1/this.zoom;c.setLineDash([3,6]);c.beginPath();c.arc(note.x,note.y,r+10,0,Math.PI*2);c.stroke();c.setLineDash([]);}
    }
    // Captions are laid out in screen space so zooming cannot make text collide.
    c.restore();
    const occupied=[];
    const planets=[...map.values()].map(n=>({id:n.id,x:this.w/2+this.pan.x+n.x*this.zoom,y:this.h/2+this.pan.y+n.y*this.zoom,r:this.radius(n)*this.zoom}));
    const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for(const note of [...map.values()].sort((a,b)=>Number(b.id===this.selected)-Number(a.id===this.selected))){
      const p=planets.find(p=>p.id===note.id),selected=note.id===this.selected;
      c.font=(selected?'500 ':'400 ')+'12px Arial';
      const title=note.title.length>28?note.title.slice(0,26)+'…':note.title;
      const width=c.measureText(title).width+12;
      const candidates=[{x:p.x-width/2,y:p.y+p.r+12,w:width,h:34},{x:p.x-width/2,y:p.y-p.r-48,w:width,h:34}];
      const box=candidates.find(box=>box.x>=4&&box.x+box.w<=this.w-4&&box.y>=28&&box.y+box.h<=this.h-85&&!occupied.some(b=>overlaps(box,b))&&!planets.some(q=>q.id!==p.id&&overlaps(box,{x:q.x-q.r-5,y:q.y-q.r-5,w:q.r*2+10,h:q.r*2+10})));
      if(!box)continue;
      occupied.push(box);c.textAlign='center';c.fillStyle=selected?'#fff0e5':'#c0c8d8';c.fillText(title,p.x,box.y+12);
      c.font='9px monospace';c.fillStyle=selected?COLORS[note.kind]:'#6a7c94';c.fillText(note.kind.toUpperCase(),p.x,box.y+28);
    }

  }
}
