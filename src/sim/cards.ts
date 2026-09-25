// Skill cards in the fight: the deck, hand and discard are one ordered
// relation (`in: { of: pile, at }`). A card is drawn each time grazing fills
// the meter, and played by input for its Spirit cost. Each effect is a rule
// on `card:played` matched on the card's `effect`; two of them work by other
// rules: Power Charm adds a status that a `modify` rule on `weapon:fire`
// reads, and Graze Ribbon, Vengeful Amulet and Border of Life and Death
// store `triggers` rows on the player that name rules registered here.

import { z } from "zod";
import { trigger, type Ctx, type RuleBuilder, type RuleDef, type View } from "gamebones";
import { CARD_KINDS, cardDef, cardParams, type CardKind } from "../content/cards.ts";
import type { RS, RS0 } from "./run.ts";
import { CARDS_TUNING, sec } from "./tuning.ts";

/** Spirit at tick t: computable, never counted per tick. */
export function spiritAt(v: View<RS0>, t: number): number {
  const { spirit } = v.derived("player");
  const stats = v.derived("stats");
  const rate = CARDS_TUNING.spiritPerTick * stats.spiritRegen;
  return Math.min(stats.spiritMax, spirit.base + rate * (t - spirit.t0));
}

export function handCards(v: View<RS0>) {
  return v.related("inPile", v.derived("piles").hand);
}

/**
 * The hand's size: the Hand Size stat, but never more slots than the run has
 * cards (a smaller deck would leave slots that can never fill).
 */
export function handSize(v: View<RS0>): number {
  const piles = v.derived("piles");
  const cards = v.related("inPile", piles.deck).length + v.related("inPile", piles.hand).length + v.related("inPile", piles.discard).length;
  return Math.min(v.derived("stats").hand, cards);
}

/**
 * The hand as fixed slots (one per hand size): a card's `at` in the hand is
 * its slot, so playing a card leaves a gap instead of sliding the others
 * over. Cards whose `at` is not a free slot (saves from before slots) take
 * the free ones in order.
 */
export function handSlots(v: View<RS0>): (ReturnType<typeof handCards>[number] | null)[] {
  const cards = handCards(v);
  const slots: (typeof cards[number] | null)[] = Array.from({ length: Math.max(handSize(v), cards.length) }, () => null);
  const loose: typeof cards = [];
  for (const c of cards) {
    if (c.in.at < slots.length && !slots[c.in.at]) slots[c.in.at] = c;
    else loose.push(c);
  }
  for (const c of loose) slots[slots.indexOf(null)] = c;
  return slots;
}

function topAt(v: View<RS0>, pileId: string): number {
  const cards = v.related("inPile", pileId);
  return cards.length ? cards[cards.length - 1]!.in.at + 1 : 0;
}

/** The kinds in their colour order (red attack, blue guard, green heal, yellow empower, purple utility), for the home slots. */
const KIND_ORDER = Object.keys(CARD_KINDS) as CardKind[];

/**
 * The hand slot a drawn card takes, aiming to keep the hand in colour order
 * (red attack, blue guard, green heal, yellow empower, purple utility) as
 * often as possible, without ever moving a card already held (a key must
 * still play the card it showed).
 *
 * Its kind's home is where that kind sits in this run's deck, stretched over
 * the hand: a kind that makes up the deck's first quarter lives in the
 * hand's first quarter. Of the free slots, it takes the one that leaves the
 * fewest cards out of colour order with it, and among those the nearest to home.
 */
