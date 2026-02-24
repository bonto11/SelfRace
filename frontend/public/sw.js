// public/sw.js

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
          // Tu príde tá tvoja cieľová URL, napr. '/activities'
          url: data.url || '/' 
        }
      };
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'Nová správa', options)
      );
    } catch (e) {
      console.error("Chyba pri spracovaní push dát:", e);
    }
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Vybudujeme plnú URL adresu, kam chceme usera poslať
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  event.waitUntil(
    // 1. Pozrieme sa, či už náhodou PWA apka nie je otvorená na pozadí
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      
      // Ak je otvorená, nájdeme ju
      if (windowClients.length > 0) {
        const client = windowClients[0];
        
        // Vytiahneme ju z pozadia do popredia (Focus)
        if ('focus' in client) {
          client.focus();
        }
        
        // Presmerujeme ju na požadovanú URL (napr. /activities)
        if ('navigate' in client) {
          return client.navigate(urlToOpen);
        }
      }
      
      // 2. Ak apka bola úplne "zabitá" (vyswipeovaná), otvoríme ju nanovo
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
