// public/sw.js

// URL backend endpointu, kam SW hlási "reálne som dostal push".
// Uprav podľa skutočnej domény tvojho FastAPI backendu (Railway).
const PUSH_ACK_URL = "https://TVOJ-BACKEND-URL/notifications/push/received";

self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
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

        // 🌟 Potvrď backendu, že táto konkrétna subscription REÁLNE
        // dostala push — nezávisle od toho, čo o nej hovorí Apple/FCM
        // serveru pri odosielaní. Nepotrebuje žiadnu user interakciu
        // (funguje aj keď appka nie je otvorená) — beží čisto na
        // pozadí v Service Workeri.
        if (data.sub_id != null) {
          try {
            await fetch(PUSH_ACK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sub_id: data.sub_id }),
              keepalive: true,
            });
          } catch (e) {
            // Sieť môže byť dočasne nedostupná — to je OK, jednoducho sa
            // to nezaznamená ako "received" a cron to zmaže, ak sa to
            // nezopakuje ani pri ďalšom pokuse.
            console.error("Push ack fetch zlyhal:", e);
          }
        }
      };

      event.waitUntil(showAndAck());
    } catch (e) {
      console.error("Chyba pri spracovaní push dát:", e);
    }
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
