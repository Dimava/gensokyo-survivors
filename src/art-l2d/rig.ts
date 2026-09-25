// A small Live2D-style rig, all open code: a model is layered parts (each a
// textured mesh with a draw order) hanging from a tree of deformers (warp
// grids and rotations), driven by named parameters. Every deformer and part
// holds keyforms on a grid of parameter keys and blends them multilinearly,
// the way Cubism does; spring pendulums turn head motion into hair sway.
// This module is pure data and math (no Pixi, no DOM), so tests and scripts
// can evaluate a model too; pixi-model.ts draws the result.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Params = Record<string, number>;

export interface ParamDef {
  id: string;
  min: number;
  max: number;
  def: number;
}

/**
 * Keyforms on a grid of parameter keys: `keys[i]` are the key values of
 * `params[i]` (ascending), and `forms` holds one form per key combination,
 * row-major with the last parameter varying fastest. No params: one form.
 */
export interface Keyed<F> {
  params: string[];
  keys: number[][];
  forms: F[];
}

/** Grid points (x, y pairs, (cols+1)*(rows+1) of them, row-major) in the parent's space. */
export type WarpForm = number[];

export interface WarpDeformer {
  kind: "warp";
  id: string;
  parent?: string;
  /** The rest rectangle the grid spans; points are mapped through it by their place in it. */
  rect: Rect;
  cols: number;
  rows: number;
  keyed: Keyed<WarpForm>;
}

export interface RotationForm {
  /** Degrees, clockwise on screen. */
  angle: number;
  /** Translation after the rotation. */
  x: number;
  y: number;
  scale: number;
}

export interface RotationDeformer {
  kind: "rotation";
  id: string;
  parent?: string;
  origin: [number, number];
  keyed: Keyed<RotationForm>;
}

export type Deformer = WarpDeformer | RotationDeformer;

export interface PartForm {
  opacity: number;
}

export type PartMesh = { kind: "grid"; nx: number; ny: number } | { kind: "poly"; points: number[] };

export interface Part {
  id: string;
  /** The deformer the part hangs from (none: model space). */
  parent?: string;
  /** Draw order: higher draws on top. */
  order: number;
  /** Where the texture lies in model space (its SVG viewBox). */
  rect: Rect;
  /** A grid over the rect, or a convex outline (fan-triangulated; exact, so it can clip). */
  mesh: PartMesh;
  /** SVG markup in model coordinates, drawn inside `rect`. */
  svg: string;
  keyed?: Keyed<PartForm>;
  /** Clip this part to another part's mesh (Live2D clipping). */
  mask?: string;
}

/** A spring pendulum: it follows a weighted sum of inputs with lag and overshoot, and writes the lag to `output` (clamped to -1..1). */
export interface Pendulum {
  output: string;
  inputs: { param: string; weight: number }[];
  /** Spring constant (1/s²) and damping (1/s). */
  stiffness: number;
  damping: number;
  /** Output per unit of lag. */
  gain: number;
}

export interface Model {
  id: string;
  /** Model space size. */
  w: number;
  h: number;
  params: ParamDef[];
  deformers: Deformer[];
  parts: Part[];
  physics: Pendulum[];
}

// ---------------------------------------------------------------- building

/** Every combination of keys, in form order (last parameter fastest). */
function combos(keys: number[][]): number[][] {
  let out: number[][] = [[]];
  for (const ks of keys) out = out.flatMap((c) => ks.map((k) => [...c, k]));
  return out;
}

/** A warp whose keyforms come from a function of each rest grid point and the key values. */
export function warp(
  id: string,
  parent: string | undefined,
  rect: Rect,
  cols: number,
  rows: number,
  params: [string, number[]][],
  fn: (x: number, y: number, keys: number[]) => [number, number],
): WarpDeformer {
  const keys = params.map(([, k]) => k);
  const forms = combos(keys).map((kv) => {
    const pts: number[] = [];
    for (let r = 0; r <= rows; r++)
      for (let c = 0; c <= cols; c++) {
        const [x, y] = fn(rect.x + (rect.w * c) / cols, rect.y + (rect.h * r) / rows, kv);
        pts.push(x, y);
      }
    return pts;
  });
  return { kind: "warp", id, parent, rect, cols, rows, keyed: { params: params.map(([p]) => p), keys, forms } };
}

