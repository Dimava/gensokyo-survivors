// Reimu Hakurei, after Alphes' IaMP/SWR portraits: dark brown hair with long
// side locks in red-and-white hair tubes, a huge red bow with white frills,
// a red sleeveless top with a frilled collar and a big yellow ascot, detached
// white sleeves laced with red, red skirt with a white frill.
//
// Built as the style reference: the construction (construct.ts) places the
// head, face and body landmarks; paint.ts draws the parts in layers on top.

import type { Drawing, Look } from "./drawing.ts";
import { body, bodyBones, type BodySpec, ellipseD, Head, type HeadSpec, lookKey, mirrorD, P, pt, type Pt, reversePath, smooth, taper, unite } from "./construct.ts";
import { EYES, GOLD, HAIR, RED, SKIN, WHITE } from "./reimu-palette.ts";
import { blur, brow, cast, celEdge, dashes, eye, type EyeStyle, frill, ink, outline, rim, strand } from "./paint.ts";

// ---------------------------------------------------------------- portrait construction

/** Teen proportions: eye line at half the head height, eyes one eye-width apart, small pointed chin. */
const PORTRAIT_HEAD: HeadSpec = {
  cx: 220,
  cy: 244,
  r: 92,
  yaw: 0.42,
  pitch: 0.2,
  lean: 6,
  eyeY: 24,
  eyeX: 45,
  eyeW: 52,
  eyeH: 54,
  browY: -8,
  noseY: 62,
  mouthY: 82,
  chinY: 108,
  cheekW: 90,
  jawW: 68,
  chinW: 28,
  frontEye: 88,
  frontChin: 74,
};

/** Bust: slim neck, shoulders about two head widths. */
const PORTRAIT_BODY: BodySpec = {
  cx: 220,
  neckW: 0.24,
  neckLen: 0.24,
  shoulderDrop: 0.22,
  shoulderW: 1.56,
  chestY: 0.95,
  waistY: 1.22,
  waistW: 0.8,
  hipY: 2,
  hipW: 1,
  kneeY: 3,
  ankleY: 4,
  arm: 0.78,
  armOut: 0.1,
};

// ---------------------------------------------------------------- portrait parts

/** The bangs, left to right: root, tip, width, bend (head units). Tips stop at the brows over the eyes. */
const BANGS: [root: Pt, tip: Pt, w: number, bend: number][] = [
  [P(-40, -68), P(-104, 50), 28, -18],
  [P(-26, -78), P(-70, -4), 34, -6],
  [P(-16, -82), P(-46, -10), 30, -3],
  [P(-8, -84), P(-24, 0), 26, -2],
  [P(0, -86), P(-2, 30), 18, 2],
  [P(8, -84), P(22, -2), 26, 2],
  [P(16, -82), P(46, -12), 30, 3],
  [P(26, -78), P(70, -6), 34, 6],
  [P(40, -68), P(104, 48), 28, 18],
];

/** A second, darker layer of bangs peeking between the front locks. */
const UNDER: [Pt, Pt, number, number][] = [
  [P(-30, -74), P(-58, 8), 24, -4],
  [P(-12, -80), P(-34, 10), 20, -2],
  [P(12, -80), P(34, 8), 20, 2],
  [P(30, -74), P(58, 6), 24, 4],
];

/** Back hair (head units): root, tip, width, bend. Rigid, behind the head, so it moves against the turn. */
const BACK: [Pt, Pt, number, number][] = [
  [P(-72, -30), P(-168, 196), 52, -30],
  [P(-70, -6), P(-144, 232), 46, -14],
  [P(-60, -10), P(-114, 222), 50, -10],
  [P(-36, 10), P(-70, 200), 44, 0],
  [P(72, -30), P(170, 192), 52, 30],
  [P(70, -6), P(146, 228), 46, 14],
  [P(60, -10), P(116, 218), 50, 10],
  [P(36, 10), P(72, 198), 44, 0],
];

/** Hair framing the face in front of the ears (left side; the right mirrors it). */
const SIDE: [Pt, Pt, number, number][] = [
  [P(-92, -14), P(-104, 98), 26, -6],
  [P(-86, -4), P(-92, 84), 18, -3],
];

/** The long side lock (left) and the height of its hair tube. */
const LOCK = { root: P(-80, -8), tip: P(-100, 350), w: 34, bend: -10, tubeY: 236 };

