// Network first, so a new version shows up at once; the cached copy keeps it working offline.
// The 3D clips are different: cache first, each stored whole (a stored whole file can't answer a byte-range request on its
// own, and Safari asks for video in ranges, so this answers them itself). They are stored only once you pick 3D, in a cache
// of their own that an app update leaves alone; bump CLIPS when they are rendered again.
const CACHE = "morning-stretch-v15";
const CLIPS = "wiggle-clips3d-v1";
const CLIP_DIR = "clips3d/";
const FILES = ["./", "index.html", "app.css", "app.js", "plan.js", "poses.js", "clips.js", "clipplay.js", "gear.js", "figure.js", "figure3d.js", "sound.js", "sound/voice.json", "sound/voice.pack", "manifest.webmanifest", "icon.svg",
  "fonts/atkinson-hyperlegible-next-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-next-latin-700-normal.woff2", "fonts/atkinson-hyperlegible-next-latin-800-normal.woff2", "fonts/fredoka-latin-600-normal.woff2"];
const isClip = (u) => new URL(u).pathname.endsWith(".mp4");

self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE && k !== CLIPS) await caches.delete(k); // old versions
  await self.clients.claim();
})()));

// A whole file, or an error: only a 200 counts (never a 206), tried a few times.
async function fetchWhole(u, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(u, { cache: "reload" });
      if (r.status === 200) return r;
      last = new Error(r.status + " " + u);
    } catch (err) { last = err; }
    await new Promise((ok) => setTimeout(ok, 400 * (i + 1)));
  }
  throw last;
}

// Store every clip the manifest names that isn't stored yet. Asked for by the page when you pick 3D.
let storing = null;
function storeClips() {
  return (storing ||= (async () => {
    try {
      const mr = await fetchWhole(CLIP_DIR + "clips3d.json");
      const man = await mr.clone().json();
      const app = await caches.open(CACHE); // the manifest and head track go with the app, so they stay as fresh as it is
      await app.put(CLIP_DIR + "clips3d.json", mr);
      const heads = CLIP_DIR + (man.headsFile || "clips3d-heads.json");
      await app.put(heads, await fetchWhole(heads));
      const c = await caches.open(CLIPS);
      const files = [...new Set(Object.values(man.clips).filter((x) => x.file).map((x) => CLIP_DIR + x.file))];
      for (const f of files) {
        if (await c.match(f)) continue;
        try { await c.put(f, await fetchWhole(f)); } catch {} // one failing clip does not stop the rest; asked for again next time
      }
    } catch {}
    storing = null;
  })());
}
self.addEventListener("message", (e) => { if (e.data && e.data.type === "clips") e.waitUntil(storeClips()); });

// Answer a range request from a whole stored file.
async function ranged(req, whole) {
  const range = req.headers.get("range");
  if (!range) return whole;
  const buf = await whole.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, size - +m[2]); end = size - 1; }
  end = Math.min(end, size - 1);
  if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    "Content-Type": "video/mp4", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (isClip(req.url)) {
    e.respondWith((async () => {
      const c = await caches.open(CLIPS);
      const hit = await c.match(req.url, { ignoreSearch: true });
      if (hit) return ranged(req, hit);
      try {
        const r = await fetchWhole(req.url, 2); // not stored yet: fetch it whole, store it, answer the range from it
        await c.put(req.url, r.clone());
        return ranged(req, r);
      } catch { return Response.error(); }
    })());
    return;
  }
  e.respondWith(fetch(req).then((r) => {
    if (r.status === 200) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } // never a partial (206) response
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
