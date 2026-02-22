// src/WASM-engine-18.tsx

import * as wasm from './wasm_module.js';

interface MyInterface {
// Add your interface definition here
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', (event) => {
event.waitUntil(
caches.open('my-cache').then((cache) => {
return cache.addAll([
'/',
'./wasm_module.wasm',
]);
})
);
});

self.addEventListener('activate', (event) => {
event.waitUntil(
caches.keys().then((cacheNames) => {
return Promise.all(
cacheNames.map((cacheName) => {
if (cacheName !== 'my-cache') {
return caches.delete(cacheName);
}
})
);
})
);
});

self.addEventListener('fetch', (event) => {
const url = new URL(event.request.url);
if (url.origin === location.origin && url.pathname.endsWith('.wasm')) {
event.respondWith(
caches.match(event.request).then((response) => {
return response || fetch(event.request);
})
);
} else {
event.respondWith(
wasm.createWebAssembly(url, self.selfURL, 'MyInterface').then((instance) => {
// Call your main function using the Wasm instance here
})
);
}
});
