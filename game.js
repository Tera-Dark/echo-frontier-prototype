(function(){
"use strict";
var PATH=[[3,0],[3,1],[3,2],[2,2],[1,2],[1,3],[1,4],[2,4],[3,4],[4,4],[5,4],[5,5],[5,6],[4,6],[3,6],[2,6],[2,7],[2,8],[3,8],[4,8],[4,9]];
var defs={
 bolt:{name:"脉冲炮",symbol:"⌁",cost:45,range:2.7,damage:15,cool:2,desc:"均衡的单体输出，适合组成基础防线。"},
 frost:{name:"霜蚀塔",symbol:"❄",cost:60,range:2.4,damage:7,cool:2,desc:"伤害较低，但会拖慢敌人，为其他炮塔争取输出时间。"},
 arc:{name:"裂弧塔",symbol:"ϟ",cost:75,range:2.2,damage:11,cool:3,desc:"攻击会向附近第二个目标传导，适合处理集群。"},
 node:{name:"共鸣节点",symbol:"⌘",cost:65,range:1.7,damage:0,cool:0,desc:"为范围内的攻击塔提供伤害增幅。"}
};
var relicDefs={
 still:{name:"静滞线圈",rarity:"稀有",kind:"rare",cost:95,echo:3,desc:"霜蚀塔减速效果增强；装备后全局控制时间延长。"},
 prism:{name:"裂光棱镜",rarity:"史诗",kind:"epic",cost:140,echo:5,desc:"裂弧塔获得额外弹射，并提高连锁伤害。"},
 bell:{name:"回响之钟",rarity:"传奇",kind:"epic",cost:210,echo:8,desc:"装备后击败精英额外获得 30 合金。"}
};
var baseDefaults=function(){return{alloy:160,echo:0,research:0,core:100,wave:1,stage:1,kills:0,towers:[],nextId:1,inventory:{},equipped:[],upgrades:{calibration:0,supply:0,capacity:0},log:["终灯站已上线。等待首次部署。"]};};
var state=baseDefaults(),selectedBuild="bolt",selectedTower=null,tab="relics",running=false,paused=false,speed=1,queue=[],enemies=[],tick=0,shotTick=0,toastTimer=null;
try{var old=localStorage.getItem("echo-frontier-save-v01");if(old){var saved=JSON.parse(old);state=Object.assign(baseDefaults(),saved);state.upgrades=Object.assign(baseDefaults().upgrades,saved.upgrades||{});state.towers=Array.isArray(saved.towers)?saved.towers:[];state.inventory=saved.inventory||{};state.equipped=saved.equipped||[];state.log=saved.log||[];}}catch(e){}
function $(id){return document.getElementById(id);}
function save(){try{localStorage.setItem("echo-frontier-save-v01",JSON.stringify(state));}catch(e){}}
function note(s){state.log.unshift(s);state.log=state.log.slice(0,12);$("log").innerHTML=state.log.map(function(x){return"<p>• "+esc(x)+"</p>";}).join("");}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function toast(s){var el=$("toast");el.textContent=s;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove("show");},1800);}
function hasRelic(id){return state.equipped.indexOf(id)>=0;}
function posKey(x,y){return x+","+y;}
function isPath(x,y){return PATH.some(function(p){return p[0]===x&&p[1]===y;});}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function renderBoard(){
 var board=$("board"),html="";
 for(var y=0;y<10;y++)for(var x=0;x<7;x++){
  var pathIndex=PATH.findIndex(function(p){return p[0]===x&&p[1]===y;}),tower=state.towers.find(function(t){return t.x===x&&t.y===y;}),enemy=enemies.find(function(e){var p=PATH[e.pos];return p&&p[0]===x&&p[1]===y;});
  var core=pathIndex===PATH.length-1,cl="cell"+(pathIndex>=0?" path":"")+(core?" core":"")+(tower?" built":"");
  var symbol=tower?defs[tower.type].symbol:(enemy?(enemy.boss?"♜":enemy.type==="runner"?"◆":enemy.type==="brute"?"♟":"◈"):(core?"⌂":""));
  html+='<button class="'+cl+'" data-cell="'+x+','+y+'" aria-label="'+x+','+y+'">'+(symbol?'<span class="'+(enemy?'enemy'+(enemy.boss?' boss':''):'symbol')+'">'+symbol+'</span>':'')+(tower?'<span class="level">'+tower.level+'</span>':'')+(enemy?'<span class="hp"><i style="width:'+Math.max(0,100*enemy.hp/enemy.max)+'%"></i></span>':'')+'</button>';
 }
 board.innerHTML=html;
}
function render(){
 ["alloy","alloy2"].forEach(function(id){$(id).textContent=state.alloy;});
 ["echo","echo2"].forEach(function(id){$(id).textContent=state.echo;});
 ["research","research2"].forEach(function(id){$(id).textContent=state.research;});
 $("core").textContent=state.core;$("chapter").textContent="第 "+String(state.stage).padStart(2,"0")+" 区域 · "+(state.stage===1?"旧城区":state.stage===2?"沉没档案馆":"回潮深层");
 $("stage-title").innerHTML=(state.stage===1?"失序街区":state.stage===2?"沉没档案馆":"回潮深层")+' <span class="muted">'+String(state.stage).padStart(2,"0")+'</span>';
 $("wave-label").textContent="波次 "+state.wave+" / 3";
 $("status").textContent=running?(paused?"战斗已暂停":"敌潮来袭 · "+enemies.length+" 个目标"):"规划阶段：布置你的防线";
 $("start").textContent=running?(paused?"继续战斗":"战斗进行中…"):"开始波次 →";$("start").disabled=running&&!paused;
 $("pause").textContent=paused?"继续":"暂停";
 $("speed").textContent="速度 ×"+speed;
 $("goal").textContent="区域 "+state.stage+"：击退三波回响，击败精英并收集专属战利品。当前击退 "+state.kills+" 个目标。";
 $("progress").style.width=Math.min(100,(state.wave-1)/3*100)+"%";$("progress-label").textContent="区域稳定度 · "+Math.round((state.wave-1)/3*100)+"%";
 document.querySelectorAll("[data-build]").forEach(function(b){b.classList.toggle("active",b.dataset.build===selectedBuild);});
 renderBoard();renderSide();
 var t=state.towers.find(function(v){return v.id===selectedTower;});
 $("upgrade-tower").disabled=!t||running;$("sell-tower").disabled=!t||running;
 if(t){var d=defs[t.type];$("inspect").querySelector("strong").textContent=d.name+" · Lv."+t.level;$("inspect").querySelector("p").textContent=d.desc+" 下一次升级费用 "+Math.round(d.cost*(.7+t.level*.55))+" 合金。";}
 else{$("inspect").querySelector("strong").textContent=defs[selectedBuild].name+" · 部署预览";$("inspect").querySelector("p").textContent=defs[selectedBuild].desc;}
}
function renderSide(){
 document.querySelectorAll("[data-tab]").forEach(function(b){b.classList.toggle("active",b.dataset.tab===tab);});
 var html="";
 if(tab==="relics"){
  html='<h3>遗物工坊</h3><p class="intro">反复出征获得残片与稀有战利品。打造提供明确目标，随机掉落带来额外惊喜。</p>';
  Object.keys(relicDefs).forEach(function(id){var r=relicDefs[id],owned=state.inventory[id]||0,equipped=hasRelic(id);
   html+='<div class="item"><div class="item-top"><strong>'+r.name+'</strong><span class="rarity '+r.kind+'">'+r.rarity+'</span></div><p>'+r.desc+'</p><div class="item-actions"><button class="button" data-action="equip" data-id="'+id+'" '+(!owned&&!equipped?'disabled':'')+'>'+(equipped?"已装备 · 卸下":owned?"装备遗物":"未拥有")+'</button><button class="button" data-action="craft" data-id="'+id+'">打造 · '+r.cost+'◆ / '+r.echo+'✧</button><span class="muted tiny">持有 '+owned+'</span></div></div>';
  });
  html+='<p class="intro">装备槽：'+state.equipped.length+' / '+(2+state.upgrades.capacity)+'。每件遗物改变防线的运作方式，而不只是增加数值。</p>';
 }else if(tab==="base"){
  html='<h3>终灯站 · 基地中枢</h3><p class="intro">把每次出征的成果转化为永久成长。基地设施提升后，新的防线策略也将逐步开放。</p>';
  var ups=[["calibration","炮塔校准",5,10,"防御塔伤害 +7% / 级"],["supply","后勤储备",4,8,"每个区域首波额外获得 20 合金 / 级"],["capacity","遗物矩阵",12,1,"遗物装备槽 +1"]];
  ups.forEach(function(u){var lv=state.upgrades[u[0]]||0,cost=u[2]+lv*u[2];html+='<div class="item"><div class="item-top"><strong>'+u[1]+'</strong><span class="rarity">Lv.'+lv+'/'+u[3]+'</span></div><p>'+u[4]+'</p><div class="item-actions"><button class="button" data-action="upgrade-base" data-id="'+u[0]+'" '+(lv>=u[3]||state.research<cost?'disabled':'')+'>研究升级 · '+cost+' 研究</button></div></div>';});
  html+='<p class="intro">研究数据来自通关奖励；升级永久保存于本地存档。</p>';
 }else{
  html='<h3>回响档案馆</h3><p class="intro">已知战术与敌人记录。更深层的回响会出现新的敌人组合。</p><div class="item"><strong>影蚀残响</strong><p>移动较快，试图绕过薄弱防线。霜蚀塔可以为主输出争取时间。</p></div><div class="item"><strong>重铠残响</strong><p>耐久较高，会对锚点造成更严重的损伤。集中火力处理它。</p></div><div class="item"><strong>精英回响</strong><p>每第三波出现，能带回稀有战利品或额外残片。</p></div><div class="item"><strong>已收集遗物</strong><p>静滞线圈 '+(state.inventory.still||0)+' · 裂光棱镜 '+(state.inventory.prism||0)+' · 回响之钟 '+(state.inventory.bell||0)+'</p></div>';
 }
 $("side-content").innerHTML=html;
}
function placeTower(key){
 if(running){toast("战斗进行中不能部署。请暂停后规划下一波。");return;}
 var xy=key.split(","),x=+xy[0],y=+xy[1];
 if(isPath(x,y)){toast("这里是敌人路径，无法建造。");return;}
 var existing=state.towers.find(function(t){return t.x===x&&t.y===y;});
 if(existing){selectedTower=existing.id;render();return;}
 var d=defs[selectedBuild];if(state.alloy<d.cost){toast("合金不足：需要 "+d.cost+"。");return;}
 state.alloy-=d.cost;state.towers.push({id:state.nextId++,type:selectedBuild,x:x,y:y,level:1,cool:0});
 selectedTower=state.towers[state.towers.length-1].id;note("部署 "+d.name+"，坐标 "+(x+1)+"/"+(y+1)+"。");save();render();
}
function upgradeTower(){
 var t=state.towers.find(function(a){return a.id===selectedTower;});if(!t)return;
 var cost=Math.round(defs[t.type].cost*(.7+t.level*.55));if(state.alloy<cost){toast("合金不足。");return;}
 state.alloy-=cost;t.level++;note(defs[t.type].name+"已升级至 Lv."+t.level+"。");save();render();
}
function sellTower(){
 var idx=state.towers.findIndex(function(t){return t.id===selectedTower;});if(idx<0)return;
 var t=state.towers[idx];state.alloy+=Math.round(defs[t.type].cost*.45*t.level);state.towers.splice(idx,1);selectedTower=null;note("拆除防御设施，回收部分合金。");save();render();
}
function startWave(){
 if(running&&paused){paused=false;render();return;}if(running)return;
 running=true;paused=false;tick=0;enemies=[];queue=[];if(state.wave===1&&state.upgrades.supply>0){var supplyBonus=20*state.upgrades.supply;state.alloy+=supplyBonus;note("后勤储备提供额外合金 +"+supplyBonus+"。");}
 var count=6+state.wave*2+Math.min(4,state.stage);
 for(var i=0;i<count;i++)queue.push({type:state.wave>=2&&Math.random()>.58?"runner":state.stage>=2&&Math.random()>.82?"brute":"shade",boss:false});
 if(state.wave===3)queue.push({type:"brute",boss:true});
 $("status").textContent="敌潮来袭";note("第 "+state.wave+" 波开始。调整火力，守住终点锚。");render();
}
function awardDrop(boss){
 state.alloy+=18+state.wave*3;state.echo+=boss?4:1;state.research+=3+state.wave;
 if(boss){
  var ids=["still","prism","bell"],id=ids[Math.floor(Math.random()*ids.length)];
  state.inventory[id]=(state.inventory[id]||0)+1;
  note("精英战利品：获得"+relicDefs[id].rarity+"遗物「"+relicDefs[id].name+"」！");
  toast("稀有战利品！"+relicDefs[id].name);
 }else if(Math.random()<.18){
  state.echo+=2;note("发现额外回响残片。");
 }
}
function completeWave(){
 running=false;paused=false;
 state.alloy+=20+state.wave*8;state.echo+=1;state.research+=4+state.wave*2;
 if(state.wave===3){state.stage++;state.wave=1;state.core=Math.min(100,state.core+12);note("区域稳定！基地记录了新的回响层。");toast("区域推进 · 新的回响层已开放");}
 else{state.wave++;note("波次清除，回收合金、残片与研究数据。");toast("防线守住了 · 战利品已回收");}
 enemies=[];queue=[];save();render();
}
function failWave(){
 running=false;paused=false;queue=[];enemies=[];state.core=0;note("锚点失守。远征暂时中止，基地进度保留。");$("status").textContent="锚点失守 · 修复后可再次出征";$("start").textContent="修复并继续";$("start").disabled=false;save();renderBoard();
}
function battleStep(){
 if(!running||paused)return;
 tick++;
 if(queue.length&&tick%2===0){
  var q=queue.shift(),boss=q.boss||false,base=20+state.wave*7+state.stage*5;
  enemies.push({id:Math.random().toString(36).slice(2),type:q.type,boss:boss,pos:0,max:boss?base*8:base*(q.type==="brute"?2.6:1),hp:boss?base*8:base*(q.type==="brute"?2.6:1),speed:q.type==="runner"?1.2:q.type==="brute"?.7:1,slow:0,damage:boss?18:q.type==="brute"?11:5});
 }
 enemies.slice().forEach(function(e){
  e.slow=Math.max(0,e.slow-1);
  if(tick%(e.slow>0?4:2)===0){e.pos++;if(e.pos>=PATH.length){state.core=Math.max(0,state.core-e.damage);enemies=enemies.filter(function(n){return n!==e;});note("敌人突破防线，锚点受损 -"+e.damage+"。");if(state.core<=0){failWave();return;}}}
 });
 state.towers.forEach(function(t){
  var d=defs[t.type];if(t.type==="node")return;
  t.cool=(t.cool||0)-1;if(t.cool>0)return;
  var p={x:t.x,y:t.y};
  var targets=enemies.filter(function(e){var q=PATH[e.pos];return q&&Math.hypot(p.x-q[0],p.y-q[1])<=d.range;}).sort(function(a,b){return b.pos-a.pos;});
  if(!targets.length)return;
  t.cool=d.cool;
  var mult=1+(state.upgrades.calibration||0)*.07;
  state.towers.forEach(function(n){if(n.type==="node"&&Math.hypot(n.x-t.x,n.y-t.y)<=defs.node.range)mult*=1.25;});
  
  targets.slice(0,t.type==="arc"?(hasRelic("prism")?3:2):1).forEach(function(e,index){
   var dmg=d.damage*t.level*mult*(index===0?1:.6);e.hp-=dmg;
   if(t.type==="frost")e.slow=hasRelic("still")?5:3;
   if(e.hp<=0){
    enemies=enemies.filter(function(n){return n!==e;});state.kills++;state.alloy+=3+(e.boss?15:0);
    if(e.boss){state.echo+=4;state.research+=6;var lootRoll=Math.random(),dropId=lootRoll<.55?"still":lootRoll<.88?"prism":"bell";state.inventory[dropId]=(state.inventory[dropId]||0)+1;if(hasRelic("bell"))state.alloy+=30;note("精英被击破！战利品：「"+relicDefs[dropId].name+"」。");toast("精英掉落："+relicDefs[dropId].name);}
    else if(Math.random()<.08){state.echo+=1;note("敌人残响中回收了 1 枚额外碎片。");}
   }
  });
 });
 if(state.core<=0){failWave();return;}
 if(queue.length===0&&enemies.length===0){completeWave();return;}
 renderStatsOnly();renderBoard();
}
function renderStatsOnly(){["alloy","alloy2"].forEach(function(id){$(id).textContent=state.alloy;});["echo","echo2"].forEach(function(id){$(id).textContent=state.echo;});["research","research2"].forEach(function(id){$(id).textContent=state.research;});$("core").textContent=state.core;$("wave-label").textContent="波次 "+state.wave+" / 3";$("status").textContent=paused?"战斗已暂停":"敌潮来袭 · "+enemies.length+" 个目标";}
function craft(id){
 var r=relicDefs[id];if(state.alloy<r.cost||state.echo<r.echo){toast("材料不足，继续出征收集残片。");return;}
 state.alloy-=r.cost;state.echo-=r.echo;state.inventory[id]=(state.inventory[id]||0)+1;note("工坊打造完成：「"+r.name+"」。");save();render();toast("打造完成："+r.name);
}
function equip(id){
 var owned=state.inventory[id]||0,idx=state.equipped.indexOf(id);
 if(idx>=0){state.equipped.splice(idx,1);toast("已卸下"+relicDefs[id].name);}
 else{if(!owned){toast("尚未拥有这件遗物。");return;}if(state.equipped.length>=2+state.upgrades.capacity){toast("遗物槽已满，请先卸下一件或升级基地。");return;}state.equipped.push(id);toast("已装备"+relicDefs[id].name);}
 save();render();
}
function upgradeBase(id){
 var cfg={calibration:{cost:5,max:10,name:"炮塔校准"},supply:{cost:4,max:8,name:"后勤储备"},capacity:{cost:12,max:1,name:"遗物矩阵"}}[id],lv=state.upgrades[id]||0,cost=cfg.cost*(lv+1);
 if(lv>=cfg.max||state.research<cost){toast("研究数据不足或已达到最高等级。");return;}
 state.research-=cost;state.upgrades[id]=lv+1;note("基地研究完成："+cfg.name+" Lv."+state.upgrades[id]+"。");save();render();
}
$("builds").addEventListener("click",function(e){var b=e.target.closest("[data-build]");if(!b)return;selectedBuild=b.dataset.build;selectedTower=null;render();});
$("board").addEventListener("click",function(e){var b=e.target.closest("[data-cell]");if(!b)return;var key=b.dataset.cell,xy=key.split(","),t=state.towers.find(function(v){return v.x===+xy[0]&&v.y===+xy[1];});if(t){selectedTower=t.id;render();}else placeTower(key);});
$("start").addEventListener("click",function(){if(state.core<=0){state.core=100;state.alloy=Math.max(state.alloy,35);note("锚点修复完成，远征重新开始。");save();render();return;}startWave();});
$("pause").addEventListener("click",function(){if(!running){toast("当前没有进行中的战斗。");return;}paused=!paused;render();});
$("speed").addEventListener("click",function(){speed=speed===1?2:1;$("speed").textContent="速度 ×"+speed;});
$("repair").addEventListener("click",function(){if(running){toast("请先暂停战斗再修复锚点。");return;}if(state.core>=100){toast("锚点状态良好。");return;}if(state.alloy<15){toast("合金不足。");return;}state.alloy-=15;state.core=Math.min(100,state.core+25);save();render();});
$("upgrade-tower").addEventListener("click",upgradeTower);$("sell-tower").addEventListener("click",sellTower);
document.querySelector(".tabs").addEventListener("click",function(e){var b=e.target.closest("[data-tab]");if(!b)return;tab=b.dataset.tab;renderSide();document.querySelectorAll("[data-tab]").forEach(function(x){x.classList.toggle("active",x.dataset.tab===tab);});});
$("side-content").addEventListener("click",function(e){var b=e.target.closest("[data-action]");if(!b)return;var id=b.dataset.id;switch(b.dataset.action){case"craft":craft(id);break;case"equip":equip(id);break;case"upgrade-base":upgradeBase(id);break;}});
$("reset").addEventListener("click",function(){if(!confirm("确定重置本地存档？所有基地和遗物进度将清空。"))return;localStorage.removeItem("echo-frontier-save-v01");state=baseDefaults();selectedTower=null;selectedBuild="bolt";tab="relics";running=false;paused=false;enemies=[];queue=[];render();toast("已重置存档。");});
setInterval(function(){for(var i=0;i<speed;i++)battleStep();},650);
render();
})();
