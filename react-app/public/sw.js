// Shmedium service worker — DECOMMISSIONED (self-unregistering kill switch).
//
// Why this file no longer caches anything
// ---------------------------------------
// The previous version used a cache-first strategy behind a cache name that was
// hardcoded to 'shmedium-shell-v1' and never changed between deploys:
//
//   * `activate` purged only caches whose key !== 'shmedium-shell-v1', so the
//     one cache that mattered was never invalidated;
//   * navigation requests were answered from the cached '/index.html' forever;
//   * every hashed JS/CSS asset was cached on first miss and then served from
//     cache indefinitely.
//
// The effect was that a returning visitor stayed pinned to whichever build they
// happened to see first. Shipping a fix changed nothing for them — the browser
// kept running the old chunks. That is exactly how a render-time crash in one
// feed tile survived several deploys and made the whole site look dead: React
// throws while rendering, unmounts the tree, and every route goes blank.
//
// Offline support is not worth that risk on a portfolio site, so this worker now
// does one job: tear itself down. Browsers re-check sw.js on navigation, so
// clients still running the old worker will pick this up, drop every cache, and
// unregister — permanently un-sticking them.
//
// If offline support is ever wanted again, do not reintroduce cache-first for
// navigations. Use network-first for HTML, cache-first only for content-hashed
// assets, and derive the cache name from the build hash so `activate` evicts
// previous builds.

self.addEventListener('install', () => {
  // Take over from the old worker immediately rather than waiting for all tabs
  // to close — affected clients are precisely the ones that cannot close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache this origin owns, including the stale app shell.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      // Remove the registration so no worker intercepts fetches again.
      await self.registration.unregister();

      // Reload open tabs so they fetch the current index.html and chunks over
      // the network instead of continuing on the assets they already loaded.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// No fetch handler: with none registered the browser goes straight to the
// network, which is the desired end state while this worker is being removed.
