/* Daily-note deadline reminder service worker.
   Only handles notification clicks — timing is driven by the app. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.path) || '/daily-note';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(path).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(path);
    })
  );
});
