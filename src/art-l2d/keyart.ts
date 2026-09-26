// Dev-only: the key art (the link preview, the README banner and the 500x300
// thumbnail), drawn from the rigs for scripts/key-art.ts, which imports this
// through the Vite dev server like lab.ts. The game never imports it.
//
// One scene lit as one picture: Reimu under the full moon, the swarm pouring
// out of the far sky toward her, Cirno in her spell circle between. The moon
// behind her puts a warm rim on every edge that faces it (and the ice a cool
// one on the other side of her); the far swarm sinks into the night's colour.
// The title is the title screen's: Shippori Mincho B1 in paper white on a
// hard drop, 幻想郷 over it and the Hakurei seal after it.

import type { Look } from "../art/drawing.ts";
import { ART_L2D } from "./index.ts";
import { renderPoses } from "./lab.ts";
import type { Params } from "./rig.ts";

type Pt = readonly [number, number];
/** A sprite placed in the picture: rig id, x and y as fractions of the frame, scale. */
type Placed = readonly [string, number, number, number];

/** A rim light: the edges that face (dx, dy) catch `color`, `w` px wide, starting `inset` px inside the ink outline. */
interface Rim {
  dx: number;
  dy: number;
  w: number;
  color: string;
  alpha: number;
  inset?: number;
  /** Screen-blended over the sprite (light adds), instead of laid on top. */
  screen?: boolean;
}

/** Where everything goes in one format. Fractions of the frame's width (x) and height (y, sizes). */
export interface KeyArtLayout {
  /** The ground line. */
  horizon: number;
  moon: Pt;
  moonR: number;
  /** Star size. */
  starK: number;
  /** The shrine hall on the hill, its windows lit, and the fireflies round it. */
  hall: { x: number; s: number } | null;
  flies: number;
  /** The seed of the swarm's draws. */
  seed: number;
  /** The far swarm's fog colour, and how far each half of it sinks into it. */
  fog: string;
  fogMix: Pt;
  reimu: { x: number; foot: number; s: number; look: Look; params: Params; rims: Rim[] };
  /** The river of the swarm: a curve out of the far sky, `n` sprites growing from s0 to s1 along it, a glow under it. */
  far: { p0: Pt; p1: Pt; p2: Pt; n: number; s0: number; s1: number; glow: { color: string; a: number } };
  cirno: { x: number; y: number; s: number; rings: number };
  /** Fairies round Cirno: offsets from her (in frame heights) and scale. */
  mid: (readonly [number, number, number])[];
  /** Daiyousei beside her, the same way. */
  dai: readonly [number, number, number] | null;
  /** The head of the swarm, round Reimu; the first is struck by her ofuda, the rest fire at her. */
  near: Placed[];
  shots: boolean;
  /** A second stream of ofuda, at Cirno. */
  atCirno: boolean;
  /** Behind her at the frame's edge: she is surrounded. */
  behind: Placed[];
  /** Gems drawn home to her along a curve. */
  gems: readonly [Pt, Pt, Pt] | null;
  /** Her yin-yang orbs: x, y, radius, turn. */
  orbs: (readonly [number, number, number, number])[];
  orbGlow: number;
  title: { x: number; y: number; size: number; sub: string | null };
}

const FONT = "Shippori Mincho B1";
const FONT_FILES = "/node_modules/@fontsource/shippori-mincho-b1/files/shippori-mincho-b1";

const C = { paper: "#f6f0e1", ink: "#1b1512", red: "#e0314b", straw: "#d6c48c", drop: "#6a0f1f", night: "#0c0917" };

const POSE = { look: { x: -0.7, y: -0.05 }, params: { EyeLOpen: 0.86, EyeROpen: 0.86, HairFront: 0.5, HairSide: 0.8, HairBack: 0.8, Ribbon: 0.8, SleeveSway: 0.6, Shide: 1 } };
/** The moon's warm rim from behind her, up and to the right, and the ice's cool one from the left. */
const RIMS: Rim[] = [
  { dx: 0.6, dy: -1, w: 5, color: "#ffe9b0", alpha: 0.95, inset: 2.2, screen: true },
  { dx: -1, dy: -0.2, w: 3, color: "#7fcfff", alpha: 0.7, inset: 2.2, screen: true },
];

/** 1200x630 (the link preview) and 1280x640 (the README banner, GitHub's social preview). */
const WIDE: KeyArtLayout = {
  horizon: 0.87,
  moon: [0.8, 0.34],
  moonR: 0.255,
  starK: 1,
  hall: { x: 0.1, s: 0.8 },
  flies: 9,
  seed: 9,
  fog: "#141030",
  fogMix: [0.68, 0.8],
  reimu: { x: 0.8, foot: 1.02, s: 1, ...POSE, rims: RIMS },
  far: { p0: [-0.03, 0.26], p1: [0.12, -0.02], p2: [0.4, 0.14], n: 90, s0: 0.055, s1: 0.15, glow: { color: "#8c7cd8", a: 0.22 } },
  cirno: { x: 0.5, y: 0.2, s: 0.42, rings: 2 },
  mid: [
    [-0.3, -0.02, 0.17],
    [-0.24, 0.1, 0.16],
    [-0.17, -0.12, 0.15],
    [0.2, -0.12, 0.16],
    [0.26, 0.02, 0.17],
    [-0.36, 0.17, 0.15],
    [0.12, 0.16, 0.15],
  ],
  dai: [-0.2, 0.2, 0.25],
  near: [
    ["fairy.sprite", 0.585, 0.36, 0.34],
    ["kedama.sprite", 0.655, 0.16, 0.26],
    ["sunflower.sprite", 0.58, 0.63, 0.36],
    ["icefairy.sprite", 0.46, 0.46, 0.27],
    ["fairy.sprite", 0.615, 0.86, 0.33],
    ["phantom.sprite", 0.44, 0.74, 0.22],
  ],
  shots: true,
  atCirno: true,
  behind: [["kedama.sprite", 0.975, 0.14, 0.22]],
  gems: [
    [0.36, 0.97],
    [0.5, 0.74],
    [0.66, 0.67],
  ],
  orbs: [
    [0.655, 0.58, 0.058, -25],
    [0.71, 0.87, 0.04, 60],
  ],
  orbGlow: 0.3,
  title: { x: 0.05, y: 0.34, size: 0.13, sub: "～ a shrine maiden versus the whole of Gensokyo" },
};

