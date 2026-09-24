// Reimu's field sprite: the portrait's design simplified to a 2.2-head chibi,
// built with the same construction (construct.ts) and paint (paint.ts).
// Readability at 1x on the dark field comes first: a dark outer outline round
// the whole silhouette, big flat colour blocks, one cel shadow tone per
// material, and eyes reduced to a dark iris with a catchlight.

import type { Drawing, Look } from "./drawing.ts";
import { body, bodyBones, type Body, type BodySpec, ellipseD, Head, type HeadSpec, lookKey, mirrorD, P, type Pt, unite } from "./construct.ts";
import { celEdge, eye, type EyeStyle, frill, ink, strand } from "./paint.ts";
import { EYES, GOLD, HAIR, RED, SKIN, WHITE } from "./reimu-palette.ts";

/** Chibi head: eyes low and huge, short round jaw. 192x208 units (scale 4). */
const HEAD: HeadSpec = {
  cx: 96,
  cy: 72,
  r: 40,
  yaw: 0.5,
  pitch: 0.16,
  lean: 3,
  eyeY: 34,
  eyeX: 40,
  eyeW: 44,
  eyeH: 54,
  browY: 2,
  noseY: 60,
  mouthY: 72,
  chinY: 96,
  cheekW: 94,
  jawW: 78,
  chinW: 40,
  frontEye: 90,
  frontChin: 82,
};

/** Chibi body: about 1.2 head heights from chin to sole; shoulders 0.7 head widths. */
const BODY: BodySpec = {
  cx: 96,
  neckW: 0.2,
  neckLen: 0.06,
  shoulderDrop: 0.04,
  shoulderW: 0.66,
  chestY: 0.24,
  waistY: 0.42,
  waistW: 0.5,
  hipY: 0.5,
  hipW: 0.5,
  kneeY: 0.86,
  ankleY: 1.08,
  arm: 0.26,
  armOut: 0.35,
};

const OUT = "#1a0d12";

/** Bangs: root, tip, width, bend (head units). Fewer, bolder locks than the portrait. */
const BANGS: [Pt, Pt, number, number][] = [
  [P(-40, -66), P(-100, 44), 34, -16],
  [P(-26, -76), P(-66, 8), 36, -6],
  [P(-10, -82), P(-30, 12), 32, -2],
  [P(4, -84), P(2, 26), 22, 1],
  [P(14, -82), P(32, 10), 32, 2],
  [P(28, -76), P(66, 6), 36, 6],
  [P(40, -66), P(100, 42), 34, 16],
];

