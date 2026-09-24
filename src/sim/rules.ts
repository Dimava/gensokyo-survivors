// The run's rules. Bulk per-tick work is a handful of labelled apply rules on
// `tick:action` (movement, the swarm, weapons, danmaku, drops); everything a
// player or a card could care about happens as an event with its own rules.

import { STAT_DEFS } from "../content/stats.ts";
import { ENEMIES } from "../content/enemies.ts";
import { passiveDef } from "../content/passives.ts";
import { cardDef } from "../content/cards.ts";
import { bossDef } from "../content/bosses.ts";
import { stageDef } from "../content/stages.ts";
import { script } from "../content/dialogue.ts";
import { RunBase, type RS0 } from "./run.ts";
import type { Ctx } from "gamebones";
import { LevelUp } from "./levelup.ts";
import { Vn } from "./vn.ts";
import { Meta } from "./meta.ts";
import { collectDead, contactDamage, enemyFire, migrateSalvoAim, migrateToFormations, rebuildGrid, stepEnemies } from "./swarm.ts";
import { applyVolley, bossFactor, damageArea, damageLine, fireWeapons, focusAmount, migrateFocus, stepOrbits, stepShots } from "./weapons.ts";
import { eraseBullets, stepBullets } from "./danmaku.ts";
import { DROP, HEART_HEAL, addDrop, pullAll, stepDrops } from "./drops.ts";
import { cardRules } from "./cards.ts";
import { bossPos, bossVulnerable } from "./boss.ts";
import { COIN_OFFER, HEAL_FRACTION, rollOffer } from "./offers.ts";
import { BOSS, CARDS_TUNING, END_DELAY, HITSTOP, PLAYER, REWARD, XP, sec } from "./tuning.ts";
import type { RunSummary } from "./schemas.ts";

type C = Ctx<RS0>;

const bp = { x: 0, y: 0 };

function playerSpeedBound(ctx: C): number {
  // Conservative: the fastest the player could be moving (used by the broadphase checks).
  return PLAYER.speed * Math.max(1, ctx.derived("stats").speed) * 1.25;
}

function movePlayer(ctx: C): void {
  const p = ctx.derived("player");
  const { mx, my } = p.ctrl;
  if (!mx && !my) return;
  const len = Math.sqrt(mx * mx + my * my);
  const scale = Math.min(1, len / 100);
  // Focused movement is a fixed careful pace: the speed stat doesn't apply (dodging stays learnable).
  const v = PLAYER.speed * (p.ctrl.focus ? 1 : ctx.derived("stats").speed) * scale;
  let x = p.body.x + (mx / len) * v;
  let y = p.body.y + (my / len) * v;
  const run = ctx.derived("state").run;
  if (run.arena) {
    const ddx = x - run.ax;
    const ddy = y - run.ay;
    const d = Math.sqrt(ddx * ddx + ddy * ddy);
    const lim = BOSS.arena - 8;
    if (d > lim) {
      x = run.ax + (ddx / d) * lim;
      y = run.ay + (ddy / d) * lim;
    }
  }
  // Focus locks facing (strafe): the facing weapons stay on target while she sidesteps or backpedals.
  if (p.ctrl.focus) Object.assign(ctx.mut(p, "body"), { x, y });
  else Object.assign(ctx.mut(p, "body"), { x, y, fx: mx / len, fy: my / len });
}

function openLevelUp(ctx: C): void {
  const run = ctx.derived("state");
  const stats = ctx.derived("stats");
  const pr = ctx.derived("player").progress;
  const path = `${ctx.path}/levelup`;
  if (run.run.overlay !== "levelup") {
    ctx.open("levelup");
    ctx.mut(run, "run").overlay = "levelup";
    ctx.setScale("game", 0, 1);
  }
  ctx.send(path, LevelUp, "levelup:show", {
    choices: rollOffer(ctx),
    rerolls: Math.max(0, stats.reroll - pr.rerollsUsed),
    level: pr.level - pr.pending + 1,
  });
}