/** 500x300: fewer, bigger things; the title larger and no subtitle; her whole gohei inside the frame. */
const THUMB: KeyArtLayout = {
  ...WIDE,
  moon: [0.772, 0.37],
  moonR: 0.285,
  starK: 0.7,
  hall: { x: 0.12, s: 0.9 },
  flies: 5,
  reimu: { x: 0.772, foot: 1.07, s: 1.06, ...POSE, rims: RIMS.map((r) => ({ ...r, w: r.w * 1.2, inset: (r.inset ?? 0) * 1.2 })) },
  far: { p0: [0, 0.16], p1: [0.18, 0], p2: [0.4, 0.12], n: 14, s0: 0.12, s1: 0.2, glow: { color: "#8c7cd8", a: 0.2 } },
  cirno: { x: 0.53, y: 0.2, s: 0.6, rings: 1 },
  mid: [
    [-0.28, 0.02, 0.24],
    [-0.17, -0.13, 0.22],
  ],
  dai: null,
  near: [],
  shots: false,
  behind: [],
  gems: null,
  orbs: [[0.655, 0.8, 0.07, -25]],
  title: { x: 0.05, y: 0.33, size: 0.16, sub: null },
};

export const KEY_ART_LAYOUTS: Record<string, KeyArtLayout> = { wide: WIDE, thumb: THUMB };

// ---------------------------------------------------------------- helpers

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** A point on the quadratic curve p0, p1, p2. */
function qpt(p0: Pt, p1: Pt, p2: Pt, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The picture being drawn: its stage element and pixel ratio. */
interface Canvas {
  stage: HTMLElement;
  dpr: number;
}

function el<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, style: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.position = "absolute";
  for (const [k, v] of Object.entries(style)) e.style.setProperty(k, v);
  parent.appendChild(e);
  return e;
}
/** A full-frame SVG layer at depth `z`. */
function svgLayer(cv: Canvas, W: number, H: number, inner: string, z: number): void {
  const d = el(cv.stage, "div", { left: "0px", top: "0px", width: `${W}px`, height: `${H}px`, "z-index": String(z) });
  d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;overflow:visible">${inner}</svg>`;
}
/** Filters shared by the sprites, referenced from CSS as url(#id). */
function defs(cv: Canvas, inner: string): void {
  const d = el(cv.stage, "div", { width: "0px", height: "0px", overflow: "hidden" });
  d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><defs>${inner}</defs></svg>`;
}

// ---------------------------------------------------------------- light

interface Light {
  rims: Rim[];
  /** The night's ambient, multiplied into the sprite's colour first. */
  amb: readonly [number, number, number];
  /** Depth: how far the sprite sinks toward `fog`. */
  fog?: string;
  mix?: number;
  blur?: number;
}
function lightFilter(id: string, { rims, amb, fog, mix = 0, blur = 0 }: Light): string {
  const f = fog ? hex(fog) : [0, 0, 0];
  const k = 1 - mix;
  const m = `${amb[0] * k} 0 0 0 ${f[0]! * mix}  0 ${amb[1] * k} 0 0 ${f[1]! * mix}  0 0 ${amb[2] * k} 0 ${f[2]! * mix}  0 0 0 1 0`;
  const parts = rims.map((r, i) => {
    const len = Math.hypot(r.dx, r.dy) || 1;
    const ox = (-r.dx / len) * r.w;
    const oy = (-r.dy / len) * r.w;
    // Inset, the rim starts inside the ink outline, so the line art stays crisp and dark.
    const src = r.inset ? `ins${i}` : "SourceAlpha";
    return `${r.inset ? `<feMorphology in="SourceAlpha" operator="erode" radius="${r.inset.toFixed(2)}" result="ins${i}"/>` : ""}
    <feOffset in="${src}" dx="${ox.toFixed(2)}" dy="${oy.toFixed(2)}" result="off${i}"/>
    <feComposite in="${src}" in2="off${i}" operator="out" result="edge${i}"/>
    <feGaussianBlur in="edge${i}" stdDeviation="${Math.max(0.3, r.w * 0.3).toFixed(2)}" result="soft${i}"/>
    <feComposite in="soft${i}" in2="${src}" operator="in" result="rim${i}"/>
    <feFlood flood-color="${r.color}" flood-opacity="${r.alpha}"/>
    <feComposite in2="rim${i}" operator="in" result="rimc${i}"/>`;
  });
  const merge = rims.some((r) => r.screen)
    ? rims.reduce((acc, _, i) => `${acc}<feBlend in="rimc${i}" in2="${i ? `sc${i - 1}` : "lit"}" mode="screen" result="sc${i}"/>`, "") + `<feComposite in="sc${rims.length - 1}" in2="SourceAlpha" operator="in" result="out"/>`
    : `<feMerge result="out"><feMergeNode in="lit"/>${rims.map((_, i) => `<feMergeNode in="rimc${i}"/>`).join("")}</feMerge>`;
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="${m}" result="lit"/>
    ${parts.join("")}
    ${merge}
    ${blur ? `<feGaussianBlur in="out" stdDeviation="${blur}"/>` : ""}
  </filter>`;
}

// ---------------------------------------------------------------- rigs

interface RigImage {
  url: string;
  w: number;
  h: number;
  pad: number;
}
const cache = new Map<string, RigImage>();
/** A rig rendered once in a pose, `scale` CSS px per model unit, `pad` model units of room round its box. */
async function rigImage(cv: Canvas, id: string, look: Look | undefined, params: Params | undefined, scale: number, pad: number): Promise<RigImage> {
  const key = JSON.stringify([id, look, params, scale, pad, cv.dpr]);
  const hit = cache.get(key);
  if (hit) return hit;
  const [who, kind] = id.split(".");
  const set = ART_L2D[who!];
  const model = kind === "sprite" || !set?.portrait ? set?.sprite?.model : set.portrait;
  if (!model) throw new Error(`no model ${id}`);
  // The padding draws a swung streamer or strand past the model's box instead of cutting it.
  const crop = pad ? { x: -pad, y: -pad, w: model.w + 2 * pad, h: model.h + 2 * pad } : undefined;
  const [url] = await renderPoses(id, [{ look, params }], scale * cv.dpr, crop);
  const r = { url: url!, w: model.w * scale, h: model.h * scale, pad: pad * scale };
  cache.set(key, r);
  return r;
}

