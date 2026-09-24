// Paint: the reusable pieces drawn on top of the construction (construct.ts):
// anime eyes, hair strands, frills, ink lines, cel shadows and rim light.
// Everything takes a Head (for the projection) or page-space paths, and an id
// prefix so defs stay unique when many drawings share a page.
//
// Layer order for a part (see reimu.ts): flat base colour -> cel shadow (one
// tone, crisp, cast from the light at the upper left) -> soft second shadow /
// occlusion (blurred) -> highlights -> rim light (lower right edges) -> ink
// (tapered lines in a dark shade of the local colour, thinner inside).

import { clamp, ellipseD, type Head, lerp, mapD, num, P, pt, type Pt, sample, smooth, taper, type Taper } from "./construct.ts";

/** A filled, tapered ink line. */
export function ink(d: string, w: number, colour: string, prof: Taper = [0.1, 0.45, 0.1], opacity = 1): string {
  return `<path d="${taper(d, w, prof)}" fill="${colour}"${opacity < 1 ? ` opacity="${num(opacity)}"` : ""}/>`;
}

/** Moves a page path by (dx, dy). */
export const moveD = (d: string, dx: number, dy: number): string => mapD(d, (p) => ({ x: p.x + dx, y: p.y + dy }));

/**
 * A cel shadow: `shape` filled with `colour`, except where the same shape
 * moved toward the light still covers it, i.e. a crisp band on the far side
 * of the shape from the light. Clipped to `clip` (the surface it falls on).
 */
export function celEdge(id: string, shape: string, clip: string, colour: string, dx: number, dy: number, opacity = 1): string {
  // The shape is written once and reused (<use>) for the mask, to keep the markup small.
  const op = opacity < 1 ? ` opacity="${num(opacity)}"` : "";
  const mask = `<mask id="${id}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="2000" height="2000"><rect x="-50" y="-50" width="2000" height="2000" fill="#fff"/><use href="#${id}s" transform="translate(${num(-dx)} ${num(-dy)})" fill="#000"/></mask>`;
  const body = `<defs><path id="${id}s" d="${shape}"/></defs><use href="#${id}s" fill="${colour}" mask="url(#${id})"${op}/>`;
  if (clip === shape) return mask + body;
  return `${mask}<clipPath id="${id}c"><path d="${clip}"/></clipPath><g clip-path="url(#${id}c)">${body}</g>`;
}

/** A shape cast as a shadow onto a surface: `caster` moved by (dx, dy), clipped to `clip`. */
export function cast(id: string, caster: string, clip: string, colour: string, dx: number, dy: number, blur = 0, opacity = 1): string {
  const f = blur > 0 ? `<filter id="${id}f" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${num(blur)}"/></filter>` : "";
  return `${f}<clipPath id="${id}c"><path d="${clip}"/></clipPath>
<g clip-path="url(#${id}c)"><path d="${moveD(caster, dx, dy)}" fill="${colour}"${blur > 0 ? ` filter="url(#${id}f)"` : ""}${opacity < 1 ? ` opacity="${num(opacity)}"` : ""}/></g>`;
}

/** Rim light: a thin band along the edge of `shape` facing away from the key light (lower right). */
export function rim(id: string, shape: string, colour: string, w: number, opacity = 0.8, dx = 1, dy = 0.4): string {
  return celEdge(id, shape, shape, colour, dx * w, dy * w, opacity);
}

/**
 * Weighted outline: a thin line all round and a heavier one on the edges
 * facing away from the light (lower right), so the line weight follows form.
 */
