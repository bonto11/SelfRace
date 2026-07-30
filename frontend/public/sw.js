// public/sw.js
const PUSH_ACK_URL = "https://api.selfrace.com/notifications/push/received";

self.addEventListener('push', function (event) {
  console.log("[SW][push] event received, has data:", !!event.data);

  if (event.data) {
    try {
      const data = event.data.json();
      console.log("[SW][push] parsed data:", data);

      const options = {
        body: data.body,
        icon: data.icon || '/icon.png',
        badge: data.badge || '/icon.png',
        vibrate: [200, 100, 200],
        data: {
          url: data.url || '/',
          sub_id: data.sub_id ?? null,
        }
      };

      const showAndAck = async () => {
        await self.registration.showNotification(data.title || 'Nová správa', options);
        console.log("[SW][push] notification shown");

        if (data.sub_id != null) {
          console.log("[SW][push] sending ack for sub_id=", data.sub_id, "to", PUSH_ACK_URL);
          try {
            const res = await fetch(PUSH_ACK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sub_id: data.sub_id }),
              keepalive: true,
            });
            console.log("[SW][push] ack response status:", res.status, res.ok);
          } catch (e) {
            // 🌟 Toto je najdôležitejší log v celom reťazci — ak sa URL
            // nedá vôbec dosiahnuť (zlá doména, DNS zlyhanie a pod.),
            // backend sa o pokuse nikdy nedozvie a v jeho logoch nebude
            // vôbec nič. Skontroluj tento riadok v konzole (DevTools ->
            // Application -> Service Workers, alebo bežná Console počas
            // aktívneho SW).
            console.error("[SW][push] ack fetch FAILED:", e, "URL was:", PUSH_ACK_URL);
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

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      if (windowClients.length > 0) {
        const client = windowClients[0];
        if ('focus' in client) {
          client.focus();
        }
        if ('navigate' in client) {
          return client.navigate(urlToOpen);
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});