const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),out=path.join(root,"dist");
const assets=["index.html","style.css","game.js","src/core/storage.js","src/core/clock.js","src/core/progression.js","src/core/navigation.js","src/render/asset-catalog.js","src/render/siege-art.js","manifest.webmanifest","sw.js","assets/icon.svg"];
fs.rmSync(out,{recursive:true,force:true});
for(const rel of assets){
 const src=path.join(root,rel),dest=path.join(out,rel);
 assert.ok(fs.existsSync(src),"Missing web asset: "+rel);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);
}
const html=fs.readFileSync(path.join(out,"index.html"),"utf8");
for(const rel of ["style.css","src/core/storage.js","src/core/clock.js","src/core/progression.js","src/core/navigation.js","src/render/asset-catalog.js","src/render/siege-art.js","game.js","manifest.webmanifest","assets/icon.svg"]){
 assert.ok(html.includes('"'+rel+'"'),"HTML missing web asset reference: "+rel);
}
const js=fs.readFileSync(path.join(out,"game.js"),"utf8");
assert.ok(js.includes("core.createClock")&&js.includes("core.loadSave"),"Production build must use portable core");
console.log("Built web distribution:",assets.length,"files -> dist/");