export function rotation(
  id: string,
  parent: string | undefined,
  origin: [number, number],
  params: [string, number[]][],
  fn: (keys: number[]) => Partial<RotationForm>,
): RotationDeformer {
  const keys = params.map(([, k]) => k);
  const forms = combos(keys).map((kv) => ({ angle: 0, x: 0, y: 0, scale: 1, ...fn(kv) }));
  return { kind: "rotation", id, parent, origin, keyed: { params: params.map(([p]) => p), keys, forms } };
}

/** Part opacity keyed on parameters. */
export function opacityKeys(params: [string, number[]][], fn: (keys: number[]) => number): Keyed<PartForm> {
  const keys = params.map(([, k]) => k);
  return { params: params.map(([p]) => p), keys, forms: combos(keys).map((kv) => ({ opacity: fn(kv) })) };
}

// ---------------------------------------------------------------- meshes

export interface MeshData {
  /** Rest positions in model space. */
  rest: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export function meshOf(part: Part): MeshData {
  const { rect } = part;
  const pts: number[] = [];
  const idx: number[] = [];
  if (part.mesh.kind === "grid") {
    const { nx, ny } = part.mesh;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pts.push(rect.x + (rect.w * i) / nx, rect.y + (rect.h * j) / ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + nx + 1;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
  } else {
    const ring = part.mesh.points;
    const n = ring.length / 2;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < n; i++) {
      cx += ring[i * 2]! / n;
      cy += ring[i * 2 + 1]! / n;
    }
    pts.push(cx, cy, ...ring);
    for (let i = 0; i < n; i++) idx.push(0, 1 + i, 1 + ((i + 1) % n));
  }
  const rest = new Float32Array(pts);
  const uvs = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i += 2) {
    uvs[i] = (pts[i]! - rect.x) / rect.w;
    uvs[i + 1] = (pts[i + 1]! - rect.y) / rect.h;
  }
  return { rest, uvs, indices: new Uint32Array(idx) };
}

// ---------------------------------------------------------------- evaluation
//
// Compiled once per rig: every deformer's keyforms flattened into one typed
// array, and each part's chain of deformers (its parent, the parent's parent,
// ...) as indices. A frame blends each deformer in use once, into a buffer of
// its own, then pushes every vertex up its chain in plain numbers: no
// closures, no tuples, no garbage. The arithmetic is the same, in the same
// order, as mapping through nested functions would do it, so the result is
// the same to the bit.

/**
 * Where a point falls in a warp's grid: the index of its cell's first point
 * and the fractions across the cell. Outside the grid the edge cell extends
 * linearly. (deformInto inlines the same arithmetic.)
 */
function cellOf(d: Compiled, x: number, y: number): { a: number; fu: number; fv: number } {
  const u = ((x - d.rx) / d.rw) * d.cols;
  const s = ((y - d.ry) / d.rh) * d.rows;
  let i = Math.floor(u);
  if (i > d.cols - 1) i = d.cols - 1;
  if (i < 0) i = 0;
  let j = Math.floor(s);
  if (j > d.rows - 1) j = d.rows - 1;
  if (j < 0) j = 0;
  return { a: (j * (d.cols + 1) + i) * 2, fu: u - i, fv: s - j };
}

/** A deformer ready to blend: flattened keyforms and its own output buffer. */
interface Compiled {
  warp: boolean;
  /** Index of the parent deformer, -1 at the root. */
  parent: number;
  params: string[];
  keys: number[][];
  /** Floats per form: warp grid points, or rotation [angle, x, y, scale]. */
  len: number;
  forms: Float64Array;
  /** Warp: the blended grid points. Rotation: [cos * scale, sin * scale, x, y]. */
  out: Float64Array;
  /** The parameter values `out` was blended for (NaN: never blended). */
  seen: Float64Array;
  /** Warp rect and grid. */
  rx: number;
  ry: number;
  rw: number;
  rh: number;
  cols: number;
  rows: number;
  /** Rotation origin. */
  ox: number;
  oy: number;
}

/** A part's keyed opacities, flattened. */
interface CompiledOpacity {
  params: string[];
  keys: number[][];
  forms: Float64Array;
}

