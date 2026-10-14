// Canonical JSON (sorted keys) and FNV-1a. The log's hash chain runs
// canonicalJson over every dispatch's changes, which doubles as the
// plain-JSON guard: it throws on anything state must not contain (D12, D30).

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error(`non-finite number in state: ${value}; state holds finite numbers only`);
      return String(value); // same text as JSON.stringify for finite numbers, -0 included
    case "object":
      break;
    default:
      throw new Error(`non-JSON value in state: ${typeof value}; state holds plain JSON only`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(
      `non-plain object in state: ${proto?.constructor?.name ?? "unknown"}; state holds plain JSON only (use a packed store for binary data)`,
    );
  }
  const keys = Object.keys(value as object).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const v = (value as Record<string, unknown>)[key];
    if (v === undefined) continue;
    parts.push(`${quoteKey(key)}:${canonicalJson(v)}`);
  }
  return `{${parts.join(",")}}`;
}

const keyCache = new Map<string, string>();
function quoteKey(key: string): string {
  let q = keyCache.get(key);
  if (q === undefined) {
    q = JSON.stringify(key);
    if (keyCache.size < 10_000) keyCache.set(key, q);
  }
  return q;
}

export function fnv1a(str: string, seed = 0x811c9dc5): string {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** FNV-1a over bytes, 32-bit, as 8 hex chars. */
export function fnv1aBytes(bytes: Uint8Array, seed = 0x811c9dc5): string {
  let h = seed;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hashValue(value: unknown): string {
  return fnv1a(canonicalJson(value));
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

/** Base64 without Buffer or btoa, so the kernel runs unchanged in any host. */
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += `${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}==`;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += `${B64[(n >> 18) & 63]!}${B64[(n >> 12) & 63]!}${B64[(n >> 6) & 63]!}=`;
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INDEX.get(clean[i]!) ?? 0;
    const b = B64_INDEX.get(clean[i + 1] ?? "A") ?? 0;
    const c = B64_INDEX.get(clean[i + 2] ?? "A") ?? 0;
    const d = B64_INDEX.get(clean[i + 3] ?? "A") ?? 0;
    const n = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
