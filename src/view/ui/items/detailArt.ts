// The level-up card's art for a passive item, one drawing per level: level 1
// is the flat HUD silhouette (itemIcons.ts); each level after redraws the item
// with more of its own character, until the max level looks like game art in
// the Live2D characters' style (src/art-l2d/kit.ts): dark outlines, base /
// shade / light palettes, a shine. 48x48 viewBox, explicit colours.

import { itemIcon } from "../itemIcons.ts";

type Pal = { base: string; shade: string; light: string; line: string };

const ln = (c: string, w = 1.6) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const shine = (x: number, y: number, rx: number, ry: number, rot = -35, o = 0.85) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity="${o}" transform="rotate(${rot} ${x} ${y})"/>`;
const spark = (x: number, y: number, s: number, c = "#fff8d0") =>
  `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="${c}"/>`;
/** A vertical gradient light -> base -> shade, by id. */
const grad = (id: string, p: Pal, x2 = 0.35) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="1"><stop offset="0" stop-color="${p.light}"/><stop offset="0.45" stop-color="${p.base}"/><stop offset="1" stop-color="${p.shade}"/></linearGradient>`;

const GOLD: Pal = { base: "#ffd24a", shade: "#c8871a", light: "#fff3b0", line: "#5a3508" };
const SILVER: Pal = { base: "#dfe4f2", shade: "#9aa3c0", light: "#ffffff", line: "#3c4260" };
const PAPER = { base: "#fbf6ec", shade: "#e2d6bf", line: "#6d5a44" };

// ---------------------------------------------------------------- the items

function power(k: number): string {
  const R: Pal = { base: "#ff3d4f", shade: "#b3122a", light: "#ff9aa3", line: "#4a0610" };
  const s = [0, 0, 28, 30, 32, 34][k]!;
  const o = 24 - s / 2;
  const P = (w: number, c: string) =>
    `<path d="M${19.5} ${34} V${14} h6 a5.6 5.6 0 0 1 0 11.2 h-6" fill="none" ${ln(c, w)}/>`;
  let out = `<defs>${grad("pw", R)}<radialGradient id="pwg"><stop offset="0.3" stop-color="#ff5a6a" stop-opacity="0.7"/><stop offset="1" stop-color="#ff5a6a" stop-opacity="0"/></radialGradient></defs>`;
  if (k >= 5) out += `<circle cx="24" cy="24" r="23" fill="url(#pwg)"/>`;
  if (k >= 4) out += `<rect x="${o + 4}" y="${o + 5}" width="${s}" height="${s}" rx="5" fill="${R.shade}" opacity="0.45"/>`;
  out += `<rect x="${o}" y="${o}" width="${s}" height="${s}" rx="5" fill="${k >= 3 ? "url(#pw)" : R.base}" ${ln(R.line, 1.8)}/>`;
  if (k >= 3) out += `<path d="M${o + 3} ${o + s - 4} H${o + s - 4} V${o + 3}" fill="none" ${ln(R.shade, 2.4)} opacity="0.8"/><path d="M${o + 3} ${o + s - 5} V${o + 3} H${o + s - 5}" fill="none" ${ln(R.light, 1.6)} opacity="0.9"/>`;
  out += k >= 3 ? P(5.2, R.line) + P(3, "#fff") : P(3.2, "#fff");
  if (k >= 4) out += shine(o + 7, o + 7, 3.4, 1.8);
  if (k >= 5) out += spark(40, 9, 3.5) + spark(9, 39, 2.5) + spark(42, 36, 2);
  return out;
}

