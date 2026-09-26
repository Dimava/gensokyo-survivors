// The field's rigged enemies (keyed by enemy id, content/enemies.ts):
// fairies on the fairy builder, and the round things (kedama, ghosts,
// yin-yang orb) as small rigs of their own on the chibi deformers.

import { rotation, warp, type Model, type Part } from "./rig.ts";
import { grid, ln } from "./kit.ts";
import { chibiModel, CH, CW, LW, pair } from "./chibi.ts";
import { fairy } from "./fairy.ts";

const eye = (dark: string, mid: string, light: string, pupil: string) => ({ dark, mid, light, pupil, lash: "#1a1020" });

export const fairyRig: Model = fairy("fairy", {
  hair: { base: "#ffb24a", shade: "#e0842a", light: "#ffe0a0", line: "#7a4410", top: "#ffc870", bottom: "#f09a38" },
  dress: { base: "#4f7ff0", shade: "#3358c0", line: "#16286e" },
  trim: "#ffffff",
  face: { eye: eye("#173e86", "#3a7fe0", "#8cc4ff", "#0c1e44") },
  wings: "soft",
  ribbon: "#e0314b",
  bow: "#e0314b",
});

export const iceFairyRig: Model = fairy("icefairy", {
  hair: { base: "#c4ecff", shade: "#7cc4f4", light: "#ffffff", line: "#2a5a8a", top: "#dcf6ff", bottom: "#9ad4f8" },
  dress: { base: "#6cc8f4", shade: "#3a98d0", line: "#14486e" },
  trim: "#ffffff",
  face: { eye: eye("#123e86", "#2f8fe0", "#9ad8ff", "#0a2044"), mouth: "grin" },
  wings: "ice",
  ribbon: "#2f6fe0",
  bow: "#2f6fe0",
});

export const duskFairyRig: Model = fairy("duskfairy", {
  hair: { base: "#c8a8ff", shade: "#8a64d0", light: "#efe4ff", line: "#3e2470", top: "#dac4ff", bottom: "#a684e8" },
  dress: { base: "#4a2f7a", shade: "#2e1c52", line: "#140a28" },
  trim: "#c8a8ff",
  face: { eye: eye("#4a0a18", "#b02040", "#ff6a80", "#2a0410"), mouth: "grin" },
  wings: "dusk",
  ribbon: "#e0314b",
  bow: "#e0314b",
  back: 140,
});

export const daiyouseiRig: Model = fairy("daiyousei", {
  hair: { base: "#6fd88a", shade: "#3fa85a", light: "#c8f8d4", line: "#1a5a2e", top: "#8ce4a2", bottom: "#4cbc6a" },
  dress: { base: "#4f7fe0", shade: "#2f56b0", line: "#12286a" },
  trim: "#ffffff",
  face: { eye: eye("#143a26", "#2f8f5a", "#8ee0aa", "#0a2014") },
  wings: "leaf",
  bow: "#ffd84d",
  ponytail: "#ffd84d",
});

export const bigFairyRig: Model = fairy("bigfairy", {
  hair: { base: "#f47a8e", shade: "#cc4c66", light: "#ffd0da", line: "#6a1428", top: "#ff96a8", bottom: "#dc5c74" },
  dress: { base: "#8a1a2e", shade: "#5e0e1e", line: "#2a040c" },
  trim: "#ffd84d",
  face: { eye: eye("#5a0a1a", "#b02a40", "#ff8a9a", "#2a0410") },
  wings: "butterfly",
  ribbon: "#ffd84d",
  bow: "#ffd84d",
  back: 142,
});

export const sunflowerRig: Model = fairy("sunflower", {
  hair: { base: "#e8403a", shade: "#b02420", light: "#ffa090", line: "#5a0c08", top: "#f45a50", bottom: "#c42c28" },
  dress: { base: "#f0a040", shade: "#c87420", line: "#5a3008" },
  trim: "#fff4c0",
  face: { eye: eye("#4a2a06", "#a06010", "#f0b040", "#2a1404") },
  wings: "dotted",
  bow: "#3a9a3a",
  sunflower: true,
});

// ---------------------------------------------------------------- round things

