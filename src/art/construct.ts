// Construction: the bones a drawing is placed from, before any paint.
//
// The method (see reimu.ts for a full example):
//  1. A head is a cranium sphere (radius 100 "head units", origin at its
//     centre, y down, z toward the viewer) plus a lower face described by
//     horizontal cross-sections (an ellipse per height: half-width a, half-depth
//     b, centre depth zc). The proportions (eye line, eye spacing, nose, mouth,
//     chin, cheek and jaw widths) are a HeadSpec; every feature is authored in
//     head units from those landmarks, looking straight ahead.
//  2. A look turns the head (yaw, pitch). Features on the face are points on
//     the section surface and are rotated in 3D, so they slide along the
//     head's curvature and compress toward the side she turns to; the face
//     silhouette is the exact outline of the rotated sections, so the jaw and
//     chin swing with it. Hair is a shell a bit larger than the cranium:
//     its points slide over the sphere while the silhouette stays put (the
//     back hair fills in behind). Things behind the head (bow, back hair) are
//     rigid points at a negative depth, so they move against the turn.
//  3. The body is a few landmarks (neck, shoulders, chest, arms) derived from
//     the head size, so proportions are stated once.
//  4. `bones()` draws all of it as thin guides (`bun scripts/art.ts --bones`).
//
// Paths are authored as SVG path strings with absolute M/L/C/Q/Z commands, so
// a whole path can be mapped point by point through the head's projection.

import type { Look } from "./drawing.ts";

export interface Pt {
  x: number;
  y: number;
}

export const P = (x: number, y: number): Pt => ({ x, y });
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const mix = (p: Pt, q: Pt, t: number): Pt => ({ x: lerp(p.x, q.x, t), y: lerp(p.y, q.y, t) });
export const add = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y });
export const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
export const scale = (p: Pt, k: number): Pt => ({ x: p.x * k, y: p.y * k });

let STEP = 10;

/**
 * Runs `f` with coordinates written to `digits` decimals (default 1). A big
 * drawing authored at scale 2 can use 0 (half-pixel steps) to stay small.
 */
export function precision<T>(digits: number, f: () => T): T {
  const was = STEP;
  STEP = 10 ** digits;
  try {
    return f();
  } finally {
    STEP = was;
  }
}

/** A number for markup: one decimal (see precision), no "-0", no leading zero. */
export function num(v: number): string {
  const r = Math.round(v * STEP) / STEP;
  return r === 0 ? "0" : String(r).replace(/^(-?)0./, "$1.");
}
export const pt = (p: Pt): string => `${num(p.x)} ${num(p.y)}`;

/** A polygon as compact path data: the first point absolute, the rest relative. */
export function poly(pts: Pt[]): string {
  if (!pts.length) return "";
  let d = `M${pt(pts[0]!)}l`;
  let px = Math.round(pts[0]!.x * STEP);
  let py = Math.round(pts[0]!.y * STEP);
  for (let i = 1; i < pts.length; i++) {
    const x = Math.round(pts[i]!.x * STEP);
    const y = Math.round(pts[i]!.y * STEP);
    const dy = num((y - py) / STEP);
    d += `${i > 1 ? " " : ""}${num((x - px) / STEP)}${dy.startsWith("-") ? "" : " "}${dy}`;
    px = x;
    py = y;
  }
  return `${d}Z`;
}

/** A short id-safe key for a look, so ids stay unique per drawing and look on a shared page. */
export function lookKey(look: Look): string {
  const k = (v: number) => (v > 0.2 ? "p" : v < -0.2 ? "n" : "o");
  return `${k(look.x)}${k(look.y)}`;
}

// ---------------------------------------------------------------- paths

export type Cmd = { c: "M" | "L" | "C" | "Q" | "Z"; p: Pt[] };
const ARITY = { M: 1, L: 1, C: 3, Q: 2, Z: 0 } as const;

