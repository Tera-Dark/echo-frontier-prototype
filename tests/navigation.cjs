const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/core/navigation.js"),"utf8"),context);
const {createNavigator,moveAgent}=context.window.HungerCore;
assert.equal(typeof createNavigator,"function");
const obstacle={id:"shelter",x:75,y:60,w:72,h:82};
const nav=createNavigator({width:260,height:200,cell:10,clearance:6,obstacles:[obstacle]});
const start={x:34,y:95},goal={x:224,y:96};
assert.equal(nav.rayBlocked(start.x,start.y,goal.x,goal.y),true,"Direct line through the building must be blocked");
const route=nav.findPath(start.x,start.y,goal.x,goal.y);
assert.ok(route.length>=2,"Route must navigate around the building rather than through it");
assert.ok(nav.cacheSize()>=1,"Long routes should use a bounded shared A-star cache");
const sameRoute=nav.findPath(start.x+1,start.y+1,goal.x-1,goal.y-1);
assert.ok(sameRoute.length>=1&&nav.cacheSize()<=320,"Nearby agents must reuse grid paths without unbounded cache growth");
for(let i=0;i<route.length;i++){
 const prev=i?route[i-1]:start,next=route[i];
 assert.equal(nav.rayBlocked(prev.x,prev.y,next.x,next.y),false,"Every smoothed leg must respect entity clearance");
}
let agent={...start},index=0,frames=0;
while(frames++<2400&&Math.hypot(agent.x-goal.x,agent.y-goal.y)>6){
 if(index<route.length&&Math.hypot(agent.x-route[index].x,agent.y-route[index].y)<3)index++;
 const point=route[Math.min(index,route.length-1)];
 moveAgent(agent,point.x,point.y,42,1/30,nav,{radius:6});
 assert.equal(nav.inside(agent.x,agent.y,6),false,"Agent must not enter inflated building or outside map");
}
assert.ok(Math.hypot(agent.x-goal.x,agent.y-goal.y)<7,"Agent must cross the complex building corner and reach goal");
const reachable=nav.approachRect(35,100,obstacle,11);
assert.equal(nav.inside(reachable.x,reachable.y),false,"Assault destination must be outside structure");
assert.ok(nav.findPath(35,100,reachable.x,reachable.y).length>0,"Assault entry must be reachable");
const blockedWall=createNavigator({width:200,height:130,cell:10,clearance:6,obstacles:[{id:"wall",x:93,y:0,w:14,h:130}]});
assert.equal(blockedWall.findPath(40,65,170,65).length,0,"Unreachable targets must return no path rather than a wall-piercing path");
const free=createNavigator({width:120,height:120,cell:12,clearance:6,obstacles:[]});
const corner=free.findPath(10,10,100,100);
assert.ok(corner.length<=2,"Open terrain should be smoothed into a direct route");
const cat={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../src/render/asset-catalog.js"),"utf8"),cat);
const asset=cat.window.HungerAssets;
assert.ok(asset.list().length>=8,"Scenery must have a central reusable catalog");
assert.equal(asset.place("vehicle",800,600).length,3);
assert.equal(asset.DEFINITIONS.building.collider,"rectangle","Art footprint must specify physical collision intent");
console.log("Navigation tests passed: geometry clearance, smoothed corner crossing, barricade approaches, unreachable wall, open terrain and asset catalog.");
