// Player stats: base values, labels and formatting. Passives (level-up) and
// shrine nodes (meta) add to these by key; the run derives the final values.

export const STAT_KEYS = [
  "maxHp",
  "regen",
  "armor",
  "might",
  "area",
  "speed",
  "cooldown",
  "amount",
  "magnet",
  "growth",
  "greed",
  "graze",
  "spiritRegen",
  "spiritMax",
  "hand",
  "revive",
  "reroll",
  "duration",
  "dmg",
  "headStart",
  "weaponLevel",
  "fullHand",
  "skip",
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export interface StatDef {
  label: string;
  /** How a bonus reads: "+10%" (pct), "+1" (flat), "+0.5/s" (rate). */
  format: "pct" | "flat" | "rate" | "hp";
  base: number;
  help: string;
  /** Used once as a run begins (shrine head starts), not a stat of the run itself. */
  start?: boolean;
}

export const STAT_DEFS: Record<StatKey, StatDef> = {
  maxHp: { label: "Max HP", format: "hp", base: 100, help: "Health. At 0 the run ends." },
  regen: { label: "Recovery", format: "rate", base: 0, help: "HP restored per second." },
  armor: { label: "Armor", format: "flat", base: 0, help: "Damage taken is reduced by this much per hit (at least 1 gets through)." },
  might: { label: "Might", format: "pct", base: 1, help: "Multiplies all damage you deal." },
  area: { label: "Area", format: "pct", base: 1, help: "Size of auras, orbits, beams and projectiles." },
  speed: { label: "Move Speed", format: "pct", base: 1, help: "How fast you move." },
  cooldown: { label: "Cooldown", format: "pct", base: 1, help: "Time between weapon volleys (lower is faster)." },
  amount: { label: "Amount", format: "flat", base: 0, help: "Extra projectiles and orbs per volley." },
  magnet: { label: "Magnet", format: "pct", base: 1, help: "Radius in which items fly to you." },
  growth: { label: "Growth", format: "pct", base: 1, help: "Experience gained." },
  greed: { label: "Greed", format: "pct", base: 1, help: "Donations gained." },
  graze: { label: "Graze", format: "pct", base: 1, help: "How fast grazing fills the card meter." },
  spiritRegen: { label: "Spirit Regen", format: "pct", base: 1, help: "How fast Spirit refills (cards cost Spirit)." },
  spiritMax: { label: "Max Spirit", format: "flat", base: 3, help: "Spirit you can hold." },
  hand: { label: "Hand Size", format: "flat", base: 3, help: "Skill cards you can hold at once." },
  revive: { label: "Last Stand", format: "flat", base: 0, help: "Times per run a hit that would fell you leaves you at 5% HP instead." },
  reroll: { label: "Reroll", format: "flat", base: 0, help: "Times per run you can reroll a level-up offer." },
  duration: { label: "Duration", format: "pct", base: 1, help: "How long card effects last." },
  dmg: { label: "Damage", format: "flat", base: 0, help: "Added to every weapon hit, before Might: worth most to weak, fast weapons." },
  headStart: { label: "Head Start", format: "flat", base: 0, start: true, help: "Level-ups waiting for you when a run begins." },
  weaponLevel: { label: "Weapon Level", format: "flat", base: 0, start: true, help: "Your first weapon starts this many levels up." },
  fullHand: { label: "Prepared Hand", format: "flat", base: 0, start: true, help: "A run begins with your hand full of cards." },
  skip: { label: "Early Start", format: "flat", base: 0, start: true, help: "Seconds of the stage's opening skipped, with the experience you would have gathered in them." },
};

/** The stats a run has (the pause menu lists them): all but the ones used only as it begins. */
export const RUN_STAT_KEYS: readonly StatKey[] = STAT_KEYS.filter((k) => !STAT_DEFS[k].start);

export function baseStats(): Stats {
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = STAT_DEFS[k].base;
  return out;
}

/** "+10% Might", "+20 Max HP", "+0.5/s Recovery". */
export function formatBonus(key: StatKey, amount: number): string {
  const d = STAT_DEFS[key];
  const sign = amount >= 0 ? "+" : "−";
  const a = Math.abs(amount);
  switch (d.format) {
    case "pct":
      return `${sign}${Math.round(a * 100)}% ${d.label}`;
    case "rate":
      return `${sign}${round2(a)}/s ${d.label}`;
    default:
      return `${sign}${round2(a)} ${d.label}`;
  }
}

/** A final stat value for the stats panel: "112%", "3", "0.5/s". */
export function formatStat(key: StatKey, value: number): string {
  const d = STAT_DEFS[key];
  if (d.format === "pct") return `${Math.round(value * 100)}%`;
  if (d.format === "rate") return `${round2(value)}/s`;
  return String(round2(value));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
