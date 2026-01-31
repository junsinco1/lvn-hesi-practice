const CACHE_NAME = "lvn-hesi-webapp-v4-2";
const ASSETS = ["./","./index.html","./styles.css","./app.js","./app.js?v=42","./questions.json","./manifest.json"];
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
