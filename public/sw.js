self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title ?? "UnClick Signal", {
      body: data.body ?? "",
      icon: "/favicon-192.png",
      badge: "/favicon-192.png",
      data: { url: data.url ?? "/admin/signals" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});