function closeOverlay(ctx: C): void {
  const run = ctx.derived("state");
  if (run.run.overlay === "none") return;
  ctx.close(`${ctx.path}/${run.run.overlay}`);
  ctx.mut(run, "run").overlay = "none";
  if (run.run.phase !== "over") ctx.setScale("game", 1, 1);
}

function summary(ctx: C): RunSummary {
  const run = ctx.derived("state").run;
  const pr = ctx.derived("player").progress;
  const stats = ctx.derived("stats");
  const boss = bossDef(stageDef(run.stage).boss);
  const seconds = Math.floor(ctx.now("action") / 60);
  const drops = Math.floor(pr.coinDrops);
  const survival = Math.floor(seconds / REWARD.perSeconds);
  const kills = Math.floor(pr.kills / REWARD.perKills);
  const spells = Math.floor(pr.coinSpells);
  const clear = Math.floor(pr.coinClear);
  const total = Math.round((drops + survival + kills + spells + clear) * stats.greed);
  return {
    stage: run.stage,
    outcome: run.outcome,
    seconds,
    level: pr.level,
    kills: pr.kills,
    grazes: pr.grazes,
    cardsPlayed: pr.cardsPlayed,
    spellsCaptured: pr.spellsCaptured,
    spellsTotal: boss.spells.length,
    bossDefeated: run.phase === "over" && run.outcome === "clear",
    coins: { drops, survival, kills, spells, clear, greed: Math.round(stats.greed * 100) / 100, total },
  };
}

