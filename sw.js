// Afrocan Alerts: shows the price alerts the store app sends to this phone (Web Push), and keeps the
// last 50 on this phone so the alerts page can list them (the tags to print). Nothing else is stored
// here except this phone's settings (stores, name, sign-up code).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = {body: e.data ? e.data.text() : ''}; }
  const title = d.title || 'Afrocan alert';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || undefined,
      data: {url: d.url || ''},
      icon: 'icon-192.png',
      badge: 'badge-96.png',
      timestamp: Date.now()
    }),
    remember({title: title, body: d.body || '', store: d.store || '', test: d.tag === 'test', at: Date.now()})
  ]));
});

// The list the alerts page shows ("Recent price changes on this phone"), newest first
async function remember(alert) {
  try {
    const c = await caches.open('afrocan-alerts');
    const r = await c.match('recent');
    const list = r ? await r.json() : [];
    list.unshift(alert);
    await c.put('recent', new Response(JSON.stringify(list.slice(0, 50)), {headers: {'Content-Type': 'application/json'}}));
  } catch (err) { /* the alert still shows; only the list misses it */ }
}

// Tapping an alert opens the alerts page with that list (an open one is brought to the front)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil((async () => {
    if (url === self.registration.scope) {
      const wins = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
      const page = wins.find(w => w.url.indexOf(self.registration.scope) === 0);
      if (page && page.focus) {
        try { await page.focus(); return; } catch (err) { /* open it instead */ }
      }
    }
    await self.clients.openWindow(url);
  })());
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