export interface PartFrame {
  id: string;
  /** Deformed vertex positions in model space. */
  positions: Float32Array;
  opacity: number;
}

/** A model with live parameters and physics state. */
export class Rig {
  readonly params: Params = {};
  readonly meshes: Record<string, MeshData> = {};
  private readonly defs = new Map<string, ParamDef>();
  private readonly swing = new Map<Pendulum, { pos: number; vel: number }>();
  private readonly compiled: Compiled[] = [];
  /** The deformers some part hangs from, directly or through children (the rest are never blended). */
  private readonly live: number[];
  /** Per part (model order): its deformer chain, innermost first. */
  private readonly chains: Int32Array[] = [];
  private readonly opacities: (CompiledOpacity | null)[] = [];
  /**
   * Per part hanging straight from a warp: where each rest vertex falls in
   * that warp's grid (the cell's first point index, and the fractions across
   * it), which never changes; null for the others.
   */
  private readonly cells: ({ at: Int32Array; frac: Float64Array } | null)[] = [];
  /** Weight scratch: two ping-pong lists of (form index, weight), as long as the biggest key grid corner count. */
  private readonly wIdx: [Int32Array, Int32Array];
  private readonly wVal: [Float64Array, Float64Array];
  private wLen = 0;

  constructor(readonly model: Model) {
    for (const p of model.params) {
      this.params[p.id] = p.def;
      this.defs.set(p.id, p);
    }
    for (const part of model.parts) this.meshes[part.id] = meshOf(part);
    const index = new Map<string, number>();
    model.deformers.forEach((d, i) => index.set(d.id, i));
    const at = (id: string): number => {
      const i = index.get(id);
      if (i === undefined) throw new Error(`rig ${model.id}: no deformer ${id}`);
      return i;
    };
    let most = 1;
    for (const d of model.deformers) {
      const k = d.keyed;
      most = Math.max(most, 2 ** k.params.length);
      const warp = d.kind === "warp";
      const len = warp ? (d.cols + 1) * (d.rows + 1) * 2 : 4;
      const forms = new Float64Array(k.forms.length * len);
      k.forms.forEach((f, n) => {
        if (warp) forms.set(f as WarpForm, n * len);
        else {
          const r = f as RotationForm;
          forms.set([r.angle, r.x, r.y, r.scale], n * len);
        }
      });
      this.compiled.push({
        warp,
        parent: d.parent ? at(d.parent) : -1,
        params: k.params,
        keys: k.keys,
        len,
        forms,
        out: new Float64Array(len),
        seen: new Float64Array(k.params.length).fill(NaN),
        rx: d.kind === "warp" ? d.rect.x : 0,
        ry: d.kind === "warp" ? d.rect.y : 0,
        rw: d.kind === "warp" ? d.rect.w : 1,
        rh: d.kind === "warp" ? d.rect.h : 1,
        cols: d.kind === "warp" ? d.cols : 0,
        rows: d.kind === "warp" ? d.rows : 0,
        ox: d.kind === "rotation" ? d.origin[0] : 0,
        oy: d.kind === "rotation" ? d.origin[1] : 0,
      });
    }
    const used = new Set<number>();
    for (const part of model.parts) {
      const chain: number[] = [];
      for (let i = part.parent ? at(part.parent) : -1; i >= 0; i = this.compiled[i]!.parent) {
        chain.push(i);
        used.add(i);
      }
      this.chains.push(Int32Array.from(chain));
      const k = part.keyed;
      if (k) most = Math.max(most, 2 ** k.params.length);
      this.opacities.push(k ? { params: k.params, keys: k.keys, forms: Float64Array.from(k.forms, (f) => f.opacity) } : null);
    }
    this.live = [...used].sort((a, b) => a - b);
    model.parts.forEach((part, p) => {
      const d = this.compiled[this.chains[p]![0] ?? -1];
      if (!d?.warp) return void this.cells.push(null);
      const rest = this.meshes[part.id]!.rest;
      const at = new Int32Array(rest.length / 2);
      const frac = new Float64Array(rest.length);
      for (let v = 0; v < rest.length; v += 2) {
        const c = cellOf(d, rest[v]!, rest[v + 1]!);
        at[v / 2] = c.a;
        frac[v] = c.fu;
        frac[v + 1] = c.fv;
      }
      this.cells.push({ at, frac });
    });
    this.wIdx = [new Int32Array(most), new Int32Array(most)];
    this.wVal = [new Float64Array(most), new Float64Array(most)];
  }

