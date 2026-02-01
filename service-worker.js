const CACHE_NAME = "lvn-hesi-webapp-v5-1";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./app.js?v=50","./app.js?v=42","./questions.json","./questions_manifest.json","./questions_part10.json","./questions_part09.json","./questions_part08.json","./questions_part07.json","./questions_part06.json","./questions_part05.json","./questions_part04.json","./questions_part03.json","./questions_part02.json","./questions_part01.json","./manifest.json"];
self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k===CACHE_NAME?null:caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", (e)=>{
  e.respondWith(caches.match(e.request).then(cached=>{
    if(cached) return cached;
    return fetch(e.request).then(resp=>{
      if(e.request.method==="GET" && resp && resp.status===200){
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c=>c.put(e.request, copy));
      }
      return resp;
    }).catch(()=>cached);
  }));
});