function slotFor(v: View<RS0>, card: string): number {
  const piles = v.derived("piles");
  const rank = (id: string): number => KIND_ORDER.indexOf(cardDef(v.req(id, "card").card.id).kind);
  const deck = [piles.deck, piles.hand, piles.discard].flatMap((pile) => v.related("inPile", pile).map((c) => rank(c.id)));
  const slots = handSlots(v);
  const mine = rank(card);
  const below = deck.filter((r) => r < mine).length;
  const same = deck.filter((r) => r === mine).length;
  const home = Math.min(slots.length - 1, Math.floor(((below + same / 2) / Math.max(1, deck.length)) * slots.length));
  let best = -1;
  let bestKey = Infinity;
  slots.forEach((held, at) => {
    if (held) return;
    let wrong = 0;
    slots.forEach((c, j) => {
      if (!c || c.id === card) return;
      const r = rank(c.id);
      if ((j < at && r > mine) || (j > at && r < mine)) wrong++;
    });
    const key = wrong * 100 + Math.abs(at - home);
    if (key < bestKey) {
      bestKey = key;
      best = at;
    }
  });
  return best;
}

/** Moves a card to the top of a pile (read the slot before writing: related() sees this node's writes). */
export function moveCard(ctx: Ctx<RS0>, card: string, pileId: string): void {
  const at = topAt(ctx, pileId);
  const e = ctx.req(card);
  if (ctx.has(e, "in")) Object.assign(ctx.mut(card, "in"), { of: pileId, at });
  else ctx.add(card, "in", { of: pileId, at });
}

function params(ctx: View<RS0>, card: string): Record<string, number> {
  const c = ctx.req(card, "card").card;
  return cardParams(cardDef(c.id), c.level);
}

function ticksFor(ctx: View<RS0>, seconds: number): number {
  return Math.max(1, Math.round(sec(seconds) * ctx.derived("stats").duration));
}

/** Schedules the expiry of a timed status, replacing an earlier one of the same name. */
function timed(ctx: Ctx<RS0>, status: string, ticks: number): void {
  const run = ctx.derived("state");
  const cur = ctx.has(run, "timed") ? run.timed.pids : {};
  const old = cur[status];
  if (old) ctx.stop(old);
  const pid = ctx.after("action", ticks, "status:expire", { status });
  if (ctx.has(run, "timed")) ctx.mut(run, "timed").pids[status] = pid;
  else ctx.add(run, "timed", { pids: { [status]: pid } });
}

/** Adds (or refreshes) a triggers row on the player. */
function addTrigger(ctx: Ctx<RS0>, row: ReturnType<typeof trigger>): void {
  const p = ctx.derived("player");
  const rows = ctx.has(p, "triggers") ? p.triggers.filter((t) => t.rule !== row.rule) : [];
  ctx.add(p, "triggers", [...rows.map((t) => ({ ...t })), row]);
}

export function removeTrigger(ctx: Ctx<RS0>, rule: string): void {
  const p = ctx.derived("player");
  if (!ctx.has(p, "triggers")) return;
  const rows = p.triggers.filter((t) => t.rule !== rule).map((t) => ({ ...t }));
  if (rows.length) ctx.add(p, "triggers", rows);
  else ctx.remove(p, "triggers");
}

function invuln(ctx: Ctx<RS0>, seconds: number): void {
  const p = ctx.derived("player");
  const until = ctx.now("action") + sec(seconds);
  if (until > p.life.invulnUntil) ctx.mut(p, "life").invulnUntil = until;
}

