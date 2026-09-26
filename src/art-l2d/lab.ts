// Dev-only: renders a model in given poses to PNG data URLs, for
// scripts/l2d-lab.ts (which imports this through the Vite dev server). The
// game never imports it.

import { Container, Rectangle } from "pixi.js";
import { LOOKS, type Look } from "../art/drawing.ts";
import { ART_L2D } from "./index.ts";
import { Animator, pose } from "./animator.ts";
import { FILM } from "./film.ts";
import { SHOULDER } from "./chibi.ts";
import { partImages, RigView, sharedRenderer } from "./pixi-model.ts";
import { Rig, type Params } from "./rig.ts";
import { RATE } from "./tempo.ts";

export interface LabPose {
  look?: Look;
  params?: Params;
  label?: string;
}

/** The standard sheet: the 9 looks, then expressions and physics extremes. */
export const SHEET: LabPose[] = [
  ...LOOKS.map((look, i) => ({ look, label: i ? `look ${i}` : "ahead" })),
  { params: { EyeLOpen: 0, EyeROpen: 0 }, label: "blink" },
  { params: { EyeLOpen: 0.5, EyeROpen: 0.5 }, label: "half" },
  { params: { MouthOpen: 1 }, label: "mouth" },
  { params: { HairFront: 1, HairSide: 1, HairBack: 1, Ribbon: 1 }, label: "sway +" },
  { params: { HairFront: -1, HairSide: -1, HairBack: -1, Ribbon: -1 }, label: "sway -" },
  { params: { AngleZ: 30 }, label: "tilt" },
  { params: { Flap: 1, Bob: -1 }, label: "flap up" },
  { params: { Flap: -1, Bob: 1 }, label: "flap down" },
  { params: { Spin: 0.25 }, label: "spin" },
  { params: { ArmL: 1, ArmR: -1 }, label: "arm out, in" },
  { params: { ArmL: -1, ArmR: 1, Sleeve: 1 }, label: "arm in, out" },
];

export async function renderPoses(id: string, poses: LabPose[], scale = 1, crop?: { x: number; y: number; w: number; h: number }): Promise<string[]> {
  // "fairy.sprite" picks a sprite rig; a bare id the portrait (or the sprite when there is none).
  const [who, kind] = id.split(".");
  const set = ART_L2D[who!];
  const model = kind === "sprite" || !set?.portrait ? set?.sprite?.model : set.portrait;
  if (!model) throw new Error(`no model ${id}`);
  const c = crop ?? { x: 0, y: 0, w: model.w, h: model.h };
  const renderer = await sharedRenderer();
  const root = new Container();
  const rig = new Rig(model);
  const view = new RigView(rig, await partImages(model));
  view.scale.set(scale);
  view.position.set(-c.x * scale, -c.y * scale);
  root.addChild(view);
  const frame = new Rectangle(0, 0, c.w * scale, c.h * scale);
  const out: string[] = [];
  for (const p of poses) {
    for (const d of model.params) rig.params[d.id] = d.def;
    pose(rig, p.look ?? { x: 0, y: 0 });
    for (const [k, v] of Object.entries(p.params ?? {})) rig.set(k, v);
    view.update();
    out.push(await renderer.extract.base64({ target: root, frame, resolution: 1 }));
  }
  root.destroy({ children: true });
  return out;
}

/**
 * A gait sheet of a sprite rig: rows standing, walking right and walking
 * slowly right (focus), each settled for 2 s then sampled `cols` times over
 * about one stride. Returns PNG data URLs row by row, and the labels.
 */
export async function renderGait(id: string, cols = 6, scale = 1.5): Promise<{ urls: string[]; labels: string[] }> {
  const sr = ART_L2D[id]?.sprite;
  if (!sr) throw new Error(`no sprite rig ${id}`);
  const renderer = await sharedRenderer();
  const rig = new Rig(sr.model);
  const view = new RigView(rig, await partImages(sr.model));
  view.scale.set(scale);
  const root = new Container();
  root.addChild(view);
  const frame = new Rectangle(0, 0, sr.model.w * scale, sr.model.h * scale);
  const urls: string[] = [];
  const labels: string[] = [];
  const states: [string, { x: number; y: number }, boolean, number][] = [
    ["stand", { x: 0, y: 0 }, false, 1 / sr.rate],
    ["walk", { x: 1, y: 0 }, false, 1 / RATE.walk],
    ["slow walk", { x: 1, y: 0 }, true, 1 / RATE.slowWalk],
  ];
  for (const [name, move, slow, period] of states) {
    const anim = new Animator(rig, () => 0.99);
    anim.rate = sr.rate;
    anim.target = { x: move.x * 0.8, y: 0 };
    anim.move = move;
    anim.slow = slow;
    for (let i = 0; i < 120; i++) anim.step(1 / 60);
    for (let c = 0; c < cols; c++) {
      for (let i = 0; i < Math.round((period / cols) * 60); i++) anim.step(1 / 60);
      view.update();
      urls.push(await renderer.extract.base64({ target: root, frame, resolution: 1 }));
      labels.push(`${name} ${c + 1}`);
    }
  }
  root.destroy({ children: true });
  return { urls, labels };
}