const flipT = ([r, t, w, bend]: [Pt, Pt, number, number]): [Pt, Pt, number, number] => [P(-r.x, r.y), P(-t.x, t.y), w, -bend];

/** Where the side lock's spine crosses height y (head units); sx = -1 left, +1 right. */
function lockX(sx: number, y: number): number {
  const { root, tip, bend } = LOCK;
  const t = (y - root.y) / (tip.y - root.y);
  const dx = tip.x - root.x;
  const dy = tip.y - root.y;
  const len = Math.hypot(dx, dy);
  return -sx * (root.x + dx * t + (-dy / len) * 3 * t * (1 - t) * bend);
}

/** A hair tube (head units): a red cylinder with a white frill skirt below; k scales it. */
function tube(X: number, Y: number, k = 1): { band: string; frill: string; folds: string } {
  const w = 12 * k;
  const u = (v: number) => v * k;
  const band = `M${X - w} ${Y - u(8)}C${X - w} ${Y - u(13)} ${X + w} ${Y - u(13)} ${X + w} ${Y - u(8)}L${X + w} ${Y + u(6)}C${X + w} ${Y + u(11)} ${X - w} ${Y + u(11)} ${X - w} ${Y + u(6)}Z`;
  let fr = `M${X - w} ${Y + u(6)}C${X - w} ${Y + u(11)} ${X + w} ${Y + u(11)} ${X + w} ${Y + u(6)}L${X + w + u(5)} ${Y + u(24)}`;
  let folds = "";
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x0 = X + (w + u(5)) - (i * 2 * (w + u(5))) / n;
    const x1 = X + (w + u(5)) - ((i + 1) * 2 * (w + u(5))) / n;
    fr += `Q${(x0 + x1) / 2} ${Y + u(30)} ${x1} ${Y + u(24)}`;
    if (i < n - 1) folds += `M${x1} ${Y + u(24)}L${X + (x1 - X) * 0.7} ${Y + u(12)}`;
  }
  return { band, frill: `${fr}Z`, folds };
}

