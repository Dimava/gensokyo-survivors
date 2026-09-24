// The shared kit for rigged characters (see rig.ts): the 440x640 model
// space (2x the 220x320 portrait) and its construction (head centre
// (220, 250), eye line y 270, chin y 340, neck to y 392, shoulders y 400),
// the face (skin, eyes, brows, nose, mouths) painted on those landmarks,
// the standard deformer tree and parameters, and the hair physics. A
// character adds its hair, clothes and accessories as parts hung on the
// standard deformers ("back", "side", "bangs", "bow", "body", ...).
// Right-hand parts mirror the left ones about x = 220.

import { opacityKeys, rotation, warp, type Deformer, type Model, type ParamDef, type Part, type Pendulum, type Rect } from "./rig.ts";
import { ANGLE_KEYS, dome, turnFn, turnPoint } from "./turn.ts";

export const W = 440;
export const H = 640;
/** Head centre (turn pivot). */
export const HC: [number, number] = [220, 250];

export const SKIN = { base: "#fff0e6", shade: "#f4c4b4", deep: "#e3a293", line: "#9a5a50", blush: "#ff8a9a" };
export const WHITE = { base: "#ffffff", shade: "#d8daf0", line: "#6d6788" };

// ---------------------------------------------------------------- helpers

export const ln = (c: string, w = 2.5) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
export const mirrorRect = (r: Rect): Rect => ({ x: W - r.x - r.w, y: r.y, w: r.w, h: r.h });
export const mirrorSvg = (svg: string) => `<g transform="matrix(-1 0 0 1 ${W} 0)">${svg}</g>`;
export const mirrorPts = (pts: number[]) => {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(W - pts[i]!, pts[i + 1]!);
  return out;
};

/** The same part on the right: mirrored art, rect, outline and deformer ids (L -> R). */
export function mirror(p: Part): Part {
  const swap = (s?: string) => s?.replace(/L$/, "R");
  return {
    ...p,
    id: swap(p.id)!,
    parent: swap(p.parent),
    mask: swap(p.mask),
    rect: mirrorRect(p.rect),
    svg: mirrorSvg(p.svg),
    mesh: p.mesh.kind === "poly" ? { kind: "poly", points: mirrorPts(p.mesh.points) } : p.mesh,
  };
}

export const grid = (nx: number, ny: number) => ({ kind: "grid", nx, ny }) as const;

// ---------------------------------------------------------------- deformers

const ANG: [string, number[]][] = [
  ["AngleX", ANGLE_KEYS],
  ["AngleY", ANGLE_KEYS],
];
const SWAY = [-1, 0, 1];
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The head centre as seen through a layer at depth z (for anchoring things like the neck top). */
export const faceDepth = dome(HC[0], HC[1], 120, 20, 60);
const featDepth = dome(HC[0], HC[1], 120, 45, 40);

const EYE_L = { cx: 178, lid: 282, rect: { x: 140, y: 230, w: 76, h: 76 } };

function eyeWarps(side: "L" | "R") {
  const m = (x: number) => (side === "L" ? x : W - x);
  const rect = side === "L" ? EYE_L.rect : mirrorRect(EYE_L.rect);
  const cx = m(EYE_L.cx);
  const open = `Eye${side}Open`;
  return [
    // White and iris squash onto the lid line as the eye closes.
    warp(`eye${side}`, "feat", rect, 4, 4, [[open, [0, 1]]], (x, y, [o = 1]) => {
      const u = Math.max(-1, Math.min(1, (x - cx) / 30));
      const closed = EYE_L.lid + (y - EYE_L.lid) * 0.1 + 3 * (1 - u * u);
      return [x, closed + (y - closed) * o];
    }),
    // The upper lashes slide down and bend into a closed-eye curve, keeping their thickness.
    warp(`lash${side}`, "feat", rect, 4, 4, [[open, [0, 1]]], (x, y, [o = 1]) => {
      const u = Math.max(-1, Math.min(1, (x - cx) / 30));
      const drop = 20 + 26 * (1 - u * u);
      return [x, y + drop * (1 - o) * (y < 290 ? 1 : 0.2)];
    }),
    rotation(`iris${side}`, `eye${side}`, [m(180), 273], [
      ["EyeBallX", [-1, 0, 1]],
      ["EyeBallY", [-1, 0, 1]],
    ], ([ex = 0, ey = 0]) => ({ x: ex * 9, y: -ey * 6 })),
  ];
}