  /** Set a parameter, clamped to its range. */
  set(id: string, v: number): void {
    const def = this.defs.get(id);
    this.params[id] = def ? Math.max(def.min, Math.min(def.max, v)) : v;
  }

  /** Advance the pendulums by `dt` seconds (call before evaluate). */
  step(dt: number): void {
    const h = Math.min(dt, 0.05);
    for (const pen of this.model.physics) {
      let target = 0;
      for (const i of pen.inputs) target += (this.params[i.param] ?? 0) * i.weight;
      let st = this.swing.get(pen);
      if (!st) this.swing.set(pen, (st = { pos: target, vel: 0 }));
      // Two substeps keep stiff springs stable at low frame rates.
      for (let k = 0; k < 2; k++) {
        const acc = pen.stiffness * (target - st.pos) - pen.damping * st.vel;
        st.vel += acc * (h / 2);
        st.pos += st.vel * (h / 2);
      }
      this.params[pen.output] = Math.max(-1, Math.min(1, (st.pos - target) * pen.gain));
    }
  }

  /**
   * The keyform weights for the current parameters: multilinear over the key
   * grid (the last parameter varying fastest), near-zero weights dropped.
   * Leaves (form index, weight) pairs in wIdx/wVal[returned], wLen of them.
   */
  private weigh(params: string[], keys: number[][]): 0 | 1 {
    let cur: 0 | 1 = 0;
    this.wIdx[0][0] = 0;
    this.wVal[0][0] = 1;
    let len = 1;
    for (let i = 0; i < params.length; i++) {
      const ks = keys[i]!;
      const v = this.params[params[i]!] ?? 0;
      let j = 0;
      while (j < ks.length - 2 && v > ks[j + 1]!) j++;
      let t = ks.length < 2 ? 0 : (v - ks[j]!) / (ks[j + 1]! - ks[j]!);
      t = Math.max(0, Math.min(1, t));
      const fromI = this.wIdx[cur];
      const fromW = this.wVal[cur];
      const next: 0 | 1 = cur ? 0 : 1;
      const toI = this.wIdx[next];
      const toW = this.wVal[next];
      let n = 0;
      for (let q = 0; q < len; q++) {
        const idx = fromI[q]!;
        const w = fromW[q]!;
        toI[n] = idx * ks.length + j;
        toW[n++] = w * (1 - t);
        if (ks.length > 1) {
          toI[n] = idx * ks.length + j + 1;
          toW[n++] = w * t;
        }
      }
      len = n;
      cur = next;
    }
    const I = this.wIdx[cur];
    const W = this.wVal[cur];
    let n = 0;
    for (let q = 0; q < len; q++)
      if (W[q]! > 1e-6) {
        I[n] = I[q]!;
        W[n++] = W[q]!;
      }
    this.wLen = n;
    return cur;
  }

  /** Blend a deformer's keyforms into its buffer, unless its parameters are where they were last time. */
  private blend(d: Compiled): void {
    let same = true;
    for (let i = 0; i < d.params.length; i++) {
      const v = this.params[d.params[i]!] ?? 0;
      if (v !== d.seen[i]) {
        same = false;
        d.seen[i] = v;
      }
    }
    if (same) return;
    const r = this.weigh(d.params, d.keys);
    const I = this.wIdx[r];
    const W = this.wVal[r];
    const { len, forms, out } = d;
    if (d.warp) {
      out.fill(0);
      for (let q = 0; q < this.wLen; q++) {
        const base = I[q]! * len;
        const w = W[q]!;
        for (let i = 0; i < len; i++) out[i]! += forms[base + i]! * w;
      }
      return;
    }
    let angle = 0;
    let x = 0;
    let y = 0;
    let scale = 0;
    for (let q = 0; q < this.wLen; q++) {
      const base = I[q]! * 4;
      const w = W[q]!;
      angle += forms[base]! * w;
      x += forms[base + 1]! * w;
      y += forms[base + 2]! * w;
      scale += forms[base + 3]! * w;
    }
    const a = (angle * Math.PI) / 180;
    out[0] = Math.cos(a) * scale;
    out[1] = Math.sin(a) * scale;
    out[2] = x;
    out[3] = y;
  }

