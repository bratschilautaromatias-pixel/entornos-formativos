/**
 * TRABAJADOR SIN CONEXIÓN (service worker)
 * Guarda una copia de los archivos de la app en el equipo para que abra sin internet.
 * IMPORTANTE: cada vez que se cambia cualquier archivo de la app hay que subir el número de VERSION;
 * así los equipos se enteran de que hay una versión nueva y muestran el aviso "Actualizar".
 */
const VERSION = 'v8';
const CACHE = 'entornos-formativos-' + VERSION;

const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/estilos.css',
  'js/api.js',
  'js/datos.js',
  'js/base.js',
  'js/pantallas/acceso.js',
  'js/pantallas/inicio.js',
  'js/pantallas/usuarios.js',
  'js/pantallas/tareas.js',
  'js/pantallas/entorno.js',
  'js/pantallas/economia.js',
  'js/formularios.js',
  'js/huerta/datos-huerta.js',
  'js/huerta/siembras.js',
  'js/huerta/registros.js',
  'js/huerta/catalogos.js',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/icono-maskable-512.png',
  'iconos/apple-touch-icon.png',
  'iconos/favicon.png'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ARCHIVOS.map(function (a) { return new Request(a, { cache: 'reload' }); }));
    })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (nombres) {
        return Promise.all(nombres
          .filter(function (n) { return n.indexOf('entornos-formativos-') === 0 && n !== CACHE; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// La app pide "actualizar ya" cuando la persona toca el aviso
self.addEventListener('message', function (evento) {
  if (evento.data === 'actualizar') self.skipWaiting();
});

self.addEventListener('fetch', function (evento) {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // el servidor de Google no se toca

  // Abrir la app (cualquier pantalla) → la copia guardada de index.html
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      caches.match('index.html').then(function (guardado) { return guardado || fetch(pedido); })
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido, { ignoreSearch: true }).then(function (guardado) {
      return guardado || fetch(pedido);
    })
  );
});
