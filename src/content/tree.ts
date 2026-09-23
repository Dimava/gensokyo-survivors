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
  /** Cost of each level, in donations. Its length is the node's max level. */
  costs: readonly number[];
  effect: NodeEffect;
  flavour: string;
}

export const TREE: readonly TreeNode[] = [
  { id: "core", name: "Shrine Maiden's Resolve", x: 0, y: 0, requires: [], costs: [20, 45, 90], effect: { kind: "stat", stat: "maxHp", per: 15 }, flavour: "Tea, rice, and stubbornness." },

  // Offense, up.
  { id: "might1", name: "Sharpened Amulets", x: 0, y: -1, requires: ["core"], costs: [30, 60, 110, 180], effect: { kind: "stat", stat: "might", per: 0.08 }, flavour: "Fresh ink hits harder." },
  { id: "cooldown1", name: "Quick Hands", x: -1, y: -2, requires: ["might1"], costs: [50, 100, 170], effect: { kind: "stat", stat: "cooldown", per: -0.05 }, flavour: "Less ceremony, more exorcism." },
  { id: "area1", name: "Wider Borders", x: 1, y: -2, requires: ["might1"], costs: [50, 100, 170], effect: { kind: "stat", stat: "area", per: 0.08 }, flavour: "The shrine grounds get bigger." },
  { id: "spark", name: "Borrowed Hakkero", x: 0, y: -3, requires: ["cooldown1", "area1"], costs: [160], effect: { kind: "unlock", weapon: "spark" }, flavour: "Marisa will want it back. Eventually." },
  { id: "amount1", name: "Duplicate Charms", x: 0, y: -4, requires: ["spark"], costs: [400], effect: { kind: "stat", stat: "amount", per: 1 }, flavour: "Why fire one when you can fire two?" },
  { id: "might2", name: "Yin-Yang Mastery", x: -1, y: -4, requires: ["spark"], costs: [180, 300, 450], effect: { kind: "stat", stat: "might", per: 0.1 }, flavour: "Balance, applied forcefully." },

  // Defense, left.
  { id: "hp1", name: "Shrine Omamori", x: -1, y: 0, requires: ["core"], costs: [30, 60, 110, 180], effect: { kind: "stat", stat: "maxHp", per: 15 }, flavour: "Protection, 500 yen each." },
  { id: "armor1", name: "Miko Vestments", x: -2, y: -1, requires: ["hp1"], costs: [60, 120, 200], effect: { kind: "stat", stat: "armor", per: 1 }, flavour: "Detached sleeves, attached armor." },
  { id: "regen1", name: "Hot Spring Visit", x: -2, y: 1, requires: ["hp1"], costs: [50, 100, 170], effect: { kind: "stat", stat: "regen", per: 0.3 }, flavour: "Everything heals at the hot spring." },
  { id: "revive", name: "Hakurei Blessing", x: -3, y: 0, requires: ["armor1", "regen1"], costs: [350], effect: { kind: "stat", stat: "revive", per: 1 }, flavour: "Get back up. Once." },
  { id: "hp2", name: "Stubborn Spirit", x: -4, y: 0, requires: ["revive"], costs: [200, 320, 480], effect: { kind: "stat", stat: "maxHp", per: 25 }, flavour: "Not today." },

  // Utility, right.
  { id: "magnet1", name: "Donation Box Pull", x: 1, y: 0, requires: ["core"], costs: [25, 50, 90], effect: { kind: "stat", stat: "magnet", per: 0.25 }, flavour: "Money finds its way to the shrine." },
  { id: "greed1", name: "Festival Stalls", x: 2, y: -1, requires: ["magnet1"], costs: [40, 80, 140, 220], effect: { kind: "stat", stat: "greed", per: 0.12 }, flavour: "Takoyaki funds the exorcisms." },
  { id: "growth1", name: "Diligent Training", x: 2, y: 1, requires: ["magnet1"], costs: [40, 80, 140], effect: { kind: "stat", stat: "growth", per: 0.08 }, flavour: "Reimu, training? Unheard of." },
  { id: "speed1", name: "Flying Lessons", x: 3, y: 0, requires: ["greed1", "growth1"], costs: [60, 120, 200], effect: { kind: "stat", stat: "speed", per: 0.06 }, flavour: "Float a little faster." },
  { id: "reroll", name: "Omikuji Redraw", x: 4, y: 0, requires: ["speed1"], costs: [120, 220, 350], effect: { kind: "stat", stat: "reroll", per: 1 }, flavour: "Bad fortune? Draw again." },

  // Cards, down.
  { id: "spirit1", name: "Meditation", x: 0, y: 1, requires: ["core"], costs: [30, 60, 110], effect: { kind: "stat", stat: "spiritRegen", per: 0.15 }, flavour: "Spirit refills faster." },
  { id: "graze1", name: "Graze Practice", x: -1, y: 2, requires: ["spirit1"], costs: [40, 80, 140], effect: { kind: "stat", stat: "graze", per: 0.12 }, flavour: "Close is good. Closer is better." },
  { id: "hand1", name: "Deep Sleeves", x: 1, y: 2, requires: ["spirit1"], costs: [120, 260], effect: { kind: "stat", stat: "hand", per: 1 }, flavour: "Room for one more card." },
  { id: "knives", name: "Maid's Cutlery", x: 0, y: 3, requires: ["graze1", "hand1"], costs: [160], effect: { kind: "unlock", weapon: "knives" }, flavour: "Sakuya counts them. Every one." },
  { id: "spiritMax", name: "Inner Reservoir", x: -1, y: 4, requires: ["knives"], costs: [150, 300], effect: { kind: "stat", stat: "spiritMax", per: 1 }, flavour: "Hold more Spirit." },
  { id: "duration1", name: "Lasting Charms", x: 1, y: 4, requires: ["knives"], costs: [100, 200, 320], effect: { kind: "stat", stat: "duration", per: 0.15 }, flavour: "Card effects last longer." },
];

export const NODE_BY_ID: Readonly<Record<string, TreeNode>> = Object.fromEntries(TREE.map((n) => [n.id, n]));

export function treeNode(id: string): TreeNode {
  const n = NODE_BY_ID[id];
  if (!n) throw new Error(`unknown tree node "${id}"; nodes: ${TREE.map((x) => x.id).join(", ")}`);
  return n;
}
