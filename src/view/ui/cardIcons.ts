// Card glyphs: one bold inline SVG per card, drawn on a 24x24 grid in
// `currentColor` so the hand, the cast plate and CardFace can tint them.
// Details cut out of a glyph use `var(--hole)`, else `var(--kc)` (the card
// kind's colour), so they read as holes in the badge. A card without its own
// glyph falls back to its kind's glyph.

import { cardDef, type CardKind } from "../../content/cards.ts";

/** Points of an n-pointed star centred on the 24x24 grid. */
function star(n: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(`${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(" ")}"/>`;
}

const HOLE = `style="fill:var(--hole, var(--kc))"`;
const LINE = `fill="none" stroke="currentColor" stroke-linecap="round"`;

const HEART = `<path d="M12 21.5C5 16 2 12.5 2 8.2A5 5 0 0 1 12 6a5 5 0 0 1 10 2.2c0 4.3-3 7.8-10 13.3z"/>`;
const SHIELD = `<path d="M12 1.8 20.5 5v6c0 5.2-3.6 8.8-8.5 11.2C7.1 19.8 3.5 16.2 3.5 11V5z"/>`;
const UP = `<path d="M12 1.5 21.5 12H15.6v10H8.4V12H2.5z"/>`;

export const KIND_ICONS: Record<CardKind, string> = {
  attack: star(8, 11.5, 4.6),
  guard: SHIELD,
  heal: HEART,
  buff: UP,
  utility: star(4, 11.5, 3.6),
};

export const CARD_ICONS: Readonly<Record<string, string>> = {
  // A sealing orb bursting outward.
  "fantasy-seal": star(8, 11.8, 5.2) + `<circle cx="12" cy="12" r="3" ${HOLE}/>`,
  // A talisman inside a shield ring.
  barrier:
    `<circle cx="12" cy="12" r="9.8" ${LINE} stroke-width="2.4"/>` +
    `<rect x="8.6" y="4.8" width="6.8" height="14.4" rx="1"/>` +
    `<path d="M10.4 8.2h3.2M10.4 11h3.2M12 13v3.8" fill="none" stroke="var(--hole, var(--kc))" stroke-width="1.5" stroke-linecap="round"/>`,
  healing: HEART,
  "power-charm": UP,
  // A ribbon bow with tails.
  "graze-ribbon":
    `<path d="M12 11 2.5 5.5v11zM12 11l9.5-5.5v11z"/>` +
    `<path d="M11 12.5 7.8 22M13 12.5 16.2 22" ${LINE} stroke-width="2.6"/>` +
    `<circle cx="12" cy="11" r="3.2"/>`,
  // A sword, point up.
  vengeance:
    `<path d="M12 1 15.2 4.8V15H8.8V4.8z"/>` +
    `<rect x="5.5" y="14.6" width="13" height="2.8" rx="1.2"/>` +
    `<rect x="10.7" y="17" width="2.6" height="3.6"/>` +
    `<circle cx="12" cy="21.3" r="1.8"/>`,
  // A pocket watch.
  "pocket-watch":
    `<circle cx="12" cy="13.6" r="8.6"/>` +
    `<rect x="10.3" y="1.4" width="3.4" height="3.2" rx="1"/>` +
    `<path d="M12 13.6V8.4M12 13.6l3.6 2.2" fill="none" stroke="var(--hole, var(--kc))" stroke-width="2.2" stroke-linecap="round"/>`,
  // The Hakkero and its beam.
  "master-spark":
    `<rect x="9" y="7.6" width="14.5" height="8.8" rx="1.4"/>` +
    `<polygon points="3.5,8.2 6.3,6.5 9.1,8.2 9.1,15.8 6.3,17.5 3.5,15.8 1.2,12"/>` +
    `<path d="M12.5 12h8.5" fill="none" stroke="var(--hole, var(--kc))" stroke-width="2" stroke-linecap="round"/>`,
  // A gap: an eye opening in space.
  gap:
    `<path d="M1.2 12C5.8 3.6 18.2 3.6 22.8 12 18.2 20.4 5.8 20.4 1.2 12z"/>` +
    `<circle cx="12" cy="12" r="4.2" ${HOLE}/>` +
    `<circle cx="12" cy="12" r="1.8"/>`,
  // An ankh: life held past death.
  "last-stand":
    `<ellipse cx="12" cy="6.6" rx="4" ry="4.8" ${LINE} stroke-width="3"/>` +
    `<rect x="10.5" y="10.6" width="3" height="11.8" rx="0.6"/>` +
    `<rect x="4.4" y="11.6" width="15.2" height="3" rx="0.6"/>`,
};

/** The inner SVG markup (24x24 viewBox) of a card's glyph: its own, else its kind's. */
export function cardIcon(id: string): string {
  return CARD_ICONS[id] ?? KIND_ICONS[cardDef(id).kind];
}
