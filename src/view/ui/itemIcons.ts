// Weapon and passive item icons: one small inline SVG per item, each drawing
// the artifact it is named after (refs/items; spellcards/STYLE.md "Items"),
// on a 24x24 grid in `currentColor` so the HUD tints it with the item's
// colour. Cut-out details use `var(--hole)`, the slot's dark background, the
// same way cardIcons.ts cuts its glyphs.
//
// The sets are kept side by side (prefs.itemIcons picks one): the first, and
// the second, where no icon is a bare frame shape (a filled disc, a rounded
// square) that reads as the slot's own frame, and every one holds up at the
// HUD's 17 px.

import { prefs } from "../prefs.ts";

const HOLE = `style="fill:var(--hole, #0a0e1e)"`;
const HOLE_LINE = `fill="none" style="stroke:var(--hole, #0a0e1e)" stroke-linecap="round"`;
const LINE = `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`;

/** The first set. */
export const ITEM_ICONS_V1: Readonly<Record<string, string>> = {
  // Weapons.
  // An ofuda: a paper strip with a seal mark.
  amulet:
    `<rect x="7" y="2" width="10" height="20" rx="1"/>` +
    `<rect x="9.2" y="5" width="5.6" height="5.6" ${HOLE}/>` +
    `<path d="M12 13.5v5.5" ${HOLE_LINE} stroke-width="1.6"/>`,
  // Two persuasion needles, crossed.
  needle: `<path d="M3 16.5 16.5 3M7.5 21 21 7.5" ${LINE} stroke-width="2.2"/>` + `<circle cx="3.6" cy="15.9" r="1.7"/><circle cx="8.1" cy="20.4" r="1.7"/>`,
  // A yin-yang orb.
  orbs:
    `<circle cx="12" cy="12" r="10.5"/>` +
    `<path d="M12 2.6a4.7 4.7 0 0 1 0 9.4 4.7 4.7 0 0 0 0 9.4A9.4 9.4 0 0 0 12 2.6z" ${HOLE}/>` +
    `<circle cx="12" cy="7.3" r="1.7"/>` +
    `<circle cx="12" cy="16.7" r="1.7" ${HOLE}/>`,
  // The Hakurei border: a square barrier with a smaller one turned inside.
  border: `<rect x="2.5" y="2.5" width="19" height="19" rx="1" ${LINE} stroke-width="2.6"/>` + `<path d="M12 5.6 18.4 12 12 18.4 5.6 12z"/>`,
  // The Mini-Hakkero: an octagon, its bagua ring and a glowing core.
  spark:
    `<polygon points="8,1.5 16,1.5 22.5,8 22.5,16 16,22.5 8,22.5 1.5,16 1.5,8"/>` +
    `<polygon points="9.3,5 14.7,5 19,9.3 19,14.7 14.7,19 9.3,19 5,14.7 5,9.3" ${HOLE_LINE} stroke-width="1.3" stroke-dasharray="2.6 1.4"/>` +
    `<circle cx="12" cy="12" r="3.4" ${HOLE}/>` +
    `<circle cx="12" cy="12" r="1.8"/>`,
  // A silver throwing knife, point up and to the right.
  knives: `<path d="M21.5 2.5 9.8 11.4l2.8 2.8z"/>` + `<path d="M7.6 12.6l3.8 3.8" ${LINE} stroke-width="2.4"/>` + `<path d="M8.2 16.2 3 21.4" ${LINE} stroke-width="3"/>`,

  // Passive items.
  // The power item: a square with a P.
  power: `<rect x="3" y="3" width="18" height="18" rx="3"/>` + `<path d="M9.5 17.5v-11h3.6a3.2 3.2 0 0 1 0 6.4H9.5" ${HOLE_LINE} stroke-width="2.6" stroke-linejoin="round"/>`,
  // A heart charm on its cord.
  heart:
    `<path d="M12 21.5C5 16 2.5 12.5 2.5 8.6A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9.5 2c0 3.9-2.5 7.4-9.5 12.9z"/>` +
    `<path d="M12 6.6V2" ${LINE} stroke-width="1.6"/>` +
    `<circle cx="8" cy="9.4" r="1.4" ${HOLE}/>`,
  // A tengu geta seen from above: the sole and its V-shaped thong.
  geta:
    `<rect x="6" y="1.5" width="12" height="21" rx="4.5"/>` +
    `<path d="M8.4 13.5 12 5.5l3.6 8" ${HOLE_LINE} stroke-width="2.2" stroke-linejoin="round"/>` +
    `<circle cx="12" cy="5.5" r="1.5" ${HOLE}/>`,
  // The lunar clock: a pocket watch face with a crescent moon on it.
  clock:
    `<circle cx="12" cy="13" r="9.5"/>` +
    `<rect x="10.3" y="0.8" width="3.4" height="3" rx="1"/>` +
    `<path d="M12 13V7.6M12 13l3.6 2.2" ${HOLE_LINE} stroke-width="2"/>` +
    `<path d="M6.6 16.4a3.4 3.4 0 1 0 4.6 3.4 2.6 2.6 0 1 1-4.6-3.4z" ${HOLE}/>`,
  // A kappa's horseshoe magnet with bright pole tips.
  magnet: `<path d="M3.5 3v9a8.5 8.5 0 0 0 17 0V3h-5.4v9a3.1 3.1 0 0 1-6.2 0V3z"/>` + `<path d="M3.5 3h5.4v4H3.5zM15.1 3h5.4v4h-5.4z" fill="#e8ecf8"/>`,
  // A grimoire: a clasped book with a star.
  grimoire:
    `<rect x="4" y="2" width="16" height="20" rx="1.6"/>` +
    `<path d="M12 7.2l1.4 2.9 3.1.4-2.3 2.1.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.1 3.1-.4z" ${HOLE}/>` +
    `<rect x="18" y="10" width="4" height="4" rx="0.8"/>`,
  // A ribbon bow.
  ribbon: `<path d="M12 11 2.5 5v12zM12 11l9.5-6v12z"/>` + `<circle cx="12" cy="11" r="3"/>` + `<path d="M10.8 13 8.6 21.5M13.2 13l2.2 8.5" ${LINE} stroke-width="2.2"/>`,
  // The Ibuki gourd, with its cord and label.
  gourd:
    `<circle cx="12" cy="8" r="4.6"/><circle cx="12" cy="16.4" r="6.4"/>` +
    `<rect x="10.4" y="1.2" width="3.2" height="3" rx="0.8"/>` +
    `<path d="M7.8 11.4c2.6 1.2 5.8 1.2 8.4 0" ${HOLE_LINE} stroke-width="1.4"/>` +
    `<rect x="10.2" y="14.2" width="3.6" height="5" rx="0.5" ${HOLE}/>`,
  // A maneki-neko: a round cat, one paw raised, a collar and a koban coin.
  neko:
    `<path d="M5.8 7 6.6 1.2l4.4 3.4zM18.2 7l-.8-5.8L13 4.6z"/>` +
    `<circle cx="12" cy="9" r="6.4"/>` +
    `<rect x="6" y="13" width="12" height="9.5" rx="4"/>` +
    `<rect x="17.4" y="5.4" width="4.2" height="7" rx="2.1"/>` +
    `<path d="M8.6 9.2q1-1.2 2 0M13.4 9.2q1-1.2 2 0" ${HOLE_LINE} stroke-width="1.2"/>` +
    `<rect x="6.5" y="13.6" width="11" height="1.5" ${HOLE}/>` +
    `<rect x="9.3" y="16.4" width="5.4" height="4.4" rx="2.2" ${HOLE}/>`,
  // The duplex tome: two books, one behind the other.
  tome:
    `<rect x="2.5" y="5" width="12" height="16" rx="1.2" opacity="0.6"/>` +
    `<rect x="9" y="2.5" width="12.5" height="17" rx="1.2"/>` +
    `<path d="M15.2 7.5v7M11.7 11h7" ${HOLE_LINE} stroke-width="2"/>`,

  // Level-up fallbacks, once everything is maxed.
  // An onigiri: a rounded triangle of rice with its nori band.
  onigiri:
    `<path d="M12 2.5c1.8 0 3 1.2 4 2.8l5.2 9.4c1.6 3-.2 6.8-3.7 6.8H6.5c-3.5 0-5.3-3.8-3.7-6.8L8 5.3c1-1.6 2.2-2.8 4-2.8z"/>` +
    `<rect x="8" y="14" width="8" height="7.5" rx="0.6" ${HOLE}/>` +
    `<circle cx="10" cy="9" r="0.8" ${HOLE}/><circle cx="14.2" cy="10.4" r="0.8" ${HOLE}/>`,
  // An offering: a mon coin with its square hole, and the rim stamped in.
  offering:
    `<circle cx="12" cy="12" r="10"/>` +
    `<circle cx="12" cy="12" r="7.6" ${HOLE_LINE} stroke-width="1.2"/>` +
    `<rect x="9.3" y="9.3" width="5.4" height="5.4" ${HOLE}/>`,
};

