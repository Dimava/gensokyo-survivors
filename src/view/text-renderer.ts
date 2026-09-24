// The test renderer: a second renderer beside the Pixi one (renderer.ts),
// reading the same kernel state and producing text a test can read and
// snapshot. The playfield becomes ASCII art on a grid around the player, the
// shrine tree a small picture of its board, and everything else trimmed JSON
// (only the fields that matter, rounded, in a fixed order). It imports no
// DOM, Pixi or Vue, so it runs under bun.

import { ENEMIES } from "../content/enemies.ts";
import { bossDef, bossName } from "../content/bosses.ts";
import { cardDef, cardText } from "../content/cards.ts";
import { CHARACTERS, type CharacterId } from "../content/names.ts";
import { destination } from "../content/expeditions.ts";
import { passiveDef } from "../content/passives.ts";
import { formatBonus } from "../content/stats.ts";
import { stageDef } from "../content/stages.ts";
import { TREE } from "../content/tree.ts";
import { weaponDef, weaponLevelDelta } from "../content/weapons.ts";
import { bossPos } from "../sim/boss.ts";
import { handCards, spiritAt } from "../sim/cards.ts";
import { activeRun, runView, type Game, type RunPath } from "../sim/game.ts";
import { LevelUp } from "../sim/levelup.ts";
import { nodeState } from "../sim/meta.ts";
import { COIN_OFFER, HEAL_FRACTION } from "../sim/offers.ts";
import { Pack } from "../sim/pack.ts";
import { Vn } from "../sim/vn.ts";
import { BOSS, XP } from "../sim/tuning.ts";

// ---------- helpers ----------

function r(v: number, places = 0): number {
  const m = 10 ** places;
  return Math.round(v * m) / m;
}

/** One line of JSON per entry: small, diffable, stable (callers build objects in a fixed key order). */
export function trimmed(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map((x) => JSON.stringify(x)).join("\n") : "[]";
  return JSON.stringify(value);
}

function mmss(ticks: number): string {
  const s = Math.floor(ticks / 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- meta ----------

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
    `meta: coins ${w.coins} (lifetime ${w.lifetime}) | runs ${p.runs} clears ${p.clears} [${p.cleared.join(", ")}] best ${p.bestSeconds}s/${p.bestKills} kills | active ${p.activeRun || "-"}`,
    `tree: ${tree || "(none)"}`,
    `cards: ${deck} | pity ${v.derived("gacha").gacha.sinceHigh}`,
    last
      ? `last run: ${last.summary.stage} ${last.summary.outcome} at ${last.summary.seconds}s, lv ${last.summary.level}, ${last.summary.kills} kills, +${last.summary.coins.total} coins${last.records.length ? ` (new: ${last.records.join(", ")})` : ""}`
      : "last run: -",
  ].join("\n");
}

/** The shrine tree as a picture of its board: `[name lvl/max]`, `#` maxed, `$` affordable, `-` locked. */
export function renderTree(k: Game): string {
  const v = k.view();
  const levels = v.derived("tree").tree.levels;
  const xs = TREE.map((n) => n.x);
  const ys = TREE.map((n) => n.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const W = Math.max(...xs) - minX + 1;
  const H = Math.max(...ys) - minY + 1;
  const cell = 14;
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let line = "";
    for (let x = 0; x < W; x++) {
      const n = TREE.find((t) => t.x - minX === x && t.y - minY === y);
      if (!n) {
        line += " ".repeat(cell);
        continue;
      }
      const st = nodeState(v, n.id);
      const mark = st === "maxed" ? "#" : st === "buyable" ? "$" : st === "locked" ? "-" : " ";
      line += `${mark}${n.id.slice(0, 8)} ${levels[n.id] ?? 0}/${n.costs.length}`.padEnd(cell);
    }
    rows.push(line.trimEnd());
  }
  return `tree (# maxed, $ affordable, - locked):\n${rows.join("\n")}`;
}

/** The pack on screen, if one is open. */
export function renderPack(k: Game): string {
  if (!k.paths().includes("/pack")) return "pack: (none open)";
  const o = k.read("/pack", Pack)!;
  return `pack ${o.pack}:\n${trimmed(o.pulls.map((p) => ({ card: p.card, rarity: p.rarity, outcome: p.outcome, level: p.level, refund: p.refund, pity: p.pity })))}`;
}