interface Put {
  x: number;
  y: number;
  scale: number;
  /** Render at this scale and size down to `scale` (far ones share one render). */
  rs?: number;
  look?: Look;
  params?: Params;
  filter?: string;
  z: number;
  /** The point of the model's box at (x, y). */
  anchor?: Pt;
  /** Where down the model's box it fades out. */
  fade?: Pt;
  pad?: number;
}
interface Placement {
  url: string;
  left: number;
  top: number;
  w: number;
  h: number;
  pad: number;
}
async function put(cv: Canvas, id: string, { x, y, scale, rs, look, params, filter = "", z, anchor = [0.5, 0.5], fade, pad = 0 }: Put): Promise<Placement> {
  const r = await rigImage(cv, id, look, params, rs ?? scale, pad);
  const k = scale / (rs ?? scale);
  // The anchor is on the model's own box; the image is that box grown by the padding on every side.
  const p = r.pad * k;
  const w = r.w * k + 2 * p;
  const h = r.h * k + 2 * p;
  const left = x - r.w * k * anchor[0] - p;
  const top = y - r.h * k * anchor[1] - p;
  const img = el(cv.stage, "img", { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px`, "z-index": String(z), filter, opacity: "1", transform: "rotate(0deg)" });
  if (fade) img.style.setProperty("mask-image", `linear-gradient(to bottom, #000 ${(((p + fade[0] * r.h * k) / h) * 100).toFixed(2)}%, transparent ${(((p + fade[1] * r.h * k) / h) * 100).toFixed(2)}%)`);
  img.src = r.url;
  await img.decode();
  return { url: r.url, left, top, w, h, pad: p };
}

// ---------------------------------------------------------------- drawings

function yinyang(cx: number, cy: number, r: number, rot: number, glow: number): string {
  const id = `yy${Math.round(cx * 7 + cy * 13 + r * 17)}`;
  return `<g transform="translate(${cx} ${cy}) rotate(${rot})">
    <defs>
      <radialGradient id="${id}s" cx="0.34" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="0.42" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#2a0710" stop-opacity="0.38"/></radialGradient>
      <radialGradient id="${id}g" cx="0.5" cy="0.5" r="0.5"><stop offset="0.5" stop-color="#ff5a6e" stop-opacity="0.5"/><stop offset="1" stop-color="#ff5a6e" stop-opacity="0"/></radialGradient>
    </defs>
    ${glow ? `<circle r="${r * (1 + glow * 1.2)}" fill="url(#${id}g)"/>` : ""}
    <circle r="${r + Math.max(1, r * 0.07)}" fill="${C.ink}" opacity="0.85"/>
    <circle r="${r}" fill="#fbf7ef"/>
    <path d="M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${r / 2} ${r / 2} 0 0 1 0 0 A${r / 2} ${r / 2} 0 0 0 0 ${-r} Z" fill="${C.red}"/>
    <circle cy="${-r / 2}" r="${r / 6}" fill="#fbf7ef"/>
    <circle cy="${r / 2}" r="${r / 6}" fill="${C.red}"/>
    <circle r="${r}" fill="url(#${id}s)"/>
  </g>`;
}
/** An ofuda `l` long flying along `ang` degrees, a pale trail behind it. */
function ofuda(cx: number, cy: number, l: number, ang: number, trail: number): string {
  const w = l * 0.42;
  const sw = Math.max(0.6, l * 0.025);
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})" opacity="1">
    ${trail ? `<path d="M${-l / 2 - trail} 0 L${-l / 2} ${-w * 0.36} L${-l / 2} ${w * 0.36} Z" fill="url(#trail)"/>` : ""}
    <rect x="${-l / 2}" y="${-w / 2}" width="${l}" height="${w}" fill="${C.paper}" stroke="${C.ink}" stroke-opacity="0.55" stroke-width="${sw}"/>
    <rect x="${-l / 2 + l * 0.07}" y="${-w / 2 + w * 0.14}" width="${l * 0.86}" height="${w * 0.72}" fill="none" stroke="${C.red}" stroke-width="${Math.max(0.8, l * 0.05)}"/>
    <rect x="${-l * 0.12}" y="${-w * 0.2}" width="${l * 0.24}" height="${w * 0.4}" fill="${C.red}"/>
    <line x1="${-l * 0.36}" x2="${-l * 0.2}" y1="0" y2="0" stroke="${C.ink}" stroke-width="${Math.max(0.5, l * 0.03)}" opacity="0.7"/>
    <line x1="${l * 0.2}" x2="${l * 0.36}" y1="0" y2="0" stroke="${C.ink}" stroke-width="${Math.max(0.5, l * 0.03)}" opacity="0.7"/>
  </g>`;
}
/** One of Cirno's ice shards. */
function ice(cx: number, cy: number, r: number, ang: number, alpha: number): string {
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})" opacity="${alpha}">
    <path d="M${-r * 1.4} 0 L0 ${-r * 0.6} L${r * 1.4} 0 L0 ${r * 0.6} Z" fill="#9fe4ff" opacity="0.22"/>
    <path d="M${-r} 0 L0 ${-r * 0.45} L${r} 0 L0 ${r * 0.45} Z" fill="#7fd6ff"/>
    <path d="M${-r * 0.55} 0 L0 ${-r * 0.2} L${r * 0.55} 0 L0 ${r * 0.2} Z" fill="#f4fdff"/>
  </g>`;
}
/** A rice bullet. */
function rice(cx: number, cy: number, r: number, ang: number, color: string): string {
  return `<g transform="translate(${cx} ${cy}) rotate(${ang})">
    <ellipse rx="${r * 1.6}" ry="${r * 0.95}" fill="${color}" opacity="0.2"/>
    <ellipse rx="${r}" ry="${r * 0.55}" fill="${color}"/>
    <ellipse rx="${r * 0.6}" ry="${r * 0.28}" fill="#fff"/>
  </g>`;
}
/** An experience gem, as the field draws them: blue, green or red by tier. */
function gem(cx: number, cy: number, s: number, tier: number): string {
  const [base, lit, dark] = ([["#4d8fe8", "#a9ccff", "#1f4589"], ["#4aa66a", "#a4e6b8", "#1a4f2e"], ["#d0454c", "#ffaaa6", "#6e161c"]] as const)[tier]!;
  const o = s / 2;
  const i = o * 0.48;
  return `<g transform="translate(${cx} ${cy}) rotate(45)">
    <rect x="${-o - 1}" y="${-o - 1}" width="${2 * o + 2}" height="${2 * o + 2}" fill="#0b0a14" opacity="0.5"/>
    <rect x="${-o}" y="${-o}" width="${2 * o}" height="${2 * o}" fill="${base}"/>
    <path d="M${-o} ${-o} L${o} ${-o} L${i} ${-i} L${-i} ${-i} Z" fill="${lit}" opacity="0.85"/>
    <path d="M${-o} ${-o} L${-i} ${-i} L${-i} ${i} L${-o} ${o} Z" fill="${lit}" opacity="0.4"/>
    <path d="M${o} ${-o} L${o} ${o} L${i} ${i} L${i} ${-i} Z" fill="${dark}" opacity="0.6"/>
    <path d="M${-o} ${o} L${-i} ${i} L${i} ${i} L${o} ${o} Z" fill="${dark}" opacity="0.9"/>
  </g>`;
}
/** The flash of a hit. */
function burst(cx: number, cy: number, r: number): string {
  let rays = "";
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const l = r * (i % 2 ? 0.8 : 1.35);
    rays += `<path d="M${cx + Math.cos(a - 0.18) * r * 0.25} ${cy + Math.sin(a - 0.18) * r * 0.25} L${cx + Math.cos(a) * l} ${cy + Math.sin(a) * l} L${cx + Math.cos(a + 0.18) * r * 0.25} ${cy + Math.sin(a + 0.18) * r * 0.25} Z" fill="#fff" opacity="0.9"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r * 0.9}" fill="#fff" opacity="0.16"/><circle cx="${cx}" cy="${cy}" r="${r * 0.42}" fill="#fff" opacity="0.85"/>${rays}`;
}
/** A spell circle: two rings, a hexagram, twelve studs. */
function magicCircle(cx: number, cy: number, r: number, color: string, alpha: number, rot: number): string {
  const pts = Array.from({ length: 6 }, (_, i): Pt => [Math.cos((i / 6) * Math.PI * 2) * r * 0.87, Math.sin((i / 6) * Math.PI * 2) * r * 0.87]);
  const tri = (a: Pt[]): string => `M${a.map((p) => p.join(" ")).join(" L")} Z`;
  const dots = Array.from({ length: 12 }, (_, i) => `<circle cx="${Math.cos((i / 12) * Math.PI * 2) * r * 0.935}" cy="${Math.sin((i / 12) * Math.PI * 2) * r * 0.935}" r="${r * 0.028}" fill="${color}" stroke="none"/>`).join("");
  return `<g transform="translate(${cx} ${cy}) scale(1 1) rotate(${rot})" opacity="${alpha}" fill="none" stroke="${color}">
    <circle r="${r * 1.02}" stroke-width="${r * 0.05}" opacity="0.25"/>
    <circle r="${r}" stroke-width="${r * 0.028}"/>
    <circle r="${r * 0.87}" stroke-width="${r * 0.014}"/>
    <path d="${tri([pts[0]!, pts[2]!, pts[4]!])}" stroke-width="${r * 0.02}"/>
    <path d="${tri([pts[1]!, pts[3]!, pts[5]!])}" stroke-width="${r * 0.02}"/>
    ${dots}
  </g>`;
}
/** The Hakurei seal, a worn vermilion stamp of 博麗, 100 units across at scale 100. */
function seal(x: number, y: number, s: number, rot = -7): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s / 100})">
    <defs><filter id="hsink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="4"/></filter></defs>
    <g filter="url(#hsink)" opacity="0.95">
      <rect x="-45" y="-45" width="90" height="90" rx="7" fill="#c8352a"/>
      <rect x="-37" y="-37" width="74" height="74" rx="3" fill="none" stroke="${C.paper}" stroke-width="3" opacity="0.8"/>
      <text x="0" y="-3" text-anchor="middle" font-size="37" font-weight="800" fill="${C.paper}" font-family="${FONT}">博</text>
      <text x="0" y="31" text-anchor="middle" font-size="37" font-weight="800" fill="${C.paper}" font-family="${FONT}">麗</text>
    </g>
  </g>`;
}

// ---------------------------------------------------------------- the night

function skyLayer(W: number, H: number, L: KeyArtLayout): string {
  const r = rng(20240917);
  const hz = H * L.horizon;
  const M: Pt = [W * L.moon[0], H * L.moon[1]];
  const mr = H * L.moonR;
  let stars = "";
  const n = Math.round((W * H) / 3800);
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = r() * hz * 0.92;
    const d = Math.hypot(x - M[0], y - M[1]) / mr;
    const rad = (0.45 + r() ** 3 * 1.7) * L.starK;
    const o = (0.25 + r() * 0.65) * Math.min(1, Math.max(0, (d - 1.2) / 1.6)) * (1 - (y / hz) * 0.5);
    if (o < 0.04) continue;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="#fff6e0" opacity="${o.toFixed(2)}"/>`;
  }
  // A few bright ones with a cross glint.
  for (let i = 0; i < 5; i++) {
    const x = r() * W * 0.62;
    const y = r() * hz * 0.5;
    const s = (3 + r() * 3) * L.starK;
    stars += `<g opacity="${0.5 + r() * 0.4}"><circle cx="${x}" cy="${y}" r="${s * 0.35}" fill="#fff6e0"/><path d="M${x - s * 1.6} ${y} L${x + s * 1.6} ${y} M${x} ${y - s * 1.6} L${x} ${y + s * 1.6}" stroke="#fff6e0" stroke-width="${0.6 * L.starK}" opacity="0.7"/></g>`;
  }
  // The moon: disc, faint maria, a halo; thin clouds across its lower half.
  const mar = rng(3);
  let maria = "";
  const seas: Array<readonly [number, number, number]> = [
    [-0.28, -0.18, 0.3],
    [0.12, -0.3, 0.22],
    [0.24, 0.1, 0.26],
    [-0.1, 0.26, 0.2],
    [-0.44, 0.12, 0.14],
    [0.42, -0.06, 0.12],
  ];
  for (const [dx, dy, s] of seas) {
    maria += `<ellipse cx="${M[0] + dx * mr}" cy="${M[1] + dy * mr}" rx="${s * mr}" ry="${s * mr * (0.7 + mar() * 0.3)}" fill="#c4a672" opacity="${0.1 + mar() * 0.07}"/>`;
  }
  return `<defs>
      <linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#060918"/>
        <stop offset="${(0.42 * hz) / H}" stop-color="#111634"/>
        <stop offset="${(0.66 * hz) / H}" stop-color="#261f48"/>
        <stop offset="${(0.82 * hz) / H}" stop-color="#553252"/>
        <stop offset="${(0.93 * hz) / H}" stop-color="#9a5650"/>
        <stop offset="${hz / H}" stop-color="#c8805a"/>
        <stop offset="1" stop-color="#c8805a"/>
      </linearGradient>
      <radialGradient id="moonHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0.28" stop-color="#ffe6b0" stop-opacity="0.75"/><stop offset="0.55" stop-color="#ffd890" stop-opacity="0.18"/><stop offset="1" stop-color="#ffd890" stop-opacity="0"/></radialGradient>
      <radialGradient id="moonFace" cx="0.4" cy="0.36" r="0.7"><stop offset="0" stop-color="#fdf4dc"/><stop offset="0.7" stop-color="#f2e2b8"/><stop offset="1" stop-color="#e2c894"/></radialGradient>
      <clipPath id="moonClip"><circle cx="${M[0]}" cy="${M[1]}" r="${mr}"/></clipPath>
      <linearGradient id="trail" x1="0" x2="1"><stop offset="0" stop-color="#ffe0e6" stop-opacity="0"/><stop offset="1" stop-color="#ffe0e6" stop-opacity="0.6"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#skyg)"/>
    ${stars}
    <circle cx="${M[0]}" cy="${M[1]}" r="${mr * 2.6}" fill="url(#moonHalo)" opacity="0.55"/>
    <circle cx="${M[0]}" cy="${M[1]}" r="${mr}" fill="url(#moonFace)"/>
    <g clip-path="url(#moonClip)">${maria}</g>
    ${wisps(M, mr)}`;
}

