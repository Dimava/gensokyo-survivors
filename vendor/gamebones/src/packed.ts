// Packed stores (D6, D23): bulk data kept in typed arrays rather than as
// entities. The kernel only needs the contract below; `columns` is the one
// stock store in v1.

/** Host byte order: typed arrays use it, snapshots and hashes must not depend on it. */
const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const LO = LITTLE ? 0 : 1;
const HI = LITTLE ? 1 : 0;

/** ArrayBuffer.prototype.transfer (ES2024), typed here so games need no es2024 lib. */
type ResizableBuf = ArrayBuffer & { transfer(newByteLength: number): ArrayBuffer };

function swapWords(bytes: Uint8Array, from: number): void {
  for (let i = from; i + 8 <= bytes.length; i += 8) bytes.subarray(i, i + 8).reverse();
}

/** What the kernel needs from a packed store: snapshots for saves and rollback, a hash for the log. */
export interface PackedStore {
  /** A self-contained copy of the store's data, for rollback inside a dispatch. */
  snapshot(): Uint8Array;
  /** Replaces the store's data with a snapshot taken by the same store type. */
  restore(bytes: Uint8Array): void;
  /** A hash of the data, used in the log's hash chain; NaN must hash canonically. */
  hash(): string;
  /**
   * The store in saves: plain JSON, readable and editable by migrations. Without it a save
   * carries the snapshot as base64.
   */
  save?(): unknown;
  /** Loads what `save` wrote (after the scope's migrations ran on it). */
  load?(data: unknown): void;
  /** An aggregate summary for the trace (a row count, a total); keep it small. */
  describe?(): unknown;
  /** A text render for harness transcripts. */
  text?(): string;
}

export interface ColumnsOptions<F extends string> {
  fields: readonly F[];
  /** Rows allocated up front; the store doubles when it fills, so this is only a hint. Default 64. */
  capacity?: number;
  /** Values for fields `add` leaves out, and for columns a save does not have. Default 0. */
  defaults?: Partial<Record<F, number>>;
  /** Rows `text()` prints before eliding; default 3. */
  textRows?: number;
}

/** A column in a save: numbers, with NaN, the infinities and -0 as strings (JSON has none of them). */
export type SavedColumn = (number | "NaN" | "Infinity" | "-Infinity" | "-0")[];

/** The columns store in a save: `{ count, <field>: [...] }`, each column `count` long. */
export type SavedColumns = { count: number } & Record<string, SavedColumn | number>;

/** Struct-of-arrays store: one Float64Array per field, rows 0..count-1, swap-remove. */
export interface Columns<F extends string> extends PackedStore {
  readonly fields: readonly F[];
  /** Rows allocated right now; `add` past it doubles the store. */
  readonly capacity: number;
  /** Live rows are 0..count-1. */
  readonly count: number;
  /** Appends a row and returns its index. Missing fields take their default. */
  add(values: Partial<Record<F, number>>): number;
  /** Removes row i by moving the last row into it (so row indexes are not stable across removals). */
  remove(i: number): void;
  /** Removes every row. */
  clear(): void;
  /**
   * The whole column; only indexes below `count` are live. Write to it directly in bulk rules.
   * When the store grows, its columns are replaced and the old arrays are emptied (length 0), so
   * take `col` again after an `add` rather than keeping one from before it.
   */
  col(field: F): Float64Array;
  /** One row as an object, for tests and debugging. */
  row(i: number): Record<F, number>;
  save(): SavedColumns;
  load(data: unknown): void;
  describe(): { count: number };
  text(): string;
}

function encode(v: number): SavedColumn[number] {
  if (v === v && v !== Infinity && v !== -Infinity) return Object.is(v, -0) ? "-0" : v;
  return v !== v ? "NaN" : v > 0 ? "Infinity" : "-Infinity";
}

function decode(v: unknown, where: string): number {
  if (typeof v === "number") return v;
  if (v === "NaN") return NaN;
  if (v === "Infinity") return Infinity;
  if (v === "-Infinity") return -Infinity;
  if (v === "-0") return -0;
  throw new Error(`${where}: ${JSON.stringify(v)} is not a number`);
}

