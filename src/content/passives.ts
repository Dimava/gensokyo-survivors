// Passive items offered at level-up. Each level adds `per` to one stat.

import type { StatKey } from "./stats.ts";

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  stat: StatKey;
  per: number;
  max: number;
  color: number;
}

export const PASSIVES: readonly PassiveDef[] = [
  { id: "power", name: "Power Item", desc: "Raw spiritual power.", stat: "might", per: 0.1, max: 5, color: 0xff4d4d },
  { id: "heart", name: "Heart Charm", desc: "A little more life.", stat: "maxHp", per: 20, max: 5, color: 0xff7aa2 },
  { id: "geta", name: "Tengu Geta", desc: "Borrowed from a crow tengu.", stat: "speed", per: 0.08, max: 5, color: 0x9b6b43 },
  { id: "clock", name: "Lunar Clock", desc: "Time bends your way.", stat: "cooldown", per: -0.07, max: 5, color: 0xc0c8e0 },
  { id: "magnet", name: "Kappa Magnet", desc: "Kappa engineering pulls items in.", stat: "magnet", per: 0.35, max: 5, color: 0x3fa7ff },
  { id: "grimoire", name: "Grimoire", desc: "Bigger spells.", stat: "area", per: 0.1, max: 5, color: 0x9b59d0 },
  { id: "ribbon", name: "Spirit Ribbon", desc: "Grazing fills the card meter faster.", stat: "graze", per: 0.15, max: 5, color: 0xe0314b },
  { id: "gourd", name: "Oni's Gourd", desc: "A sip now and then.", stat: "regen", per: 0.4, max: 5, color: 0xd98b3a },
  { id: "neko", name: "Maneki-neko", desc: "Beckons donations.", stat: "greed", per: 0.2, max: 5, color: 0xfff27a },
  { id: "tome", name: "Duplex Tome", desc: "One more of everything.", stat: "amount", per: 1, max: 2, color: 0x7bd88f },
];

export const PASSIVE_BY_ID: Readonly<Record<string, PassiveDef>> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));

export function passiveDef(id: string): PassiveDef {
  const p = PASSIVE_BY_ID[id];
  if (!p) throw new Error(`unknown passive "${id}"; passives: ${PASSIVES.map((x) => x.id).join(", ")}`);
  return p;
}
