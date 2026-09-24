// Weapons: auto-firing, levelled by level-up picks. A weapon row names a
// behaviour (code in src/sim/weapons.ts) and lists its stats per level, so
// the level-up card can print exactly what the next level changes.

export type WeaponBehaviour = "fan" | "orbit" | "aura" | "beam";

/** Every stat any behaviour reads; each level row gives the full set its behaviour needs. */
export interface WeaponStats {
  /** Ticks between volleys (scaled by the cooldown stat). */
  cooldown: number;
  dmg: number;
  /** Projectiles (fan), orbs (orbit). */
  count?: number;
  /** Projectile speed, pixels per tick. */
  speed?: number;
  /** Enemies a projectile passes through before vanishing. */
  pierce?: number;
  /** Projectile lifetime in ticks. */
  life?: number;
  /** Fan width in radians. */
  spread?: number;
  /** Radius: projectile size, aura radius, orbit distance. */
  radius?: number;
  /** Orb size (orbit). */
  size?: number;
  /** Radians per tick (orbit). */
  spin?: number;
  /** Beam length and width. */
  length?: number;
  width?: number;
  /** Knockback in pixels. */
  knock?: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  /** Who in Gensokyo it comes from, for flavour. */
  from: string;
  desc: string;
  behaviour: WeaponBehaviour;
  /** fan: aim at the nearest enemy, along the facing direction, or in a full ring. */
  aim?: "nearest" | "facing" | "ring";
  color: number;
  /** Share of this weapon's level-ups that counts against bosses (default BOSS.upgradeShare). */
  bossMulti?: number;
  /** Locked weapons join the level-up pool once a tree node unlocks them. */
  locked?: boolean;
  levels: readonly WeaponStats[];
}

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: "amulet",
    name: "Homing Amulets",
    from: "Reimu",
    desc: "Paper amulets fly at the nearest enemy.",
    behaviour: "fan",
    aim: "nearest",
    color: 0xff5470,
    levels: [
      { cooldown: 42, dmg: 9, count: 1, speed: 7, pierce: 1, life: 70, spread: 0.12, radius: 8, knock: 6 },
      { cooldown: 42, dmg: 9, count: 2, speed: 7, pierce: 1, life: 70, spread: 0.18, radius: 8, knock: 6 },
      { cooldown: 38, dmg: 12, count: 2, speed: 7.5, pierce: 1, life: 70, spread: 0.18, radius: 8, knock: 6 },
      { cooldown: 38, dmg: 12, count: 3, speed: 7.5, pierce: 2, life: 70, spread: 0.24, radius: 9, knock: 7 },
      { cooldown: 34, dmg: 15, count: 3, speed: 8, pierce: 2, life: 75, spread: 0.24, radius: 9, knock: 7 },
      { cooldown: 34, dmg: 15, count: 4, speed: 8, pierce: 2, life: 75, spread: 0.3, radius: 9, knock: 8 },
      { cooldown: 30, dmg: 19, count: 4, speed: 8.5, pierce: 3, life: 80, spread: 0.3, radius: 10, knock: 8 },
      { cooldown: 26, dmg: 24, count: 5, speed: 9, pierce: 3, life: 80, spread: 0.36, radius: 10, knock: 9 },
    ],
  },
  {
    id: "needle",
    name: "Persuasion Needles",
    from: "Reimu",
    desc: "Fast needles along your facing direction; they pierce.",
    behaviour: "fan",
    aim: "facing",
    color: 0xffb3c1,
    levels: [
      { cooldown: 30, dmg: 6, count: 2, speed: 11, pierce: 3, life: 45, spread: 0.1, radius: 6, knock: 2 },
      { cooldown: 30, dmg: 8, count: 2, speed: 11, pierce: 3, life: 45, spread: 0.1, radius: 6, knock: 2 },
      { cooldown: 26, dmg: 8, count: 3, speed: 12, pierce: 4, life: 45, spread: 0.14, radius: 6, knock: 2 },
      { cooldown: 26, dmg: 10, count: 3, speed: 12, pierce: 5, life: 50, spread: 0.14, radius: 7, knock: 3 },
      { cooldown: 22, dmg: 10, count: 4, speed: 12, pierce: 5, life: 50, spread: 0.18, radius: 7, knock: 3 },
      { cooldown: 22, dmg: 13, count: 4, speed: 13, pierce: 6, life: 55, spread: 0.18, radius: 7, knock: 3 },
      { cooldown: 18, dmg: 13, count: 5, speed: 13, pierce: 7, life: 55, spread: 0.22, radius: 8, knock: 3 },
      { cooldown: 16, dmg: 16, count: 6, speed: 14, pierce: 8, life: 60, spread: 0.26, radius: 8, knock: 4 },
    ],
  },
  {
    id: "orbs",
    name: "Yin-Yang Orbs",
    from: "Reimu",
    desc: "Orbs circle you and strike whatever they touch.",
    behaviour: "orbit",
    color: 0xffffff,
    levels: [
      { cooldown: 24, dmg: 8, count: 1, radius: 70, size: 13, spin: 0.06, knock: 5 },
      { cooldown: 24, dmg: 8, count: 2, radius: 70, size: 13, spin: 0.06, knock: 5 },
      { cooldown: 22, dmg: 11, count: 2, radius: 76, size: 14, spin: 0.065, knock: 6 },
      { cooldown: 22, dmg: 11, count: 3, radius: 80, size: 15, spin: 0.07, knock: 6 },
      { cooldown: 20, dmg: 14, count: 3, radius: 86, size: 16, spin: 0.075, knock: 7 },
      { cooldown: 20, dmg: 14, count: 4, radius: 90, size: 17, spin: 0.08, knock: 7 },
      { cooldown: 18, dmg: 18, count: 4, radius: 96, size: 18, spin: 0.085, knock: 8 },
      { cooldown: 16, dmg: 22, count: 5, radius: 104, size: 20, spin: 0.09, knock: 9 },
    ],
  },
  {
    id: "border",
    name: "Hakurei Border",
    from: "Reimu",
    desc: "A sacred border pulses around you, hurting everything inside.",
    behaviour: "aura",
    color: 0xffe08a,
    levels: [
      { cooldown: 60, dmg: 7, radius: 70, knock: 10 },
      { cooldown: 56, dmg: 9, radius: 78, knock: 10 },
      { cooldown: 52, dmg: 11, radius: 86, knock: 12 },
      { cooldown: 48, dmg: 13, radius: 94, knock: 12 },
      { cooldown: 44, dmg: 16, radius: 102, knock: 14 },
      { cooldown: 40, dmg: 19, radius: 110, knock: 14 },
      { cooldown: 36, dmg: 22, radius: 120, knock: 16 },
      { cooldown: 32, dmg: 27, radius: 132, knock: 18 },
    ],
  },
  {
    id: "spark",
    name: "Mini-Hakkero",
    from: "Marisa",
    desc: "A borrowed furnace fires a piercing beam along your facing direction.",
    behaviour: "beam",
    color: 0xfff27a,
    locked: true,
    levels: [
      { cooldown: 150, dmg: 30, length: 420, width: 26, knock: 14 },
      { cooldown: 140, dmg: 38, length: 460, width: 30, knock: 14 },
      { cooldown: 130, dmg: 46, length: 500, width: 34, knock: 16 },
      { cooldown: 120, dmg: 56, length: 540, width: 38, knock: 16 },
      { cooldown: 110, dmg: 68, length: 580, width: 44, knock: 18 },
      { cooldown: 100, dmg: 82, length: 620, width: 50, knock: 18 },
      { cooldown: 90, dmg: 98, length: 680, width: 56, knock: 20 },
      { cooldown: 80, dmg: 120, length: 760, width: 64, knock: 22 },
    ],
  },
  {
    id: "knives",
    name: "Silver Knives",
    from: "Sakuya",
    desc: "A ring of knives thrown in every direction.",
    behaviour: "fan",
    aim: "ring",
    color: 0xc0c8e0,
    locked: true,
    levels: [
      { cooldown: 70, dmg: 10, count: 6, speed: 8, pierce: 2, life: 50, radius: 7, knock: 4 },
      { cooldown: 66, dmg: 12, count: 7, speed: 8, pierce: 2, life: 55, radius: 7, knock: 4 },
      { cooldown: 62, dmg: 12, count: 9, speed: 8.5, pierce: 2, life: 55, radius: 7, knock: 5 },
      { cooldown: 58, dmg: 15, count: 10, speed: 8.5, pierce: 3, life: 60, radius: 8, knock: 5 },
      { cooldown: 54, dmg: 15, count: 12, speed: 9, pierce: 3, life: 60, radius: 8, knock: 5 },
      { cooldown: 50, dmg: 19, count: 13, speed: 9, pierce: 3, life: 65, radius: 8, knock: 6 },
      { cooldown: 46, dmg: 19, count: 15, speed: 9.5, pierce: 4, life: 65, radius: 9, knock: 6 },
      { cooldown: 40, dmg: 24, count: 18, speed: 10, pierce: 4, life: 70, radius: 9, knock: 7 },
    ],
  },
];

