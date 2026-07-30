// public/sw.js

const SW_VERSION = "2026-07-30-ack-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

const PUSH_ACK_URL = "https://api.selfrace.com/notifications/push/received";

self.addEventListener("push", function (event) {
  if (event.data) {
    try {
      const data = event.data.json();

      const options = {
        body: data.body,
        icon: data.icon || "/icon.png",
        badge: data.badge || "/icon.png",
        vibrate: [200, 100, 200],
        data: {
          url: data.url || "/",
          sub_id: data.sub_id ?? null,
        },
      };

      const showAndAck = async () => {
        await self.registration.showNotification(
          data.title || "Nová správa",
          options,
        );

        if (data.sub_id != null) {
          try {
            const res = await fetch(PUSH_ACK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sub_id: data.sub_id }),
              keepalive: true,
            });
          } catch (e) {
            console.error(
              "[SW][push] ack fetch FAILED:",
              e,
              "URL was:",
              PUSH_ACK_URL,
            );
          }
        } else {
          console.warn("[SW][push] no sub_id in payload, cannot ack");
        }
      };

      event.waitUntil(showAndAck());
    } catch (e) {
      console.error("[SW][push] Chyba pri spracovaní push dát:", e);
    }
  } else {
    console.warn("[SW][push] event.data is empty");
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin)
    .href;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (windowClients) {
        if (windowClients.length > 0) {
          const client = windowClients[0];
          if ("focus" in client) {
            client.focus();
          }
          if ("navigate" in client) {
            return client.navigate(urlToOpen);
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});
