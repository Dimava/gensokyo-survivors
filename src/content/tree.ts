// The Shrine upgrade tree (NodeBuster style): nodes bought with donations
// between runs. A node lists its position on the board, its prerequisites
// (any one bought is enough, so the tree grows outward from the centre), its
// cost per level and what each level grants. The next run reads the result.

import type { StatKey } from "./stats.ts";

export type NodeEffect =
  | { kind: "stat"; stat: StatKey; per: number }
  | { kind: "unlock"; weapon: string };

export interface TreeNode {
  id: string;
  name: string;
  /** Board position in grid units; (0, 0) is the centre. */
  x: number;
  y: number;
  /** Buying any one of these (level >= 1) opens this node. */
  requires: readonly string[];
  /** Stage clears (all stages, all runs) needed before it can be bought. */
  clears?: number;
  /** Cost of each level, in donations. Its length is the node's max level. */
  costs: readonly number[];
  effect: NodeEffect;
  flavour: string;
}

// Flat bonuses and head starts rather than multipliers: a flat bonus is worth
// most to a weak build, so the shrine narrows the gap between builds instead of
// widening it. About 5000 donations in all, some ten clears; the strongest nodes
// also need stage clears.
export const TREE: readonly TreeNode[] = [
  { id: "core", name: "Shrine Maiden's Resolve", x: 0, y: 0, requires: [], costs: [20, 40, 70], effect: { kind: "stat", stat: "maxHp", per: 10 }, flavour: "Tea, rice, and stubbornness." },

  // Offense, up.
  { id: "dmg1", name: "Sharpened Ink", x: 0, y: -1, requires: ["core"], costs: [60, 120, 200], effect: { kind: "stat", stat: "dmg", per: 1 }, flavour: "Fresh ink hits harder." },
  { id: "weaponLevel", name: "Practiced Throw", x: -1, y: -2, requires: ["dmg1"], costs: [250], effect: { kind: "stat", stat: "weaponLevel", per: 1 }, flavour: "A thousand amulets thrown at the shrine's cherry tree." },
  { id: "spark", name: "Borrowed Hakkero", x: 1, y: -2, requires: ["dmg1"], clears: 1, costs: [160], effect: { kind: "unlock", weapon: "spark" }, flavour: "Marisa will want it back. Eventually." },
  { id: "amount1", name: "Duplicate Charms", x: 0, y: -3, requires: ["weaponLevel", "spark"], clears: 3, costs: [500], effect: { kind: "stat", stat: "amount", per: 1 }, flavour: "Why fire one when you can fire two?" },

  // Defense, left.
  { id: "hp1", name: "Shrine Omamori", x: -1, y: 0, requires: ["core"], costs: [40, 80, 140], effect: { kind: "stat", stat: "maxHp", per: 15 }, flavour: "Protection, 500 yen each." },
  { id: "armor1", name: "Miko Vestments", x: -2, y: -1, requires: ["hp1"], costs: [80, 160], effect: { kind: "stat", stat: "armor", per: 1 }, flavour: "Detached sleeves, attached armor." },
  { id: "regen1", name: "Hot Spring Visit", x: -2, y: 1, requires: ["hp1"], costs: [60, 120], effect: { kind: "stat", stat: "regen", per: 0.2 }, flavour: "Everything heals at the hot spring." },
  { id: "revive", name: "Hakurei Blessing", x: -3, y: 0, requires: ["armor1", "regen1"], clears: 1, costs: [300], effect: { kind: "stat", stat: "revive", per: 1 }, flavour: "Not today." },

  // Head start, right.
  { id: "headStart", name: "Morning Prayers", x: 1, y: 0, requires: ["core"], costs: [60, 120, 200], effect: { kind: "stat", stat: "headStart", per: 1 }, flavour: "The gods answer early risers." },
  { id: "reroll", name: "Omikuji Redraw", x: 2, y: -1, requires: ["headStart"], costs: [60, 120, 200], effect: { kind: "stat", stat: "reroll", per: 1 }, flavour: "Bad fortune? Draw again." },
  { id: "speed1", name: "Flying Lessons", x: 2, y: 1, requires: ["headStart"], costs: [80, 160], effect: { kind: "stat", stat: "speed", per: 0.04 }, flavour: "Float a little faster." },
  { id: "skip", name: "Early Start", x: 3, y: 0, requires: ["reroll", "speed1"], clears: 1, costs: [300], effect: { kind: "stat", stat: "skip", per: 30 }, flavour: "The fairies are late for their own ambush." },
  { id: "greed1", name: "Festival Stalls", x: 3, y: 1, requires: ["speed1"], costs: [100, 200], effect: { kind: "stat", stat: "greed", per: 0.05 }, flavour: "Takoyaki funds the exorcisms." },

  // Cards, down.
  { id: "spirit1", name: "Meditation", x: 0, y: 1, requires: ["core"], costs: [50, 100], effect: { kind: "stat", stat: "spiritRegen", per: 0.1 }, flavour: "Spirit refills faster." },
  { id: "fullHand", name: "Prepared Sleeves", x: -1, y: 2, requires: ["spirit1"], costs: [150], effect: { kind: "stat", stat: "fullHand", per: 1 }, flavour: "Cards tucked in before the first fairy shows." },
  { id: "spiritMax", name: "Inner Reservoir", x: 1, y: 2, requires: ["spirit1"], costs: [250], effect: { kind: "stat", stat: "spiritMax", per: 1 }, flavour: "Hold more Spirit." },
  { id: "knives", name: "Maid's Cutlery", x: 0, y: 3, requires: ["fullHand", "spiritMax"], clears: 2, costs: [160], effect: { kind: "unlock", weapon: "knives" }, flavour: "Sakuya counts them. Every one." },
  { id: "hand1", name: "Deep Sleeves", x: 0, y: 4, requires: ["knives"], clears: 2, costs: [300], effect: { kind: "stat", stat: "hand", per: 1 }, flavour: "Room for one more card." },
];

/** Costs of the first tree's nodes (profile save v1), refunded when it was rebuilt (meta.ts). */
export const OLD_TREE_COSTS: Readonly<Record<string, readonly number[]>> = {
  core: [20, 45, 90],
  might1: [30, 60, 110, 180],
  cooldown1: [50, 100, 170],
  area1: [50, 100, 170],
  spark: [160],
  amount1: [400],
  might2: [180, 300, 450],
  hp1: [30, 60, 110, 180],
  armor1: [60, 120, 200],
  regen1: [50, 100, 170],
  revive: [350],
  hp2: [200, 320, 480],
  magnet1: [25, 50, 90],
  greed1: [40, 80, 140, 220],
  growth1: [40, 80, 140],
  speed1: [60, 120, 200],
  reroll: [120, 220, 350],
  spirit1: [30, 60, 110],
  graze1: [40, 80, 140],
  hand1: [120, 260],
  knives: [160],
  spiritMax: [150, 300],
  duration1: [100, 200, 320],
};

export const NODE_BY_ID: Readonly<Record<string, TreeNode>> = Object.fromEntries(TREE.map((n) => [n.id, n]));

export function treeNode(id: string): TreeNode {
  const n = NODE_BY_ID[id];
  if (!n) throw new Error(`unknown tree node "${id}"; nodes: ${TREE.map((x) => x.id).join(", ")}`);
  return n;
}
