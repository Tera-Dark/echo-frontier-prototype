/* Geometry-consistent navigation for small top-down worlds.
   Agents move in world coordinates; obstacles are inflated by clearance.
   No rendering, DOM, or engine dependencies. */
(function(root){
"use strict";
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const DIRS=[[-1,0,1],[1,0,1],[0,-1,1],[0,1,1],[-1,-1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,1,Math.SQRT2],[1,1,Math.SQRT2]];
function createNavigator({width,height,obstacles=[],cell=15,clearance=6}){
 const W=width,H=height,cols=Math.ceil(W/cell),rows=Math.ceil(H/cell),count=cols*rows;
 const rects=obstacles.filter(o=>o&&o.w>0&&o.h>0&&!o.destroyed).map(o=>({id:o.id,x:o.x,y:o.y,w:o.w,h:o.h}));
 const inside=(x,y,pad=clearance)=>x<pad||y<pad||x>W-pad||y>H-pad||
  rects.some(b=>x>b.x-pad&&x<b.x+b.w+pad&&y>b.y-pad&&y<b.y+b.h+pad);
 const blocked=new Uint8Array(count);
 const cxOf=i=>(i%cols+.5)*cell,cyOf=i=>(Math.floor(i/cols)+.5)*cell;
 for(let i=0;i<count;i++)blocked[i]=inside(Math.min(W-clearance,cxOf(i)),Math.min(H-clearance,cyOf(i)))?1:0;
 const idAt=(x,y)=>clamp(Math.floor(y/cell),0,rows-1)*cols+clamp(Math.floor(x/cell),0,cols-1);
 function nearestFree(x,y){
  const c=clamp(Math.floor(x/cell),0,cols-1),r=clamp(Math.floor(y/cell),0,rows-1);
  if(!blocked[r*cols+c])return r*cols+c;
  let best=-1,bestD=Infinity;
  for(let radius=1;radius<=Math.max(cols,rows);radius++){
   for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==radius)continue;
    const a=c+dx,b=r+dy;if(a<0||b<0||a>=cols||b>=rows)continue;
    const id=b*cols+a;if(blocked[id])continue;
    const d=(cxOf(id)-x)**2+(cyOf(id)-y)**2;
    if(d<bestD){bestD=d;best=id;}
   }
   if(best>=0)return best;
  }
  return -1;
 }
 function point(id){return{x:clamp(cxOf(id),clearance,W-clearance),y:clamp(cyOf(id),clearance,H-clearance)};}
 function rayBlocked(ax,ay,bx,by){
  const length=Math.hypot(bx-ax,by-ay);
  const n=Math.max(1,Math.ceil(length/Math.max(3,clearance*.8,cell*.25)));
  for(let i=0;i<=n;i++){const t=i/n;if(inside(ax+(bx-ax)*t,ay+(by-ay)*t))return true;}
  return false;
 }
 function heapPush(heap,value){
  let n=heap.length;heap.push(value);
  while(n>0){const p=(n-1)>>1;if(heap[p].f<=value.f)break;heap[n]=heap[p];n=p;}
  heap[n]=value;
 }
 function heapPop(heap){
  const result=heap[0],last=heap.pop();
  if(heap.length){
   let i=0;while(i*2+1<heap.length){
    let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;
    if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;
   }heap[i]=last;
  }
  return result;
 }
 function findPath(sx,sy,tx,ty){
  const from=nearestFree(sx,sy),to=nearestFree(tx,ty);
  if(from<0||to<0)return[];
  const initial=point(from),finish=point(to);
  const directGoal=!inside(tx,ty)&&!rayBlocked(initial.x,initial.y,tx,ty)?{x:tx,y:ty}:finish;
  if(from===to)return[directGoal];
  if(!rayBlocked(sx,sy,directGoal.x,directGoal.y))return[directGoal];
  const gx=to%cols,gy=Math.floor(to/cols);
  const h=id=>{const dx=Math.abs(id%cols-gx),dy=Math.abs(Math.floor(id/cols)-gy);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
  const cost=new Float32Array(count);cost.fill(Infinity);cost[from]=0;
  const parents=new Int32Array(count);parents.fill(-1);
  const closed=new Uint8Array(count),heap=[];
  heapPush(heap,{id:from,f:h(from)});let found=false,iterations=0;
  while(heap.length&&iterations++<count*5){
   const p=heapPop(heap),cur=p.id;
   if(closed[cur])continue;
   if(cur===to){found=true;break;}
   closed[cur]=1;
   const x=cur%cols,y=Math.floor(cur/cols);
   for(const [dx,dy,mul] of DIRS){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows)continue;
    const ni=ny*cols+nx;if(blocked[ni]||closed[ni])continue;
    if(dx&&dy&&(blocked[y*cols+nx]||blocked[ny*cols+x]))continue;
    const tentative=cost[cur]+mul;if(tentative>=cost[ni])continue;
    cost[ni]=tentative;parents[ni]=cur;heapPush(heap,{id:ni,f:tentative+h(ni)});
   }
  }
  if(!found)return[];
  const list=[];for(let id=to;id!==from&&id>=0;id=parents[id])list.push(point(id));
  list.reverse();
  if(!inside(tx,ty)&&!rayBlocked(finish.x,finish.y,tx,ty))list.push({x:tx,y:ty});
  if(!list.length)list.push(directGoal);
  const result=[],start=inside(sx,sy)?initial:{x:sx,y:sy};
  let anchor=start,i=0;
  while(i<list.length){
   let best=i;
   for(let j=list.length-1;j>i;j--){if(!rayBlocked(anchor.x,anchor.y,list[j].x,list[j].y)){best=j;break;}}
   const next=list[best];result.push(next);anchor=next;i=best+1;
  }
  return result;
 }
 function closestReachable(x,y,desiredX,desiredY){
  const id=nearestFree(desiredX,desiredY);
  if(id<0)return{x,y};
  const goal={x:desiredX,y:desiredY};
  if(!inside(goal.x,goal.y))return goal;
  return point(id);
 }
 function approachRect(sx,sy,rect,range=13){
  const gap=Math.max(clearance+4,range);
  const candidates=[
   {x:rect.x+rect.w/2,y:rect.y-gap},
   {x:rect.x+rect.w/2,y:rect.y+rect.h+gap},
   {x:rect.x-gap,y:rect.y+rect.h/2},
   {x:rect.x+rect.w+gap,y:rect.y+rect.h/2}
  ];
  let best=null,score=Infinity;
  for(const c of candidates){
   const g=closestReachable(sx,sy,c.x,c.y);
   if(inside(g.x,g.y))continue;
   const path=findPath(sx,sy,g.x,g.y);
   if(!path.length)continue;
   let length=0,p={x:sx,y:sy};for(const v of path){length+=dist(p,v);p=v;}
   if(length<score){score=length;best=g;}
  }
  return best||closestReachable(sx,sy,rect.x,rect.y);
 }
 return{width:W,height:H,cell,cols,rows,blocked,rects,clearance,inside,rayBlocked,findPath,closestReachable,approachRect,point,nearestFree};
}
function moveAgent(agent,x,y,speed,dt,nav,options={}){
 const radius=options.radius||nav.clearance,step=Math.min(Math.max(0,speed*dt),nav.cell*.45);
 const a={x:agent.x,y:agent.y},v={x:x-a.x,y:y-a.y};
 const length=dist(a,{x,y});
 if(length<.35||step<=0)return false;
 const nx=clamp(a.x+v.x/length*Math.min(length,step),radius,nav.width-radius);
 const ny=clamp(a.y+v.y/length*Math.min(length,step),radius,nav.height-radius);
 if(!nav.inside(nx,ny,radius)&&!nav.rayBlocked(a.x,a.y,nx,ny)){agent.x=nx;agent.y=ny;return true;}
 // Slide on either free axis; never repeatedly erase an otherwise valid path.
 const opts=[{x:nx,y:a.y},{x:a.x,y:ny}];
 opts.sort((p,q)=>dist(p,{x,y})-dist(q,{x,y}));
 for(const p of opts)if(!nav.inside(p.x,p.y,radius)&&!nav.rayBlocked(a.x,a.y,p.x,p.y)){
  if(dist(a,p)>.04){agent.x=p.x;agent.y=p.y;return true;}
 }
 return false;
}
root.HungerCore=Object.assign(root.HungerCore||{},{createNavigator,moveAgent});
})(typeof window!=="undefined"?window:globalThis);