function portraitBody(look: Look): string {
  const id = `rmP${lookKey(look)}`;
  const o = PORTRAIT_HEAD;
  const h = new Head(o, look);
  const b = body(h, PORTRAIT_BODY);
  const s = h.s;
  const c = b.sternum.x;
  const mir = (d: string) => mirrorD(d, c);
  const face = h.outline();

  // ---- hair shapes
  const bangs = BANGS.map(([r, t, w, bend]) => strand(r, t, w, bend));
  const under = unite(UNDER.map(([r, t, w, bend]) => h.S(strand(r, t, w, bend).shape)).join(""));
  const wisps = [strand(P(-10, -74), P(-34, 14), 12, -2), strand(P(12, -74), P(34, 12), 12, 2), strand(P(-26, -70), P(-84, 22), 12, -6), strand(P(28, -70), P(86, 20), 12, 6)];
  const bangD = unite(bangs.map((x) => h.S(x.shape)).join(""));
  const cap = unite(h.S(`M-106 18C-112 -44 -70 -110 0 -110C70 -110 112 -44 106 18C94 -20 60 -44 0 -46C-60 -44 -94 -20 -106 18Z`));
  const sides = [...SIDE, ...SIDE.map(flipT)].map(([r, t, w, bend]) => strand(r, t, w, bend));
  const sideMap = (d: string) => h.H(d, -20);
  const sideD = unite(sides.map((x) => sideMap(x.shape)).join(""));
  const lockMap = (d: string) => h.H(d, 10);
  const locks = [LOCK, { ...LOCK, root: P(-LOCK.root.x, LOCK.root.y), tip: P(-LOCK.tip.x, LOCK.tip.y), bend: -LOCK.bend }].map((l) => strand(l.root, l.tip, l.w, l.bend, l.bend * -1.6, 0.1));
  const tubes = [-1, 1].map((sx) => tube(lockX(sx, LOCK.tubeY), LOCK.tubeY));
  const back = BACK.map(([r, t, w, bend]) => strand(r, t, w, bend, 0, 0.15));
  const backMap = (d: string) => h.B(d, -30);
  const backD = unite(backMap(`M-104 -10C-104 -70 -60 -108 0 -108C60 -108 104 -70 104 -10L116 190C60 214 -60 214 -116 190Z`) + back.map((x) => backMap(x.shape)).join(""));
  const frontHair = unite(cap + bangD + sideD);
  const capBang = unite(cap + bangD);

  // ---- bow (rigid, behind the crown)
  const bow = (d: string) => h.B(d, -42);
  const loopL = bow(`M-14 -120C-40 -150 -86 -190 -140 -188C-156 -162 -162 -122 -156 -80C-116 -84 -60 -94 -14 -104Z`);
  const loopR = bow(`M14 -120C42 -152 90 -192 142 -186C158 -158 164 -118 156 -78C116 -82 60 -94 14 -104Z`);
  const fl = frill(bow(`M-112 -191C-126 -190 -134 -189 -141 -188C-156 -163 -163 -122 -157 -80C-146 -80 -136 -81 -124 -82`), 13 * s, 7, 1);
  const fr = frill(bow(`M114 -190C128 -188 136 -187 143 -186C159 -158 165 -118 157 -78C146 -78 136 -79 124 -80`), 13 * s, 7, -1);
  const knot = bow(`M-19 -128C-10 -133 10 -133 19 -128C22 -116 22 -104 17 -92C8 -88 -8 -88 -17 -92C-22 -104 -22 -116 -19 -128Z`);
  const tails = bow(`M-10 -100C-60 -96 -120 -70 -168 -20L-150 -14L-156 12C-110 -40 -60 -76 -4 -88ZM10 -100C60 -92 118 -60 160 -4L142 -2L144 24C104 -26 56 -70 4 -88Z`);

  // ---- body (page units from the landmarks; the left half authored, the right mirrored)
  const nB = b.neckBL;
  const skinL = `M${pt(b.neckTL)}C${pt(P(b.neckTL.x + 1, b.neckTL.y + 40))} ${pt(P(nB.x - 1, nB.y - 24))} ${pt(P(nB.x - 4, nB.y))}C${pt(P(nB.x - 30, nB.y + 12))} ${pt(P(b.shL.x + 60, b.shL.y - 14))} ${pt(P(b.shL.x + 16, b.shL.y - 5))}C${pt(P(b.shL.x - 4, b.shL.y + 1))} ${pt(P(b.shL.x - 12, b.shL.y + 24))} ${pt(P(b.shL.x - 12, b.shL.y + 60))}L${pt(P(b.shL.x - 14, b.shL.y + 110))}L${c} ${b.shL.y + 110}`;
  const skin = `${skinL}${reversePath(mir(skinL)).replace(/^M/, "L")}Z`;
  const strapL = P(nB.x - 50, nB.y + 22);
  const armL = `M${pt(strapL)}C${pt(P(strapL.x - 14, strapL.y + 34))} ${pt(P(b.apL.x + 12, b.apL.y - 34))} ${pt(P(b.apL.x + 6, b.apL.y))}`;
  const bodiceL = `M${c} ${nB.y + 2}L${pt(P(nB.x - 4, nB.y + 4))}C${pt(P(nB.x - 22, nB.y + 12))} ${pt(P(strapL.x + 14, strapL.y - 4))} ${pt(strapL)}${armL.replace(/^M[^C]*/, "")}C${pt(P(b.apL.x - 4, b.apL.y + 44))} ${pt(P(c - 78, b.waist.y - 50))} ${pt(P(c - 70, b.waist.y))}L${c} ${b.waist.y}`;
  const bodice = `${bodiceL}${reversePath(mir(bodiceL)).replace(/^M/, "L")}Z`;
  const skirt = `M${c - 74} ${b.waist.y - 6}C${c - 30} ${b.waist.y - 2} ${c + 30} ${b.waist.y - 2} ${c + 74} ${b.waist.y - 6}C${c + 92} ${b.waist.y + 30} ${c + 110} 630 ${c + 124} 660L${c - 124} 660C${c - 110} 630 ${c - 92} ${b.waist.y + 30} ${c - 74} ${b.waist.y - 6}Z`;
  const armFrL = frill(armL, 10, 7, 1);
  const armFrR = frill(mir(armL), 10, 7, -1);
  const collarL = `M${pt(P(nB.x + 6, nB.y - 20))}C${pt(P(nB.x - 18, nB.y - 8))} ${pt(P(nB.x - 36, nB.y + 14))} ${pt(P(nB.x - 42, nB.y + 30))}C${pt(P(nB.x - 18, nB.y + 42))} ${pt(P(c - 22, nB.y + 46))} ${pt(P(c, nB.y + 52))}L${c} ${nB.y + 8}C${pt(P(c - 12, nB.y + 4))} ${pt(P(nB.x + 14, nB.y - 6))} ${pt(P(nB.x + 6, nB.y - 20))}Z`;
  const collarHemL = `M${pt(P(nB.x - 42, nB.y + 30))}C${pt(P(nB.x - 18, nB.y + 42))} ${pt(P(c - 22, nB.y + 46))} ${pt(P(c, nB.y + 52))}`;
  const colFrL = frill(collarHemL, 9, 6, -1);
  const colFrR = frill(mir(collarHemL), 9, 6, 1);
  const collar = unite(collarL + mir(collarL));
  // Ascot: knot at the throat, a frilled cascade, and two puffed wings.
  const aY = nB.y + 22;
  const cascade = `M${c - 12} ${aY + 8}C${c - 30} ${aY + 40} ${c - 36} ${aY + 70} ${c - 26} ${aY + 92}Q${c - 16} ${aY + 84} ${c - 9} ${aY + 96}Q${c - 1} ${aY + 84} ${c + 7} ${aY + 96}Q${c + 15} ${aY + 84} ${c + 24} ${aY + 92}C${c + 34} ${aY + 70} ${c + 28} ${aY + 40} ${c + 12} ${aY + 8}Z`;
  const wingL = `M${c - 6} ${aY - 2}C${c - 40} ${aY - 22} ${c - 66} ${aY + 8} ${c - 54} ${aY + 34}Q${c - 46} ${aY + 42} ${c - 40} ${aY + 36}Q${c - 32} ${aY + 46} ${c - 24} ${aY + 38}Q${c - 16} ${aY + 44} ${c - 10} ${aY + 34}C${c - 8} ${aY + 22} ${c - 6} ${aY + 12} ${c - 4} ${aY + 6}Z`;
  const wings = unite(wingL + mir(wingL));
  const aKnot = `M${c - 13} ${aY - 6}C${c - 6} ${aY - 12} ${c + 6} ${aY - 12} ${c + 13} ${aY - 6}C${c + 16} ${aY + 2} ${c + 14} ${aY + 10} ${c + 8} ${aY + 14}C${c + 2} ${aY + 16} ${c - 2} ${aY + 16} ${c - 8} ${aY + 14}C${c - 14} ${aY + 10} ${c - 16} ${aY + 2} ${c - 13} ${aY - 6}Z`;
  const ascot = unite(cascade + wings + aKnot);
  // Detached sleeves: bells hanging from the upper arm, tied at the top.
  const sy = b.shL.y + 72;
  const sleeveTopL = `M${pt(P(b.shL.x - 18, sy))}C${pt(P(b.shL.x - 4, sy - 6))} ${pt(P(b.apL.x + 2, sy - 6))} ${pt(P(b.apL.x + 16, sy + 2))}`;
  const sleeveL = `${sleeveTopL}C${pt(P(b.apL.x + 26, sy + 60))} ${pt(P(b.apL.x + 36, sy + 120))} ${pt(P(b.apL.x + 40, 660))}L${pt(P(Math.max(6, b.shL.x - 76), 660))}C${pt(P(b.shL.x - 64, sy + 110))} ${pt(P(b.shL.x - 34, sy + 40))} ${pt(P(b.shL.x - 18, sy))}Z`;
  const laceL = `M${pt(P(b.shL.x - 22, sy + 16))}C${pt(P(b.shL.x - 6, sy + 10))} ${pt(P(b.apL.x + 4, sy + 10))} ${pt(P(b.apL.x + 20, sy + 18))}`;
  const foldL = `M${pt(P(b.shL.x - 4, sy + 30))}C${pt(P(b.shL.x - 10, sy + 80))} ${pt(P(b.shL.x - 18, sy + 120))} ${pt(P(b.shL.x - 26, 650))}`;
  const sfL = frill(sleeveTopL, 9, 6, 1);
  const sfR = frill(mir(sleeveTopL), 9, 6, -1);
  const sleeves = unite(sleeveL + mir(sleeveL));
  const bowSmall = (x0: number, y0: number, k = 1.5) =>
    `M${x0} ${y0}C${x0 - 6 * k} ${y0 - 12 * k} ${x0 - 18 * k} ${y0 - 12 * k} ${x0 - 18 * k} ${y0 - 2 * k}C${x0 - 18 * k} ${y0 + 8 * k} ${x0 - 6 * k} ${y0 + 6 * k} ${x0} ${y0}ZM${x0} ${y0}C${x0 + 6 * k} ${y0 - 12 * k} ${x0 + 18 * k} ${y0 - 12 * k} ${x0 + 18 * k} ${y0 - 2 * k}C${x0 + 18 * k} ${y0 + 8 * k} ${x0 + 6 * k} ${y0 + 6 * k} ${x0} ${y0}ZM${x0} ${y0}L${x0 - 8 * k} ${y0 + 18 * k}L${x0 - 3 * k} ${y0 + 17 * k}ZM${x0} ${y0}L${x0 + 6 * k} ${y0 + 19 * k}L${x0 + 10 * k} ${y0 + 16 * k}Z`;
  const sBows = bowSmall(b.shL.x - 10, sy + 14) + mir(bowSmall(b.shL.x - 10, sy + 14));

  // ---- face details
  const eyeStyle: EyeStyle = { ...EYES, open: 0.86, lashW: 6.2, detail: "full" };
  const nose = h.F(`M1 ${o.noseY - 6}Q3 ${o.noseY - 1} -1 ${o.noseY + 1}`, 7);
  const noseHi = h.F(ellipseD(-3, o.noseY - 6, 1.6, 2.6), 7);
  const mouth = h.F(`M-8 ${o.mouthY}Q-1 ${o.mouthY + 2.2} 9 ${o.mouthY - 1.6}`, 2);
  const lip = h.F(`M-4 ${o.mouthY + 6}Q0 ${o.mouthY + 7.5} 4 ${o.mouthY + 6}`, 2);
  const blushD = h.F(ellipseD(-o.eyeX - 4, o.noseY - 6, 17, 7)) + h.F(ellipseD(o.eyeX + 4, o.noseY - 6, 17, 7));
  const hatch = (sx: number) => [0, 1, 2].map((i) => ink(h.F(`M${sx * (o.eyeX - 8 + i * 7)} ${o.noseY - 2}L${sx * (o.eyeX - 4 + i * 7)} ${o.noseY - 10}`), 1.3, SKIN.deep, [0.2, 0.5, 0.2], 0.7)).join("");
  const ears = [-1, 1].map((sx) => h.B(`M${sx * 94} 6C${sx * 108} 0 ${sx * 112} 26 ${sx * 104} 44C${sx * 100} 52 ${sx * 94} 52 ${sx * 92} 46Z`, -8)).join("");

  // ---- hair highlights: an arc of streaks round the crown (the "angel ring"), then fine shine
  let ring = "";
  let shine = "";
  for (let i = -6; i <= 6; i++) {
    const x = i * 13;
    const y = -62 + (x / 100) ** 2 * 34;
    const ang = Math.atan2(y + 110, x);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const len = 26 - Math.abs(i) * 1.2;
    ring += taper(h.S(`M${x - ux * len} ${y - uy * len}L${x + ux * len * 0.8} ${y + uy * len * 0.8}`), (11 - Math.abs(i) * 0.5) * s, [0.1, 0.4, 0.05]);
    if (i % 3 === 1) shine += taper(h.S(`M${x - ux * len * 0.7} ${y - uy * len * 0.7}L${x + ux * len * 0.4} ${y + uy * len * 0.4}`), 1.8 * s, [0.1, 0.5, 0.1]);
  }
  const hairInk = (st: { left: string; right: string }, map: (d: string) => string, w: number) =>
    ink(map(st.left), w, HAIR.line, [0.02, 0.65, 0.02]) + ink(map(st.right), w * 1.3, HAIR.line, [0.02, 0.6, 0.02]);
  const shadeEdge = (st: { right: string }, map: (d: string) => string, w: number) => ink(map(st.right), w, HAIR.shade, [0.1, 0.55, 0.05]);

  return `
<defs>
  <radialGradient id="${id}glow" cx="220" cy="250" r="210" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff8aa0" stop-opacity="0.55"/><stop offset="0.5" stop-color="#e8405e" stop-opacity="0.2"/><stop offset="1" stop-color="#c02040" stop-opacity="0"/></radialGradient>
  <clipPath id="${id}frame"><rect width="440" height="640"/></clipPath>
  <linearGradient id="${id}skin" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#fff6ee"/><stop offset="1" stop-color="${SKIN.base}"/></linearGradient>
  <linearGradient id="${id}red" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#ef3248"/><stop offset="1" stop-color="#d61d38"/></linearGradient>
  <linearGradient id="${id}hair" x1="0" y1="0" x2="0.2" y2="1"><stop offset="0" stop-color="${HAIR.top}"/><stop offset="0.5" stop-color="${HAIR.base}"/><stop offset="1" stop-color="${HAIR.bottom}"/></linearGradient>
  ${blur(`${id}b4`, 4)}
</defs>
<g clip-path="url(#${id}frame)">
<rect width="440" height="640" fill="url(#${id}glow)"/>

<!-- bow tails and back hair -->
<path d="${tails}" fill="${RED.shade}" stroke="${RED.line}" stroke-width="2" stroke-linejoin="round"/>
<path d="${backD}" fill="none" stroke="${HAIR.line}" stroke-width="5"/>
<path d="${backD}" fill="${HAIR.shade}"/>
${back.map((x) => ink(backMap(x.spine), 5, HAIR.base, [0.1, 0.4, 0.05]) + ink(backMap(x.right), 2, HAIR.line, [0.05, 0.6, 0.02])).join("")}

<!-- bow loops -->
<path d="${loopL}${loopR}" fill="url(#${id}red)" stroke="${RED.line}" stroke-width="2.4" stroke-linejoin="round"/>
${celEdge(`${id}bl`, loopL, loopL, RED.shade, 0, 16)}
${celEdge(`${id}br`, loopR, loopR, RED.shade, 8, 14)}
<path d="${bow(`M-36 -112C-66 -130 -104 -140 -134 -140M-36 -104C-76 -106 -114 -98 -144 -92M36 -112C66 -132 104 -142 136 -140M36 -104C76 -106 114 -96 144 -90`)}" fill="none" stroke="${RED.deep}" stroke-width="1.6" opacity="0.7"/>
${ink(bow(`M-30 -138C-60 -162 -96 -178 -130 -178`), 5, RED.hi, [0.05, 0.4, 0.05], 0.8)}
${ink(bow(`M30 -138C60 -164 96 -180 132 -178`), 4, RED.hi, [0.05, 0.4, 0.05], 0.6)}
<path d="${fl.shape}${fr.shape}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="${fl.folds}${fr.folds}" stroke="${WHITE.deep}" stroke-width="1.4" fill="none"/>
${celEdge(`${id}bf`, fr.shape, fr.shape, WHITE.shade, 5, 4)}
<path d="${knot}" fill="url(#${id}red)" stroke="${RED.line}" stroke-width="2.4"/>
${celEdge(`${id}bk`, knot, knot, RED.shade, 6, 8)}

<!-- body skin -->
<path d="${skin}" fill="url(#${id}skin)" stroke="${SKIN.line}" stroke-width="2"/>
${cast(`${id}ns`, face, skin, SKIN.shade, 4, 18)}
${celEdge(`${id}ss`, skin, skin, SKIN.shade, 10, 0)}

${ink(`M${pt(P(nB.x + 6, nB.y + 14))}C${pt(P(nB.x - 20, nB.y + 22))} ${pt(P(b.shL.x + 70, b.shL.y + 4))} ${pt(P(b.shL.x + 44, b.shL.y + 2))}`, 2, SKIN.deep, [0.1, 0.4, 0.05], 0.7)}
${ink(mir(`M${pt(P(nB.x + 6, nB.y + 14))}C${pt(P(nB.x - 20, nB.y + 22))} ${pt(P(b.shL.x + 70, b.shL.y + 4))} ${pt(P(b.shL.x + 44, b.shL.y + 2))}`), 2, SKIN.deep, [0.1, 0.4, 0.05], 0.7)}
<!-- sleeves -->
<path d="${sleeves}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="2.2" stroke-linejoin="round"/>
${celEdge(`${id}sl`, sleeves, sleeves, WHITE.shade, 22, 0)}
${ink(foldL, 2.4, WHITE.deep, [0.05, 0.5, 0.1])}${ink(mir(foldL), 2.4, WHITE.deep, [0.05, 0.5, 0.1])}
<path d="${sfL.shape}${sfR.shape}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="1.4" stroke-linejoin="round"/>
${dashes(laceL, 5, 7, 3.2, RED.base)}${dashes(mir(laceL), 5, 7, 3.2, RED.base)}
<path d="${sBows}" fill="${RED.base}" stroke="${RED.line}" stroke-width="1.6" stroke-linejoin="round"/>

<!-- skirt -->
<path d="${skirt}" fill="${RED.shade}"/>
${ink(`M${c - 40} ${b.waist.y + 8}C${c - 46} 620 ${c - 52} 640 ${c - 56} 660M${c + 10} ${b.waist.y + 8}L${c + 14} 660M${c + 56} ${b.waist.y + 6}C${c + 64} 620 ${c + 72} 640 ${c + 78} 660`, 2.2, RED.deep, [0.1, 0.5, 0.3], 0.8)}
${outline(`${id}sko`, skirt, RED.line, 1.8, 3.4)}
<!-- bodice -->
<path d="${bodice}" fill="url(#${id}red)"/>
${celEdge(`${id}bd`, bodice, bodice, RED.shade, 16, 0)}
${cast(`${id}as`, ascot, bodice, RED.shade, 6, 12)}
${ink(`M${c - 36} ${aY + 116}C${c - 40} ${b.waist.y - 50} ${c - 40} ${b.waist.y - 20} ${c - 38} ${b.waist.y - 4}M${c + 46} ${aY + 120}C${c + 50} ${b.waist.y - 50} ${c + 50} ${b.waist.y - 20} ${c + 48} ${b.waist.y - 4}`, 2, RED.deep, [0.05, 0.5, 0.2], 0.5)}
${outline(`${id}bdo`, bodice, RED.line, 1.8, 3.4)}
<path d="${armFrL.shape}${armFrR.shape}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="${armFrL.folds}${armFrR.folds}" stroke="${WHITE.deep}" stroke-width="1.2" fill="none"/>

<!-- collar and ascot -->
<path d="${collar}" fill="url(#${id}red)" stroke="${RED.line}" stroke-width="2" stroke-linejoin="round"/>
${celEdge(`${id}cl`, collar, collar, RED.shade, 8, 6)}
<path d="${colFrL.shape}${colFrR.shape}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="1.3" stroke-linejoin="round"/>
<path d="${cascade}" fill="${GOLD.base}"/>
${celEdge(`${id}ac`, cascade, cascade, GOLD.shade, 10, 4)}
${outline(`${id}aco`, cascade, GOLD.line, 1.6, 3)}
${ink(`M${c - 4} ${aY + 14}C${c - 10} ${aY + 40} ${c - 14} ${aY + 64} ${c - 9} ${aY + 92}M${c + 4} ${aY + 14}C${c + 6} ${aY + 44} ${c + 6} ${aY + 64} ${c + 7} ${aY + 92}`, 2, GOLD.deep, [0.05, 0.6, 0.1])}
<path d="${wings}" fill="${GOLD.base}"/>
${celEdge(`${id}aw`, wings, wings, GOLD.shade, 6, 8)}
${ink(`M${c - 10} ${aY + 2}C${c - 30} ${aY + 2} ${c - 44} ${aY + 14} ${c - 46} ${aY + 30}M${c + 10} ${aY + 2}C${c + 30} ${aY + 2} ${c + 44} ${aY + 14} ${c + 46} ${aY + 30}`, 2, GOLD.deep, [0.05, 0.5, 0.1])}
${ink(`M${c - 12} ${aY - 6}C${c - 30} ${aY - 14} ${c - 48} ${aY - 6} ${c - 52} ${aY + 12}`, 4, GOLD.hi, [0.05, 0.5, 0.05])}
${outline(`${id}awo`, wings, GOLD.line, 1.6, 3)}
<path d="${aKnot}" fill="${GOLD.base}" stroke="${GOLD.line}" stroke-width="2"/>
${celEdge(`${id}ak`, aKnot, aKnot, GOLD.shade, 5, 6)}
<path d="${ellipseD(c - 4, aY - 1, 5, 3)}" fill="${GOLD.hi}"/>

<!-- side locks -->
${locks.map((x) => `<path d="${lockMap(x.shape)}" fill="url(#${id}hair)" stroke="${HAIR.line}" stroke-width="2.2"/>${shadeEdge(x, lockMap, 7)}${ink(lockMap(x.spine), 1.6, HAIR.hi, [0.05, 0.3, 0.05], 0.8)}`).join("")}

<!-- face -->
<path d="${ears}" fill="${SKIN.base}" stroke="${SKIN.line}" stroke-width="1.6"/>
<path d="${face}" fill="url(#${id}skin)"/>
${celEdge(`${id}fs`, face, face, SKIN.shade, 12, 4)}
${cast(`${id}bs`, bangD + sideD, face, SKIN.shade, 4, 10)}
${cast(`${id}ao`, bangD, face, SKIN.deep, 3, 5, 3, 0.35)}
<path d="${blushD}" fill="${SKIN.blush}" opacity="0.45" filter="url(#${id}b4)"/>
${hatch(-1)}${hatch(1)}
${eye(`${id}el`, h, -1, eyeStyle)}
${eye(`${id}er`, h, 1, eyeStyle)}
${brow(h, -1, HAIR.line, 2.4)}${brow(h, 1, HAIR.line, 2.4)}
<path d="${noseHi}" fill="#fff" opacity="0.8"/>
${ink(nose, 2.2, SKIN.line, [0.1, 0.7, 0.3])}
${ink(mouth, 2.6, SKIN.line, [0.2, 0.45, 0.15])}
${ink(lip, 1.6, SKIN.deep, [0.1, 0.5, 0.1], 0.8)}
${ink(smooth(h.jaw(-1, o.noseY - 20)), 1.8, SKIN.line, [0.1, 0.5, 0.4])}
${ink(smooth(h.jaw(1, o.noseY - 20)), 3, SKIN.line, [0.2, 0.55, 0.5])}

<!-- front hair: side hair, cap, bangs -->
<path d="${frontHair}" fill="none" stroke="${HAIR.line}" stroke-width="5" stroke-linejoin="round"/>
<path d="${sideD}" fill="url(#${id}hair)"/>
<path d="${under}" fill="${HAIR.shade}" stroke="${HAIR.line}" stroke-width="2"/>
<path d="${capBang}" fill="url(#${id}hair)"/>
${celEdge(`${id}hs`, capBang, capBang, HAIR.shade, 10, 10, 0.9)}
<path d="${ring}" fill="${HAIR.hi}"/>
<path d="${shine}" fill="${HAIR.shine}"/>
${bangs.map((x) => shadeEdge(x, h.S, 3.5) + hairInk(x, h.S, 1.6)).join("")}
${wisps.map((x) => `<path d="${h.S(x.shape)}" fill="${HAIR.shade}"/>${ink(h.S(x.spine), 1.4, HAIR.line, [0.05, 0.6, 0.02])}`).join("")}
${sides.map((x) => shadeEdge(x, sideMap, 6) + hairInk(x, sideMap, 1.8)).join("")}

<!-- hair tubes -->
${tubes
  .map((t, i) => {
    const band = lockMap(t.band);
    const skirt = lockMap(t.frill);
    return `<path d="${skirt}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="${lockMap(t.folds)}" stroke="${WHITE.deep}" stroke-width="1.2" fill="none"/>
${celEdge(`${id}tf${i}`, skirt, skirt, WHITE.shade, 4, 0)}
<path d="${band}" fill="${RED.base}" stroke="${RED.line}" stroke-width="1.8"/>
${celEdge(`${id}tb${i}`, band, band, RED.shade, 5, 0)}`;
  })
  .join("")}
${rim(`${id}rim`, unite(backD + frontHair + face + skin + sleeves + bodice + skirt + loopL + loopR), "#ffc2d4", 3.2, 0.5)}
</g>`;
}

function portraitBones(look: Look): string {
  const h = new Head(PORTRAIT_HEAD, look);
  return h.bones() + bodyBones(body(h, PORTRAIT_BODY));
}

export const portrait: Drawing = { w: 220, h: 320, scale: 2, body: portraitBody, bones: portraitBones };

export { sprite } from "./reimu-sprite.ts";
