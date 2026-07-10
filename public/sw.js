/**
 * Service Worker for Stocks Manager PWA v2.1.5
 *
 * Strategy: Network-First para assets estaticos
 * - Siempre pide la version fresca al servidor.
 * - Solo devuelve la cache si el servidor falla (modo offline).
 * - El nombre de cache incluye la version de la app, asi cada
 *   deploy invalida la cache automaticamente.
 */

const CACHE_NAME = 'stocks-manager-v2.1.5b';

// Install: tomar control inmediatamente, sin pre-cachear nada
self.addEventListener('install', (event) => {
    console.log(`[SW] Installed cache: ${CACHE_NAME}`);
    self.skipWaiting();
});

// Activate: eliminar TODAS las caches antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => {
                        console.log(`[SW] Deleting old cache: ${name}`);
                        return caches.delete(name);
                    })
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network-First para todo
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Solo GET
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // API calls: siempre red, nunca cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(
                    JSON.stringify({ error: 'Sin conexion a internet' }),
                    {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
        );
        return;
    }

    // Todos los demas recursos: Network-First
    event.respondWith(
        fetch(request)
            .then((response) => {
                // Si la red responde bien, guardar en cache y devolver
                if (response.ok && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Red falla -> intentar cache (modo offline)
                return caches.match(request).then((cached) => {
                    if (cached) return cached;
                    return caches.match('/index.html') || new Response('Sin conexion', { status: 503 });
                });
            })
    );
});

