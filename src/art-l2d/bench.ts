// Dev-only: times live rigs frame by frame in the browser, for
// scripts/l2d-bench.ts (which imports this through the Vite dev server). The
// game never imports it.
//
// A scene of `n` copies of a model, each with its own animator walking or
// idling, is stepped and drawn `frames` times with its own Pixi renderer
// (WebGL, antialiased, at `resolution`, as the game's). Each frame is split
// into the animator (step), the rig's deformation and mesh upkeep (update),
// Pixi's work to draw the scene (render), and the wait for the GPU to finish
// it (gpu: a one-pixel read after the draw, so this also holds the GPU's
// time). WebGL calls are counted per frame: draw calls, buffer uploads (and
// their bytes), state changes of the stencil.
//
// Modes: "reference" (the evaluator before 20d8b45), "current" (RigView: a
// mesh per part, stencil clips) and "atlas" (the one-draw prototype,
// pixi-atlas.ts). atlasDiff renders poses both ways to compare the pixels.

import { autoDetectRenderer, Container, Rectangle, Sprite, Texture, type Renderer, type WebGLRenderer } from "pixi.js";
import { ART_L2D } from "./index.ts";
import { Animator } from "./animator.ts";
import { partImages, RigView, sharedRenderer } from "./pixi-model.ts";
import { RigAtlasView } from "./pixi-atlas.ts";
import { pose } from "./animator.ts";
import type { Look } from "../art/drawing.ts";
import { Rig, type Model } from "./rig.ts";
import { referenceEvaluate } from "./reference.ts";

export type BenchMode = "reference" | "current" | "atlas";

export interface BenchOptions {
  /** "reimu" (portrait), "reimu.sprite", "fairy" (sprite when no portrait). */
  model: string;
  n: number;
  frames: number;
  mode: BenchMode;
  /** Each rig its own render group (its batches rebuilt only when its own parts change). */
  group?: boolean;
  /** Force the stage's instructions to be rebuilt every frame, as the game's field does. */
  rebuild?: boolean;
  /** Each rig drawn alone and copied into a 2D canvas of its own, as LivePortrait does (menus, dialogue, credits). */
  portraits?: boolean;
  /** Renderer resolution (the game: the device pixel ratio up to 2). */
  resolution?: number;
  /** Size of one rig on screen, CSS px (default: its game size for sprites, 220 wide for portraits). */
  size?: number;
  /** Walking (default) or standing still (idle cycle only). */
  walk?: boolean;
}

export interface BenchResult {
  label: string;
  n: number;
  frames: number;
  /** Milliseconds per frame for the whole scene. */
  step: number;
  update: number;
  render: number;
  gpu: number;
  total: number;
  /** Per frame: WebGL draw calls, buffer uploads and bytes uploaded, stencil function/op changes. */
  draws: number;
  uploads: number;
  bytes: number;
  stencil: number;
  gpuName: string;
}

function modelOf(id: string): Model {
  const [who, kind] = id.split(".");
  const set = ART_L2D[who!];
  const m = kind === "sprite" || !set?.portrait ? set?.sprite?.model : set.portrait;
  if (!m) throw new Error(`no model ${id}`);
  return m;
}

/** Counts WebGL calls on a context until `stop()`. */
function countGl(gl: WebGL2RenderingContext) {
  const c = { draws: 0, uploads: 0, bytes: 0, stencil: 0 };
  const orig: [keyof WebGL2RenderingContext, unknown][] = [];
  const wrap = (name: keyof WebGL2RenderingContext, f: (args: unknown[]) => void) => {
    const o = gl[name] as (...a: unknown[]) => unknown;
    orig.push([name, o]);
    (gl as unknown as Record<string, unknown>)[name] = (...a: unknown[]) => {
      f(a);
      return o.apply(gl, a);
    };
  };
  const draw = () => c.draws++;
  wrap("drawElements", draw);
  wrap("drawArrays", draw);
  wrap("drawElementsInstanced", draw);
  wrap("drawArraysInstanced", draw);
  const size = (d: unknown) => (typeof d === "number" ? d : ((d as ArrayBufferView | null)?.byteLength ?? 0));
  wrap("bufferData", (a) => {
    c.uploads++;
    c.bytes += size(a[1]);
  });
  wrap("bufferSubData", (a) => {
    c.uploads++;
    c.bytes += size(a[2]);
  });
  const st = () => c.stencil++;
  wrap("stencilFunc", st);
  wrap("stencilOp", st);
  wrap("stencilMask", st);
  return {
    c,
    stop: () => {
      for (const [name, o] of orig) (gl as unknown as Record<string, unknown>)[name] = o;
    },
  };
}