/** Expeditions: who can go, who is away and how long is left (on the idle clock). */
export function renderExpeditions(k: Game): string {
  const v = k.view();
  const now = v.now("idle");
  const trips = v.derived("trips").map((t) => ({
    who: t.expedition.who,
    dest: t.expedition.dest,
    back: t.expedition.back,
    left: Math.max(0, t.expedition.endsAt - now),
    reward: destination(t.expedition.dest).coins,
  }));
  const companions = v.derived("companions").map((id) => `${CHARACTERS[id as CharacterId].short}${trips.some((t) => t.who === id) ? " (away)" : ""}`);
  return `expeditions at idle ${now}s: companions ${companions.join(", ")}\n${trimmed(trips)}`;
}

// ---------- the run ----------

/** A compact text render of a run: time, health, build, stores, cards, boss. */
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
    `${run.stage} ${run.phase}${run.outcome !== "none" ? `(${run.outcome})` : ""} t=${mmss(t)} fixed=${v.now("fixed")} | hp ${r(p.life.hp)}/${stats.maxHp} lv ${p.progress.level} xp ${r(p.progress.xp)}/${XP.next(p.progress.level)} kills ${p.progress.kills} | pos ${r(p.body.x)},${r(p.body.y)}`,
    `weapons: ${weapons || "-"} | passives: ${passives || "-"}`,
    `enemies ${e.count} [${[...kinds].map(([k2, n]) => `${k2} ${n}`).join(", ")}] | drops ${v.packed("drops").count} | shots ${v.packed("shots").count} | bullets ${v.packed("bullets").count}`,
    `cards: spirit ${spiritAt(v, t).toFixed(2)}/${stats.spiritMax} meter ${Math.floor(p.meter.graze)} grazes ${p.progress.grazes} | hand: ${hand || "-"}`,
  ];
  const boss = v.derived("boss");
  if (boss) {
    const def = bossDef(boss.boss.id);
    lines.push(
      `boss ${def.id}: spell ${boss.boss.spell + 1}/${def.spells.length} "${def.spells[boss.boss.spell]!.name}" hp ${r(boss.boss.hp)}/${boss.boss.max} results [${boss.boss.results.join(", ")}]${boss.boss.late ? " (bonus failed)" : ""}`,
    );
  }
  if (run.overlay !== "none") lines.push(`overlay: ${run.overlay}`);
  return lines.join("\n");
}

export interface FieldOptions {
  /** Characters across and down, and world pixels per character (a character is about twice as tall as wide). */
  cols?: number;
  rows?: number;
  cellW?: number;
  cellH?: number;
}

const pos = { x: 0, y: 0 };

/**
 * The playfield as ASCII art, centred on the player (what the Pixi renderer
 * would show at 1280x760). Each character is one cell; when several things
 * share a cell the most important wins: @ player, B boss, enemies by their
 * glyph (content), * bullet, - shot, . gem, $ coin, + heart, # arena edge.
 */
