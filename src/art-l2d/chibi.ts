// The chibi kit: full-body field sprites on the same rig engine (rig.ts).
// A chibi is drawn in a 200x200 model space (scaled to its game size when
// baked): head centre (100, 76) with the portrait kit's head squeezed to
// 0.45, eye line y 86, chin y 120, a bell dress to the hem at y 180, feet at
// y 188, wings rooted at the back (100, 128). Besides the portrait
// parameters it has Bob (float up/down, the hem flaring), Flap (the wings)
// and Spin (for orbs); one idle cycle is Flap = sin, Bob = sin shifted
// (animator.ts), which the field bakes as a few frames per look.

import { opacityKeys, rotation, warp, type Deformer, type Model, type ParamDef, type Part, type Pendulum, type Rect } from "./rig.ts";
import { ANGLE_KEYS, dome, turnFn } from "./turn.ts";
import { clamp01, grid, ln, PARAMS, PHYSICS, SKIN, WHITE } from "./kit.ts";

export const CW = 200;
export const CH = 200;
/** Chibi head centre. */
export const CHC: [number, number] = [100, 76];
/** Portrait kit coordinates -> chibi coordinates (the head scaled 0.45 about its centre). */
export const FROM_PORTRAIT = `translate(${CHC[0]} ${CHC[1]}) scale(0.45) translate(-220 -250)`;

const ANG: [string, number[]][] = [
  ["AngleX", ANGLE_KEYS],
  ["AngleY", ANGLE_KEYS],
];
const SWAY = [-1, 0, 1];
const HEAD: Rect = { x: 10, y: 0, w: 180, h: 150 };
const TALL: Rect = { x: 10, y: 0, w: 180, h: 200 };

export const CHIBI_PARAMS: ParamDef[] = [
  ...PARAMS,
  { id: "Bob", min: -1, max: 1, def: 0 },
  { id: "Flap", min: -1, max: 1, def: 0 },
  { id: "Spin", min: 0, max: 1, def: 0 },
  /** Walking: the feet lift in turn (+1 left up, -1 right up); the sleeves trail (+1 = toward +x). */
  { id: "Step", min: -1, max: 1, def: 0 },
  { id: "Sleeve", min: -1, max: 1, def: 0 },
  /**
   * The skirt's hem: trailing sideways (+1 toward +x) and flaring up and out
   * (HemLift +1; -1 drawn down and in). The feet hang under it.
   */
  { id: "Hem", min: -1, max: 1, def: 0 },
  { id: "HemLift", min: -1, max: 1, def: 0 },
  /** Each arm about its shoulder: +1 swung out and up, away from the body; -1 in, across it. */
  { id: "ArmL", min: -1, max: 1, def: 0 },
  { id: "ArmR", min: -1, max: 1, def: 0 },
  /** Each forearm (or sleeve end) bent further the same way, +1 out: it trails the arm's swing and overshoots it. */
  { id: "ArmLBend", min: -1, max: 1, def: 0 },
  { id: "ArmRBend", min: -1, max: 1, def: 0 },
  /** The big arm motions past the swing, about the shoulder (+1 out and up): thrown up by a hit, flopped toward the ground when she lies on it. */
  { id: "ArmLFall", min: -1, max: 1, def: 0 },
  { id: "ArmRFall", min: -1, max: 1, def: 0 },
  /**
   * How fast she moves across the field (+1: full speed toward +x), as the
   * animator eases it: an input of the physics, so hands, sleeves and hair lag
   * as she sets off and swing on past when she stops.
   */
  { id: "MoveX", min: -1, max: 1, def: 0 },
  /** Hurt faces: the wince of a hit (eyes squeezed to "> <", a gasp), and knocked out (spinning swirls for eyes; DizzySpin turns them, 0..1 a turn). */
  { id: "Wince", min: 0, max: 1, def: 0 },
  { id: "Dizzy", min: 0, max: 1, def: 0 },
  { id: "DizzySpin", min: 0, max: 1, def: 0 },
];