export const WEAPON_BY_ID: Readonly<Record<string, WeaponDef>> = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
export const WEAPON_INDEX: Readonly<Record<string, number>> = Object.fromEntries(WEAPONS.map((w, i) => [w.id, i]));

export function weaponDef(id: string): WeaponDef {
  const w = WEAPON_BY_ID[id];
  if (!w) throw new Error(`unknown weapon "${id}"; weapons: ${WEAPONS.map((x) => x.id).join(", ")}`);
  return w;
}

const STAT_LABEL: Record<keyof WeaponStats, [string, "more" | "less"]> = {
  cooldown: ["cooldown", "less"],
  dmg: ["damage", "more"],
  count: ["projectiles", "more"],
  speed: ["speed", "more"],
  pierce: ["pierce", "more"],
  life: ["range", "more"],
  spread: ["spread", "more"],
  radius: ["area", "more"],
  size: ["orb size", "more"],
  spin: ["orbit speed", "more"],
  length: ["beam length", "more"],
  width: ["beam width", "more"],
  knock: ["knockback", "more"],
};

/** What going from `level` to `level + 1` changes, as short phrases ("+1 projectiles", "damage 9 -> 12"). */
export function weaponLevelDelta(def: WeaponDef, level: number): string[] {
  const next = def.levels[level];
  if (!next) return [];
  if (level === 0) return [def.desc];
  const cur = def.levels[level - 1]!;
  const out: string[] = [];
  for (const key of Object.keys(STAT_LABEL) as (keyof WeaponStats)[]) {
    const a = cur[key];
    const b = next[key];
    if (a === undefined || b === undefined || a === b) continue;
    if (key === "spread" || key === "spin" || key === "knock" || key === "life" || key === "size") continue;
    const [label] = STAT_LABEL[key];
    if (key === "count" || key === "pierce") out.push(`+${b - a} ${label}`);
    else if (key === "cooldown") out.push(`fires ${Math.round((1 - b / a) * 100)}% faster`);
    else out.push(`${label} ${a} → ${b}`);
  }
  return out.length ? out : ["stronger"];
}
