(function(){
"use strict";
const $=id=>document.getElementById(id);
const core=window.HungerCore;
if(!core?.loadSave||!core?.createClock)throw new Error("Missing HungerCore runtime modules");
const art=window.HungerArt;
if(!art?.drawScene||!art?.paintZombie)throw new Error("Missing HungerArt pixel renderer");
const canvas=$("world");let ctx=canvas.getContext("2d");
let mapCache=null,worldDirty=true;
const SPRITE_CACHE=new Map();
const SPRITE_OUTLINE_CACHE=new Map();
const SPRITE_DEFS={
 human:{frame:96,width:48,height:48,anchorX:.5,anchorY:.5},
 zombie:{frame:96,width:48,height:48,anchorX:.5,anchorY:.5},
 vehicle:{frame:96,width:48,height:48,anchorX:.5,anchorY:.5}
};
const CITY_PALETTES={
 coast:{ground:"#3c6346",groundDark:"#2f523a",groundLight:"#4d744d",speck:"#b2bd7930",road:"#555c4a",lane:"#b8b18c40",foundation:"#344535",shadow:"#18231a90",roof:"#4c624b",roofEdge:"#293b2d",walls:["#73856a","#6e8a78","#a39b70"],wallLine:"#4b654d",highlight:"#ffffff12",window:"#243b32",windowLight:"#4c5744",door:"#354332",foliage:"#213c2b",foliageLight:"#55764b",shelter:"#293f2d",shelterEdge:"#c0e59b",shelterBar:"#b9e88c",gate:"#df6350",gateLight:"#ffe4bc",gateDark:"#9d3e35",cars:["#64788b","#9d4f45","#c3b58a"]},
 oldtown:{ground:"#6a7051",groundDark:"#576044",groundLight:"#7e805b",speck:"#c0b68a30",road:"#6c6b59",lane:"#d7c6a240",foundation:"#564d3d",shadow:"#281f1a70",roof:"#744e43",roofEdge:"#54372f",walls:["#b58b65","#ad795b","#c29a70"],wallLine:"#85644b",highlight:"#fff1d012",window:"#62513d",windowLight:"#d9d0a4",door:"#5d4035",foliage:"#3b4a2b",foliageLight:"#718050",shelter:"#493b2a",shelterEdge:"#e5bd7a",shelterBar:"#dfb56e",gate:"#df6350",gateLight:"#ffe4bc",gateDark:"#9d3e35",cars:["#ab624d","#9d4f45","#c3b58a"]}
};
let navGrid=null;
const CAMERA_LIMITS={nz:[2.35,2.55,2.7],pt:[2.4,2.65,2.85]};
const camera={zoom:1,minZoom:1,maxZoom:2.35,x:0,y:0};
let pointerGesture=null,pinchGesture=null;
const activePointers=new Map();
let shelter={kind:"shelter",building:null,door:{x:0,y:0},x:0,y:0,hp:0,maxHp:0,destroyed:false};
let W=760,H=600;const STORE=core.SAVE_KEY;
const COUNTRIES={
 nz:{name:"新西兰 · 南湾",flag:"🇳🇿",theme:"coast",stages:[
  {title:"暮色围城：零号街区",summary:"第一处感染区：一名守卫、一道路障、一间避难所。",pop:8,guards:1,goal:.62,bonus:"海湾残响"},
  {title:"公路检查站",summary:"守卫封锁了公路。新感染体将决定突破的速度。",pop:15,guards:2,goal:.65,bonus:"军用血袋"},
  {title:"暮色避难所",summary:"人类最后的灯火。击毁入口路障、破门而入，吞噬最后的幸存者。",pop:25,guards:4,goal:.67,bonus:"实验样本"}
 ]},
 pt:{name:"葡萄牙 · 圣维拉",flag:"🇵🇹",theme:"oldtown",stages:[
  {title:"圣维拉：旧城区",summary:"石板街道阻隔了视线，电车广场正在组织第一轮撤离。",pop:22,guards:2,goal:.62,bonus:"旧城遗传样本"},
  {title:"电车广场",summary:"人群试图乘车离开。抓住换乘窗口，别让尸群被分割。",pop:25,guards:4,goal:.65,bonus:"信号腺体"},
  {title:"山坡避难区",summary:"避难区只剩最后一道封锁。指挥官正在集结重武装队伍。",pop:28,guards:5,goal:.68,bonus:"避难区核心"}
 ]}
};
const DIFFICULTIES=[
 {name:"游荡",label:"低威胁",pop:0,guard:0,hp:1,speed:1,alert:0,reward:1.0,goal:.58},
 {name:"失控",label:"标准战役",pop:4,guard:1,hp:1.18,speed:1.1,alert:1,reward:1.35,goal:.62},
 {name:"围猎",label:"组织反击",pop:7,guard:2,hp:1.45,speed:1.18,alert:2,reward:1.8,goal:.66},
 {name:"灭城",label:"极限挑战",pop:10,guard:3,hp:1.8,speed:1.27,alert:3,reward:2.6,goal:.7}
];
const UNITS={
 walker:{name:"行尸",cost:12,hp:64,speed:28,damage:10,rate:.92,reach:17,color:"#9fc77d",desc:"低成本基础单位。感染与吞噬的均衡选择。"},
 runner:{name:"迅猎者",cost:24,hp:46,speed:48,damage:7,rate:.56,reach:14,color:"#c2dc84",desc:"移动迅速，适合追击正在逃跑的人群。"},
 brute:{name:"重尸",cost:42,hp:205,speed:19,damage:25,rate:1.35,reach:20,color:"#b6b077",desc:"高耐久与高破坏力，对抗武装目标的前排。"},
 spitter:{name:"喷吐者",cost:34,hp:48,speed:21,damage:8,rate:2.4,reach:82,color:"#88c8a3",desc:"远程污染，专门压制守卫与路障。"}
};
const ORGANS={
 braincore:{name:"复生脑核",rarity:"史诗",cls:"epic",icon:"◉",desc:"感染成功时，有 20% 概率额外生成一只新生行尸。",source:"高难度精英 / 旧城区"},
 maw:{name:"暴食胃囊",rarity:"稀有",cls:"rare",icon:"◈",desc:"猎食收益 +45%，击杀人类会额外获得生物质。",source:"任意战区的精英目标"},
 plague:{name:"瘟疫腺体",rarity:"传奇",cls:"legendary",icon:"✺",desc:"感染成功后，有概率把感染扩散给附近人类。",source:"围猎 / 灭城难度"},
 carapace:{name:"骨甲壳",rarity:"史诗",cls:"epic",icon:"⬟",desc:"尸群最大生命 +25%，重尸攻击伤害额外提高。",source:"检查站 / 隔离区"}
};
const saveDefaults=core.defaultSave;
let meta=core.loadSave(localStorage);
let preferences=core.loadPrefs(localStorage);
let country="nz",stage=0,difficulty=0,selectedUnit="walker",policy="feed";
let humans=[],zombies=[],particles=[],floating=[],decor=[],barriers=[];
let running=false,paused=false,ended=false,endingType="",elapsed=0,lastStamp=0,uiClock=0,saveClock=0,speed=1,howlTime=0,howlCd=0,sporeCd=0,pendingSkill="",spawnId=1,missionTime=0,neutralized=0,escaped=0,casualties=0,alert=0,commandMode=false;
let objectiveTarget=16,toastClock=0,firstMission=true,initialOverlay=true,reinforcementCalled=false;
const TUTORIAL_KEY="hunger-protocol-tutorial-v1";
let tutorialActive=true,tutorialStep=0;
try{tutorialActive=localStorage.getItem(TUTORIAL_KEY)!=="done";}catch(e){}
const highestCleared=()=>Math.max(meta.cleared.nz||0,meta.cleared.pt||0);
const unitUnlocked=id=>core.isResearched(meta,id);
let menuOpen=true,sessionActive=false,menuWasPaused=false,encounterStarted=false;
const UI_LAYOUT_KEY="hunger-protocol-layout-v1";
let uiLayout={dock:!!window.matchMedia?.("(max-width:760px)")?.matches,hud:false,objective:!!window.matchMedia?.("(max-width:760px)")?.matches};
try{const saved=JSON.parse(localStorage.getItem(UI_LAYOUT_KEY)||"null");if(saved&&typeof saved==="object")for(const k of ["dock","hud","objective"])if(typeof saved[k]==="boolean")uiLayout[k]=saved[k];}catch(e){}

const simulationClock=core.createClock({step:1/30,maxSteps:8});
let renderClock=0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rnd=(a,b)=>a+Math.random()*(b-a);
const worldScale=()=>clamp(Math.min(W/760,H/600),.82,1.85);
const graphicsPixelRatio=()=>Math.min(window.devicePixelRatio||1,preferences.lowPower?1.2:(window.matchMedia?.("(pointer:coarse)")?.matches?1.5:2));
function refreshCanvasResolution(){
 const dpr=graphicsPixelRatio();canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);mapCache=null;worldDirty=true;drawWorld();
}
function savePreferences(){return core.savePrefs(localStorage,preferences);}
function cameraLimitsForMap(){return CAMERA_LIMITS[country]?.[stage]||2.4;}
function clampCamera(){
 camera.minZoom=1;camera.maxZoom=cameraLimitsForMap();camera.zoom=clamp(camera.zoom,camera.minZoom,camera.maxZoom);
 const maxX=W*(camera.zoom-1)*.5,maxY=H*(camera.zoom-1)*.5;
 camera.x=clamp(camera.x,-maxX,maxX);camera.y=clamp(camera.y,-maxY,maxY);
 const el=$("zoom-level");if(el)el.textContent=Math.round(camera.zoom*100)+"%";
}
function resetCamera(){camera.zoom=1;camera.x=0;camera.y=0;clampCamera();}
function zoomCamera(nextZoom,screenX=W/2,screenY=H/2){
 const old=camera.zoom,next=clamp(nextZoom,1,cameraLimitsForMap());
 if(Math.abs(next-old)<.001)return;
 const wx=(screenX-W/2-camera.x)/old+W/2,wy=(screenY-H/2-camera.y)/old+H/2;
 camera.x+=(wx-W/2)*(old-next);camera.y+=(wy-H/2)*(old-next);camera.zoom=next;clampCamera();drawWorld();
}
function screenToWorld(evt){
 const rect=canvas.getBoundingClientRect(),sx=evt.clientX-rect.left,sy=evt.clientY-rect.top;
 return{x:(sx-W/2-camera.x)/camera.zoom+W/2,y:(sy-H/2-camera.y)/camera.zoom+H/2};
}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const isEquipped=id=>meta.equipped.includes(id);
const activeStage=()=>COUNTRIES[country].stages[stage];
const diff=()=>DIFFICULTIES[difficulty];
const capacity=()=>18+meta.upgrades.capacity*6;
const energyMax=()=>100+meta.upgrades.energy*30;
const energyRate=()=>2+meta.upgrades.energy*.75;
const infectionChance=()=>clamp(.25+meta.upgrades.infection*.1+(isEquipped("braincore")?.12:0),.1,.85);
const unitCapacityCost=u=>u.type==="brute"?3:u.type==="runner"?1.15:u.type==="spitter"?2:1;
const aliveHumans=()=>humans.filter(h=>h.alive).length;
const aliveZombies=()=>zombies.filter(z=>z.alive).length;
const aliveCivilians=()=>humans.filter(h=>h.alive&&h.kind==="civilian").length;
const organOwned=id=>(meta.inventory[id]||0)>0;
function persist(){return core.saveSave(localStorage,meta);}
function discoverResource(id,message){
 if(meta.discovered[id])return;
 meta.discovered[id]=true;persist();updateProgressiveUI();
 if(message){log(message);toast(message);}
}
function updateProgressiveUI(){
 const root=$("app-shell"),clears=core.clearCount(meta);
 root.classList.toggle("reveal-biomass",meta.discovered.biomass||clears>=1);
 root.classList.toggle("reveal-brains",meta.discovered.brains||clears>=1);
 root.classList.toggle("reveal-essence",meta.discovered.essence||clears>=2);
 root.classList.toggle("first-chapter",clears===0);
 root.classList.toggle("has-nest",clears>=1);
 root.classList.toggle("has-strategy",clears>=1);
 root.classList.toggle("has-skills",clears>=1);
 root.classList.toggle("has-loot",clears>=2);
 root.classList.toggle("has-command",zombies.some(z=>z.alive)||meta.mutations>0||clears>0);
 root.classList.toggle("has-deployed",zombies.some(z=>z.alive)||meta.mutations>0);
}
function log(message){
 const root=$("event-log"),p=document.createElement("p"),time=document.createElement("i"),text=document.createElement("span");
 time.textContent=fmtTime(missionTime);text.textContent=message;p.append(time,text);root.prepend(p);
 while(root.children.length>16)root.removeChild(root.lastChild);
}
function fmtTime(t){return String(Math.floor(t/60)).padStart(2,"0")+":"+String(Math.floor(t%60)).padStart(2,"0");}
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");toastClock=2.2;}
function currentKey(){return country+":"+stage+":"+difficulty;}
function freeSpot(minGap=0){
 for(let i=0;i<70;i++){
  const p={x:rnd(35,W-35),y:rnd(55,H-45)};
  if(!isBlocked(p.x,p.y,9)&&(!minGap||zombies.every(z=>!z.alive||dist(z,p)>minGap)))return p;
 }
 return{x:rnd(80,180),y:rnd(210,450)};
}
function freeSpotAround(cx,cy,radius,minGap=0){
 for(let i=0;i<110;i++){
  const a=rnd(0,Math.PI*2),r=Math.sqrt(Math.random())*radius;
  const p={x:clamp(cx+Math.cos(a)*r,18,W-18),y:clamp(cy+Math.sin(a)*r,32,H-28)};
  if(!isBlocked(p.x,p.y,9)&&(!minGap||zombies.every(z=>!z.alive||dist(z,p)>minGap)))return p;
 }
 return freeSpot(minGap);
}
function isBlocked(x,y,pad=0){
 for(const b of buildings){if(x>b.x-pad&&x<b.x+b.w+pad&&y>b.y-pad&&y<b.y+b.h+pad)return true;}
 for(const b of barriers){if(!b.destroyed&&x>b.x-b.w/2-pad&&x<b.x+b.w/2+pad&&y>b.y-b.h/2-pad&&y<b.y+b.h/2+pad)return true;}
 return false;
}
function isShelterInterior(x,y){const b=shelter.building;return !!b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h;}
function isShelterRestricted(x,y){return isShelterInterior(x,y)||!!shelter.building&&Math.hypot(x-shelter.door.x,y-shelter.door.y)<14;}
let buildings=[];
function layoutBuildings(){
 const portrait=W/H<.78,cols=portrait?[.16,.5,.84]:[.12,.37,.63,.88],rows=portrait?[.1,.3,.5,.7,.9]:[.12,.38,.62,.88];
 const bw=W*(portrait?.19:.155),bh=H*(portrait?.105:.135),out=[];
 rows.forEach((ry,ri)=>cols.forEach((cx,ci)=>out.push({id:"b"+out.length,x:cx*W-bw/2,y:ry*H-bh/2,w:bw*rnd(.88,1.08),h:bh*rnd(.9,1.08),t:(ri+ci+stage)%3,isShelter:portrait?(ri===2&&ci===1):(ri===1&&ci===1)})));
 return out;
}
function syncShelter(reset=false){
 const building=buildings.find(b=>b.isShelter)||buildings[Math.floor(buildings.length/2)];
 shelter.building=building||null;if(!building)return;
 const oldRatio=shelter.maxHp>0?shelter.hp/shelter.maxHp:1,max=180+stage*70+difficulty*40;
 shelter.maxHp=max;shelter.hp=reset?max:clamp(oldRatio*max,0,max);shelter.destroyed=reset?false:shelter.hp<=0;
 const candidates=[
  {x:building.x+building.w*.5,y:building.y+building.h+12},
  {x:building.x+building.w+12,y:building.y+building.h*.5},
  {x:building.x+building.w*.5,y:building.y-12},
  {x:building.x-12,y:building.y+building.h*.5}
 ];
 shelter.door=candidates.find(p=>p.x>8&&p.x<W-8&&p.y>24&&p.y<H-20&&!isBlocked(p.x,p.y,4))||candidates[0];
 shelter.x=shelter.door.x;shelter.y=shelter.door.y;
}
function setupBarricades(reset=true){
 const d=shelter.door,b=shelter.building;if(!b){barriers=[];return;}
 const former=barriers[0],hp=80+stage*60+difficulty*35;
 const south=d.y>b.y+b.h,north=d.y<b.y,east=d.x>b.x+b.w,west=d.x<b.x;
 const offset=25;
 const px=clamp(d.x+(east?offset:west?-offset:0),20,W-20);
 const py=clamp(d.y+(south?offset:north?-offset:0),27,H-27);
 const barricade={id:"gate-1",kind:"barricade",x:px,y:py,w:east||west?12:46,h:east||west?46:12,maxHp:hp,hp:reset||!former?hp:Math.max(0,former.hp/former.maxHp*hp),destroyed:false};
 barricade.destroyed=barricade.hp<=0;barriers=[barricade];
}
function damageBarricade(b,amount){
 if(!b||b.destroyed)return;
 b.hp=Math.max(0,b.hp-amount);
 particles.push({x:b.x,y:b.y,life:.35,max:.35,type:"hit"});
 if(b.hp<=0){
  b.destroyed=true;worldDirty=true;mapCache=null;rebuildNavigation();log("外侧路障已被撕开！尸群可以继续突破入口。");toast("防线崩溃！避难所入口已暴露");
  if(tutorialActive&&tutorialStep<=3){tutorialStep=4;refreshTutorial();}
  floating.push({x:b.x,y:b.y,text:"突破防线",life:1.5,max:1.5,color:"#e7b877"});
 }
}
const shelteredCount=()=>humans.filter(h=>h.alive&&h.sheltered).length;
function rebuildNavigation(){
 const cell=clamp(Math.min(W,H)/35,12,17),margin=6*worldScale();
 const rects=buildings.map(b=>({id:b.id,x:b.x,y:b.y,w:b.w,h:b.h}));
 for(const b of barriers)if(!b.destroyed)rects.push({id:b.id,x:b.x-b.w/2,y:b.y-b.h/2,w:b.w,h:b.h});
 navGrid=core.createNavigator({width:W,height:H,obstacles:rects,cell,clearance:margin});
 for(const list of [humans,zombies])for(const e of list){
  e.path=null;e.pathIndex=0;e.pathTimer=0;e.navGoal=null;e.stuckTime=0;e.targetMemo=null;
 }
}
function findPath(sx,sy,tx,ty){
 if(!navGrid)rebuildNavigation();
 return navGrid.findPath(sx,sy,tx,ty);
}
function segmentBlocked(x1,y1,x2,y2){
 if(!navGrid)rebuildNavigation();
 return navGrid.rayBlocked(x1,y1,x2,y2);
}
function cameraPointerDown(e){
 if(![0,1,2].includes(e.button))return;
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size===1)pointerGesture={id:e.pointerId,button:e.button,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};
 if(activePointers.size>=2){
  if(pointerGesture)pointerGesture.moved=true;
  const [a,b]=[...activePointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
  pinchGesture={initialDistance:Math.max(1,distance),initialZoom:camera.zoom};
 }
 try{canvas.setPointerCapture(e.pointerId);}catch(err){}
}
function cameraPointerMove(e){
 if(!activePointers.has(e.pointerId))return;
 activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(activePointers.size>=2){
  const [a,b]=[...activePointers.values()];
  if(!pinchGesture)pinchGesture={initialDistance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),initialZoom:camera.zoom};
  const rect=canvas.getBoundingClientRect(),centerX=(a.x+b.x)/2-rect.left,centerY=(a.y+b.y)/2-rect.top;
  const zoom=pinchGesture.initialZoom*Math.hypot(a.x-b.x,a.y-b.y)/pinchGesture.initialDistance;
  zoomCamera(zoom,centerX,centerY);
  return;
 }
 const g=pointerGesture;if(!g||g.id!==e.pointerId)return;
 const dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;g.lastX=e.clientX;g.lastY=e.clientY;
 if(!g.moved&&Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>6)g.moved=true;
 if(g.moved){camera.x+=dx;camera.y+=dy;clampCamera();drawWorld();}
}
function cameraPointerUp(e){
 const g=pointerGesture,multitouch=!!pinchGesture||activePointers.size>1;
 activePointers.delete(e.pointerId);
 try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
 if(multitouch){
  pinchGesture=null;pointerGesture=null;
  if(activePointers.size===1){
   const [id,p]=[...activePointers.entries()][0];
   pointerGesture={id,button:0,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,moved:true};
  }
  return;
 }
 pointerGesture=null;
 if(g&&g.id===e.pointerId&&!g.moved&&g.button===0)spawnAtCanvas(e);
}
function cameraPointerCancel(e){
 activePointers.delete(e.pointerId);pointerGesture=null;pinchGesture=null;
}
function handleMapWheel(e){
 e.preventDefault();const rect=canvas.getBoundingClientRect();zoomCamera(camera.zoom*(e.deltaY<0?1.12:1/1.12),e.clientX-rect.left,e.clientY-rect.top);
}
function resizeWorld(){
 const oldW=W,oldH=H,rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 W=rect.width;H=rect.height;
 const dpr=graphicsPixelRatio();
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 if(oldW>0&&oldH>0&&(humans.length||zombies.length)){
  const sx=W/oldW,sy=H/oldH;
  [humans,zombies,particles,floating].forEach(list=>list.forEach(o=>{if(typeof o.x==="number")o.x*=sx;if(typeof o.y==="number")o.y*=sy;}));
 }
 buildings=layoutBuildings();syncShelter(false);setupBarricades(false);rebuildNavigation();worldDirty=true;mapCache=null;clampCamera();
}
function setupMission(showOverlay=true){
 simulationClock.reset();$("overlay-action").dataset.mode="start";$("overlay-menu").hidden=true;
 running=false;paused=false;ended=false;endingType="";elapsed=0;missionTime=0;encounterStarted=false;reinforcementCalled=false;uiClock=0;howlTime=0;howlCd=0;sporeCd=0;pendingSkill="";commandMode=false;neutralized=0;escaped=0;casualties=0;alert=0;particles=[];floating=[];zombies=[];humans=[];spawnId=1;
 resetCamera();syncShelter(true);setupBarricades(true);rebuildNavigation();worldDirty=true;mapCache=null;
 const st=activeStage(),d=diff(),civilians=st.pop+d.pop+(stage?2:0),guards=st.guards+d.guard;
 objectiveTarget=Math.ceil(civilians*(st.goal+d.goal*.12));
 // The first encounter has zero undead; civilians all start protected inside.
 for(let i=0;i<civilians;i++){
  humans.push({id:"h"+spawnId++,x:shelter.x,y:shelter.y,hp:16*d.hp,maxHp:16*d.hp,kind:"civilian",alive:true,sheltered:true,speed:rnd(17,22)*d.speed,attackCd:0,panic:false,infected:0,value:1,seed:rnd(0,100)});
 }
 // Only armed patrols are outdoors. Their stations are actual walkable map points.
 for(let i=0;i<guards;i++){
  const p=freeSpotAround(shelter.door.x,shelter.door.y,90*worldScale(),13);
  const post=freeSpotAround(p.x,p.y,55*worldScale());
  humans.push({id:"g"+spawnId++,x:p.x,y:p.y,post:{x:p.x,y:p.y},patrol:[{x:p.x,y:p.y},post],patrolIndex:1,hp:48*d.hp,maxHp:48*d.hp,kind:"guard",alive:true,sheltered:false,speed:rnd(12,15)*d.speed,attackCd:rnd(.2,1),panic:false,infected:0,damage:(stage===0?4:stage===1?6:8)*d.hp,range:125,seed:rnd(0,100)});
 }
 if(difficulty>=2){
  const p=freeSpotAround(shelter.door.x,shelter.door.y,90*worldScale());
  humans.push({id:"e"+spawnId++,x:p.x,y:p.y,post:{x:p.x,y:p.y},patrol:[{x:p.x,y:p.y},freeSpotAround(p.x,p.y,55*worldScale())],patrolIndex:1,hp:100*d.hp,maxHp:100*d.hp,kind:"elite",alive:true,sheltered:false,speed:14*d.speed,attackCd:.6,panic:false,infected:0,damage:16*d.hp,range:155,seed:rnd(0,100)});
 }
 selectedUnit=unitUnlocked(selectedUnit)?selectedUnit:"walker";
 drawWorld();renderUI();renderOrgans();refreshTutorial();
 if(showOverlay){
  initialOverlay=true;
  showOverlayCard("☣","OPERATION DUSK","暮色围城","幸存者都在避难所内，只有持枪巡逻兵在外面。战场初始没有僵尸：亲手投放行尸，突破路障，撕开入口，再感染幸存者。","进入战场");
 }else{initialOverlay=false;$("battle-overlay").classList.add("hidden");}
 log("侦察 "+COUNTRIES[country].name+" / "+st.title+" · 避难所 "+civilians+" 人，外围武装 "+(guards+(difficulty>=2?1:0))+" 名。");
}
function showOverlayCard(symbol,kicker,title,copy,action){
 $("overlay-symbol").textContent=symbol;$("overlay-kicker").textContent=kicker;$("overlay-title").textContent=title;$("overlay-copy").textContent=copy;$("overlay-action").innerHTML=action+' <span>↗</span>';$("battle-overlay").classList.remove("hidden");
}
function hideOverlay(){ $("battle-overlay").classList.add("hidden");initialOverlay=false; }
function beginMission(){
 if(ended)setupMission(false);
 if(!running){running=true;paused=false;log("围猎授权下达 · 尸群等待第一次人工投放。");toast("先选行尸，再点击地图空地投放");}
 hideOverlay();$("pause-button").disabled=false;$("state-led").classList.add("active");renderUI();refreshTutorial();
}
function spawnZombie(type,x,y,free=false){
 const spec=UNITS[type];if(!spec)return false;
 if(!free&&!unitUnlocked(type)){toast("该尸种尚未解锁，先推进战区。");return false;}
 const live=zombies.filter(z=>z.alive);
 if(live.length>=capacity()){toast("尸群容量已满，升级尸巢以容纳更多单位。");return false;}
 if(!free&&meta.energy<spec.cost){toast("尸能不足，需要 "+spec.cost+" 点。");return false;}
 if(!free)meta.energy-=spec.cost;
 const p={x,y};
 if(isBlocked(x,y,8)){const spot=freeSpot();p.x=spot.x;p.y=spot.y;}
 const carapace=isEquipped("carapace")?1.25:1;
 encounterStarted=true;
 zombies.push({id:"z"+spawnId++,type,x:p.x,y:p.y,hp:spec.hp*carapace,maxHp:spec.hp*carapace,speed:spec.speed,damage:spec.damage,attackCd:rnd(.1,.6),alive:true,age:0,trail:[],seed:rnd(0,500),hitFlash:0,moveOrder:null});
 particles.push({x:p.x,y:p.y,life:.5,max:.5,type:"spawn"});
 floating.push({x:p.x,y:p.y-14,text:free?"集结":("-"+spec.cost+" ϟ"),life:.9,max:.9,color:free?"#c6dfa0":"#b7d77b"});
 meta.mutations++;persist();return true;
}
function spawnAtCanvas(evt){
 if(!running||paused||ended){toast(ended?"先进入下一场猎食。":"先点击“开始围猎”启动战斗。");return;}
 const p=screenToWorld(evt),x=p.x,y=p.y;
 if(x<0||x>W||y<0||y>H){toast("这里超出地图边界。");return;}
 if(pendingSkill==="spore"){castSpore(x,y);return;}
 if(commandMode){commandHorde(x,y);return;}
 if(isShelterRestricted(x,y)){toast("避难所与入口区域禁止投放尸群。");return;}
 if(isBlocked(x,y,10)){toast("这里是建筑区，尸群无法从建筑内部投放。");return;}
 if(spawnZombie(selectedUnit,x,y)){toast(UNITS[selectedUnit].name+"已投放");if(tutorialActive&&tutorialStep===1){tutorialStep=2;refreshTutorial();}renderUI();}
}
function upgrade(kind){
 const lv=meta.upgrades[kind]||0;
 const configs={
  capacity:{max:5,base:55,scale:42,resource:"biomass",title:"扩张巢穴",msg:"尸群容量增加 6。"},
  infection:{max:5,base:70,scale:52,resource:"biomass",title:"感染腺体",msg:"全局感染概率提高 10%。"},
  energy:{max:5,base:65,scale:48,resource:"biomass",title:"能量腔体",msg:"尸能上限与回复速度提高。"}
 };
 const c=configs[kind],cost=c.base+lv*c.scale;
 if(lv>=c.max){toast("该升级已达到当前原型上限。");return;}
 if(meta[c.resource]<cost){toast("生物质不足，需要 "+cost+"。");return;}
 meta[c.resource]-=cost;meta.upgrades[kind]=lv+1;persist();renderUI();
 log("尸巢进化："+c.title+" 达到 Lv."+meta.upgrades[kind]+"。");toast(c.title+"升级完成");
}
function castHowl(){
 if(!running||paused||ended){toast("需要在进行中的战斗里使用技能。");return;}
 if(howlCd>0){toast("血腥号令还在冷却。");return;}
 if(meta.brains<2){toast("脑髓不足，需要 2 点。");return;}
 meta.brains-=2;howlTime=6;howlCd=15;persist();
 for(const z of zombies)if(z.alive)particles.push({x:z.x,y:z.y,life:.8,max:.8,type:"howl"});
 log("血腥号令：全体尸群暂时加速。");toast("血腥号令！尸群进入狂猎状态。");renderUI();
}
function commandHorde(x,y){
 const gate=barriers.find(b=>!b.destroyed&&Math.hypot(x-b.x,y-b.y)<65*worldScale());
 if(gate){gate.focusUntil=missionTime+24;x=gate.x;y=gate.y;toast("目标锁定：优先突破避难所防线");}
 const squad=zombies.filter(z=>z.alive);
 if(tutorialActive&&tutorialStep===2&&squad.length){tutorialStep=3;refreshTutorial();}
 if(!squad.length){commandMode=false;updateUI();toast("尸群尚未集结，先部署单位。");return;}
 if(!navGrid)rebuildNavigation();
 const commandGoal=gate?navGrid.approachRect(squad[0].x,squad[0].y,{x:gate.x-gate.w/2,y:gate.y-gate.h/2,w:gate.w,h:gate.h},10):navGrid.closestReachable(squad[0].x,squad[0].y,x,y);
 x=commandGoal.x;y=commandGoal.y;
 const radius=Math.min(46,13+squad.length*2.2)*worldScale();
 if(!navGrid)rebuildNavigation();
 squad.forEach((z,i)=>{
  const angle=i*2.399963;
  const ring=Math.sqrt((i+.25)/Math.max(1,squad.length))*radius;
  const preferred=navGrid.closestReachable(z.x,z.y,clamp(x+Math.cos(angle)*ring,18,W-18),clamp(y+Math.sin(angle)*ring,28,H-28));
  z.moveOrder=preferred;z.path=null;z.pathTimer=0;z.targetMemo=null;
 });
 particles.push({x,y,life:.85,max:.85,type:"command",radius:32*worldScale()});
 commandMode=false;updateUI();
 toast("尸群收到移动指令 · 抵达后恢复自动追猎");
}
function castSpore(x,y){
 if(sporeCd>0){pendingSkill="";toast("感染脉冲还在冷却。");return;}
 if(meta.brains<3){pendingSkill="";toast("脑髓不足，需要 3 点。");return;}
 meta.brains-=3;sporeCd=13;pendingSkill="";
 particles.push({x,y,life:1.0,max:1.0,type:"spore",radius:95});
 let affected=0;
 for(const h of humans.slice()){
  if(!h.alive||h.kind!=="civilian"||Math.hypot(h.x-x,h.y-y)>92)continue;
  if(Math.random()<.72){convertHuman(h);affected++;}
  else{h.hp-=9;if(h.hp<=0)killHuman(h,"feed");}
 }
 log("感染脉冲释放，影响 "+affected+" 名人类。");toast("感染脉冲命中 "+affected+" 名目标。");renderUI();persist();
}
function nearestTarget(z){
 const cache=z.targetMemo;
 if(cache&&missionTime<z.targetUntil&&
    (cache.kind==="shelter"?!shelter.destroyed&&shelteredCount()>0:
     cache.kind==="barricade"?!cache.destroyed:cache.alive&&!cache.sheltered))return cache;
 z.targetUntil=missionTime+.55+(z.seed||0)%29*.013;
 const candidates=[];
 for(const h of humans)if(h.alive&&!h.sheltered){
  const range=dist(z,h);candidates.push({target:h,range,priority:1});
 }
 candidates.sort((a,b)=>a.range-b.range);
 // Candidate shortlist avoids A* for every nearby human on every frame.
 const shortlist=candidates.slice(0,4);
 const barrier=barriers.find(b=>!b.destroyed);
 if(barrier){
  const d=dist(z,barrier);
  if(d<Math.max(340,Math.min(W,H)*.88)&&(!shortlist.length||d<shortlist[0].range*2.2))
   shortlist.push({target:barrier,range:d,priority:.85});
 }else if(!shelter.destroyed&&shelter.hp>0&&shelteredCount()>0){
  shortlist.push({target:shelter,range:dist(z,shelter),priority:.85});
 }
 let chosen=null,best=Infinity;
 for(const candidate of shortlist){
  const t=candidate.target;let end={x:t.x,y:t.y};
  if(t.kind==="barricade")end=navGrid.approachRect(z.x,z.y,{x:t.x-t.w/2,y:t.y-t.h/2,w:t.w,h:t.h},8);
  if(t.kind==="shelter")end=navGrid.approachRect(z.x,z.y,{x:t.x-9,y:t.y-8,w:18,h:16},8);
  let travel=Math.hypot(end.x-z.x,end.y-z.y);
  if(segmentBlocked(z.x,z.y,end.x,end.y)){
   const path=findPath(z.x,z.y,end.x,end.y);
   if(!path.length)continue;
   let prev=z;travel=0;for(const p of path){travel+=Math.hypot(p.x-prev.x,p.y-prev.y);prev=p;}
  }
  const score=travel*candidate.priority;
  if(score<best){best=score;chosen=t;}
 }
 z.targetMemo=chosen;
 return chosen;
}
function damageShelter(amount){
 if(shelter.destroyed||shelter.hp<=0)return;
 shelter.hp=Math.max(0,shelter.hp-amount);
 floating.push({x:shelter.x,y:shelter.y-18,text:"-"+Math.round(amount),life:.55,max:.55,color:"#ff9a76"});
 particles.push({x:shelter.x,y:shelter.y,life:.22,max:.22,type:"hit"});
 if(shelter.hp<=0){
  shelter.destroyed=true;worldDirty=true;mapCache=null;
  for(const h of humans){if(!h.alive||!h.sheltered)continue;h.sheltered=false;const p=freeSpotAround(shelter.x,shelter.y,Math.min(W,H)*.16);h.x=p.x;h.y=p.y;h.panic=true;h.path=null;h.pathTimer=0;}
  log("人类避难所被尸群攻破！幸存者涌出。");toast("避难所已被攻破！快切到感染优先收割幸存者");
  if(tutorialActive&&tutorialStep<=4){tutorialStep=5;refreshTutorial();}
 }
}
function nearestZombie(h){
 let found=null,best=Infinity;
 for(const z of zombies){if(!z.alive)continue;const d=dist(h,z);if(d<best){best=d;found=z;}}
 return found;
}
function moveEntity(e,tx,ty,speed,dt,target=null){
 if(!navGrid)rebuildNavigation();
 const radius=e.type==="brute"?8*worldScale():6*worldScale();
 let goal={x:tx,y:ty};
 const targetId=target?.id||(target?.kind==="shelter"?"shelter":null);
 // Attack targets are not destinations; plan toward reachable exterior edges.
 if(target?.kind==="barricade"||target?.kind==="shelter"){
  const isGate=target.kind==="barricade";
  const rect=isGate?
   {x:target.x-target.w/2,y:target.y-target.h/2,w:target.w,h:target.h}:
   {x:target.x-9,y:target.y-8,w:18,h:16};
  if(!e.navGoal||e.navGoalId!==targetId||e.navGoalAge>1.2){
   e.navGoal=navGrid.approachRect(e.x,e.y,rect,Math.max(8,radius+2));
   e.navGoalId=targetId;e.navGoalAge=0;e.path=null;
  }
  e.navGoalAge=(e.navGoalAge||0)+dt;goal=e.navGoal;
 }else{e.navGoal=null;e.navGoalId=null;e.navGoalAge=0;}
 goal=navGrid.closestReachable(e.x,e.y,goal.x,goal.y);
 e.pathTimer=(e.pathTimer||0)-dt;
 const targetShift=!Number.isFinite(e.pathTargetX)||Math.hypot(goal.x-e.pathTargetX,goal.y-e.pathTargetY)>navGrid.cell*.85;
 const clearPath=!navGrid.rayBlocked(e.x,e.y,goal.x,goal.y);
 if(clearPath){e.path=null;e.pathIndex=0;}
 else if(!e.path||e.pathTimer<=0||targetShift){
  e.path=navGrid.findPath(e.x,e.y,goal.x,goal.y);
  e.pathIndex=0;e.pathTargetX=goal.x;e.pathTargetY=goal.y;
  // Stagger expensive A* recalculation; react faster to changed goals.
  e.pathTimer=targetShift?.22:.7+(e.seed||0)%13*.013;
 }
 let dest=goal;
 if(!clearPath&&e.path?.length){
  while(e.pathIndex<e.path.length&&Math.hypot(e.path[e.pathIndex].x-e.x,e.path[e.pathIndex].y-e.y)<Math.max(3,navGrid.cell*.23))e.pathIndex++;
  if(e.pathIndex<e.path.length)dest=e.path[e.pathIndex];else{e.path=null;e.pathIndex=0;}
 }
 const oldX=e.x,oldY=e.y;
 const moved=core.moveAgent(e,dest.x,dest.y,speed,dt,navGrid,{radius});
 if(moved){
  e.stuckTime=0;e.lastMoveX=e.x;e.lastMoveY=e.y;
 }else if(Math.hypot(dest.x-e.x,dest.y-e.y)>4){
  e.stuckTime=(e.stuckTime||0)+dt;
  if(e.stuckTime>.25){e.path=null;e.pathIndex=0;e.pathTimer=0;}
  if(e.stuckTime>.65){
   // Escape a corner by choosing a genuinely traversable nearby waypoint.
   const offsets=[[navGrid.cell,0],[-navGrid.cell,0],[0,navGrid.cell],[0,-navGrid.cell],
    [navGrid.cell,navGrid.cell],[-navGrid.cell,navGrid.cell],[navGrid.cell,-navGrid.cell],[-navGrid.cell,-navGrid.cell]];
   offsets.sort((a,b)=>{
    const aa={x:e.x+a[0],y:e.y+a[1]},bb={x:e.x+b[0],y:e.y+b[1]};
    return Math.hypot(aa.x-goal.x,aa.y-goal.y)-Math.hypot(bb.x-goal.x,bb.y-goal.y);
   });
   for(const [ox,oy] of offsets){
    const nx=e.x+ox,ny=e.y+oy;
    if(!navGrid.inside(nx,ny,radius)&&!navGrid.rayBlocked(e.x,e.y,nx,ny)){
     e.path=[{x:nx,y:ny},...navGrid.findPath(nx,ny,goal.x,goal.y)];
     e.pathIndex=0;e.stuckTime=0;e.pathTimer=.75;break;
    }
   }
  }
 }
 return Math.hypot(e.x-oldX,e.y-oldY)>.001;
}
function exits(){return[{x:W-12,y:H*.5,label:"撤离"},{x:W*.5,y:H-12,label:"撤离"},{x:12,y:H*.5,label:"撤离"}];}
function closestExit(h){let best=exits()[0],bd=Infinity;for(const e of exits()){const d=dist(h,e);if(d<bd){bd=d;best=e;}}return best;}
function update(dt){
 meta.energy=clamp(meta.energy+energyRate()*dt,0,energyMax());
 if(howlTime>0)howlTime=Math.max(0,howlTime-dt);
 if(howlCd>0)howlCd=Math.max(0,howlCd-dt);
 if(sporeCd>0)sporeCd=Math.max(0,sporeCd-dt);
 if(encounterStarted)missionTime+=dt;elapsed=missionTime;
 if(!reinforcementCalled&&missionTime>55&&(stage>0||difficulty>0)&&!shelter.destroyed){
  reinforcementCalled=true;
  const p=freeSpotAround(shelter.door.x,shelter.door.y,80*worldScale());
  humans.push({id:"r"+spawnId++,x:p.x,y:p.y,post:{x:p.x,y:p.y},hp:50*diff().hp,maxHp:50*diff().hp,kind:"guard",alive:true,speed:13,attackCd:.2,panic:false,infected:0,damage:8*diff().hp,range:125,seed:rnd(0,100)});
  log("警报升级：避难所派出了增援守卫。");toast("⚠ 人类增援抵达！");
 }
 const liveZ=zombies.filter(z=>z.alive),liveH=humans.filter(h=>h.alive);
 alert=clamp(diff().alert+(liveZ.length>3?1:0)+(neutralized/objectiveTarget>.5?1:0),0,4);
 for(const h of liveH){
  h.attackCd=Math.max(0,h.attackCd-dt);
  if(h.sheltered)continue;
  const closest=nearestZombie(h),zd=closest?dist(h,closest):Infinity;
  if(h.kind==="civilian"){
   if(zd<150||alert>=2)h.panic=true;
   if(h.panic){
    if(!shelter.destroyed&&shelter.hp>0){
     const door=shelter.door;moveEntity(h,door.x,door.y,h.speed*1.2*worldScale(),dt);
     if(Math.hypot(h.x-door.x,h.y-door.y)<12*worldScale()){
      h.sheltered=true;h.x=shelter.x;h.y=shelter.y;h.path=null;h.pathTimer=0;
      log("平民进入避难所 · 当前收容 "+shelteredCount()+" 人。");
     }
    }else{
     const ex=closestExit(h);let tx=ex.x,ty=ex.y;
     if(closest&&zd<65){const ax=h.x-closest.x,ay=h.y-closest.y,ad=Math.hypot(ax,ay)||1;tx=h.x+ax/ad*140+(ex.x-h.x)*.35;ty=h.y+ay/ad*140+(ex.y-h.y)*.35;}
     moveEntity(h,tx,ty,h.speed*1.28*worldScale(),dt);
     if(exits().some(e=>dist(h,e)<11)){h.alive=false;escaped++;particles.push({x:h.x,y:h.y,life:.5,max:.5,type:"escape"});}
    }
   }else if(Math.random()<dt*.35){
    const nx=clamp(h.x+rnd(-15,15)*dt,10,W-10),ny=clamp(h.y+rnd(-15,15)*dt,20,H-20);
    if(!isBlocked(nx,ny,6)){h.x=nx;h.y=ny;}
   }
  }else{
   if(closest&&zd<h.range*worldScale()&&!segmentBlocked(h.x,h.y,closest.x,closest.y)){if(h.attackCd<=0){h.attackCd=h.kind==="elite"?.52:.8;closest.hp-=h.damage;closest.hitFlash=.15;floating.push({x:closest.x,y:closest.y-10,text:"-"+Math.round(h.damage),life:.6,max:.6,color:"#e98779"});particles.push({x:closest.x,y:closest.y,life:.22,max:.22,type:"hit"});if(closest.hp<=0)killZombie(closest);}}
   else if(closest&&zd<145*worldScale()&&(!h.post||dist(h,h.post)<55*worldScale()))moveEntity(h,closest.x,closest.y,h.speed*.6*worldScale(),dt);
   else if(h.patrol?.length){const stop=h.patrol[h.patrolIndex||0];if(dist(h,stop)<10*worldScale())h.patrolIndex=(h.patrolIndex+1)%h.patrol.length;else moveEntity(h,stop.x,stop.y,h.speed*.65*worldScale(),dt);}
  }
 }
 for(const z of liveZ){
  if(!z.alive)continue;
  z.age+=dt;z.attackCd-=dt;z.hitFlash=Math.max(0,z.hitFlash-dt);
  if(z.moveOrder){
   if(dist(z,z.moveOrder)>Math.max(7,navGrid.cell*.42)){
    moveEntity(z,z.moveOrder.x,z.moveOrder.y,z.speed*(howlTime>0?1.75:1)*worldScale(),dt);continue;
   }
   z.moveOrder=null;
  }
  const target=nearestTarget(z);if(!target)continue;
  const d=dist(z,target),barrierTarget=target.kind==="barricade",reach=UNITS[z.type].reach*worldScale()+(barrierTarget?Math.max(target.w,target.h)*.45:0);
  if(d<=reach&&(barrierTarget||!segmentBlocked(z.x,z.y,target.x,target.y))){
   if(z.attackCd<=0){
    const sp=UNITS[z.type],speedBonus=howlTime>0?1.75:1;
    if(z.type==="spitter"){particles.push({x:target.x,y:target.y,life:.6,max:.6,type:"spore",radius:24});}
    z.attackCd=sp.rate/speedBonus;
    if(target.kind==="barricade"){
      damageBarricade(target,z.damage*(z.type==="brute"?2.5:z.type==="spitter"?.8:1)*(howlTime>0?1.35:1));
    }else if(target.kind==="shelter"){
      damageShelter(z.damage*(howlTime>0?1.35:1));
    }else if(policy==="infect"&&target.kind==="civilian"&&Math.random()<infectionChance()){
      convertHuman(target);
    }else{
      target.hp-=z.damage*(howlTime>0?1.35:1);
      target.infected=Math.max(0,target.infected-.15);
      floating.push({x:target.x+rnd(-4,4),y:target.y-13,text:"-"+Math.ceil(z.damage),life:.52,max:.52,color:"#f1cf9f"});
      particles.push({x:target.x,y:target.y,life:.23,max:.23,type:"bite"});
      if(target.hp<=0)killHuman(target,"feed");
    }
   }
  }else{
   const speed=z.speed*(howlTime>0?1.75:1)*(z.type==="runner"&&target.panic?1.22:1)*1.18*worldScale();
   moveEntity(z,target.x,target.y,speed,dt,target);
  }
 }
 particles.forEach(p=>p.life-=dt);particles=particles.filter(p=>p.life>0);
 floating.forEach(p=>{p.life-=dt;p.y-=14*dt;});floating=floating.filter(p=>p.life>0);
 if(neutralized>=objectiveTarget&&shelter.destroyed&&barriers.every(b=>b.destroyed)){finishMission(true);return;}
 if(missionTime>=(stage===2?230:195)){
  finishMission(neutralized>=objectiveTarget&&shelter.destroyed);return;
 }
 if(aliveHumans()===0){finishMission(neutralized>=objectiveTarget&&shelter.destroyed);return;}
 if(shelter.destroyed&&escaped>Math.max(5,humans.filter(h=>h.kind==="civilian").length-objectiveTarget+2)){finishMission(false);return;}
 if(aliveZombies()===0&&meta.energy<12&&missionTime>25&&aliveHumans()>0){
  // Still allow energy regeneration and new deployments; no fail state here.
 }
}
function killHuman(h,mode){
 if(!h.alive)return;h.alive=false;neutralized++;casualties++;
 if(!meta.discovered.biomass)discoverResource("biomass","首次猎食 · 获得生物质。");
 particles.push({x:h.x,y:h.y,life:.5,max:.5,type:"blood"});
 if(mode==="infect"){
  const extra=isEquipped("braincore")&&Math.random()<.2;
  if(zombies.filter(z=>z.alive).length<capacity())spawnZombie("walker",h.x,h.y,true);
  if(extra&&zombies.filter(z=>z.alive).length<capacity())spawnZombie("walker",h.x+rnd(-9,9),h.y+rnd(-9,9),true);
  meta.brains+=1+(Math.random()<.35?1:0);
  meta.biomass+=2;
  floating.push({x:h.x,y:h.y-14,text:"感染 +",life:1,max:1,color:"#8fdfa0"});
 }else{
  const reward=7*(isEquipped("maw")?1.45:1);
  meta.biomass+=reward;meta.brains+=Math.random()<.3?1:0;
  if(isEquipped("braincore")&&Math.random()<.12&&zombies.filter(z=>z.alive).length<capacity())spawnZombie("walker",h.x,h.y,true);
  floating.push({x:h.x,y:h.y-14,text:"+"+Math.round(reward)+" 生物质",life:1,max:1,color:"#d6d98c"});
 }
 if(h.kind==="elite"){meta.essence+=2;dropOrgan(true);log("精英人类被吞噬，回收突变精华与稀有器官。");}
 else if(h.kind==="guard"&&Math.random()<.06+difficulty*.04)dropOrgan(false);
 if(neutralized%5===0){meta.essence+=difficulty>=2?2:1;log("尸群达成 "+neutralized+" 次猎食，回收突变精华。");}
 if(neutralized%4===0)log((mode==="infect"?"感染扩散":"猎食完成")+" · 已处理 "+neutralized+" 名人类。");
 persist();
}
function convertHuman(h){
 if(!h.alive)return;
 h.alive=false;neutralized++;casualties++;
 if(!meta.discovered.biomass)discoverResource("biomass","首次感染 · 获得生物质。");
 particles.push({x:h.x,y:h.y,life:.85,max:.85,type:"infection"});
 const room=zombies.filter(z=>z.alive).length<capacity();
 if(room)spawnZombie("walker",h.x,h.y,true);
 const extra=isEquipped("braincore")&&Math.random()<.2;
 if(extra&&zombies.filter(z=>z.alive).length<capacity())spawnZombie("walker",h.x+rnd(-8,8),h.y+rnd(-8,8),true);
 meta.brains+=1;meta.biomass+=2;
 floating.push({x:h.x,y:h.y-16,text:"转化!",life:1,max:1,color:"#9be5a4"});
 if(isEquipped("plague")){
  for(const other of humans){if(other.alive&&other.kind==="civilian"&&Math.hypot(other.x-h.x,other.y-h.y)<56&&Math.random()<.25){convertSplash(other);}}
 }
 if(h.kind==="elite")dropOrgan(true);
 else if(h.kind==="guard"&&Math.random()<.07+difficulty*.05)dropOrgan(false);
 if(neutralized%5===0){meta.essence+=difficulty>=2?2:1;log("尸群达成 "+neutralized+" 次猎食，回收突变精华。");}
 if(neutralized%4===0)log("感染链扩散 · 已转化/吞噬 "+neutralized+" 名人类。");
 persist();
}
function convertSplash(h){if(!h.alive)return;if(!meta.discovered.biomass)discoverResource("biomass","感染链 · 获得生物质。");h.alive=false;neutralized++;casualties++;meta.brains++;meta.biomass+=2;if(zombies.filter(z=>z.alive).length<capacity())spawnZombie("walker",h.x,h.y,true);particles.push({x:h.x,y:h.y,life:.65,max:.65,type:"infection"});}
function killZombie(z){
 if(!z.alive)return;z.alive=false;particles.push({x:z.x,y:z.y,life:.45,max:.45,type:"blood"});floating.push({x:z.x,y:z.y-12,text:"尸群损失",life:.8,max:.8,color:"#d77c70"});
}
function dropOrgan(force){
 const ids=Object.keys(ORGANS);let candidates=ids.filter(id=>!organOwned(id));if(!candidates.length)candidates=ids;
 const chosen=candidates[Math.floor(Math.random()*candidates.length)];
 meta.inventory[chosen]=(meta.inventory[chosen]||0)+1;
 meta.essence+=1;
 log((force?"稀有掉落":"额外掉落")+" · "+ORGANS[chosen].name+" ×1");
 toast("战利品获得："+ORGANS[chosen].name);
 renderOrgans();persist();
}
function finishMission(win){
 if(ended)return;ended=true;running=false;paused=false;endingType=win?"win":"fail";$("pause-button").disabled=true;$("state-led").classList.remove("active");
 const firstKey=country+":"+stage;
 if(win){
  const beforeUnlock=highestCleared();
  const reward=Math.round((18+neutralized*1.35+stage*8)*diff().reward);
  meta.biomass+=reward;meta.brains+=Math.round(3+difficulty*1.5);meta.essence+=Math.max(1,difficulty);
  const first=!meta.firstRewards.includes(firstKey);
  if(first){meta.firstRewards.push(firstKey);meta.biomass+=30;meta.essence+=2;}
  if(difficulty>=2&&Math.random()<.58)dropOrgan(false);
  if(stage>=meta.cleared[country])meta.cleared[country]=Math.min(3,stage+1);
  meta.lastCountry=country;meta.lastStage=Math.min(2,stage+1);meta.lastDifficulty=difficulty;
  if(core.clearCount(meta)>=1)meta.discovered.brains=true;
  if(core.clearCount(meta)>=2)meta.discovered.essence=true;
  persist();log("围猎成功：带回 "+reward+" 生物质、脑髓与突变精华。");
  const newlyUnlocked=[{id:"runner",need:1},{id:"brute",need:2},{id:"spitter",need:3}].filter(u=>beforeUnlock<u.need&&highestCleared()>=u.need).map(u=>UNITS[u.id].name);
  if(newlyUnlocked.length)log("感染体研究已开放："+newlyUnlocked.join("、")+"。");
  renderResearchUI();refreshMenu();
  completeTutorial();
  showOverlayCard("☠","HUNT COMPLETE","街区已沦陷","吞噬/感染 "+neutralized+" 人，逃离 "+escaped+" 人。"+(newlyUnlocked.length?" 可研究新尸种："+newlyUnlocked.join("、")+"。":first?"首次清除奖励已发放。":"战利品已回收。"),stage<2?"继续下一街区":"返回战区");
  $("overlay-action").dataset.mode=stage<2?"next":"map";
  $("overlay-menu").hidden=false;
  toast("围猎完成 · 收获 "+reward+" 生物质");
 }else{
  const small=Math.round(neutralized*2);
  meta.biomass+=small;persist();log("围猎失败：目标撤离过多。尸巢仍保留本次战斗收获。");
  showOverlayCard("⚠","HUNT FAILED","人类突破封锁","已处理 "+neutralized+" 人，仍有 "+aliveHumans()+" 名人类存活。带回部分生物质，可以调整突变后重试。","重新围猎");
  $("overlay-action").dataset.mode="retry";
  $("overlay-menu").hidden=false;
  toast("目标逃离过多，调整部署后再试");
 }
 renderUI();renderOrgans();drawWorld();
}
function moveToNext(){
 const mode=$("overlay-action").dataset.mode;
 if(mode==="retry"){setupMission(false);beginMission();return;}
 if(mode==="next"){stage=Math.min(2,stage+1);setupMission(false);beginMission();return;}
 if(mode==="map"){showToastMap();return;}
 beginMission();
}
function showToastMap(){hideOverlay();running=false;ended=false;paused=false;setupMission(true);renderCampaignUI();}
function drawStaticWorld(){
 art.drawScene(ctx,{w:W,h:H,country,stage,difficulty,buildings,shelter,barriers,exits:exits(),isBlocked});
}
function drawDynamicFortificationBars(c){
 const gate=barriers.find(b=>!b.destroyed);
 if(gate){
  const x=gate.x-gate.w/2,y=gate.y-gate.h/2-15;
  c.fillStyle="#111b1c";c.fillRect(x,y,gate.w,5);
  c.fillStyle="#e8b67b";c.fillRect(x,y,gate.w*gate.hp/Math.max(1,gate.maxHp),3);
 }
 if(shelter.building){
  const d=shelter.door,x=d.x-21,y=d.y-24;
  c.fillStyle="#141c1c";c.fillRect(x,y,42,5);
  c.fillStyle=shelter.destroyed?"#d27365":"#b3d49d";
  c.fillRect(x+1,y+1,40*shelter.hp/Math.max(1,shelter.maxHp),3);
 }
}
function drawWorld(){
 const dpr=graphicsPixelRatio();
 if(!mapCache||worldDirty||mapCache.width!==canvas.width||mapCache.height!==canvas.height){
  mapCache=document.createElement("canvas");mapCache.width=canvas.width;mapCache.height=canvas.height;
  const mainContext=ctx;ctx=mapCache.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
  drawStaticWorld();ctx=mainContext;worldDirty=false;
 }
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,W,H);ctx.save();
 ctx.translate(W/2+camera.x,H/2+camera.y);ctx.scale(camera.zoom,camera.zoom);ctx.translate(-W/2,-H/2);
 ctx.drawImage(mapCache,0,0,W,H);
 drawDynamicFortificationBars(ctx);
 humans.forEach(drawHuman);zombies.forEach(drawZombie);particles.forEach(drawParticle);floating.forEach(drawFloat);
 ctx.restore();
}
function getSprite(key,painter,kind="human"){
 if(SPRITE_CACHE.has(key))return SPRITE_CACHE.get(key);
 const def=SPRITE_DEFS[kind]||SPRITE_DEFS.human,image=document.createElement("canvas");image.width=def.frame;image.height=def.frame;
 const g=image.getContext("2d");g.setTransform(def.frame/def.width,0,0,def.frame/def.height,def.frame/2,def.frame/2);painter(g);
 const sprite={key,image,width:def.width,height:def.height,anchorX:def.anchorX,anchorY:def.anchorY};SPRITE_CACHE.set(key,sprite);return sprite;
}
function getSpriteOutline(sprite,color){
 const key=sprite.key+"|"+color;if(SPRITE_OUTLINE_CACHE.has(key))return SPRITE_OUTLINE_CACHE.get(key);
 const size=sprite.image.width,mask=document.createElement("canvas");mask.width=size;mask.height=size;const m=mask.getContext("2d");m.drawImage(sprite.image,0,0);m.globalCompositeOperation="source-in";m.fillStyle=color;m.fillRect(0,0,size,size);
 const outline=document.createElement("canvas");outline.width=size;outline.height=size;const o=outline.getContext("2d");
 o.globalAlpha=.22;for(const [x,y] of [[-5,0],[5,0],[0,-5],[0,5],[-4,-4],[4,-4],[-4,4],[4,4]])o.drawImage(mask,x,y);
 o.globalAlpha=.9;for(const [x,y] of [[-2,0],[2,0],[0,-2],[0,2],[-2,-2],[2,-2],[-2,2],[2,2]])o.drawImage(mask,x,y);
 o.globalAlpha=.45;o.drawImage(mask,0,0);o.globalAlpha=1;SPRITE_OUTLINE_CACHE.set(key,outline);return outline;
}
function drawAnchoredSprite(c,sprite,x,y,scale,outlineColor,pulse,shadow={}){
 const w=sprite.width*scale,h=sprite.height*scale,left=x-w*sprite.anchorX,top=y-h*sprite.anchorY;
 c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle=shadow.color||"#10181080";c.beginPath();c.ellipse(shadow.x??1,shadow.y??5,shadow.rx??7,shadow.ry??3.2,0,0,Math.PI*2);c.fill();c.restore();
 if(outlineColor){c.save();c.globalAlpha=.78+.22*pulse;c.drawImage(getSpriteOutline(sprite,outlineColor),left,top,w,h);c.restore();}
 c.drawImage(sprite.image,left,top,w,h);
}
function drawHuman(h){
 if(!h.alive||h.sheltered)return;
 const civilian=h.kind==="civilian",pulse=.5+.5*Math.sin(missionTime*3.7+(h.seed||0)),frame=Math.floor(missionTime*4+(h.seed||0))%2;
 const sprite=getSprite("human:"+h.kind+":"+(civilian&&h.panic?"panic":"calm")+":"+frame,g=>art.paintHuman(g,h.kind,!!h.panic,frame),"human");
 const c=ctx,scale=worldScale();
 drawAnchoredSprite(c,sprite,h.x,h.y,scale,preferences.teamHighlight?(civilian?"#d3ad71":"#de765e"):null,pulse,{rx:5.5,ry:2,y:7});
 if(preferences.healthBars&&h.hp<h.maxHp){c.save();c.translate(h.x,h.y);c.scale(scale,scale);c.fillStyle="#121c1b";c.fillRect(-8,-18,16,2);c.fillStyle=civilian?"#d7a67a":"#df796b";c.fillRect(-8,-18,16*Math.max(0,h.hp/h.maxHp),2);c.restore();}
}
function drawZombie(z){
 if(!z.alive)return;
 const c=ctx,r=z.type==="brute"?13:z.type==="runner"?8:z.type==="spitter"?10:8,pulse=.5+.5*Math.sin(missionTime*3.4+(z.seed||0)),frame=Math.floor(z.age*5+z.seed)%2;
 const sprite=getSprite("zombie:"+z.type+":"+(z.hitFlash>0?"hit":"normal")+":"+frame,g=>art.paintZombie(g,z.type,z.hitFlash>0,frame),"zombie");
 const scale=worldScale();
 drawAnchoredSprite(c,sprite,z.x,z.y,scale,preferences.teamHighlight?"#8aceaa":null,pulse,{rx:r,ry:3,y:10,color:"#111b19a0"});
 c.save();c.translate(z.x,z.y);c.scale(scale,scale);
 if(z.moveOrder){c.strokeStyle="#b5d4a1";c.globalAlpha=.52;c.setLineDash([3,3]);c.beginPath();c.moveTo(0,0);c.lineTo((z.moveOrder.x-z.x)/scale,(z.moveOrder.y-z.y)/scale);c.stroke();c.setLineDash([]);c.globalAlpha=1;}
 if(howlTime>0){c.strokeStyle="#d7e68a99";c.beginPath();c.arc(0,0,r+3+Math.sin(z.age*12)*2,0,Math.PI*2);c.stroke();}
 if(preferences.healthBars&&z.hp<z.maxHp){c.fillStyle="#172018";c.fillRect(-r,-r-8,r*2,2);c.fillStyle="#8dc29d";c.fillRect(-r,-r-8,r*2*Math.max(0,z.hp/z.maxHp),2);}
 c.restore();
}
function drawParticle(p){
 const c=ctx,ratio=clamp(p.life/p.max,0,1);c.save();c.globalAlpha=ratio;
 if(p.type==="spore"||p.type==="infection"){
  c.strokeStyle=p.type==="spore"?"#b0e28a":"#82db9c";c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,(1-ratio)*(p.radius||39)+5,0,Math.PI*2);c.stroke();
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5+p.life*3;c.fillStyle="#b2e38b";c.fillRect(p.x+Math.cos(a)*(1-ratio)*45,p.y+Math.sin(a)*(1-ratio)*45,3,3);}
 }else if(p.type==="command"){
  c.strokeStyle="#d4ec98";c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,(1-ratio)*(p.radius||28)+5,0,Math.PI*2);c.stroke();
  c.beginPath();c.moveTo(p.x-5,p.y);c.lineTo(p.x+5,p.y);c.moveTo(p.x,p.y-5);c.lineTo(p.x,p.y+5);c.stroke();
 }else if(p.type==="spawn"||p.type==="howl"){
  c.strokeStyle=p.type==="spawn"?"#b5d985":"#e0dc8e";c.beginPath();c.arc(p.x,p.y,(1-ratio)*29+4,0,Math.PI*2);c.stroke();
 }else if(p.type==="blood"){
  c.fillStyle="#b25343";for(let i=0;i<5;i++){const a=i*2.4;c.fillRect(p.x+Math.cos(a)*(1-ratio)*20,p.y+Math.sin(a)*(1-ratio)*20,3,3);}
 }else if(p.type==="hit"||p.type==="bite"){
  c.fillStyle=p.type==="hit"?"#efaa86":"#e9daa5";for(let i=0;i<3;i++)c.fillRect(p.x+rnd(-6,6),p.y+rnd(-6,6),2,2);
 }else if(p.type==="escape"){c.strokeStyle="#ec7c68";c.beginPath();c.moveTo(p.x-5,p.y-5);c.lineTo(p.x+5,p.y+5);c.moveTo(p.x+5,p.y-5);c.lineTo(p.x-5,p.y+5);c.stroke();}
 c.restore();
}
function drawFloat(p){ctx.save();ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.textAlign="center";ctx.font="bold 11px system-ui";ctx.fillStyle=p.color;ctx.shadowColor="#071007";ctx.shadowBlur=4;ctx.fillText(p.text,p.x,p.y);ctx.restore();}
function updateUI(){
 updateProgressiveUI();
 $("energy-value").innerHTML=Math.floor(meta.energy)+' <i>/ '+energyMax()+'</i>';$("energy-meter").style.width=(meta.energy/energyMax()*100)+"%";
 $("biomass-value").textContent=Math.floor(meta.biomass);$("biomass-meter").style.width=(meta.biomass/(meta.biomass+100)*100)+"%";
 $("brains-value").textContent=Math.floor(meta.brains);$("brains-meter").style.width=Math.min(100,meta.brains*8)+"%";
 $("essence-value").textContent=Math.floor(meta.essence);$("essence-meter").style.width=Math.min(100,meta.essence*10)+"%";
 $("human-count").textContent=aliveHumans();$("zombie-count").textContent=aliveZombies();
 const gate=barriers[0],phase=gate?.destroyed?"防线崩溃":missionTime>42?"全面戒严":missionTime>15?"警戒升级":"潜伏扩散";$("barrier-status").textContent=gate?(gate.destroyed?phase:(phase+" · 路障 "+Math.ceil(gate.hp)+" / "+gate.maxHp)):"";
 $("shelter-hp").textContent=Math.ceil(shelter.hp)+" / "+shelter.maxHp;$("shelter-meter").style.width=(shelter.hp/Math.max(1,shelter.maxHp)*100)+"%";$("shelter-occupants").textContent=shelteredCount()+" 人";$("shelter-status").textContent=shelter.destroyed?"已被攻破":shelteredCount()?"收容中":"可用";$("shelter-status").classList.toggle("shelter-damaged",shelter.hp/shelter.maxHp<.35);
 $("alert-level").textContent=alert>=3?"极高":alert>=2?"升高":alert>=1?"注意":"低";
 $("alert-level").parentElement.classList.toggle("hot",alert>=2);
 $("time-label").textContent=fmtTime(missionTime);$("battle-state").textContent=ended?(endingType==="win"?"街区已沦陷":"围猎失败"):running?(paused?"战斗已暂停":aliveZombies()?"尸潮进攻中":"等待玩家投放"):"等待围猎开始";
 $("state-led").classList.toggle("active",running&&!paused);
 $("pause-button").disabled=!running||ended;$("pause-button").textContent=paused?"▶ 继续":"Ⅱ 暂停";
 $("speed-button").textContent="速度 ×"+speed;
 $("current-capacity").textContent=aliveZombies();$("max-capacity").textContent=capacity();
 const progress=clamp(neutralized/objectiveTarget,0,1);
 $("objective-meter").style.width=(progress*100)+"%";$("objective-progress").textContent="已处理 "+neutralized+" / "+objectiveTarget+" · 收容 "+shelteredCount()+" · 撤离 "+escaped;
 $("nest-capacity").textContent=capacity();$("nest-regen").textContent=energyRate().toFixed(1)+"/s";$("nest-infection").textContent=Math.round(infectionChance()*100)+"%";
 $("nest-level").textContent="LV. "+(1+Object.values(meta.upgrades).reduce((a,b)=>a+b,0));
 const costs={capacity:55+meta.upgrades.capacity*42,infection:70+meta.upgrades.infection*52,energy:65+meta.upgrades.energy*48};
 $("capacity-cost").textContent="◈ "+costs.capacity;$("infection-cost").textContent="◈ "+costs.infection;$("energy-cost").textContent="◈ "+costs.energy;
 $("upgrade-capacity").disabled=meta.biomass<costs.capacity||meta.upgrades.capacity>=5;
 $("upgrade-infection").disabled=meta.biomass<costs.infection||meta.upgrades.infection>=5;
 $("upgrade-energy").disabled=meta.biomass<costs.energy||meta.upgrades.energy>=5;
 $("policy-feed").classList.toggle("active",policy==="feed");$("policy-infect").classList.toggle("active",policy==="infect");
 $("skill-howl").disabled=!running||paused||meta.brains<2||howlCd>0||ended;
 $("skill-spore").disabled=!running||paused||meta.brains<3||sporeCd>0||ended;
 $("skill-howl").querySelector("em").textContent=howlCd>0?("冷却 "+Math.ceil(howlCd)+"s"):"脑髓 2";
 $("skill-spore").querySelector("em").textContent=sporeCd>0?("冷却 "+Math.ceil(sporeCd)+"s"):pendingSkill==="spore"?"点击地图":"脑髓 3";
 $("skill-spore").classList.toggle("skill-pending",pendingSkill==="spore");
 $("command-button").classList.toggle("active",commandMode);$("command-button").setAttribute("aria-pressed",commandMode?"true":"false");$("command-button").disabled=!running||paused||ended;
 $("setting-team-highlight").checked=preferences.teamHighlight;$("setting-health-bars").checked=preferences.healthBars;$("setting-low-power").checked=preferences.lowPower;
 $("selected-unit-name").textContent=UNITS[selectedUnit].name+"部署模式";
 $("selected-unit-description").textContent=UNITS[selectedUnit].desc;
 renderCampaignUI();
}
function renderCampaignUI(){
 const s=activeStage(),d=diff();
 $("region-label").textContent="战区 "+String(stage+1).padStart(2,"0")+" / "+COUNTRIES[country].name;
 $("mission-title").textContent=s.title;$("mission-summary").textContent=s.summary;
 $("mission-number").textContent=String(stage+1).padStart(2,"0");
 $("difficulty-desc").textContent=d.label;$("reward-multiplier").textContent="×"+d.reward.toFixed(1);
 $("objective-title").textContent="破门并吞噬 / 感染 "+objectiveTarget+" 名人类";
 document.querySelectorAll("[data-stage]").forEach(b=>{
  const index=Number(b.dataset.stage),unlocked=index<=(meta.cleared[country]||0);
  b.classList.toggle("active",index===stage);b.classList.toggle("locked-stage",!unlocked);
  b.querySelector("i").textContent=index===stage?"当前":index<(meta.cleared[country]||0)?"已清除":index>(meta.cleared[country]||0)?"未解锁":"已开放";
  b.disabled=!unlocked||running;
 });
 document.querySelectorAll("[data-difficulty]").forEach(b=>{b.classList.toggle("active",Number(b.dataset.difficulty)===difficulty);b.disabled=running;});
 $("country-select").value=country;$("country-select").disabled=running;
 document.querySelectorAll("[data-unit]").forEach(b=>{
  const u=b.dataset.unit,unlocked=unitUnlocked(u),visible=u==="walker"||core.isAvailable(meta,u);
  b.hidden=!visible;
  b.classList.toggle("selected",selectedUnit===u);b.classList.toggle("locked-unit",!unlocked);b.disabled=!unlocked;
  b.setAttribute("aria-pressed",selectedUnit===u?"true":"false");
  b.title=unlocked?UNITS[u].desc:visible?"前往巢群研究 "+UNITS[u].name:"推进章节后开放";
  const sub=b.querySelector(".unit-copy>strong small");if(sub)sub.textContent=unlocked?"已研究":"待研究";
 });
}
function renderOrgans(){
 const root=$("organ-list");let owned=0;root.innerHTML="";
 Object.keys(ORGANS).forEach(id=>{
  const o=ORGANS[id],count=meta.inventory[id]||0,isOn=isEquipped(id);if(count>0)owned+=count;
  const card=document.createElement("div");card.className="organ-card"+(isOn?" equipped":"");
  card.innerHTML='<div class="organ-top"><div class="organ-name"><span class="organ-icon">'+o.icon+'</span><strong>'+o.name+'</strong></div><span class="rarity '+o.cls+'">'+o.rarity+'</span></div><p>'+o.desc+'</p><div class="organ-bottom"><small>'+(count?"持有 ×"+count:"未发现 · "+o.source)+'</small><button class="organ-button" data-organ="'+id+'" '+(!count&& !isOn?'disabled':'')+'>'+(isOn?"卸下":count?"装备":"未获得")+'</button></div>';
  root.appendChild(card);
 });
 $("loot-count").textContent=Object.values(meta.inventory).reduce((a,b)=>a+b,0)+" / 4";
 root.querySelectorAll("[data-organ]").forEach(b=>b.addEventListener("click",()=>{
  const id=b.dataset.organ;
  if(isEquipped(id)){meta.equipped=meta.equipped.filter(x=>x!==id);toast("已卸下 "+ORGANS[id].name);}
  else{
   if(!organOwned(id)){toast("尚未发现这件突变器官。");return;}
   if(meta.equipped.length>=2){toast("器官槽已满，当前只能装备两件。");return;}
   meta.equipped.push(id);toast("已装备 "+ORGANS[id].name);
  }
  persist();renderOrgans();updateUI();
 }));
}
function renderUI(){updateUI();renderOrgans();}
function mainLoop(stamp){
 if(!lastStamp)lastStamp=stamp;
 const dt=Math.min(.12,Math.max(0,(stamp-lastStamp)/1000||0));lastStamp=stamp;
 if(running&&!paused&&!ended){
  simulationClock.advance(dt*speed,step=>{if(running&&!paused&&!ended)update(step);});
  saveClock+=dt;if(saveClock>3){persist();saveClock=0;}
 }else simulationClock.reset();
 if(toastClock>0){toastClock-=dt;if(toastClock<=0)$("toast").classList.remove("show");}
 uiClock+=dt;if(uiClock>=.15){updateUI();uiClock=0;}
 renderClock+=dt;const cadence=preferences.lowPower?1/30:(window.matchMedia?.("(pointer:coarse)")?.matches?1/40:1/60);
 if(renderClock>=cadence){if(!menuOpen)drawWorld();renderClock=0;}
 requestAnimationFrame(mainLoop);
}
function resetStage(){if(running&&!ended&&!confirm("正在进行的猎食将结束，确定重新部署吗？"))return;setupMission(true);toast("战场已重置，尸巢成长保留。");}
function selectCountry(value){
 if(running){toast("请先结束当前猎食。");$("country-select").value=country;return;}
 country=value;stage=Math.min(meta.cleared[country],2);meta.lastCountry=country;meta.lastStage=stage;persist();setupMission(true);renderCampaignUI();
}
function selectStage(value){
 const index=Number(value);
 if(index>(meta.cleared[country]||0)){toast("先清除前一关以解锁这里。");return;}
 if(running){toast("请先结束当前猎食。");return;}
 stage=index;meta.lastCountry=country;meta.lastStage=stage;persist();setupMission(true);
}
function selectDifficulty(value){
 if(running&&!ended){toast("战斗进行中无法更改难度。");return;}
 difficulty=Number(value);meta.lastDifficulty=difficulty;persist();setupMission(true);
}
function showHelpHint(){const hint=$("canvas-hint");hint.classList.remove("fade");setTimeout(()=>hint.classList.add("fade"),7500);}
const TUTORIAL_STEPS=[
 ["零号行动","点击「进入战场」，观察避难所和外部巡逻兵。"],
 ["01 / 亲手制造尸潮","默认选中行尸。点击街道空地投放第一只行尸；拖动地图可以平移。"],
 ["02 / 指挥目标","点击右上「⌖ 指挥」，再点避难所外的路障，把尸潮引向防线。"],
 ["03 / 集结破障","持续投放行尸分散火力，观察路障耐久。守卫会开枪，尸群需要不断补充。"],
 ["04 / 撕开避难所入口","外部路障已破！继续攻击入口耐久，迫使室内幸存者跑出来。"],
 ["05 / 感染扩张","避难所沦陷后点击下方「感染优先」，尝试把逃出的人类转化成新行尸。"]
];
function refreshTutorial(){
 const el=$("tutorial-card");if(!el)return;
 if(tutorialActive&&running&&tutorialStep===0)tutorialStep=1;
 el.hidden=!tutorialActive||ended;
 $("canvas-hint").classList.toggle("suppressed",tutorialActive&&!ended);
 if(!tutorialActive||ended)return;
 const info=TUTORIAL_STEPS[Math.min(tutorialStep,TUTORIAL_STEPS.length-1)];
 $("tutorial-title").textContent=info[0];$("tutorial-copy").textContent=info[1];
 $("tutorial-skip").textContent="跳过指引";
 document.querySelectorAll(".tutorial-focus").forEach(node=>node.classList.remove("tutorial-focus"));
 const focus=tutorialStep===1?document.querySelector('[data-unit="walker"]'):tutorialStep===2?$("command-button"):tutorialStep===5?$("policy-infect"):null;
 if(focus)focus.classList.add("tutorial-focus");
}
function completeTutorial(){
 tutorialActive=false;$("tutorial-card").hidden=true;
 document.querySelectorAll(".tutorial-focus").forEach(node=>node.classList.remove("tutorial-focus"));
 $("canvas-hint").classList.remove("suppressed");
 try{localStorage.setItem(TUTORIAL_KEY,"done");}catch(e){}
}
function applyUiLayout(){
 const shell=$("app-shell");
 for(const k of ["dock","hud","objective"]){
  shell.classList.toggle(k==="dock"?"dock-collapsed":k==="hud"?"hud-collapsed":"objective-collapsed",uiLayout[k]);
  const button=$(k+"-toggle");
  button.setAttribute("aria-expanded",String(!uiLayout[k]));
  button.setAttribute("aria-label",(uiLayout[k]?"展开":"收起")+(k==="dock"?"部署和技能栏":k==="hud"?"战场信息":"任务信息"));
 }
 $("dock-toggle").querySelector("small").textContent=uiLayout.dock?"展开操作":"收起操作";
 try{localStorage.setItem(UI_LAYOUT_KEY,JSON.stringify(uiLayout));}catch(e){}
 syncDockClearance();
}
function syncDockClearance(){
 const dock=$("bottom-dock");if(!dock)return;
 const height=dock.getBoundingClientRect().height;
 if(height>1)document.documentElement.style.setProperty("--dock-clearance",Math.ceil(height+20)+"px");
}


