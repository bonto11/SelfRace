// public/sw.js

self.addEventListener('push', function (event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || '/logo/selfrace_logo_nocolor_230.png', // Ak máš v public zložke ikonu apky
        badge: data.badge || '/logo/selfrace_logo_nocolor_230.png',
        vibrate: [200, 100, 200], // Zavibruje telefón
        data: {
          url: data.url || '/' // Kam ťa to presmeruje po kliknutí
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

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // Po kliknutí na notifikáciu sa otvorí apka
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});