function heart(k: number): string {
  const H: Pal = { base: "#ff7aa2", shade: "#d9416f", light: "#ffd0de", line: "#6a1230" };
  const shape = (s: number) => {
    const t = (x: number, y: number) => `${24 + (x - 24) * s} ${27 + (y - 27) * s}`;
    return `M${t(24, 41)}C${t(12, 32)} ${t(7, 25)} ${t(7, 19)}A${8.5 * s} ${8.5 * s} 0 0 1 ${t(24, 15)}A${8.5 * s} ${8.5 * s} 0 0 1 ${t(41, 19)}C${t(41, 25)} ${t(36, 32)} ${t(24, 41)}Z`;
  };
  let out = `<defs>${grad("ht", H)}${grad("htg", GOLD)}</defs>`;
  // The cord, and a bail at the top.
  out += `<path d="M24 12 V${k >= 3 ? 3 : 5}" fill="none" ${ln(k >= 3 ? "#7a2a1a" : H.line, 1.6)}/>`;
  if (k >= 5) out += `<path d="M24 4 C16 2 12 5 10 1 M24 4 C32 2 36 5 38 1" fill="none" ${ln("#7a2a1a", 1.4)}/>`;
  if (k >= 4) out += `<path d="${shape(1.1)}" fill="url(#htg)" ${ln(GOLD.line, 1.4)}/>`;
  out += `<path d="${shape(1)}" fill="${k >= 3 ? "url(#ht)" : H.base}" ${ln(H.line, 1.8)}/>`;
  if (k >= 3) out += `<path d="M34 22 C35 28 31 33 25 37" fill="none" ${ln(H.shade, 2.6)} opacity="0.8"/>` + shine(15.5, 21, 3.6, 2.2);
  if (k >= 3) out += `<circle cx="24" cy="12.5" r="2.6" fill="${GOLD.base}" ${ln(GOLD.line, 1.2)}/>`;
  if (k >= 4) out += `<path d="M24 41 v4" ${ln(GOLD.line, 1.2)}/><path d="M22 44 h4 l-1 3.5 h-2z" fill="${H.shade}" ${ln(H.line, 1)}/>`;
  if (k >= 5) out += `<path d="M24 20 l3 4 -3 5 -3 -5z" fill="#fff" opacity="0.55"/>` + spark(40, 12, 3) + spark(8, 32, 2.4);
  return out;
}

function geta(k: number): string {
  const W: Pal = { base: "#c48a55", shade: "#8a5a30", light: "#e8c090", line: "#3f2410" };
  const RED: Pal = { base: "#e0283c", shade: "#a9172b", light: "#ff8a95", line: "#4a0610" };
  const sole = (x: number, y: number, rot: number) => {
    let s = `<g transform="rotate(${rot} ${x + 8} ${y + 17})">`;
    if (k >= 4) s += `<rect x="${x - 1.2}" y="${y - 1.2}" width="18.4" height="36.4" rx="7.5" fill="#241410"/>`;
    s += `<rect x="${x}" y="${y}" width="16" height="34" rx="6.5" fill="${k >= 3 ? "url(#gt)" : W.base}" ${ln(W.line, 1.6)}/>`;
    if (k >= 3) s += `<path d="M${x + 4} ${y + 6} v22 M${x + 11} ${y + 4} v25" ${ln(W.shade, 0.9)} opacity="0.7"/>`;
    // The hanao: a V from the toe post to the sides.
    const c = k >= 3 ? RED : { ...RED, base: "#5a3a22", line: "#2a160a" };
    s += `<path d="M${x + 2} ${y + 17} L${x + 8} ${y + 6} L${x + 14} ${y + 17}" fill="none" ${ln(c.line, 4.4)}/>`;
    s += `<path d="M${x + 2} ${y + 17} L${x + 8} ${y + 6} L${x + 14} ${y + 17}" fill="none" ${ln(c.base, 2.6)}/>`;
    if (k >= 4) s += `<path d="M${x + 3.5} ${y + 14} L${x + 8} ${y + 7.5}" fill="none" ${ln(RED.light, 0.9)}/>`;
    s += `<circle cx="${x + 8}" cy="${y + 6}" r="1.8" fill="${c.base}" ${ln(c.line, 1)}/>`;
    return s + "</g>";
  };
  let out = `<defs>${grad("gt", W)}</defs>`;
  if (k >= 3) out += sole(22, 8, 10);
  out += sole(k >= 3 ? 9 : 16, k >= 3 ? 5 : 7, k >= 3 ? -8 : 0);
  if (k >= 5) {
    // A crow tengu's black feather tucked by the pair, and a gust.
    out += `<path d="M40 40 C44 30 44 20 38 12 C36 22 36 32 40 40Z" fill="#1c1a24" ${ln("#000", 1)}/><path d="M40 40 C40 30 39 22 38 13" fill="none" ${ln("#5a5a70", 0.8)}/>`;
    out += `<path d="M3 30 q6 -3 12 0 M2 36 q5 -2 9 0" fill="none" ${ln("#d8f0ff", 1.3)} opacity="0.8"/>`;
  }
  return out;
}

