// The rig evaluated the plain way: every deformer blended into fresh arrays
// and objects, every vertex pushed up its chain through nested closures. It
// is the specification the compiled evaluator (rig.ts, Rig.deformInto) must
// match to the bit, and the "before" of the benchmark (bench.ts). The game
// never imports it.

import { meshOf, type Keyed, type MeshData, type Model, type Params, type PartFrame, type RotationDeformer, type RotationForm, type WarpDeformer } from "./rig.ts";

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

/** Every part of `model` deformed for `params`, from its rest mesh (meshes: as Rig.meshes, made here when not given). */
export function referenceEvaluate(model: Model, params: Params, meshes?: Record<string, MeshData>): PartFrame[] {
  const byId = new Map(model.deformers.map((d) => [d.id, d]));
  const mappers = new Map<string, Mapper>();
  const own = (id: string): Mapper => {
    let m = mappers.get(id);
    if (m) return m;
    const d = byId.get(id);
    if (!d) throw new Error(`rig ${model.id}: no deformer ${id}`);
    const local = d.kind === "warp" ? warpMapper(d, blendArray(d.keyed, params)) : rotationMapper(d, blendObject(d.keyed, params));
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
  return model.parts.map((part) => {
    const { rest } = meshes?.[part.id] ?? meshOf(part);
    const positions = new Float32Array(rest.length);
    const map = part.parent ? own(part.parent) : null;
    for (let i = 0; i < rest.length; i += 2) {
      const [x, y] = map ? map(rest[i]!, rest[i + 1]!) : [rest[i]!, rest[i + 1]!];
      positions[i] = x;
      positions[i + 1] = y;
    }
    const opacity = part.keyed ? blendObject(part.keyed, params).opacity : 1;
    return { id: part.id, positions, opacity };
  });
}
