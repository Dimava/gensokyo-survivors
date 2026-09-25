// Dev-only: renders a model in given poses to PNG data URLs, for
// scripts/l2d-lab.ts (which imports this through the Vite dev server). The
// game never imports it.

import { Container, Rectangle } from "pixi.js";
import { LOOKS, type Look } from "../art/drawing.ts";
import { ART_L2D } from "./index.ts";
import { Animator, pose } from "./animator.ts";
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

/**
 * A film strip of a sprite rig through the states the field puts it in, a
 * row each: standing, walking right, walking down, backpedalling with focus
 * (facing right, moving left), the hit (a hit-stop, then flung), lying down,
 * and standing again after it. Each row runs on from the one before (the
 * springs carry over, as in a run) and is sampled `cols` times over about a
 * second. Returns PNG data URLs row by row, and the labels.
 */
export async function renderFilm(id: string, cols = 6, scale = 1): Promise<{ urls: string[]; labels: string[] }> {
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
  const anim = new Animator(rig, () => 0.99);
  anim.rate = sr.rate;
  anim.snap();
  type Row = { name: string; set: (a: Animator, u: number) => void; dt?: (u: number) => number; settle?: number };
  const still = { x: 0, y: 0 };
  const rows: Row[] = [
    { name: "stand", set: (a) => ((a.move = still), (a.target = { x: 0.2, y: 0.3 })), settle: 1 },
    { name: "walk right", set: (a) => ((a.move = { x: 1, y: 0 }), (a.target = { x: 0.8, y: 0 })), settle: 1 },
    { name: "walk down", set: (a) => ((a.move = { x: 0, y: 1 }), (a.target = { x: 0, y: 0.8 })), settle: 0.5 },
    {
      name: "focus backpedal",
      set: (a) => {
        a.move = { x: -1, y: 0 };
        a.slow = true;
        a.face = { x: 1, y: 0 };
        a.target = { x: 0.8, y: 0 };
      },
      settle: 1,
    },
    {
      name: "hit",
      set: (a, u) => {
        a.move = still;
        a.slow = false;
        a.face = null;
        a.knock = -1;
        a.recoil = u < 0.3 ? 1 : 1 - 0.6 * ((u - 0.3) / 0.7);
        a.down = u < 0.3 ? 0 : 0.55 * ((u - 0.3) / 0.7);
      },
      // The hit-stop: the first frames do not advance time.
      dt: (u) => (u < 0.3 ? 0 : 1 / 60),
    },
    { name: "down", set: (a) => ((a.recoil = 0), (a.knock = 0), (a.down = 1)) },
    { name: "up again", set: (a) => ((a.down = 0), (a.target = { x: 0, y: 0.2 })), settle: 0.3 },
  ];
  for (const row of rows) {
    row.set(anim, 0);
    for (let i = 0; i < Math.round((row.settle ?? 0) * 60); i++) anim.step(1 / 60);
    const per = Math.round(60 / cols);
    for (let c = 0; c < cols; c++) {
      for (let i = 0; i < per; i++) {
        const u = (c * per + i) / (cols * per);
        row.set(anim, u);
        anim.step(row.dt ? row.dt(u) : 1 / 60);
      }
      view.update();
      urls.push(await renderer.extract.base64({ target: root, frame, resolution: 1 }));
      labels.push(`${row.name} ${c + 1}`);
    }
  }
  root.destroy({ children: true });
  return { urls, labels };
}