/** Thin clouds drifting across the lower moon: long soft streaks, dark on the disc, their top edges catching its light. */
function wisps(M: Pt, mr: number): string {
  const bands: Array<readonly [number, number, number, number]> = [
    [-0.25, 0.42, 1.7, 0.07],
    [0.35, 0.58, 1.35, 0.055],
    [-0.5, 0.74, 1.1, 0.045],
    [0.6, 0.3, 0.8, 0.035],
  ];
  let dark = "";
  let lit = "";
  for (const [dx, dy, w, h] of bands) {
    const cx = M[0] + dx * mr;
    const cy = M[1] + dy * mr;
    dark += `<ellipse cx="${cx}" cy="${cy}" rx="${w * mr}" ry="${h * mr}"/>`;
    lit += `<ellipse cx="${cx}" cy="${cy - h * mr * 0.55}" rx="${w * mr * 0.8}" ry="${h * mr * 0.35}"/>`;
  }
  return `<defs>
      <filter id="wb" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="${(mr * 0.025).toFixed(2)}"/></filter>
      <filter id="wb2" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="${(mr * 0.012).toFixed(2)}"/></filter>
      <radialGradient id="wl" cx="${M[0]}" cy="${M[1]}" r="${mr * 1.25}" gradientUnits="userSpaceOnUse"><stop offset="0.6" stop-color="#fff1cc" stop-opacity="0.55"/><stop offset="1" stop-color="#fff1cc" stop-opacity="0"/></radialGradient>
    </defs>
    <g filter="url(#wb)" fill="#1b1636" opacity="0.88">${dark}</g>
    <g filter="url(#wb2)" fill="url(#wl)">${lit}</g>`;
}