export const Run: typeof RunBase = RunBase.rules((r) => [
  // ---------- start ----------
  r.on("run:begin", (ev, ctx) => {
    const stage = stageDef(ev.stage);
    ctx.spawn({ loadout: { bonuses: { ...ev.bonuses }, unlocked: [...ev.unlocked] } }, "loadout");
    ctx.spawn(
      {
        run: { stage: stage.id, phase: "swarm", outcome: "none", overlay: "none", arena: false, ax: 0, ay: 0, nextUid: 1, endedAt: 0 },
      },
      "run",
    );
    const maxHp = STAT_DEFS.maxHp.base + (ev.bonuses.maxHp ?? 0);
    ctx.spawn(
      {
        body: { x: 0, y: 0, fx: 1, fy: 0 },
        ctrl: { mx: 0, my: 0, focus: false, focusAt: 0, focusFrom: 0 },
        life: { hp: maxHp, invulnUntil: 0, revivesUsed: 0, hits: 0 },
        progress: {
          level: 1,
          xp: 0,
          pending: 0,
          kills: 0,
          grazes: 0,
          cardsPlayed: 0,
          spellsCaptured: 0,
          rerollsUsed: 0,
          coinDrops: 0,
          coinSpells: 0,
          coinClear: 0,
        },
        spirit: { base: 1, t0: 0 },
        meter: { graze: 0 },
      },
      "player",
    );
    ctx.spawn({ weapon: { id: "amulet", level: 1, readyAt: 30, armed: 0 } }, "weapon");
    const deck = ctx.spawn({ pile: { kind: "deck" } }, "deck");
    ctx.spawn({ pile: { kind: "hand" } }, "hand");
    ctx.spawn({ pile: { kind: "discard" } }, "discard");
    const order = ev.deck.map((_, i) => i);
    ctx.rng("deck").shuffle(order);
    order.forEach((i, at) => {
      const c = ev.deck[i]!;
      ctx.spawn({ card: { id: c.id, level: c.level, effect: cardDef(c.id).effect }, in: { of: deck, at } }, "card");
    });
    ctx.start("director");
    ctx.emit("card:draw", {});
    ctx.emit("banner", { text: stage.name, tone: "info" });
  }),

  // ---------- input ----------
  r.on("move", (ev, ctx) => {
    const p = ctx.derived("player");
    Object.assign(ctx.mut(p, "ctrl"), { mx: ev.x, my: ev.y });
  }),
  r.on("focus", (ev, ctx) => {
    const p = ctx.derived("player");
    if (p.ctrl.focus === ev.on) return;
    // Ease from wherever the last change had got to, so a toggle mid-ease does not jump.
    const t = ctx.now("action");
    Object.assign(ctx.mut(p, "ctrl"), { focus: ev.on, focusAt: t, focusFrom: focusAmount(p.ctrl, t) });
  }),

  // ---------- the tick ----------
  r.on("tick:action").as("move player").apply((_, ctx) => movePlayer(ctx)),
  r.on("tick:action").as("swarm").apply((_, ctx) => {
    stepEnemies(ctx);
    rebuildGrid(ctx);
    fireWeapons(ctx);
    const shots = stepShots(ctx);
    const orbDmg = stepOrbits(ctx);
    collectDead(ctx);
    if (shots.bossDmg + orbDmg > 0) ctx.emit("boss:hit", { dmg: shots.bossDmg + orbDmg });
    if (shots.struckX.length) ctx.emit("swarm:struck", { n: shots.struckX.length, xs: shots.struckX.map(r1), ys: shots.struckY.map(r1) });
    enemyFire(ctx);
  }),
  r.on("tick:action").as("contact").apply((_, ctx) => {
    const p = ctx.derived("player");
    const t = ctx.now("action");
    if (t < p.life.invulnUntil || ctx.derived("state").run.phase === "over") return;
    let dmg = contactDamage(ctx);
    let cause: "enemy" | "boss" = "enemy";
    const boss = ctx.derived("boss");
    if (boss && boss.boss.hp > 0) {
      bossPos(boss, t, bp);
      const rr = bossDef(boss.boss.id).radius + PLAYER.body;
      const ddx = bp.x - p.body.x;
      const ddy = bp.y - p.body.y;
      if (ddx * ddx + ddy * ddy < rr * rr && bossDef(boss.boss.id).dmg >= dmg) {
        dmg = bossDef(boss.boss.id).dmg;
        cause = "boss";
      }
    }
    if (dmg > 0) ctx.emit("player:hurt", { player: p.id, dmg, cause });
  }),
  r.on("tick:action").as("danmaku").apply((_, ctx) => {
    const p = ctx.derived("player");
    const res = stepBullets(ctx, playerSpeedBound(ctx));
    if (res.hit && ctx.derived("state").run.phase !== "over") {
      const boss = ctx.derived("boss");
      ctx.emit("player:hurt", { player: p.id, dmg: boss ? bossDef(boss.boss.id).bulletDmg : stageDef(ctx.derived("state").run.stage).bulletDmg, cause: "bullet" });
      ctx.emit("bullets:erase", { x: p.body.x, y: p.body.y, radius: PLAYER.mercyRadius, gems: false });
    }
    if (res.grazes) ctx.emit("graze", { player: p.id, n: res.grazes, x: r1(p.body.x), y: r1(p.body.y) });
  }),
  r.on("tick:action").as("drops").apply((ev, ctx) => {
    const stats = ctx.derived("stats");
    const got = stepDrops(ctx, stats.magnet, playerSpeedBound(ctx));
    if (got.n) ctx.emit("drops:collected", { xp: got.xp, coins: got.coins, hearts: got.hearts, n: got.n });
    // Recovery: every half second.
    if (stats.regen > 0 && ev.tick % 30 === 0) {
      const p = ctx.derived("player");
      if (p.life.hp < stats.maxHp && p.life.hp > 0) ctx.mut(p, "life").hp = Math.min(stats.maxHp, p.life.hp + stats.regen / 2);
    }
  }),

  // ---------- combat events ----------
  r.on("weapon:fire", (ev, ctx) => {
    applyVolley(ctx, ctx.req(ev.weapon, "weapon"), ev.dmg);
    collectDead(ctx);
  }),
  r.on("blast", (ev, ctx) => {
    damageArea(ctx, ev.x, ev.y, ev.radius, ev.dmg, 14);
    collectDead(ctx);
  }),
  r.on("beam", (ev, ctx) => {
    // A weapon's beam hits the boss at its boss share; a card's at full.
    const w = ctx.derived("weapons").find((x) => x.weapon.id === ev.source);
    const bossDmg = w ? ev.dmg * bossFactor(ctx, w.weapon.id, w.weapon.level) : ev.dmg;
    damageLine(ctx, ev.x, ev.y, ev.dx, ev.dy, ev.length, ev.width, ev.dmg, 16, bossDmg);
    collectDead(ctx);
  }),
  r.on("enemies:died", (ev, ctx) => {
    const p = ctx.derived("player");
    ctx.mut(p, "progress").kills += ev.xs.length;
    const loot = ctx.rng("loot");
    for (let i = 0; i < ev.xs.length; i++) {
      const def = ENEMIES[ev.kinds[i]!]!;
      const x = ev.xs[i]!;
      const y = ev.ys[i]!;
      addDrop(ctx, DROP.xp, x, y, def.xp);
      if (loot.chance(def.coin)) addDrop(ctx, DROP.coin, x + 6, y - 4, def.coin >= 1 ? 10 : 1);
      if (loot.chance(def.heart)) addDrop(ctx, DROP.heart, x - 6, y + 4, 1);
      if (def.midboss) {
        // A midboss's defeat turns every bullet into points.
        ctx.emit("bullets:erase", { x, y, radius: 1e6, gems: true });
        ctx.emit("hitstop:start", { ticks: HITSTOP.spellBreak });
        ctx.emit("banner", { text: `${def.name} defeated!`, tone: "good" });
      }
    }
  }),

  // ---------- the player takes damage ----------
  // Against a boss, max HP and armor count at their boss share (BOSS.upgradeShare): her hits
  // are scaled up by what the extra HP would otherwise buy, and armor blocks less.
  r.on("player:hurt").as("boss share").modify((ev, ctx) => {
    if (ctx.derived("boss")) ev.dmg = Math.round((ev.dmg * ctx.derived("stats").maxHp) / ctx.derived("bossStats").maxHp);
  }),
  r.on("player:hurt").as("armor").modify((ev, ctx) => {
    const armor = ctx.derived(ctx.derived("boss") ? "bossStats" : "stats").armor;
    ev.dmg = Math.max(1, ev.dmg - armor);
  }),
  r.on("player:hurt").check((_, ctx) => {
    const p = ctx.derived("player");
    return ctx.now("action") < p.life.invulnUntil ? "invulnerable" : undefined;
  }),
  r.on("player:hurt", (ev, ctx) => {
    const p = ctx.derived("player");
    Object.assign(ctx.mut(p, "life"), {
      hp: Math.max(0, p.life.hp - ev.dmg),
      invulnUntil: ctx.now("action") + PLAYER.invuln,
      hits: p.life.hits + 1,
    });
    ctx.emit("hitstop:start", { ticks: HITSTOP.hurt });
  }),
  r.on("player:hurt").react((ev, ctx) => {
    if (ctx.derived("player").life.hp <= 0) ctx.emit("player:downed", { player: ev.player });
  }),
  r.on("player:downed", (ev, ctx) => {
    const p = ctx.derived("player");
    if (p.life.hp > 0) return; // saved on the way down (Border of Life and Death)
    const stats = ctx.derived("stats");
    if (p.life.revivesUsed < stats.revive) {
      Object.assign(ctx.mut(p, "life"), {
        hp: Math.round(stats.maxHp / 2),
        revivesUsed: p.life.revivesUsed + 1,
        invulnUntil: ctx.now("action") + sec(3),
      });
      ctx.emit("player:revived", { player: ev.player });
      ctx.emit("bullets:erase", { x: p.body.x, y: p.body.y, radius: 1e6, gems: false });
      ctx.emit("banner", { text: "Hakurei Blessing: back on your feet!", tone: "good" });
      return;
    }
    ctx.emit("run:over", { outcome: "dead" });
  }),

  // Hitstop: the action clock pauses for a few fixed ticks (a child clock, D22).
  r.on("hitstop:start", (ev, ctx) => {
    const run = ctx.derived("state");
    if (ctx.has(run, "hitstop")) ctx.stop(run.hitstop.pid);
    ctx.setScale("action", 0, 1);
    ctx.add(run, "hitstop", { pid: ctx.after("fixed", ev.ticks, "hitstop:end", {}) });
  }),
  r.on("hitstop:end", (_, ctx) => {
    const run = ctx.derived("state");
    ctx.setScale("action", 1, 1);
    if (ctx.has(run, "hitstop")) ctx.remove(run, "hitstop");
  }),

  // ---------- grazing fills the card meter ----------
  r.on("graze", (ev, ctx) => {
    const p = ctx.derived("player");
    const stats = ctx.derived("stats");
    ctx.mut(p, "progress").grazes += ev.n;
    ctx.mut(p, "meter").graze = p.meter.graze + ev.n * CARDS_TUNING.perGraze * stats.graze;
  }),
  r.on("graze").react((_, ctx) => {
    const p = ctx.derived("player");
    const room = ctx.derived("stats").hand - ctx.related("inPile", ctx.derived("piles").hand).length;
    let meter = p.meter.graze;
    let draws = 0;
    while (meter >= CARDS_TUNING.meterPerCard && draws < room) {
      meter -= CARDS_TUNING.meterPerCard;
      draws++;
      ctx.emit("card:draw", {});
    }
    // With a full hand the meter waits, full, for a card to be played.
    if (draws >= room) meter = Math.min(meter, CARDS_TUNING.meterPerCard);
    if (meter !== p.meter.graze) ctx.mut(p, "meter").graze = meter;
  }),

  // ---------- bullets and drops ----------
  r.on("bullets:erase", (ev, ctx) => {
    const gone = eraseBullets(ctx, ev.x, ev.y, ev.radius);
    if (ev.gems) {
      const step = Math.max(1, Math.ceil(gone.xs.length / 80));
      for (let i = 0; i < gone.xs.length; i += step) addDrop(ctx, DROP.xp, r1(gone.xs[i]!), r1(gone.ys[i]!), 1);
    }
  }),
  r.on("drops:pullAll", (_, ctx) => pullAll(ctx)),
  r.on("drops:collected", (ev, ctx) => {
    const p = ctx.derived("player");
    const stats = ctx.derived("stats");
    const pr = ctx.mut(p, "progress");
    pr.xp += ev.xp * stats.growth;
    pr.coinDrops += ev.coins;
    if (ev.hearts) ctx.mut(p, "life").hp = Math.min(stats.maxHp, p.life.hp + ev.hearts * HEART_HEAL);
  }),
  r.on("drops:collected").as("level up").react((_, ctx) => {
    const p = ctx.derived("player");
    let { xp, level, pending } = p.progress;
    const before = pending;
    while (xp >= XP.next(level)) {
      xp -= XP.next(level);
      level++;
      pending++;
    }
    if (pending === before) return;
    Object.assign(ctx.mut(p, "progress"), { xp, level, pending });
    ctx.emit("level:up", {});
  }),

  // ---------- level-up overlay ----------
  r.on("level:up", (_, ctx) => {
    const run = ctx.derived("state").run;
    if (run.overlay !== "none" || run.phase === "over") return;
    openLevelUp(ctx);
  }),
  r.on("levelup:picked", (ev, ctx) => {
    const offer = ctx.read(`${ctx.path}/levelup`, LevelUp);
    const choice = offer?.choices[ev.index];
    if (!choice) return;
    const p = ctx.derived("player");
    const stats = ctx.derived("stats");
    switch (choice.kind) {
      case "weapon": {
        const w = ctx.derived("weapons").find((x) => x.weapon.id === choice.id);
        if (w) ctx.mut(w, "weapon").level = choice.level;
        else ctx.spawn({ weapon: { id: choice.id, level: 1, readyAt: ctx.now("action") + 1, armed: 0 } }, "weapon");
        break;
      }
      case "passive": {
        const pa = ctx.derived("passives").find((x) => x.passive.id === choice.id);
        if (pa) ctx.mut(pa, "passive").level = choice.level;
        else ctx.spawn({ passive: { id: choice.id, level: 1 } }, "passive");
        const def = passiveDef(choice.id);
        if (def.stat === "maxHp") ctx.mut(p, "life").hp = p.life.hp + def.per;
        break;
      }
      case "heal":
        ctx.mut(p, "life").hp = Math.min(stats.maxHp, p.life.hp + stats.maxHp * HEAL_FRACTION);
        break;
      case "coins":
        ctx.mut(p, "progress").coinDrops = p.progress.coinDrops + COIN_OFFER;
        break;
    }
    ctx.mut(p, "progress").pending = p.progress.pending - 1;
  }),
  r.on("levelup:picked").as("next offer or resume").react((_, ctx) => {
    if (ctx.derived("player").progress.pending > 0) openLevelUp(ctx);
    else closeOverlay(ctx);
  }),
  r.on("levelup:reroll", (_, ctx) => {
    const p = ctx.derived("player");
    ctx.mut(p, "progress").rerollsUsed = p.progress.rerollsUsed + 1;
  }),
  r.on("levelup:reroll").react((_, ctx) => openLevelUp(ctx)),

  // ---------- the boss ----------
  r.on("boss:approach", (_, ctx) => {
    const run = ctx.derived("state");
    const { body } = ctx.derived("player");
    // The boss clears the field: every enemy and bullet turns into points (experience only) that fly to the player.
    const e = ctx.packed("enemies");
    for (let i = 0; i < e.count; i++) addDrop(ctx, DROP.xp, r1(e.col("x")[i]!), r1(e.col("y")[i]!), ENEMIES[e.col("kind")[i]!]!.xp);
    e.clear();
    ctx.emit("bullets:erase", { x: body.x, y: body.y, radius: 1e6, gems: true });
    ctx.emit("drops:pullAll", {});
    ctx.mut(run, "run").phase = "warning";
    ctx.emit("banner", { text: "WARNING: a powerful presence approaches", tone: "warn" });
    ctx.after("action", BOSS.warning, "boss:dialogue", {});
  }),
  r.on("boss:dialogue", (_, ctx) => {
    const run = ctx.derived("state");
    const { body } = ctx.derived("player");
    // The fog swallows the swarm; the arena forms around the player.
    ctx.packed("enemies").clear();
    ctx.emit("bullets:erase", { x: body.x, y: body.y, radius: 1e6, gems: false });
    Object.assign(ctx.mut(run, "run"), { phase: "dialogue", arena: true, ax: body.x, ay: body.y, overlay: "vn" });
    const path = ctx.open("vn");
    ctx.setScale("game", 0, 1);
    ctx.send(path, Vn, "vn:start", { script: stageDef(run.run.stage).dialogue });
  }),
  r.on("vn:closed", (_, ctx) => {
    const run = ctx.derived("state");
    const def = bossDef(stageDef(run.run.stage).boss);
    closeOverlay(ctx);
    ctx.mut(run, "run").phase = "boss";
    const t = ctx.now("action");
    const x = run.run.ax;
    const y = run.run.ay - BOSS.hover;
    ctx.spawn(
      {
        boss: {
          id: def.id,
          spell: 0,
          hp: def.spells[0]!.hp,
          max: def.spells[0]!.hp,
          spellStart: t,
          spellEnd: t + BOSS.intro + sec(def.spells[0]!.time),
          invulnUntil: t + BOSS.intro,
          pid: "",
          hitsAtStart: 0,
          orbAt: -100,
          x0: x,
          y0: y - 260,
          x1: x,
          y1: y,
          t0: t,
          t1: t + 60,
          sway: false,
          late: false,
          results: [],
        },
      },
      "boss",
    );
    ctx.emit("spell:start", { index: 0 });
  }),
  r.on("spell:start", (ev, ctx) => {
    const boss = ctx.derived("boss");
    if (!boss) return;
    const def = bossDef(boss.boss.id);
    const spell = def.spells[ev.index]!;
    const t = ctx.now("action");
    const run = ctx.derived("state").run;
    bossPos(boss, t, bp);
    const pid = ctx.start("spell", { index: ev.index, next: [], volley: [] });
    Object.assign(ctx.mut(boss, "boss"), {
      spell: ev.index,
      hp: spell.hp,
      max: spell.hp,
      spellStart: t,
      spellEnd: t + BOSS.intro + sec(spell.time),
      invulnUntil: t + BOSS.intro,
      pid,
      hitsAtStart: ctx.derived("player").life.hits,
      x0: bp.x,
      y0: bp.y,
      x1: run.ax,
      y1: run.ay - BOSS.hover,
      t0: t,
      t1: t + 50,
      sway: spell.move === "sway",
      late: false,
    });
  }),
  r.on("boss:hit").as("between spells").modify((ev, ctx) => {
    const boss = ctx.derived("boss");
    if (!boss || !bossVulnerable(boss, ctx.now("action"))) ev.dmg = 0;
  }),
  r.on("boss:hit", (ev, ctx) => {
    const boss = ctx.derived("boss");
    if (!boss || ev.dmg <= 0) return;
    ctx.mut(boss, "boss").hp = Math.max(0, boss.boss.hp - ev.dmg);
  }),
  r.on("boss:hit").react((_, ctx) => {
    const boss = ctx.derived("boss");
    if (boss && boss.boss.hp <= 0 && boss.boss.results.length === boss.boss.spell) {
      ctx.emit("spell:break", { index: boss.boss.spell, timeout: boss.boss.late });
    }
  }),
  r.on("spell:late", (ev, ctx) => {
    const boss = ctx.derived("boss");
    if (boss && boss.boss.spell === ev.index) ctx.mut(boss, "boss").late = true;
  }),
  r.on("spell:break").check((ev, ctx) => {
    const boss = ctx.derived("boss");
    return boss && boss.boss.results.length === ev.index ? undefined : "that spell card already ended";
  }),
  r.on("spell:break", (ev, ctx) => {
    const boss = ctx.derived("boss")!;
    const def = bossDef(boss.boss.id);
    const spell = def.spells[ev.index]!;
    const p = ctx.derived("player");
    ctx.stop(boss.boss.pid);
    const captured = !ev.timeout && p.life.hits === boss.boss.hitsAtStart;
    const result = ev.timeout ? "timeout" : captured ? "captured" : "broken";
    const b = ctx.mut(boss, "boss");
    b.results.push(result);
    b.hp = 0;
    if (!ev.timeout) {
      const pr = ctx.mut(p, "progress");
      pr.coinSpells += captured ? spell.bonus * 2 : spell.bonus;
      if (captured) pr.spellsCaptured += 1;
    }
    const run = ctx.derived("state").run;
    ctx.emit("bullets:erase", { x: run.ax, y: run.ay, radius: 1e6, gems: !ev.timeout });
    ctx.emit("hitstop:start", { ticks: HITSTOP.spellBreak });
    if (ev.index + 1 < def.spells.length) ctx.after("action", BOSS.between, "spell:start", { index: ev.index + 1 });
    else ctx.emit("boss:defeated", {});
  }),
  r.on("boss:defeated", (_, ctx) => {
    const run = ctx.derived("state");
    const boss = ctx.derived("boss");
    const stage = stageDef(run.run.stage);
    if (boss) ctx.despawn(boss);
    ctx.mut(run, "run").phase = "cleared";
    const p = ctx.derived("player");
    ctx.mut(p, "progress").coinClear = stage.clearBonus;
    ctx.packed("enemies").clear();
    ctx.emit("drops:pullAll", {});
    ctx.emit("banner", { text: "Stage clear!", tone: "good" });
    ctx.after("fixed", BOSS.outro, "run:over", { outcome: "clear" });
  }),

  // ---------- the end ----------
  r.on("run:forfeit", (_, ctx) => ctx.emit("run:over", { outcome: "quit" })),
  r.on("run:over").check((_, ctx) => (ctx.derived("state").run.phase === "over" ? "the run is already over" : undefined)),
  r.on("run:over", (ev, ctx) => {
    const run = ctx.derived("state");
    if (run.run.overlay !== "none") closeOverlay(ctx);
    Object.assign(ctx.mut(run, "run"), { phase: "over", outcome: ev.outcome, endedAt: ctx.now("action") });
    ctx.setScale("game", 0, 1);
    ctx.after("fixed", ev.outcome === "quit" ? 1 : END_DELAY, "run:finish", {});
  }),
  r.on("run:finish", (_, ctx) => ctx.send("/", Meta, "run:ended", summary(ctx))),

  ...cardRules(r),
]).migrations([migrateToFormations, migrateSalvoAim, migrateFocus]);

function r1(v: number): number {
  return Math.round(v * 10) / 10;
}

export { script };
