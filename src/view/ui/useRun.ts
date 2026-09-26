// The HUD's per-frame read of the current run, as one plain object.

import { computed } from "vue";
import { host, state } from "../host.ts";
import { runView } from "../../sim/game.ts";
import { handSize, handSlots, spiritAt } from "../../sim/cards.ts";
import { CARDS_TUNING, XP } from "../../sim/tuning.ts";
import { CARDS, CARD_KINDS, cardDef, cardText, type CardEffect } from "../../content/cards.ts";
import { weaponDef } from "../../content/weapons.ts";
import { passiveDef } from "../../content/passives.ts";
import { bossDef, bossName } from "../../content/bosses.ts";
import { stageDef } from "../../content/stages.ts";
import { runCoins } from "../../sim/rules.ts";
import type { CharacterId } from "../../content/names.ts";

/** A lingering card effect wears its card's kind colour, as the card does in the hand. */
const kindCss = (effect: CardEffect): string => {
  const card = CARDS.find((c) => c.effect === effect);
  return card ? CARD_KINDS[card.kind].css : "#f6f0e1";
};

export const hud = computed(() => {
  void state.frame;
  const path = host.path();
  if (!path) return null;
  const v = runView(host.k, path);
  const runE = v.q("run")[0];
  if (!runE) return null;
  const run = runE.run;
  const p = v.derived("player");
  const stats = v.derived("stats");
  const t = v.now("action");
  const spirit = spiritAt(v, t);
  const piles = v.derived("piles");
  // Fixed hand slots: null is an empty slot, and a card keeps its slot until played.
  const slots = handSlots(v).map((c, slot) => {
    if (!c) return null;
    const card = v.req(c.id, "card").card;
    const def = cardDef(card.id);
    return {
      entity: c.id,
      slot,
      id: def.id,
      name: def.name,
      rarity: def.rarity,
      cost: def.cost,
      level: card.level,
      owner: def.owner,
      text: cardText(def, card.level),
      affordable: spirit + 1e-9 >= def.cost,
    };
  });
  const hand = slots.filter((c) => c !== null);
  const boss = v.derived("boss");
  let bossInfo = null as null | {
    name: string;
    /** The boss's character, for the declaration's colour and cut-in portrait. */
    who: CharacterId;
    spell: string;
    /** Donations for breaking this spell card in time. */
    bonus: number;
    index: number;
    total: number;
    frac: number;
    hp: number;
    timeLeft: number;
    results: readonly string[];
    intro: boolean;
    late: boolean;
  };
  if (boss) {
    const def = bossDef(boss.boss.id);
    bossInfo = {
      name: bossName(def),
      who: def.character,
      spell: def.spells[boss.boss.spell]!.name,
      bonus: def.spells[boss.boss.spell]!.bonus,
      index: boss.boss.spell,
      total: def.spells.length,
      frac: boss.boss.max ? boss.boss.hp / boss.boss.max : 0,
      hp: Math.ceil(boss.boss.hp),
      timeLeft: Math.max(0, (boss.boss.spellEnd - t) / 60),
      results: boss.boss.results,
      intro: t < boss.boss.invulnUntil,
      late: boss.boss.late,
    };
  }
  const statuses: { id: string; label: string; left: number | null; color: string; help: string }[] = [];
  if (v.has(p, "empowered") && p.empowered.until > t)
    statuses.push({ id: "empowered", label: `Power +${p.empowered.pct}%`, left: (p.empowered.until - t) / 60, color: "#ff8c42", help: "Power Charm: your weapons deal more damage." });
  const runEnt = v.derived("state");
  if (v.has(runEnt, "timestop")) statuses.push({ id: "timestop", label: "Time stopped", left: (runEnt.timestop.until - t) / 60, color: kindCss("timeStop"), help: "Enemy bullets are frozen in time." });
  if (v.has(p, "triggers")) {
    for (const row of p.triggers) {
      const pid = v.has(runEnt, "timed") ? runEnt.timed.pids[row.rule] : undefined;
      const label = row.rule === "grazeHeal" ? "Graze Ribbon" : row.rule === "vengeance" ? "Vengeful Amulet" : "Border of Life";
      const help =
        row.rule === "grazeHeal" ? "Grazing bullets restores HP." : row.rule === "vengeance" ? "Getting hit blasts nearby enemies." : "The next fatal hit leaves you standing.";
      statuses.push({ id: row.rule, label, left: pid ? null : null, color: kindCss(row.rule as CardEffect), help });
    }
  }
  if (t < p.life.invulnUntil && run.phase !== "over") statuses.push({ id: "invuln", label: "Untouchable", left: (p.life.invulnUntil - t) / 60, color: "#ffffff", help: "Nothing can hurt you for a moment." });
  return {
    path,
    phase: run.phase,
    outcome: run.outcome,
    overlay: run.overlay,
    stage: stageDef(run.stage).name,
    hp: p.life.hp,
    maxHp: stats.maxHp,
    level: p.progress.level,
    xp: p.progress.xp,
    next: XP.next(p.progress.level),
    seconds: t / 60,
    kills: p.progress.kills,
    coins: runCoins(p.progress, t).sum,
    grazes: p.progress.grazes,
    weapons: v.derived("weapons").map((w) => {
      const def = weaponDef(w.weapon.id);
      return { id: def.id, name: def.name, level: w.weapon.level, max: def.levels.length, color: def.color, desc: def.desc };
    }),
    passives: v.derived("passives").map((x) => {
      const def = passiveDef(x.passive.id);
      return { id: def.id, name: def.name, level: x.passive.level, max: def.max, color: def.color, desc: def.desc };
    }),
    hand,
    slots,
    handMax: handSize(v),
    deck: v.related("inPile", piles.deck).length,
    discard: v.related("inPile", piles.discard).length,
    spirit,
    spiritMax: stats.spiritMax,
    spiritRate: CARDS_TUNING.spiritPerTick * stats.spiritRegen * 60,
    meter: Math.min(1, p.meter.graze / CARDS_TUNING.meterPerCard),
    boss: bossInfo,
    statuses,
    revivesLeft: Math.max(0, stats.revive - p.life.revivesUsed),
    stats,
    bulletsNear: v.packed("bullets").count > 0,
  };
});

export type Hud = NonNullable<typeof hud.value>;