/** Two ranges of hills, the shrine hall on the near one with its windows lit, the ground, fireflies. */
function landLayer(W: number, H: number, L: KeyArtLayout): string {
  const hz = H * L.horizon;
  const k = H / 900;
  let s = `<path d="M0 ${hz - 70 * k} C${W * 0.11} ${hz - 125 * k} ${W * 0.2} ${hz - 100 * k} ${W * 0.29} ${hz - 140 * k} C${W * 0.39} ${hz - 172 * k} ${W * 0.47} ${hz - 118 * k} ${W * 0.56} ${hz - 148 * k} C${W * 0.66} ${hz - 180 * k} ${W * 0.76} ${hz - 128 * k} ${W * 0.86} ${hz - 158 * k} C${W * 0.93} ${hz - 172 * k} ${W * 0.97} ${hz - 158 * k} ${W} ${hz - 150 * k} L${W} ${H} L0 ${H} Z" fill="#221a38"/>`;
  s += `<path d="M0 ${hz} C${W * 0.04} ${hz - 64 * k} ${W * 0.06} ${hz - 44 * k} ${W * 0.075} ${hz - 74 * k} C${W * 0.095} ${hz - 44 * k} ${W * 0.12} ${hz - 84 * k} ${W * 0.145} ${hz - 62 * k} C${W * 0.175} ${hz - 104 * k} ${W * 0.21} ${hz - 64 * k} ${W * 0.24} ${hz - 74 * k} L${W * 0.265} ${hz} Z M${W * 0.62} ${hz} C${W * 0.65} ${hz - 74 * k} ${W * 0.68} ${hz - 64 * k} ${W * 0.71} ${hz - 94 * k} C${W * 0.74} ${hz - 74 * k} ${W * 0.78} ${hz - 104 * k} ${W * 0.81} ${hz - 74 * k} C${W * 0.85} ${hz - 94 * k} ${W * 0.89} ${hz - 64 * k} ${W * 0.93} ${hz - 74 * k} C${W * 0.96} ${hz - 64 * k} ${W * 0.99} ${hz - 74 * k} ${W} ${hz - 64 * k} L${W} ${hz} Z" fill="#161126"/>`;
  if (L.hall) {
    const { x, s: sc } = L.hall;
    s += `<g transform="translate(${W * x} ${hz}) scale(${sc * k}) translate(-1160 -760)" fill="#110d1e">
      <path d="M1010 650 Q1090 640 1160 580 Q1230 640 1310 650 L1296 662 L1024 662 Z"/>
      <rect x="1052" y="662" width="216" height="98"/>
      <rect x="1140" y="690" width="40" height="50" fill="#ffb46a" opacity="0.32"/>
      <rect x="1080" y="690" width="30" height="36" fill="#ffb46a" opacity="0.2"/>
      <rect x="1210" y="690" width="30" height="36" fill="#ffb46a" opacity="0.2"/>
    </g>`;
  }
  s += `<rect x="0" y="${hz}" width="${W}" height="${H - hz}" fill="${C.night}"/>`;
  if (L.hall) {
    const gx = W * L.hall.x;
    const gy = hz - 45 * L.hall.s * k;
    s += `<defs><radialGradient id="hg"><stop offset="0" stop-color="#ffb46a" stop-opacity="0.22"/><stop offset="1" stop-color="#ffb46a" stop-opacity="0"/></radialGradient></defs><ellipse cx="${gx}" cy="${gy}" rx="${170 * L.hall.s * k}" ry="${110 * L.hall.s * k}" fill="url(#hg)"/>`;
  }
  if (L.flies) {
    const q = rng(31);
    s += `<defs><radialGradient id="ff"><stop offset="0" stop-color="#ffe7a0" stop-opacity="0.9"/><stop offset="0.35" stop-color="#ffe7a0" stop-opacity="0.35"/><stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/></radialGradient></defs>`;
    for (let i = 0; i < L.flies; i++) {
      const x = W * (0.02 + q() * 0.55);
      const y = hz + (q() - 0.75) * H * 0.16;
      const r = H * (0.012 + q() * 0.01);
      s += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#ff)" opacity="${0.5 + q() * 0.5}"/>`;
    }
  }
  return s;
}

