// Afrocan Alerts: shows the price alerts the store app sends to this phone (Web Push).
// Nothing is downloaded or stored here except this phone's settings (store, name, sign-up code).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {body: e.data ? e.data.text() : ''}; }
  e.waitUntil(self.registration.showNotification(d.title || 'Afrocan alert', {
    body: d.body || '',
    tag: d.tag || undefined,
    data: {url: d.url || ''},
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    timestamp: Date.now()
  }));
});

// Tapping an alert opens the store report
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.openWindow(url));
});

// The browser renewed this phone's push address: sign the new one up (settings saved by the page)
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    const res = await (await caches.open('afrocan-alerts')).match('cfg');
    const cfg = res ? await res.json() : null;
    if (!cfg || !cfg.u || !cfg.t || !cfg.key || !cfg.stores) return;
    const raw = atob(cfg.key.replace(/-/g, '+').replace(/_/g, '/'));
    const key = Uint8Array.from(raw, ch => ch.charCodeAt(0));
    const sub = e.newSubscription ||
      await self.registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: key});
    await fetch('https://script.google.com/macros/s/' + encodeURIComponent(cfg.u) + '/exec?agent=push', {
      method: 'POST',
      body: JSON.stringify({op: 'on', t: cfg.t, sub: sub.toJSON(), stores: cfg.stores, name: cfg.name, device: cfg.device,
                            old: e.oldSubscription ? e.oldSubscription.endpoint : ''})
    });
  })());
});
