// ── PausApp Service Worker ──────────────────────────────────────────────────
// Riceve le notifiche push dal server anche con Chrome chiuso/in background.

self.addEventListener("install", function(event) {
  self.skipWaiting();
});

self.addEventListener("activate", function(event) {
  event.waitUntil(self.clients.claim());
});

// ── Riceve il push dal server e mostra la notifica ─────────────────────────
self.addEventListener("push", function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: "☕ PausApp", body: event.data ? event.data.text() : "" };
  }

  var title = data.title || "☕ PausApp";
  var body  = data.body  || "";
  var tag   = data.tag   || "pausapp";

  event.waitUntil(
    self.registration.showNotification(title, {
      body:      body,
      tag:       tag,
      renotify:  true,
      icon:  "https://em-content.zobj.net/source/google/387/hot-beverage_2615.png",
      badge: "https://em-content.zobj.net/source/google/387/hot-beverage_2615.png",
      vibrate: [200, 100, 200],
    })
  );
});

// ── Cliccando la notifica apre/porta in primo piano l'app ──────────────────
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ("focus" in clientList[i]) return clientList[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});