// ---------------------------------------------------------------- the title

function titleBlock(cv: Canvas, W: number, H: number, L: KeyArtLayout): HTMLElement {
  const size = H * L.title.size;
  const box = el(cv.stage, "div", { left: `${W * L.title.x}px`, top: `${H * L.title.y}px`, "z-index": "60", "text-align": "left" });
  const d = Math.max(2, size * 0.055);
  const kanji = el(box, "div", { position: "relative", font: `800 ${size * 0.3}px/1 "${FONT}"`, "letter-spacing": "0.9em", color: C.straw, "margin-bottom": `${size * 0.16}px`, "text-shadow": `0 ${d * 0.6}px 0 rgba(20,8,12,.85)` });
  kanji.textContent = "幻想郷";
  const lines = ["Gensokyo", "Survivors"];
  lines.forEach((t, i) => {
    const l = el(box, "div", { position: "relative", font: `700 ${size}px/1.02 "${FONT}"`, color: C.paper, "letter-spacing": "0.02em", "white-space": "nowrap", "text-shadow": `0 ${d}px 0 ${C.drop}, 0 0 ${size * 0.5}px rgba(6,9,24,.55)` });
    l.textContent = t;
    if (i === lines.length - 1) {
      const s = size * 0.8;
      const sd = el(l, "span", { position: "relative", display: "inline-block", width: `${s}px`, height: `${s}px`, "margin-left": `${size * 0.14}px`, "vertical-align": `${size * 0.1}px` });
      sd.innerHTML = `<svg viewBox="-50 -50 100 100" width="${s}" height="${s}" style="display:block;overflow:visible">${seal(0, 0, 100)}</svg>`;
    }
  });
  if (L.title.sub) {
    const s = el(box, "div", { position: "relative", font: `italic 700 ${size * 0.26}px/1.3 "${FONT}"`, color: C.straw, "margin-top": `${size * 0.2}px`, "letter-spacing": "0.03em", "white-space": "nowrap", "text-shadow": `0 ${d * 0.5}px 0 rgba(20,8,12,.9), 0 0 ${size * 0.3}px rgba(6,9,24,.8)` });
    s.textContent = L.title.sub;
  }
  return box;
}

// ---------------------------------------------------------------- the scene

const FAIRIES = ["fairy.sprite", "icefairy.sprite", "sunflower.sprite", "fairy.sprite", "duskfairy.sprite", "kedama.sprite", "fairy.sprite", "icefairy.sprite", "phantom.sprite", "kedama.sprite", "bigfairy.sprite"];