/** Eyes for the round mobs: plain ovals on the chibi eye warps (so they blink and look). */
function beadEyes(fill: string, shine: string, rx = 7, ry = 10): Part[] {
  const svg = `<ellipse cx="84" cy="88" rx="${rx}" ry="${ry}" fill="${fill}"/><ellipse cx="82" cy="84" rx="${rx * 0.38}" ry="${ry * 0.3}" fill="${shine}"/>`;
  return pair({ id: "beadL", parent: "eyeL", order: 40, rect: { x: 70, y: 70, w: 28, h: 36 }, mesh: grid(1, 2), svg });
}

/** Squash and stretch with the bob (about the bottom), for soft bodies. */
const squash = warp("squash", "bob", { x: 0, y: 0, w: CW, h: CH }, 2, 2, [["Bob", [-1, 0, 1]]], (x, y, [b = 0]) => [100 + (x - 100) * (1 + 0.09 * b), 176 + (y - 176) * (1 - 0.09 * b)]);

/** The first kedama (a plain star of fur with bead eyes), kept to compare in the lab ("kedama.v1"). */
export const kedamaV1: Model = (() => {
  const n = 30;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 ? 58 : 72;
    return `${(100 + Math.cos(a) * r).toFixed(1)},${(106 + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
  const fur = `<defs><radialGradient id="kg" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#ffffff"/><stop offset="0.7" stop-color="#f4eafc"/><stop offset="1" stop-color="#d8c4f0"/></radialGradient></defs>
<polygon points="${pts}" fill="url(#kg)" ${ln("#9a7ac8", LW)}/>
<circle cx="100" cy="106" r="48" fill="#fbf6ff" opacity="0.7"/>`;
  const cheeks = `<ellipse cx="68" cy="112" rx="9" ry="5" fill="#ffb0c4" opacity="0.6"/><ellipse cx="132" cy="112" rx="9" ry="5" fill="#ffb0c4" opacity="0.6"/>`;
  const spin = rotation("fur", "squash", [100, 106], [["Flap", [-1, 0, 1]]], ([f = 0]) => ({ angle: f * 5 }));
  return chibiModel(
    "kedama",
    [
      { id: "fur", parent: "fur", order: 10, rect: { x: 20, y: 26, w: 160, h: 160 }, mesh: grid(4, 4), svg: fur },
      { id: "cheeks", parent: "feat", order: 31, rect: { x: 54, y: 102, w: 92, h: 20 }, mesh: grid(2, 1), svg: cheeks },
      ...beadEyes("#2a1a3a", "#ffffff"),
    ],
    {},
    [squash, spin],
  );
})();

/**
 * A ring of fur tufts round (cx, cy) as one closed path: `n` curls between
 * the valley radius `r0` and tips at `r1` (each tip's length and lean varied
 * by a fixed pattern, so the fur is ragged but always the same), the tips
 * swept clockwise like fur stroked round the ball.
 */
function tufts(cx: number, cy: number, n: number, r0: number, r1: number, sweep: number, seed: number, from = 0, to = Math.PI * 2): string {
  const at = (a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
  const step = (to - from) / n;
  const parts = [`M${at(from, r0)}`];
  for (let i = 0; i < n; i++) {
    const a0 = from + i * step;
    const j = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const k = j - Math.floor(j);
    const tip = r0 + (r1 - r0) * (0.7 + 0.5 * k);
    const ta = a0 + step * (0.5 + sweep * (0.6 + 0.4 * k));
    parts.push(`Q${at(a0 + step * 0.1, tip * 0.98)} ${at(ta, tip)}`);
    parts.push(`Q${at(a0 + step * 0.75, r0 + (tip - r0) * 0.45)} ${at(a0 + step, r0)}`);
  }
  return parts.join(" ") + (to - from >= Math.PI * 2 - 1e-6 ? " Z" : "");
}

/** The kedama's colours: white fur shaded lavender, a plum outline. */
const KF = { light: "#ffffff", base: "#f6effd", shade: "#dccbf2", deep: "#b69ae0", line: "#7a58b0", eye: "#3a1e5a", blush: "#ffa6c0" };

/**
 * A kedama with a character of her own: a ragged ball of curled fur, a sprout
 * curling up off the top, a fringe hanging into her eyes (they peer out from
 * under it, big and shining), a cat mouth, and a tuft each side like a stubby
 * paw that sways as she bobs.
 */
export const kedamaRig: Model = (() => {
  const back = `<path d="${tufts(100, 110, 22, 60, 80, 0.35, 1)}" fill="${KF.shade}" ${ln(KF.line, LW)}/>`;
  const fur = `<defs><radialGradient id="kg2" cx="0.42" cy="0.36" r="0.72"><stop offset="0" stop-color="${KF.light}"/><stop offset="0.65" stop-color="${KF.base}"/><stop offset="1" stop-color="${KF.shade}"/></radialGradient></defs>
<path d="${tufts(100, 110, 18, 54, 68, 0.3, 2)}" fill="url(#kg2)" ${ln(KF.deep, 2.4)}/>
<path d="M58 140 C70 162 130 162 142 140 C130 154 70 154 58 140 Z" fill="${KF.shade}" opacity="0.8"/>
<path d="M66 72 Q72 64 80 62 M122 62 Q130 64 136 72" fill="none" ${ln(KF.light, 3)} opacity="0.9"/>`;
  // The fringe: tufts hanging down over the brow to the tops of her eyes.
  const fringe = `<path d="M50 84 C52 58 72 44 100 44 C128 44 148 58 150 84 Q144 74 138 80 Q134 70 124 82 Q120 70 112 80 Q106 68 100 80 Q94 68 88 80 Q80 70 76 82 Q66 70 62 80 Q56 74 50 84 Z" fill="#fbf7fe"/>
<path d="M50 84 Q56 74 62 80 Q66 70 76 82 Q80 70 88 80 Q94 68 100 80 Q106 68 112 80 Q120 70 124 82 Q134 70 138 80 Q144 74 150 84" fill="none" ${ln(KF.deep, 2.4)}/>
<path d="M62 62 Q78 52 96 52" fill="none" ${ln(KF.light, 3.4)} opacity="0.9"/>`;
  const sprout = `<path d="M100 48 C96 36 98 24 108 18 C118 12 128 18 126 26 C124 32 116 32 114 26 C120 28 122 22 116 20 C108 20 104 30 106 48 Z" fill="${KF.base}" ${ln(KF.line, LW)}/>`;
  const pawL = `<path d="${tufts(40, 130, 3, 12, 22, -0.2, 3, Math.PI * 0.55, Math.PI * 1.45)} L40 130 Z" fill="${KF.base}" ${ln(KF.line, LW)}/>`;
  const eyes = `<defs><linearGradient id="ke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c0a30"/><stop offset="1" stop-color="#6a3aa0"/></linearGradient></defs>
<ellipse cx="84" cy="90" rx="9" ry="12.5" fill="url(#ke)"/><ellipse cx="81" cy="85" rx="3.6" ry="4.4" fill="#fff"/><circle cx="87.5" cy="95.5" r="1.8" fill="#fff" opacity="0.85"/>`;
  const face = `<ellipse cx="66" cy="112" rx="10" ry="5.5" fill="${KF.blush}" opacity="0.6"/><ellipse cx="134" cy="112" rx="10" ry="5.5" fill="${KF.blush}" opacity="0.6"/>
<path d="M92 108 Q96 114 100 109 Q104 114 108 108" fill="none" ${ln(KF.eye, 2.6)}/>`;
  const spin = rotation("fur", "squash", [100, 110], [["Flap", [-1, 0, 1]]], ([f = 0]) => ({ angle: f * 5 }));
  return chibiModel(
    "kedama",
    [
      { id: "back", parent: "fur", order: 8, rect: { x: 12, y: 22, w: 176, h: 176 }, mesh: grid(4, 4), svg: back },
      ...pair({ id: "pawL", parent: "sleeves", order: 9, rect: { x: 12, y: 104, w: 40, h: 52 }, mesh: grid(2, 2), svg: pawL }),
      { id: "fur", parent: "fur", order: 10, rect: { x: 26, y: 36, w: 148, h: 148 }, mesh: grid(4, 4), svg: fur },
      { id: "sprout", parent: "bow", order: 11, rect: { x: 92, y: 10, w: 40, h: 42 }, mesh: grid(2, 2), svg: sprout },
      { id: "face", parent: "feat", order: 31, rect: { x: 52, y: 100, w: 96, h: 20 }, mesh: grid(2, 1), svg: face },
      ...pair({ id: "beadL", parent: "eyeL", order: 40, rect: { x: 72, y: 76, w: 26, h: 28 }, mesh: grid(1, 2), svg: eyes }),
      { id: "fringe", parent: "bangs", order: 45, rect: { x: 46, y: 40, w: 108, h: 48 }, mesh: grid(4, 2), svg: fringe },
    ],
    {},
    [squash, spin],
  );
})();

function ghost(id: string, c: { body: string; edge: string; glow: string; eye: string; shine: string }): Model {
  const body = `<defs><radialGradient id="gg" cx="0.4" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="0.35" stop-color="${c.body}"/><stop offset="1" stop-color="${c.edge}"/></radialGradient></defs>
<path d="M42 94 C42 60 68 34 100 34 C132 34 158 60 158 94 C158 126 140 140 132 156 C126 170 134 184 150 190 C124 198 102 184 98 164 C72 162 42 132 42 94 Z" fill="url(#gg)" ${ln(c.edge, LW)}/>
<ellipse cx="78" cy="58" rx="14" ry="8" fill="#ffffff" opacity="0.45"/>`;
  const glow = `<defs><radialGradient id="gl" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${c.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient></defs><circle cx="100" cy="100" r="96" fill="url(#gl)"/>`;
  const tail = warp("tail", "squash", { x: 0, y: 0, w: CW, h: CH }, 4, 6, [["Flap", [-1, 0, 1]]], (x, y, [f = 0]) => [x + f * 12 * Math.max(0, (y - 120) / 70) ** 2, y]);
  return chibiModel(
    id,
    [
      { id: "glow", parent: "bob", order: 0, rect: { x: 0, y: 0, w: 200, h: 200 }, mesh: grid(1, 1), svg: glow },
      { id: "body", parent: "tail", order: 10, rect: { x: 34, y: 26, w: 128, h: 172 }, mesh: grid(4, 6), svg: body },
      ...beadEyes(c.eye, c.shine, 7.5, 10.5),
    ],
    {},
    [squash, tail],
  );
}

export const phantomRig = ghost("phantom", { body: "#dffff8", edge: "#6ad8c4", glow: "#b9fff4", eye: "#1f4a44", shine: "#e0fffa" });
export const shadeRig = ghost("shade", { body: "#4a3470", edge: "#2a1a48", glow: "#7a4ad0", eye: "#ff3050", shine: "#ffc0c8" });

export const yinyangRig: Model = (() => {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `<circle cx="${(100 + Math.cos(a) * 86).toFixed(1)}" cy="${(100 + Math.sin(a) * 86).toFixed(1)}" r="9" fill="#fff" ${ln("#b01830", 3.4)}/>`;
  }).join("");
  const ring = `<circle cx="100" cy="100" r="86" fill="none" ${ln("#e0314b", 7)} opacity="0.55"/><circle cx="100" cy="100" r="74" fill="none" ${ln("#ff8a9a", 2.5)} opacity="0.6"/>${dots}`;
  const orb = `<circle cx="100" cy="100" r="60" fill="#ffffff"/>
<path d="M100 40 A60 60 0 0 1 100 160 A30 30 0 0 1 100 100 A30 30 0 0 0 100 40 Z" fill="#e0314b"/>
<circle cx="100" cy="70" r="9" fill="#e0314b"/><circle cx="100" cy="130" r="9" fill="#ffffff"/>`;
  const rim = `<defs><radialGradient id="os" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#400010" stop-opacity="0.45"/></radialGradient></defs>
<circle cx="100" cy="100" r="60" fill="url(#os)" ${ln("#3a0810", 5)}/>`;
  const orbSpin = rotation("orbSpin", "bob", [100, 100], [["Spin", [0, 1]]], ([s = 0]) => ({ angle: s * 180 }));
  const ringSpin = rotation("ringSpin", "bob", [100, 100], [["Spin", [0, 1]]], ([s = 0]) => ({ angle: -s * 45 }));
  return chibiModel(
    "yinyang",
    [
      { id: "ring", parent: "ringSpin", order: 0, rect: { x: 0, y: 0, w: 200, h: 200 }, mesh: grid(2, 2), svg: ring },
      { id: "orb", parent: "orbSpin", order: 10, rect: { x: 36, y: 36, w: 128, h: 128 }, mesh: grid(2, 2), svg: orb },
      { id: "rim", parent: "bob", order: 11, rect: { x: 36, y: 36, w: 128, h: 128 }, mesh: grid(1, 1), svg: rim },
    ],
    {},
    [orbSpin, ringSpin],
  );
})();