/** The film's frame (model units, room for her lying down to either side) and where her feet stand in it: knocked out she tips onto her right (+x) side (knock +1), so they stand left of the middle. */
const FILM_W = 320;
const FILM_H = 290;
const FILM_FEET = { x: 100, y: 200 };
/** Her middle (100, 120) above her feet (y 188): the tip turns about it, kept this far above the feet, a turn about the feet. */
const FILM_LEG = 68;

/** Place the film's holder (pivot at her middle) tipped over by `turn` and lifted by `lift` (model units), as renderer.ts tipOver does. */
function placeFilm(holder: Container, turn: number, lift: number, scale: number): void {
  holder.rotation = turn;
  holder.position.set((FILM_FEET.x + FILM_LEG * Math.sin(turn)) * scale, (FILM_FEET.y - lift - FILM_LEG * Math.cos(turn)) * scale);
}

/**
 * A film strip of a sprite rig through the FILM rows, each sampled `cols`
 * times over `span` seconds, tipped over as the field tips her when she is
 * knocked out. Returns PNG data URLs row by row, and the labels.
 */
export async function renderFilm(id: string, cols = 6, scale = 1, span = 1, only?: string[]): Promise<{ urls: string[]; labels: string[] }> {
  const sr = ART_L2D[id]?.sprite;
  if (!sr) throw new Error(`no sprite rig ${id}`);
  const renderer = await sharedRenderer();
  const rig = new Rig(sr.model);
  const view = new RigView(rig, await partImages(sr.model));
  // Turned about her middle (100, 120), which is kept above her feet (100, 188) as she tips: a turn about the feet.
  const holder = new Container();
  holder.addChild(view);
  holder.pivot.set(100, 120);
  holder.scale.set(scale);
  const root = new Container();
  root.addChild(holder);
  const frame = new Rectangle(0, 0, FILM_W * scale, FILM_H * scale);
  const urls: string[] = [];
  const labels: string[] = [];
  const anim = new Animator(rig, () => 0.99);
  anim.rate = sr.rate;
  anim.snap();
  const steps = Math.max(1, Math.round((span * 60) / cols));
  for (const row of FILM) {
    const shown = !only?.length || only.some((n) => row.name.startsWith(n));
    row.set(anim, 0);
    for (let i = 0; i < Math.round((row.settle ?? 0) * 60); i++) anim.step(1 / 60);
    for (let c = 0; c < cols; c++) {
      for (let i = 0; i < steps; i++) {
        const u = (c * steps + i) / (cols * steps);
        row.set(anim, u);
        anim.step(row.dt ? row.dt(u) : 1 / 60);
      }
      // Every frame is drawn, shown or not, as the field draws them.
      view.update();
      const turn = row.tip ? row.tip(anim, (c + 1) / cols) : 0;
      placeFilm(holder, turn, row.tip ? anim.recoil * 24 : 0, scale);
      const url = await renderer.extract.base64({ target: root, frame, resolution: 1 });
      if (!shown) continue;
      urls.push(url);
      labels.push(`${row.name} ${c + 1}`);
    }
  }
  root.destroy({ children: true });
  return { urls, labels };
}

/** One film row traced frame by frame (traceFilm). */
export interface TraceRow {
  name: string;
  /** Onion-skin frames (PNG data URLs), every `every` steps, the last one at the row's end. */
  frames: string[];
  /** Tracked points per step, in frame pixels: x0, y0, x1, y1, ... */
  pts: Record<string, number[]>;
  /** Parameter values per step. */
  params: Record<string, number[]>;
}

/** The parameters traceFilm records. */
export const TRACED = ["ArmL", "ArmR", "ArmLBend", "ArmRBend", "Bob", "Step", "Sleeve", "HairSide", "AngleZ", "BodyAngleX"];