/** The left shoulder (the right mirrors it), and how far (degrees) an arm swings at ArmL = ±1, and turns at ArmLFall = ±1. */
export const SHOULDER: [number, number] = [80, 122];
const ARM_SWING = 18;
const ARM_FALL = 60;
/** How far (degrees) the hand end bends at ArmLBend = ±1; the bend grows from nothing at the shoulder to full at ARM_REACH units out. */
const ARM_BEND = 24;
const ARM_REACH = 46;

/** One arm's deformers: the big turn about the shoulder (a fling, a flop), the swing on it, and a bend under them that curls the far end. */
function armDeformers(s: "L" | "R"): Deformer[] {
  const sx = s === "L" ? SHOULDER[0] : CW - SHOULDER[0];
  const sy = SHOULDER[1];
  const out = s === "L" ? 1 : -1;
  const rect: Rect = s === "L" ? { x: 0, y: 100, w: 104, h: 96 } : { x: 96, y: 100, w: 104, h: 96 };
  return [
    rotation(`armFall${s}`, "sleeves", [sx, sy], [[`Arm${s}Fall`, SWAY]], ([a = 0]) => ({ angle: out * a * ARM_FALL })),
    // The swing foreshortens the arm a little (swung forward or back).
    rotation(`arm${s}`, `armFall${s}`, [sx, sy], [[`Arm${s}`, SWAY]], ([a = 0]) => ({ angle: out * a * ARM_SWING, scale: 1 - 0.05 * Math.abs(a) })),
    warp(`armBend${s}`, `arm${s}`, rect, 6, 6, [[`Arm${s}Bend`, SWAY]], (x, y, [b = 0]) => {
      const dx = x - sx;
      const dy = y - sy;
      const t = clamp01((Math.hypot(dx, dy) - 6) / (ARM_REACH - 6));
      const a = (out * b * ARM_BEND * t * t * (3 - 2 * t) * Math.PI) / 180;
      return [sx + dx * Math.cos(a) - dy * Math.sin(a), sy + dx * Math.sin(a) + dy * Math.cos(a)];
    }),
  ];
}

/** The left eye: centre, lid line (where it closes) and warp rect. */
const EYE = { cx: 82, lid: 92, rect: { x: 62, y: 62, w: 40, h: 44 } };
const mirrorRect = (r: Rect): Rect => ({ x: CW - r.x - r.w, y: r.y, w: r.w, h: r.h });

function eyeWarps(side: "L" | "R"): Deformer[] {
  const m = (x: number) => (side === "L" ? x : CW - x);
  const rect = side === "L" ? EYE.rect : mirrorRect(EYE.rect);
  const cx = m(EYE.cx);
  const open = `Eye${side}Open`;
  return [
    warp(`eye${side}`, "feat", rect, 2, 2, [[open, [0, 1]]], (x, y, [o = 1]) => {
      const u = Math.max(-1, Math.min(1, (x - cx) / 13));
      const closed = EYE.lid + (y - EYE.lid) * 0.1 + 1.5 * (1 - u * u);
      return [x, closed + (y - closed) * o];
    }),
    warp(`lash${side}`, "feat", rect, 4, 2, [[open, [0, 1]]], (x, y, [o = 1]) => {
      const u = Math.max(-1, Math.min(1, (x - cx) / 13));
      return [x, y + (9 + 9 * (1 - u * u)) * (1 - o)];
    }),
    rotation(`iris${side}`, `eye${side}`, [m(83), 88], [
      ["EyeBallX", [-1, 0, 1]],
      ["EyeBallY", [-1, 0, 1]],
    ], ([ex = 0, ey = 0]) => ({ x: ex * 3.5, y: -ey * 2.5 })),
    // The knocked-out swirl turns about the eye's middle (the right one the other way, mirrored).
    rotation(`swirl${side}`, "feat", [m(84.6), 89], [["DizzySpin", [0, 1]]], ([s = 0]) => ({ angle: (side === "L" ? 1 : -1) * s * 360 })),
  ];
}

