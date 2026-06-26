/* Bloodlines PWA service worker — cache-first for assets, network-first for the app shell */
const CACHE = 'familytree-v15';  // v15: Migrations tour — dynamic year-glide (fast deep time, slow recent), brisk deep-time narration, no dead-sit; + Time Scale ⏳ icon
const SHELL = ['./'];
const ASSET_GLOBS = [/^bg\//, /^audio\//, /^narration\//, /^docs-img\//, /^vendor\//];

function rel(url) { return new URL(url).pathname.replace(/^\/family-tree\//, ''); }
function isAsset(url) { return ASSET_GLOBS.some(function(re) { return re.test(rel(url)); }); }
// data/*.js + docs-content.json: stale-while-revalidate — instant from cache, refreshed in the
// background so a deploy's new stories/portraits appear on the next load (no version-bump churn).
function isData(url) { var r = rel(url); return /^data\//.test(r) || r === 'docs-content.json'; }

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (isData(req.url)) {
    // stale-while-revalidate
    e.respondWith(caches.open(CACHE).then(function(c) {
      return c.match(req).then(function(hit) {
        var net = fetch(req).then(function(resp) {
          if (resp && resp.status === 200) c.put(req, resp.clone());
          return resp;
        }).catch(function() { return hit; });
        return hit || net;
      });
    }));
    return;
  }

  if (isAsset(req.url)) {
    // cache-first: serve bg/audio/narration/docs from cache, populate on miss
    e.respondWith(
      caches.match(req).then(function(hit) {
        if (hit) return hit;
        return fetch(req).then(function(resp) {
          if (resp && resp.status === 200) {
            var clone = resp.clone();
            caches.open(CACHE).then(function(c) { c.put(req, clone); });
          }
          return resp;
        });
      })
    );
  } else {
    // network-first for HTML (keeps the app up-to-date); fallback to cache offline
    e.respondWith(
      fetch(req).then(function(resp) {
        if (resp && resp.status === 200) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(req, clone); });
        }
        return resp;
      }).catch(function() {
        return caches.match(req);
      })
    );
  }
});