/** A head-layer turn that fades out below `from` (to none at `to`): long hair lies on the back and shoulders. */
export function lowerOnBody(fn: (x: number, y: number, k: number[]) => [number, number], from: number, to: number) {
  return (x: number, y: number, k: number[]): [number, number] => {
    const [tx, ty] = fn(x, y, k);
    const t = clamp01((y - from) / (to - from)) * 0.7;
    return [tx + (x - tx) * t, ty + (y - ty) * t];
  };
}

export const HEAD_RECT: Rect = { x: 60, y: 40, w: 320, h: 360 };
export const LONG_RECT: Rect = { x: 60, y: 40, w: 320, h: 500 };

/** The standard deformer tree: body, neck, face layers, eyes, mouth, and the hair and ribbon sways. */
export const DEFORMERS: Deformer[] = [
  // Body: turns on a cylinder and rises with the breath; the head rides on it.
  warp("body", undefined, { x: 0, y: 60, w: W, h: 600 }, 6, 8, [
    ["BodyAngleX", [-10, 0, 10]],
    ["Breath", [0, 1]],
  ], (x, y, [b = 0, br = 0]) => {
    const t = (b * 0.8 * Math.PI) / 180;
    const dx = x - 220;
    const torso = clamp01((y - 360) / 80);
    const z = torso * Math.sqrt(Math.max(0, 180 * 180 - dx * dx)) + (1 - torso) * 170;
    const lift = -4 * br * clamp01((600 - y) / 220);
    return [220 + dx * (1 - (1 - Math.cos(t)) * 0.5) + z * Math.sin(t), y + lift];
  }),
  rotation("neck", "body", [220, 370], [["AngleZ", ANGLE_KEYS]], ([az = 0]) => ({ angle: -az * 0.4 })),
  warp("face", "neck", HEAD_RECT, 8, 8, ANG, turnFn(HC[0], HC[1], faceDepth)),
  warp("feat", "neck", HEAD_RECT, 8, 8, ANG, turnFn(HC[0], HC[1], featDepth)),
  warp("bangsTurn", "neck", HEAD_RECT, 8, 8, ANG, turnFn(HC[0], HC[1], dome(HC[0], HC[1], 130, 50, 40))),
  warp("bangs", "bangsTurn", HEAD_RECT, 6, 6, [["HairFront", SWAY]], (x, y, [f = 0]) => [x + f * 9 * clamp01((y - 150) / 150) ** 2, y]),
  warp("sideTurn", "neck", LONG_RECT, 8, 10, ANG, lowerOnBody(turnFn(HC[0], HC[1], () => 45), 360, 520)),
  warp("side", "sideTurn", LONG_RECT, 8, 10, [["HairSide", SWAY]], (x, y, [f = 0]) => {
    const k = clamp01((y - 240) / 270) ** 1.6;
    return [x + f * 26 * k, y - Math.abs(f) * 6 * k];
  }),
  warp("backTurn", "neck", LONG_RECT, 8, 10, ANG, lowerOnBody(turnFn(HC[0], HC[1], () => -70), 300, 480)),
  warp("back", "backTurn", LONG_RECT, 8, 10, [["HairBack", SWAY]], (x, y, [f = 0]) => [x + f * 20 * clamp01((y - 220) / 300) ** 2, y]),
  warp("bowTurn", "neck", HEAD_RECT, 8, 8, ANG, turnFn(HC[0], HC[1], () => -45)),
  warp("bow", "bowTurn", HEAD_RECT, 8, 8, [["Ribbon", SWAY]], (x, y, [f = 0]) => {
    const wing = (x - 220) / 110;
    const tail = clamp01((y - 150) / 90);
    return [x + f * 16 * tail, y + f * 7 * wing * (1 - tail)];
  }),
  // The neck top follows the chin; its base stays on the shoulders.
  warp("neckTop", "neck", { x: 190, y: 300, w: 60, h: 100 }, 2, 4, ANG, (x, y, [ax = 0, ay = 0]) => {
    const [cx, cy] = turnPoint(220, 330, HC[0], HC[1], faceDepth(220, 330), ax, ay);
    const k = clamp01((392 - y) / 70);
    return [x + (cx - 220) * k, y + (cy - 330) * k];
  }),
  warp("mouth", "feat", { x: 196, y: 306, w: 48, h: 36 }, 2, 2, [["MouthOpen", [0, 1]]], (x, y, [o = 0]) => [x, 316 + (y - 316) * (0.1 + 0.9 * o)]),
  ...eyeWarps("L"),
  ...eyeWarps("R"),
];

