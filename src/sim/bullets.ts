// A pattern-bullet packed store (kernel D23/D24, written game-side because v1
// ships only `columns`). A bullet stores its spawn parameters, never its
// position: position is a closed-form function of time (D32, D48), so a
// bullet costs nothing between the moments someone asks where it is. The
// simulation asks only for bullets whose conservative `check` tick has come
// (see danmaku.ts); the renderer asks for all of them at fractional time.
//
// Motion per bullet: from (x0, y0) at t0 along (dx, dy) with speed v0,
// accelerating by `acc` per tick until speed `vEnd` (reached at `tc` ticks,
// having covered `sc` pixels). Optionally, at `turnAt` ticks it continues
// from where it is along (dx2, dy2) at constant speed v2. A bullet with a
// `life` is gone (pos() says it does not exist) that many ticks after t0.

import type { PackedStore } from "gamebones";

const FIELDS = [
  "x0",
  "y0",
  "t0",
  "dx",
  "dy",
  "v0",
  "acc",
  "vEnd",
  "tc",
  "sc",
  "turnAt",
  "dx2",
  "dy2",
  "v2",
  "style",
  "style2",
  "check",
  "grazed",
  // Last, so a snapshot from before it existed still restores (see restore()).
  "life",
] as const;

export type BulletField = (typeof FIELDS)[number];

export interface BulletSpawn {
  x: number;
  y: number;
  t0: number;
  dx: number;
  dy: number;
  speed: number;
  accel?: number;
  vEnd?: number;
  turnAt?: number;
  dx2?: number;
  dy2?: number;
  v2?: number;
  style: number;
  /** Style drawn between the bullet stopping and turning (a frozen bullet). */
  style2?: number;
  /** Ticks the bullet lives; 0 or absent: until it leaves the field. */
  life?: number;
}