/** Hair, bow and hair tubes, projected through the head (page units). */
function hairParts(h: Head) {
  const bangs = unite(BANGS.map(([r, t, w, bend]) => h.S(strand(r, t, w, bend).shape)).join(""));
  const cap = h.S(`M-108 20C-114 -46 -70 -112 0 -112C70 -112 114 -46 108 20C96 -20 60 -44 0 -46C-60 -44 -96 -20 -108 20Z`);
  const lockMap = (d: string) => h.H(d, 0);
  const locks = unite(lockMap(strand(P(-88, -6), P(-98, 196), 30, -8, 10, 0.1).shape) + lockMap(strand(P(88, -6), P(98, 196), 30, 8, -10, 0.1).shape));
  const tubes = [-1, 1].map((sx) => {
    const x = sx * 94;
    return {
      band: lockMap(`M${x - 15} 150C${x - 15} 143 ${x + 15} 143 ${x + 15} 150L${x + 15} 164C${x + 15} 170 ${x - 15} 170 ${x - 15} 164Z`),
      frill: lockMap(`M${x - 15} 164L${x - 20} 184Q${x - 12} 190 ${x - 5} 184Q${x} 191 ${x + 5} 184Q${x + 12} 190 ${x + 20} 184L${x + 15} 164Z`),
    };
  });
  const back = h.B(`M-104 -10C-106 -80 -60 -110 0 -110C60 -110 106 -80 104 -10C112 60 118 130 110 170L84 150L70 176L40 150L0 168L-40 150L-70 176L-84 150L-110 170C-118 130 -112 60 -104 -10Z`, -30);
  const bow = (d: string) => h.B(d, -46);
  return {
    bangs,
    cap,
    locks,
    tubes,
    back,
    loops: bow(`M-12 -110C-40 -150 -96 -178 -138 -160C-150 -130 -146 -96 -134 -76C-96 -80 -48 -92 -12 -96ZM12 -110C40 -150 96 -178 138 -160C150 -130 146 -96 134 -76C96 -80 48 -92 12 -96Z`),
    bowFrill: bow(`M-138 -160C-150 -130 -146 -96 -134 -76L-120 -80C-130 -98 -134 -128 -124 -154ZM138 -160C150 -130 146 -96 134 -76L120 -80C130 -98 134 -128 124 -154Z`),
    knot: bow(`M-18 -118C-8 -124 8 -124 18 -118C21 -108 21 -98 16 -88C6 -84 -6 -84 -16 -88C-21 -98 -21 -108 -18 -118Z`),
    tails: bow(`M-10 -96C-50 -80 -100 -40 -132 10L-112 6L-108 30C-80 -20 -44 -60 -2 -86ZM10 -96C50 -80 100 -40 132 10L112 6L108 30C80 -20 44 -60 2 -86Z`),
  };
}