// ---------------------------------------------------------------- face

export interface FacePalette {
  /** Iris gradient top to bottom, and the pupil and lash colours. */
  eye: { dark: string; mid: string; light: string; pupil: string; lash: string };
  brow: string;
}

/** The face parts (skin, ears, blush, nose, mouths, eyes, brows) in a palette. Orders 30..43 and 53. */
export function faceParts(pal: FacePalette): Part[] {
  const face = `
  <defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${SKIN.shade}"/><stop offset="0.28" stop-color="${SKIN.base}"/></linearGradient></defs>
  <path d="M130 196 L310 196 L310 262 C306 296 264 332 220 340 C176 332 134 296 130 262 Z" fill="url(#fg)" ${ln(SKIN.line)}/>
  <path d="M134 252 C120 246 116 262 120 276 C123 288 130 292 136 288 Z" fill="${SKIN.base}" ${ln(SKIN.line, 2)}/>
  <path d="M306 252 C320 246 324 262 320 276 C317 288 310 292 304 288 Z" fill="${SKIN.base}" ${ln(SKIN.line, 2)}/>`;

  const blush = `
  <ellipse cx="160" cy="302" rx="16" ry="7" fill="${SKIN.blush}" opacity="0.35"/>
  <ellipse cx="280" cy="302" rx="16" ry="7" fill="${SKIN.blush}" opacity="0.35"/>
  <path d="M152 304 l5 -6 M160 304 l5 -6 M168 304 l5 -6 M272 304 l5 -6 M280 304 l5 -6 M288 304 l5 -6" ${ln("#f07080", 1.3)} opacity="0.5"/>`;

  const nose = `<path d="M222 297 Q225 302 220 305" fill="none" ${ln(SKIN.deep, 2)}/>`;
  const mouthClosed = `<path d="M209 318 Q220 325 231 318" fill="none" ${ln("#8a3a36", 2.6)}/>`;
  const mouthOpen = `
  <path d="M206 314 Q220 319 234 314 Q233 334 220 337 Q207 334 206 314 Z" fill="#8a1f2e" ${ln("#4e0c16", 2)}/>
  <ellipse cx="220" cy="331" rx="8" ry="4" fill="#ea7482"/>`;

  /** The left eye (character's right): white, iris, lashes, lid crease. */
  const EYE_WHITE_L = [154, 258, 164, 250, 178, 247, 192, 249, 202, 256, 205, 270, 201, 284, 191, 293, 178, 296, 165, 293, 157, 284, 153, 270];
  const eyeWhite = `<polygon points="${EYE_WHITE_L.join(" ")}" fill="${WHITE.base}"/>
  <path d="M156 262 C166 254 190 252 202 262 L202 270 C190 262 166 262 155 272 Z" fill="${WHITE.shade}"/>`;
  const iris = `
  <defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${pal.eye.dark}"/><stop offset="0.55" stop-color="${pal.eye.mid}"/><stop offset="1" stop-color="${pal.eye.light}"/></linearGradient></defs>
  <ellipse cx="180" cy="273" rx="17" ry="23" fill="url(#ig)" ${ln(pal.eye.pupil, 1.6)}/>
  <ellipse cx="181" cy="275" rx="7.5" ry="12" fill="${pal.eye.pupil}"/>
  <path d="M168 284 Q180 294 192 284" fill="none" ${ln("#ffb08a", 2)} opacity="0.7"/>
  <ellipse cx="172" cy="262" rx="6.5" ry="5.5" fill="#fff"/>
  <circle cx="189" cy="285" r="2.8" fill="#fff"/>`;
  const lash = `
  <path d="M150 264 C155 249 169 242 181 242 C194 243 203 249 208 258 L204 261 C196 254 188 251 178 251 C166 252 158 259 154 270 Z" fill="${pal.eye.lash}"/>
  <path d="M152 262 L142 256 L150 268 Z" fill="${pal.eye.lash}"/>
  <path d="M200 252 L210 250 L205 259 Z" fill="${pal.eye.lash}"/>
  `;
  /** The lid crease and lower lashes stay put; the crease fades as the eye closes. */
  const crease = `<path d="M158 243 Q178 234 199 240" fill="none" ${ln(SKIN.line, 1.5)} opacity="0.55"/>`;
  const lowerLash = `<path d="M163 294 Q178 299 192 294" fill="none" ${ln("#7a3834", 1.8)}/>`;
  const brow = `<path d="M156 224 Q176 216 197 222" fill="none" ${ln(pal.brow, 3.2)}/>`;

  const eyeParts = (): Part[] => {
    const white: Part = { id: "eyeWhiteL", parent: "eyeL", order: 40, rect: { x: 148, y: 244, w: 60, h: 56 }, mesh: { kind: "poly", points: EYE_WHITE_L }, svg: eyeWhite };
    const vis = opacityKeys([["EyeLOpen", [0, 0.3]]], ([o = 0]) => (o > 0 ? 1 : 0));
    const irisPart: Part = { id: "irisL", parent: "irisL", order: 41, rect: { x: 158, y: 246, w: 44, h: 54 }, mesh: grid(2, 2), svg: iris, mask: "eyeWhiteL", keyed: vis };
    const lashPart: Part = { id: "lashL", parent: "lashL", order: 42, rect: { x: 138, y: 230, w: 76, h: 72 }, mesh: grid(6, 4), svg: lash };
    const whiteKeyed: Part = { ...white, keyed: vis };
    const creasePart: Part = {
      id: "creaseL",
      parent: "feat",
      order: 43,
      rect: { x: 152, y: 230, w: 52, h: 18 },
      mesh: grid(2, 1),
      svg: crease,
      keyed: opacityKeys([["EyeLOpen", [0.4, 1]]], ([o = 0]) => o),
    };
    const lowerPart: Part = { id: "lowerLashL", parent: "eyeL", order: 43, rect: { x: 158, y: 288, w: 40, h: 14 }, mesh: grid(2, 1), svg: lowerLash };
    return [whiteKeyed, irisPart, lashPart, creasePart, lowerPart].flatMap((p) => [p, mirror(p)]);
  };

  const parts: Part[] = [
  { id: "face", parent: "face", order: 30, rect: { x: 110, y: 190, w: 220, h: 156 }, mesh: grid(8, 6), svg: face },
  { id: "blush", parent: "feat", order: 31, rect: { x: 140, y: 290, w: 160, h: 22 }, mesh: grid(4, 1), svg: blush },
  { id: "nose", parent: "feat", order: 32, rect: { x: 214, y: 292, w: 14, h: 16 }, mesh: grid(1, 1), svg: nose },
  {
    id: "mouthClosed",
    parent: "feat",
    order: 33,
    rect: { x: 204, y: 312, w: 32, h: 16 },
    mesh: grid(2, 1),
    svg: mouthClosed,
    keyed: opacityKeys([["MouthOpen", [0, 0.25]]], ([o = 0]) => 1 - o / 0.25),
  },
  {
    id: "mouthOpen",
    parent: "mouth",
    order: 34,
    rect: { x: 202, y: 310, w: 36, h: 30 },
    mesh: grid(2, 2),
    svg: mouthOpen,
    keyed: opacityKeys([["MouthOpen", [0, 0.25]]], ([o = 0]) => o / 0.25),
  },
    ...eyeParts(),
    { id: "browL", parent: "feat", order: 53, rect: { x: 150, y: 210, w: 52, h: 20 }, mesh: grid(2, 1), svg: brow, keyed: { params: [], keys: [], forms: [{ opacity: 0.55 }] } },
  ];
  parts.push(mirror(parts.find((p) => p.id === "browL")!));
  return parts;
}