function clock(k: number): string {
  const B: Pal = { base: "#6aa0ff", shade: "#2c5ac8", light: "#cfe0ff", line: "#132a66" };
  let out = `<defs>${grad("ck", SILVER)}<radialGradient id="ckf" cx="0.4" cy="0.35"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6f6"/></radialGradient></defs>`;
  const cx = 24;
  const cy = 26;
  // The chain, from the bow out to the side.
  if (k >= 3) {
    out += `<path d="M24 7 C33 4 42 8 44 18 C45 26 43 33 40 38" fill="none" ${ln(SILVER.line, 2.6)} stroke-dasharray="2.2 1.4"/>`;
    out += `<path d="M24 7 C33 4 42 8 44 18 C45 26 43 33 40 38" fill="none" ${ln(SILVER.base, 1.2)} stroke-dasharray="2.2 1.4"/>`;
  }
  if (k >= 5) out += `<path d="M36 40 a5 5 0 1 0 7 -2 a3.6 3.6 0 1 1 -7 2z" fill="${GOLD.base}" ${ln(GOLD.line, 1.1)}/>`;
  // Crown and bow.
  out += `<rect x="21.5" y="${k >= 3 ? 8 : 9}" width="5" height="4" rx="1" fill="${k >= 3 ? SILVER.base : "#c0c8e0"}" ${ln(SILVER.line, 1.2)}/>`;
  if (k >= 3) out += `<circle cx="24" cy="6.5" r="2.6" fill="none" ${ln(SILVER.line, 2.4)}/><circle cx="24" cy="6.5" r="2.6" fill="none" ${ln(SILVER.base, 1)}/>`;
  // The case, the face.
  out += `<circle cx="${cx}" cy="${cy}" r="${k >= 3 ? 15 : 14}" fill="${k >= 3 ? "url(#ck)" : "#c0c8e0"}" ${ln(SILVER.line, 1.8)}/>`;
  out += `<circle cx="${cx}" cy="${cy}" r="${k >= 3 ? 11.5 : 11}" fill="${k >= 3 ? "url(#ckf)" : "#f4f6fc"}" ${ln(SILVER.line, 1)}/>`;
  // Ticks.
  const n = k >= 4 ? 12 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r0 = i % 3 === 0 ? 8 : 9.2;
    out += `<path d="M${(cx + Math.cos(a) * r0).toFixed(1)} ${(cy + Math.sin(a) * r0).toFixed(1)}L${(cx + Math.cos(a) * 10.4).toFixed(1)} ${(cy + Math.sin(a) * 10.4).toFixed(1)}" ${ln(SILVER.line, i % 3 === 0 ? 1.3 : 0.7)}/>`;
  }
  // An engraved crescent moon.
  if (k >= 4) out += `<path d="M18.5 29.5 a5 5 0 1 0 6.5 4 a3.8 3.8 0 1 1 -6.5 -4z" fill="${k >= 5 ? GOLD.base : "#b8c2dc"}" ${ln(k >= 5 ? GOLD.line : SILVER.shade, 0.7)}/>`;
  // Hands: plain, or Sakuya's knives.
  if (k >= 5) {
    const knife = (len: number, rot: number) =>
      `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M${cx - 1.3} ${cy} L${cx - 1.1} ${cy - len + 3} L${cx} ${cy - len} L${cx + 1.1} ${cy - len + 3} L${cx + 1.3} ${cy}Z" fill="#eef2ff" ${ln(SILVER.line, 0.8)}/><rect x="${cx - 2.2}" y="${cy - 0.6}" width="4.4" height="1.4" fill="${B.shade}"/></g>`;
    out += knife(9.5, 0) + knife(7, 125);
  } else {
    out += `<path d="M${cx} ${cy}V${cy - 8}M${cx} ${cy}L${cx + 5} ${cy + 3}" fill="none" ${ln(SILVER.line, 1.6)}/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${k >= 5 ? 1.8 : 1.3}" fill="${k >= 5 ? B.base : SILVER.line}" ${k >= 5 ? ln(B.line, 0.8) : ""}/>`;
  if (k >= 3) out += shine(17, 17, 3.2, 1.6, -40, 0.9);
  if (k >= 5) out += spark(8, 12, 3, "#dfe8ff") + spark(9, 40, 2.2, "#dfe8ff");
  return out;
}

