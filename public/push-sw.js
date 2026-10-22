// Pulled into the generated service worker (vite.config.js → workbox.importScripts).
// Shows the daily reminder sent by /api/send-reminders and opens the app when tapped.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Limitless', {
    body: data.body || '',
    icon: '/icon-192.png',
    tag: 'limitless-daily-reminder', // a new reminder replaces an unread one instead of piling up
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const open = windows.find(w => w.url.startsWith(self.location.origin));
    return open ? open.focus() : self.clients.openWindow(url);
  }));
});
