/* Push notifications, loaded into the app's service worker (see vite.config.ts). */

function closeAll() {
  return self.registration
    .getNotifications()
    .then((list) => list.forEach((n) => n.close()))
    .catch(() => {});
}
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  // iPhone requires every push to show a notification. Each new one replaces the last,
  // so they never pile up on the lock screen.
  const jobs = [
    closeAll().then(() =>
      self.registration.showNotification(data.title || 'Improvr', {
        body: data.body || '',
        tag: 'improvr',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        data: { url: data.url || '/' },
      }),
    ),
  ];
  // The number on the Home Screen icon: things due right now.
  if (typeof data.badge === 'number' && 'setAppBadge' in self.navigator) {
    jobs.push((data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {}));
  }
  event.waitUntil(Promise.all(jobs));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  closeAll();
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