function magnet(k: number): string {
  const B: Pal = { base: "#3fa7ff", shade: "#1a5fc0", light: "#b8e0ff", line: "#0a2a5a" };
  const U = "M9 7 v17 a15 15 0 0 0 30 0 V7 h-9 v17 a6 6 0 0 1 -12 0 V7z";
  let out = `<defs>${grad("mg", B, 0.2)}${grad("mgs", SILVER, 0.2)}</defs>`;
  if (k >= 4) {
    out += `<path d="M13 3 q11 -6 22 0" fill="none" ${ln("#9fe4ff", 1.2)} stroke-dasharray="2 2" opacity="0.8"/>`;
    out += `<path d="M24 0.5 l2.6 2.6 -2.6 2.6 -2.6 -2.6z" fill="#4da3ff" ${ln("#fff", 0.8)}/>`;
  }
  out += `<path d="${U}" fill="${k >= 3 ? "url(#mg)" : B.base}" ${ln(B.line, 1.8)}/>`;
  out += `<path d="M9 7 h9 v5 h-9z M30 7 h9 v5 h-9z" fill="${k >= 3 ? "url(#mgs)" : "#e8ecf8"}" ${ln(B.line, 1.4)}/>`;
  if (k >= 3) out += `<path d="M11 14 v10 a13 13 0 0 0 6 11" fill="none" ${ln(B.light, 1.8)} opacity="0.8"/><path d="M37 14 v10 a13 13 0 0 1 -10 12" fill="none" ${ln(B.shade, 2)} opacity="0.7"/>`;
  if (k >= 4) out += `<circle cx="24" cy="36" r="3.2" fill="${SILVER.base}" ${ln(SILVER.line, 1)}/><path d="M22.4 36h3.2" ${ln(SILVER.line, 0.9)}/>`;
  if (k >= 5) {
    // Kappa engineering: a gear on the bend, bolts, a spark of current.
    let gear = "";
    for (let i = 0; i < 8; i++) gear += `<rect x="-1.2" y="-6.4" width="2.4" height="2.6" transform="rotate(${i * 45})" fill="${GOLD.base}" ${ln(GOLD.line, 0.6)}/>`;
    out += `<g transform="translate(24 36)">${gear}<circle r="4.6" fill="${GOLD.base}" ${ln(GOLD.line, 1)}/><circle r="1.6" fill="${GOLD.line}"/></g>`;
    out += `<circle cx="13.5" cy="18" r="1" fill="${B.line}"/><circle cx="34.5" cy="18" r="1" fill="${B.line}"/>`;
    out += `<path d="M4 14 l3 3 -2 1 3 4" fill="none" ${ln("#fff27a", 1.3)}/><path d="M44 14 l-3 3 2 1 -3 4" fill="none" ${ln("#fff27a", 1.3)}/>`;
  }
  return out;
}

