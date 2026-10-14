// A uniform bucket grid over a square window around a moving centre: the spatial index the
// kernel does not have. It is scratch, not state: rebuilt from a packed store's columns when a
// rule needs it, by a counting sort, so it is deterministic and never saved. Rows outside the
// window are not indexed; size the window so that is rare (a leash on the swarm).
// Queries allocate nothing: they write row indices into `hits`.

type Coords = ArrayLike<number>;

export class Grid {
  /** Cell size in world units. */
  readonly cell: number;
  /** Cells per side. */
  readonly side: number;
  private ox = 0;
  private oy = 0;
  private readonly start: Int32Array;
  private items: Int32Array;
  private cellOf: Int32Array;
  /** Scratch write cursors for build's fill pass (reused, so a build allocates nothing). */
  private readonly fill: Int32Array;
  /** The rows found by the last `query`, in `hits[0..hitCount)`. Grows with the rows built. */
  hits: Int32Array;
  hitCount = 0;

  /** `extent`: the window reaches this far from the centre each way. `capacity`: rows expected (grows). */
  constructor(cell: number, extent: number, capacity = 64) {
    this.cell = cell;
    this.side = Math.ceil((2 * extent) / cell);
    this.start = new Int32Array(this.side * this.side + 1);
    this.fill = new Int32Array(this.side * this.side);
    this.items = new Int32Array(capacity);
    this.cellOf = new Int32Array(capacity);
    this.hits = new Int32Array(capacity);
  }

  /** Indexes rows 0..n-1 of (xs, ys) around (cx, cy). */
  build(xs: Coords, ys: Coords, n: number, cx = 0, cy = 0): void {
    if (n > this.items.length) {
      const size = Math.max(n, this.items.length * 2);
      this.items = new Int32Array(size);
      this.cellOf = new Int32Array(size);
      this.hits = new Int32Array(size);
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
      // NaN coordinates fail every comparison, so test for inside rather than outside.
      if (!(gx >= 0 && gy >= 0 && gx < side && gy < side)) {
        this.cellOf[i] = -1;
        continue;
      }
      const c = gy * side + gx;
      this.cellOf[i] = c;
      start[c + 1]!++;
    }
    for (let c = 0; c < side * side; c++) start[c + 1]! += start[c]!;
    // Fill in row order, so each bucket lists rows ascending (deterministic iteration).
    const fill = this.fill;
    fill.set(start.subarray(0, side * side));
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i]!;
      if (c >= 0) this.items[fill[c]!++] = i;
    }
  }

  /**
   * Rows in the cells overlapping the square of half-size r around (x, y), into
   * `hits[0..hitCount)`; returns the count. A broad phase: test the distance yourself.
   * Cells are visited row by row, rows ascending within a cell.
   */
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

  /** The row nearest to (x, y), closer than r, or -1. Ties go to the lower row. */
  nearest(x: number, y: number, r: number, xs: Coords, ys: Coords, skip?: (i: number) => boolean): number {
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
