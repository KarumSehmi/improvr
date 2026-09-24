/* Push notifications, loaded into the app's service worker (see vite.config.ts). */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  // iPhone requires every push to show a notification.
  event.waitUntil(
    self.registration.showNotification(data.title || 'Improvr', {
      body: data.body || '',
      tag: data.id,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if ('focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