function grimoire(k: number): string {
  const P: Pal = { base: "#9b59d0", shade: "#6a2fa0", light: "#d6a8ff", line: "#2a0a4a" };
  const star = (cx: number, cy: number, r: number) => {
    let d = "";
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      d += `${i ? "L" : "M"}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
    }
    return d + "Z";
  };
  let out = `<defs>${grad("gm", P)}<radialGradient id="gmg"><stop offset="0.2" stop-color="#d6a8ff" stop-opacity="0.6"/><stop offset="1" stop-color="#d6a8ff" stop-opacity="0"/></radialGradient></defs>`;
  if (k >= 5) {
    out += `<circle cx="24" cy="24" r="23" fill="url(#gmg)"/>`;
    out += `<circle cx="24" cy="24" r="21" fill="none" ${ln("#e8d0ff", 0.8)} opacity="0.7"/><circle cx="24" cy="24" r="18" fill="none" ${ln("#e8d0ff", 0.5)} stroke-dasharray="1.5 2" opacity="0.7"/>`;
  }
  // Pages, then the cover.
  out += `<rect x="12" y="7" width="26" height="34" rx="2" fill="${PAPER.base}" ${ln(PAPER.line, 1.2)}/>`;
  if (k >= 3) out += `<path d="M36 10 v28 M34 9 v30" ${ln(PAPER.shade, 0.7)}/>`;
  out += `<rect x="9" y="5" width="26" height="36" rx="2.5" fill="${k >= 3 ? "url(#gm)" : P.base}" ${ln(P.line, 1.8)}/>`;
  if (k >= 3) out += `<path d="M13 5.5 v35" ${ln(P.shade, 2.4)}/><path d="M9.5 12 h4 M9.5 34 h4" ${ln(GOLD.base, 1.4)}/>`;
  // The clasp.
  out += `<rect x="31" y="19" width="8" height="7" rx="1.4" fill="${k >= 3 ? GOLD.base : P.shade}" ${ln(k >= 3 ? GOLD.line : P.line, 1.2)}/>`;
  if (k >= 4) {
    out += `<path d="M9 10 V7.5 A2.5 2.5 0 0 1 11.5 5 H14z M35 10 V7.5 A2.5 2.5 0 0 0 32.5 5 H30z M9 36 v2.5 A2.5 2.5 0 0 0 11.5 41 H14z M35 36 v2.5 A2.5 2.5 0 0 1 32.5 41 H30z" fill="${GOLD.base}" ${ln(GOLD.line, 0.9)}/>`;
    out += `<path d="M27 41 v6 l-2 -1.6 -2 1.6 v-6" fill="#e0314b" ${ln("#4a0610", 0.9)}/>`;
  }
  out += `<path d="${star(23, 23, k >= 4 ? 7.5 : 6.5)}" fill="${k >= 4 ? GOLD.base : "#fff"}" ${k >= 4 ? ln(GOLD.line, 1) : ""} ${k < 3 ? 'opacity="0.9"' : ""}/>`;
  if (k >= 4) out += `<circle cx="23" cy="23" r="9.5" fill="none" ${ln(GOLD.base, 0.8)}/>`;
  if (k >= 3) out += shine(14, 9, 2.6, 1.2, -20, 0.7);
  if (k >= 5) out += spark(42, 8, 3.2, "#f0dcff") + spark(5, 30, 2.4, "#f0dcff") + spark(43, 40, 2, "#f0dcff");
  return out;
}

function ribbon(k: number): string {
  const R: Pal = { base: "#e0283c", shade: "#a9172b", light: "#ff8a95", line: "#4a0610" };
  const fill = k >= 3 ? "url(#rb)" : R.base;
  let out = `<defs>${grad("rb", R)}</defs>`;
  // Tails, loops, knot.
  const tail = (s: number) => `<path d="M${24 + s * 2} 26 L${24 + s * 10} ${k >= 4 ? 45 : 42} L${24 + s * 6} ${k >= 4 ? 42 : 40} L${24 + s * 4} ${k >= 4 ? 45 : 42}Z" fill="${fill}" ${ln(R.line, 1.5)}/>`;
  const loop = (s: number) => `<path d="M24 22 C${24 + s * 8} 8 ${24 + s * 22} 6 ${24 + s * 22} 16 C${24 + s * 22} 28 ${24 + s * 10} 30 24 24Z" fill="${fill}" ${ln(R.line, 1.8)}/>`;
  const frill = (s: number) => {
    let d = "";
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = 24 + s * (8 + t * 14);
      const y = 12 - Math.sin(t * Math.PI) * 4 + t * 3;
      d += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.9" fill="#fff" ${ln("#6d6788", 0.7)}/>`;
    }
    return d;
  };
  out += tail(-1) + tail(1);
  if (k >= 3) out += frill(-1) + frill(1);
  out += loop(-1) + loop(1);
  if (k >= 3) out += `<path d="M${24 - 6} 21 C14 18 10 16 8 18 M${24 + 6} 21 C34 18 38 16 40 18" fill="none" ${ln(R.shade, 1.6)} opacity="0.8"/>`;
  if (k >= 4) {
    out += `<path d="M${24 - 10} 43 L${24 - 6} 40 L${24 - 4} 43" fill="none" ${ln("#fff", 1.4)}/><path d="M${24 + 10} 43 L${24 + 6} 40 L${24 + 4} 43" fill="none" ${ln("#fff", 1.4)}/>`;
  }
  out += `<rect x="20" y="19" width="8" height="8" rx="2.5" fill="${k >= 3 ? R.shade : R.base}" ${ln(R.line, 1.6)}/>`;
  if (k >= 3) out += shine(12, 14, 2.8, 1.4, -30, 0.8) + shine(33, 13, 2.2, 1.1, 30, 0.6);
  if (k >= 5) out += spark(6, 32, 3, "#ffe0e6") + spark(42, 32, 2.6, "#ffe0e6") + spark(24, 6, 2.2, "#ffe0e6");
  return out;
}

function gourd(k: number): string {
  const O: Pal = k >= 5 ? { base: "#9a5ad0", shade: "#62309a", light: "#d8b0ff", line: "#2a0a4a" } : { base: "#e0a050", shade: "#a8651e", light: "#ffd9a0", line: "#4a2508" };
  const RED = "#d8283a";
  let out = `<defs>${grad(`gd${k}`, O)}</defs>`;
  const f = k >= 3 ? `url(#gd${k})` : O.base;
  // Sake splashing from the mouth.
  if (k >= 5) out += `<path d="M24 4 C20 -1 14 1 13 4 M24 4 C28 -1 34 0 36 3" fill="none" ${ln("#bfe8ff", 1.6)}/><circle cx="12" cy="7" r="1.5" fill="#bfe8ff"/><circle cx="37" cy="6" r="1.3" fill="#bfe8ff"/><circle cx="33" cy="1.5" r="1" fill="#bfe8ff"/>`;
  // Cork.
  out += `<rect x="21" y="${k >= 3 ? 3.5 : 4}" width="6" height="5" rx="1.2" fill="${k >= 3 ? "#8a5a30" : O.shade}" ${ln(O.line, 1.3)}/>`;
  out += `<circle cx="24" cy="16" r="8" fill="${f}" ${ln(O.line, 1.8)}/>`;
  out += `<circle cx="24" cy="32" r="12" fill="${f}" ${ln(O.line, 1.8)}/>`;
  out += `<path d="M17 21 Q24 24 31 21" fill="${f}"/>`;
  if (k >= 3) out += `<path d="M33 27 a11 11 0 0 1 -6 15" fill="none" ${ln(O.shade, 2.6)} opacity="0.8"/>` + shine(20, 12, 2.4, 1.4) + shine(18, 27, 3.2, 1.8);
  // The cord at the waist, a tassel.
  if (k >= 3) {
    out += `<path d="M16.5 21.5 Q24 25.5 31.5 21.5" fill="none" ${ln("#3a0a10", 3.4)}/><path d="M16.5 21.5 Q24 25.5 31.5 21.5" fill="none" ${ln(RED, 2)}/>`;
  }
  if (k >= 4) out += `<path d="M31 22 q4 5 2 11" fill="none" ${ln(RED, 1.5)}/><path d="M31.5 32 l3 0 1 5 -5 0z" fill="${RED}" ${ln("#3a0a10", 0.9)}/>`;
  if (k >= 4 && k < 5) out += `<rect x="20" y="28" width="8" height="10" rx="0.8" fill="${PAPER.base}" ${ln(PAPER.line, 0.9)}/><path d="M24 30 v6 M22 32 h4" ${ln("#c02030", 1)}/>`;
  // Suika's chain: a sphere, a cube and a pyramid.
  if (k >= 5) {
    out += `<path d="M13 30 C6 34 5 40 8 45" fill="none" ${ln("#5a5a70", 2.4)} stroke-dasharray="2 1.2"/>`;
    out += `<circle cx="8" cy="45" r="2.6" fill="#d8dce8" ${ln("#3c4260", 1)}/>`;
    out += `<rect x="3" y="36" width="4" height="4" fill="#fff27a" ${ln("#5a4a08", 0.9)}/>`;
    out += `<path d="M5 32 l2.6 4 h-5.2z" fill="#ff8a95" ${ln("#4a0610", 0.9)}/>`;
  }
  return out;
}

function neko(k: number): string {
  const Wt: Pal = { base: "#ffffff", shade: "#d8daf0", light: "#ffffff", line: "#4a3a3a" };
  const flat = k < 3;
  let out = `<defs>${grad("nk", { ...Wt, light: "#ffffff", base: "#fbf8f2", shade: "#dcd6e6" })}${grad("nkc", GOLD)}</defs>`;
  const body = flat ? "#fbf3c8" : "url(#nk)";
  // Ears, head, body.
  out += `<path d="M13 14 L14 3 L21 9Z M35 14 L34 3 L27 9Z" fill="${body}" ${ln(Wt.line, 1.6)}/>`;
  out += `<path d="M15 11 L15.5 6 L19 9Z M33 11 L32.5 6 L29 9Z" fill="#ffb0c0"/>`;
  out += `<rect x="12" y="24" width="24" height="21" rx="9" fill="${body}" ${ln(Wt.line, 1.6)}/>`;
  // The raised paw.
  if (k >= 3) out += `<rect x="34" y="10" width="8" height="15" rx="4" fill="${body}" ${ln(Wt.line, 1.6)}/><path d="M36 12 v2 M38 11.5 v2 M40 12 v2" ${ln("#ffb0c0", 1)}/>`;
  out += `<circle cx="24" cy="16" r="11" fill="${body}" ${ln(Wt.line, 1.6)}/>`;
  // Calico patches.
  if (k >= 4) out += `<path d="M15 9 C18 7 21 8 21 11 C19 13 15 13 14 11Z" fill="#e8a040"/><path d="M29 20 C32 19 34 21 34 23 C31 24 29 23 29 20Z" fill="#3a3030"/><path d="M13 32 C16 30 18 33 16 37 C13 37 12 35 13 32Z" fill="#e8a040"/>`;
  // Face: happy closed eyes, nose, mouth; whiskers later.
  out += `<path d="M17 16 q2 -2.4 4 0 M27 16 q2 -2.4 4 0" fill="none" ${ln(Wt.line, 1.4)}/>`;
  out += `<path d="M23 19 h2 l-1 1.2z" fill="#ff7a90"/><path d="M22 21 q2 1.6 4 0" fill="none" ${ln(Wt.line, 1)}/>`;
  if (k >= 5) out += `<path d="M13 19 h5 M13 21.5 l5 -1 M35 19 h-5 M35 21.5 l-5 -1" ${ln("#8a7a7a", 0.7)}/><ellipse cx="18" cy="20" rx="2" ry="1.1" fill="#ff9aaa" opacity="0.6"/><ellipse cx="30" cy="20" rx="2" ry="1.1" fill="#ff9aaa" opacity="0.6"/>`;
  // Collar and bell.
  if (k >= 3) {
    out += `<path d="M14 25.5 Q24 29.5 34 25.5" fill="none" ${ln("#6a0a14", 3.6)}/><path d="M14 25.5 Q24 29.5 34 25.5" fill="none" ${ln("#e0283c", 2.2)}/>`;
    out += `<circle cx="24" cy="30" r="2.8" fill="${GOLD.base}" ${ln(GOLD.line, 1)}/><path d="M22.5 30.5 h3" ${ln(GOLD.line, 0.8)}/>`;
  }
  // The koban.
  if (k >= 4) {
    out += `<ellipse cx="24" cy="39" rx="7" ry="5" fill="${k >= 5 ? "url(#nkc)" : GOLD.base}" ${ln(GOLD.line, 1.2)}/>`;
    out += `<path d="M20 37 h8 M20 39 h8 M20 41 h8" ${ln(GOLD.shade, 0.7)}/><ellipse cx="24" cy="39" rx="2" ry="1.4" fill="${GOLD.shade}"/>`;
  }
  if (k >= 3) out += shine(19, 9.5, 2.2, 1.1, -30, 0.7);
  if (k >= 5) out += `<path d="M34 40 C38 38 38 30 34 28" fill="none" ${ln(Wt.shade, 2.4)}/>` + spark(7, 8, 3) + spark(42, 36, 2.6) + spark(6, 38, 2);
  return out;
}

function tome(k: number): string {
  const G: Pal = { base: "#6fd08a", shade: "#2f8a4a", light: "#c4f5d0", line: "#0a3a1a" };
  const T: Pal = { base: "#4fb8c8", shade: "#1f6a80", light: "#b0ecf4", line: "#082a34" };
  const book = (x: number, y: number, p: Pal, id: string) =>
    `<rect x="${x + 3}" y="${y + 2}" width="20" height="28" rx="1.6" fill="${PAPER.base}" ${ln(PAPER.line, 1)}/>` +
    `<rect x="${x}" y="${y}" width="20" height="29" rx="2" fill="${k >= 3 ? `url(#${id})` : p.base}" ${ln(p.line, 1.6)}/>` +
    (k >= 3 ? `<path d="M${x + 3.5} ${y + 0.5} v28" ${ln(p.shade, 2)}/>` + shine(x + 7, y + 4, 2.2, 1, -20, 0.7) : "");
  let out = `<defs>${grad("tb1", T)}${grad("tb2", G)}</defs>`;
  out += book(6, 13, T, "tb1");
  out += book(21, 5, G, "tb2");
  if (k >= 4) out += `<path d="M31 5 v-3 M29 34 v7 l-2 -1.5 -2 1.5 v-7" fill="#e0314b" ${ln("#4a0610", 0.9)}/>`;
  out += `<circle cx="31" cy="19" r="${k >= 4 ? 6 : 5}" fill="${k >= 4 ? GOLD.base : "#fff"}" ${k >= 4 ? ln(GOLD.line, 1) : ""}/>`;
  out += `<path d="M31 15.5 v7 M27.5 19 h7" ${ln(k >= 4 ? GOLD.line : G.shade, 1.8)}/>`;
  if (k >= 5) out += spark(8, 7, 3, "#e0ffe8") + spark(44, 36, 2.6, "#e0ffe8") + spark(15, 46, 2, "#e0ffe8");
  return out;
}

const ART: Record<string, (k: number) => string> = { power, heart, geta, clock, magnet, grimoire, ribbon, gourd, neko, tome };

/**
 * An item's art at a tier 1..5 (the level spread over the item's levels): tier
 * 1 is its HUD icon in `currentColor` (flat, 24x24 scaled into the 48 box).
 */
export function itemArt(id: string, tier: number): string {
  const draw = ART[id];
  if (!draw || tier <= 1) return `<g transform="translate(4 4) scale(1.6667)">${itemIcon(id)}</g>`;
  return draw(Math.min(5, tier));
}

/** A level on the 1..5 tier scale: the first level is 1, the last 5. */
export function itemTier(level: number, max: number): number {
  return max <= 1 ? 5 : Math.round(1 + ((level - 1) * 4) / (max - 1));
}