export function columns<const F extends string>(opts: ColumnsOptions<F>): Columns<F> {
  const { fields } = opts;
  let capacity = opts.capacity ?? 64;
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error(`columns: capacity must be a positive integer, got ${capacity}`);
  }
  if (fields.length === 0) throw new Error("columns: declare at least one field");
  if ((fields as readonly string[]).includes("count")) {
    throw new Error('columns: "count" is reserved (saves write the row count under it); rename the field');
  }
  const defaults = fields.map((f) => opts.defaults?.[f] ?? 0);
  const cols = fields.map(() => new Float64Array(capacity));
  // A null-prototype record for col(): a property load instead of a Map lookup on the hot path.
  let byName = Object.create(null) as Record<string, Float64Array | undefined>;
  const index = new Map<string, number>(fields.map((f, i) => [f, i]));
  const rebind = () => {
    byName = Object.create(null) as Record<string, Float64Array | undefined>;
    fields.forEach((f, i) => (byName[f] = cols[i]));
  };
  rebind();
  let count = 0;
  const colOf = (field: F): Float64Array => {
    const c = byName[field];
    if (c === undefined) throw new Error(`columns: unknown field "${field}"; fields: ${fields.join(", ")}`);
    return c;
  };
  /** Grows every column to hold `rows`. The old buffers are detached, so stale col() arrays read empty. */
  const grow = (rows: number) => {
    let next = capacity;
    while (next < rows) next *= 2;
    if (next === capacity) return;
    // ES2024 transfer: copies (or reallocates in place) and detaches the old buffer.
    for (let i = 0; i < cols.length; i++) cols[i] = new Float64Array((cols[i]!.buffer as ResizableBuf).transfer(next * 8));
    capacity = next;
    rebind();
  };
  const store: Columns<F> = {
    fields,
    get capacity() {
      return capacity;
    },
    get count() {
      return count;
    },
    add(values) {
      if (count >= capacity) grow(count + 1);
      for (let i = 0; i < fields.length; i++) cols[i]![count] = values[fields[i]!] ?? defaults[i]!;
      return count++;
    },
    remove(i) {
      if (!Number.isInteger(i) || i < 0 || i >= count) {
        throw new Error(`columns: remove(${i}) out of range; live rows are 0..${count - 1}`);
      }
      const last = count - 1;
      for (const c of cols) {
        if (i !== last) c[i] = c[last]!;
        c[last] = 0;
      }
      count--;
    },
    clear() {
      for (const c of cols) c.fill(0, 0, count);
      count = 0;
    },
    col: colOf,
    row(i) {
      const out = {} as Record<F, number>;
      for (const f of fields) out[f] = colOf(f)[i]!;
      return out;
    },
    snapshot() {
      // Layout: u32 count (little-endian), 4 bytes padding, then each column's live rows as
      // float64 in field order. Copied with typed arrays; the host byte order is recorded by
      // LITTLE and swapped on restore if a big-endian host ever reads a little-endian save.
      const bytes = new Uint8Array(8 + count * 8 * fields.length);
      new DataView(bytes.buffer).setUint32(0, count, true);
      const out = new Float64Array(bytes.buffer, 8, count * fields.length);
      let o = 0;
      for (const c of cols) {
        out.set(c.subarray(0, count), o);
        o += count;
      }
      if (!LITTLE) swapWords(bytes, 8);
      return bytes;
    },
    restore(bytes) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const n = dv.getUint32(0, true);
      if (bytes.byteLength !== 8 + n * 8 * fields.length) {
        throw new Error(`columns: snapshot size ${bytes.byteLength} does not match ${fields.length} fields x ${n} rows`);
      }
      grow(n);
      const copy = bytes.slice();
      if (!LITTLE) swapWords(copy, 8);
      const src = new Float64Array(copy.buffer, 8, n * fields.length);
      let o = 0;
      for (const c of cols) {
        c.fill(0);
        c.set(src.subarray(o, o + n));
        o += n;
      }
      count = n;
    },
    save() {
      const out: SavedColumns = { count };
      for (let i = 0; i < fields.length; i++) {
        const c = cols[i]!;
        const col: SavedColumn = [];
        for (let r = 0; r < count; r++) col.push(encode(c[r]!));
        out[fields[i]!] = col;
      }
      return out;
    },
    load(data) {
      // Columns match by name: one the save lacks takes its default, one the store lacks is ignored.
      // So adding or dropping a field needs no migration.
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error(`columns: a saved store is { count, <field>: [...] }, got ${typeof data === "string" ? "a string (a save older than named columns)" : JSON.stringify(data)}`);
      }
      const saved = data as Record<string, unknown>;
      const n = saved.count;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0) throw new Error(`columns: saved count ${JSON.stringify(n)} is not a row count`);
      grow(n);
      for (const [f, i] of index) {
        const c = cols[i]!;
        c.fill(0);
        const raw = saved[f];
        if (raw === undefined) {
          c.fill(defaults[i]!, 0, n);
          continue;
        }
        if (!Array.isArray(raw) || raw.length !== n) {
          throw new Error(`columns: saved column "${f}" should be an array of ${n} numbers, got ${Array.isArray(raw) ? `${raw.length}` : typeof raw}`);
        }
        for (let r = 0; r < n; r++) c[r] = decode(raw[r], `columns: saved column "${f}" row ${r}`);
      }
      count = n;
    },
    hash() {
      // Hashes the live rows' bits directly, NaN canonicalized (D12), word order fixed.
      let h = 0x811c9dc5 ^ count;
      for (const c of cols) {
        const w = new Uint32Array(c.buffer, c.byteOffset, count * 2);
        for (let i = 0; i < count; i++) {
          let lo = w[2 * i + LO]!;
          let hi = w[2 * i + HI]!;
          if (c[i] !== c[i]) {
            lo = 0;
            hi = 0x7ff80000;
          }
          h = Math.imul(h ^ lo, 0x01000193);
          h = Math.imul(h ^ hi, 0x01000193);
        }
      }
      h ^= h >>> 15;
      return (Math.imul(h, 0x2c1b3c6d) >>> 0).toString(16).padStart(8, "0");
    },
    describe() {
      return { count };
    },
    text() {
      const shown = Math.min(count, opts.textRows ?? 3);
      const lines = [`${count} rows`];
      for (let i = 0; i < shown; i++) {
        lines.push(`  [${i}] ${fields.map((f) => `${f}=${short(colOf(f)[i]!)}`).join(" ")}`);
      }
      if (count > shown) lines.push(`  ... ${count - shown} more`);
      return lines.join("\n");
    },
  };
  return store;
}

function short(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}