// ---------------------------------------------------------------- hair

export interface HairPalette {
  base: string;
  shade: string;
  light: string;
  line: string;
  /** The front hair's gradient ends. */
  top: string;
  bottom: string;
}

/** The skull: a circle the cap follows, and the parting on it. */
const SKULL = { cx: 220, cy: 238, r: 112 };
const PART: [number, number] = [210, 128];
function bangsPath(TIPS: [number, number][]): string {
  let d = `M${TIPS[0]![0]} ${TIPS[0]![1]}`;
  for (let i = 1; i < TIPS.length; i++) {
    const [x0, y0] = TIPS[i - 1]!;
    const [x1, y1] = TIPS[i]!;
    // Strand edges curve: they leave the valley steeply and reach the tip sideways.
    const down = y1 > y0;
    const cx = down ? x0 + (x1 - x0) * 0.15 : x0 + (x1 - x0) * 0.85;
    const cy = down ? y0 + (y1 - y0) * 0.75 : y0 + (y1 - y0) * 0.25;
    d += ` Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x1} ${y1}`;
  }
  const { cx, cy, r } = SKULL;
  const k = r * 0.5523;
  d += ` C${cx + r + 4} 276 ${cx + r} 254 ${cx + r} ${cy} C${cx + r} ${cy - k} ${cx + k} ${cy - r} ${cx} ${cy - r} C${cx - k} ${cy - r} ${cx - r} ${cy - k} ${cx - r} ${cy} C${cx - r} 254 ${cx - r - 4} 276 ${TIPS[0]![0]} ${TIPS[0]![1]} Z`;
  return d;
}
/** The shine ring: short light dashes along a curve around the skull. */
function ring(): string {
  const out: string[] = [];
  for (let x = 128; x < 308; x += 17) {
    const y = (u: number) => 182 + 30 * ((u - 220) / 112) ** 2;
    const x2 = x + 11;
    out.push(`M${x} ${y(x).toFixed(1)} Q${x + 5.5} ${(y(x + 5.5) - 5).toFixed(1)} ${x2} ${y(x2).toFixed(1)} Q${x + 5.5} ${(y(x + 5.5) + 2).toFixed(1)} ${x} ${y(x).toFixed(1)} Z`);
  }
  return out.join(" ");
}
/** Front hair: skull cap and bangs in one layer, from the strand tips left to right (alternating tips and the valleys between them). */
export function bangsArt(TIPS: [number, number][], HAIR: HairPalette, lw = 1): string {
  const d = bangsPath(TIPS);
  const [px, py] = PART;
  // Strands flow from the parting over the skull to each tip; valleys get short separation lines.
  const strands = TIPS.map(([x, y], i) => {
    if (i === 0 || i === TIPS.length - 1) return "";
    if (i % 2 === 1) return `M${x} ${y} Q${(x + (x - 220) * 0.08).toFixed(1)} ${y - 26} ${(x + (x - 220) * 0.2).toFixed(1)} ${y - 52}`;
    const sx = px + (x - px) * 0.14;
    return `M${sx.toFixed(1)} ${py + 6} Q${(x + (x - 214) * 0.32).toFixed(1)} ${(150 + (y - 150) * 0.42).toFixed(1)} ${x} ${y - 4}`;
  }).join(" ");
  return `
<defs><clipPath id="bc"><path d="${d}"/></clipPath>
<linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${HAIR.top}"/><stop offset="0.45" stop-color="${HAIR.base}"/><stop offset="1" stop-color="${HAIR.bottom}"/></linearGradient></defs>
<path d="${d}" fill="url(#hg)"/>
<g clip-path="url(#bc)">
<path d="M106 238 C108 180 150 136 ${px} 130 C166 154 142 206 138 310 L100 310 Z" fill="${HAIR.shade}" opacity="0.55"/>
<path d="M334 238 C332 200 312 164 290 150 C304 190 306 240 300 310 L340 310 Z" fill="${HAIR.shade}" opacity="0.3"/>
<path d="${ring()}" fill="${HAIR.light}" opacity="0.9"/>
<path d="${strands}" fill="none" ${ln(HAIR.shade, 2 * lw)} opacity="0.85"/>
</g>
<path d="${d}" fill="none" ${ln(HAIR.line, 2.6 * lw)}/>`;
}

