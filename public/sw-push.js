// Push notification service worker
self.addEventListener("push", (event) => {
  let data = { title: "Петканов Тикет", body: "Имате ново известие", url: "/" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error("Failed to parse push data", e);
  }

  const options = {
    body: data.body,
    icon: "/pwa-icon-512.png",
    badge: "/favicon.png",
    tag: data.tag || "default",
    data: { url: data.url || "/" },
    vibrate: [300, 100, 300, 100, 300],
    requireInteraction: true,
    silent: false,
    renotify: true,
    // sound is supported on some Android browsers
    sound: "/notification.mp3",
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Notify any open clients to play sound (for desktop when tab is open)
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "PLAY_NOTIFICATION_SOUND" });
        });
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window and navigate it
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "NAVIGATE", url });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
