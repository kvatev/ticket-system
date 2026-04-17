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
      // Increment app icon badge (Badging API). Works even when no tab is open.
      (async () => {
        if ("setAppBadge" in self.navigator) {
          try {
            const cache = await caches.open("badge-count");
            const res = await cache.match("count");
            const prev = res ? parseInt(await res.text(), 10) || 0 : 0;
            const next = prev + 1;
            await cache.put("count", new Response(String(next)));
            await self.navigator.setAppBadge(next);
          } catch (e) {
            // ignore
          }
        }
      })(),
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

// Listen for badge updates from the page (authoritative count from the app)
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;
  if (data.type === "SET_APP_BADGE") {
    const count = Number(data.count) || 0;
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open("badge-count");
          await cache.put("count", new Response(String(count)));
          if ("setAppBadge" in self.navigator) {
            if (count > 0) {
              await self.navigator.setAppBadge(count);
            } else if ("clearAppBadge" in self.navigator) {
              await self.navigator.clearAppBadge();
            }
          }
        } catch (e) {
          // ignore
        }
      })()
    );
  }
});