function hasCampaignSave(){
 try{return !!localStorage.getItem(core.SAVE_KEY);}catch(e){return false;}
}
function renderResearchUI(){
 for(const root of [$("menu-research-list"),$("research-list")]){
  if(!root)continue;
  root.replaceChildren();
  const available=core.RESEARCH.filter(x=>core.isAvailable(meta,x.id));
  if(!available.length){
   const p=document.createElement("p");p.className="research-empty";
   p.textContent="尚未采集到活性样本。先完成第一处感染区。";root.appendChild(p);continue;
  }
  for(const item of available){
   const owned=core.isResearched(meta,item.id);
   const card=document.createElement("div");card.className="research-item"+(owned?" researched":"");
   const body=document.createElement("div");body.className="research-description";
   const title=document.createElement("strong");title.textContent=item.name+(owned?" · 已完成":"");
   const sub=document.createElement("small");sub.textContent=item.summary;
   const lore=document.createElement("p");lore.textContent=item.story;
   body.append(title,sub,lore);
   const buy=document.createElement("button");buy.className="research-buy";
   buy.dataset.research=item.id;buy.disabled=owned||!core.canResearch(meta,item.id);
   buy.textContent=owned?"已研究":"◈ "+item.cost;
   buy.title=!owned&&meta.biomass<item.cost?"还需要 "+(item.cost-Math.floor(meta.biomass))+" 生物质":"";
   card.append(body,buy);root.appendChild(card);
   buy.addEventListener("click",()=>researchUnit(item.id));
  }
 }
}
function researchUnit(id){
 const data=core.RESEARCH.find(x=>x.id===id);
 if(!data||!core.isAvailable(meta,id)||core.isResearched(meta,id))return;
 if(!core.canResearch(meta,id)){toast("生物质不足：需要 "+data.cost+"。");return;}
 meta.biomass-=data.cost;meta.research[id]=true;persist();
 selectedUnit=id;
 log("巢群研究成功："+data.name+"。");toast("新尸种已研究："+data.name);
 renderResearchUI();refreshMenu();renderUI();
}
function refreshMenu(){
 const story=core.storyFor(meta);
 $("menu-story-kicker").textContent=story.kicker;
 $("menu-story-title").textContent=story.title;
 $("menu-story-copy").textContent=story.line+" "+story.goal;
 const continues=hasCampaignSave()||sessionActive;
 $("menu-continue").hidden=!continues;
 $("menu-continue").innerHTML=(sessionActive&&running&&!ended?"返回本局":"继续战役")+' <span>→</span>';
 $("menu-research-open").hidden=core.clearCount(meta)<1;
 $("menu-setting-team-highlight").checked=preferences.teamHighlight;
 $("menu-setting-health-bars").checked=preferences.healthBars;
 $("menu-setting-low-power").checked=preferences.lowPower;
 renderResearchUI();
}
function showMenuPage(name){
 $("menu-actions").hidden=name!=="home";
 $("menu-research-page").hidden=name!=="research";
 $("menu-settings-page").hidden=name!=="settings";
 if(name==="research")renderResearchUI();
}
function openMainMenu(){
 menuOpen=true;
 menuWasPaused=paused;
 if(running&&!ended)paused=true;
 $("main-menu").hidden=false;$("app-shell").classList.add("menu-open");
 closeDrawer();showMenuPage("home");refreshMenu();
}
function closeMainMenu(){
 menuOpen=false;
 $("app-shell").classList.remove("menu-open");$("main-menu").hidden=true;
 syncDockClearance();drawWorld();refreshTutorial();
}
function launchCampaign(newGame){
 if(newGame){
  if(hasCampaignSave()&&!confirm("开始新游戏会覆盖已有战役存档和研究进度，确定吗？"))return;
  meta=core.defaultSave();country="nz";stage=0;difficulty=0;policy="feed";selectedUnit="walker";
  try{localStorage.removeItem(TUTORIAL_KEY);}catch(e){}
  tutorialActive=true;tutorialStep=0;
  persist();
 }else if(sessionActive&&running&&!ended){
  closeMainMenu();paused=menuWasPaused;updateUI();return;
 }else{
  meta=core.loadSave(localStorage);
  country=meta.lastCountry;stage=Math.min(meta.lastStage,meta.cleared[country]||0,2);
  difficulty=meta.lastDifficulty;selectedUnit="walker";policy="feed";
  tutorialActive=false;
  try{tutorialActive=localStorage.getItem(TUTORIAL_KEY)!=="done"&&core.clearCount(meta)===0;}catch(e){}
  tutorialStep=0;
 }
 sessionActive=true;menuWasPaused=false;paused=false;speed=1;$("speed-button").textContent="速度 ×1";
 closeMainMenu();
 setupMission(false);beginMission();refreshMenu();
}
function setDrawerView(view){
 const panel=[...document.querySelectorAll("[data-drawer-view]")].find(el=>el.dataset.drawerView===view);
 if(!panel)return;
 document.querySelectorAll("[data-drawer-view]").forEach(el=>el.classList.toggle("active-view",el===panel));
 document.querySelectorAll("[data-drawer-tab]").forEach(el=>el.classList.toggle("active",el.dataset.drawerTab===view));
 document.querySelectorAll("[data-open-drawer]").forEach(el=>el.classList.toggle("active",el.dataset.openDrawer===view));
 const titles={campaign:"全球猎食地图",nest:"尸巢核心",loot:"突变器官",log:"尸巢记录",settings:"战场设置",shelter:"人类避难所"};
 $("drawer-title").textContent=titles[view]||"巢穴管理";
}
function openDrawer(view){
 setDrawerView(view);
 $("management-drawer").classList.add("open");
 $("drawer-backdrop").classList.add("visible");
}
function closeDrawer(){
 $("management-drawer").classList.remove("open");
 $("drawer-backdrop").classList.remove("visible");
}
$("menu-new").addEventListener("click",()=>launchCampaign(true));
$("menu-continue").addEventListener("click",()=>launchCampaign(false));
$("menu-research-open").addEventListener("click",()=>showMenuPage("research"));
$("menu-settings-open").addEventListener("click",()=>showMenuPage("settings"));
document.querySelectorAll("[data-menu-back]").forEach(b=>b.addEventListener("click",()=>showMenuPage("home")));
$("back-to-menu").addEventListener("click",openMainMenu);
for(const k of ["dock","hud","objective"])$(k+"-toggle").addEventListener("click",()=>{uiLayout[k]=!uiLayout[k];applyUiLayout();});
$("overlay-menu").addEventListener("click",openMainMenu);
for(const [id,key] of [["menu-setting-team-highlight","teamHighlight"],["menu-setting-health-bars","healthBars"],["menu-setting-low-power","lowPower"]]){
 $(id).addEventListener("change",e=>{
  preferences[key]=e.target.checked;savePreferences();
  if(key==="lowPower")refreshCanvasResolution();else drawWorld();
  updateUI();
 });
}
document.querySelectorAll("[data-open-drawer]").forEach(b=>b.addEventListener("click",()=>{
 const view=b.dataset.openDrawer;
 if($("management-drawer").classList.contains("open")&&document.querySelector('[data-drawer-view].active-view')?.dataset.drawerView===view){closeDrawer();return;}
 openDrawer(view);
}));
document.querySelectorAll("[data-drawer-tab]").forEach(b=>b.addEventListener("click",()=>setDrawerView(b.dataset.drawerTab)));
$("drawer-close").addEventListener("click",closeDrawer);
$("drawer-backdrop").addEventListener("click",closeDrawer);
setDrawerView("campaign");

