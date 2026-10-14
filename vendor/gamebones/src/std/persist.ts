// Saving a game in the browser, in tiers by size: a small save is JSON in localStorage, a mid-size
// one gzipped and base64'd in localStorage, a large one gzipped in IndexedDB with a pointer left
// in localStorage. It stores any JSON value (a kernel save, prefs); the game loads it.
//
// IndexedDB is async and a page being hidden or closed may not wait for it, so saveSync() writes
// to localStorage whatever the size (gzipped past jsonMax); the next save() moves it back. load()
// takes what localStorage says is newest. A plain JSON value already under the key (a save from
// before this module) loads as is, so switching to it needs no import step.

import { gunzipSync, gzipSync, strFromU8, strToU8 } from "fflate";
import { fromBase64, toBase64 } from "../hash.ts";

export type Tier = "json" | "zip" | "idb";

export interface PersistOptions {
  /** The localStorage key (and the IndexedDB key for large saves). */
  key: string;
  /** Saves up to this many characters of JSON stay plain. Default 2048. */
  jsonMax?: number;
  /** Gzipped saves up to this many base64 characters stay in localStorage; larger go to IndexedDB. Default 10240. */
  zipMax?: number;
  /** Always use this tier (a tiny game: "json"). saveSync still never uses "idb". */
  tier?: Tier;
  /** Default `localStorage`. */
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  /** Default `indexedDB`. Without one, large saves stay gzipped in localStorage. */
  indexedDB?: IDBFactory;
  /** The IndexedDB database. Default "gamebones". */
  db?: string;
}

export interface SaveInfo {
  tier: Tier;
  /** Characters (json, zip) or bytes (idb) stored. */
  size: number;
}

export interface Persist {
  /** The saved value, or null when there is none. Throws on a save that cannot be read (see setAside). */
  load(): Promise<unknown>;
  /** Like load, for saves in localStorage; undefined when the save is in IndexedDB. */
  loadSync(): unknown;
  /** Saves in the tier the size calls for. Rejects when storage refuses (quota). */
  save(data: unknown): Promise<SaveInfo>;
  /** Saves at once, in localStorage, for pagehide and visibilitychange. Throws when storage refuses. */
  saveSync(data: unknown): SaveInfo;
  /** Copies the current save to `<key>.broken`, so a save that failed to load is kept, not overwritten. */
  setAside(): Promise<void>;
  erase(): Promise<void>;
}

const ZIP = "gz:";
const IDB = "idb:";
const STORE = "saves";

export function persist(opts: PersistOptions): Persist {
  const key = opts.key;
  const jsonMax = opts.jsonMax ?? 2048;
  const zipMax = opts.zipMax ?? 10240;
  const ls = opts.storage ?? globalThis.localStorage;
  const idb = opts.indexedDB ?? globalThis.indexedDB;
  const dbName = opts.db ?? "gamebones";
  /** Bumped by every save: an IndexedDB write that finishes after a later save must not point at itself. */
  let seq = 0;
  let db: Promise<IDBDatabase> | undefined;

  const open = (): Promise<IDBDatabase> =>
    (db ??= new Promise((resolve, reject) => {
      const req = idb.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        db = undefined;
        reject(req.error);
      };
    }));
  const request = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const d = await open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
    });
  };

  const zip = (text: string): Uint8Array => gzipSync(strToU8(text));
  const unzip = (bytes: Uint8Array): unknown => JSON.parse(strFromU8(gunzipSync(bytes)));

  /** The localStorage form of a save, for the json and zip tiers. */
  const inline = (data: unknown, forced: Tier | undefined): { text: string; tier: Tier; fits: boolean } => {
    const json = JSON.stringify(data);
    if (forced === "json" || (!forced && json.length <= jsonMax)) return { text: json, tier: "json", fits: true };
    const text = ZIP + toBase64(zip(json));
    return { text, tier: "zip", fits: forced === "zip" || (forced !== "idb" && text.length <= zipMax) };
  };

  const parse = (raw: string): unknown => {
    if (raw.startsWith(ZIP)) return unzip(fromBase64(raw.slice(ZIP.length)));
    return JSON.parse(raw);
  };
  const read = (): string | null => ls.getItem(key);

  return {
    async load() {
      const raw = read();
      if (raw === null) return null;
      if (!raw.startsWith(IDB)) return parse(raw);
      const bytes = await request("readonly", (s) => s.get(key) as IDBRequest<Uint8Array | undefined>);
      if (!bytes) throw new Error(`persist: ${key} points into IndexedDB, but ${dbName} has no save there`);
      return unzip(bytes);
    },
    loadSync() {
      const raw = read();
      if (raw === null) return null;
      return raw.startsWith(IDB) ? undefined : parse(raw);
    },
    async save(data) {
      const mine = ++seq;
      const { text, tier, fits } = inline(data, opts.tier);
      if (fits || !idb) {
        ls.setItem(key, text);
        return { tier, size: text.length };
      }
      const bytes = zip(JSON.stringify(data));
      await request("readwrite", (s) => s.put(bytes, key));
      if (mine === seq) ls.setItem(key, IDB + dbName);
      return { tier: "idb", size: bytes.length };
    },
    saveSync(data) {
      ++seq;
      const { text, tier } = inline(data, opts.tier === "idb" ? undefined : opts.tier);
      ls.setItem(key, text);
      return { tier, size: text.length };
    },
    async setAside() {
      const raw = read();
      if (raw === null) return;
      if (raw.startsWith(IDB)) {
        const bytes = await request("readonly", (s) => s.get(key) as IDBRequest<Uint8Array | undefined>);
        if (bytes) await request("readwrite", (s) => s.put(bytes, `${key}.broken`));
      }
      ls.setItem(`${key}.broken`, raw);
    },
    async erase() {
      ++seq;
      ls.removeItem(key);
      // A large save may sit in IndexedDB even when localStorage no longer points at it.
      if (idb) await request("readwrite", (s) => s.delete(key)).catch(() => undefined);
    },
  };
}