const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export class BulletStore implements PackedStore {
  readonly capacity: number;
  private n = 0;
  private readonly cols: Record<BulletField, Float64Array>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cols = {} as Record<BulletField, Float64Array>;
    for (const f of FIELDS) this.cols[f] = new Float64Array(capacity);
  }

  get count(): number {
    return this.n;
  }

  /** A whole field, for bulk loops; indexes below `count` are live. */
  col(f: BulletField): Float64Array {
    return this.cols[f];
  }

  add(b: BulletSpawn): number {
    if (this.n >= this.capacity) return -1; // a full screen of danmaku drops extra bullets rather than throwing
    const i = this.n++;
    const c = this.cols;
    const acc = b.accel ?? 0;
    const vEnd = b.vEnd ?? b.speed;
    // Time and distance until the speed limit is reached.
    let tc = 0;
    if (acc !== 0 && (vEnd - b.speed) / acc > 0) tc = (vEnd - b.speed) / acc;
    c.x0[i] = b.x;
    c.y0[i] = b.y;
    c.t0[i] = b.t0;
    c.dx[i] = b.dx;
    c.dy[i] = b.dy;
    c.v0[i] = b.speed;
    c.acc[i] = tc > 0 ? acc : 0;
    c.vEnd[i] = tc > 0 ? vEnd : b.speed;
    c.tc[i] = tc;
    c.sc[i] = b.speed * tc + 0.5 * acc * tc * tc;
    c.turnAt[i] = b.turnAt ?? 0;
    c.dx2[i] = b.dx2 ?? 0;
    c.dy2[i] = b.dy2 ?? 0;
    c.v2[i] = b.v2 ?? 0;
    c.style[i] = b.style;
    c.style2[i] = b.style2 ?? b.style;
    c.check[i] = b.t0;
    c.grazed[i] = 0;
    c.life[i] = b.life ?? 0;
    return i;
  }

  remove(i: number): void {
    const last = this.n - 1;
    if (i < 0 || i > last) throw new Error(`bullets: remove(${i}) out of range; live rows are 0..${last}`);
    if (i !== last) for (const f of FIELDS) this.cols[f][i] = this.cols[f][last]!;
    this.n--;
  }

  clear(): void {
    this.n = 0;
  }

  /** Distance covered along the first leg after dt ticks. */
  private dist(i: number, dt: number): number {
    const c = this.cols;
    const tc = c.tc[i]!;
    if (tc > 0 && dt < tc) return c.v0[i]! * dt + 0.5 * c.acc[i]! * dt * dt;
    return c.sc[i]! + c.vEnd[i]! * (dt - tc);
  }

  /** Ticks after t0 when the bullet is gone (Infinity if it lives until it leaves the field). */
  endsAt(i: number): number {
    const life = this.cols.life[i]!;
    return life > 0 ? this.cols.t0[i]! + life : Infinity;
  }

  /** Position at time t (fractional t is fine). Writes into `out`; returns false before the bullet exists or after its life. */
  pos(i: number, t: number, out: { x: number; y: number }): boolean {
    const c = this.cols;
    const dt = t - c.t0[i]!;
    if (dt < 0 || t >= this.endsAt(i)) return false;
    const turn = c.turnAt[i]!;
    if (turn > 0 && dt > turn) {
      const s = this.dist(i, turn);
      const s2 = c.v2[i]! * (dt - turn);
      out.x = c.x0[i]! + c.dx[i]! * s + c.dx2[i]! * s2;
      out.y = c.y0[i]! + c.dy[i]! * s + c.dy2[i]! * s2;
      return true;
    }
    const s = this.dist(i, dt);
    out.x = c.x0[i]! + c.dx[i]! * s;
    out.y = c.y0[i]! + c.dy[i]! * s;
    return true;
  }

  /** Upper bound of the bullet's speed from time t on (for conservative checks). */
  maxSpeed(i: number, t: number): number {
    const c = this.cols;
    const dt = t - c.t0[i]!;
    const turn = c.turnAt[i]!;
    const first = Math.max(c.v0[i]!, c.vEnd[i]!);
    if (turn > 0) return dt > turn ? c.v2[i]! : Math.max(first, c.v2[i]!);
    return first;
  }

  /** The style to draw at time t (frozen bullets change style while stopped). */
  styleAt(i: number, t: number): number {
    const c = this.cols;
    const turn = c.turnAt[i]!;
    if (turn > 0) {
      const dt = t - c.t0[i]!;
      if (dt >= c.tc[i]! && dt <= turn) return c.style2[i]!;
    }
    return c.style[i]!;
  }

  // ----- the D23 contract -----

  snapshot(): Uint8Array {
    const n = this.n;
    const bytes = new Uint8Array(8 + n * 8 * FIELDS.length);
    new DataView(bytes.buffer).setUint32(0, n, true);
    const out = new Float64Array(bytes.buffer, 8, n * FIELDS.length);
    let o = 0;
    for (const f of FIELDS) {
      out.set(this.cols[f].subarray(0, n), o);
      o += n;
    }
    if (!LITTLE) throw new Error("bullets: big-endian hosts are not supported");
    return bytes;
  }

  restore(bytes: Uint8Array): void {
    const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true);
    if (n > this.capacity) throw new Error(`bullets: snapshot holds ${n} rows but capacity is ${this.capacity}`);
    // Snapshots from before `life` existed hold one field fewer; their bullets live until they leave.
    const width = bytes.byteLength === 8 + n * 8 * (FIELDS.length - 1) ? FIELDS.length - 1 : FIELDS.length;
    if (bytes.byteLength !== 8 + n * 8 * width) {
      throw new Error(`bullets: snapshot size ${bytes.byteLength} does not match ${FIELDS.length} fields x ${n} rows`);
    }
    const src = new Float64Array(bytes.slice(8).buffer, 0, n * width);
    let o = 0;
    for (const f of FIELDS.slice(0, width)) {
      this.cols[f].set(src.subarray(o, o + n));
      o += n;
    }
    if (width < FIELDS.length) this.cols.life.fill(0, 0, n);
    this.n = n;
  }

  hash(): string {
    let h = 0x811c9dc5 ^ this.n;
    for (const f of FIELDS) {
      const c = this.cols[f];
      const w = new Uint32Array(c.buffer, c.byteOffset, this.n * 2);
      for (let i = 0; i < this.n; i++) {
        let lo = w[2 * i]!;
        let hi = w[2 * i + 1]!;
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
  }

  describe(): { count: number } {
    return { count: this.n };
  }

  text(): string {
    return `${this.n} bullets`;
  }
}