$("overlay-action").addEventListener("click",()=>{
 const mode=$("overlay-action").dataset.mode;
 if(mode==="next"){
  stage=Math.min(2,stage+1);setupMission(false);beginMission();return;
 }
 if(mode==="map"){stage=0;showToastMap();return;}
 if(ended){setupMission(false);beginMission();return;}
 beginMission();
});
$("pause-button").addEventListener("click",()=>{if(!running||ended)return;paused=!paused;$("pause-button").textContent=paused?"▶ 继续":"Ⅱ 暂停";$("battle-state").textContent=paused?"战斗已暂停":"尸群正在猎食";});
$("speed-button").addEventListener("click",()=>{speed=speed===1?2:1;$("speed-button").textContent="速度 ×"+speed;});
$("command-button").addEventListener("click",()=>{
 if(!running||paused||ended){toast("先开始并继续战斗，再下达移动指令。");return;}
 commandMode=!commandMode;updateUI();
 $("canvas-hint").textContent=commandMode?"指挥模式：点击地图命令尸群移动；抵达后自动恢复追猎":"选择单位，再点击地图部署；可再次点击「指挥」移动尸群";$("canvas-hint").classList.remove("fade");
 if(commandMode)toast("指挥模式已开启：点击地图下达移动指令");
});
$("setting-team-highlight").addEventListener("change",e=>{preferences.teamHighlight=e.target.checked;savePreferences();drawWorld();toast(preferences.teamHighlight?"已开启敌我轮廓高亮":"已关闭敌我轮廓高亮");});
$("setting-health-bars").addEventListener("change",e=>{preferences.healthBars=e.target.checked;savePreferences();drawWorld();toast(preferences.healthBars?"已显示单位生命条":"已隐藏单位生命条");});
$("setting-low-power").addEventListener("change",e=>{preferences.lowPower=e.target.checked;savePreferences();refreshCanvasResolution();toast(preferences.lowPower?"节能渲染已开启":"节能渲染已关闭");});
document.querySelectorAll("[data-unit]").forEach(b=>b.addEventListener("click",()=>{
 const id=b.dataset.unit;
 if(!unitUnlocked(id)){toast("继续通关战区，才能解锁 "+UNITS[id].name+"。");return;}
 selectedUnit=id;document.querySelectorAll("[data-unit]").forEach(x=>x.classList.toggle("selected",x.dataset.unit===id));updateUI();showHelpHint();
}));
document.querySelectorAll("[data-difficulty]").forEach(b=>b.addEventListener("click",()=>selectDifficulty(b.dataset.difficulty)));
document.querySelectorAll("[data-stage]").forEach(b=>b.addEventListener("click",()=>selectStage(b.dataset.stage)));
$("country-select").addEventListener("change",e=>selectCountry(e.target.value));
$("policy-feed").addEventListener("click",()=>{policy="feed";updateUI();toast("暴食优先：提高猎食资源收益。");});
$("policy-infect").addEventListener("click",()=>{policy="infect";updateUI();toast("感染优先：成功感染会增加尸群数量。");if(tutorialActive&&tutorialStep>=5)completeTutorial();});
$("skill-howl").addEventListener("click",castHowl);
$("skill-spore").addEventListener("click",()=>{
 if(!running||paused||ended){toast("需要在进行中的战斗里使用技能。");return;}
 if(meta.brains<3){toast("脑髓不足，需要 3 点。");return;}
 if(sporeCd>0){toast("感染脉冲还在冷却。");return;}
 pendingSkill="spore";$("skill-spore").querySelector("em").textContent="点击地图";$("canvas-hint").textContent="点击目标区域释放感染脉冲";$("canvas-hint").classList.remove("fade");
});
$("upgrade-capacity").addEventListener("click",()=>upgrade("capacity"));
$("upgrade-infection").addEventListener("click",()=>upgrade("infection"));
$("upgrade-energy").addEventListener("click",()=>upgrade("energy"));
$("replay-stage").addEventListener("click",resetStage);
$("clear-log").addEventListener("click",()=>{$("event-log").innerHTML="";log("现场记录已清空。");});
$("help-button").addEventListener("click",()=>{tutorialActive=true;tutorialStep=running?1:0;refreshTutorial();if(!running)toast("点击中央「进入战场」，再按指引投放行尸。");});
$("tutorial-skip").addEventListener("click",()=>{completeTutorial();toast("已关闭指引，点击顶部「?」可重新查看。");});
$("reset-game").addEventListener("click",()=>{
 if(!confirm("确定清除本地演示存档？巢穴升级和收集的器官会全部丢失。"))return;
 core.clearSave(localStorage);meta=saveDefaults();country="nz";stage=0;difficulty=0;selectedUnit="walker";policy="feed";try{localStorage.removeItem(TUTORIAL_KEY);}catch(e){}tutorialActive=true;tutorialStep=0;setupMission(true);$("event-log").innerHTML="";log("巢穴已重置。新的猎食周期开始。");toast("本地存档已重置");
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&running&&!ended){paused=true;$("pause-button").textContent="▶ 继续";updateUI();}});
document.addEventListener("keydown",e=>{
 if(e.target?.matches?.("input,select,textarea,[contenteditable]"))return;
 if(e.key==="Escape"){
  if($("management-drawer").classList.contains("open"))closeDrawer();
  if(pendingSkill){pendingSkill="";$("canvas-hint").textContent="选择单位，再点击地图部署；可再次点击「指挥」移动尸群";toast("已取消技能瞄准。");}
  if(commandMode){commandMode=false;updateUI();toast("已取消指挥模式。");}
 }else if(["1","2","3","4"].includes(e.key)){
  const unit={1:"walker",2:"runner",3:"brute",4:"spitter"}[e.key],button=document.querySelector('[data-unit="'+unit+'"]');
  if(button&&!button.disabled)button.click();
 }else if(e.code==="Space"&&running&&!ended){e.preventDefault();$("pause-button").click();}
 else if(e.key.toLowerCase()==="f"&&running&&!ended){$("command-button").click();}
});
resizeWorld();
window.addEventListener("resize",()=>{resizeWorld();drawWorld();syncDockClearance();});
if(window.ResizeObserver)new ResizeObserver(syncDockClearance).observe($("bottom-dock"));
canvas.addEventListener("pointerdown",cameraPointerDown);
canvas.addEventListener("pointermove",cameraPointerMove);
canvas.addEventListener("pointerup",cameraPointerUp);
canvas.addEventListener("pointercancel",cameraPointerCancel);
canvas.addEventListener("wheel",handleMapWheel,{passive:false});
canvas.addEventListener("contextmenu",e=>e.preventDefault());
$("zoom-out").addEventListener("click",()=>zoomCamera(camera.zoom/1.15));
$("zoom-in").addEventListener("click",()=>zoomCamera(camera.zoom*1.15));
$("zoom-reset").addEventListener("click",()=>{resetCamera();drawWorld();});
setupMission(true);renderUI();applyUiLayout();refreshMenu();showMenuPage("home");showHelpHint();requestAnimationFrame(mainLoop);
if(window.__HUNGER_TEST_MODE__===true){
 window.__HUNGER_TEST__={
  menuState:()=>({menuOpen,sessionActive}),uiLayout:()=>({...uiLayout}),researchUnit,launchCampaign,openMainMenu,
  state:()=>({running,paused,missionTime,encounterStarted,country,stage,difficulty,endingType,tutorialStep,tutorialActive,neutralized,escaped,objectiveTarget,barriers:barriers.map(b=>({...b})),camera:{zoom:camera.zoom,x:camera.x,y:camera.y,maxZoom:camera.maxZoom},shelter:{x:shelter.x,y:shelter.y,hp:shelter.hp,maxHp:shelter.maxHp,destroyed:shelter.destroyed,building:shelter.building?{...shelter.building}:null},buildings:buildings.map(b=>({...b})),humans:humans.map(h=>({id:h.id,x:h.x,y:h.y,alive:h.alive,sheltered:h.sheltered,kind:h.kind,patrol:!!h.patrol})),zombies:zombies.map(z=>({x:z.x,y:z.y,alive:z.alive}))}),
  findPath,segmentBlocked,damageShelter,damageBarricade:(id,amount)=>damageBarricade(barriers.find(b=>b.id===id),amount),isBlocked,finishMission,selectCountry,resetStage,stepSimulation:update,convertHumanForTest:id=>{const h=humans.find(h=>h.id===id&&h.alive&&h.kind==="civilian");if(!h||h.sheltered)return false;convertHuman(h);return true;}
 };
}
})();