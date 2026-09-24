// Idle expeditions (game PRD D3): companions leave the shrine for real
// minutes or hours and come back with donations. Destinations are rows.

import { PLACES, type CharacterId } from "./names.ts";

export interface DestinationDef {
  id: string;
  name: string;
  blurb: string;
  /** Real seconds away. */
  seconds: number;
  /** Donations brought back. */
  coins: number;
}

export const DESTINATIONS: readonly DestinationDef[] = [
  { id: "errand", name: "Tea errand", blurb: "Down to the village for tea leaves and gossip.", seconds: 5 * 60, coins: 12 },
  { id: "village", name: "Human Village rounds", blurb: "Collect offerings from the villagers.", seconds: 60 * 60, coins: 90 },
  { id: "forest", name: `${PLACES.forest} patrol`, blurb: "Mushrooms, fairies, and whatever Marisa left lying around.", seconds: 4 * 60 * 60, coins: 260 },
  { id: "festival", name: "Festival stall", blurb: "Run a stall for a whole day of festival.", seconds: 8 * 60 * 60, coins: 450 },
];

export const DEST_BY_ID: Readonly<Record<string, DestinationDef>> = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));

export function destination(id: string): DestinationDef {
  const d = DEST_BY_ID[id];
  if (!d) throw new Error(`unknown destination "${id}"; destinations: ${DESTINATIONS.map((x) => x.id).join(", ")}`);
  return d;
}

/** Always at the shrine; others join when you own one of their skill cards. */
export const STARTING_COMPANIONS: readonly CharacterId[] = ["daiyousei"];

/** Off for now: the menu hides Expeditions and no return toast shows. The sim and saves keep them. */
export const EXPEDITIONS_ENABLED = false;

/** How many companions can be away at once. */
export const MAX_EXPEDITIONS = 3;

/** Longest absence the game credits in one go (a wrong system clock cannot pay out a year). */
export const MAX_ELAPSED_SECONDS = 7 * 24 * 60 * 60;