/** Body and clothes from the body landmarks (page units): the left half is authored, the right mirrored. */
function clothes(b: Body) {
  const c = b.sternum.x;
  const both = (d: string) => d + mirrorD(d, c);
  const hemY = b.knL.y - 2;
  const skirt = `M${c - 19} ${b.waist.y - 3}L${c + 19} ${b.waist.y - 3}C${c + 26} ${hemY - 20} ${c + 34} ${hemY - 8} ${c + 40} ${hemY}C${c + 20} ${hemY + 6} ${c - 20} ${hemY + 6} ${c - 40} ${hemY}C${c - 34} ${hemY - 8} ${c - 26} ${hemY - 20} ${c - 19} ${b.waist.y - 3}Z`;
  const hem = frill(`M${c + 40} ${hemY}C${c + 20} ${hemY + 6} ${c - 20} ${hemY + 6} ${c - 40} ${hemY}`, 7, 6, -1);
  const a = b.anL;
  const legs = both(`M${b.knL.x - 6} ${hemY}L${a.x - 5} ${a.y}L${a.x + 5} ${a.y}L${b.knL.x + 5} ${hemY}Z`);
  const socks = both(`M${a.x - 6} ${a.y - 12}L${a.x + 6} ${a.y - 12}L${a.x + 6} ${a.y + 2}L${a.x - 6} ${a.y + 2}Z`);
  const shoes = both(`M${a.x - 8} ${a.y + 6}C${a.x - 8} ${a.y - 2} ${a.x + 8} ${a.y - 2} ${a.x + 8} ${a.y + 4}C${a.x + 8} ${a.y + 9} ${a.x - 8} ${a.y + 10} ${a.x - 8} ${a.y + 6}Z`);
  const s = b.shL;
  const vest = unite(both(`M${c} ${b.neckBL.y}L${s.x + 6} ${s.y + 1}C${s.x + 2} ${s.y + 8} ${s.x + 4} ${b.chest.y} ${c - 20} ${b.waist.y}L${c} ${b.waist.y}Z`));
  const e = b.elL;
  const arms = both(`M${s.x + 4} ${s.y}C${s.x - 4} ${s.y} ${e.x - 4} ${e.y - 8} ${e.x - 3} ${e.y}L${e.x + 5} ${e.y}C${e.x + 4} ${e.y - 8} ${s.x + 6} ${s.y + 8} ${s.x + 8} ${s.y + 4}Z`);
  const w = b.wrL;
  const sT = s.y + 8;
  const sleeves = unite(
    both(`M${s.x - 7} ${sT}C${s.x - 2} ${sT - 3} ${s.x + 4} ${sT - 3} ${s.x + 7} ${sT}C${w.x + 8} ${w.y - 6} ${w.x + 12} ${w.y} ${w.x + 12} ${w.y + 6}C${w.x + 2} ${w.y + 10} ${w.x - 10} ${w.y + 10} ${w.x - 16} ${w.y + 4}C${w.x - 14} ${w.y - 10} ${s.x - 12} ${sT + 10} ${s.x - 7} ${sT}Z`),
  );
  const trim = both(`M${s.x - 8} ${sT + 4}C${s.x - 2} ${sT} ${s.x + 4} ${sT} ${s.x + 8} ${sT + 4}`);
  const cuff = both(`M${w.x - 15} ${w.y + 1}C${w.x - 8} ${w.y + 6} ${w.x + 4} ${w.y + 6} ${w.x + 11} ${w.y + 3}`);
  const hands = both(`M${w.x - 1} ${w.y + 4}C${w.x - 6} ${w.y + 6} ${w.x - 5} ${w.y + 14} ${w.x} ${w.y + 14}C${w.x + 5} ${w.y + 14} ${w.x + 5} ${w.y + 6} ${w.x - 1} ${w.y + 4}Z`);
  const neck = `M${b.neckTL.x} ${b.neckTL.y}L${b.neckBL.x} ${b.neckBL.y + 2}L${b.neckBR.x} ${b.neckBR.y + 2}L${b.neckTR.x} ${b.neckTR.y}Z`;
  const n = b.neckBL;
  const collar = unite(both(`M${c} ${n.y + 8}L${n.x - 1} ${n.y - 2}L${n.x - 7} ${n.y + 3}C${n.x - 4} ${n.y + 8} ${c - 6} ${n.y + 11} ${c} ${n.y + 12}Z`));
  const y = n.y + 7;
  const ascot = `M${c} ${y}C${c - 6} ${y - 6} ${c - 13} ${y - 3} ${c - 11} ${y + 4}C${c - 9} ${y + 7} ${c - 4} ${y + 5} ${c - 2} ${y + 3}L${c - 5} ${y + 15}L${c} ${y + 12}L${c + 5} ${y + 15}L${c + 2} ${y + 3}C${c + 4} ${y + 5} ${c + 9} ${y + 7} ${c + 11} ${y + 4}C${c + 13} ${y - 3} ${c + 6} ${y - 6} ${c} ${y}Z`;
  const folds = `M${c - 8} ${b.waist.y + 2}L${c - 12} ${hemY + 2}M${c + 9} ${b.waist.y + 2}L${c + 14} ${hemY + 2}`;
  return { skirt, hem, legs, socks, shoes, vest, arms, sleeves, trim, cuff, hands, neck, collar, ascot, folds };
}

