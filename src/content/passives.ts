// Passive items offered at level-up. Each level adds `per` to one stat, or the
// item lists its totals by level (`levels`, front-loaded so one or two levels
// already count) and may raise further stats (`also`).

import { formatBonus, STAT_DEFS, type StatKey } from "./stats.ts";

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  stat: StatKey;
  per: number;
  max: number;
  color: number;
  /** Share of this passive's bonus that counts against bosses (default BOSS.upgradeShare). */
  bossMulti?: number;
  /** `stat`'s total at each level, when it is not `per` a level. */
  levels?: readonly number[];
  /** Further stats the item raises: each one's total at each level. */
  also?: Partial<Record<StatKey, readonly number[]>>;
}

export const PASSIVES: readonly PassiveDef[] = [
  { id: "power", name: "Power Item", desc: "Raw spiritual power.", stat: "might", per: 0.1, max: 5, color: 0xff4d4d },
  { id: "heart", name: "Heart Charm", desc: "Takes a hit for you now and then.", stat: "maxHp", per: 20, levels: [20, 40, 55, 70, 80], also: { ward: [20, 17, 15, 13, 12] }, max: 5, color: 0xff7aa2 },
  { id: "geta", name: "Tengu Geta", desc: "Light on your feet, and hard to hit twice.", stat: "speed", per: 0.08, levels: [0.1, 0.18, 0.24, 0.29, 0.33], also: { invuln: [1.5, 2, 2.3, 2.5, 2.7] }, max: 5, color: 0x9b6b43 },
  { id: "clock", name: "Lunar Clock", desc: "Time bends your way.", stat: "cooldown", per: -0.07, max: 5, color: 0xc0c8e0 },
  { id: "magnet", name: "Kappa Magnet", desc: "Kappa engineering pulls items in.", stat: "magnet", per: 0.35, max: 5, color: 0x3fa7ff },
  { id: "grimoire", name: "Grimoire", desc: "Bigger spells.", stat: "area", per: 0.1, max: 5, color: 0x9b59d0 },
  { id: "ribbon", name: "Spirit Ribbon", desc: "Grazing fills the card meter faster.", stat: "graze", per: 0.15, max: 5, color: 0xe0314b },
  { id: "gourd", name: "Oni's Gourd", desc: "A sip now and then.", stat: "regen", per: 0.4, levels: [1.5, 2.2, 2.8, 3.3, 3.6], max: 5, color: 0xd98b3a },
  { id: "neko", name: "Maneki-neko", desc: "Beckons donations.", stat: "greed", per: 0.1, max: 5, color: 0xfff27a },
  { id: "tome", name: "Duplex Tome", desc: "One more of everything.", stat: "amount", per: 1, max: 2, color: 0x7bd88f },
];

export const PASSIVE_BY_ID: Readonly<Record<string, PassiveDef>> = Object.fromEntries(PASSIVES.map((p) => [p.id, p]));

/** Every stat the item raises at `level` (0: none), with its total. */
export function passiveBonus(def: PassiveDef, level: number): [StatKey, number][] {
  if (level <= 0) return [];
  const at = (levels: readonly number[]) => levels[Math.min(level, levels.length) - 1]!;
  const out: [StatKey, number][] = [[def.stat, def.levels ? at(def.levels) : def.per * level]];
  for (const [k, levels] of Object.entries(def.also ?? {}) as [StatKey, readonly number[]][]) out.push([k, at(levels)]);
  return out;
}

/** What reaching `level` adds, for the level-up offer: each stat's gain (a period, "every", as its new value). */
export function passiveGains(def: PassiveDef, level: number): string[] {
  const before = new Map(passiveBonus(def, level - 1));
  return passiveBonus(def, level).map(([k, v]) => formatBonus(k, STAT_DEFS[k].format === "every" ? v : v - (before.get(k) ?? 0)));
}

export function passiveDef(id: string): PassiveDef {
  const p = PASSIVE_BY_ID[id];
  if (!p) throw new Error(`unknown passive "${id}"; passives: ${PASSIVES.map((x) => x.id).join(", ")}`);
  return p;
}
