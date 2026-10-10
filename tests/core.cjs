const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const sandbox={window:{}};
for(const file of ["src/core/storage.js","src/core/clock.js"]){
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),sandbox,{filename:file});
}
const core=sandbox.window.HungerCore;
assert.ok(core?.loadSave&&core?.createClock,"Portable game core must load");
const map=new Map();
const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
let save=core.loadSave(storage);
assert.equal(save.schemaVersion,2);
assert.equal(save.biomass,80);
assert.equal(save.brains,5);
assert.equal(save.upgrades.capacity,0);
map.set(core.SAVE_KEY,JSON.stringify({
 biomass:123.5,brains:8,energy:65,upgrades:{capacity:2,infection:1,energy:0},
 inventory:{maw:1,plague:1},equipped:["maw","maw","plague","not-real"],
 firstRewards:["nz:0","nz:0","test:999"],cleared:{nz:1,pt:0}
}));
save=core.loadSave(storage);
assert.equal(save.biomass,123.5,"Old saves should preserve earned resources");
assert.equal(save.upgrades.capacity,2,"Old upgrades should persist");
assert.equal(save.equipped.length,2,"Equipment must be deduplicated");
assert.equal(save.firstRewards.length,1,"First rewards must be validated");
map.set(core.SAVE_KEY,'{"biomass":-10,"brains":"broken","upgrades":{"capacity":999},"inventory":{"evil":500}}');
save=core.loadSave(storage);
assert.equal(save.biomass,0);
assert.equal(save.brains,5);
assert.equal(save.upgrades.capacity,5);
assert.equal(Object.keys(save.inventory).length,0);
map.set(core.SAVE_KEY,"{invalid JSON");
assert.equal(core.loadSave(storage).biomass,80,"Corrupt saves must recover safely");
save=core.defaultSave();
save.biomass=999.25;
assert.equal(core.saveSave(storage,save),true);
assert.equal(core.loadSave(storage).biomass,999.25);
assert.equal(core.clearSave(storage),true);
assert.equal(core.loadSave(storage).biomass,80);
assert.equal(core.savePrefs(storage,{teamHighlight:false,healthBars:true}),true);
assert.equal(core.loadPrefs(storage).teamHighlight,false);
assert.equal(core.savePrefs(storage,{teamHighlight:true,healthBars:true,lowPower:true}),true);
assert.equal(core.loadPrefs(storage).lowPower,true);
const blockedStorage={getItem(){throw Error("blocked")},setItem(){throw Error("blocked")},removeItem(){throw Error("blocked")}};
assert.equal(core.loadSave(blockedStorage).energy,100,"Private/denied storage must not crash game");
assert.equal(core.saveSave(blockedStorage,save),false);
const clock=core.createClock({step:1/30,maxSteps:8});
let ticks=0,sum=0;
for(let i=0;i<60;i++)clock.advance(1/60,dt=>{ticks++;sum+=dt;});
assert.equal(ticks,30,"60Hz render rate must produce stable 30Hz simulation");
assert.ok(Math.abs(sum-1)<1e-8);
clock.reset();ticks=0;
clock.advance(.9,()=>ticks++);
assert.equal(ticks,8,"Frame stalls must cap catch-up work");
console.log("Core tests passed: legacy saves, corruption recovery, settings and fixed-step simulation.");