async function scene(cv: Canvas, W: number, H: number, L: KeyArtLayout): Promise<void> {
  const K = H / 630;
  // The title first: the swarm keeps out of its box.
  const tb = titleBlock(cv, W, H, L).getBoundingClientRect();
  const st = cv.stage.getBoundingClientRect();
  const pad = H * 0.03;
  const keep = { x0: tb.left - st.left - pad, y0: tb.top - st.top - pad, x1: tb.right - st.left + pad * 2, y1: tb.bottom - st.top + pad };
  const clear = (x: number, y: number, half: number): boolean => x + half < keep.x0 || x - half > keep.x1 || y + half < keep.y0 || y - half > keep.y1;
  const face: Pt = [W * L.reimu.x, H * 0.47];
  defs(
    cv,
    lightFilter("rimReimu", { rims: L.reimu.rims.map((r) => ({ ...r, w: r.w * K })), amb: [0.95, 0.94, 1.02] }) +
      lightFilter("rimNear", { rims: [{ dx: 1, dy: -0.6, w: 1.8 * K, color: "#ffe7b4", alpha: 0.85 }], amb: [0.9, 0.9, 1] }) +
      lightFilter("rimMid", { rims: [{ dx: 1, dy: -0.4, w: 1.2 * K, color: "#ffe7b4", alpha: 0.6 }], amb: [0.8, 0.8, 0.95], fog: "#20193e", mix: 0.32 }) +
      lightFilter("far", { rims: [{ dx: 1, dy: -0.3, w: 0.8, color: "#ffe7b4", alpha: 0.35 }], amb: [0.7, 0.7, 0.9], fog: L.fog, mix: L.fogMix[0], blur: 0.35 * K }) +
      lightFilter("far2", { rims: [{ dx: 1, dy: -0.3, w: 0.6, color: "#ffe7b4", alpha: 0.25 }], amb: [0.6, 0.6, 0.85], fog: L.fog, mix: L.fogMix[1], blur: 0.5 * K }),
  );
  svgLayer(cv, W, H, skyLayer(W, H, L) + landLayer(W, H, L), 0);

  const r = rng(L.seed);
  const pick = (): string => FAIRIES[Math.floor(r() * FAIRIES.length)]!;
  // Everyone in the swarm looks at her.
  const lookAt = (x: number, y: number): Look => ({ x: Math.max(-1, Math.min(1, ((face[0] - x) / (W * 0.25)) * 0.9)), y: Math.max(-0.6, Math.min(0.6, (face[1] - y) / (H * 0.6))) });
  const sprite = async (id: string, x: number, y: number, sc: number, filter: string, z: number, params?: Params): Promise<void> => {
    if (!clear(x, y, sc * K * 70)) return;
    await put(cv, id, { x, y, scale: sc * K, rs: sc < 0.22 ? 0.22 * K : undefined, look: lookAt(x, y), filter, z, params });
  };

  // Far: the river of the swarm pouring out of the far sky, sunk in the night's colour.
  const { p0, p1, p2, n, s0, s1, glow } = L.far;
  const P0: Pt = [W * p0[0], H * p0[1]];
  const P1: Pt = [W * p1[0], H * p1[1]];
  const P2: Pt = [W * p2[0], H * p2[1]];
  const path = `M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`;
  svgLayer(
    cv,
    W,
    H,
    `<defs>
      <filter id="rg" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}"><feGaussianBlur stdDeviation="${H * 0.03}"/></filter>
      <filter id="rg2" filterUnits="userSpaceOnUse" x="${-W}" y="${-H}" width="${W * 3}" height="${H * 3}"><feGaussianBlur stdDeviation="${H * 0.008}"/></filter>
      <linearGradient id="rgg" gradientUnits="userSpaceOnUse" x1="${P0[0]}" y1="${P0[1]}" x2="${P2[0]}" y2="${P2[1]}"><stop offset="0" stop-color="${glow.color}" stop-opacity="0"/><stop offset="0.45" stop-color="${glow.color}" stop-opacity="${glow.a}"/><stop offset="1" stop-color="${glow.color}" stop-opacity="${glow.a * 1.4}"/></linearGradient>
    </defs>
    <path d="${path}" fill="none" stroke="url(#rgg)" stroke-width="${H * 0.14}" stroke-linecap="round" filter="url(#rg)"/>
    <path d="${path}" fill="none" stroke="url(#rgg)" stroke-width="${H * 0.03}" stroke-linecap="round" filter="url(#rg2)" opacity="0.6"/>`,
    4,
  );
  const river: { x: number; y: number; t: number; id: string }[] = [];
  for (let i = 0; i < n; i++) {
    const t = r();
    const [x, y] = qpt(P0, P1, P2, t);
    const spread = H * (0.018 + t * 0.06);
    const jx = (r() - 0.5) * spread * 2.2;
    const jy = (r() - 0.5) * spread * 1.3;
    river.push({ x: x + jx, y: y + jy, t, id: pick() });
  }
  river.sort((a, b) => a.t - b.t);
  for (const p of river) await sprite(p.id, p.x, p.y, lerp(s0, s1, p.t), p.t < 0.5 ? "url(#far2)" : "url(#far)", 5);

  // Mid: Cirno in her spell circle, a crowd round her, her ice in rings.
  const cz: Pt = [W * L.cirno.x, H * L.cirno.y];
  const cs = L.cirno.s;
  svgLayer(cv, W, H, magicCircle(cz[0], cz[1] + (6 * K * cs) / 0.42, H * 0.1 * (cs / 0.42), "#8fdcff", 0.6, 15), 6);
  const crowd = L.mid.map(([dx, dy, sc]) => ({ x: cz[0] + dx * H, y: cz[1] + dy * H, sc }));
  crowd.sort((a, b) => a.y - b.y);
  for (const p of crowd) await sprite(pick(), p.x, p.y, p.sc, "url(#rimMid)", 7);
  if (L.dai) await sprite("daiyousei.sprite", cz[0] + L.dai[0] * H, cz[1] + L.dai[1] * H, L.dai[2], "url(#rimMid)", 7);
  await sprite("cirno.sprite", cz[0], cz[1], cs, "url(#rimNear)", 8);
  let fx = "";
  for (let k = 0; k < L.cirno.rings; k++) {
    const nn = 22;
    for (let i = 0; i < nn; i++) {
      const a = (i / nn) * Math.PI * 2 + 0.12 + k * 0.14;
      const rx = H * (0.19 + k * 0.11) * (cs / 0.42);
      const ry = H * (0.15 + k * 0.09) * (cs / 0.42);
      fx += ice(cz[0] + Math.cos(a) * rx, cz[1] + Math.sin(a) * ry, H * (0.015 - k * 0.002) * Math.sqrt(cs / 0.42), (a * 180) / Math.PI, 1 - k * 0.15);
    }
  }
  // Near: the head of the swarm round her; the first just struck by her ofuda.
  for (let i = 0; i < L.near.length; i++) {
    const [id, x, y, sc] = L.near[i]!;
    await sprite(id, W * x, H * y, sc, "url(#rimNear)", 12, i === 0 ? { Wince: 1 } : undefined);
  }
  for (const [id, x, y, sc] of L.behind) await sprite(id, W * x, H * y, sc, "url(#rimMid)", 9);
  // The rest fire at her.
  if (L.shots) {
    for (const [id, x, y] of L.near.slice(1)) {
      const sx = W * x;
      const sy = H * y;
      const tx = face[0] - 60 * K;
      const ty = face[1] + 60 * K;
      const ang = (Math.atan2(ty - sy, tx - sx) * 180) / Math.PI;
      for (let j = 1; j <= 3; j++) {
        const u = 0.2 + j * 0.13;
        fx += rice(sx + (tx - sx) * u, sy + (ty - sy) * u, H * 0.011, ang, id.startsWith("ice") ? "#4dc3ff" : id.startsWith("sun") ? "#ffcf3d" : "#ff4d6d");
      }
    }
  }
  // Her ofuda: one stream striking the near one, another reaching for Cirno.
  const from: Pt = [face[0] - 80 * K, face[1] + 20 * K];
  const stream = (tx: number, ty: number, count: number, l: number, a0: number, a1: number, jit: number): void => {
    const ang = (Math.atan2(ty - from[1], tx - from[0]) * 180) / Math.PI;
    for (let i = 0; i < count; i++) {
      const u = lerp(a0, a1, i / Math.max(1, count - 1));
      fx += ofuda(from[0] + (tx - from[0]) * u, from[1] + (ty - from[1]) * u + (i % 2 ? jit : -jit) * K, H * l, ang + (i % 2 ? 2 : -2), H * l * 1.4);
    }
  };
  const struck = L.near[0];
  if (struck) {
    const hx = W * struck[1];
    const hy = H * struck[2];
    stream(hx, hy, 4, 0.045, 0.25, 0.85, 6);
    fx += burst(hx + 8 * K, hy + 4 * K, H * 0.05);
  }
  if (L.atCirno) stream(cz[0] + 30 * K, cz[1] + 44 * K, 5, 0.04, 0.2, 0.84, 5);
  if (L.gems) {
    const [a, b, c] = L.gems;
    for (let i = 0; i < 10; i++) {
      const [x, y] = qpt([W * a[0], H * a[1]], [W * b[0], H * b[1]], [W * c[0], H * c[1]], i / 10);
      fx += gem(x, y, H * (0.013 + (i / 10) * 0.009), i % 4 === 2 ? 1 : i === 7 ? 2 : 0);
    }
  }
  svgLayer(cv, W, H, fx, 11);

  // Reimu, lit from behind by the moon; her lower half sinks into the night.
  const bs = (H * L.reimu.s) / 640;
  const rm = await put(cv, "reimu", { x: face[0], y: H * L.reimu.foot, scale: bs, anchor: [0.5, 1], look: L.reimu.look, params: L.reimu.params, z: 20, filter: "url(#rimReimu)", fade: [0.78, 0.99], pad: 40 });
  // A shade over her lower half, cut to her silhouette (its stops on the model's box, inside the padding).
  const at = (t: number): string => `${(((rm.pad + t * (rm.h - 2 * rm.pad)) / rm.h) * 100).toFixed(2)}%`;
  const shade = el(cv.stage, "div", {
    left: `${rm.left}px`,
    top: `${rm.top}px`,
    width: `${rm.w}px`,
    height: `${rm.h}px`,
    "z-index": "21",
    background: `linear-gradient(to bottom, rgba(12,9,23,0) ${at(0.5)}, rgba(12,9,23,.42) ${at(0.86)}, rgba(12,9,23,.7) ${at(1)})`,
  });
  shade.style.setProperty("mask-image", `url(${rm.url})`);
  shade.style.setProperty("mask-size", "100% 100%");
  // Her orbs.
  svgLayer(cv, W, H, L.orbs.map(([x, y, s, rot]) => yinyang(W * x, H * y, H * s, rot, L.orbGlow)).join(""), 25);
  // Vignette.
  svgLayer(cv, W, H, `<defs><radialGradient id="vig" cx="0.55" cy="0.45" r="0.75"><stop offset="0.6" stop-color="#03040c" stop-opacity="0"/><stop offset="1" stop-color="#03040c" stop-opacity="0.55"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#vig)"/>`, 50);
}

