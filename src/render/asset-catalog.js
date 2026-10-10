/* Single catalog for reusable scenery resources.
   Assets are logical sprites with draw handlers (programmatic for now);
   replacing one with a PNG/spritesheet never changes map layout or collisions. */
(function(root){
"use strict";
const DEFINITIONS=Object.freeze({
 building:{category:"architecture",anchor:"footprint",layer:20,collider:"rectangle",variants:["tenement","factory","shelter"],frames:1},
 shelter:{category:"architecture",anchor:"entrance",layer:25,collider:"building",variants:["sealed","breached"],frames:1},
 barricade:{category:"obstacle",anchor:"center",layer:23,collider:"rectangle",variants:["intact","destroyed"],frames:1},
 vehicle:{category:"prop",anchor:"center",layer:12,collider:"none",variants:["sedan-a","sedan-b","sedan-c"],frames:1},
 lamppost:{category:"prop",anchor:"ground",layer:16,collider:"none",variants:["lit","unlit"],frames:1},
 vegetation:{category:"prop",anchor:"ground",layer:9,collider:"none",variants:["bush-a","bush-b","bush-c"],frames:1},
 fence:{category:"architecture",anchor:"start",layer:14,collider:"decorative",variants:["horizontal","vertical"],frames:1},
 evac:{category:"marker",anchor:"center",layer:26,collider:"none",variants:["exit"],frames:1}
});
const SCENE_PROPS=Object.freeze({
 vehicle:[
  {id:"sedan-01",at:[.35,.24],variant:"sedan-a"},
  {id:"sedan-02",at:[.69,.58],variant:"sedan-b"},
  {id:"sedan-03",at:[.37,.83],variant:"sedan-c"}
 ],
 lamppost:[
  {id:"lamp-01",at:[.24,.24],variant:"lit"},
  {id:"lamp-02",at:[.51,.75],variant:"lit"},
  {id:"lamp-03",at:[.77,.51],variant:"lit"}
 ]
});
const painters=new Map();
function register(id,painter){
 if(!Object.hasOwn(DEFINITIONS,id)||typeof painter!=="function")throw Error("Unknown scenery asset: "+id);
 painters.set(id,painter);
}
function draw(id,ctx,...args){
 const painter=painters.get(id);
 if(!painter)throw Error("Unregistered scenery asset: "+id);
 painter(ctx,...args);
}
function place(id,width,height){
 return(SCENE_PROPS[id]||[]).map(a=>({...a,x:width*a.at[0],y:height*a.at[1]}));
}
function list(){return Object.entries(DEFINITIONS).map(([id,data])=>({id,...data}));}
root.HungerAssets={DEFINITIONS,SCENE_PROPS,register,draw,place,list};
})(typeof window!=="undefined"?window:globalThis);
