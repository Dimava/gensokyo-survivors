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

// ---------------------------------------------------------------- blending

/** Weights of the keyform grid for the current parameters: [form index, weight][]. */
function weights(k: Keyed<unknown>, p: Params): [number, number][] {
  let out: [number, number][] = [[0, 1]];
  for (let i = 0; i < k.params.length; i++) {
    const keys = k.keys[i]!;
    const v = p[k.params[i]!] ?? 0;
    let j = 0;
    while (j < keys.length - 2 && v > keys[j + 1]!) j++;
    let t = keys.length < 2 ? 0 : (v - keys[j]!) / (keys[j + 1]! - keys[j]!);
    t = Math.max(0, Math.min(1, t));
    const next: [number, number][] = [];
    for (const [idx, w] of out) {
      next.push([idx * keys.length + j, w * (1 - t)]);
      if (keys.length > 1) next.push([idx * keys.length + j + 1, w * t]);
    }
    out = next;
  }
  return out.filter(([, w]) => w > 1e-6);
}

function blendArray(k: Keyed<number[]>, p: Params): number[] {
  const ws = weights(k, p);
  const out = Array.from<number>({ length: k.forms[0]!.length }).fill(0);
  for (const [idx, w] of ws) {
    const f = k.forms[idx]!;
    for (let i = 0; i < out.length; i++) out[i]! += f[i]! * w;
  }
  return out;
}

function blendObject<F extends object>(k: Keyed<F>, p: Params): F {
  const ws = weights(k, p);
  const out: Record<string, number> = {};
  for (const [idx, w] of ws) for (const [key, val] of Object.entries(k.forms[idx]!)) out[key] = (out[key] ?? 0) + (val as number) * w;
  return out as F;
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

type Mapper = (x: number, y: number) => [number, number];

function warpMapper(d: WarpDeformer, pts: number[]): Mapper {
  const { rect, cols, rows } = d;
  const stride = cols + 1;
  return (x, y) => {
    const u = ((x - rect.x) / rect.w) * cols;
    const v = ((y - rect.y) / rect.h) * rows;
    // Outside the grid the edge cell extends linearly.
    const i = Math.max(0, Math.min(cols - 1, Math.floor(u)));
    const j = Math.max(0, Math.min(rows - 1, Math.floor(v)));
    const fu = u - i;
    const fv = v - j;
    const a = (j * stride + i) * 2;
    const b = a + 2;
    const c = a + stride * 2;
    const e = c + 2;
    const top = [pts[a]! + (pts[b]! - pts[a]!) * fu, pts[a + 1]! + (pts[b + 1]! - pts[a + 1]!) * fu];
    const bot = [pts[c]! + (pts[e]! - pts[c]!) * fu, pts[c + 1]! + (pts[e + 1]! - pts[c + 1]!) * fu];
    return [top[0]! + (bot[0]! - top[0]!) * fv, top[1]! + (bot[1]! - top[1]!) * fv];
  };
}

function rotationMapper(d: RotationDeformer, f: RotationForm): Mapper {
  const a = (f.angle * Math.PI) / 180;
  const cos = Math.cos(a) * f.scale;
  const sin = Math.sin(a) * f.scale;
  const [ox, oy] = d.origin;
  return (x, y) => {
    const dx = x - ox;
    const dy = y - oy;
    return [ox + dx * cos - dy * sin + f.x, oy + dx * sin + dy * cos + f.y];
  };
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
  private readonly byId = new Map<string, Deformer>();
  private readonly swing = new Map<Pendulum, { pos: number; vel: number }>();

  constructor(readonly model: Model) {
    for (const p of model.params) this.params[p.id] = p.def;
    for (const d of model.deformers) this.byId.set(d.id, d);
    for (const part of model.parts) this.meshes[part.id] = meshOf(part);
  }

  /** Set a parameter, clamped to its range. */
  set(id: string, v: number): void {
    const def = this.model.params.find((p) => p.id === id);
    this.params[id] = def ? Math.max(def.min, Math.min(def.max, v)) : v;
  }

  /** Advance the pendulums by `dt` seconds (call before evaluate). */
  step(dt: number): void {
    const h = Math.min(dt, 0.05);
    for (const pen of this.model.physics) {
      const target = pen.inputs.reduce((s, i) => s + (this.params[i.param] ?? 0) * i.weight, 0);
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

  /** Deform every part for the current parameters. */
  evaluate(): PartFrame[] {
    const mappers = new Map<string, Mapper>();
    const own = (id: string): Mapper => {
      let m = mappers.get(id);
      if (m) return m;
      const d = this.byId.get(id);
      if (!d) throw new Error(`rig ${this.model.id}: no deformer ${id}`);
      const local = d.kind === "warp" ? warpMapper(d, blendArray(d.keyed, this.params)) : rotationMapper(d, blendObject(d.keyed, this.params));
      const up = d.parent ? own(d.parent) : null;
      m = up
        ? (x, y) => {
            const [a, b] = local(x, y);
            return up(a, b);
          }
        : local;
      mappers.set(id, m);
      return m;
    };
    return this.model.parts.map((part) => {
      const { rest } = this.meshes[part.id]!;
      const positions = new Float32Array(rest.length);
      const map = part.parent ? own(part.parent) : null;
      for (let i = 0; i < rest.length; i += 2) {
        const [x, y] = map ? map(rest[i]!, rest[i + 1]!) : [rest[i]!, rest[i + 1]!];
        positions[i] = x;
        positions[i + 1] = y;
      }
      const opacity = part.keyed ? blendObject(part.keyed, this.params).opacity : 1;
      return { id: part.id, positions, opacity };
    });
  }
}