function spriteBody(look: Look): string {
  const id = `rmS${lookKey(look)}`;
  const o = HEAD;
  const h = new Head(o, look);
  const face = h.outline();
  const r = hairParts(h);
  const k = clothes(body(h, BODY));
  // The whole silhouette stroked wide and dark underneath: the outline that keeps her readable at 1x.
  const sil = unite(r.back + r.tails + r.loops + r.cap + r.bangs + face + r.locks + k.skirt + k.hem.shape + k.legs + k.shoes + k.vest + k.arms + k.sleeves + k.hands + k.neck);
  const st: EyeStyle = { ...EYES, open: 1, lashW: 7, detail: "chibi" };
  const mouth = h.F(`M-9 ${o.mouthY}Q-1 ${o.mouthY + 3} 9 ${o.mouthY - 1.5}`, 2);
  const blush = h.F(ellipseD(-o.eyeX - 4, o.noseY - 2, 14, 5)) + h.F(ellipseD(o.eyeX + 4, o.noseY - 2, 14, 5));
  return `
<path d="${sil}" fill="${OUT}" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>
<path d="${r.back}" fill="${HAIR.shade}"/>
<path d="${r.tails}" fill="${RED.shade}"/>
<path d="${r.loops}" fill="${RED.base}"/>
${celEdge(`${id}bl`, r.loops, r.loops, RED.shade, 6, 8)}
<path d="${r.bowFrill}" fill="${WHITE.base}"/>
<path d="${r.knot}" fill="${RED.base}" stroke="${RED.line}" stroke-width="2"/>
<path d="${k.legs}" fill="${SKIN.base}"/>
<path d="${k.socks}" fill="${WHITE.base}"/>
<path d="${k.shoes}" fill="#7a2230"/>
<path d="${k.skirt}" fill="${RED.base}"/>
${celEdge(`${id}sk`, k.skirt, k.skirt, RED.shade, 12, 0)}
${ink(k.folds, 2.4, RED.deep, [0.1, 0.5, 0.3])}
<path d="${k.hem.shape}" fill="${WHITE.base}"/>
<path d="${k.arms}" fill="${SKIN.base}"/>
<path d="${k.neck}" fill="${SKIN.shade}"/>
<path d="${k.vest}" fill="${RED.base}"/>
${celEdge(`${id}vs`, k.vest, k.vest, RED.shade, 10, 0)}
<path d="${k.collar}" fill="${RED.base}" stroke="${WHITE.base}" stroke-width="2"/>
<path d="${k.ascot}" fill="${GOLD.base}" stroke="${GOLD.line}" stroke-width="1.5"/>
<path d="${k.hands}" fill="${SKIN.base}"/>
<path d="${k.sleeves}" fill="${WHITE.base}"/>
${celEdge(`${id}sl`, k.sleeves, k.sleeves, WHITE.shade, 10, 0)}
<path d="${k.trim}" fill="none" stroke="${RED.base}" stroke-width="4" stroke-linecap="round"/>
<path d="${k.cuff}" fill="none" stroke="${RED.base}" stroke-width="2.5" stroke-linecap="round"/>
<path d="${r.locks}" fill="${HAIR.base}"/>
<path d="${face}" fill="${SKIN.base}"/>
${celEdge(`${id}fs`, face, face, SKIN.shade, 10, 4)}
<path d="${blush}" fill="${SKIN.blush}" opacity="0.35"/>
${eye(`${id}el`, h, -1, st)}${eye(`${id}er`, h, 1, st)}
${ink(mouth, 3.4, SKIN.line, [0.2, 0.5, 0.2])}
<path d="${r.cap}${r.bangs}" fill="${HAIR.base}"/>
${celEdge(`${id}hs`, r.cap + r.bangs, r.cap + r.bangs, HAIR.shade, 8, 8)}
${ink(h.S(`M-60 -64Q-20 -84 30 -80`), 7, HAIR.hi, [0.1, 0.4, 0.1])}
${BANGS.map(([rt, t, w, bend]) => ink(h.S(strand(rt, t, w, bend).right), 2.4, HAIR.line, [0.05, 0.6, 0.02])).join("")}
${BANGS.map(([rt, t, w, bend]) => ink(h.S(strand(rt, t, w, bend).right), 2.2, HAIR.line, [0.05, 0.6, 0.02])).join("")}
${r.tubes.map((t) => `<path d="${t.frill}" fill="${WHITE.base}" stroke="${WHITE.line}" stroke-width="1.5"/><path d="${t.band}" fill="${RED.base}" stroke="${RED.line}" stroke-width="1.5"/>`).join("")}
`;
}

function spriteBones(look: Look): string {
  const h = new Head(HEAD, look);
  return h.bones() + bodyBones(body(h, BODY), true);
}

/** In-game chibi (48x52 game px, authored at 4 units per pixel). */
export const sprite: Drawing = { w: 48, h: 52, scale: 4, body: spriteBody, bones: spriteBones };