interface Item {
  rig: Rig;
  view: RigView | RigAtlasView;
  anim: Animator;
  root: Container;
  ctx?: CanvasRenderingContext2D;
  meshes: Map<string, { mesh: import("pixi.js").Mesh; geometry: import("pixi.js").MeshGeometry }>;
}

let renderer: Promise<Renderer> | null = null;
/** The bench's own renderer (not the game's shared one), kept for the page's life. */
function benchRenderer(resolution: number): Promise<Renderer> {
  renderer ??= autoDetectRenderer({ width: 1280, height: 720, backgroundAlpha: 1, background: "#0b1020", antialias: true, preference: "webgl", resolution });
  return renderer;
}

export async function runBench(o: BenchOptions): Promise<BenchResult> {
  const model = modelOf(o.model);
  const res = o.resolution ?? 2;
  const r = await benchRenderer(res);
  if (r.resolution !== res) r.resize(1280, 720, res);
  const gl = (r as WebGLRenderer).gl as WebGL2RenderingContext;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const gpuName = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "?";
  const imgs = await partImages(model);
  const sprite = model.w === 200;
  const set = ART_L2D[o.model.split(".")[0]!];
  const size = o.size ?? (sprite ? (set?.sprite?.w ?? 52) : 220);
  const scale = size / model.w;
  const stage = new Container();
  // Something the stage toggles every frame, as the game's field changes its structure every frame.
  const toggler = new Sprite(Texture.WHITE);
  toggler.alpha = 0.01;
  stage.addChild(toggler);
  const cols = Math.max(1, Math.floor(1280 / (size + 4)));
  const items: Item[] = [];
  for (let k = 0; k < o.n; k++) {
    const rig = new Rig(model);
    const view = o.mode === "atlas" ? new RigAtlasView(rig, imgs) : new RigView(rig, imgs);
    view.scale.set(scale);
    const root = new Container();
    root.addChild(view);
    if (o.group) view.isRenderGroup = true;
    const x = (k % cols) * (size + 4);
    const y = Math.floor(k / cols) * (size * (model.h / model.w) + 4);
    let ctx: CanvasRenderingContext2D | undefined;
    if (o.portraits) {
      const c = document.createElement("canvas");
      c.width = Math.ceil(size * res);
      c.height = Math.ceil(size * (model.h / model.w) * res);
      ctx = c.getContext("2d")!;
    } else {
      root.position.set(x, y);
      stage.addChild(root);
    }
    const anim = new Animator(rig, (() => {
      let s = k * 977 + 1;
      return () => (s = (s * 16807) % 2147483647) / 2147483647;
    })());
    anim.rate = set?.sprite?.rate ?? 0.6;
    const walk = o.walk ?? true;
    anim.move = walk ? { x: Math.cos(k * 1.7), y: Math.sin(k * 1.7) } : { x: 0, y: 0 };
    anim.target = { x: Math.cos(k), y: Math.sin(k) * 0.5 };
    anim.snap();
    // Desynchronise: each one a different moment of its cycle.
    for (let i = 0; i < (k * 7) % 60; i++) anim.step(1 / 60);
    const meshes = (view as unknown as { meshes: Item["meshes"] }).meshes;
    items.push({ rig, view, anim, root, ctx, meshes });
  }
  const update = (it: Item) => {
    if (o.mode === "reference") {
      // The old RigView.update: the plain evaluator, a fresh array per part handed to the geometry.
      for (const f of referenceEvaluate(model, it.rig.params, it.rig.meshes)) {
        const m = it.meshes.get(f.id)!;
        m.geometry.positions = f.positions;
        m.mesh.alpha = f.opacity;
        m.mesh.visible = f.opacity > 0.004;
      }
    } else it.view.update();
  };
  const px = new Uint8Array(4);
  const t = { step: 0, update: 0, render: 0, gpu: 0 };
  const warm = 30;
  let counter: ReturnType<typeof countGl> | null = null;
  for (let f = -warm; f < o.frames; f++) {
    if (f === 0) counter = countGl(gl);
    const on = f >= 0;
    toggler.visible = !o.rebuild || f % 2 === 0;
    let a = performance.now();
    for (const it of items) it.anim.step(1 / 60);
    let b = performance.now();
    if (on) t.step += b - a;
    a = b;
    for (const it of items) update(it);
    b = performance.now();
    if (on) t.update += b - a;
    a = b;
    if (o.portraits) {
      for (const it of items) {
        r.render({ container: it.root, clear: true });
        const c = it.ctx!.canvas;
        it.ctx!.clearRect(0, 0, c.width, c.height);
        it.ctx!.drawImage(r.canvas as HTMLCanvasElement, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
      }
    } else r.render({ container: stage, clear: true });
    b = performance.now();
    if (on) t.render += b - a;
    a = b;
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    b = performance.now();
    if (on) t.gpu += b - a;
  }
  counter?.stop();
  for (const it of items) it.root.destroy({ children: true });
  stage.destroy({ children: true });
  const per = (v: number) => v / o.frames;
  const c = counter!.c;
  return {
    label: `${o.model} x${o.n} ${o.mode}${o.group ? " group" : ""}${o.rebuild ? " rebuild" : ""}${o.portraits ? " portraits" : ""}`,
    n: o.n,
    frames: o.frames,
    step: per(t.step),
    update: per(t.update),
    render: per(t.render),
    gpu: per(t.gpu),
    total: per(t.step + t.update + t.render + t.gpu),
    draws: per(c.draws),
    uploads: per(c.uploads),
    bytes: per(c.bytes),
    stencil: per(c.stencil),
    gpuName,
  };
}

export interface AtlasDiff {
  label: string;
  /** PNG data URLs: RigView, the atlas prototype, and their difference (x4, over black). */
  current: string;
  atlas: string;
  diff: string;
  /** Mean absolute difference per channel (0..255) and the share of pixels differing by more than 16 in any channel. */
  mean: number;
  over16: number;
}

/**
 * The same poses drawn by RigView and by the atlas prototype on the shared
 * renderer, and how far their pixels differ (antialiasing and mipmap
 * filtering differ slightly; a wrong clip or order would show as a patch).
 */
export async function atlasDiff(id: string, looks: { look: Look; params?: Record<string, number>; label: string }[], scale = 1): Promise<AtlasDiff[]> {
  const model = modelOf(id);
  const imgs = await partImages(model);
  const r = await sharedRenderer();
  const w = Math.ceil(model.w * scale);
  const h = Math.ceil(model.h * scale);
  const frame = new Rectangle(0, 0, w, h);
  const out: AtlasDiff[] = [];
  for (const l of looks) {
    const shots: { url: string; px: Uint8ClampedArray }[] = [];
    for (const Kind of [RigView, RigAtlasView]) {
      const rig = new Rig(model);
      const view = new Kind(rig, imgs);
      view.scale.set(scale);
      const root = new Container();
      root.addChild(view);
      for (const d of model.params) rig.params[d.id] = d.def;
      pose(rig, l.look);
      for (const [k, v] of Object.entries(model.rest ?? {})) rig.set(k, (rig.params[k] ?? 0) + v);
      for (const [k, v] of Object.entries(l.params ?? {})) rig.set(k, v);
      view.update();
      const url = await r.extract.base64({ target: root, frame, resolution: 1 });
      const px = r.extract.pixels({ target: root, frame, resolution: 1 }).pixels;
      shots.push({ url, px });
      root.destroy({ children: true });
    }
    const [a, b] = [shots[0]!.px, shots[1]!.px];
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    let sum = 0;
    let over = 0;
    for (let i = 0; i < a.length; i += 4) {
      let m = 0;
      for (let j = 0; j < 4; j++) {
        const d = Math.abs(a[i + j]! - b[i + j]!);
        sum += d;
        m = Math.max(m, d);
        if (j < 3) img.data[i + j] = Math.min(255, d * 4);
      }
      img.data[i + 3] = 255;
      if (m > 16) over++;
    }
    ctx.putImageData(img, 0, 0);
    out.push({ label: l.label, current: shots[0]!.url, atlas: shots[1]!.url, diff: c.toDataURL(), mean: sum / a.length, over16: over / (a.length / 4) });
  }
  return out;
}
