// A prototype (dev only, behind scripts/l2d-bench.ts; the game still draws
// with RigView): a rig drawn as ONE mesh in ONE draw call. Every part's art
// is packed into one atlas texture, every part's vertices into one buffer
// (in draw order, so the triangles blend in the parts' order within the one
// draw), with a shader of its own:
//   - per-vertex opacity (a part's fade or blink is its vertices' alpha, not
//     a mesh property, so hiding a part changes no scene structure);
//   - clipping through a second texture coordinate: a clipped part's vertices
//     carry where they fall on their mask part's art (found each frame on the
//     mask's deformed triangles), and the fragment takes the mask's alpha
//     there. No stencil passes, and the clip follows the mask's drawn shape
//     rather than its mesh outline.
// The rig deforms straight into views of the one position buffer, as RigView
// deforms into its meshes' buffers; a frame uploads three buffers per rig.
//
// Not covered yet (what the game's RigView also does): drawing something in
// between two parts (addOver) and taking a part out into another layer
// (detach): with one draw per rig, those would split the index range into
// two draws at that part.

import { Buffer, BufferUsage, CanvasSource, Container, Geometry, Mesh, Shader, Texture } from "pixi.js";
import type { Rig } from "./rig.ts";

const vertex = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in float aAlpha;
in vec2 aMaskUV;
in vec4 aMaskRect;
out vec2 vUV;
out float vAlpha;
out vec2 vMaskUV;
out vec4 vMaskRect;
out vec4 vColor;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform vec4 uWorldColorAlpha;
uniform mat3 uTransformMatrix;
uniform vec4 uColor;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vAlpha = aAlpha;
  vMaskUV = aMaskUV;
  vMaskRect = aMaskRect;
  vColor = uColor * uWorldColorAlpha;
}`;

const fragment = /* glsl */ `
in vec2 vUV;
in float vAlpha;
in vec2 vMaskUV;
in vec4 vMaskRect;
in vec4 vColor;
out vec4 finalColor;
uniform sampler2D uTexture;
void main() {
  vec4 c = texture(uTexture, vUV) * vAlpha;
  if (vMaskRect.x >= 0.0) {
    // Outside the mask's own cell of the atlas there is no mask art: clipped away.
    vec2 inside = step(vMaskRect.xy, vMaskUV) * step(vMaskUV, vMaskRect.zw);
    c *= texture(uTexture, vMaskUV).a * inside.x * inside.y;
  }
  finalColor = c * vColor;
}`;

/** Gap between parts in the atlas, px (the mipmaps' filtering reaches this far without bleeding into a neighbour). */
const PAD = 4;

interface Cell {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Shelf-pack the images (tallest first) into one canvas at most `max` wide. */
function packAtlas(imgs: [string, HTMLImageElement][], max = 2048): { canvas: HTMLCanvasElement; cells: Record<string, Cell> } {
  const order = [...imgs].sort((a, b) => b[1].height - a[1].height);
  const cells: Record<string, Cell> = {};
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  let width = 0;
  for (const [id, img] of order) {
    if (x + img.width + PAD > max) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    cells[id] = { x, y, w: img.width, h: img.height };
    x += img.width + PAD;
    width = Math.max(width, x);
    shelf = Math.max(shelf, img.height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = y + shelf + PAD;
  const ctx = canvas.getContext("2d")!;
  for (const [id, img] of order) ctx.drawImage(img, cells[id]!.x, cells[id]!.y);
  return { canvas, cells };
}

/** One atlas per image set (a model's), shared by all its views. */
const atlases = new WeakMap<Record<string, HTMLImageElement>, { texture: Texture; cells: Record<string, Cell>; W: number; H: number }>();

function atlasOf(imgs: Record<string, HTMLImageElement>) {
  let a = atlases.get(imgs);
  if (!a) {
    const { canvas, cells } = packAtlas(Object.entries(imgs));
    const texture = new Texture({ source: new CanvasSource({ resource: canvas, autoGenerateMipmaps: true }) });
    a = { texture, cells, W: canvas.width, H: canvas.height };
    atlases.set(imgs, a);
  }
  return a;
}

/** A clipped part: its vertex range, and its mask part's triangles (vertex range, indices, art UVs in the atlas). */
interface Clip {
  from: number;
  count: number;
  maskFrom: number;
  maskIdx: Uint32Array;
  maskUV: Float32Array;
}

/** A live model drawn in one call: `update()` after changing the rig's parameters. */
export class RigAtlasView extends Container {
  private readonly geometry: Geometry;
  private readonly mesh: Mesh<Geometry, Shader>;
  /** All vertices, the model's parts in draw order; each part deforms into its own view of it. */
  private readonly pos: Float32Array;
  private readonly vAlpha: Float32Array;
  private readonly maskUV: Float32Array;
  private readonly posViews: Float32Array[] = [];
  private readonly opacity: Float64Array;
  /** Per part (the model's order): first vertex and vertex count in the buffers. */
  private readonly ranges: [number, number][] = [];
  private readonly clips: Clip[] = [];
  private readonly buffers: { pos: Buffer; alpha: Buffer; mask: Buffer | null };

  constructor(
    readonly rig: Rig,
    imgs: Record<string, HTMLImageElement>,
  ) {
    super();
    const model = rig.model;
    const atlas = atlasOf(imgs);
    const sorted = [...model.parts].sort((a, b) => a.order - b.order);
    let nv = 0;
    let ni = 0;
    const start: Record<string, number> = {};
    for (const p of sorted) {
      start[p.id] = nv;
      nv += rig.meshes[p.id]!.rest.length / 2;
      ni += rig.meshes[p.id]!.indices.length;
    }
    this.pos = new Float32Array(nv * 2);
    this.vAlpha = new Float32Array(nv);
    this.maskUV = new Float32Array(nv * 2);
    const uv = new Float32Array(nv * 2);
    const rect = new Float32Array(nv * 4).fill(-1);
    const index = new Uint32Array(ni);
    // Each part's art UVs, mapped into its cell of the atlas.
    const atlasUV = (id: string, u: Float32Array): Float32Array => {
      const c = atlas.cells[id]!;
      const out = new Float32Array(u.length);
      for (let i = 0; i < u.length; i += 2) {
        out[i] = (c.x + u[i]! * c.w) / atlas.W;
        out[i + 1] = (c.y + u[i + 1]! * c.h) / atlas.H;
      }
      return out;
    };
    let k = 0;
    for (const p of sorted) {
      const m = rig.meshes[p.id]!;
      const s = start[p.id]!;
      uv.set(atlasUV(p.id, m.uvs), s * 2);
      for (let i = 0; i < m.indices.length; i++) index[k++] = m.indices[i]! + s;
      if (p.mask) {
        const mm = rig.meshes[p.mask]!;
        const c = atlas.cells[p.mask]!;
        const r = [c.x / atlas.W, c.y / atlas.H, (c.x + c.w) / atlas.W, (c.y + c.h) / atlas.H];
        const n = m.rest.length / 2;
        for (let v = 0; v < n; v++) rect.set(r, (s + v) * 4);
        this.clips.push({ from: s, count: n, maskFrom: start[p.mask]!, maskIdx: mm.indices, maskUV: atlasUV(p.mask, mm.uvs) });
      }
    }
    for (const p of model.parts) {
      const s = start[p.id]!;
      const n = rig.meshes[p.id]!.rest.length / 2;
      this.ranges.push([s, n]);
      this.posViews.push(this.pos.subarray(s * 2, (s + n) * 2));
    }
    this.opacity = new Float64Array(model.parts.length);
    const dyn = BufferUsage.VERTEX | BufferUsage.COPY_DST;
    const pos = new Buffer({ data: this.pos, usage: dyn, label: "l2d-pos" });
    const alpha = new Buffer({ data: this.vAlpha, usage: dyn, label: "l2d-alpha" });
    const mask = new Buffer({ data: this.maskUV, usage: dyn, label: "l2d-mask" });
    this.buffers = { pos, alpha, mask: this.clips.length ? mask : null };
    this.geometry = new Geometry({
      attributes: {
        aPosition: { buffer: pos, format: "float32x2" },
        aUV: { buffer: uv, format: "float32x2" },
        aAlpha: { buffer: alpha, format: "float32" },
        aMaskUV: { buffer: mask, format: "float32x2" },
        aMaskRect: { buffer: rect, format: "float32x4" },
      },
      indexBuffer: index,
    });
    const shader = Shader.from({
      gl: { vertex, fragment, name: "l2d-atlas" },
      resources: { uTexture: atlas.texture.source, uSampler: atlas.texture.source.style },
    });
    this.mesh = new Mesh({ geometry: this.geometry, shader, texture: atlas.texture });
    this.addChild(this.mesh);
    this.update();
  }

  /** Where a part's centre is now (the mean of its vertices), in model space. */
  partCenter(id: string): [number, number] | null {
    const i = this.rig.model.parts.findIndex((p) => p.id === id);
    if (i < 0) return null;
    const v = this.posViews[i]!;
    let x = 0;
    let y = 0;
    for (let j = 0; j < v.length; j += 2) {
      x += v[j]!;
      y += v[j + 1]!;
    }
    return [(x * 2) / v.length, (y * 2) / v.length];
  }

  update(): void {
    this.rig.deformInto(this.posViews, this.opacity);
    for (let i = 0; i < this.ranges.length; i++) {
      const [s, n] = this.ranges[i]!;
      const a = this.opacity[i]! > 0.004 ? this.opacity[i]! : 0;
      if (this.vAlpha[s] !== a) this.vAlpha.fill(a, s, s + n);
    }
    for (const c of this.clips) this.clip(c);
    this.buffers.pos.update();
    this.buffers.alpha.update();
    this.buffers.mask?.update();
  }

  /** Where each vertex of a clipped part falls on its mask's art: on the mask's deformed triangle holding it (or, outside them all, the nearest one, extended). */
  private clip(c: Clip): void {
    const P = this.pos;
    const idx = c.maskIdx;
    const muv = c.maskUV;
    const base = c.maskFrom;
    for (let v = c.from; v < c.from + c.count; v++) {
      const x = P[v * 2]!;
      const y = P[v * 2 + 1]!;
      let best = -Infinity;
      let bu = 0;
      let bv = 0;
      for (let t = 0; t < idx.length; t += 3) {
        const i0 = idx[t]!;
        const i1 = idx[t + 1]!;
        const i2 = idx[t + 2]!;
        const x0 = P[(base + i0) * 2]!;
        const y0 = P[(base + i0) * 2 + 1]!;
        const x1 = P[(base + i1) * 2]! - x0;
        const y1 = P[(base + i1) * 2 + 1]! - y0;
        const x2 = P[(base + i2) * 2]! - x0;
        const y2 = P[(base + i2) * 2 + 1]! - y0;
        const d = x1 * y2 - x2 * y1;
        if (Math.abs(d) < 1e-9) continue;
        const px = x - x0;
        const py = y - y0;
        const b1 = (px * y2 - x2 * py) / d;
        const b2 = (x1 * py - px * y1) / d;
        const b0 = 1 - b1 - b2;
        const worst = Math.min(b0, b1, b2);
        if (worst > best) {
          best = worst;
          bu = b0 * muv[i0 * 2]! + b1 * muv[i1 * 2]! + b2 * muv[i2 * 2]!;
          bv = b0 * muv[i0 * 2 + 1]! + b1 * muv[i1 * 2 + 1]! + b2 * muv[i2 * 2 + 1]!;
          if (worst >= 0) break;
        }
      }
      this.maskUV[v * 2] = bu;
      this.maskUV[v * 2 + 1] = bv;
    }
  }

  override destroy(): void {
    super.destroy({ children: true });
    this.geometry.destroy();
  }
}