// ---------------------------------------------------------------- model

export const PARAMS: ParamDef[] = [
  { id: "AngleX", min: -30, max: 30, def: 0 },
  { id: "AngleY", min: -30, max: 30, def: 0 },
  { id: "AngleZ", min: -30, max: 30, def: 0 },
  { id: "BodyAngleX", min: -10, max: 10, def: 0 },
  { id: "EyeBallX", min: -1, max: 1, def: 0 },
  { id: "EyeBallY", min: -1, max: 1, def: 0 },
  { id: "EyeLOpen", min: 0, max: 1, def: 1 },
  { id: "EyeROpen", min: 0, max: 1, def: 1 },
  { id: "MouthOpen", min: 0, max: 1, def: 0 },
  { id: "Breath", min: 0, max: 1, def: 0 },
  { id: "HairFront", min: -1, max: 1, def: 0 },
  { id: "HairSide", min: -1, max: 1, def: 0 },
  { id: "HairBack", min: -1, max: 1, def: 0 },
  { id: "Ribbon", min: -1, max: 1, def: 0 },
  
];

export const PHYSICS: Pendulum[] = [
  { output: "HairFront", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "AngleZ", weight: 1 / 30 }], stiffness: 45, damping: 6.7, gain: 2.2 },
  { output: "HairSide", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "BodyAngleX", weight: 1 / 10 }], stiffness: 20, damping: 4.5, gain: 1.8 },
  { output: "HairBack", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "BodyAngleX", weight: 1 / 10 }], stiffness: 15, damping: 3.9, gain: 1.6 },
  { output: "Ribbon", inputs: [{ param: "AngleX", weight: 1 / 30 }, { param: "AngleY", weight: 1 / 30 }], stiffness: 28, damping: 4.2, gain: 2 },
  
];