  private opacity(k: CompiledOpacity): number {
    const r = this.weigh(k.params, k.keys);
    const I = this.wIdx[r];
    const W = this.wVal[r];
    let o = 0;
    for (let q = 0; q < this.wLen; q++) o += k.forms[I[q]!]! * W[q]!;
    return o;
  }

  /**
   * Deform every part for the current parameters into `out` (one array per
   * part in model order, each as long as the part's rest positions) and its
   * opacity into `opacity`. Allocates nothing.
   */
  deformInto(out: Float32Array[], opacity: Float64Array): void {
    const C = this.compiled;
    for (const i of this.live) this.blend(C[i]!);
    const parts = this.model.parts;
    for (let p = 0; p < parts.length; p++) {
      const rest = this.meshes[parts[p]!.id]!.rest;
      const pos = out[p]!;
      const chain = this.chains[p]!;
      const cell = this.cells[p];
      const first = cell ? C[chain[0]!]!.out : null;
      for (let v = 0; v < rest.length; v += 2) {
        let x = rest[v]!;
        let y = rest[v + 1]!;
        let c = 0;
        if (cell && first) {
          // The first warp: the cell is known, only the grid moved.
          const o = first;
          const a = cell.at[v >> 1]!;
          const fu = cell.frac[v]!;
          const fv = cell.frac[v + 1]!;
          const d = C[chain[0]!]!;
          const e = a + (d.cols + 1) * 2;
          const top0 = o[a]! + (o[a + 2]! - o[a]!) * fu;
          const top1 = o[a + 1]! + (o[a + 3]! - o[a + 1]!) * fu;
          const bot0 = o[e]! + (o[e + 2]! - o[e]!) * fu;
          const bot1 = o[e + 1]! + (o[e + 3]! - o[e + 1]!) * fu;
          x = top0 + (bot0 - top0) * fv;
          y = top1 + (bot1 - top1) * fv;
          c = 1;
        }
        for (; c < chain.length; c++) {
          const d = C[chain[c]!]!;
          const o = d.out;
          if (d.warp) {
            const cols = d.cols;
            const rows = d.rows;
            const u = ((x - d.rx) / d.rw) * cols;
            const s = ((y - d.ry) / d.rh) * rows;
            // Outside the grid the edge cell extends linearly (as in cellOf).
            let i = Math.floor(u);
            if (i > cols - 1) i = cols - 1;
            if (i < 0) i = 0;
            let j = Math.floor(s);
            if (j > rows - 1) j = rows - 1;
            if (j < 0) j = 0;
            const fu = u - i;
            const fv = s - j;
            const a = (j * (cols + 1) + i) * 2;
            const b = a + 2;
            const e = a + (cols + 1) * 2;
            const f = e + 2;
            const top0 = o[a]! + (o[b]! - o[a]!) * fu;
            const top1 = o[a + 1]! + (o[b + 1]! - o[a + 1]!) * fu;
            const bot0 = o[e]! + (o[f]! - o[e]!) * fu;
            const bot1 = o[e + 1]! + (o[f + 1]! - o[e + 1]!) * fu;
            x = top0 + (bot0 - top0) * fv;
            y = top1 + (bot1 - top1) * fv;
          } else {
            const dx = x - d.ox;
            const dy = y - d.oy;
            x = d.ox + dx * o[0]! - dy * o[1]! + o[2]!;
            y = d.oy + dx * o[1]! + dy * o[0]! + o[3]!;
          }
        }
        pos[v] = x;
        pos[v + 1] = y;
      }
      const k = this.opacities[p];
      opacity[p] = k ? this.opacity(k) : 1;
    }
  }

  /** Deform every part for the current parameters, into fresh arrays (deformInto reuses the caller's). */
  evaluate(): PartFrame[] {
    const parts = this.model.parts;
    const out = parts.map((p) => new Float32Array(this.meshes[p.id]!.rest.length));
    const opacity = new Float64Array(parts.length);
    this.deformInto(out, opacity);
    return parts.map((p, i) => ({ id: p.id, positions: out[i]!, opacity: opacity[i]! }));
  }
}
