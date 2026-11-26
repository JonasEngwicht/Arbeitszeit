// Speicher im Browser: IndexedDB, Fallback localStorage bzw. Arbeitsspeicher.
// Daten verlassen nie das Gerät.

const DB_NAME = 'arbeitszeitrechner';
const DB_VERSION = 1;
const LS_KEY = 'azr-fallback-v1';

let dbPromise = null;
let fallback = null; // { profiles: {}, entries: {}, meta: {} }

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (!('indexedDB' in self)) return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'key' });
          s.createIndex('profile', 'profileId');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function loadFallback() {
  if (fallback) return fallback;
  try { fallback = JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { fallback = null; }
  fallback = fallback || { profiles: {}, entries: {}, meta: {} };
  return fallback;
}
function saveFallback() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(fallback)); } catch { /* privat / voll */ }
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export async function getAll(store) {
  const db = await openDb();
  if (!db) return Object.values(loadFallback()[store]);
  return tx(db, store, 'readonly', (s) => reqP(s.getAll()));
}

export async function getEntries(profileId) {
  const db = await openDb();
  if (!db) return Object.values(loadFallback().entries).filter((e) => e.profileId === profileId);
  return tx(db, 'entries', 'readonly', (s) => reqP(s.index('profile').getAll(profileId)));
}

export async function put(store, value) {
  const db = await openDb();
  if (!db) {
    const f = loadFallback();
    f[store][value.id ?? value.key ?? value.k] = value;
    saveFallback();
    return;
  }
  await tx(db, store, 'readwrite', (s) => { s.put(value); });
}

export async function del(store, key) {
  const db = await openDb();
  if (!db) {
    delete loadFallback()[store][key];
    saveFallback();
    return;
  }
  await tx(db, store, 'readwrite', (s) => { s.delete(key); });
}

export async function deleteProfileEntries(profileId) {
  const entries = await getEntries(profileId);
  for (const e of entries) await del('entries', e.key);
}

export async function getMeta(k, dflt = null) {
  const db = await openDb();
  if (!db) return loadFallback().meta[k]?.v ?? dflt;
  const r = await tx(db, 'meta', 'readonly', (s) => reqP(s.get(k)));
  return r ? r.v : dflt;
}
export const setMeta = (k, v) => put('meta', { k, v });

export async function exportAll() {
  return {
    app: 'derarbeitszeitrechner.de', version: 1, exported: new Date().toISOString(),
    profiles: await getAll('profiles'), entries: await getAll('entries'),
  };
}

export async function importAll(data) {
  if (!data || !Array.isArray(data.profiles) || !Array.isArray(data.entries)) throw new Error('Ungültige Datei');
  for (const p of data.profiles) if (p && p.id) await put('profiles', p);
  for (const e of data.entries) if (e && e.key && e.profileId && e.date) await put('entries', e);
  return { profiles: data.profiles.length, entries: data.entries.length };
}

export async function persist() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* egal */ }
}
