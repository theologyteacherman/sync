/* Phases — offline service worker.
   The whole app is one HTML file with no server calls, so caching the shell
   is enough to make it work with no signal at all. */

var VERSION = "phases-v1";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(VERSION).then(function(c){
      // One bad URL must not fail the whole install, so add them one by one.
      return Promise.all(SHELL.map(function(u){
        return c.add(new Request(u, {cache:"reload"})).catch(function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* Serve from cache first so the app opens instantly and offline, then refresh
   the cached copy in the background for the next launch. */
function staleWhileRevalidate(req){
  return caches.open(VERSION).then(function(cache){
    return cache.match(req, {ignoreSearch:true}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
        return res;
      }).catch(function(){ return null; });
      return hit || net.then(function(res){
        return res || caches.match("./index.html");
      });
    });
  });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;

  // A navigation with no signal still has to land on the app.
  if(req.mode === "navigate"){
    e.respondWith(
      staleWhileRevalidate(req).then(function(res){
        return res || caches.match("./index.html");
      })
    );
    return;
  }

  e.respondWith(staleWhileRevalidate(req));
});