/** A model from the standard rig plus a character's parts (the face included). */
export function model(id: string, parts: Part[]): Model {
  return { id, w: W, h: H, params: PARAMS, deformers: DEFORMERS, parts, physics: PHYSICS };
}

/**
 * Reimu's yin-yang brooch, the worn hitbox: an orb of radius `r` (the
 * collision radius, centred on the collision point) in a gold rim, pinned by a
 * small gold bow clasp with a bail loop on top. Outlined, shaded and with a
 * shine, so it reads as an object at field size. The same item on the
 * portrait and the chibi.
 */
export function brooch(cx: number, cy: number, r: number): string {
  const k = r / 11.5;
  const u = (v: number) => +(v * k).toFixed(2);
  const x = (v: number) => +(cx + v * k).toFixed(2);
  const y = (v: number) => +(cy + v * k).toFixed(2);
  const GOLD = { base: "#ffd24a", shade: "#c8871a", light: "#fff3b0", line: "#5a3508" };
  const g = `br${Math.round(cx)}_${Math.round(cy)}`;
  // The clasp: a gold bow behind the orb, a loop above it, two short tails below.
  const lobe = (s: number) =>
    `<path d="M${x(0)} ${y(-2)} C${x(s * 10)} ${y(-12)} ${x(s * 22)} ${y(-9)} ${x(s * 21)} ${y(0)} C${x(s * 22)} ${y(9)} ${x(s * 10)} ${y(12)} ${x(0)} ${y(2)} Z" fill="${GOLD.base}" ${ln(GOLD.line, u(1.8))}/>
<path d="M${x(s * 14)} ${y(-6)} C${x(s * 18)} ${y(-4)} ${x(s * 19)} ${y(2)} ${x(s * 17)} ${y(5)}" fill="none" ${ln(GOLD.shade, u(1.6))}/>`;
  const tail = (s: number) => `<path d="M${x(s * 4)} ${y(10)} L${x(s * 9)} ${y(21)} L${x(s * 4)} ${y(19)} L${x(s * 1)} ${y(22)} L${x(0)} ${y(10)} Z" fill="${GOLD.shade}" ${ln(GOLD.line, u(1.4))}/>`;
  const R = u(11.5);
  const h = u(5.75);
  return `<defs>
<radialGradient id="${g}s" cx="0.36" cy="0.3" r="0.8"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a0610" stop-opacity="0.45"/></radialGradient>
<linearGradient id="${g}g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${GOLD.light}"/><stop offset="0.45" stop-color="${GOLD.base}"/><stop offset="1" stop-color="${GOLD.shade}"/></linearGradient>
</defs>
${tail(-1)}${tail(1)}${lobe(-1)}${lobe(1)}
<circle cx="${cx}" cy="${y(-15.5)}" r="${u(3.2)}" fill="none" ${ln(GOLD.line, u(3.4))}/>
<circle cx="${cx}" cy="${y(-15.5)}" r="${u(3.2)}" fill="none" ${ln(GOLD.base, u(1.6))}/>
<circle cx="${cx}" cy="${cy}" r="${u(14)}" fill="url(#${g}g)" ${ln(GOLD.line, u(1.8))}/>
<g transform="rotate(-35 ${cx} ${cy})">
<circle cx="${cx}" cy="${cy}" r="${R}" fill="#fbf7f2"/>
<path d="M${cx} ${cy - R} A${R} ${R} 0 0 1 ${cx} ${cy + R} A${h} ${h} 0 0 1 ${cx} ${cy} A${h} ${h} 0 0 0 ${cx} ${cy - R} Z" fill="#d81e36"/>
<circle cx="${cx}" cy="${cy - h}" r="${u(1.9)}" fill="#d81e36"/>
<circle cx="${cx}" cy="${cy + h}" r="${u(1.9)}" fill="#fbf7f2"/>
</g>
<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${g}s)" ${ln("#3a0c14", u(1.3))}/>
<ellipse cx="${x(-4.2)}" cy="${y(-5)}" rx="${u(3.4)}" ry="${u(2)}" fill="#ffffff" opacity="0.9" transform="rotate(-35 ${x(-4.2)} ${y(-5)})"/>
<circle cx="${x(4.5)}" cy="${y(5.5)}" r="${u(1)}" fill="#ffffff" opacity="0.55"/>`;
}