/**
 * The film's motion as data, for judging it the way an animator does (arcs,
 * spacing, overlap, follow-through): every FILM row stepped at 60 fps, with
 * the hand ends (each arm part's vertex farthest from its shoulder), the
 * elbows (the vertex nearest halfway), the head and the hem traced each step
 * as the field would place them (tipped over when knocked out), the arm and
 * body parameters recorded, and onion-skin frames every `every` steps.
 */
export async function traceFilm(id: string, scale = 1, span = 1, only?: string[], every = 6): Promise<{ w: number; h: number; rows: TraceRow[] }> {
  const sr = ART_L2D[id]?.sprite;
  if (!sr) throw new Error(`no sprite rig ${id}`);
  const renderer = await sharedRenderer();
  const model = sr.model;
  const rig = new Rig(model);
  const view = new RigView(rig, await partImages(model));
  const holder = new Container();
  holder.addChild(view);
  holder.pivot.set(100, 120);
  holder.scale.set(scale);
  const root = new Container();
  root.addChild(holder);
  const frame = new Rectangle(0, 0, FILM_W * scale, FILM_H * scale);
  const index = new Map(model.parts.map((p, i) => [p.id, i]));
  const out = model.parts.map((p) => new Float32Array(rig.meshes[p.id]!.rest.length));
  const opacity = new Float64Array(model.parts.length);
  // Tracked vertices: [name, part index, vertex index] (-1: the part's mean).
  const tracked: [string, number, number][] = [];
  for (const [side, sx] of [
    ["L", SHOULDER[0]],
    ["R", 200 - SHOULDER[0]],
  ] as const) {
    const p = index.get(`arm${side}`);
    if (p === undefined) continue;
    const rest = rig.meshes[`arm${side}`]!.rest;
    const dist = (v: number) => Math.hypot(rest[v * 2]! - sx, rest[v * 2 + 1]! - SHOULDER[1]);
    let far = 0;
    for (let v = 0; v < rest.length / 2; v++) if (dist(v) > dist(far)) far = v;
    let mid = 0;
    for (let v = 0; v < rest.length / 2; v++) if (Math.abs(dist(v) - dist(far) / 2) < Math.abs(dist(mid) - dist(far) / 2)) mid = v;
    tracked.push([`hand${side}`, p, far], [`elbow${side}`, p, mid]);
  }
  for (const name of ["face", "dress"]) if (index.has(name)) tracked.push([name, index.get(name)!, -1]);
  const anim = new Animator(rig, () => 0.99);
  anim.rate = sr.rate;
  anim.snap();
  const rows: TraceRow[] = [];
  const steps = Math.max(1, Math.round(span * 60));
  for (const row of FILM) {
    const shown = !only?.length || only.some((n) => row.name.startsWith(n));
    row.set(anim, 0);
    for (let i = 0; i < Math.round((row.settle ?? 0) * 60); i++) anim.step(1 / 60);
    const tr: TraceRow = { name: row.name, frames: [], pts: {}, params: {} };
    for (const [name] of tracked) tr.pts[name] = [];
    for (const k of TRACED) tr.params[k] = [];
    for (let i = 0; i < steps; i++) {
      const u = i / steps;
      row.set(anim, u);
      anim.step(row.dt ? row.dt(u) : 1 / 60);
      if (!shown) continue;
      const turn = row.tip ? row.tip(anim, (i + 1) / steps) : 0;
      const lift = row.tip ? anim.recoil * 24 : 0;
      rig.deformInto(out, opacity);
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      const px = FILM_FEET.x + FILM_LEG * s;
      const py = FILM_FEET.y - lift - FILM_LEG * c;
      for (const [name, p, v] of tracked) {
        const pos = out[p]!;
        let x = 0;
        let y = 0;
        if (v >= 0) {
          x = pos[v * 2]!;
          y = pos[v * 2 + 1]!;
        } else {
          for (let q = 0; q < pos.length; q += 2) {
            x += pos[q]!;
            y += pos[q + 1]!;
          }
          x /= pos.length / 2;
          y /= pos.length / 2;
        }
        const dx = x - 100;
        const dy = y - 120;
        tr.pts[name]!.push((px + dx * c - dy * s) * scale, (py + dx * s + dy * c) * scale);
      }
      for (const k of TRACED) tr.params[k]!.push(rig.params[k] ?? 0);
      if ((i + 1) % every === 0 || i === steps - 1) {
        view.update();
        placeFilm(holder, turn, lift, scale);
        tr.frames.push(await renderer.extract.base64({ target: root, frame, resolution: 1 }));
      }
    }
    if (shown) rows.push(tr);
  }
  root.destroy({ children: true });
  return { w: FILM_W * scale, h: FILM_H * scale, rows };
}
