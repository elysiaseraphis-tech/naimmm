/* NAIM Studio v5 — service worker
   전략:
   - HTML(문서): network-first. 새 배포 즉시 반영, 오프라인이면 캐시 폴백.
   - 아이콘/매니페스트: cache-first (거의 안 변함).
   - NAI API(image.novelai.net 등) 및 외부 폰트 CDN: 캐시하지 않음(항상 네트워크).
   캐시 버전 올리면 구버전 캐시 자동 정리. */
'use strict';

var CACHE = 'naim-v5-pair-rotate-1';
var CORE = [
  './NAIM_Studio_v5_pair_rotate%20(9).html',
  './exif-metadata.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // 개별 실패가 전체 설치를 막지 않도록 하나씩
      return Promise.all(CORE.map(function(u){
        return c.add(u).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if(k !== CACHE) return caches.delete(k);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);

  // 같은 오리진만 처리. NAI API/외부 CDN(폰트 등)은 손대지 않음(항상 네트워크).
  if(url.origin !== self.location.origin) return;

  var isDoc = req.mode === 'navigate' ||
              (req.headers.get('accept') || '').indexOf('text/html') !== -1;

  if(isDoc){
    // network-first: 최신 HTML 우선, 실패 시 캐시
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy).catch(function(){}); });
        return res;
      }).catch(function(){
        return caches.match(req).then(function(m){
          return m || caches.match('./NAIM_Studio_v5_pair_rotate%20(9).html');
        });
      })
    );
    return;
  }

  // 그 외 같은 오리진 정적 자원: cache-first
  e.respondWith(
    caches.match(req).then(function(m){
      return m || fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy).catch(function(){}); });
        return res;
      }).catch(function(){ return m; });
    })
  );
});
