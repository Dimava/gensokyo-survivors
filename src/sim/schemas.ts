// Schemas shared between scope types (kept apart from the scope modules so
// that importing them never runs into a module cycle).

import { z } from "zod";

export const PHASES = ["swarm", "warning", "dialogue", "boss", "cleared", "over"] as const;
export type Phase = (typeof PHASES)[number];
export const OUTCOMES = ["none", "dead", "clear", "quit"] as const;
export type Outcome = (typeof OUTCOMES)[number];

const num = z.number();
const int = z.int();

export const OfferChoice = z.object({
  kind: z.enum(["weapon", "passive", "heal", "coins"]),
  id: z.string(),
  /** The level it will be at after picking (0 for heal/coins). */
  level: int,
});
export type OfferChoice = z.output<typeof OfferChoice>;

export const RunSummary = z.object({
  stage: z.string(),
  outcome: z.enum(OUTCOMES),
  seconds: int,
  level: int,
  kills: int,
  grazes: int,
  cardsPlayed: int,
  spellsCaptured: int,
  spellsTotal: int,
  bossDefeated: z.boolean(),
  coins: z.object({ drops: int, survival: int, kills: int, spells: int, clear: int, greed: num, total: int }),
});
export type RunSummary = z.output<typeof RunSummary>;

export const DeckEntry = z.object({ id: z.string(), level: int });
export type DeckEntry = z.output<typeof DeckEntry>;
