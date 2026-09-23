// A uniform bucket grid over a window around a moving centre (game-side
// stdlib for the kernel's missing spatial index, D14/D35). It is scratch, not
// state: rebuilt from a packed store's columns whenever a rule needs it, by a
// counting sort, so it is deterministic and never saved. Rows outside the
// window are simply not indexed (the swarm leash keeps them rare).

export class Grid {
  readonly cell: number;
  readonly side: number;
  private ox = 0;
  private oy = 0;
  private readonly start: Int32Array;
  private items: Int32Array;
  private cellOf: Int32Array;
  /** Scratch output of `query`. */
  readonly hits: Int32Array;
  hitCount = 0;

  constructor(cell: number, extent: number, capacity: number) {
    this.cell = cell;
    this.side = Math.ceil((2 * extent) / cell);
    this.start = new Int32Array(this.side * this.side + 1);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
    this.hits = new Int32Array(capacity);
  }

  /** Indexes rows 0..n-1 of (xs, ys) around (cx, cy). */
  build(xs: Float64Array, ys: Float64Array, n: number, cx: number, cy: number): void {
    if (n > this.items.length) {
      this.items = new Int32Array(n);
      this.cellOf = new Int32Array(n);
    }
    const side = this.side;
    const half = (side * this.cell) / 2;
    this.ox = cx - half;
    this.oy = cy - half;
    const start = this.start;
    start.fill(0);
    const inv = 1 / this.cell;
    for (let i = 0; i < n; i++) {
      const gx = Math.floor((xs[i]! - this.ox) * inv);
      const gy = Math.floor((ys[i]! - this.oy) * inv);
      if (gx < 0 || gy < 0 || gx >= side || gy >= side) {
        this.cellOf[i] = -1;
        continue;
      }
      const c = gy * side + gx;
      this.cellOf[i] = c;
      start[c + 1]!++;
    }
    for (let c = 0; c < side * side; c++) start[c + 1]! += start[c]!;
    // Fill in row order, so each bucket lists rows ascending (deterministic iteration).
    const fill = start.slice(0, side * side);
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i]!;
      if (c >= 0) this.items[fill[c]!++] = i;
    }
  }

  /** Rows in cells overlapping the square around (x, y) of half-size r, into `hits[0..hitCount)`. */
  query(x: number, y: number, r: number): number {
    const side = this.side;
    const inv = 1 / this.cell;
    const x0 = Math.max(0, Math.floor((x - r - this.ox) * inv));
    const y0 = Math.max(0, Math.floor((y - r - this.oy) * inv));
    const x1 = Math.min(side - 1, Math.floor((x + r - this.ox) * inv));
    const y1 = Math.min(side - 1, Math.floor((y + r - this.oy) * inv));
    let k = 0;
    const hits = this.hits;
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const c = gy * side + gx;
        for (let j = this.start[c]!; j < this.start[c + 1]!; j++) hits[k++] = this.items[j]!;
      }
    }
    this.hitCount = k;
    return k;
  }

  /** The row nearest to (x, y) within r, or -1. Ties go to the lower row. */
  nearest(x: number, y: number, r: number, xs: Float64Array, ys: Float64Array, skip?: (i: number) => boolean): number {
    const n = this.query(x, y, r);
    let best = -1;
    let bestD = r * r;
    for (let k = 0; k < n; k++) {
      const i = this.hits[k]!;
      if (skip && skip(i)) continue;
      const ddx = xs[i]! - x;
      const ddy = ys[i]! - y;
      const d = ddx * ddx + ddy * ddy;
      if (d < bestD || (d === bestD && i < best)) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
}
