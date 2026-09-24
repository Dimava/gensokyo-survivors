// The heroines as full-body chibis for the field (the player and the
// bosses), on the fairy builder: same palettes as their portraits.

import type { Model, Part } from "./rig.ts";
import { brooch, grid } from "./kit.ts";
import { fairy } from "./fairy.ts";

/**
 * Reimu's hitbox, worn: a yin-yang brooch pinned at the knot of her ascot. The
 * orb (radius 11.5 units = 3 game px, PLAYER.hitbox) is the collision circle;
 * the gold rim and clasp reach past it. The field pins this part's centre (the
 * middle vertex of its 2x2 grid) to the player's position and lifts the mesh
 * above the bullets, with a glow behind it (renderer.ts).
 */
export const HITBOX_PART = "charm";
export const CHARM: Part = {
  id: HITBOX_PART,
  parent: "body",
  order: 16,
  rect: { x: 76, y: 100, w: 48, h: 48 },
  mesh: grid(2, 2),
  svg: brooch(100, 124, 11.5),
};

const eye = (dark: string, mid: string, light: string, pupil: string) => ({ dark, mid, light, pupil, lash: "#1c0b0c" });

export const reimuChibi: Model = fairy("reimu", {
  hair: { base: "#3d251a", shade: "#26150f", light: "#6b4634", line: "#140806", top: "#4f3223", bottom: "#2e1b13" },
  dress: { base: "#e0283c", shade: "#a9172b", line: "#5a0a14" },
  sleeve: { base: "#ffffff", shade: "#d8daf0", line: "#6d6788" },
  sleeves: "detached",
  trim: "#e0283c",
  face: { eye: eye("#4e0f0c", "#9a2c20", "#e0633e", "#250404") },
  wings: "none",
  back: 156,
  bow: "#ffd93d",
  sideTube: "#e0283c",
  bigBow: { base: "#e0283c", shade: "#a9172b", line: "#5a0a14", frill: true },
  extra: [CHARM],
});

export const cirnoChibi: Model = fairy("cirno", {
  hair: { base: "#7cc8ff", shade: "#4f9fe0", light: "#d2f0ff", line: "#1d4a88", top: "#a4dcff", bottom: "#5eaaf0" },
  dress: { base: "#3d7cf0", shade: "#2556b8", line: "#12306e" },
  sleeve: { base: "#ffffff", shade: "#d8daf0", line: "#6d6788" },
  trim: "#ffffff",
  face: { eye: eye("#0d2c6a", "#2f6fd0", "#86ccff", "#081838"), mouth: "grin" },
  wings: "ice",
  back: 126,
  bow: "#e0314b",
  bigBow: { base: "#2f6fe0", shade: "#1d4aa8", line: "#0e2a66" },
});

export const rumiaChibi: Model = fairy("rumia", {
  hair: { base: "#f6dc6a", shade: "#d9b640", light: "#fff6c4", line: "#7a5a10", top: "#ffeb96", bottom: "#e6c24c" },
  dress: { base: "#2a2534", shade: "#1a1622", line: "#0c0a10" },
  sleeve: { base: "#ffffff", shade: "#d8daf0", line: "#6d6788" },
  sleeves: "spread",
  trim: "#4a4258",
  face: { eye: eye("#5a0810", "#b8182e", "#ff6464", "#2a0206"), mouth: "o" },
  wings: "none",
  back: 126,
  bow: "#e0314b",
  ribbon: "#e0314b",
  aura: "#0a0612",
});