/**
 * The second set: the frame-shaped icons (the power item's rounded square,
 * the clock's and the coin's discs, the border's outlined square, the
 * grimoire's slab) redrawn as objects with a silhouette of their own, and the
 * ones that did not read at HUD size drawn again: the Tengu Geta (a blank
 * rounded bar from above) and the Oni's Gourd and Duplex Tome, whose cut marks
 * crossed into a "+".
 */
export const ITEM_ICONS_V2: Readonly<Record<string, string>> = {
  ...ITEM_ICONS_V1,
  // The Hakurei border: two barrier squares crossed into an eight-point seal round a bright core.
  border:
    `<rect x="5.2" y="5.2" width="13.6" height="13.6" ${LINE} stroke-width="2.2"/>` +
    `<path d="M12 2.4 21.6 12 12 21.6 2.4 12z" ${LINE} stroke-width="2.2"/>` +
    `<circle cx="12" cy="12" r="2.6"/>`,
  // The power item tumbling, a spark beside it.
  power:
    `<g transform="rotate(-14 11 13)"><rect x="3.6" y="5.6" width="14.8" height="14.8" rx="2.6"/>` +
    `<path d="M9 17.2V8.8h3.4a2.7 2.7 0 0 1 0 5.4H9" ${HOLE_LINE} stroke-width="2.3" stroke-linejoin="round"/></g>` +
    `<path d="M19.6 1.2l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z"/>`,
  // A tengu's one-toothed geta from the side, stepping: the board, its single tall tooth, the red thong low over the front, speed lines behind.
  geta:
    `<g transform="rotate(-10 12 12)">` +
    `<path d="M2.4 9.4h19c.9 0 1.4.9 1 1.7l-1 2H3.2l-1.3-2.2c-.4-.6 0-1.5.5-1.5z"/>` +
    `<path d="M10 13h5l-.8 9.4h-3.4z"/>` +
    `<path d="M5 9.4C5.4 6.6 7.6 5.2 9.6 5.6 11.4 6 12.4 7.6 12.6 9.4" fill="none" stroke="#d8363f" stroke-width="2.3" stroke-linecap="round"/></g>` +
    `<path d="M0.8 17.4h5.4M2.2 20.8h4.4" ${LINE} stroke-width="1.5" opacity="0.7"/>`,
  // The lunar clock: a watch in the hollow of a crescent moon, its crown on top.
  clock:
    `<path d="M10.3 3.5A9.5 9.5 0 1 0 19.9 16.3 8 8 0 0 1 10.3 3.5z"/>` +
    `<circle cx="15.4" cy="9.6" r="5.9"/>` +
    `<rect x="14" y="1.2" width="2.8" height="2.6" rx="0.7"/>` +
    `<path d="M15.4 9.6V6.2M15.4 9.6l2.6 1.5" ${HOLE_LINE} stroke-width="1.7"/>`,
  // A grimoire tipped on its corner: the cover with its star, a clasp, and the cream page block showing under it.
  grimoire:
    `<g transform="rotate(-11 12 12)">` +
    `<rect x="5.6" y="17" width="13.4" height="4.4" rx="0.8" fill="#eadfc4"/>` +
    `<path d="M7 18.4h11M7 20h11" stroke="#b9a883" stroke-width="0.7"/>` +
    `<rect x="4.4" y="2" width="15" height="16.4" rx="1.6"/>` +
    `<rect x="4.4" y="2" width="2.6" height="16.4" rx="1" opacity="0.6" ${HOLE}/>` +
    `<path d="M12.6 5.4l1.5 3.1 3.3.4-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.4z" ${HOLE}/>` +
    `<rect x="18.2" y="8.6" width="3.6" height="3.8" rx="0.8"/></g>`,
  // The Ibuki gourd leaning, a narrow waist between its bulbs, the cord tied round it and its tassel hanging free.
  gourd:
    `<g transform="rotate(14 12 12)">` +
    `<path d="M12 3.4c2.5 0 4.2 1.9 4.2 4.1 0 1.5-.8 2.5-1.5 3.3 3.1 1 5.3 3.4 5.3 6.2 0 3.6-3.6 5.6-8 5.6s-8-2-8-5.6c0-2.8 2.2-5.2 5.3-6.2-.7-.8-1.5-1.8-1.5-3.3 0-2.2 1.7-4.1 4.2-4.1z"/>` +
    `<rect x="10.6" y="0.8" width="2.8" height="3.4" rx="0.8"/>` +
    `<path d="M9.4 11.2h5.2" ${HOLE_LINE} stroke-width="1.6"/>` +
    `<path d="M7.2 15.8a5 4.6 0 0 1 3-3" ${HOLE_LINE} stroke-width="1.5"/></g>` +
    `<path d="M15.6 11.6c2.2.4 3.8 1.6 4.4 3.4" ${LINE} stroke-width="1.4"/>` +
    `<path d="M20 14.6l1.4 3.6h-2.8z"/>`,
  // The duplex tome: the same two books, a spine line and a title plate on the front one instead of a cross.
  tome:
    `<rect x="2.5" y="5" width="12" height="16" rx="1.2" opacity="0.6"/>` +
    `<rect x="9" y="2.5" width="12.5" height="17" rx="1.2"/>` +
    `<path d="M11.4 3.8v14.4" ${HOLE_LINE} stroke-width="1"/>` +
    `<rect x="13.2" y="6" width="6.4" height="3.2" rx="0.4" ${HOLE}/>`,
  // An offering: two mon coins, one behind the other, the front one's square hole and stamped rim.
  offering:
    `<circle cx="9" cy="9" r="7" opacity="0.6"/>` +
    `<circle cx="14.2" cy="14.2" r="8.2"/>` +
    `<circle cx="14.2" cy="14.2" r="6.1" ${HOLE_LINE} stroke-width="1.2"/>` +
    `<rect x="12" y="12" width="4.4" height="4.4" ${HOLE}/>`,
};

