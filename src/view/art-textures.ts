// Field art turned into textures once, at startup, and packed into one
// sheet (enemies draw through a particle container, which needs every
// particle on the same texture source). Two sources:
// - drawn (src/art): each sprite drawing rasterized by the browser's SVG
//   renderer in all 9 looks the field uses;
// - Live2D (src/art-l2d): each enemy rig baked by Pixi itself, 9 looks x a
//   few frames of its idle cycle (wing flaps, bobbing, orb spin), plus a
//   row with the eyes closed for blinks. The field picks the frame by time
//   with a per-enemy phase, so a swarm does not flap in sync. The player
//   and the bosses do not come from the sheet in this style: they run live
//   rigs (see renderer.ts).
// Both add a white silhouette for the hit flash. Ids without art fall back
// to the procedural atlas.

import { ColorMatrixFilter, Container, ImageSource, Rectangle, Sprite, Texture, type Renderer } from "pixi.js";
import { ART } from "../art/index.ts";
import { AHEAD, LOOKS, lookIndex, svgOf, type Drawing } from "../art/drawing.ts";
import { ART_L2D, type SpriteRig } from "../art-l2d/index.ts";
import { Rig } from "../art-l2d/rig.ts";
import { partImages, RigView } from "../art-l2d/pixi-model.ts";
import { cycle, pose } from "../art-l2d/animator.ts";
import { ENEMIES } from "../content/enemies.ts";
import type { ArtStyle } from "./prefs.ts";

/** Device pixels per game pixel for the rasterized art (crisp on 2x screens and when zoomed). */
const PX = 2;

export interface SpriteArt {
  /** Textures by frame, then by look index (LOOKS / lookIndex); a single look when the art is the same from every side. */
  frames: Texture[][];
  /** Eyes closed, by look (rigs only). */
  blink?: Texture[];
  /** The whole silhouette in white, for the hit flash. */
  white: Texture;
  /** Idle cycles per second (0: a still drawing). */
  rate: number;
}

/** What a baked entry holds, in order: white, frames (frame-major), then the blink row. */
interface Layout {
  frames: number;
  looks: number;
  blink: boolean;
  rate: number;
}

async function raster(svg: string): Promise<Texture> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return new Texture({ source: new ImageSource({ resource: img, resolution: PX }) });
}

/** The same drawing, flooded white inside its own alpha. */
function whiteOf(d: Drawing): Drawing {
  return {
    ...d,
    body: (look) =>
      `<filter id="flash-white"><feFlood flood-color="#ffffff"/><feComposite in2="SourceAlpha" operator="in"/></filter><g filter="url(#flash-white)">${d.body(look)}</g>`,
  };
}

async function drawnEntry(d: Drawing): Promise<[Texture[], Layout]> {
  const list = await Promise.all([raster(svgOf(whiteOf(d), PX, AHEAD)), ...LOOKS.map((look) => raster(svgOf(d, PX, look)))]);
  return [list, { frames: 1, looks: LOOKS.length, blink: false, rate: 0 }];
}

/** Every channel to white, alpha kept: the hit-flash silhouette of a rig. */
function whiteFilter(): ColorMatrixFilter {
  const f = new ColorMatrixFilter();
  f.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
  return f;
}

/** Bake a rig: white, then each frame of its idle cycle in every look, then the blink row. */
async function rigEntry(renderer: Renderer, sr: SpriteRig): Promise<[Texture[], Layout]> {
  const rig = new Rig(sr.model);
  const view = new RigView(rig, await partImages(sr.model));
  const root = new Container();
  root.addChild(view);
  const s = Math.min(sr.w / sr.model.w, sr.h / sr.model.h);
  view.scale.set(s);
  view.position.set((sr.w - sr.model.w * s) / 2, (sr.h - sr.model.h * s) / 2);
  const frame = new Rectangle(0, 0, sr.w, sr.h);
  const looks = sr.looks ? LOOKS : [AHEAD];
  const set = (look: (typeof LOOKS)[number], phase: number, closed = false) => {
    for (const p of sr.model.params) rig.params[p.id] = p.def;
    pose(rig, look);
    cycle(rig, phase);
    if (closed) {
      rig.set("EyeLOpen", 0);
      rig.set("EyeROpen", 0);
    }
    view.update();
  };
  const snap = () => renderer.generateTexture({ target: root, frame, resolution: PX, antialias: true });
  const list: Texture[] = [];
  set(AHEAD, 0);
  const white = whiteFilter();
  root.filters = [white];
  list.push(snap());
  root.filters = [];
  white.destroy();
  for (let f = 0; f < sr.frames; f++)
    for (const look of looks) {
      set(look, f / sr.frames);
      list.push(snap());
    }
  if (sr.looks)
    for (const look of looks) {
      set(look, 0, true);
      list.push(snap());
    }
  root.destroy({ children: true });
  return [list, { frames: sr.frames, looks: looks.length, blink: sr.looks, rate: sr.rate }];
}