export function outline(id: string, d: string, colour: string, thin: number, thick: number, k = thick): string {
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="-50" y="-50" width="2000" height="2000"><rect x="-50" y="-50" width="2000" height="2000" fill="#fff"/><path d="${moveD(d, -k, -k * 0.8)}" fill="#000"/></mask>
<path d="${d}" fill="none" stroke="${colour}" stroke-width="${num(thin)}" stroke-linejoin="round"/>
<path d="${d}" fill="none" stroke="${colour}" stroke-width="${num(thick)}" stroke-linejoin="round" mask="url(#${id})"/>`;
}

/** A soft blur filter definition. */
export const blur = (id: string, sd: number): string => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${num(sd)}"/></filter>`;

// ---------------------------------------------------------------- hair

export interface Strand {
  /** Closed outline of the lock (head units unless mapped). */
  shape: string;
  /** Its two long edges, root to tip (for ink). */
  left: string;
  right: string;
  /** The centre line. */
  spine: string;
}

/**
 * A lock of hair: from `root` to a pointed `tip`, `w` wide at the root, its
 * spine bowed by `bend` (units to the right of the root->tip direction) and
 * the last third hooked by `curl`. `belly` swells the middle.
 */
export function strand(root: Pt, tip: Pt, w: number, bend = 0, curl = 0, belly = 0.25, n = 8): Strand {
  const dx = tip.x - root.x;
  const dy = tip.y - root.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c1 = { x: root.x + dx * 0.33 + nx * bend, y: root.y + dy * 0.33 + ny * bend };
  const c2 = { x: root.x + dx * 0.7 + nx * (bend + curl), y: root.y + dy * 0.7 + ny * (bend + curl) };
  const spinePts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    spinePts.push({
      x: u * u * u * root.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * tip.x,
      y: u * u * u * root.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * tip.y,
    });
  }
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = spinePts[Math.max(0, i - 1)]!;
    const b = spinePts[Math.min(n, i + 1)]!;
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const px = -(b.y - a.y) / l;
    const py = (b.x - a.x) / l;
    const hw = (w / 2) * (1 - t) ** 0.85 * (1 + belly * Math.sin(Math.PI * t));
    left.push({ x: spinePts[i]!.x - px * hw, y: spinePts[i]!.y - py * hw });
    right.push({ x: spinePts[i]!.x + px * hw, y: spinePts[i]!.y + py * hw });
  }
  const outline = [...left.slice(0, -1), tip, ...right.slice(0, -1).reverse()];
  const from = Math.round(n * 0.28);
  return { shape: smooth(outline, true), left: smooth(left.slice(from)), right: smooth(right.slice(from)), spine: smooth(spinePts) };
}

// ---------------------------------------------------------------- frills and lace

/**
 * A frill along a page-space edge: a band `depth` deep on the `side` (+1 left
 * of the direction of travel, -1 right) with a scalloped outer border of
 * `bumps` scallops. Returns the shape and the fold lines (short creases from
 * each valley toward the edge).
 */
export function frill(edge: string, depth: number, bumps: number, side: 1 | -1 = 1): { shape: string; folds: string; hem: string } {
  const pts = sample(edge, 16)[0]?.pts ?? [];
  if (pts.length < 2) return { shape: "", folds: "", hem: "" };
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const total = len[len.length - 1]!;
  const at = (s: number): { p: Pt; n: Pt } => {
    let i = 1;
    while (i < len.length - 1 && len[i]! < s) i++;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const t = clamp((s - len[i - 1]!) / (len[i]! - len[i - 1]! || 1), 0, 1);
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { p: { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }, n: { x: (side * (b.y - a.y)) / l, y: (-side * (b.x - a.x)) / l } };
  };
  const off = (s: number, k: number): Pt => {
    const { p, n } = at(s);
    return { x: p.x + n.x * depth * k, y: p.y + n.y * depth * k };
  };
  let d = `M${pt(pts[0]!)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pt(pts[i]!)}`;
  let hem = "";
  let folds = "";
  const step = total / bumps;
  d += `L${pt(off(total, 0.8))}`;
  hem = `M${pt(off(total, 0.8))}`;
  for (let i = bumps; i > 0; i--) {
    const s0 = i * step;
    const s1 = (i - 1) * step;
    const mid = off((s0 + s1) / 2, 1.25);
    const end = off(s1, 0.8);
    const c = `Q${pt(mid)} ${pt(end)}`;
    d += c;
    hem += c;
    if (i > 1) {
      const v = off(s1, 0.78);
      const e = off(s1, 0.25);
      folds += `M${pt(v)}L${pt(e)}`;
    }
  }
  return { shape: `${d}Z`, folds, hem };
}

/** Evenly spaced dashes along a page-space path (lace ribbons, stitched trims). */
export function dashes(d: string, count: number, len: number, w: number, colour: string, from = 0.05, to = 0.95, angle = 0): string {
  const pts = sample(d, 24)[0]?.pts ?? [];
  if (pts.length < 2) return "";
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y));
  const total = cum[cum.length - 1]!;
  let out = "";
  for (let k = 0; k < count; k++) {
    const s = total * lerp(from, to, count > 1 ? k / (count - 1) : 0.5);
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < s) i++;
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const t = clamp((s - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1), 0, 1);
    const p = { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    let ux = (b.x - a.x) / l;
    let uy = (b.y - a.y) / l;
    if (angle) {
      const c = Math.cos(angle);
      const sn = Math.sin(angle);
      [ux, uy] = [ux * c - uy * sn, ux * sn + uy * c];
    }
    out += `M${pt({ x: p.x - (ux * len) / 2, y: p.y - (uy * len) / 2 })}L${pt({ x: p.x + (ux * len) / 2, y: p.y + (uy * len) / 2 })}`;
  }
  return `<path d="${out}" stroke="${colour}" stroke-width="${num(w)}" stroke-linecap="round" fill="none"/>`;
}

