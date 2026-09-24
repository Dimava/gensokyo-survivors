// Rumia: the youkai of the dusk. Blonde bob, a red talisman ribbon, red
// eyes, black vest and skirt over a white shirt, arms spread like a cross,
// wrapped in a ball of darkness.

import { headShift, type Drawing } from "./drawing.ts";
import { face } from "./face.ts";

const SKIN = "#fff0e6";
const HAIR = "#f6dc6a";
const HAIR_DARK = "#d9b640";
const BLACK = "#24202e";
const BLACK_LIGHT = "#3a3448";
const RED = "#e0314b";

/** Boss sprite (80x80 cell): arms out, "is that so~". */
export const sprite: Drawing = {
  w: 80,
  h: 80,
  scale: 1.2,
  body: (look) => `
  <defs>
    <radialGradient id="rumia-dark" cx="50%" cy="55%" r="50%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.75"/>
      <stop offset="70%" stop-color="#1a0f2a" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#1a0f2a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="48" cy="52" r="46" fill="url(#rumia-dark)"/>
  <!-- arms spread: white sleeves -->
  <path d="M36 60 L10 56" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
  <path d="M60 60 L86 56" stroke="#ffffff" stroke-width="7" stroke-linecap="round"/>
  <circle cx="7.5" cy="55.5" r="3.2" fill="${SKIN}"/>
  <circle cx="88.5" cy="55.5" r="3.2" fill="${SKIN}"/>
  <!-- skirt -->
  <path d="M36 70 L60 70 L68 88 C58 91 38 91 28 88 Z" fill="${BLACK}"/>
  <path d="M42 72 L39 88 M54 72 L57 88" stroke="${BLACK_LIGHT}" stroke-width="1.2"/>
  <!-- legs -->
  <rect x="39" y="89" width="6" height="4" rx="2" fill="${SKIN}"/>
  <rect x="51" y="89" width="6" height="4" rx="2" fill="${SKIN}"/>
  <ellipse cx="42" cy="94" rx="4.5" ry="2.2" fill="#6a2a2a"/>
  <ellipse cx="54" cy="94" rx="4.5" ry="2.2" fill="#6a2a2a"/>
  <!-- shirt and vest -->
  <path d="M37 56 L59 56 L61 72 L35 72 Z" fill="#ffffff"/>
  <path d="M37 56 L45 56 L47 72 L35 72 Z M59 56 L51 56 L49 72 L61 72 Z" fill="${BLACK}"/>
  <path d="M48 58 L45.5 61 L48 70 L50.5 61 Z" fill="${RED}"/>
  <g transform="${headShift(look)}">
  <!-- head -->
  <ellipse cx="48" cy="40" rx="21" ry="20" fill="${SKIN}"/>
  <!-- bob: rounded, ends at the jaw -->
  <path d="M25 44 C22 24 35 17 48 17 C61 17 74 24 71 44 C71 50 69 54 66 56 C66 50 65 45 64 42 C62 36 60 33 58 31 C57 36 54 38 51 39 C51 34 50 31 48 29 C46 34 43 37 39 38 C40 34 39 31 37 30 C34 34 32 38 32 42 C31 45 30 50 30 56 C27 54 25 50 25 44 Z" fill="${HAIR}"/>
  <path d="M34 22 C40 19 52 18 58 21" fill="none" stroke="#fff3b0" stroke-width="2" stroke-linecap="round"/>
  <!-- talisman ribbon on her left -->
  <path d="M66 26 L74 20 L75 30 Z M66 26 L74 34 L68 36 Z" fill="${RED}" stroke="#a81c33" stroke-width="0.8"/>
  <circle cx="66.5" cy="27" r="2.2" fill="#a81c33"/>
  ${face({ iris: "#d0202e", pupil: "#6a0a14", brow: HAIR_DARK, mouth: "o" }, look)}
  </g>
  `,
};
