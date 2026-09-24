// Cirno: the ice fairy. Short light-blue hair, a big blue bow, a blue
// pinafore dress over a white blouse with a red ribbon, six ice wings.

import { headShift, type Drawing } from "./drawing.ts";
import { face } from "./face.ts";

const SKIN = "#ffeee4";
const HAIR = "#7cc8ff";
const HAIR_DARK = "#4f9fe0";
const BOW = "#2f6fe0";
const BOW_DARK = "#1d4aa8";
const DRESS = "#3d7cf0";
const DRESS_DARK = "#2556b8";
const ICE = "#c8f4ff";
const ICE_EDGE = "#7fdcff";

/** Six ice crystals, three a side, fanned behind her back. */
function wings(): string {
  const wing = (x: number, y: number, a: number, len: number) =>
    `<g transform="translate(${x} ${y}) rotate(${a})"><path d="M0 0 L${len * 0.25} -4 L${len} 0 L${len * 0.25} 4 Z" fill="${ICE}" stroke="${ICE_EDGE}" stroke-width="1.2" opacity="0.92"/><path d="M4 0 L${len * 0.8} 0" stroke="#ffffff" stroke-width="1" opacity="0.8"/></g>`;
  let s = "";
  for (const [a, len] of [
    [-150, 34],
    [-172, 40],
    [166, 32],
  ] as const) {
    s += wing(40, 62, a, len);
    s += wing(56, 62, 180 - a, len);
  }
  return s;
}

/** Boss sprite (80x80 cell), facing the player (drawn frontal). */
export const sprite: Drawing = {
  w: 80,
  h: 80,
  scale: 1.2,
  body: (look) => `
  ${wings()}
  <!-- back hair -->
  <path d="M28 38 C24 52 26 60 32 62 L64 62 C70 60 72 52 68 38 Z" fill="${HAIR_DARK}"/>
  <!-- dress -->
  <path d="M36 60 L60 60 L70 88 C60 92 36 92 26 88 Z" fill="${DRESS}"/>
  <path d="M26 88 C36 92 60 92 70 88" fill="none" stroke="#ffffff" stroke-width="2.5"/>
  <path d="M42 62 L38 88 M54 62 L58 88" stroke="${DRESS_DARK}" stroke-width="1.2" opacity="0.6"/>
  <!-- blouse, collar and ribbon -->
  <path d="M38 56 L58 56 L60 66 L36 66 Z" fill="#ffffff"/>
  <path d="M40 56 L48 62 L56 56" fill="none" stroke="#dfe3f0" stroke-width="1"/>
  <path d="M48 60 L41 57 L42 64 Z M48 60 L55 57 L54 64 Z" fill="#e0314b"/>
  <circle cx="48" cy="60.5" r="1.8" fill="#b81f38"/>
  <!-- arms: one fist on the hip, one raised in a cocky point -->
  <path d="M36 60 C30 64 28 70 30 74" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
  <circle cx="31" cy="75" r="3" fill="${SKIN}"/>
  <path d="M60 60 C66 58 70 52 72 46" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
  <circle cx="72.5" cy="44.5" r="3" fill="${SKIN}"/>
  <!-- legs -->
  <rect x="39" y="89" width="6" height="4" rx="2" fill="${SKIN}"/>
  <rect x="51" y="89" width="6" height="4" rx="2" fill="${SKIN}"/>
  <ellipse cx="42" cy="94" rx="4.5" ry="2.2" fill="#3a5fb0"/>
  <ellipse cx="54" cy="94" rx="4.5" ry="2.2" fill="#3a5fb0"/>
  <g transform="${headShift(look)}">
  <!-- head -->
  <ellipse cx="48" cy="40" rx="21" ry="20" fill="${SKIN}"/>
  <!-- bangs: short, spiky -->
  <path d="M26 42 C23 24 36 17 48 17 C60 17 73 24 70 42 C68 36 66 33 63 31 C63 36 60 38 57 39 C57 34 55 31 52 29 C51 34 47 37 44 38 C44 34 43 31 41 30 C38 35 34 38 30 39 C30 36 29 34 28 33 Z" fill="${HAIR}"/>
  <path d="M26 42 C25 48 26 52 28 55 L31 50 Z M70 42 C71 48 70 52 68 55 L65 50 Z" fill="${HAIR}"/>
  <path d="M36 22 C42 19 52 18 58 21" fill="none" stroke="#b8e4ff" stroke-width="2" stroke-linecap="round"/>
  <!-- the big bow -->
  <path d="M48 20 C44 10 30 4 24 10 C19 15 26 24 38 23 Z" fill="${BOW}" stroke="${BOW_DARK}" stroke-width="1.4"/>
  <path d="M48 20 C52 10 66 4 72 10 C77 15 70 24 58 23 Z" fill="${BOW}" stroke="${BOW_DARK}" stroke-width="1.4"/>
  <ellipse cx="48" cy="20" rx="4.5" ry="4" fill="${BOW}" stroke="${BOW_DARK}" stroke-width="1.2"/>
  ${face({ iris: "#2f7fe0", pupil: "#123e86", brow: HAIR_DARK, mouth: "grin" }, look)}
  </g>
  `,
};
