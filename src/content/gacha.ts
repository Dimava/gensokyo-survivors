// Card packs. Odds per rarity, a pity rule (a pack is guaranteed to hold a
// card of at least `pity.rarity` after `pity.every - 1` packs without one),
// and the deck limits.

import type { Rarity } from "./cards.ts";

export interface PackDef {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  cards: number;
  /** Weights per rarity; they need not sum to 1. */
  odds: Readonly<Record<Rarity, number>>;
  pity: { rarity: Rarity; every: number };
}

export const PACKS: readonly PackDef[] = [
  {
    id: "omikuji",
    name: "Omikuji Pack",
    blurb: "Three cards from the shrine's fortune box.",
    cost: 100,
    cards: 3,
    odds: { N: 64, R: 26, SR: 8.5, SSR: 1.5 },
    pity: { rarity: "SR", every: 8 },
  },
];

export const PACK_BY_ID: Readonly<Record<string, PackDef>> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

export function packDef(id: string): PackDef {
  const p = PACK_BY_ID[id];
  if (!p) throw new Error(`unknown pack "${id}"; packs: ${PACKS.map((x) => x.id).join(", ")}`);
  return p;
}

/** Cards a run's deck may hold, and the least it needs. */
export const DECK_MAX = 8;
export const DECK_MIN = 1;
