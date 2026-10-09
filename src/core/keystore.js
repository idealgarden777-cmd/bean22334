/* Device key store: the unlocked identity key lives in this browser's IndexedDB
 * as a NON-extractable CryptoKey. Falls back to memory (key gone on reload). */
const DB = "bean-e2ee";
const STORE = "keys";
const memory = new Map();

function open() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req?.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const keyStore = {
  async get(id) {
    try {
      return (await run("readonly", (s) => s.get(id))) || memory.get(id) || null;
    } catch {
      return memory.get(id) || null;
    }
  },
  async set(id, value) {
    memory.set(id, value);
    try {
      await run("readwrite", (s) => s.put(value, id));
    } catch {}
  },
  async del(id) {
    memory.delete(id);
    try {
      await run("readwrite", (s) => s.delete(id));
    } catch {}
  },
  async clear() {
    memory.clear();
    try {
      await run("readwrite", (s) => s.clear());
    } catch {}
  },
};