/** Parses absolute M, L, C, Q, Z path data (implicit repeats allowed). */
export function parse(d: string): Cmd[] {
  const out: Cmd[] = [];
  const toks = d.match(/[MLCQZ]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let c: Cmd["c"] = "M";
  let buf: number[] = [];
  for (const t of toks) {
    if (/^[MLCQZ]$/.test(t)) {
      c = t as Cmd["c"];
      buf = [];
      if (c === "Z") out.push({ c, p: [] });
      continue;
    }
    buf.push(Number(t));
    if (buf.length === ARITY[c] * 2) {
      const p: Pt[] = [];
      for (let i = 0; i < buf.length; i += 2) p.push({ x: buf[i]!, y: buf[i + 1]! });
      out.push({ c, p });
      buf = [];
      if (c === "M") c = "L";
    }
  }
  return out;
}

export function fmt(cmds: Cmd[]): string {
  return cmds.map((k) => (k.c === "Z" ? "Z" : `${k.c}${k.p.map(pt).join(" ")}`)).join("");
}

/** Maps every point (control points too) of a path. */
export function mapD(d: string, f: (p: Pt) => Pt): string {
  return fmt(parse(d).map((k) => ({ c: k.c, p: k.p.map(f) })));
}

const cubic = (a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
};

/** Flattens a path to polylines (one per subpath), `n` points per curve. */
export function sample(d: string, n = 10): { pts: Pt[]; closed: boolean }[] {
  const subs: { pts: Pt[]; closed: boolean }[] = [];
  let cur: { pts: Pt[]; closed: boolean } | undefined;
  for (const k of parse(d)) {
    if (k.c === "M") {
      cur = { pts: [k.p[0]!], closed: false };
      subs.push(cur);
      continue;
    }
    if (!cur) continue;
    const last = cur.pts[cur.pts.length - 1]!;
    if (k.c === "Z") cur.closed = true;
    else if (k.c === "L") cur.pts.push(k.p[0]!);
    else if (k.c === "C") for (let i = 1; i <= n; i++) cur.pts.push(cubic(last, k.p[0]!, k.p[1]!, k.p[2]!, i / n));
    else if (k.c === "Q") {
      const c1 = mix(last, k.p[0]!, 2 / 3);
      const c2 = mix(k.p[1]!, k.p[0]!, 2 / 3);
      for (let i = 1; i <= n; i++) cur.pts.push(cubic(last, c1, c2, k.p[1]!, i / n));
    }
  }
  return subs;
}

/** A smooth curve through points (Catmull-Rom as cubic Beziers). */
export function smooth(pts: Pt[], closed = false): string {
  const n = pts.length;
  if (n < 2) return "";
  const at = (i: number) => (closed ? pts[((i % n) + n) % n]! : pts[clamp(i, 0, n - 1)]!);
  let d = `M${pt(pts[0]!)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Width profile of a tapered line: start, peak position (0..1), end, as fractions of the full width. */
export type Taper = [start: number, peakAt: number, end: number];

/**
 * A line of varying width as a filled shape: the ink of the line art.
 * `w` is the widest point; the profile tapers it toward both ends.
 */
export function taper(d: string, w: number, prof: Taper = [0.1, 0.45, 0.1], n = 4): string {
  let out = "";
  for (const { pts } of sample(d, n)) {
    if (pts.length < 2) continue;
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
    const total = len[len.length - 1]! || 1;
    const [s, m, e] = prof;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const t = len[i]! / total;
      const k = t < m ? lerp(s, 1, Math.sin(((t / m) * Math.PI) / 2)) : lerp(1, e, 1 - Math.cos((((t - m) / (1 - m || 1)) * Math.PI) / 2));
      const a = pts[Math.max(0, i - 1)]!;
      const b = pts[Math.min(pts.length - 1, i + 1)]!;
      const dl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const nx = -(b.y - a.y) / dl;
      const ny = (b.x - a.x) / dl;
      const h = (w * k) / 2;
      left.push({ x: pts[i]!.x + nx * h, y: pts[i]!.y + ny * h });
      right.push({ x: pts[i]!.x - nx * h, y: pts[i]!.y - ny * h });
    }
    out += poly([...left, ...right.reverse()]);
  }
  return out;
}

/** An ellipse as a path (so it can be mapped through a projection). */
export function ellipseD(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  return (
    `M${num(cx + rx)} ${num(cy)}` +
    `C${num(cx + rx)} ${num(cy + ry * k)} ${num(cx + rx * k)} ${num(cy + ry)} ${num(cx)} ${num(cy + ry)}` +
    `C${num(cx - rx * k)} ${num(cy + ry)} ${num(cx - rx)} ${num(cy + ry * k)} ${num(cx - rx)} ${num(cy)}` +
    `C${num(cx - rx)} ${num(cy - ry * k)} ${num(cx - rx * k)} ${num(cy - ry)} ${num(cx)} ${num(cy - ry)}` +
    `C${num(cx + rx * k)} ${num(cy - ry)} ${num(cx + rx)} ${num(cy - ry * k)} ${num(cx + rx)} ${num(cy)}Z`
  );
}

/**
 * Makes every closed subpath wind the same way, so a path made of many
 * overlapping shapes fills as their union (nonzero) instead of punching holes.
 */
export function unite(d: string): string {
  const out: string[] = [];
  for (const sub of d.split(/(?=M)/)) {
    if (!sub.trim()) continue;
    const pts = sample(sub, 4)[0]?.pts ?? [];
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      area += a.x * b.y - b.x * a.y;
    }
    out.push(area < 0 ? reversePath(sub) : sub);
  }
  return out.join("");
}

/** Reverses one subpath (M/L/C/Q, optional Z). */
export function reversePath(d: string): string {
  const k = parse(d);
  const closed = k.some((c) => c.c === "Z");
  let last: Pt | undefined;
  const segs: { c: Cmd["c"]; from: Pt; p: Pt[] }[] = [];
  for (const c of k) {
    if (c.c === "M") last = c.p[0];
    else if (c.c !== "Z" && last) {
      segs.push({ c: c.c, from: last, p: c.p });
      last = c.p[c.p.length - 1];
    }
  }
  if (!segs.length || !last) return d;
  let out = `M${pt(last)}`;
  for (const s of segs.reverse()) {
    if (s.c === "C") out += `C${pt(s.p[1]!)} ${pt(s.p[0]!)} ${pt(s.from)}`;
    else if (s.c === "Q") out += `Q${pt(s.p[0]!)} ${pt(s.from)}`;
    else out += `L${pt(s.from)}`;
  }
  return closed ? `${out}Z` : out;
}

/** Mirrors a path across the vertical line x = cx (to author one side and get the other). */
export const mirrorD = (d: string, cx = 0): string => mapD(d, (p) => ({ x: 2 * cx - p.x, y: p.y }));

// ---------------------------------------------------------------- the head

/** Proportions of a head, in head units (cranium radius 100, origin at its centre, y down). */
export interface HeadSpec {
  /** Page position of the cranium centre and the cranium radius on the page. */
  cx: number;
  cy: number;
  r: number;
  /** Largest turn (radians) at |look| = 1: yaw to the side, pitch up/down. */
  yaw: number;
  pitch: number;
  /** Page units the whole head moves toward the look (the neck bends). */
  lean: number;
  /** Eye centres: line height and distance from the centre line; eye opening size. */
  eyeY: number;
  eyeX: number;
  eyeW: number;
  eyeH: number;
  browY: number;
  noseY: number;
  mouthY: number;
  chinY: number;
  /** Half-widths of the face at the nose line, the mouth line, and just above the chin. */
  cheekW: number;
  jawW: number;
  chinW: number;
  /** Depth of the (flat, anime) face front at the eye line and the chin. */
  frontEye: number;
  frontChin: number;
}

interface Section {
  a: number;
  b: number;
  zc: number;
}

/** Cubic Hermite through keys [y, v] with finite-difference tangents. */
function interp(keys: [number, number][], y: number): number {
  if (y <= keys[0]![0]) return keys[0]![1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [y0, v0] = keys[i]!;
    const [y1, v1] = keys[i + 1]!;
    if (y > y1) continue;
    const h = y1 - y0;
    const t = (y - y0) / h;
    const slope = (j: number) => {
      const a = keys[Math.max(0, j - 1)]!;
      const b = keys[Math.min(keys.length - 1, j + 1)]!;
      return (b[1] - a[1]) / (b[0] - a[0]);
    };
    const m0 = slope(i) * h;
    const m1 = slope(i + 1) * h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1;
  }
  return keys[keys.length - 1]![1];
}

const CHIN_ROUND = 14;

/** A head in one look: the projection from head units to the page, and its landmarks. */
export class Head {
  readonly s: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly off: Pt;
  private readonly cy: number;
  private readonly sy: number;
  private readonly cp: number;
  private readonly sp: number;

  constructor(
    readonly spec: HeadSpec,
    readonly look: Look,
  ) {
    this.s = spec.r / 100;
    this.yaw = look.x * spec.yaw;
    this.pitch = look.y * spec.pitch;
    this.off = { x: look.x * spec.lean, y: look.y * spec.lean * 0.6 };
    this.cy = Math.cos(this.yaw);
    this.sy = Math.sin(this.yaw);
    this.cp = Math.cos(this.pitch);
    this.sp = Math.sin(this.pitch);
    this.profile = Head.profileOf(spec);
  }

  /** The frontal face outline (right half) as a table of [y, half-width], from the cranium's equator to the chin. */
  private readonly profile: [number, number][];

  private static profileOf(o: HeadSpec): [number, number][] {
    // Two cubics: the cheek (equator -> nose line) and the jaw (nose line -> chin tip),
    // shaped so the jaw passes through jawW at the mouth line and ends in a small rounded point.
    const segs: [Pt, Pt, Pt, Pt][] = [
      [P(100, 0), P(100, o.noseY * 0.45), P(o.cheekW + (100 - o.cheekW) * 0.35, o.noseY * 0.8), P(o.cheekW, o.noseY)],
      [P(o.cheekW, o.noseY), P(o.cheekW - (o.cheekW - o.jawW) * 0.9, lerp(o.noseY, o.mouthY, 0.8)), P(o.chinW * 1.6, o.chinY - 3), P(0, o.chinY)],
    ];
    const out: [number, number][] = [];
    for (const [a, b, c, d] of segs)
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const u = 1 - t;
        const x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x;
        const y = u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y;
        if (!out.length || y > out[out.length - 1]![0]) out.push([y, x]);
      }
    return out;
  }

  /** The cross-section of the head at height y (head units). */
  section(y: number): Section {
    const o = this.spec;
    let a: number;
    if (y < 0) a = Math.sqrt(Math.max(0, 1e4 - y * y));
    else if (y >= o.chinY) a = 0;
    else {
      const t = this.profile;
      let i = 1;
      while (i < t.length - 1 && t[i]![0] < y) i++;
      const [y0, a0] = t[i - 1]!;
      const [y1, a1] = t[i]!;
      a = lerp(a0, a1, clamp((y - y0) / (y1 - y0 || 1), 0, 1));
    }
    const front =
      y < 0
        ? Math.min(a, o.frontEye + 4)
        : Math.min(
            a,
            interp(
              [
                [0, o.frontEye + 4],
                [o.eyeY, o.frontEye],
                [o.mouthY, lerp(o.frontEye, o.frontChin, 0.6)],
                [o.chinY, o.frontChin],
              ],
              y,
            ),
          );
    const k = y <= o.eyeY ? 1 : lerp(1, 0.72, clamp((y - o.eyeY) / (o.chinY - o.eyeY), 0, 1));
    const b = Math.min(a * k, front);
    return { a, b, zc: front - b };
  }

  /** Depth of the face surface at (x, y), head units. */
  surfaceZ(x: number, y: number): number {
    const { a, b, zc } = this.section(y);
    if (a <= 0) return 0;
    const u = clamp(x / a, -1, 1);
    return zc + b * Math.sqrt(1 - u * u);
  }

  /** Head units (already rotated) to the page. */
  page(X: number, Y: number): Pt {
    return { x: this.spec.cx + this.off.x + X * this.s, y: this.spec.cy + this.off.y + Y * this.s };
  }

  /** A rigid point at depth z, rotated with the head. */
  solid(p: Pt, z: number): Pt {
    const X = p.x * this.cy + z * this.sy;
    const Z = -p.x * this.sy + z * this.cy;
    return this.page(X, p.y * this.cp + Z * this.sp);
  }

  /** A point on the face surface (dz lifts it off the surface: the nose tip, lips). */
  face = (p: Pt, dz = 0): Pt => this.solid(p, this.surfaceZ(p.x, p.y) + dz);

  /** A point on the hair shell of radius R: it slides over the sphere, the silhouette stays. */
  shell = (p: Pt, R = 106): Pt => {
    const rho = Math.sqrt(Math.max(1, R * R - p.y * p.y));
    const u = clamp(p.x / rho, -1, 1);
    const th = Math.asin(u);
    const th2 = th + this.yaw * (1 - ((2 * th) / Math.PI) ** 2);
    const x1 = rho * Math.sin(th2) + (p.x - rho * u);
    const sig = Math.sqrt(Math.max(1, R * R - x1 * x1));
    const v = clamp(p.y / sig, -1, 1);
    const al = Math.asin(v);
    const al2 = al + this.pitch * (1 - ((2 * al) / Math.PI) ** 2);
    const y1 = sig * Math.sin(al2) + (p.y - sig * v);
    return this.page(x1, y1);
  };

  /** Hair hanging below `anchorY`: it follows the shell at the anchor, less and less further down. */
  hang = (p: Pt, anchorY: number, R = 106): Pt => {
    if (p.y <= anchorY) return this.shell(p, R);
    const a = { x: p.x, y: anchorY };
    const moved = this.shell(a, R);
    const still = this.page(a.x, a.y);
    const k = 1 / (1 + (p.y - anchorY) / 160);
    return this.page(p.x + ((moved.x - still.x) / this.s) * k, p.y + ((moved.y - still.y) / this.s) * k);
  };

  /** Path helpers: author in head units, get page coordinates. */
  F = (d: string, dz = 0): string => mapD(d, (p) => this.face(p, dz));
  S = (d: string, R = 106): string => mapD(d, (p) => this.shell(p, R));
  B = (d: string, z: number): string => mapD(d, (p) => this.solid(p, z));
  H = (d: string, anchorY: number, R = 106): string => mapD(d, (p) => this.hang(p, anchorY, R));

  /** The silhouette point of the rotated section at height y on one side (+1 right, -1 left). */
  edge(y: number, side: 1 | -1): Pt {
    const { a, b, zc } = this.section(y);
    // Extreme of x(t) = a sin t cos(yaw) + (zc + b cos t) sin(yaw).
    const t = Math.atan2(a * this.cy, b * this.sy) + (side < 0 ? Math.PI : 0);
    const X = a * Math.sin(t) * this.cy + (zc + b * Math.cos(t)) * this.sy;
    const Z = -a * Math.sin(t) * this.sy + (zc + b * Math.cos(t)) * this.cy;
    return this.page(X, y * this.cp + Z * this.sp);
  }

  private heights(from: number): number[] {
    const o = this.spec;
    const ys: number[] = [];
    const end = o.chinY - CHIN_ROUND;
    for (let i = 0; i <= 18; i++) ys.push(lerp(from, end, i / 18));
    for (let i = 1; i <= 5; i++) ys.push(end + CHIN_ROUND * (1 - (1 - i / 5) ** 2));
    return ys;
  }

  /** The whole head-and-face silhouette (page), closed. */
  outline(): string {
    const ys = this.heights(-100);
    const right = ys.map((y) => this.edge(y, 1));
    const left = ys.map((y) => this.edge(y, -1)).reverse();
    return smooth([...right.slice(0, -1), ...left.slice(1, -1)], true);
  }

  /** One side of the jaw line (page), from the eye line down to the chin. */
  jaw(side: 1 | -1, from = this.spec.eyeY): Pt[] {
    return this.heights(from).map((y) => this.edge(y, side));
  }

  /** How much the face surface at (x, y) is foreshortened horizontally (1 = facing the viewer). */
  squash(x: number, y: number): number {
    const e = 2;
    const a = this.face({ x: x - e, y });
    const b = this.face({ x: x + e, y });
    return Math.hypot(b.x - a.x, b.y - a.y) / (2 * e * this.s);
  }

  /** A curve across the face surface at height y (for guides). */
  private across(y: number, span = 1): string {
    const { a } = this.section(y);
    const pts: Pt[] = [];
    for (let i = 0; i <= 16; i++) {
      const x = lerp(-a, a, i / 16) * span;
      // Only the half facing the viewer.
      const n = this.solid({ x, y }, this.surfaceZ(x, y));
      const facing = -x * this.sy + this.surfaceZ(x, y) * this.cy > -2;
      if (facing) pts.push(n);
    }
    return smooth(pts);
  }

  /** The construction as thin coloured guides. */
  bones(): string {
    const o = this.spec;
    const c = this.page(0, 0);
    const line = (d: string, col: string, w = 1, dash = "") => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${num(w)}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
    const centre: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const y = lerp(-100, o.chinY, i / 20);
      centre.push(this.face({ x: 0, y }));
    }
    const eyeBox = (sx: number) =>
      line(this.F(`M${sx * o.eyeX - o.eyeW / 2} ${o.eyeY - o.eyeH / 2}L${sx * o.eyeX + o.eyeW / 2} ${o.eyeY - o.eyeH / 2}L${sx * o.eyeX + o.eyeW / 2} ${o.eyeY + o.eyeH / 2}L${sx * o.eyeX - o.eyeW / 2} ${o.eyeY + o.eyeH / 2}Z`), "#4dff88");
    const chin = this.face({ x: 0, y: o.chinY });
    return `<g opacity="0.9">
  <circle cx="${num(c.x)}" cy="${num(c.y)}" r="${num(this.spec.r)}" fill="none" stroke="#39c6ff" stroke-width="1"/>
  ${line(this.outline(), "#39c6ff", 1, "4 3")}
  ${line(smooth(centre), "#ff4dd2", 1.2)}
  ${line(this.across(o.browY), "#ffd84d", 0.8, "3 2")}
  ${line(this.across(o.eyeY), "#ffd84d", 1)}
  ${line(this.across(o.noseY), "#ffd84d", 0.8, "3 2")}
  ${line(this.across(o.mouthY), "#ffd84d", 0.8, "3 2")}
  ${eyeBox(-1)}${eyeBox(1)}
  <circle cx="${num(chin.x)}" cy="${num(chin.y)}" r="2.5" fill="#ff4dd2"/>
</g>`;
  }
}

// ---------------------------------------------------------------- the body

/** Body landmarks of a bust or a figure, in page units, derived from the head. */
export interface Body {
  /** Neck: top (under the jaw) and base, left and right. */
  neckTL: Pt;
  neckTR: Pt;
  neckBL: Pt;
  neckBR: Pt;
  /** Pit of the neck (centre of the collarbones). */
  sternum: Pt;
  /** Shoulder points (the top of the arm). */
  shL: Pt;
  shR: Pt;
  /** Armpits. */
  apL: Pt;
  apR: Pt;
  /** Chest line (bust apex height) and waist line centres. */
  chest: Pt;
  waist: Pt;
  /** Elbows and wrists (arms hanging, slightly out). */
  elL: Pt;
  elR: Pt;
  wrL: Pt;
  wrR: Pt;
  /** Hips, knees, ankles (figures only). */
  hipL: Pt;
  hipR: Pt;
  knL: Pt;
  knR: Pt;
  anL: Pt;
  anR: Pt;
}

export interface BodySpec {
  /** Centre line x on the page and the head size unit (head height = chin to top of cranium). */
  cx: number;
  /** Heights in head units from the chin (0) down, widths in head widths (1 = cranium diameter). */
  neckW: number;
  neckLen: number;
  shoulderDrop: number;
  shoulderW: number;
  chestY: number;
  waistY: number;
  waistW: number;
  hipY: number;
  hipW: number;
  kneeY: number;
  ankleY: number;
  /** Upper arm and forearm length in head heights. */
  arm: number;
  /** How far the arms hang out from the body (radians). */
  armOut: number;
}

/** Body landmarks from the head (its chin and size) and the body spec. `shift` turns the torso a little with the look. */
export function body(head: Head, o: BodySpec, shift = 0.25): Body {
  const hs = head.spec;
  const H = ((hs.chinY + 100) / 100) * hs.r; // head height on the page
  const Wd = 2 * hs.r; // head width on the page
  const chinY = hs.cy + (hs.chinY / 100) * hs.r;
  const dx = head.off.x * shift;
  const X = (k: number) => o.cx + dx + k * Wd;
  const Y = (k: number) => chinY + k * H;
  const at = (kx: number, ky: number): Pt => ({ x: X(kx), y: Y(ky) });
  const neckTopY = -0.12;
  const shY = o.neckLen + o.shoulderDrop;
  const shL = at(-o.shoulderW / 2, shY);
  const shR = at(o.shoulderW / 2, shY);
  const arm = (s: Pt, side: number, len: number) => ({ x: s.x + side * Math.sin(o.armOut) * len * H, y: s.y + Math.cos(o.armOut) * len * H });
  const elL = arm(shL, -1, o.arm);
  const elR = arm(shR, 1, o.arm);
  return {
    neckTL: at(-o.neckW / 2, neckTopY),
    neckTR: at(o.neckW / 2, neckTopY),
    neckBL: at(-o.neckW / 2 - 0.02, o.neckLen),
    neckBR: at(o.neckW / 2 + 0.02, o.neckLen),
    sternum: at(0, o.neckLen + o.shoulderDrop * 0.9),
    shL,
    shR,
    apL: at(-o.shoulderW / 2 + 0.1, shY + 0.45),
    apR: at(o.shoulderW / 2 - 0.1, shY + 0.45),
    chest: at(0, o.chestY),
    waist: at(0, o.waistY),
    elL,
    elR,
    wrL: arm(elL, -1, o.arm * 0.9),
    wrR: arm(elR, 1, o.arm * 0.9),
    hipL: at(-o.hipW / 2, o.hipY),
    hipR: at(o.hipW / 2, o.hipY),
    knL: at(-o.hipW / 4, o.kneeY),
    knR: at(o.hipW / 4, o.kneeY),
    anL: at(-o.hipW / 4, o.ankleY),
    anR: at(o.hipW / 4, o.ankleY),
  };
}

/** The body landmarks as guides: neck, shoulder line, spine, arms, legs. */
export function bodyBones(b: Body, legs = false): string {
  const l = (p: Pt, q: Pt, c = "#ff9a3c", w = 1) => `<path d="M${pt(p)}L${pt(q)}" stroke="${c}" stroke-width="${w}" fill="none"/>`;
  const dot = (p: Pt, c = "#ff9a3c") => `<circle cx="${num(p.x)}" cy="${num(p.y)}" r="2" fill="${c}"/>`;
  return `<g opacity="0.9">
  ${l(b.neckTL, b.neckBL)}${l(b.neckTR, b.neckBR)}
  ${l(b.neckBL, b.shL)}${l(b.neckBR, b.shR)}${l(b.shL, b.shR, "#ff9a3c", 0.6)}
  ${l(b.sternum, b.waist, "#ff4dd2")}
  ${l(b.shL, b.apL)}${l(b.shR, b.apR)}
  ${l({ x: b.apL.x, y: b.chest.y }, { x: b.apR.x, y: b.chest.y }, "#ffd84d", 0.8)}
  ${l(b.shL, b.elL)}${l(b.elL, b.wrL)}${l(b.shR, b.elR)}${l(b.elR, b.wrR)}
  ${legs ? `${l(b.hipL, b.hipR)}${l(b.hipL, b.knL)}${l(b.knL, b.anL)}${l(b.hipR, b.knR)}${l(b.knR, b.anR)}` : ""}
  ${[b.shL, b.shR, b.sternum, b.elL, b.elR, b.wrL, b.wrR].map((p) => dot(p)).join("")}
</g>`;
}
