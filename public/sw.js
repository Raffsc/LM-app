// ── PausApp Service Worker ──────────────────────────────────────────────────
// Questo file resta attivo in background e mostra le notifiche
// anche quando Chrome ha la pagina chiusa o il telefono bloccato.

self.addEventListener("install", function(event) {
  self.skipWaiting(); // attiva subito senza aspettare il reload
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim()); // prende controllo di tutte le tab aperte
});

// Riceve i messaggi dalla pagina e mostra la notifica
self.addEventListener("message", function(event) {
  var data = event.data;
  if (!data || data.type !== "NOTIFY") return;

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag || "pausapp",
      icon: "https://em-content.zobj.net/source/google/387/hot-beverage_2615.png",
      badge: "https://em-content.zobj.net/source/google/387/hot-beverage_2615.png",
      renotify: true,
      vibrate: [200, 100, 200], // vibrazione su Android
    })
  );
});

// Cliccando la notifica apre/porta in primo piano l'app
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      // Se l'app è già aperta, la porta in primo piano
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ("focus" in client) return client.focus();
      }
      // Altrimenti apre una nuova finestra
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
