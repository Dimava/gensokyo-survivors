// The shared chibi face, so every character reads as the same art style.
// Coordinates are in the 96-unit character frame (head centred at 48, 40).

import { AHEAD, type Look } from "./drawing.ts";

export interface FaceOpts {
  iris: string;
  pupil: string;
  brow: string;
  /** "smile", "grin" (open, cocky), "o" (small open), "flat". */
  mouth?: "smile" | "grin" | "o" | "flat";
  blush?: boolean;
}

/** The face, its irises turned toward `look`. */
export function face(o: FaceOpts, look: Look = AHEAD): string {
  const ex = look.x * 2;
  const ey = look.y * 1.6;
  const mouth = {
    smile: `<path d="M46 52 Q48 53.5 50 52" fill="none" stroke="#a0463f" stroke-width="1.2" stroke-linecap="round"/>`,
    grin: `<path d="M44.5 51 Q48 56 51.5 51 Z" fill="#b03a4a"/><path d="M45.5 51.2 L50.5 51.2" stroke="#fff" stroke-width="1"/>`,
    o: `<ellipse cx="48" cy="52.5" rx="1.6" ry="1.3" fill="#b03a4a"/>`,
    flat: `<path d="M46 52.5 L50 52.5" stroke="#a0463f" stroke-width="1.2" stroke-linecap="round"/>`,
  }[o.mouth ?? "smile"];
  // The eye white stays put; iris, pupil and highlights move within it.
  // Every eye has the same shape, so a shared clip id is safe even with many faces on one page.
  const eye = (cx: number) => `
  <clipPath id="eye-${cx}"><ellipse cx="${cx}" cy="44" rx="4" ry="5.2"/></clipPath>
  <ellipse cx="${cx}" cy="44" rx="4" ry="5.2" fill="#fff"/>
  <g clip-path="url(#eye-${cx})">
  <ellipse cx="${cx + ex}" cy="${44 + ey}" rx="3.2" ry="4.4" fill="${o.iris}"/>
  <ellipse cx="${cx + ex}" cy="${45.3 + ey}" rx="2" ry="2.6" fill="${o.pupil}"/>
  <circle cx="${cx - 1 + ex}" cy="${42.4 + ey}" r="1.3" fill="#fff"/>
  <circle cx="${cx + 1.1 + ex}" cy="${46.4 + ey}" r="0.6" fill="#fff" opacity="0.8"/>
  </g>
  <path d="M${cx - 4.2} 41.2 Q${cx} 37.8 ${cx + 4.2} 41.2" fill="none" stroke="#2a1a1a" stroke-width="1.3" stroke-linecap="round"/>`;
  return `${eye(40.5)}${eye(56.5)}
  <path d="M36 39.5 L44 39" stroke="${o.brow}" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M52 39 L60 39.5" stroke="${o.brow}" stroke-width="1.4" stroke-linecap="round"/>
  ${o.blush === false ? "" : `<ellipse cx="35.5" cy="50" rx="3" ry="1.6" fill="#ff8fa3" opacity="0.55"/><ellipse cx="61.5" cy="50" rx="3" ry="1.6" fill="#ff8fa3" opacity="0.55"/>`}
  ${mouth}`;
}
