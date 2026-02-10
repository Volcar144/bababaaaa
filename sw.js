// Service Worker for offline functionality
const CACHE_NAME = 'dnd-lookup-v1';
const CACHE_ASSETS = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './manifest.json'
];

const API_CACHE_NAME = 'dnd-api-cache-v1';
const API_BASE_URL = 'https://www.dnd5eapi.co/api';

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(CACHE_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME && cache !== API_CACHE_NAME) {
                        console.log('Service Worker: Clearing old cache');
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle API requests
    if (url.origin === 'https://www.dnd5eapi.co') {
        event.respondWith(
            caches.open(API_CACHE_NAME).then((cache) => {
                return fetch(request)
                    .then((response) => {
                        // Cache successful API responses
                        if (response.status === 200) {
                            cache.put(request, response.clone());
                        }
                        return response;
                    })
                    .catch(() => {
                        // Return cached response when offline
                        return cache.match(request).then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Return offline fallback
                            return new Response(
                                JSON.stringify({
                                    error: 'Offline',
                                    message: 'No cached data available'
                                }),
                                {
                                    status: 503,
                                    headers: { 'Content-Type': 'application/json' }
                                }
                            );
                        });
                    });
            })
        );
        return;
    }

    // Handle static assets
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(request).then((response) => {
                // Cache new static assets
                if (request.method === 'GET' && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            });
        })
    );
});
