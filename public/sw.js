self.addEventListener("install", (event) => {
  console.log("Service Worker: Installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activated");
  event.waitUntil(self.clients.claim());
});

// self.addEventListener("fetch", (event) => {
//   // Laisser passer toutes les requêtes normalement
//   event.respondWith(fetch(event.request));
// });

// Gestion des notifications push
self.addEventListener("push", function (event) {
  if (event.data) {
    try {
      let title = "PattePilot";
      let body = "Nouvelle notification";
      let url = "/";
      try {
        const data = event.data.json();
        title = data.title || title;
        body = data.body || body;
        url = data.url || url;
      } catch (error) {
        body = event.data.text();
      }

      const options = {
        body: body,
        icon: "/icon_192_192.png",
        badge: "/icon_192_192.png",
        tag: "patte-pilot",
        requireInteraction: false,
        silent: false,
        data: { url: url },
      };
      event.waitUntil(
        self.registration
          .showNotification(title, options)
          .then(() => console.log("✅ SW: Notification affichée avec succès"))
          .catch((err) => console.error("❌ SW: Erreur affichage:", err))
      );
    } catch (error) {
      console.error("❌ SW: Erreur parsing JSON:", error);
    }
  } else {
    console.log("⚠️ SW: Pas de données dans le push");
  }
});

self.addEventListener("notificationclick", function (event) {
  console.log("Notification click received.");
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => client.url === targetUrl);
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
