(function(){
"use strict";
const $=id=>document.getElementById(id);
const canvas=$("world"),ctx=canvas.getContext("2d");
let W=760,H=600;const STORE="hunger-protocol-demo-v01";
const COUNTRIES={
 nz:{name:"新西兰 · 南湾",flag:"🇳🇿",theme:"coast",stages:[
  {title:"海岸镇：零号街区",summary:"封锁还没有合拢。让感染扩散，在救援抵达前吞噬街区。",pop:20,guards:2,goal:.62,bonus:"海湾残响"},
  {title:"公路检查站",summary:"救援车队正通过检查站。击穿路障，切断撤离通道。",pop:23,guards:3,goal:.65,bonus:"军用血袋"},
  {title:"隔离中心",summary:"隔离区的警报已经拉响。人群正在向安全区集中。",pop:25,guards:4,goal:.67,bonus:"实验样本"}
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
 brute:{name:"重尸",cost:42,hp:205,speed:19,damage:25,rate:1.35,reach:20,color:"#b6b077",desc:"高耐久与高破坏力，对抗武装目标的前排。"}
};
const ORGANS={
 braincore:{name:"复生脑核",rarity:"史诗",cls:"epic",icon:"◉",desc:"感染成功时，有 20% 概率额外生成一只新生行尸。",source:"高难度精英 / 旧城区"},
 maw:{name:"暴食胃囊",rarity:"稀有",cls:"rare",icon:"◈",desc:"猎食收益 +45%，击杀人类会额外获得生物质。",source:"任意战区的精英目标"},
 plague:{name:"瘟疫腺体",rarity:"传奇",cls:"legendary",icon:"✺",desc:"感染成功后，有概率把感染扩散给附近人类。",source:"围猎 / 灭城难度"},
 carapace:{name:"骨甲壳",rarity:"史诗",cls:"epic",icon:"⬟",desc:"尸群最大生命 +25%，重尸攻击伤害额外提高。",source:"检查站 / 隔离区"}
};
const saveDefaults=()=>({biomass:80,brains:5,essence:0,energy:100,upgrades:{capacity:0,infection:0,energy:0},inventory:{},equipped:[],cleared:{nz:0,pt:0},firstRewards:[],mutations:0});
let meta=saveDefaults();
try{const raw=localStorage.getItem(STORE);if(raw){const loaded=JSON.parse(raw);meta=Object.assign(saveDefaults(),loaded);meta.upgrades=Object.assign(saveDefaults().upgrades,loaded.upgrades||{});meta.inventory=loaded.inventory||{};meta.equipped=loaded.equipped||[];meta.cleared=Object.assign({nz:0,pt:0},loaded.cleared||{});meta.firstRewards=loaded.firstRewards||[];}}catch(e){}
const PREFS_KEY="hunger-protocol-prefs-v1";
let preferences={teamHighlight:true,healthBars:true};
try{preferences=Object.assign({},preferences,JSON.parse(localStorage.getItem(PREFS_KEY)||"{}"));}catch(e){}
let country="nz",stage=0,difficulty=0,selectedUnit="walker",policy="feed";
let humans=[],zombies=[],particles=[],floating=[],decor=[];
let running=false,paused=false,ended=false,endingType="",elapsed=0,lastStamp=0,uiClock=0,saveClock=0,speed=1,howlTime=0,howlCd=0,sporeCd=0,pendingSkill="",spawnId=1,missionTime=0,neutralized=0,escaped=0,casualties=0,alert=0,commandMode=false;
let objectiveTarget=16,toastClock=0,firstMission=true,initialOverlay=true;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rnd=(a,b)=>a+Math.random()*(b-a);
const worldScale=()=>clamp(Math.min(W/760,H/600),.82,1.85);
function savePreferences(){try{localStorage.setItem(PREFS_KEY,JSON.stringify(preferences));}catch(e){}}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const isEquipped=id=>meta.equipped.includes(id);
const activeStage=()=>COUNTRIES[country].stages[stage];
const diff=()=>DIFFICULTIES[difficulty];
const capacity=()=>18+meta.upgrades.capacity*6;
const energyMax=()=>100+meta.upgrades.energy*30;
const energyRate=()=>2+meta.upgrades.energy*.75;
const infectionChance=()=>clamp(.25+meta.upgrades.infection*.1+(isEquipped("braincore")?.12:0),.1,.85);
const unitCapacityCost=u=>u.type==="brute"?3:u.type==="runner"?1.15:1;
const aliveHumans=()=>humans.filter(h=>h.alive).length;
const aliveZombies=()=>zombies.filter(z=>z.alive).length;
const aliveCivilians=()=>humans.filter(h=>h.alive&&h.kind==="civilian").length;
const organOwned=id=>(meta.inventory[id]||0)>0;
function persist(){try{localStorage.setItem(STORE,JSON.stringify(meta));}catch(e){}}
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
 for(const b of buildings){if(x>b.x-pad&&x<b.x+b.w+pad&&y>b.y-pad&&y<b.y+b.h+pad)return true;}return false;
}
let buildings=[];
function layoutBuildings(){
 const portrait=W/H<.78,cols=portrait?[.16,.5,.84]:[.12,.37,.63,.88],rows=portrait?[.1,.3,.5,.7,.9]:[.12,.38,.62,.88];
 const bw=W*(portrait?.19:.155),bh=H*(portrait?.105:.135),out=[];
 rows.forEach((ry,ri)=>cols.forEach((cx,ci)=>out.push({x:cx*W-bw/2,y:ry*H-bh/2,w:bw*rnd(.88,1.08),h:bh*rnd(.9,1.08),t:(ri+ci+stage)%3})));
 return out;
}
function resizeWorld(){
 const oldW=W,oldH=H,rect=canvas.getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 W=rect.width;H=rect.height;
 const dpr=Math.min(window.devicePixelRatio||1,2);
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
 if(oldW>0&&oldH>0&&(humans.length||zombies.length)){
  const sx=W/oldW,sy=H/oldH;
  [humans,zombies,particles,floating].forEach(list=>list.forEach(o=>{if(typeof o.x==="number")o.x*=sx;if(typeof o.y==="number")o.y*=sy;}));
 }
 buildings=layoutBuildings();
}
function setupMission(showOverlay=true){
 running=false;paused=false;ended=false;endingType="";elapsed=0;missionTime=0;uiClock=0;howlTime=0;howlCd=0;sporeCd=0;pendingSkill="";commandMode=false;neutralized=0;escaped=0;casualties=0;alert=0;particles=[];floating=[];zombies=[];humans=[];spawnId=1;
 const s=activeStage(),d=diff();
 const civilianCount=s.pop+d.pop+(stage?2:0);
 objectiveTarget=Math.ceil(civilianCount*(s.goal+d.goal*.12));
 const guardCount=s.guards+d.guard;
 const hotspot={x:W*.5,y:H*.48},spawnRadius=Math.min(W,H)*.29;
 for(let i=0;i<civilianCount;i++){
  const p=freeSpotAround(hotspot.x,hotspot.y,spawnRadius);
  humans.push({id:"h"+spawnId++,x:p.x,y:p.y,hp:16*d.hp,maxHp:16*d.hp,kind:"civilian",alive:true,speed:rnd(17,22)*d.speed,attackCd:0,panic:false,infected:0,value:1,seed:rnd(0,100)});
 }
 for(let i=0;i<guardCount;i++){
  const p=freeSpotAround(hotspot.x,hotspot.y,spawnRadius);
  humans.push({id:"g"+spawnId++,x:p.x,y:p.y,hp:48*d.hp,maxHp:48*d.hp,kind:"guard",alive:true,speed:rnd(12,15)*d.speed,attackCd:rnd(.2,1),panic:false,infected:0,damage:8*d.hp,range:125,seed:rnd(0,100)});
 }
 if(difficulty>=2){
  const p=freeSpotAround(hotspot.x,hotspot.y,spawnRadius);
  humans.push({id:"e"+spawnId++,x:p.x,y:p.y,hp:100*d.hp,maxHp:100*d.hp,kind:"elite",alive:true,speed:14*d.speed,attackCd:.6,panic:false,infected:0,damage:16*d.hp,range:155,seed:rnd(0,100)});
 }
 drawWorld();renderUI();renderOrgans();
 if(showOverlay){
  initialOverlay=true;
  showOverlayCard("☣","FIRST CONTACT","猎食开始","在城市封锁前建立第一支尸群。选择暴食或感染策略，点击地图部署单位。","开始围猎");
 }else{
  initialOverlay=false;$("battle-overlay").classList.add("hidden");
  spawnStarterSquad();
 }
 log("进入 "+COUNTRIES[country].name+" / "+s.title+" · "+d.name+"。");
}
function spawnStarterSquad(){
 const lead=humans.find(h=>h.alive&&h.kind==="civilian")||{x:W*.5,y:H*.48};
 for(let i=0;i<4;i++){const p=freeSpotAround(lead.x,lead.y,74*worldScale(),14*worldScale());spawnZombie("walker",p.x,p.y,true);}
}
function showOverlayCard(symbol,kicker,title,copy,action){
 $("overlay-symbol").textContent=symbol;$("overlay-kicker").textContent=kicker;$("overlay-title").textContent=title;$("overlay-copy").textContent=copy;$("overlay-action").innerHTML=action+' <span>↗</span>';$("battle-overlay").classList.remove("hidden");
}
function hideOverlay(){ $("battle-overlay").classList.add("hidden");initialOverlay=false; }
function beginMission(){
 if(ended){setupMission(false);running=true;paused=false;elapsed=0;return;}
 if(!running){running=true;paused=false;if(zombies.length===0)spawnStarterSquad();log("猎食开始。尸群已获得猎杀授权。");toast("尸群已投放，点击地图继续部署");}
 hideOverlay();$("pause-button").disabled=false;$("state-led").classList.add("active");$("battle-state").textContent="尸群正在猎食";renderUI();
}
function spawnZombie(type,x,y,free=false){
 const spec=UNITS[type];if(!spec)return false;
 const live=zombies.filter(z=>z.alive);
 if(live.length>=capacity()){toast("尸群容量已满，升级尸巢以容纳更多单位。");return false;}
 if(!free&&meta.energy<spec.cost){toast("尸能不足，需要 "+spec.cost+" 点。");return false;}
 if(!free)meta.energy-=spec.cost;
 const p={x,y};
 if(isBlocked(x,y,8)){const spot=freeSpot();p.x=spot.x;p.y=spot.y;}
 const carapace=isEquipped("carapace")?1.25:1;
 zombies.push({id:"z"+spawnId++,type,x:p.x,y:p.y,hp:spec.hp*carapace,maxHp:spec.hp*carapace,speed:spec.speed,damage:spec.damage,attackCd:rnd(.1,.6),alive:true,age:0,trail:[],seed:rnd(0,500),hitFlash:0,moveOrder:null});
 particles.push({x:p.x,y:p.y,life:.5,max:.5,type:"spawn"});
 floating.push({x:p.x,y:p.y-14,text:free?"集结":("-"+spec.cost+" ϟ"),life:.9,max:.9,color:free?"#c6dfa0":"#b7d77b"});
 meta.mutations++;persist();return true;
}
function spawnAtCanvas(evt){
 if(!running||paused||ended){toast(ended?"先进入下一场猎食。":"先点击“开始围猎”启动战斗。");return;}
 const rect=canvas.getBoundingClientRect(),x=(evt.clientX-rect.left)/rect.width*W,y=(evt.clientY-rect.top)/rect.height*H;
 if(pendingSkill==="spore"){castSpore(x,y);return;}
 if(commandMode){commandHorde(x,y);return;}
 if(isBlocked(x,y,10)){toast("这里是建筑区，尸群无法从建筑内部投放。");return;}
 if(spawnZombie(selectedUnit,x,y)){toast(UNITS[selectedUnit].name+"已投放");renderUI();}
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
 const squad=zombies.filter(z=>z.alive);
 if(!squad.length){commandMode=false;updateUI();toast("尸群尚未集结，先部署单位。");return;}
 if(isBlocked(x,y,10)){
  const p=freeSpotAround(x,y,65*worldScale());x=p.x;y=p.y;
 }
 const radius=Math.min(46,13+squad.length*2.2)*worldScale();
 squad.forEach((z,i)=>{
  const angle=i*2.399963;
  const ring=Math.sqrt((i+.25)/Math.max(1,squad.length))*radius;
  z.moveOrder={x:clamp(x+Math.cos(angle)*ring,18,W-18),y:clamp(y+Math.sin(angle)*ring,28,H-28)};
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
 let found=null,best=Infinity;
 for(const h of humans){if(!h.alive)continue;const d=dist(z,h);if(d<best){best=d;found=h;}}
 return found;
}
function nearestZombie(h){
 let found=null,best=Infinity;
 for(const z of zombies){if(!z.alive)continue;const d=dist(h,z);if(d<best){best=d;found=z;}}
 return found;
}
function moveEntity(e,tx,ty,speed,dt){
 let dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1;
 if(d<1.5)return;
 dx/=d;dy/=d;
 let nx=e.x+dx*speed*dt,ny=e.y+dy*speed*dt;
 const pad=7*worldScale();
 if(isBlocked(nx,ny,pad)){
  const options=[
   {x:e.x-dy*speed*dt*1.3,y:e.y+dx*speed*dt*1.3},
   {x:e.x+dy*speed*dt*1.3,y:e.y-dx*speed*dt*1.3},
   {x:e.x+dx*speed*dt*.6,y:e.y+dy*speed*dt*.6}
  ].filter(p=>!isBlocked(p.x,p.y,7)).sort((a,b)=>Math.hypot(tx-a.x,ty-a.y)-Math.hypot(tx-b.x,ty-b.y));
  if(options.length){nx=options[0].x;ny=options[0].y;}else return;
 }
 const edge=9*worldScale();
 e.x=clamp(nx,edge,W-edge);e.y=clamp(ny,25*worldScale(),H-22*worldScale());
}
function exits(){return[{x:W-12,y:H*.5,label:"撤离"},{x:W*.5,y:H-12,label:"撤离"},{x:12,y:H*.5,label:"撤离"}];}
function closestExit(h){let best=exits()[0],bd=Infinity;for(const e of exits()){const d=dist(h,e);if(d<bd){bd=d;best=e;}}return best;}
function update(dt){
 meta.energy=clamp(meta.energy+energyRate()*dt,0,energyMax());
 if(howlTime>0)howlTime=Math.max(0,howlTime-dt);
 if(howlCd>0)howlCd=Math.max(0,howlCd-dt);
 if(sporeCd>0)sporeCd=Math.max(0,sporeCd-dt);
 missionTime+=dt;elapsed=missionTime;
 const liveZ=zombies.filter(z=>z.alive),liveH=humans.filter(h=>h.alive);
 alert=clamp(diff().alert+(liveZ.length>3?1:0)+(neutralized/objectiveTarget>.5?1:0),0,4);
 for(const h of liveH){
  h.attackCd=Math.max(0,h.attackCd-dt);
  const closest=nearestZombie(h),zd=closest?dist(h,closest):Infinity;
  if(h.kind==="civilian"){
   if(zd<150||alert>=2)h.panic=true;
   if(h.panic){
    const ex=closestExit(h);let tx=ex.x,ty=ex.y;
    if(closest&&zd<65){const ax=h.x-closest.x,ay=h.y-closest.y,ad=Math.hypot(ax,ay)||1;tx=h.x+ax/ad*140+(ex.x-h.x)*.35;ty=h.y+ay/ad*140+(ex.y-h.y)*.35;}
    moveEntity(h,tx,ty,h.speed*(h.panic?1.28:1)*worldScale(),dt);
    if(exits().some(e=>dist(h,e)<11)){h.alive=false;escaped++;particles.push({x:h.x,y:h.y,life:.5,max:.5,type:"escape"});}
   }else if(Math.random()<dt*.35){h.x=clamp(h.x+rnd(-15,15),10,W-10);h.y=clamp(h.y+rnd(-15,15),20,H-20);}
  }else{
   if(closest&&zd<h.range*worldScale()){if(h.attackCd<=0){h.attackCd=h.kind==="elite"?.52:.8;closest.hp-=h.damage;closest.hitFlash=.15;floating.push({x:closest.x,y:closest.y-10,text:"-"+Math.round(h.damage),life:.6,max:.6,color:"#e98779"});particles.push({x:closest.x,y:closest.y,life:.22,max:.22,type:"hit"});if(closest.hp<=0)killZombie(closest);}}
   else if(closest)moveEntity(h,closest.x,closest.y,h.speed*.6*worldScale(),dt);
  }
 }
 for(const z of liveZ){
  if(!z.alive)continue;
  z.age+=dt;z.attackCd-=dt;z.hitFlash=Math.max(0,z.hitFlash-dt);
  if(z.moveOrder){
   if(dist(z,z.moveOrder)>9*worldScale()){
    moveEntity(z,z.moveOrder.x,z.moveOrder.y,z.speed*(howlTime>0?1.75:1)*worldScale(),dt);continue;
   }
   z.moveOrder=null;
  }
  const target=nearestTarget(z);if(!target)continue;
  const d=dist(z,target);
  if(d<=UNITS[z.type].reach*worldScale()){
   if(z.attackCd<=0){
    const sp=UNITS[z.type],speedBonus=howlTime>0?1.75:1;
    z.attackCd=sp.rate/speedBonus;
    if(policy==="infect"&&target.kind==="civilian"&&Math.random()<infectionChance()){
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
   moveEntity(z,target.x,target.y,speed,dt);
  }
 }
 particles.forEach(p=>p.life-=dt);particles=particles.filter(p=>p.life>0);
 floating.forEach(p=>{p.life-=dt;p.y-=14*dt;});floating=floating.filter(p=>p.life>0);
 if(neutralized>=objectiveTarget){finishMission(true);return;}
 if(missionTime>=95){
  finishMission(neutralized>=Math.ceil(objectiveTarget*.78));return;
 }
 if(aliveHumans()===0&&neutralized>=Math.ceil(objectiveTarget*.8)){finishMission(true);return;}
 if(aliveZombies()===0&&meta.energy<12&&missionTime>25&&aliveHumans()>0){
  // Still allow energy regeneration and new deployments; no fail state here.
 }
}
function killHuman(h,mode){
 if(!h.alive)return;h.alive=false;neutralized++;casualties++;
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
function convertSplash(h){if(!h.alive)return;h.alive=false;neutralized++;casualties++;meta.brains++;meta.biomass+=2;if(zombies.filter(z=>z.alive).length<capacity())spawnZombie("walker",h.x,h.y,true);particles.push({x:h.x,y:h.y,life:.65,max:.65,type:"infection"});}
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
  const reward=Math.round((18+neutralized*1.35+stage*8)*diff().reward);
  meta.biomass+=reward;meta.brains+=Math.round(3+difficulty*1.5);meta.essence+=Math.max(1,difficulty);
  const first=!meta.firstRewards.includes(firstKey);
  if(first){meta.firstRewards.push(firstKey);meta.biomass+=30;meta.essence+=2;}
  if(difficulty>=2&&Math.random()<.58)dropOrgan(false);
  if(stage>=meta.cleared[country])meta.cleared[country]=Math.min(2,stage+1);
  persist();log("围猎成功：带回 "+reward+" 生物质、脑髓与突变精华。");
  showOverlayCard("☠","HUNT COMPLETE","街区已沦陷","吞噬/感染 "+neutralized+" 人，逃离 "+escaped+" 人。"+(first?"首次清除奖励已发放。":"战利品已回收。"),stage<2?"继续下一街区":"返回战区");
  $("overlay-action").dataset.mode=stage<2?"next":"map";
  toast("围猎完成 · 收获 "+reward+" 生物质");
 }else{
  const small=Math.round(neutralized*2);
  meta.biomass+=small;persist();log("围猎失败：目标撤离过多。尸巢仍保留本次战斗收获。");
  showOverlayCard("⚠","HUNT FAILED","人类突破封锁","已处理 "+neutralized+" 人，仍有 "+aliveHumans()+" 名人类存活。带回部分生物质，可以调整突变后重试。","重新围猎");
  $("overlay-action").dataset.mode="retry";
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
function showToastMap(){hideOverlay();running=false;ended=false;paused=false;updateCampaignUI();setupMission(true);}
function drawWorld(){
 const c=ctx,s=activeStage(),theme=COUNTRIES[country].theme;
 c.clearRect(0,0,W,H);
 const base=theme==="oldtown"?"#6a7051":"#3c6346",dark=theme==="oldtown"?"#576044":"#2f523a",light=theme==="oldtown"?"#7e805b":"#4d744d";
 c.fillStyle=base;c.fillRect(0,0,W,H);
 for(let y=0;y<H;y+=30)for(let x=0;x<W;x+=30){
  const n=((x*17+y*31+stage*7+difficulty*3)%13);
  c.fillStyle=n<4?dark:n<8?base:light;c.fillRect(x,y,29,29);
  if(n===2){c.fillStyle="#b2bd7930";c.fillRect(x+4,y+8,4,2);c.fillRect(x+19,y+20,3,3);}
 }
 // Responsive street grid adapts to portrait and landscape viewports.
 const portrait=W/H<.78;
 const roadH=clamp(H*(portrait?.055:.075),27,54),roadW=clamp(W*(portrait?.075:.055),25,60);
 const roadYs=portrait?[H*.2,H*.4,H*.6,H*.8]:[H*.25,H*.5,H*.75];
 const roadXs=portrait?[W/3,W*2/3]:[W*.25,W*.5,W*.75];
 c.fillStyle=theme==="oldtown"?"#6c6b59":"#555c4a";
 roadYs.forEach(y=>c.fillRect(0,y-roadH/2,W,roadH));
 roadXs.forEach(x=>c.fillRect(x-roadW/2,0,roadW,H));
 c.fillStyle="#b8b18c40";
 roadYs.forEach(y=>{for(let x=4;x<W;x+=42)c.fillRect(x,y-1,20,2);});
 roadXs.forEach(x=>{for(let y=5;y<H;y+=43)c.fillRect(x-1,y,2,20);});
 for(const y of roadYs)for(const x of roadXs){
  c.fillStyle="#d5cda05b";
  for(let i=0;i<5;i++){c.fillRect(x-roadW/2+3+i*7,y-roadH/2+3,4,Math.max(8,roadH-6));c.fillRect(x-roadW/2+3,y-roadH/2+3+i*7,Math.max(8,roadW-6),3);}
 }
 // Buildings and yards
 buildings.forEach((b,i)=>{
  const wall=theme==="oldtown"?["#b58b65","#ad795b","#c29a70"][b.t]:["#73856a","#6e8a78","#a39b70"][b.t];
  c.fillStyle="#18231a90";c.fillRect(b.x+5,b.y+7,b.w,b.h);
  c.fillStyle="#344535";c.fillRect(b.x-3,b.y-3,b.w+6,b.h+6);
  c.fillStyle=wall;c.fillRect(b.x,b.y,b.w,b.h);
  c.fillStyle=theme==="oldtown"?"#744e43":"#4c624b";c.fillRect(b.x-4,b.y-5,b.w+8,10);
  c.fillStyle="#ffffff0e";c.fillRect(b.x+4,b.y+5,b.w-8,3);
  const cols=Math.max(2,Math.floor(b.w/24));
  for(let ix=0;ix<cols;ix++)for(let iy=0;iy<Math.max(1,Math.floor(b.h/24));iy++){
   c.fillStyle=theme==="oldtown"?"#d9d0a4":"#243b32";
   c.fillRect(b.x+8+ix*22,b.y+14+iy*22,8,8);
   c.fillStyle="#4c5744";c.fillRect(b.x+10+ix*22,b.y+16+iy*22,4,4);
  }
  c.fillStyle="#354332";c.fillRect(b.x+b.w*.48,b.y+b.h-14,10,14);
  if((i+stage)%4===0){c.fillStyle="#c8bd7d";c.fillRect(b.x+b.w-10,b.y+b.h-7,5,3);}
 });
 // Road clutter / emergency vehicles
 drawCar(W*.35,H*.24,theme==="oldtown"?"#ab624d":"#64788b",false);
 drawCar(W*.69,H*.58,"#9d4f45",true);
 drawCar(W*.37,H*.83,"#c3b58a",false);
 // Scatter shrubs / fence
 for(let i=0;i<29;i++){
  const x=(i*137+41+stage*17)%W,y=(i*83+38+country.charCodeAt(0))%H;
  if(!isBlocked(x,y,4)){
   c.fillStyle="#213c2b";c.beginPath();c.arc(x,y,4+(i%3),0,Math.PI*2);c.fill();c.fillStyle="#55764b";c.fillRect(x-1,y-3,3,4);
  }
 }
 // Evac gates
 exits().forEach((e,i)=>{
  c.fillStyle="#df6350";c.fillRect(e.x-10,e.y-11,20,22);
  c.fillStyle="#ffe4bc";c.fillRect(e.x-5,e.y-6,10,12);
  c.fillStyle="#9d3e35";c.beginPath();c.moveTo(e.x-22,e.y-5);c.lineTo(e.x-13,e.y);c.lineTo(e.x-22,e.y+5);c.fill();
  c.font="bold 9px monospace";c.fillStyle="#ffd0aa";c.textAlign="center";c.fillText("EVAC",e.x-6,e.y-16);
 });
 // User ping / ability radius is represented by active pulse particles.
 // Entities
 humans.forEach(drawHuman);
 zombies.forEach(drawZombie);
 particles.forEach(drawParticle);
 floating.forEach(drawFloat);
 // Vignette
 const g=c.createRadialGradient(W/2,H/2,Math.min(W,H)*.22,W/2,H/2,Math.max(W,H)*.72);g.addColorStop(0,"#06100800");g.addColorStop(1,"#0510086b");c.fillStyle=g;c.fillRect(0,0,W,H);
}
function drawCar(x,y,color,vertical){
 ctx.save();ctx.translate(x,y);if(vertical)ctx.rotate(Math.PI/2);
 ctx.fillStyle="#172019";ctx.fillRect(-17,-8,34,16);ctx.fillStyle=color;ctx.fillRect(-14,-7,28,14);ctx.fillStyle="#c6d4b8";ctx.fillRect(-8,-5,11,10);ctx.fillStyle="#283f38";ctx.fillRect(5,-5,7,10);ctx.fillStyle="#e9d29c";ctx.fillRect(-14,-6,2,4);ctx.fillRect(-14,3,2,3);ctx.restore();
}
function drawHuman(h){
 if(!h.alive)return;const c=ctx;
 c.save();c.translate(h.x,h.y);c.scale(worldScale(),worldScale());
 if(preferences.teamHighlight){
  const civilian=h.kind==="civilian";
  c.save();c.globalAlpha=.92;c.lineWidth=1.6;c.strokeStyle=civilian?"#ffc36c":"#ff655f";c.fillStyle=civilian?"rgba(255,195,108,.13)":"rgba(255,91,91,.15)";
  c.beginPath();c.ellipse(0,2,civilian?9:12,civilian?8:11,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
 }
 if(h.kind==="civilian"){
  c.fillStyle="#18201770";c.beginPath();c.ellipse(1,5,5,3,0,0,Math.PI*2);c.fill();
  c.fillStyle=h.panic?"#d8b58b":"#d7c7a0";c.fillRect(-3,-1,7,8);c.fillStyle="#e8d5b0";c.fillRect(-2,-6,5,5);
  c.fillStyle="#3a2e26";c.fillRect(-1,-4,1,1);c.fillRect(1,-4,1,1);
  if(h.panic){c.strokeStyle="#e0a36f";c.globalAlpha=.8;c.beginPath();c.arc(0,0,8,0,Math.PI*2);c.stroke();}
 }else{
  c.fillStyle="#24262a";c.beginPath();c.ellipse(1,5,7,3,0,0,Math.PI*2);c.fill();
  c.fillStyle=h.kind==="elite"?"#b66c4d":"#71838d";c.fillRect(-5,-1,10,10);c.fillStyle=h.kind==="elite"?"#e1a06b":"#b3bdc0";c.fillRect(-4,-7,8,6);
  c.fillStyle="#313e48";c.fillRect(-4,-5,8,2);c.fillStyle="#e6d7a1";c.fillRect(-2,-4,2,1);c.fillRect(2,-4,2,1);
  c.fillStyle="#252e33";c.fillRect(3,1,10,3);c.fillRect(10,0,4,2);
  if(h.kind==="elite"){c.strokeStyle="#ef9c68";c.lineWidth=1.5;c.strokeRect(-7,-9,15,21);}
 }
 if(preferences.healthBars&&h.hp<h.maxHp){c.fillStyle="#161b15";c.fillRect(-8,-12,16,2);c.fillStyle=h.kind==="civilian"?"#d7a67a":"#df796b";c.fillRect(-8,-12,16*Math.max(0,h.hp/h.maxHp),2);}
 c.restore();
}
function drawZombie(z){
 if(!z.alive)return;const c=ctx,s=UNITS[z.type],r=z.type==="brute"?10:z.type==="runner"?6.5:7.5;
 c.save();c.translate(z.x,z.y);c.scale(worldScale(),worldScale());
 if(preferences.teamHighlight){c.save();c.globalAlpha=.94;c.lineWidth=1.7;c.strokeStyle="#a9ee8c";c.fillStyle="rgba(143,226,115,.13)";c.beginPath();c.ellipse(0,2,r+4,r+2,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}
 if(z.moveOrder){c.strokeStyle="#d6e997";c.globalAlpha=.6;c.beginPath();c.moveTo(0,0);c.lineTo((z.moveOrder.x-z.x)/worldScale(),(z.moveOrder.y-z.y)/worldScale());c.stroke();c.globalAlpha=1;}
 if(howlTime>0){c.strokeStyle="#d7e68a99";c.beginPath();c.arc(0,0,r+4+Math.sin(z.age*12)*2,0,Math.PI*2);c.stroke();}
 c.fillStyle="#132017a8";c.beginPath();c.ellipse(1,r*.7,r+2,r*.56,0,0,Math.PI*2);c.fill();
 c.fillStyle=z.hitFlash>0?"#f2e5b1":s.color;
 if(z.type==="runner"){c.rotate(-.5);c.fillRect(-r*.6,-r*.3,r*1.8,r*.9);c.fillRect(r*.55,-r*.9,r*.8,r*.8);c.fillStyle="#e5ebc8";c.fillRect(r*.8,-r*.6,2,2);}
 else if(z.type==="brute"){c.fillRect(-r,-r*.4,r*2,r*1.65);c.fillRect(-r*.65,-r*1.35,r*1.3,r);c.fillStyle="#596748";c.fillRect(-r*.9,r*.7,r*.65,r*.65);c.fillRect(r*.3,r*.7,r*.65,r*.65);c.fillStyle="#f1d99b";c.fillRect(-r*.4,-r*.95,3,2);c.fillRect(r*.12,-r*.95,3,2);}
 else{c.fillRect(-r*.72,-r*.2,r*1.45,r*1.25);c.fillRect(-r*.52,-r*1.05,r*1.05,r*.95);c.fillStyle="#e5ebc8";c.fillRect(-r*.35,-r*.73,2,2);c.fillRect(r*.12,-r*.73,2,2);c.fillStyle="#587953";c.fillRect(-r*1.05,r*.1,r*.4,r*.8);c.fillRect(r*.65,r*.1,r*.4,r*.65);}
 if(preferences.healthBars&&z.hp<z.maxHp){c.fillStyle="#172018";c.fillRect(-r,-r-7,r*2,2);c.fillStyle="#8db775";c.fillRect(-r,-r-7,r*2*Math.max(0,z.hp/z.maxHp),2);}
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
 $("energy-value").innerHTML=Math.floor(meta.energy)+' <i>/ '+energyMax()+'</i>';$("energy-meter").style.width=(meta.energy/energyMax()*100)+"%";
 $("biomass-value").textContent=Math.floor(meta.biomass);$("biomass-meter").style.width=(meta.biomass/(meta.biomass+100)*100)+"%";
 $("brains-value").textContent=Math.floor(meta.brains);$("brain-meter").style.width=Math.min(100,meta.brains*8)+"%";
 $("essence-value").textContent=Math.floor(meta.essence);$("essence-meter").style.width=Math.min(100,meta.essence*10)+"%";
 $("human-count").textContent=aliveHumans();$("zombie-count").textContent=aliveZombies();
 $("alert-level").textContent=alert>=3?"极高":alert>=2?"升高":alert>=1?"注意":"低";
 $("alert-level").parentElement.classList.toggle("hot",alert>=2);
 $("time-label").textContent=fmtTime(missionTime);$("battle-state").textContent=ended?(endingType==="win"?"街区已沦陷":"围猎失败"):running?(paused?"战斗已暂停":"尸群正在猎食"):"等待尸群部署";
 $("state-led").classList.toggle("active",running&&!paused);
 $("pause-button").disabled=!running||ended;$("pause-button").textContent=paused?"▶ 继续":"Ⅱ 暂停";
 $("speed-button").textContent="速度 ×"+speed;
 $("current-capacity").textContent=aliveZombies();$("max-capacity").textContent=capacity();
 const progress=clamp(neutralized/objectiveTarget,0,1);
 $("objective-meter").style.width=(progress*100)+"%";$("objective-progress").textContent="进度 "+neutralized+" / "+objectiveTarget+" · 逃离 "+escaped+" · 目标越少，警戒越高";
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
 $("setting-team-highlight").checked=preferences.teamHighlight;$("setting-health-bars").checked=preferences.healthBars;
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
 $("objective-title").textContent="吞噬或感染 "+objectiveTarget+" 名人类";
 document.querySelectorAll("[data-stage]").forEach(b=>{
  const index=Number(b.dataset.stage),unlocked=index<=(meta.cleared[country]||0);
  b.classList.toggle("active",index===stage);b.classList.toggle("locked-stage",!unlocked);
  b.querySelector("i").textContent=index===stage?"当前":index<(meta.cleared[country]||0)?"已清除":index>(meta.cleared[country]||0)?"未解锁":"已开放";
  b.disabled=!unlocked||running;
 });
 document.querySelectorAll("[data-difficulty]").forEach(b=>{b.classList.toggle("active",Number(b.dataset.difficulty)===difficulty);b.disabled=running;});
 $("country-select").value=country;$("country-select").disabled=running;
 document.querySelectorAll("[data-unit]").forEach(b=>{
  const u=b.dataset.unit,unlocked=u!=="brute"||meta.upgrades.capacity>0||stage>0;
  b.classList.toggle("selected",selectedUnit===u);b.classList.toggle("locked-unit",!unlocked);b.disabled=!unlocked;
  b.setAttribute("aria-pressed",selectedUnit===u?"true":"false");
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
 let dt=Math.min(.04,(stamp-lastStamp)/1000||0);lastStamp=stamp;
 if(running&&!paused&&!ended){
  const simDt=dt*speed;update(simDt);
  saveClock+=dt;if(saveClock>3){persist();saveClock=0;}
 }
 if(toastClock>0){toastClock-=dt;if(toastClock<=0)$("toast").classList.remove("show");}
 uiClock+=dt;if(uiClock>=.15){updateUI();uiClock=0;}
 drawWorld();
 requestAnimationFrame(mainLoop);
}
function resetStage(){if(running&&!ended&&!confirm("正在进行的猎食将结束，确定重新部署吗？"))return;setupMission(true);toast("战场已重置，尸巢成长保留。");}
function selectCountry(value){
 if(running){toast("请先结束当前猎食。");$("country-select").value=country;return;}
 country=value;stage=Math.min(meta.cleared[country],2);setupMission(true);updateCampaignUI();
}
function selectStage(value){
 const index=Number(value);
 if(index>(meta.cleared[country]||0)){toast("先清除前一关以解锁这里。");return;}
 if(running){toast("请先结束当前猎食。");return;}
 stage=index;setupMission(true);
}
function selectDifficulty(value){
 if(running&&!ended){toast("战斗进行中无法更改难度。");return;}
 difficulty=Number(value);setupMission(true);
}
function showHelpHint(){const hint=$("canvas-hint");hint.classList.remove("fade");setTimeout(()=>hint.classList.add("fade"),7500);}

function setDrawerView(view){
 const panel=[...document.querySelectorAll("[data-drawer-view]")].find(el=>el.dataset.drawerView===view);
 if(!panel)return;
 document.querySelectorAll("[data-drawer-view]").forEach(el=>el.classList.toggle("active-view",el===panel));
 document.querySelectorAll("[data-drawer-tab]").forEach(el=>el.classList.toggle("active",el.dataset.drawerTab===view));
 document.querySelectorAll("[data-open-drawer]").forEach(el=>el.classList.toggle("active",el.dataset.openDrawer===view));
 const titles={campaign:"全球猎食地图",nest:"尸巢核心",loot:"突变器官",log:"尸巢记录",settings:"战场设置"};
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
$("launch-button").addEventListener("click",()=>{if(ended){if(endingType==="win"&&stage<2){stage++;setupMission(false);beginMission();}else{setupMission(false);beginMission();}}else beginMission();});
$("world").addEventListener("pointerdown",spawnAtCanvas);
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
document.querySelectorAll("[data-unit]").forEach(b=>b.addEventListener("click",()=>{
 const id=b.dataset.unit;
 if(id==="brute"&&meta.upgrades.capacity===0&&stage===0){toast("先升级一次扩张巢穴，解锁重尸。");return;}
 if(running&&paused===false){} // Unit selection during battle is intentional.
 selectedUnit=id;document.querySelectorAll("[data-unit]").forEach(x=>x.classList.toggle("selected",x.dataset.unit===id));updateUI();showHelpHint();
}));
document.querySelectorAll("[data-difficulty]").forEach(b=>b.addEventListener("click",()=>selectDifficulty(b.dataset.difficulty)));
document.querySelectorAll("[data-stage]").forEach(b=>b.addEventListener("click",()=>selectStage(b.dataset.stage)));
$("country-select").addEventListener("change",e=>selectCountry(e.target.value));
$("policy-feed").addEventListener("click",()=>{policy="feed";updateUI();toast("暴食优先：提高猎食资源收益。");});
$("policy-infect").addEventListener("click",()=>{policy="infect";updateUI();toast("感染优先：成功感染会增加尸群数量。");});
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
$("reset-game").addEventListener("click",()=>{
 if(!confirm("确定清除本地演示存档？巢穴升级和收集的器官会全部丢失。"))return;
 localStorage.removeItem(STORE);meta=saveDefaults();country="nz";stage=0;difficulty=0;selectedUnit="walker";policy="feed";setupMission(true);$("event-log").innerHTML="";log("巢穴已重置。新的猎食周期开始。");toast("本地存档已重置");
});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&running&&!ended){paused=true;$("pause-button").textContent="▶ 继续";updateUI();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("management-drawer").classList.contains("open"))closeDrawer();if(pendingSkill){pendingSkill="";$("canvas-hint").textContent="选择单位，再点击地图部署；可再次点击「指挥」移动尸群";toast("已取消技能瞄准。");}if(commandMode){commandMode=false;updateUI();toast("已取消指挥模式。");}}});
resizeWorld();window.addEventListener("resize",()=>{resizeWorld();drawWorld();});
setupMission(true);renderUI();showHelpHint();requestAnimationFrame(mainLoop);
})();