/**
 * Sprite art by key (character or enemy id), packed into one sheet. Live2D
 * bakes the enemies' rigs (enemies without a rig use their drawing); the
 * drawn style rasterizes every drawing.
 */
export async function loadSpriteArt(renderer: Renderer, style: ArtStyle = "drawn"): Promise<Record<string, SpriteArt>> {
  const loose: Record<string, [Texture[], Layout]> = {};
  if (style === "live2d") {
    for (const e of ENEMIES) {
      const sr = ART_L2D[e.id]?.sprite;
      const d = ART[e.id]?.sprite;
      if (sr) loose[e.id] = await rigEntry(renderer, sr);
      else if (d) loose[e.id] = await drawnEntry(d);
    }
  } else {
    await Promise.all(
      Object.entries(ART).map(async ([id, set]) => {
        if (set.sprite) loose[id] = await drawnEntry(set.sprite);
      }),
    );
  }
  // Shelf packing in game pixels; the sheet renders at PX.
  const W = style === "live2d" ? 2048 : 1024;
  const root = new Container();
  const frames: Record<string, Rectangle[]> = {};
  let x = 0;
  let y = 0;
  let row = 0;
  for (const [id, [texs]] of Object.entries(loose)) {
    frames[id] = texs.map((t) => {
      const w = Math.ceil(t.width);
      const h = Math.ceil(t.height);
      if (x + w > W) {
        x = 0;
        y += row + 2;
        row = 0;
      }
      const s = new Sprite(t);
      s.position.set(x, y);
      root.addChild(s);
      const r = new Rectangle(x, y, w, h);
      x += w + 2;
      row = Math.max(row, h);
      return r;
    });
  }
  const sheet = renderer.generateTexture({ target: root, frame: new Rectangle(0, 0, W, y + row + 2), resolution: PX, antialias: true });
  lastSheet = { w: W * PX, h: (y + row + 2) * PX, cells: Object.values(frames).reduce((n, r) => n + r.length, 0) };
  root.destroy({ children: true });
  for (const [texs] of Object.values(loose)) for (const t of texs) t.destroy(true);
  const out: Record<string, SpriteArt> = {};
  for (const [id, rects] of Object.entries(frames)) {
    const layout = loose[id]![1];
    const [white, ...rest] = rects.map((frame) => new Texture({ source: sheet.source, frame }));
    const n = layout.frames * layout.looks;
    out[id] = {
      white: white!,
      frames: Array.from({ length: layout.frames }, (_, f) => rest.slice(f * layout.looks, (f + 1) * layout.looks)),
      blink: layout.blink ? rest.slice(n, n + layout.looks) : undefined,
      rate: layout.rate,
    };
  }
  return out;
}

/** The last sheet's size in device pixels and cell count (for the perf readout and tests). */
export let lastSheet = { w: 0, h: 0, cells: 0 };

/** The frame of the idle cycle at `time` for an entity with `phase` (0..1). */
export function frameAt(art: SpriteArt, time: number, phase: number): number {
  if (!art.rate || art.frames.length < 2) return 0;
  const u = (((time * art.rate + phase) % 1) + 1) % 1;
  return Math.floor(u * art.frames.length) % art.frames.length;
}

/** The texture for a direction (unnormalized is fine): ahead when the vector is short. */
export function lookTexture(art: SpriteArt, x: number, y: number, frame = 0, blink = false): Texture {
  const row = blink && art.blink ? art.blink : art.frames[frame % art.frames.length]!;
  if (row.length === 1) return row[0]!;
  const len = Math.sqrt(x * x + y * y);
  return row[len > 1e-6 ? lookIndex(x / len, y / len) : 0]!;
}
