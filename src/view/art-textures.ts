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
/** The largest sheet side in device pixels (a texture size practically every GPU takes). */
const MAX_SHEET = 4096;

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
  // Parts reach past the model's canvas (wings, flapping sleeves), so the cells are baked in a frame
  // that holds every pose's mesh bounds, then cut down to the pixels actually drawn. Both stay even
  // about the canvas centre, so the sprite's centre anchor is where it was.
  const cx = sr.w / 2;
  const cy = sr.h / 2;
  let hw = cx;
  let hh = cy;
  for (let f = 0; f < sr.frames; f++)
    for (const look of looks) {
      set(look, f / sr.frames);
      const b = root.getLocalBounds();
      hw = Math.max(hw, cx - b.minX, b.maxX - cx);
      hh = Math.max(hh, cy - b.minY, b.maxY - cy);
    }
  hw = Math.ceil(hw + 1);
  hh = Math.ceil(hh + 1);
  const frame = new Rectangle(cx - hw, cy - hh, hw * 2, hh * 2);
  const snap = () => renderer.generateTexture({ target: root, frame, resolution: PX, antialias: true });
  const baked: Texture[] = [];
  set(AHEAD, 0);
  const white = whiteFilter();
  root.filters = [white];
  baked.push(snap());
  root.filters = [];
  white.destroy();
  for (let f = 0; f < sr.frames; f++)
    for (const look of looks) {
      set(look, f / sr.frames);
      baked.push(snap());
    }
  if (sr.looks)
    for (const look of looks) {
      set(look, 0, true);
      baked.push(snap());
    }
  root.destroy({ children: true });
  const [tw, th] = drawnHalf(renderer, baked, hw * 2, hh * 2);
  const cut = new Rectangle(hw - tw, hh - th, tw * 2, th * 2);
  const list = baked.map((t) => {
    const c = new Texture({ source: t.source, frame: cut });
    t.destroy();
    return c;
  });
  return [list, { frames: sr.frames, looks: looks.length, blink: sr.looks, rate: sr.rate }];
}

/**
 * Half the width and height (game px, whole) of the smallest box even about the centre that holds
 * every pixel drawn in any of these w x h cells. Mesh bounds are looser than the art: a part's quad
 * carries its transparent margins, and a turning one (the yin-yang orb's ring) sweeps its corners.
 */
function drawnHalf(renderer: Renderer, cells: Texture[], w: number, h: number): [number, number] {
  const all = new Container();
  for (const t of cells) all.addChild(new Sprite(t));
  const union = renderer.generateTexture({ target: all, frame: new Rectangle(0, 0, w, h), resolution: PX });
  const { pixels, width, height } = renderer.extract.pixels(union);
  union.destroy(true);
  all.destroy({ children: true });
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (pixels[(y * width + x) * 4 + 3]! > 0) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x + 1);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y + 1);
      }
  if (x1 <= x0) return [w / 2, h / 2];
  // One game px of margin for the antialiased edge; never more than the baked cell.
  const half = (lo: number, hi: number, size: number) => Math.min(size / 2, Math.ceil(Math.max(size / 2 - lo / PX, hi / PX - size / 2)) + 1);
  return [half(x0, x1, w), half(y0, y1, h)];
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
  // Shelf packing in game pixels, tallest cells first so each shelf wastes little height.
  const W = style === "live2d" ? 2048 : 1024;
  const root = new Container();
  const frames: Record<string, Rectangle[]> = {};
  const cells = Object.entries(loose).flatMap(([id, [texs]]) => texs.map((t, i) => ({ t, id, i })));
  cells.sort((a, b) => b.t.height - a.t.height || b.t.width - a.t.width);
  let x = 0;
  let y = 0;
  let row = 0;
  for (const { t, id, i } of cells) {
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
    (frames[id] ??= [])[i] = new Rectangle(x, y, w, h);
    x += w + 2;
    row = Math.max(row, h);
  }
  const H = y + row + 2;
  // The sheet renders at PX, unless that would pass the texture size every GPU takes: then a
  // little softer, rather than a sheet some machines cannot load.
  const res = Math.min(PX, MAX_SHEET / Math.max(W, H));
  const sheet = renderer.generateTexture({ target: root, frame: new Rectangle(0, 0, W, H), resolution: res, antialias: true });
  lastSheet = { w: Math.ceil(W * res), h: Math.ceil(H * res), cells: cells.length };
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
