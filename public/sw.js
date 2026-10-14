// Service worker do KlarezaBeauty: recebe as notificações do app e abre a página certa ao tocar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let n = { titulo: "KlarezaBeauty", texto: "", url: "/" };
  try {
    n = { ...n, ...e.data.json() };
  } catch {}
  e.waitUntil(
    self.registration.showNotification(n.titulo, { body: n.texto, icon: n.icone || "/icone/192", badge: "/icone/192", data: { url: n.url }, lang: "pt-BR" }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      for (const c of abertas) {
        if ("focus" in c && "navigate" in c) return c.navigate(url).then((w) => (w || c).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});

// necessário para o Android oferecer "Instalar app"; não guarda nada em cache
self.addEventListener("fetch", () => {});
