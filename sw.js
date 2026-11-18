// Service worker de Maqnex: permite instalar la app y abrirla sin conexión.
// Solo guarda los archivos de la app; NUNCA guarda datos de la base de datos ni sesiones.
const VERSION = 'maqnex-v2';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/theme-init.js', './js/app.js', './js/config.js', './js/supabase.js', './js/ui.js', './js/state.js',
  './js/components.js', './js/actions.js', './js/auth.js', './js/kpi.js', './js/particles.js',
  './js/views/dashboard.js', './js/views/machines.js', './js/views/machine.js', './js/views/orders.js',
  './js/views/parts.js', './js/views/channels.js', './js/views/messages.js', './js/views/team.js',
  './js/views/notifications.js', './js/views/reports.js', './js/views/profile.js', './js/views/admin.js',
  './js/views/help.js', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Solo archivos propios con GET. Supabase, fuentes y CDN van directo a la red.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Red primero (siempre la versión más nueva); si no hay conexión, la copia guardada.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
  );
});