export function renderField(k: Game, path: RunPath, opts: FieldOptions = {}): string {
  const cols = opts.cols ?? 43;
  const rows = opts.rows ?? 13;
  const cellW = opts.cellW ?? 30;
  const cellH = opts.cellH ?? 60;
  const v = runView(k, path);
  const run = v.derived("state").run;
  const { body } = v.derived("player");
  const t = v.now("action");
  const grid: string[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "));
  const rank: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const put = (x: number, y: number, ch: string, pri: number): void => {
    const cx = Math.floor((x - body.x) / cellW + cols / 2);
    const cy = Math.floor((y - body.y) / cellH + rows / 2);
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
    if (pri < rank[cy]![cx]!) return;
    rank[cy]![cx] = pri;
    grid[cy]![cx] = ch;
  };
  if (run.arena) {
    for (let i = 0; i < 180; i++) {
      const a = (i / 180) * Math.PI * 2;
      put(run.ax + Math.cos(a) * BOSS.arena, run.ay + Math.sin(a) * BOSS.arena, "#", 1);
    }
  }
  const d = v.packed("drops");
  for (let i = 0; i < d.count; i++) {
    const kind = d.col("kind")[i]!;
    put(d.col("x")[i]!, d.col("y")[i]!, kind === 1 ? "$" : kind === 2 ? "+" : ".", 2);
  }
  const s = v.packed("shots");
  for (let i = 0; i < s.count; i++) {
    const dt = t - s.col("t0")[i]!;
    put(s.col("x0")[i]! + s.col("vx")[i]! * dt, s.col("y0")[i]! + s.col("vy")[i]! * dt, "-", 3);
  }
  const b = v.packed("bullets");
  const td = v.now("danmaku");
  for (let i = 0; i < b.count; i++) if (b.pos(i, td, pos)) put(pos.x, pos.y, "*", 4);
  const e = v.packed("enemies");
  for (let i = 0; i < e.count; i++) {
    const def = ENEMIES[e.col("kind")[i]!]!;
    put(e.col("x")[i]!, e.col("y")[i]!, def.glyph, 5 + def.radius / 100);
  }
  const boss = v.derived("boss");
  if (boss) {
    bossPos(boss, t, pos);
    put(pos.x, pos.y, "B", 8);
  }
  put(body.x, body.y, "@", 9);
  const edge = `+${"-".repeat(cols)}+`;
  return [edge, ...grid.map((row) => `|${row.join("")}|`), edge].join("\n");
}

/** The level-up offer as the player sees it: what each choice does. */
export function renderLevelUp(k: Game, path: RunPath): string {
  const lp = `${path}/levelup`;
  if (!k.paths().includes(lp)) return "level-up: (closed)";
  const o = k.read(lp, LevelUp)!;
  const rows = o.choices.map((c, i) => {
    if (c.kind === "weapon") {
      const def = weaponDef(c.id);
      return { key: i + 1, kind: "weapon", name: def.name, level: c.level, does: weaponLevelDelta(def, c.level - 1) };
    }
    if (c.kind === "passive") {
      const def = passiveDef(c.id);
      return { key: i + 1, kind: "item", name: def.name, level: c.level, does: [formatBonus(def.stat, def.per)] };
    }
    if (c.kind === "heal") return { key: i + 1, kind: "heal", name: "Onigiri", level: 0, does: [`restore ${HEAL_FRACTION * 100}% HP`] };
    return { key: i + 1, kind: "coins", name: "Offering", level: 0, does: [`+${COIN_OFFER} donations`] };
  });
  return `level-up to ${o.level} (rerolls ${o.rerolls}):\n${trimmed(rows)}`;
}

/** The dialogue line on screen. */
export function renderDialogue(k: Game, path: RunPath): string {
  const vp = `${path}/vn`;
  if (!k.paths().includes(vp)) return "dialogue: (closed)";
  const s = k.read(vp, Vn)!;
  return `dialogue ${s.index + 1}/${s.total} ${CHARACTERS[s.line.speaker].short} (${s.line.side}): ${s.line.text}`;
}

/** The hand of skill cards and what each does. */
export function renderHand(k: Game, path: RunPath): string {
  const v = runView(k, path);
  const t = v.now("action");
  const spirit = spiritAt(v, t);
  const rows = handCards(v).map((c, i) => {
    const card = v.req(c.id, "card").card;
    const def = cardDef(card.id);
    return { key: i + 1, name: def.name, cost: def.cost, playable: spirit + 1e-9 >= def.cost, does: cardText(def, card.level) };
  });
  return `hand (spirit ${r(spirit, 2)}):\n${trimmed(rows)}`;
}

/** The boss bar as the HUD shows it. */
export function renderBoss(k: Game, path: RunPath): string {
  const v = runView(k, path);
  const boss = v.derived("boss");
  if (!boss) return "boss: (none)";
  const def = bossDef(boss.boss.id);
  const t = v.now("action");
  const bar = Math.round((boss.boss.hp / Math.max(1, boss.boss.max)) * 20);
  return trimmed({
    boss: bossName(def),
    spell: `${boss.boss.spell + 1}/${def.spells.length} ${def.spells[boss.boss.spell]!.name}`,
    hp: `[${"=".repeat(bar)}${" ".repeat(20 - bar)}] ${r(boss.boss.hp)}/${boss.boss.max}`,
    bonusTime: boss.boss.late ? "failed" : r(Math.max(0, boss.boss.spellEnd - t) / 60, 1),
    results: boss.boss.results,
  });
}

/** Everything at once: meta, and if a run is open its stats, field and overlays. */
export function renderFrame(k: Game, opts: FieldOptions & { field?: boolean } = {}): string {
  const path = activeRun(k);
  const out = [renderMeta(k)];
  if (path) {
    out.push(renderRun(k, path));
    const run = runView(k, path).derived("state").run;
    if (opts.field) out.push(renderField(k, path, opts));
    if (run.overlay === "levelup") out.push(renderLevelUp(k, path));
    if (run.overlay === "vn") out.push(renderDialogue(k, path));
    out.push(`stage: ${stageDef(run.stage).name}`);
  }
  if (k.paths().includes("/pack")) out.push(renderPack(k));
  return out.join("\n");
}
