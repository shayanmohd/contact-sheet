/* Frame images. Blobs are far too big for localStorage, so they live in one
   IndexedDB store keyed by a plain string. Three kinds of key:
     neg:<rollId>:<n>   the undeveloped frame. Never rendered anywhere.
     frm:<rollId>:<n>   the developed frame, full size.
     thm:<rollId>:<n>   the developed frame at contact-sheet size.
   Negatives are deleted the moment their roll finishes developing. */
const DB = (() => {
  const NAME = 'contact-sheet';
  const STORE = 'blobs';
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    return dbp;
  }

  function tx(mode) { return open().then(d => d.transaction(STORE, mode).objectStore(STORE)); }
  const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  async function put(key, blob) { const s = await tx('readwrite'); return wrap(s.put(blob, key)); }
  async function get(key) { const s = await tx('readonly'); return wrap(s.get(key)); }
  async function del(key) { const s = await tx('readwrite'); return wrap(s.delete(key)); }

  async function keys(prefix) {
    const s = await tx('readonly');
    const all = await wrap(s.getAllKeys());
    return all.filter(k => typeof k === 'string' && k.startsWith(prefix));
  }

  async function delPrefix(prefix) {
    const ks = await keys(prefix);
    const s = await tx('readwrite');
    await Promise.all(ks.map(k => wrap(s.delete(k))));
    return ks.length;
  }

  /** Rough on-device footprint, in bytes. Reads sizes only, never decodes. */
  async function usage() {
    const s = await tx('readonly');
    const all = await wrap(s.getAll());
    return all.reduce((n, b) => n + (b && b.size ? b.size : 0), 0);
  }

  async function clear() { const s = await tx('readwrite'); return wrap(s.clear()); }

  const negKey = (r, n) => `neg:${r}:${n}`;
  const frmKey = (r, n) => `frm:${r}:${n}`;
  const thmKey = (r, n) => `thm:${r}:${n}`;

  /* Object URLs are handed out for <img> and revoked when a view is torn down. */
  const live = new Map();
  async function url(key) {
    if (live.has(key)) return live.get(key);
    const b = await get(key);
    if (!b) return null;
    const u = URL.createObjectURL(b);
    live.set(key, u);
    return u;
  }
  function release() {
    for (const u of live.values()) URL.revokeObjectURL(u);
    live.clear();
  }

  return { put, get, del, keys, delPrefix, usage, clear, url, release, negKey, frmKey, thmKey };
})();
