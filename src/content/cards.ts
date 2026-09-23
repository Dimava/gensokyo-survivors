// Skill cards. A card row names an `effect`; each effect is one rule in
// src/sim/cards.ts (a new card that reuses an effect is just a row). Params
// listed in `scales` grow 25% per card level (duplicates from packs level a
// card up to MAX_CARD_LEVEL).

import { CHARACTERS } from "./names.ts";

export type Rarity = "N" | "R" | "SR" | "SSR";

export const RARITIES: readonly Rarity[] = ["N", "R", "SR", "SSR"];

export const RARITY_INFO: Record<Rarity, { label: string; color: number; css: string; refund: number }> = {
  N: { label: "Normal", color: 0xb8c4d6, css: "#b8c4d6", refund: 10 },
  R: { label: "Rare", color: 0x4da3ff, css: "#4da3ff", refund: 25 },
  SR: { label: "Super Rare", color: 0xc56bff, css: "#c56bff", refund: 60 },
  SSR: { label: "Legendary", color: 0xffc94d, css: "#ffc94d", refund: 150 },
};

export type CardEffect =
  | "burst"
  | "clear"
  | "heal"
  | "empower"
  | "grazeHeal"
  | "vengeance"
  | "timeStop"
  | "spark"
  | "gap"
  | "lastStand";

export interface CardDef {
  id: string;
  name: string;
  /** Whose technique it is, for flavour and the card art colour. */
  owner: keyof typeof CHARACTERS;
  rarity: Rarity;
  /** Spirit spent to play it. */
  cost: number;
  effect: CardEffect;
  params: Readonly<Record<string, number>>;
  /** Params that grow with card level. */
  scales: readonly string[];
  /** Text with {param} placeholders filled from the levelled params; durations are in seconds. */
  text: string;
}

export const MAX_CARD_LEVEL = 3;

export const CARDS: readonly CardDef[] = [
  {
    id: "fantasy-seal",
    name: "Spirit Sign “Fantasy Seal”",
    owner: "reimu",
    rarity: "N",
    cost: 1,
    effect: "burst",
    params: { dmg: 60, radius: 190 },
    scales: ["dmg"],
    text: "Deal {dmg} damage to every enemy within {radius} px.",
  },
  {
    id: "barrier",
    name: "Barrier Talisman",
    owner: "reimu",
    rarity: "N",
    cost: 1,
    effect: "clear",
    params: { radius: 240, invuln: 1 },
    scales: ["radius"],
    text: "Erase enemy bullets within {radius} px and become untouchable for {invuln}s.",
  },
  {
    id: "healing",
    name: "Healing Charm",
    owner: "reimu",
    rarity: "N",
    cost: 2,
    effect: "heal",
    params: { hp: 25 },
    scales: ["hp"],
    text: "Restore {hp} HP.",
  },
  {
    id: "power-charm",
    name: "Power Charm",
    owner: "marisa",
    rarity: "R",
    cost: 2,
    effect: "empower",
    params: { pct: 50, time: 10 },
    scales: ["pct"],
    text: "Your weapons deal +{pct}% damage for {time}s.",
  },
  {
    id: "graze-ribbon",
    name: "Graze Ribbon",
    owner: "reimu",
    rarity: "R",
    cost: 2,
    effect: "grazeHeal",
    params: { hp: 1, time: 30 },
    scales: ["hp"],
    text: "For {time}s, every bullet you graze restores {hp} HP.",
  },
  {
    id: "vengeance",
    name: "Vengeful Amulet",
    owner: "reimu",
    rarity: "R",
    cost: 2,
    effect: "vengeance",
    params: { dmg: 120, radius: 220, time: 30 },
    scales: ["dmg"],
    text: "For {time}s, whenever you are hit, blast enemies within {radius} px for {dmg}.",
  },
  {
    id: "pocket-watch",
    name: "Time Sign “Private Square”",
    owner: "sakuya",
    rarity: "SR",
    cost: 3,
    effect: "timeStop",
    params: { time: 3 },
    scales: ["time"],
    text: "Stop every enemy bullet in time for {time}s.",
  },
  {
    id: "master-spark",
    name: "Love Sign “Master Spark”",
    owner: "marisa",
    rarity: "SR",
    cost: 3,
    effect: "spark",
    params: { dmg: 400, length: 900, width: 90 },
    scales: ["dmg"],
    text: "A beam along your facing direction deals {dmg} to everything in it.",
  },
  {
    id: "gap",
    name: "Boundary “Gap Travel”",
    owner: "yukari",
    rarity: "SR",
    cost: 2,
    effect: "gap",
    params: { invuln: 2 },
    scales: ["invuln"],
    text: "Pull every item on the field to you and become untouchable for {invuln}s.",
  },
  {
    id: "last-stand",
    name: "Border of Life and Death",
    owner: "yukari",
    rarity: "SSR",
    cost: 4,
    effect: "lastStand",
    params: { hp: 50 },
    scales: ["hp"],
    text: "The next hit that would defeat you leaves you at {hp}% HP instead.",
  },
];

export const CARD_BY_ID: Readonly<Record<string, CardDef>> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): CardDef {
  const c = CARD_BY_ID[id];
  if (!c) throw new Error(`unknown card "${id}"; cards: ${CARDS.map((x) => x.id).join(", ")}`);
  return c;
}

/** The card's params at a level: scaled params grow 25% per level above 1, rounded. */
export function cardParams(def: CardDef, level: number): Record<string, number> {
  const out: Record<string, number> = { ...def.params };
  const mult = 1 + 0.25 * (Math.max(1, level) - 1);
  for (const k of def.scales) out[k] = Math.round(def.params[k]! * mult * 100) / 100;
  return out;
}

export function cardText(def: CardDef, level: number): string {
  const p = cardParams(def, level);
  return def.text.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? `{${k}}`));
}

/** The cards a new profile owns, all in the deck. */
export const STARTER_CARDS = ["fantasy-seal", "barrier", "healing"] as const;
