// Draws a rig (rig.ts) with Pixi: one textured mesh per part, in draw order,
// with clipped parts masked by a stencil copy of their mask part's mesh.
// Part textures are the parts' SVG rasterized by the browser once per model
// (cached), then uploaded per renderer.
//
// All live models share one renderer that is never destroyed: destroying a
// Pixi renderer clears Pixi's global pools (GlobalResourceRegistry), which
// breaks the game's own renderer mid-frame. Each portrait renders through it
// and copies the result into its own 2D canvas (one WebGL context in total).

import { autoDetectRenderer, Container, ImageSource, Mesh, MeshGeometry, Texture, type Renderer } from "pixi.js";
import type { Model, Part, Rig } from "./rig.ts";

/** Texture pixels per model unit. Portraits show the model at about half size, so 1 is already 2x. */
const RES = 1;

/** Decoded part images by model object (not id: a character's portrait and chibi share an id). */
const images = new WeakMap<Model, Promise<Record<string, HTMLImageElement>>>();

function partSvg(p: Part): string {
  const { x, y, w, h } = p.rect;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w * RES)}" height="${Math.ceil(h * RES)}" viewBox="${x} ${y} ${w} ${h}">${p.svg}</svg>`;
}

/** Every part's art as a decoded image, once per model. */
export function partImages(model: Model): Promise<Record<string, HTMLImageElement>> {
  let got = images.get(model);
  if (!got) {
    got = Promise.all(
      model.parts.map(async (p) => {
        const img = new Image();
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(partSvg(p))}`;
        await img.decode();
        return [p.id, img] as const;
      }),
    ).then((pairs) => Object.fromEntries(pairs));
    images.set(model, got);
  }
  return got;
}

let shared: Promise<Renderer> | null = null;
let lastSize = "";

/** The renderer every live model draws with (created on first use, kept for the page's life). */
export function sharedRenderer(): Promise<Renderer> {
  shared ??= autoDetectRenderer({ width: 16, height: 16, backgroundAlpha: 0, antialias: true, preference: "webgl" });
  return shared;
}

/** Draw a container with the shared renderer into a 2D canvas (sized w x h CSS px at `res`). */
export function drawInto(renderer: Renderer, target: Container, ctx: CanvasRenderingContext2D, w: number, h: number, res: number): void {
  const size = `${w}x${h}@${res}`;
  if (lastSize !== size) {
    renderer.resize(w, h, res);
    lastSize = size;
  }
  renderer.render({ container: target, clear: true });
  const c = ctx.canvas;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(renderer.canvas as HTMLCanvasElement, 0, 0, c.width, c.height);
}

/** A live model: call `update()` after changing the rig's parameters. */
export class RigView extends Container {
  private readonly meshes = new Map<string, { mesh: Mesh; geometry: MeshGeometry }>();
  private readonly textures: Texture[] = [];

  constructor(
    readonly rig: Rig,
    imgs: Record<string, HTMLImageElement>,
  ) {
    super();
    const sorted = [...rig.model.parts].sort((a, b) => a.order - b.order);
    for (const part of sorted) {
      const data = rig.meshes[part.id]!;
      const img = imgs[part.id];
      if (!img) throw new Error(`rig ${rig.model.id}: no image for part ${part.id}`);
      const texture = new Texture({ source: new ImageSource({ resource: img, resolution: RES, autoGenerateMipmaps: true }) });
      this.textures.push(texture);
      const geometry = new MeshGeometry({ positions: new Float32Array(data.rest), uvs: data.uvs, indices: data.indices });
      const mesh = new Mesh({ geometry, texture });
      this.meshes.set(part.id, { mesh, geometry });
      this.addChild(mesh);
    }
    // Clipping: a second mesh on the mask part's geometry draws into the stencil only.
    for (const part of sorted) {
      if (!part.mask) continue;
      const src = this.meshes.get(part.mask);
      if (!src) throw new Error(`rig ${rig.model.id}: part ${part.id} masks by missing ${part.mask}`);
      const stencil = new Mesh({ geometry: src.geometry, texture: src.mesh.texture });
      this.addChild(stencil);
      this.meshes.get(part.id)!.mesh.mask = stencil;
    }
    this.update();
  }

  /**
   * Where a part's centre is now, in model space: the middle vertex of an
   * even grid (exact), else the mean of its vertices. Null if no such part.
   */
  partCenter(id: string): [number, number] | null {
    const pos = this.meshes.get(id)?.geometry.positions;
    const part = this.rig.model.parts.find((p) => p.id === id);
    if (!pos || !part) return null;
    const m = part.mesh;
    if (m.kind === "grid" && m.nx % 2 === 0 && m.ny % 2 === 0) {
      const i = ((m.ny / 2) * (m.nx + 1) + m.nx / 2) * 2;
      return [pos[i]!, pos[i + 1]!];
    }
    let x = 0;
    let y = 0;
    for (let i = 0; i < pos.length; i += 2) {
      x += pos[i]!;
      y += pos[i + 1]!;
    }
    return [(x * 2) / pos.length, (y * 2) / pos.length];
  }

  /**
   * Take a part's mesh out of the view (to draw it in another layer, e.g. above
   * the bullets); `update()` keeps deforming it. Place its new parent with this
   * view's world transform. Null if no such part.
   */
  detach(id: string): Mesh | null {
    const m = this.meshes.get(id);
    if (!m) return null;
    this.removeChild(m.mesh);
    return m.mesh;
  }

  update(): void {
    for (const f of this.rig.evaluate()) {
      const m = this.meshes.get(f.id)!;
      m.geometry.positions = f.positions;
      m.mesh.alpha = f.opacity;
      m.mesh.visible = f.opacity > 0.004;
    }
  }

  override destroy(): void {
    super.destroy({ children: true });
    // Detached meshes live in other layers: they go with the view.
    for (const { mesh } of this.meshes.values()) if (!mesh.destroyed) mesh.destroy();
    for (const t of this.textures) t.destroy(true);
  }
}