// ---------------------------------------------------------------- eyes

export interface EyeStyle {
  /** Iris gradient top -> middle -> bottom, its rim, and the pupil. */
  iris: [string, string, string];
  rim: string;
  pupil: string;
  /** Upper lash (thick), lower lash and crease. */
  lash: string;
  lower: string;
  white: string;
  /** Shadow the upper lid casts on the eye white. */
  lidShade: string;
  /** How open the upper lid is (1 = wide; ~0.85 = calm, half-lidded). */
  open: number;
  /** Ink width of the upper lash in head units. */
  lashW: number;
  /** "full" for portraits; "chibi" drops the fine detail that turns to mush when small. */
  detail: "full" | "chibi";
}

/** Eye opening outline pieces for one eye, in head units. sx = +1 for the eye on screen right (outer corner to the right). */
function eyeGeom(h: Head, sx: number, st: EyeStyle) {
  const o = h.spec;
  const w = o.eyeW;
  const hh = o.eyeH;
  const E = P(sx * o.eyeX, o.eyeY);
  const X = (k: number) => E.x + sx * k * w;
  const Y = (k: number) => E.y + k * hh;
  const op = st.open;
  const inner = P(X(-0.5), Y(0.1));
  const outer = P(X(0.52), Y(-0.04));
  const upper = `M${pt(inner)}C${pt(P(X(-0.44), Y(-0.36 * op)))} ${pt(P(X(-0.14), Y(-0.55 * op)))} ${pt(P(X(0.1), Y(-0.54 * op)))}C${pt(P(X(0.32), Y(-0.53 * op)))} ${pt(P(X(0.49), Y(-0.34 * op)))} ${pt(outer)}`;
  const lower = `M${pt(outer)}C${pt(P(X(0.5), Y(0.26)))} ${pt(P(X(0.26), Y(0.5)))} ${pt(P(X(0.02), Y(0.5)))}C${pt(P(X(-0.24), Y(0.5)))} ${pt(P(X(-0.44), Y(0.36)))} ${pt(inner)}`;
  const opening = `${upper}${lower.replace(/^M[^C]*/, "")}Z`;
  return { E, w, hh, X, Y, inner, outer, upper, lower, opening };
}

/**
 * One anime eye on the face of `h`: white with the lid's shadow, a gradient
 * iris with a darker rim, pupil, a warm glow at the bottom, two catchlights
 * (always on the light's side), then ink: a thick tapered upper lash winged
 * at the outer corner, a lower lash hint and the lid crease.
 */