export type ItemIconSet = "v1" | "v2";
/** Every set, newest first (the gallery can switch between them; prefs.itemIcons holds the pick). */
export const ITEM_ICON_SETS: readonly { id: ItemIconSet; label: string; icons: Readonly<Record<string, string>> }[] = [
  { id: "v2", label: "Objects", icons: ITEM_ICONS_V2 },
  { id: "v1", label: "First", icons: ITEM_ICONS_V1 },
];

/** The set to draw with: the one asked for, else the preference's. */
function currentSet(set?: ItemIconSet): ItemIconSet {
  return set ?? (prefs.itemIcons === "v1" ? "v1" : "v2");
}

/** The inner SVG markup (24x24 viewBox) of an item's icon, or a plain dot for an item without one. */
export function itemIcon(id: string, set?: ItemIconSet): string {
  const icons = currentSet(set) === "v1" ? ITEM_ICONS_V1 : ITEM_ICONS_V2;
  return icons[id] ?? `<circle cx="12" cy="12" r="7"/>`;
}

/** The Duplex Tome with `copies` books, each further copy behind and down-left of the last, fainter. */
function tomeStack(copies: number, set: ItemIconSet): string {
  if (copies <= 2) return itemIcon("tome", set);
  // Three books: the same diagonal as the pair, stepped tighter to fit the 24-unit box.
  const mark =
    set === "v1"
      ? `<path d="M16.7 7.5v7M13.2 11h7" ${HOLE_LINE} stroke-width="2"/>`
      : `<path d="M12.9 3.8v14.4" ${HOLE_LINE} stroke-width="1"/><rect x="14.6" y="6" width="6.4" height="3.2" rx="0.4" ${HOLE}/>`;
  return (
    `<rect x="1" y="7.5" width="11.5" height="15" rx="1.2" opacity="0.35"/>` +
    `<rect x="5.5" y="5" width="12" height="16" rx="1.2" opacity="0.6"/>` +
    `<rect x="10.5" y="2.5" width="12.5" height="17" rx="1.2"/>` +
    mark
  );
}

/** An item's icon at a level: the Duplex Tome shows one more copy per level (a pair at 1, three at 2); the rest are the same at every level. */
export function itemIconAt(id: string, level: number, set?: ItemIconSet): string {
  const s = currentSet(set);
  return id === "tome" ? tomeStack(level + 1, s) : itemIcon(id, s);
}