/** Registers the title's typeface (Latin and Japanese, the weights used) and waits for what the picture sets in it. */
async function fonts(): Promise<void> {
  const subsets: Array<readonly [string, string]> = [
    ["latin", "U+0000-024F, U+2000-206F, U+20AC, U+2122"],
    ["japanese", "U+3000-30FF, U+4E00-9FFF, U+FF00-FFEF"],
  ];
  for (const w of [700, 800]) {
    for (const [sub, range] of subsets) document.fonts.add(new FontFace(FONT, `url(${FONT_FILES}-${sub}-${w}-normal.woff2) format("woff2")`, { weight: String(w), unicodeRange: range }));
  }
  await document.fonts.load(`800 20px "${FONT}"`, "幻想郷博麗");
  await document.fonts.load(`700 20px "${FONT}"`, "Gensokyo Survivors ～");
  await document.fonts.load(`italic 700 20px "${FONT}"`, "a shrine maiden");
}

/** Draws layout `layout` into `stage`, `w` x `h` CSS px, the rigs rendered for pixel ratio `dpr`. */
export async function drawKeyArt(stage: HTMLElement, { w, h, dpr, layout }: { w: number; h: number; dpr: number; layout: string }): Promise<void> {
  const L = KEY_ART_LAYOUTS[layout];
  if (!L) throw new Error(`no key art layout ${layout}`);
  Object.assign(stage.style, { position: "relative", overflow: "hidden", width: `${w}px`, height: `${h}px` });
  await fonts();
  await scene({ stage, dpr }, w, h, L);
  await document.fonts.ready;
}
