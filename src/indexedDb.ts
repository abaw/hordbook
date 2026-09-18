import type { ProgressRecord, ProgressStore } from "./ports";

const DB_NAME = "hordbook";
const DB_VERSION = 1;
const SETTINGS = "settings";
const PROGRESS = "progress";

/**
 * On-device store backed by IndexedDB: one object store for small settings
 * (key → value) and one for progress records keyed by word ID. Home-screen
 * web apps on iOS keep their own IndexedDB, exempt from Safari's seven-day
 * eviction, so this survives force-quit and reboot.
 */
export function indexedDbProgressStore(factory: IDBFactory = indexedDB): ProgressStore {
  const db = openDatabase(factory);
  return {
    async getSetting(key) {
      const value = await request<{ key: string; value: string } | undefined>(await db, SETTINGS, "readonly", (s) =>
        s.get(key),
      );
      return value?.value ?? null;
    },
    async setSetting(key, value) {
      await request(await db, SETTINGS, "readwrite", (s) => s.put({ key, value }));
    },
    async getAllRecords() {
      return request<ProgressRecord[]>(await db, PROGRESS, "readonly", (s) => s.getAll());
    },
    async putRecord(record) {
      await request(await db, PROGRESS, "readwrite", (s) => s.put(record));
    },
    async deleteRecord(wordId) {
      await request(await db, PROGRESS, "readwrite", (s) => s.delete(wordId));
    },
    async clearRecords() {
      await request(await db, PROGRESS, "readwrite", (s) => s.clear());
    },
  };
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = factory.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: "key" });
      if (!db.objectStoreNames.contains(PROGRESS)) db.createObjectStore(PROGRESS, { keyPath: "wordId" });
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("could not open IndexedDB"));
  });
}

function request<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const req = operation(transaction.objectStore(storeName));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error(`IndexedDB request failed on ${storeName}`));
    transaction.onabort = () => reject(transaction.error ?? new Error(`IndexedDB transaction aborted on ${storeName}`));
  });
}