export function cardRules(r: RuleBuilder<RS>): RuleDef[] {
  return [
    // ----- playing -----
    r.on("card:play").check((ev, ctx) => {
      const card = ctx.req(ev.card, "card");
      const hand = ctx.derived("piles").hand;
      if (!ctx.has(card, "in") || card.in.of !== hand) return `${cardDef(card.card.id).name} is not in your hand`;
      const phase = ctx.derived("state").run.phase;
      if (phase === "over" || phase === "dialogue") return "cards cannot be played now";
      if (ctx.derived("state").run.overlay !== "none") return "cards cannot be played now";
      const cost = cardDef(card.card.id).cost;
      const have = spiritAt(ctx, ctx.now("action"));
      return have + 1e-9 >= cost ? undefined : `needs ${cost} Spirit (you have ${Math.floor(have)})`;
    }),
    r.on("card:play").as("pay and discard").apply((ev, ctx) => {
      const t = ctx.now("action");
      const cost = cardDef(ctx.req(ev.card, "card").card.id).cost;
      const have = spiritAt(ctx, t);
      const p = ctx.derived("player");
      Object.assign(ctx.mut(p, "spirit"), { base: have - cost, t0: t });
      ctx.mut(p, "progress").cardsPlayed += 1;
      moveCard(ctx, ev.card, ctx.derived("piles").discard);
      ctx.emit("card:played", { card: ev.card, x: p.body.x, y: p.body.y, fx: p.body.fx, fy: p.body.fy });
    }),
    // A full meter was waiting for room in the hand.
    r.on("card:play").react((_, ctx) => {
      const p = ctx.derived("player");
      if (p.meter.graze >= CARDS_TUNING.meterPerCard) {
        ctx.mut(p, "meter").graze -= CARDS_TUNING.meterPerCard;
        ctx.emit("card:draw", {});
      }
    }),

    // ----- drawing -----
    r.on("card:draw", (_, ctx) => {
      const piles = ctx.derived("piles");
      if (handCards(ctx).length >= handSize(ctx)) return;
      let top = ctx.related("inPile", piles.deck)[0];
      if (!top) {
        const ids = ctx.related("inPile", piles.discard).map((c) => c.id);
        ctx.rng("deck").shuffle(ids);
        ids.forEach((id, at) => Object.assign(ctx.mut(id, "in"), { of: piles.deck, at }));
        top = ctx.related("inPile", piles.deck)[0];
        if (!top) return;
      }
      // The drawn card goes home (slotFor; read before writing: related() sees this node's writes).
      const slot = slotFor(ctx, top.id);
      Object.assign(ctx.mut(top.id, "in"), { of: piles.hand, at: slot });
      ctx.emit("card:drawn", { card: top.id });
    }),

    // ----- effects: one rule per effect, matched on the card's data -----
    r.on("card:played").when({ card: { card: { effect: "burst" } } }).as("Fantasy Seal").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      ctx.emit("blast", { x: ev.x, y: ev.y, radius: p.radius!, dmg: p.dmg!, source: ctx.req(ev.card, "card").card.id });
    }),
    r.on("card:played").when({ card: { card: { effect: "clear" } } }).as("Barrier").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      ctx.emit("bullets:erase", { x: ev.x, y: ev.y, radius: p.radius!, gems: false });
      invuln(ctx, p.invuln!);
    }),
    r.on("card:played").when({ card: { card: { effect: "heal" } } }).as("Healing Charm").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      const pl = ctx.derived("player");
      const max = ctx.derived("stats").maxHp;
      ctx.mut(pl, "life").hp = Math.min(max, pl.life.hp + p.hp!);
    }),
    r.on("card:played").when({ card: { card: { effect: "empower" } } }).as("Power Charm").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      const pl = ctx.derived("player");
      const ticks = ticksFor(ctx, p.time!);
      if (ctx.has(pl, "empowered")) ctx.stop(pl.empowered.pid);
      const pid = ctx.after("action", ticks, "status:expire", { status: "empowered" });
      ctx.add(pl, "empowered", { pct: p.pct!, until: ctx.now("action") + ticks, pid });
    }),
    r.on("card:played").when({ card: { card: { effect: "grazeHeal" } } }).as("Graze Ribbon").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      addTrigger(ctx, trigger("graze", "grazeHeal", { hp: p.hp!, spirit: p.spirit! }));
      timed(ctx, "grazeHeal", ticksFor(ctx, p.time!));
    }),
    r.on("card:played").when({ card: { card: { effect: "vengeance" } } }).as("Vengeful Amulet").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      addTrigger(ctx, trigger("player:hurt", "vengeance", { dmg: p.dmg!, radius: p.radius! }));
      timed(ctx, "vengeance", ticksFor(ctx, p.time!));
    }),
    r.on("card:played").when({ card: { card: { effect: "lastStand" } } }).as("Border of Life").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      addTrigger(ctx, trigger("player:hurt", "lastStand", { pct: p.hp! }));
    }),
    r.on("card:played").when({ card: { card: { effect: "timeStop" } } }).as("Private Square").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      const run = ctx.derived("state");
      const ticks = ticksFor(ctx, p.time!);
      if (ctx.has(run, "timestop")) ctx.stop(run.timestop.pid);
      ctx.setScale("danmaku", 0, 1);
      const pid = ctx.after("action", ticks, "timestop:end", {});
      ctx.add(run, "timestop", { until: ctx.now("action") + ticks, pid });
    }),
    r.on("card:played").when({ card: { card: { effect: "spark" } } }).as("Master Spark").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      ctx.emit("beam", { x: ev.x, y: ev.y, dx: ev.fx, dy: ev.fy, length: p.length!, width: p.width!, dmg: p.dmg!, color: 0xfff27a, source: ctx.req(ev.card, "card").card.id });
    }),
    r.on("card:played").when({ card: { card: { effect: "gap" } } }).as("Gap Travel").apply((ev, ctx) => {
      const p = params(ctx, ev.card);
      ctx.emit("drops:pullAll", {});
      invuln(ctx, p.invuln!);
    }),

    // ----- statuses the cards leave behind -----
    r.on("status:expire", (ev, ctx) => {
      const run = ctx.derived("state");
      if (ev.status === "empowered") {
        const pl = ctx.derived("player");
        if (ctx.has(pl, "empowered")) ctx.remove(pl, "empowered");
      } else {
        removeTrigger(ctx, ev.status);
      }
      if (ctx.has(run, "timed") && run.timed.pids[ev.status]) delete ctx.mut(run, "timed").pids[ev.status];
    }),
    r.on("timestop:end", (_, ctx) => {
      const run = ctx.derived("state");
      ctx.setScale("danmaku", 1, 1);
      if (ctx.has(run, "timestop")) ctx.remove(run, "timestop");
    }),

    // The damage interception point: every weapon volley passes through here (D17 modify).
    r.on("weapon:fire").priority(10).as("might").modify((ev, ctx) => {
      // Flat damage (the shrine's) goes on before Might multiplies.
      ev.dmg = (ev.dmg + ctx.derived("stats").dmg) * ctx.derived("stats").might;
    }),
    r.on("weapon:fire").as("Power Charm bonus").modify((ev, ctx) => {
      const pl = ctx.derived("player");
      if (ctx.has(pl, "empowered") && pl.empowered.until > ctx.now("action")) ev.dmg = ev.dmg * (1 + pl.empowered.pct / 100);
    }),

    // Rules that run only through triggers rows on the player (D19).
    r.named("grazeHeal", z.object({ hp: z.number(), spirit: z.number() })).on("graze").apply((ev, ctx, self) => {
      const pl = ctx.req(self.id, "life");
      const stats = ctx.derived("stats");
      const t = ctx.now("action");
      const spirit = Math.min(stats.spiritMax, spiritAt(ctx, t) + self.params.spirit * ev.n);
      ctx.mut(self.id, "life").hp = Math.min(stats.maxHp, pl.life.hp + self.params.hp * ev.n);
      Object.assign(ctx.mut(self.id, "spirit"), { base: spirit, t0: t });
    }),
    r.named("vengeance", z.object({ dmg: z.number(), radius: z.number() })).on("player:hurt").react((_, ctx, self) => {
      const { body } = ctx.derived("player");
      ctx.emit("blast", { x: body.x, y: body.y, radius: self.params.radius, dmg: self.params.dmg, source: "vengeance" });
    }),
    r.named("lastStand", z.object({ pct: z.number() })).on("player:hurt").react((_, ctx, self) => {
      const pl = ctx.req(self.id, "life");
      if (pl.life.hp > 0) return;
      const max = ctx.derived("stats").maxHp;
      ctx.mut(self.id, "life").hp = Math.max(1, Math.round((max * self.params.pct) / 100));
      removeTrigger(ctx, "lastStand");
      ctx.emit("banner", { text: "Border of Life and Death!", tone: "good" });
      ctx.emit("bullets:erase", { x: ctx.derived("player").body.x, y: ctx.derived("player").body.y, radius: 300, gems: false });
    }),
  ];
}
