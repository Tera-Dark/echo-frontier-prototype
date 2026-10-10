/* Network-first: Pages updates are preferred; cached assets support offline sessions. */
const CACHE="hunger-protocol-nav-v6";
const ASSETS=["./","./index.html","./style.css","./game.js","./src/core/storage.js","./src/core/clock.js","./src/core/progression.js","./src/core/navigation.js","./src/render/asset-catalog.js","./src/render/siege-art.js","./manifest.webmanifest","./assets/icon.svg"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("hunger-protocol-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
  return response;
 }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))));
});
