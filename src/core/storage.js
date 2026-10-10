/* Versioned, platform-neutral save boundary. Keep legacy keys to preserve existing players. */
(function(root){
 "use strict";
 const SAVE_KEY="hunger-protocol-demo-v01",PREFS_KEY="hunger-protocol-prefs-v1",SCHEMA_VERSION=3;
 const defaults=()=>({schemaVersion:SCHEMA_VERSION,biomass:0,brains:0,essence:0,energy:100,upgrades:{capacity:0,infection:0,energy:0},inventory:{},equipped:[],cleared:{nz:0,pt:0},firstRewards:[],mutations:0,research:{runner:false,brute:false,spitter:false},discovered:{biomass:false,brains:false,essence:false},lastCountry:"nz",lastStage:0,lastDifficulty:0});
 const isObject=v=>!!v&&typeof v==="object"&&!Array.isArray(v);
 const bounded=(v,fallback,min,max)=>typeof v==="number"&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
 const allowedOrgans=new Set(["braincore","maw","plague","carapace"]);
 function normalizeSave(source){
  const d=defaults(),raw=isObject(source)?source:{},up=isObject(raw.upgrades)?raw.upgrades:{},cleared=isObject(raw.cleared)?raw.cleared:{},inventory=isObject(raw.inventory)?raw.inventory:{};
  const result={...d};
  for(const key of ["biomass","brains","essence","energy"])result[key]=bounded(raw[key],d[key],0,1e9);
  result.mutations=bounded(raw.mutations,0,0,1e9);
  result.upgrades={capacity:bounded(up.capacity,0,0,5),infection:bounded(up.infection,0,0,5),energy:bounded(up.energy,0,0,5)};
  result.cleared={nz:bounded(cleared.nz,0,0,3),pt:bounded(cleared.pt,0,0,3)};
  const clear=Math.max(result.cleared.nz,result.cleared.pt);
  const research=isObject(raw.research)?raw.research:null;
  result.research={runner:research?research.runner===true:clear>=1,brute:research?research.brute===true:clear>=2,spitter:research?research.spitter===true:clear>=3};
  const discovered=isObject(raw.discovered)?raw.discovered:null;
  result.discovered={biomass:discovered?discovered.biomass===true:!!(source&&Object.keys(raw).length),brains:discovered?discovered.brains===true:!!(source&&Object.keys(raw).length),essence:discovered?discovered.essence===true:!!(source&&Object.keys(raw).length)};
  result.lastCountry=raw.lastCountry==="pt"?"pt":"nz";
  result.lastStage=bounded(raw.lastStage,Math.min(result.cleared[result.lastCountry],2),0,2);
  result.lastDifficulty=bounded(raw.lastDifficulty,0,0,3);
  result.inventory={};
  for(const id of allowedOrgans){if(inventory[id]!==undefined)result.inventory[id]=bounded(inventory[id],0,0,99);}
  result.equipped=Array.isArray(raw.equipped)?[...new Set(raw.equipped.filter(id=>allowedOrgans.has(id)&&result.inventory[id]>0))].slice(0,3):[];
  result.firstRewards=Array.isArray(raw.firstRewards)?[...new Set(raw.firstRewards.filter(x=>typeof x==="string"&&/^(nz|pt):[012]$/.test(x)))]:[];
  return result;
 }
 function safeRead(storage,key){
  try{const raw=storage.getItem(key);return raw?JSON.parse(raw):null;}catch(e){return null;}
 }
 function loadSave(storage){return normalizeSave(safeRead(storage,SAVE_KEY));}
 function saveSave(storage,meta){try{storage.setItem(SAVE_KEY,JSON.stringify(normalizeSave(meta)));return true;}catch(e){return false;}}
 function clearSave(storage){try{storage.removeItem(SAVE_KEY);return true;}catch(e){return false;}}
 function loadPrefs(storage){
  const raw=safeRead(storage,PREFS_KEY),p=isObject(raw)?raw:{};
  return{teamHighlight:typeof p.teamHighlight==="boolean"?p.teamHighlight:true,healthBars:typeof p.healthBars==="boolean"?p.healthBars:true,lowPower:typeof p.lowPower==="boolean"?p.lowPower:false};
 }
 function savePrefs(storage,prefs){try{storage.setItem(PREFS_KEY,JSON.stringify(loadPrefs({getItem:()=>JSON.stringify(prefs)})));return true;}catch(e){return false;}}
 root.HungerCore=Object.assign(root.HungerCore||{},{
  SAVE_KEY,PREFS_KEY,SCHEMA_VERSION,defaultSave:defaults,normalizeSave,loadSave,saveSave,clearSave,loadPrefs,savePrefs
 });
})(typeof window!=="undefined"?window:globalThis);