export function eye(id: string, h: Head, sx: 1 | -1, st: EyeStyle): string {
  const g = eyeGeom(h, sx, st);
  const s = h.s;
  const look = h.look;
  // The irises also turn within the eye, beyond the head's turn.
  const gx = look.x * g.w * 0.16;
  const gy = look.y * g.hh * 0.12;
  const ic = P(g.E.x + gx, g.E.y + g.hh * 0.06 + gy);
  const irx = g.w * 0.29;
  const iry = g.hh * 0.47;
  const open = h.F(g.opening);
  const iris = h.F(ellipseD(ic.x, ic.y, irx, iry));
  const pupil = h.F(ellipseD(ic.x, ic.y + iry * 0.02, irx * 0.42, iry * 0.46));
  const glow = h.F(ellipseD(ic.x, ic.y + iry * 0.42, irx * 0.72, iry * 0.42));
  // The light is at the upper left for both eyes.
  const hl1 = h.F(ellipseD(ic.x - irx * 0.36, ic.y - iry * 0.3, irx * 0.3, iry * 0.24));
  const hl2 = h.F(ellipseD(ic.x + irx * 0.34, ic.y + iry * 0.36, irx * 0.14, iry * 0.1));
  const lidBand = h.F(`M${pt(P(g.X(-0.7), g.Y(-0.9)))}L${pt(P(g.X(0.7), g.Y(-0.9)))}L${pt(P(g.X(0.7), g.Y(-0.22)))}C${pt(P(g.X(0.3), g.Y(-0.1)))} ${pt(P(g.X(-0.3), g.Y(-0.1)))} ${pt(P(g.X(-0.7), g.Y(-0.12)))}Z`);
  const wingTip = P(g.X(0.7), g.Y(-0.2));
  const lashD = h.F(`${g.upper}Q${pt(P(g.X(0.62), g.Y(-0.08)))} ${pt(wingTip)}`);
  const cornerD = h.F(`M${pt(P(g.X(0.56), g.Y(-0.12)))}Q${pt(P(g.X(0.54), g.Y(0.12)))} ${pt(P(g.X(0.42), g.Y(0.28)))}`);
  const lowerD = h.F(`M${pt(P(g.X(0.44), g.Y(0.32)))}C${pt(P(g.X(0.3), g.Y(0.5)))} ${pt(P(g.X(0.1), g.Y(0.52)))} ${pt(P(g.X(-0.12), g.Y(0.5)))}`);
  const creaseD = h.F(`M${pt(P(g.X(-0.26), g.Y(-0.7)))}C${pt(P(g.X(0.04), g.Y(-0.8)))} ${pt(P(g.X(0.36), g.Y(-0.74)))} ${pt(P(g.X(0.56), g.Y(-0.46)))}`);
  const flick = (a: number, b: number, len: number) => h.F(`M${pt(P(g.X(a), g.Y(b)))}Q${pt(P(g.X(a + 0.08 * len), g.Y(b - 0.1 * len)))} ${pt(P(g.X(a + 0.2 * len), g.Y(b - 0.12 * len)))}`);
  const lw = st.lashW * s;
  const chibi = st.detail === "chibi";
  return `<defs>
<clipPath id="${id}"><path d="${open}"/></clipPath>
<linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${st.iris[0]}"/><stop offset="0.55" stop-color="${st.iris[1]}"/><stop offset="1" stop-color="${st.iris[2]}"/></linearGradient>
${chibi ? "" : `<filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${num(lw * 0.5)}"/></filter>`}
</defs>
<path d="${open}" fill="${st.white}"/>
<g clip-path="url(#${id})">
  <path d="${iris}" fill="url(#${id}i)" stroke="${st.rim}" stroke-width="${num(lw * (chibi ? 0.35 : 0.28))}"/>
  ${chibi ? "" : `<path d="${glow}" fill="${st.iris[2]}" opacity="0.7" filter="url(#${id}b)"/>`}
  <path d="${pupil}" fill="${st.pupil}"${chibi ? "" : ` opacity="0.85"`}/>
  <path d="${lidBand}" fill="${st.lidShade}" opacity="${chibi ? 0.45 : 0.5}"${chibi ? "" : ` filter="url(#${id}b)"`}/>
  <path d="${hl1}" fill="#fff"/>
  <path d="${hl2}" fill="#fff" opacity="0.9"/>
</g>
${ink(lashD, lw, st.lash, [0.12, 0.72, 0.02])}
${ink(cornerD, lw * 0.55, st.lash, [0.9, 0.2, 0.05])}
${chibi ? "" : `${ink(lowerD, lw * 0.22, st.lower, [0.05, 0.4, 0.1])}${ink(creaseD, lw * 0.18, st.lower, [0.05, 0.5, 0.1], 0.8)}${ink(flick(0.34, -0.48 * st.open, 1), lw * 0.35, st.lash, [0.9, 0.1, 0])}${ink(flick(0.46, -0.32 * st.open, 1.1), lw * 0.35, st.lash, [0.9, 0.1, 0])}`}`;
}

/** An eyebrow: a thin tapered stroke above the eye, following the face. `lift` raises the inner end (worry) or lowers it (determination). */
export function brow(h: Head, sx: 1 | -1, colour: string, w: number, lift = 0): string {
  const o = h.spec;
  const X = (k: number) => sx * o.eyeX + sx * k * o.eyeW;
  const d = h.F(`M${pt(P(X(-0.46), o.browY + 3 - lift))}C${pt(P(X(-0.15), o.browY - 3 - lift * 0.5))} ${pt(P(X(0.25), o.browY - 4))} ${pt(P(X(0.58), o.browY + 2))}`);
  return ink(d, w * h.s, colour, [0.55, 0.3, 0.05]);
}

/** Maps a list of head-unit points through the face and returns a smooth page path. */
export const faceCurve = (h: Head, pts: Pt[], closed = false): string => smooth(pts.map((p) => h.face(p)), closed);