/** A wing warp: flaps about its root (Flap +1 = up and spread, -1 = down and folded). */
function wingWarp(side: "L" | "R", root: [number, number], amp: number): Deformer {
  const s = side === "L" ? 1 : -1;
  const rect: Rect = side === "L" ? { x: -20, y: 0, w: 125, h: 200 } : { x: 95, y: 0, w: 125, h: 200 };
  const rx = side === "L" ? root[0] : CW - root[0];
  return warp(`wing${side}`, "body", rect, 4, 4, [["Flap", SWAY]], (x, y, [f = 0]) => {
    const a = (s * f * amp * Math.PI) / 180;
    const dx = (x - rx) * (0.86 + 0.14 * f);
    const dy = y - root[1];
    return [rx + dx * Math.cos(a) - dy * Math.sin(a), root[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  });
}

export interface ChibiRig {
  /** Wing root and flap amplitude (degrees). */
  wing?: { root: [number, number]; amp: number };
}

/** The chibi deformer tree. */
export function chibiDeformers(opts: ChibiRig = {}): Deformer[] {
  const [hx, hy] = CHC;
  const wing = opts.wing ?? { root: [98, 128], amp: 16 };
  return [
    rotation("bob", undefined, [100, 100], [["Bob", SWAY]], ([b = 0]) => ({ y: b * 5 })),
    // Body: turns a little; the hem flares and lifts as the body sinks (Bob +).
    warp("body", "bob", { x: -20, y: 0, w: 240, h: 200 }, 6, 6, [
      ["BodyAngleX", [-10, 0, 10]],
      ["Bob", SWAY],
    ], (x, y, [ba = 0, b = 0]) => {
      const t = (ba * 0.8 * Math.PI) / 180;
      const dx = x - 100;
      const torso = clamp01((y - 112) / 30);
      const z = torso * Math.sqrt(Math.max(0, 60 * 60 - Math.min(60, Math.abs(dx)) ** 2)) + (1 - torso) * 50;
      const hem = clamp01((y - 140) / 45);
      return [100 + dx * (1 + 0.07 * b * hem) + z * Math.sin(t), y - 3 * b * hem];
    }),
    rotation("neck", "body", [100, 120], [["AngleZ", ANGLE_KEYS]], ([az = 0]) => ({ angle: -az * 0.4 })),
    warp("face", "neck", HEAD, 6, 6, ANG, turnFn(hx, hy, dome(hx, hy, 56, 9, 27))),
    warp("feat", "neck", HEAD, 6, 6, ANG, turnFn(hx, hy, dome(hx, hy, 56, 20, 18))),
    warp("bangsTurn", "neck", HEAD, 6, 6, ANG, turnFn(hx, hy, dome(hx, hy, 60, 22, 18))),
    warp("bangs", "bangsTurn", HEAD, 4, 4, [["HairFront", SWAY]], (x, y, [f = 0]) => [x + f * 4 * clamp01((y - 40) / 60) ** 2, y]),
    warp("sideTurn", "neck", TALL, 6, 8, ANG, turnFn(hx, hy, () => 20)),
    warp("side", "sideTurn", TALL, 6, 8, [["HairSide", SWAY]], (x, y, [f = 0]) => {
      const k = clamp01((y - 70) / 80) ** 1.5;
      return [x + f * 10 * k, y - Math.abs(f) * 3 * k];
    }),
    warp("backTurn", "neck", TALL, 6, 8, ANG, turnFn(hx, hy, () => -8)),
    warp("back", "backTurn", TALL, 6, 8, [["HairBack", SWAY]], (x, y, [f = 0]) => [x + f * 8 * clamp01((y - 60) / 90) ** 2, y]),
    warp("bowTurn", "neck", HEAD, 6, 6, ANG, turnFn(hx, hy, () => -20)),
    warp("bow", "bowTurn", HEAD, 6, 6, [["Ribbon", SWAY]], (x, y, [f = 0]) => {
      const wing = (x - 100) / 50;
      const tail = clamp01((y - 45) / 40);
      return [x + f * 6 * tail, y + f * 4 * wing * (1 - tail)];
    }),
    warp("mouth", "feat", { x: 88, y: 96, w: 24, h: 22 }, 2, 2, [["MouthOpen", [0, 1]]], (x, y, [o = 0]) => [x, 105 + (y - 105) * (0.1 + 0.9 * o)]),
    ...eyeWarps("L"),
    ...eyeWarps("R"),
    // Sleeves swing from the shoulders; the feet lift in turn.
    warp("sleeves", "body", { x: -20, y: 100, w: 240, h: 100 }, 4, 4, [["Sleeve", SWAY]], (x, y, [f = 0]) => {
      const k = clamp01((y - 124) / 56);
      return [x + f * 10 * k, y - Math.abs(f) * 3 * k];
    }),
    ...armDeformers("L"),
    ...armDeformers("R"),
    // The skirt from the waist down: the hem trails and flares, more toward its edge; the feet hang under it.
    warp("hem", "body", { x: 30, y: 104, w: 140, h: 96 }, 4, 4, [
      ["Hem", SWAY],
      ["HemLift", SWAY],
    ], (x, y, [f = 0, l = 0]) => {
      const k = clamp01((y - 136) / 56) ** 1.4;
      return [x + f * 9 * k + (x - 100) * 0.1 * l * k, y - Math.abs(f) * 2 * k - l * 5 * k];
    }),
    warp("feet", "hem", { x: 70, y: 170, w: 60, h: 30 }, 2, 1, [["Step", SWAY]], (x, y, [f = 0]) => [x, y - 6 * Math.max(0, (x < 100 ? 1 : x > 100 ? -1 : 0) * f)]),
    wingWarp("L", wing.root, wing.amp),
    wingWarp("R", wing.root, wing.amp),
  ];
}

/** Chibi weights of the portrait pendulums' inputs, as a fraction of the portraits' (see CHIBI_PHYSICS). */
const CHIBI_INPUT: Record<string, Record<string, number>> = { HairSide: { AngleX: 0.7, BodyAngleX: 0.4 }, HairBack: { AngleX: 0.7, BodyAngleX: 0.4 }, Ribbon: { AngleY: 0.25 } };

/**
 * The portrait pendulums, also pushed by the bob so a floating fairy's hair
 * and ribbons sway (their trail as she moves is the animator's). Two inputs
 * are gentler than the portraits': the body's turn on the side and back hair
 * (walking, a chibi's body turns ten degrees into the move, twenty turning
 * round, which would throw the hair to its limits and hold it there on top of
 * the trail), and the nod on the ribbon (on the flinch of a hit the head snaps
 * back, and the ribbon would fly the same way whichever side the hit came
 * from; the animator flings it away from the hit). One per arm:
 * the hands lag the bob (flaring out as she sinks, dropping in as she rises),
 * the body's turn (the arm on the far side swings out) and the move across
 * (trailing as she sets off, swinging forward as she stops), then settle,
 * about one and a half swings a second.
 */
const CHIBI_PHYSICS: Pendulum[] = [
  ...PHYSICS.map((p) => ({
    ...p,
    inputs: [...p.inputs.map((i) => ({ ...i, weight: i.weight * (CHIBI_INPUT[p.output]?.[i.param] ?? 1) })), { param: "Bob", weight: 0.15 }],
  })),
  // The hem lags the bob (flaring as she sinks, drawn down as she rises) and swings on past when she stops.
  { output: "HemLift", inputs: [{ param: "Bob", weight: 1 }], stiffness: 34, damping: 4.4, gain: 0.45 },
  { output: "Hem", inputs: [{ param: "MoveX", weight: 1 }], stiffness: 24, damping: 3.8, gain: 1.1 },
  ...(["L", "R"] as const).map((s) => ({
    output: `Arm${s}`,
    inputs: [
      { param: "Bob", weight: -0.07 },
      { param: "BodyAngleX", weight: (s === "L" ? -1 : 1) / 20 },
      { param: "MoveX", weight: (s === "L" ? -1 : 1) * 0.25 },
    ],
    stiffness: 90,
    damping: 9,
    gain: 1.2,
  })),
];

/** A chibi model from the chibi deformers and a character's parts. */
export function chibiModel(id: string, parts: Part[], opts: ChibiRig = {}, extra: Deformer[] = []): Model {
  return { id, w: CW, h: CH, params: CHIBI_PARAMS, deformers: [...chibiDeformers(opts), ...extra], parts, physics: CHIBI_PHYSICS };
}

// ---------------------------------------------------------------- mirroring (about x = 100)

export const cMirrorSvg = (svg: string) => `<g transform="matrix(-1 0 0 1 ${CW} 0)">${svg}</g>`;
function cMirrorPts(pts: number[]): number[] {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(CW - pts[i]!, pts[i + 1]!);
  return out;
}
/** The same part on the right (ids and deformers L -> R). */
export function cMirror(p: Part): Part {
  const swap = (s?: string) => s?.replace(/L$/, "R");
  return {
    ...p,
    id: swap(p.id)!,
    parent: swap(p.parent),
    mask: swap(p.mask),
    rect: mirrorRect(p.rect),
    svg: cMirrorSvg(p.svg),
    mesh: p.mesh.kind === "poly" ? { kind: "poly", points: cMirrorPts(p.mesh.points) } : p.mesh,
  };
}
/** A left part and its mirror. */
export const pair = (p: Part): Part[] => [p, cMirror(p)];

// ---------------------------------------------------------------- face

export interface ChibiFace {
  eye: { dark: string; mid: string; light: string; pupil: string; lash: string };
  /** Outline colour of the skin. */
  line?: string;
  mouth?: "smile" | "grin" | "o";
}

/** Bold lines: sprites show at 40-80 game px, so strokes are thick in model units. */
export const LW = 3.4;

/** Face, blush, eyes and mouths (orders 30..44). */
export function chibiFace(f: ChibiFace): Part[] {
  const line = f.line ?? "#7a4038";
  const face = `<path d="M52 58 L148 58 L148 88 C146 106 126 120 100 122 C74 120 54 106 52 88 Z" fill="${SKIN.base}" ${ln(line, LW)}/>
<path d="M52 58 L148 58 L148 74 C120 64 80 64 52 74 Z" fill="${SKIN.shade}"/>`;
  const blush = `<ellipse cx="69" cy="102" rx="8" ry="4" fill="${SKIN.blush}" opacity="0.5"/><ellipse cx="131" cy="102" rx="8" ry="4" fill="${SKIN.blush}" opacity="0.5"/>`;
  const WHITE_L = [71, 82, 75, 76, 82, 74, 89, 75, 94, 80, 95, 88, 92, 96, 87, 100, 82, 101, 77, 100, 73, 96, 70, 89];
  const white = `<polygon points="${WHITE_L.join(" ")}" fill="${WHITE.base}"/>`;
  const iris = `<defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.eye.dark}"/><stop offset="0.5" stop-color="${f.eye.mid}"/><stop offset="1" stop-color="${f.eye.light}"/></linearGradient></defs>
<ellipse cx="83" cy="89" rx="8" ry="11" fill="url(#ig)" ${ln(f.eye.pupil, 1.4)}/>
<ellipse cx="83.5" cy="90" rx="3.6" ry="5.6" fill="${f.eye.pupil}"/>
<circle cx="79.5" cy="83.5" r="3.2" fill="#fff"/><circle cx="87" cy="95" r="1.6" fill="#fff"/>`;
  const lash = `<path d="M67 86 C69 75 77 70 84 70 C91 70 96 74 98 80 L95 82 C91 78 87 77 82 77 C76 77 72 81 71 90 Z" fill="${f.eye.lash}"/>
<path d="M68 84 L62 80 L67 90 Z" fill="${f.eye.lash}"/>`;
  const closed = f.mouth === "o" ? `<ellipse cx="100" cy="107" rx="3.5" ry="3" fill="#8a1f2e" ${ln("#4e0c16", 1.6)}/>` : f.mouth === "grin" ? `<path d="M93 104 Q100 111 107 104 Z" fill="#8a1f2e" ${ln("#4e0c16", 1.8)}/>` : `<path d="M94 105 Q100 110 106 105" fill="none" ${ln("#7a3030", 2.4)}/>`;
  const open = `<path d="M93 103 Q100 106 107 103 Q106 114 100 115 Q94 114 93 103 Z" fill="#8a1f2e" ${ln("#4e0c16", 1.8)}/><ellipse cx="100" cy="112" rx="3.6" ry="2" fill="#ea7482"/>`;
  const gasp = `<ellipse cx="100" cy="108.5" rx="4.4" ry="5.6" fill="#8a1f2e" ${ln("#4e0c16", 1.8)}/><ellipse cx="100" cy="111.6" rx="2.4" ry="1.5" fill="#ea7482"/>`;
  const vis = opacityKeys([["EyeLOpen", [0, 0.3]]], ([o = 0]) => (o > 0 ? 1 : 0));
  // Hurt: the lash gives way to "> <" squeezed shut on a hit, or to a swirl knocked out.
  const HURT: [string, number[]][] = [
    ["Wince", [0, 0.4]],
    ["Dizzy", [0, 0.4]],
  ];
  const wince = `<path d="M74.5 80.5 L91 88.5 L74.5 96.5" fill="none" stroke="${f.eye.lash}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const swirl = `<path d="M84.6 89 a1.6 1.6 0 0 1 3.2 0 a3.2 3.2 0 0 1 -6.4 0 a4.8 4.8 0 0 1 9.6 0 a6.4 6.4 0 0 1 -12.8 0 a8 8 0 0 1 16 0" fill="none" stroke="${f.eye.lash}" stroke-width="2.6" stroke-linecap="round"/>`;
  const eyeParts: Part[] = [
    { id: "eyeWhiteL", parent: "eyeL", order: 40, rect: { x: 66, y: 70, w: 34, h: 34 }, mesh: { kind: "poly", points: WHITE_L }, svg: white, keyed: vis },
    { id: "irisL", parent: "irisL", order: 41, rect: { x: 72, y: 74, w: 24, h: 30 }, mesh: grid(1, 1), svg: iris, mask: "eyeWhiteL", keyed: vis },
    { id: "lashL", parent: "lashL", order: 42, rect: { x: 58, y: 66, w: 44, h: 28 }, mesh: grid(4, 2), svg: lash, keyed: opacityKeys(HURT, ([w = 0, d = 0]) => (w || d ? 0 : 1)) },
    { id: "winceL", parent: "feat", order: 43, rect: { x: 68, y: 74, w: 30, h: 29 }, mesh: grid(1, 1), svg: wince, keyed: opacityKeys([["Wince", [0, 0.4]]], ([w = 0]) => (w ? 1 : 0)) },
    { id: "dizzyL", parent: "swirlL", order: 43, rect: { x: 72, y: 76, w: 26, h: 26 }, mesh: grid(1, 1), svg: swirl, keyed: opacityKeys([["Dizzy", [0, 0.4]]], ([d = 0]) => (d ? 1 : 0)) },
  ];
  // The right eye mirrors the left one but keeps its own open parameter.
  const right = eyeParts.map((p) => {
    const m = cMirror(p);
    return p.keyed?.params[0] === "EyeLOpen" ? { ...m, keyed: opacityKeys([["EyeROpen", [0, 0.3]]], ([o = 0]) => (o > 0 ? 1 : 0)) } : m;
  });
  return [
    { id: "face", parent: "face", order: 30, rect: { x: 46, y: 54, w: 108, h: 72 }, mesh: grid(4, 3), svg: face },
    { id: "blush", parent: "feat", order: 31, rect: { x: 58, y: 96, w: 84, h: 12 }, mesh: grid(2, 1), svg: blush },
    // Hurt, the mouth is a round gasp instead of the smile.
    { id: "mouthClosed", parent: "feat", order: 33, rect: { x: 88, y: 98, w: 24, h: 16 }, mesh: grid(1, 1), svg: closed, keyed: opacityKeys([["MouthOpen", [0, 0.25]], ...HURT], ([o = 0, w = 0, d = 0]) => (w || d ? 0 : 1 - o / 0.25)) },
    { id: "mouthOpen", parent: "mouth", order: 34, rect: { x: 88, y: 98, w: 24, h: 20 }, mesh: grid(1, 2), svg: open, keyed: opacityKeys([["MouthOpen", [0, 0.25]], ...HURT], ([o = 0, w = 0, d = 0]) => (w || d ? 0 : o / 0.25)) },
    { id: "mouthGasp", parent: "mouth", order: 34, rect: { x: 90, y: 100, w: 20, h: 18 }, mesh: grid(1, 2), svg: gasp, keyed: opacityKeys(HURT, ([w = 0, d = 0]) => (w || d ? 1 : 0)) },
    ...eyeParts,
    ...right,
  ];
}
