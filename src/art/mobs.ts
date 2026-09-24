// The small fry that aren't fairies: kedama, phantoms, shades, sunflower
// fairies and yin-yang orbs. Drawn in the 96-unit frame, shown at their
// cell size. Their eyes follow the look like everyone else's.

import { headShift, type Drawing, type Look } from "./drawing.ts";
import { face } from "./face.ts";

/** Two simple dot eyes (for creatures without the chibi face), turned toward `look`. */
function dotEyes(cx: number, cy: number, gap: number, r: number, look: Look, color = "#1a1426"): string {
  const ex = look.x * r * 0.6;
  const ey = look.y * r * 0.5;
  const eye = (x: number) =>
    `<ellipse cx="${x}" cy="${cy}" rx="${r}" ry="${r * 1.2}" fill="#fff"/><circle cx="${x + ex}" cy="${cy + ey}" r="${r * 0.62}" fill="${color}"/><circle cx="${x + ex - r * 0.25}" cy="${cy + ey - r * 0.3}" r="${r * 0.22}" fill="#fff"/>`;
  return eye(cx - gap / 2) + eye(cx + gap / 2);
}

function sized(size: number, body: (look: Look) => string): Drawing {
  return { w: size, h: size, scale: 96 / size, body };
}

/** A fuzzball: a tufted white puff. */
export const kedamaSprite = sized(36, (look) => {
  let tufts = "";
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = i % 2 ? 40 : 34;
    tufts += `${48 + Math.cos(a) * r} ${50 + Math.sin(a) * r} `;
  }
  return `
  <polygon points="${tufts}" fill="#f3e6ff" stroke="#c9b8e8" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="48" cy="50" r="30" fill="#fbf6ff"/>
  <ellipse cx="38" cy="36" rx="10" ry="6" fill="#ffffff" opacity="0.9"/>
  ${dotEyes(48 + look.x * 4, 52 + look.y * 3, 22, 7, look)}
  <ellipse cx="30" cy="64" rx="5" ry="3" fill="#ffb3d0" opacity="0.6"/>
  <ellipse cx="66" cy="64" rx="5" ry="3" fill="#ffb3d0" opacity="0.6"/>`;
});

/** A phantom: a pale teardrop spirit with a wispy tail. */
function ghost(size: number, fill: string, edge: string, glow: string, eyeColor: string) {
  return sized(size, (look) => {
    // The tail trails away from where it looks.
    const tx = 48 - look.x * 16;
    const ty = 88 - Math.max(0, look.y) * 6;
    return `
  <circle cx="48" cy="46" r="40" fill="${glow}" opacity="0.25"/>
  <path d="M48 12 C70 12 80 30 78 46 C76 62 64 70 ${tx + 10} 76 C${tx + 6} 84 ${tx} 90 ${tx - 6} ${ty} C${tx - 2} 82 ${tx - 8} 76 30 70 C20 62 16 50 18 40 C22 22 34 12 48 12 Z" fill="${fill}" stroke="${edge}" stroke-width="2"/>
  <ellipse cx="38" cy="28" rx="9" ry="5" fill="#ffffff" opacity="0.6"/>
  ${dotEyes(48 + look.x * 5, 44 + look.y * 4, 20, 7, look, eyeColor)}`;
  });
}

export const phantomSprite = ghost(39, "#dffff8", "#8ae8d8", "#b9fff4", "#1f4a44");
export const shadeSprite = ghost(45, "#3a2758", "#9a6ad8", "#5a3d8a", "#d02040");

/** A sunflower fairy: a fairy head framed by a big sunflower. */
export const sunflowerSprite = sized(50, (look) => {
  let petals = "";
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 360;
    petals += `<ellipse cx="48" cy="12" rx="7" ry="15" transform="rotate(${a} 48 42)" fill="#ffd23f" stroke="#e8a810" stroke-width="1.2"/>`;
  }
  return `
  ${petals}
  <circle cx="48" cy="42" r="24" fill="#8a5a1e"/>
  <circle cx="48" cy="42" r="24" fill="none" stroke="#5a3810" stroke-width="2" stroke-dasharray="2 3"/>
  <!-- the fairy's little body below -->
  <path d="M38 70 L58 70 L64 90 C56 93 40 93 32 90 Z" fill="#ffb02e"/>
  <path d="M32 90 C40 93 56 93 64 90" fill="none" stroke="#ffffff" stroke-width="2"/>
  <g transform="translate(0 2) ${headShift(look)} translate(48 42) scale(0.95) translate(-48 -42)">
  <ellipse cx="48" cy="44" rx="17" ry="16" fill="#ffeee4"/>
  <path d="M31 42 C30 30 38 26 48 26 C58 26 66 30 65 42 C62 38 58 35 55 34 C54 38 50 39 48 36 C46 39 42 38 41 34 C38 35 34 38 31 42 Z" fill="#a8641e"/>
  <g transform="translate(48 44) scale(0.72) translate(-48 -44)">${face({ iris: "#c07a10", pupil: "#4a2a06", brow: "#6a3a10", mouth: "smile" }, look)}</g>
  </g>`;
});

/** A yin-yang orb: heavy, glossy, a little menacing. */
export const yinyangSprite = sized(64, (look) => `
  <circle cx="48" cy="48" r="44" fill="#d04a6a" opacity="0.25"/>
  <circle cx="48" cy="48" r="38" fill="#ffffff" stroke="#8a1c33" stroke-width="3"/>
  <path d="M48 10 A38 38 0 0 1 48 86 A19 19 0 0 1 48 48 A19 19 0 0 0 48 10 Z" fill="#d0304e"/>
  <circle cx="48" cy="29" r="6" fill="#d0304e"/>
  <circle cx="48" cy="67" r="6" fill="#ffffff"/>
  <ellipse cx="${34 + look.x * 3}" cy="${28 + look.y * 3}" rx="10" ry="6" fill="#ffffff" opacity="0.55" transform="rotate(-30 34 28)"/>`);
