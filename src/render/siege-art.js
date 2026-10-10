/* DUSK SIEGE / reusable pixel art painters.
   Ground coordinates are the existing navigation coordinates. Architectural
   depth is screen-space only and never changes collision or touch anchors. */
(function(root){
"use strict";
const assets=root.HungerAssets;
if(!assets?.register)throw new Error("Missing HungerAssets catalog");
const P={
 asphalt:"#262f30",road:"#30383a",edge:"#6b7165",pavement:"#555b53",
 earth:"#303b31",earth2:"#3d4635",moss:"#58624a",dark:"#111a1a",
 roof:"#373f40",roofLite:"#53605c",wall:"#6c655b",brick:"#816b5c",
 amber:"#edb36b",window:"#ffc87c",rust:"#a25843",blood:"#79392f",
 acid:"#89c9a3",copper:"#a4805a",cyan:"#799b97",shelter:"#404f4a"
};
const r=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));};
function polygon(c,points,color){c.fillStyle=color;c.beginPath();c.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)c.lineTo(points[i][0],points[i][1]);c.closePath();c.fill();}
function line(c,x,y,x2,y2,color,size=1){c.strokeStyle=color;c.lineWidth=size;c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}
function noise(x,y,seed=0){const n=Math.sin(x*127.1+y*311.7+seed*19.13)*43758.5453;return n-Math.floor(n);}
function glow(c,x,y,radius,color){const g=c.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color);g.addColorStop(1,"#ffb76500");c.fillStyle=g;c.fillRect(x-radius,y-radius,radius*2,radius*2);}
function base(c,{w,h,stage,portrait}){
 r(c,0,0,w,h,P.earth);
 for(let y=0;y<h;y+=16)for(let x=0;x<w;x+=16){
  const n=noise(x,y,stage);
  r(c,x,y,16,16,n<.23?P.earth2:n<.4?"#344135":P.earth);
  if(n>.85){r(c,x+3,y+8,3,2,P.moss);r(c,x+10,y+3,2,2,"#667056");}
 }
 const roadYs=portrait?[h*.2,h*.4,h*.6,h*.8]:[h*.25,h*.5,h*.75];
 const roadXs=portrait?[w/3,w*2/3]:[w*.25,w*.5,w*.75];
 const rh=Math.max(27,Math.min(54,h*(portrait?.055:.075))),rw=Math.max(25,Math.min(60,w*(portrait?.075:.055)));
 roadYs.forEach(y=>{
  r(c,0,y-rh*.5-5,w,rh+10,"#6f72634d");r(c,0,y-rh*.5,w,rh,P.road);
  r(c,0,y-rh*.5,w,2,"#72776d");r(c,0,y+rh*.5-2,w,2,"#1d2624");
  for(let x=0;x<w;x+=27){r(c,x+9,y,11,1,"#92947c70");r(c,x+noise(x,y,1)*17,y-rh*.3,2,2,"#252b2b");}
 });
 roadXs.forEach(x=>{
  r(c,x-rw*.5-5,0,rw+10,h,"#71796c40");r(c,x-rw*.5,0,rw,h,P.road);
  r(c,x-rw*.5,0,2,h,"#747a6c");r(c,x+rw*.5-2,0,2,h,"#202927");
  for(let y=0;y<h;y+=27)r(c,x,y+9,1,11,"#95988165");
 });
 for(let y=8;y<h;y+=20)for(let x=8;x<w;x+=20){
  const n=noise(x,y,stage+9);
  if(n>.93){r(c,x,y,2,3,"#7b8760");r(c,x+3,y-2,2,2,"#4d674b");}
  if(n<.023){line(c,x,y,x+8,y+4,"#20272a",1);line(c,x+8,y+4,x+5,y+9,"#20272a",1);}
 }
 // Puddles, tyre marks, dried contamination; limited contrast for legibility.
 for(let i=0;i<16;i++){
  const x=noise(i,stage,2)*w,y=noise(i,stage,17)*h;
  r(c,x,y,6+i%4*3,2,"#121d2070");
  if(i%3===0){r(c,x+4,y-2,6,2,"#7e433c88");r(c,x+11,y+3,3,2,P.blood);}
 }
 // Broken road crossings signal navigable avenues.
 for(const y of roadYs)for(const x of roadXs){
  for(let k=-2;k<=2;k++)r(c,x-18+k*8,y-rh*.5+3,4,Math.max(7,rh-6),"#a7a69a78");
 }
 // Edge-of-map silhouettes and sunset mist.
 const edge=c.createRadialGradient(w*.53,h*.45,Math.min(w,h)*.12,w*.53,h*.45,Math.max(w,h)*.78);
 edge.addColorStop(0,"#10191900");edge.addColorStop(1,"#071011b0");c.fillStyle=edge;c.fillRect(0,0,w,h);
}
function building(c,b,i,{shelter=false,stage=0}={}){
 const x=Math.round(b.x),y=Math.round(b.y),w=Math.round(b.w),h=Math.round(b.h);
 const ht=Math.max(13,Math.min(36,(shelter?30:17)+(i%3)*4));
 const roofTop=y-ht,shift=shelter?10:5;
 r(c,x+6,y+7,w+4,h+4,"#0a1212b8");
 // Facade + warm windows. Top-down collision aligns with real footprint.
 polygon(c,[[x+w,y],[x+w+shift,y-ht],[x+w+shift,y+h-ht],[x+w,y+h]],shelter?"#343b38":"#434641");
 polygon(c,[[x,y],[x,y+h],[x+w,y+h],[x+w,y]],shelter?"#65594c":"#60594e");
 for(let py=y+6;py<y+h-5;py+=11){line(c,x+1,py,x+w-2,py,shelter?"#867052":"#777165",1);}
 for(let px=x+6;px<x+w;px+=18)for(let py=y+6;py<y+h-8;py+=19){
  r(c,px,py,7,8,"#222b29");r(c,px+1,py+1,5,5,shelter?"#d5a16a":((i+px+py)%3===0?"#a68a5d":"#374b48"));
  r(c,px,py+7,8,1,"#998673");
 }
 polygon(c,[[x-3,y-ht+2],[x+w+shift,y-ht+2],[x+w+3,y+4],[x-5,y+4]],shelter?P.shelter:P.roof);
 polygon(c,[[x-4,y-ht],[x+w+shift,y-ht],[x+w+shift+3,y-ht+5],[x-4,y-ht+5]],P.roofLite);
 // Large readable roof patches with water damage and pixel vents.
 for(let j=0;j<Math.min(13,Math.floor(w/9));j++){
  const px=x+j*9+4,py=y-ht+8+(j%3)*4;
  r(c,px,py,5,3,j%3===0?"#263437":"#54605a");r(c,px+2,py+1,2,1,"#87908760");
 }
 if(shelter){
  r(c,x+Math.round(w*.3),y-ht-2,Math.max(13,w*.38),7,"#232c30");
  for(let i=0;i<4;i++)line(c,x+w*.3+i*w*.09,y-ht,x+w*.3+i*w*.09,y-ht+5,"#657674",1);
  r(c,x+w*.18,y-ht-8,13,6,"#4c5d59");r(c,x+w*.18+2,y-ht-10,8,3,"#78837c");
  r(c,x+w*.61,y-ht+14,Math.max(18,w*.25),12,"#b3a591");
  c.fillStyle="#253b34";c.font="bold 9px monospace";c.fillText("SAFE",x+w*.63,y-ht+23);
  line(c,x+w*.74,y-ht,x+w*.74,y-ht-20,"#798780",2);
  r(c,x+w*.74-5,y-ht-21,11,3,"#a19b7d");
  // Defensive rooftop sentry silhouette and amber illumination.
  r(c,x+w*.8,y-ht-5,5,5,"#b88e69");r(c,x+w*.8-2,y-ht,9,9,"#546255");
  glow(c,x+w*.28,y+h*.83,Math.min(85,w*.64),"#f2af655e");
 }else{
  r(c,x+w*.17,y-ht-5,13,6,"#2b3537");r(c,x+w*.17+3,y-ht-9,7,4,"#738079");
 }
 // Rooftop rain gutter and masonry silhouette
 r(c,x-3,y-ht,w+shift+3,2,"#8d9180");
 r(c,x,y+h-3,w,3,"#2c302d");
}
function lamppost(c,x,y,lit){
 r(c,x-1,y-26,3,29,"#131c1b");r(c,x-2,y-27,12,3,"#333e3b");r(c,x+6,y-25,4,3,lit?"#ebba78":"#525955");
 if(lit)glow(c,x+7,y-23,46,"#f0b5686b");
}
function car(c,x,y,color){
 r(c,x-13,y+4,33,5,"#12191b");
 r(c,x-13,y-7,31,15,"#162122");r(c,x-10,y-9,27,14,color);
 r(c,x-4,y-7,13,10,"#283e41");r(c,x-4,y-6,8,6,"#647f7b");
 r(c,x-11,y-8,3,3,"#b3a789");r(c,x+14,y+3,3,2,"#b8513e");
 r(c,x-12,y+7,4,4,"#10191a");r(c,x+9,y+7,4,4,"#10191a");
 r(c,x+2,y-8,2,1,"#bd9774");
}
function vegetation(c,x,y,size){
 const n=noise(x,y,2);r(c,x-2,y-1,5,6,"#1b2c27");
 for(let j=0;j<4;j++){
  const dx=(j-1.5)*size*.48,dy=j%2?1:-3;
  r(c,x+dx-size*.42,y+dy-size*.34,size*.84,size*.8,j%2?"#334c3a":"#506146");
 }
 if(n>.5)r(c,x-1,y-3,3,2,"#80946a");
}
function fence(c,x,y,length,vertical=false){
 c.save();c.strokeStyle="#242b29";c.lineWidth=2;c.beginPath();
 if(vertical){c.moveTo(x,y);c.lineTo(x,y+length);}else{c.moveTo(x,y);c.lineTo(x+length,y);}c.stroke();
 for(let i=0;i<=length;i+=9){
  const px=x+(vertical?0:i),py=y+(vertical?i:0);
  r(c,px-1,py-8,3,10,"#262f30");r(c,px-2,py-10,5,2,"#788078");
 }
 c.restore();
}
function barricade(c,b){
 if(b.destroyed||b.hp<=0)return;
 const x=b.x-b.w/2,y=b.y-b.h/2;
 r(c,x-4,y+5,b.w+8,b.h+5,"#141c1db3");
 r(c,x,y,b.w,b.h,"#484d45");r(c,x,y-5,b.w,5,"#86806a");
 for(let i=0;i<b.w-6;i+=13){
  r(c,x+i+2,y-3,5,b.h+5,"#65675d");line(c,x+i,y+3,x+i+8,y+9,"#d2a261",2);
 }
 r(c,x,y+b.h-3,b.w,4,"#2a2e2d");
 r(c,x+b.w*.2,y-8,3,4,"#e8a86a");r(c,x+b.w*.7,y-8,3,4,"#e8a86a");
 if(b.hp<b.maxHp){r(c,x,y-15,b.w,3,"#1b2222");r(c,x,y-15,b.w*b.hp/b.maxHp,3,"#e9b66b");}
}
function landmark(c,{shelter,barriers}){
 const d=shelter.door,b=shelter.building;
 if(!b)return;
 // Exact doorway pin and durability track at the gameplay coordinates.
 const opened=shelter.destroyed;
 r(c,d.x-9,d.y-8,18,16,opened?"#643d34":"#2b3b35");
 r(c,d.x-7,d.y-7,14,12,opened?"#785144":"#997452");
 for(let j=0;j<3;j++)r(c,d.x-5+j*5,d.y-6,2,9,"#d0a574");
 r(c,d.x-10,d.y+7,20,3,opened?"#da7767":"#8ea48d");
 r(c,d.x-21,d.y-24,42,5,"#151b1b");
 r(c,d.x-20,d.y-23,40*shelter.hp/Math.max(1,shelter.maxHp),3,opened?"#c36e5a":"#aaca89");
 c.fillStyle="#f4d9a6";c.font="bold 10px monospace";c.textAlign="center";c.fillText(opened?"BREACHED":"SHELTER",d.x,d.y-29);
 c.font="bold 9px sans-serif";c.fillStyle="#d0ddb9";c.fillText("入口",d.x,d.y+24);
 (barriers||[]).forEach(x=>assets.draw("barricade",c,x));
}
function drawScene(c,{w,h,stage,country,buildings,shelter,barriers=[],exits=[],isBlocked=()=>false}){
 const portrait=w/h<.78;
 base(c,{w,h,stage,portrait});
 const p=country==="pt"?"#967b61":"#75816c";
 for(let i=0;i<17;i++){
  const x=noise(i,stage,43)*w,y=noise(i,stage,12)*h;
  if(!isBlocked(x,y,8)){r(c,x-2,y+4,16,4,"#17201b");assets.draw("vegetation",c,x,y,5+i%4);}
 }
 // Derelict cars stay off fixed building footprints.
 for(const [i,asset] of assets.place("vehicle",w,h).entries()){
  if(!isBlocked(asset.x,asset.y,12))assets.draw("vehicle",c,asset.x,asset.y,[P.rust,P.cyan,p][i]);
 }
 // Power lines and old lighting on the important streets.
 for(const asset of assets.place("lamppost",w,h)){
  if(!isBlocked(asset.x,asset.y,4))assets.draw("lamppost",c,asset.x,asset.y,asset.variant==="lit");
 }
 const ordered=[...buildings].sort((a,b)=>a.y-b.y);
 ordered.forEach((b,i)=>assets.draw("building",c,b,i,{shelter:!!b.isShelter,stage}));
 if(shelter.building){
  const b=shelter.building,margin=17;
  assets.draw("fence",c,b.x-margin,b.y-margin,b.w+2*margin);
  assets.draw("fence",c,b.x-margin,b.y-margin,b.h+2*margin,true);
  // The playable doorway remains open and unobscured.
  assets.draw("shelter",c,{shelter,barriers});
 }
 for(const e of exits)assets.draw("evac",c,e);
 // Subtle dusk grading; leave open terrain readable for the player.
 const g=c.createLinearGradient(0,0,w,h);
 g.addColorStop(0,"#09252b28");g.addColorStop(.55,"#10192100");g.addColorStop(1,"#110e1d48");
 c.fillStyle=g;c.fillRect(0,0,w,h);
}
function paintHuman(g,kind,panic,frame=0){
 const civilian=kind==="civilian",j=frame%2;
 // 1 pixel forms, muted worn clothes, warm human skin.
 r(g,-4,-2,9,9,civilian?(panic?"#c5a179":"#ac9b83"):"#626c65");
 r(g,-3,5+j,3,6,"#373e37");r(g,1,5-j,3,6,"#303932");
 r(g,-6,-1,3,7,civilian?"#b3a087":"#576155");r(g,4,0,3,7,civilian?"#9e8d76":"#55675f");
 r(g,-3,-9,7,8,civilian?"#e1c3a0":"#bb9b79");
 r(g,-4,-10,8,3,civilian?"#534238":kind==="elite"?"#593d34":"#343f40");
 r(g,-2,-7,2,1,"#343132");r(g,2,-7,2,1,"#343132");
 if(!civilian){r(g,-5,-1,10,4,kind==="elite"?"#9d5445":"#485f5b");r(g,3,1,13,3,"#313b39");r(g,12,0,4,2,"#a79a75");}
 else{r(g,-3,-2,7,2,panic?"#e4ba8a":"#c4b18d");}
}
function paintZombie(g,type,hit=false,frame=0){
 const j=frame%2,skin=hit?"#ebd7ad":type==="brute"?"#7f9b71":type==="spitter"?"#7aaf89":"#a0b28b";
 if(type==="brute"){
  r(g,-11,-8,21,17,"#5a6c4a");r(g,-10,-6,18,10,skin);r(g,-8,-14,14,9,"#8a9b72");
  r(g,-12,3,5,12,"#58694b");r(g,5,3,5,12,"#485c41");r(g,-14,-3,4,12,skin);r(g,10,-3,4,12,skin);
  r(g,-6,-10,3,2,"#d1a16c");r(g,2,-10,3,2,"#d1a16c");
 }else if(type==="runner"){
  r(g,-7,-4,13,8,"#5e7c59");r(g,4,-9,8,7,skin);r(g,-6,4,4,8+j,"#3c483e");
  r(g,1,4,4,7-j,"#3b493c");r(g,-11,-2,6,3,skin);r(g,7,-3,6,3,skin);
  r(g,9,-6,2,2,"#e9d7a2");
 }else if(type==="spitter"){
  r(g,-8,-4,16,11,"#445d4d");r(g,-7,-9,14,8,"#6a9980");r(g,-3,-13,7,5,skin);
  r(g,-8,6,4,8,"#3d5349");r(g,4,6,4,8,"#31483e");
  r(g,-13,1,7,3,"#7ea886");r(g,7,1,7,3,"#7ea886");
  r(g,-3,-5,6,5,"#9dd6a0");r(g,-2,-3,3,2,"#c1e3a3");
 }else{
  r(g,-5,-3,11,10,"#647b5d");r(g,-4,-9,9,8,skin);r(g,-5,6+j,4,7,"#354a3e");r(g,2,6-j,4,7,"#354738");
  r(g,-9,-2,4,8,skin);r(g,6,-3,4,7,skin);r(g,-2,-7,2,2,"#d1cfa0");r(g,3,-7,2,2,"#c4c393");
  r(g,-5,-2,10,2,"#8f5c4c");
 }
}
assets.register("human",(c,kind,panic,frame)=>paintHuman(c,kind,panic,frame));
assets.register("zombie",(c,type,hit,frame)=>paintZombie(c,type,hit,frame));
assets.register("building",building);
assets.register("shelter",landmark);
assets.register("barricade",barricade);
assets.register("vehicle",car);
assets.register("lamppost",lamppost);
assets.register("vegetation",vegetation);
assets.register("fence",fence);
assets.register("evac",(c,e)=>{
 r(c,e.x-9,e.y-8,18,16,"#2e4d45");r(c,e.x-4,e.y-5,8,9,"#89a68a");
 c.textAlign="center";c.font="bold 8px monospace";c.fillStyle="#dcaf77";c.fillText("EVAC",e.x,e.y-12);
});
root.HungerArt={palette:P,drawScene,paintHuman,paintZombie};
})(typeof window!=="undefined"?window:globalThis);
