// Entry point of the simulation: creating and loading the kernel, the typed
// helpers the adapters use to reach the current run, and the text render
// used by transcripts (and handy in the console).
//
// Import order matters: this module imports meta.ts first, which pulls in the
// run and its overlays in an order where every scope type is defined before a
// parent's `children` needs it (see NOTES.md, module cycles).

import { createKernel, loadKernel, type Kernel, type Save, type View } from "gamebones";
import { Meta, newProfile } from "./meta.ts";
import type { RS0 } from "./run.ts";
import { Run } from "./rules.ts";
import { ENEMIES } from "../content/enemies.ts";
import { bossDef } from "../content/bosses.ts";
import { cardDef } from "../content/cards.ts";
import { spiritAt, handCards } from "./cards.ts";
import { XP } from "./tuning.ts";

export type Game = Kernel<typeof Meta>;
export type RunPath = `/run:${string}`;

/** Portable math: logs recorded in Chrome replay under bun (D12). */
export const MATH = "portable" as const;

export function newGame(seed: string | number): Game {
  return createKernel(Meta, { seed, math: MATH, setup: (ctx) => newProfile(ctx) });
}

export function loadGame(save: Save): Game {
  return loadKernel(Meta, save, { math: MATH });
}

export function activeRun(k: Game): RunPath | null {
  const p = k.view().derived("profile").profile.activeRun;
  return p ? (p as RunPath) : null;
}

export function runView(k: Game, path: RunPath): View<RS0> {
  return k.view(path) as unknown as View<RS0>;
}

function mmss(ticks: number): string {
  const s = Math.floor(ticks / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A compact text render of the meta state. */
export function renderMeta(k: Game): string {
  const v = k.view();
  const w = v.derived("wallet").wallet;
  const p = v.derived("profile").profile;
  const tree = Object.entries(v.derived("tree").tree.levels)
    .map(([id, l]) => `${id}:${l}`)
    .join(" ");
  const deck = v
    .derived("owned")
    .map((o) => `${o.owned.card}${o.owned.level > 1 ? `+${o.owned.level}` : ""}${o.owned.inDeck ? "" : "(out)"}`)
    .join(" ");
  const last = v.q("lastRun")[0]?.lastRun;
  return [
    `meta: coins ${w.coins} (lifetime ${w.lifetime}) | runs ${p.runs} clears ${p.clears} best ${p.bestSeconds}s/${p.bestKills} kills | active ${p.activeRun || "-"}`,
    `tree: ${tree || "(none)"}`,
    `cards: ${deck} | pity ${v.derived("gacha").gacha.sinceHigh}`,
    last ? `last run: ${last.summary.outcome} at ${last.summary.seconds}s, lv ${last.summary.level}, ${last.summary.kills} kills, +${last.summary.coins.total} coins${last.records.length ? ` (new: ${last.records.join(", ")})` : ""}` : "last run: -",
  ].join("\n");
}

/** A compact text render of a run: the transcript's picture of the playfield. */
export function renderRun(k: Game, path: RunPath): string {
  const v = runView(k, path);
  const run = v.derived("state").run;
  const p = v.derived("player");
  const stats = v.derived("stats");
  const t = v.now("action");
  const e = v.packed("enemies");
  const kinds = new Map<string, number>();
  for (let i = 0; i < e.count; i++) {
    const id = ENEMIES[e.col("kind")[i]!]!.id;
    kinds.set(id, (kinds.get(id) ?? 0) + 1);
  }
  const weapons = v.derived("weapons").map((w) => `${w.weapon.id}${w.weapon.level}`).join(" ");
  const passives = v.derived("passives").map((x) => `${x.passive.id}${x.passive.level}`).join(" ");
  const hand = handCards(v)
    .map((c) => cardDef(v.req(c.id, "card").card.id).id)
    .join(", ");
  const lines = [
    `${run.stage} ${run.phase}${run.outcome !== "none" ? `(${run.outcome})` : ""} t=${mmss(t)} fixed=${v.now("fixed")} | hp ${round(p.life.hp)}/${stats.maxHp} lv ${p.progress.level} xp ${round(p.progress.xp)}/${XP.next(p.progress.level)} kills ${p.progress.kills} | pos ${round(p.body.x)},${round(p.body.y)}`,
    `weapons: ${weapons || "-"} | passives: ${passives || "-"}`,
    `enemies ${e.count} [${[...kinds].map(([k2, n]) => `${k2} ${n}`).join(", ")}] | drops ${v.packed("drops").count} | shots ${v.packed("shots").count} | bullets ${v.packed("bullets").count}`,
    `cards: spirit ${spiritAt(v, t).toFixed(2)}/${stats.spiritMax} meter ${Math.floor(p.meter.graze)} grazes ${p.progress.grazes} | hand: ${hand || "-"}`,
  ];
  const boss = v.derived("boss");
  if (boss) {
    const def = bossDef(boss.boss.id);
    lines.push(
      `boss ${def.id}: spell ${boss.boss.spell + 1}/${def.spells.length} "${def.spells[boss.boss.spell]!.name}" hp ${round(boss.boss.hp)}/${boss.boss.max} results [${boss.boss.results.join(", ")}]`,
    );
  }
  if (run.overlay !== "none") lines.push(`overlay: ${run.overlay}`);
  return lines.join("\n");
}

function round(v: number): number {
  return Math.round(v);
}

export { Meta, Run };
