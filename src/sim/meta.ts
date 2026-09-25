// The meta scope: the root of the kernel, saved across runs and page
// reloads. It holds donations, the shrine tree, the card collection and
// deck, the gacha pity counter (with its own rng stream, so runs never shift
// the pack odds), records and the last run's results. A run is a child scope
// opened at `/run:<n>`; a pack opening is a child scope at `/pack`.

import { z } from "zod";
import { defineScope, done, event, input, ref, wait, type Ctx, type SpecOf, type View } from "gamebones";
import { DESTINATIONS, MAX_ELAPSED_SECONDS, MAX_EXPEDITIONS, STARTING_COMPANIONS, destination } from "../content/expeditions.ts";
import { CHARACTERS, PLAYER_CHARACTER } from "../content/names.ts";
import { CARDS, MAX_CARD_LEVEL, RARITIES, RARITY_INFO, STARTER_CARDS, cardDef, type Rarity } from "../content/cards.ts";
import { DECK_MAX, DECK_MIN, PACKS, packDef } from "../content/gacha.ts";
import { STAGES, stageDef } from "../content/stages.ts";
import { OLD_TREE_COSTS, TREE, treeNode } from "../content/tree.ts";
import { RunSummary } from "./schemas.ts";
import { Run } from "./rules.ts";
import { Pack } from "./pack.ts";

const int = z.int();

const MetaDecl = defineScope("meta", {
  components: {
    wallet: z.strictObject({ coins: int, lifetime: int }),
    profile: z.strictObject({
      runs: int,
      clears: int,
      bestSeconds: int,
      bestKills: int,
      bestLevel: int,
      totalKills: int,
      activeRun: z.string(),
      nextRun: int,
      /** Stage ids cleared at least once (they open the next stages). */
      cleared: z.array(z.string()),
    }),
    tree: z.strictObject({ levels: z.record(z.string(), int) }),
    owned: z.strictObject({ card: z.string(), level: int, copies: int, inDeck: z.boolean(), fresh: z.boolean() }),
    gacha: z.strictObject({ sinceHigh: int, opened: int, open: z.boolean() }),
    lastRun: z.strictObject({ summary: RunSummary, records: z.array(z.string()), run: int }),
    /** A companion away on an expedition; `endsAt` is on the idle clock (real seconds). */
    expedition: z.strictObject({ who: z.string(), dest: z.string(), startedAt: int, endsAt: int, back: z.boolean(), pid: z.string() }),
  },
  events: {
    "run:start": input({ stage: z.string() }),
    "run:abandon": input(),
    "tree:buy": input({ node: z.string() }),
    "pack:buy": input({ pack: z.string() }),
    "deck:toggle": input({ card: z.string() }),
    "cards:seen": input(),
    "run:ended": event(RunSummary.shape),
    "pack:closed": event(),
    // Real time enters only as input: the host reports how long the game was away (D22).
    "time:resumed": input({ elapsed: int.min(0) }),
    "expedition:send": input({ who: z.string(), dest: z.string() }),
    "expedition:claim": input({ trip: ref() }, { subject: "trip" }),
    "expedition:recall": input({ trip: ref() }, { subject: "trip" }),
    "expedition:returned": event({ trip: ref() }, { subject: "trip" }),
  },
  // Seconds of real time, advanced only by time:resumed; expeditions wait on it.
  clocks: { idle: { elapsed: true } },
  rng: ["gacha"],
  children: { run: Run, pack: Pack },
}).derive({
  wallet: (v) => v.q("wallet")[0]!,
  profile: (v) => v.q("profile")[0]!,
  tree: (v) => v.q("tree")[0]!,
  gacha: (v) => v.q("gacha")[0]!,
  owned: (v) => v.q("owned"),
  deck: (v) => v.q("owned").filter((o) => o.owned.inDeck),
  trips: (v) => v.q("expedition"),
  /** Who can go: the starting companions plus the owner of every collected card, minus the player. */
  companions: (v) => {
    const out = new Set<string>(STARTING_COMPANIONS);
    for (const o of v.q("owned")) out.add(cardDef(o.owned.card).owner);
    out.delete(PLAYER_CHARACTER);
    return [...out];
  },
});

type MS = SpecOf<typeof MetaDecl>;

/** Stat bonuses and unlocks from the shrine tree. */
export function treeLoadout(levels: Readonly<Record<string, number>>): { bonuses: Record<string, number>; unlocked: string[] } {
  const bonuses: Record<string, number> = {};
  const unlocked: string[] = [];
  for (const node of TREE) {
    const lvl = levels[node.id] ?? 0;
    if (!lvl) continue;
    if (node.effect.kind === "stat") bonuses[node.effect.stat] = round4((bonuses[node.effect.stat] ?? 0) + node.effect.per * lvl);
    else unlocked.push(node.effect.weapon);
  }
  return { bonuses, unlocked };
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export type NodeState = "maxed" | "buyable" | "poor" | "locked";

/** Where a node stands: maxed, affordable, too expensive, or not yet connected. */
export function nodeState(v: View<MS>, id: string): NodeState {
  const node = treeNode(id);
  const levels = v.derived("tree").tree.levels;
  const lvl = levels[id] ?? 0;
  if (lvl >= node.costs.length) return "maxed";
  if (node.requires.length && !node.requires.some((r) => (levels[r] ?? 0) > 0)) return "locked";
  if ((node.clears ?? 0) > v.derived("profile").profile.clears) return "locked";
  return v.derived("wallet").wallet.coins >= node.costs[lvl]! ? "buyable" : "poor";
}

/** Chance of each rarity in the next pack's last slot, pity included (for the shop's odds table). */
export function packOdds(v: View<MS>, packId: string): Record<Rarity, number> {
  const pack = packDef(packId);
  const total = RARITIES.reduce((s, r) => s + pack.odds[r], 0);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITIES) out[r] = pack.odds[r] / total;
  void v;
  return out;
}

export function packsUntilPity(v: View<MS>, packId: string): number {
  const pack = packDef(packId);
  return Math.max(1, pack.pity.every - v.derived("gacha").gacha.sinceHigh);
}

const MetaOpts = MetaDecl.exports((v) => ({
  coins: v.derived("wallet").wallet.coins,
  activeRun: v.derived("profile").profile.activeRun,
}))
  .options({
    "run:start": (v) => {
      const p = v.derived("profile").profile;
      return p.activeRun ? [] : STAGES.filter((s) => !s.requires || p.cleared.includes(s.requires)).map((s) => ({ stage: s.id }));
    },
    "tree:buy": (v) => TREE.filter((n) => nodeState(v, n.id) === "buyable").map((n) => ({ node: n.id })),
    "pack:buy": (v) =>
      v.derived("profile").profile.activeRun || v.derived("gacha").gacha.open
        ? []
        : PACKS.filter((p) => v.derived("wallet").wallet.coins >= p.cost).map((p) => ({ pack: p.id })),
    "deck:toggle": (v) => v.derived("owned").map((o) => ({ card: o.owned.card })),
    "expedition:send": (v) => {
      const busy = new Set(v.derived("trips").map((t) => t.expedition.who));
      if (busy.size >= MAX_EXPEDITIONS) return [];
      return v
        .derived("companions")
        .filter((w) => !busy.has(w))
        .flatMap((who) => DESTINATIONS.map((d) => ({ who, dest: d.id })));
    },
    "expedition:claim": (v) => v.derived("trips").filter((t) => t.expedition.back).map((t) => ({ trip: t.id })),
  });

const MetaBase = MetaOpts.processes((process) => ({
  // One per expedition: sleeps on the idle clock until the companion is back.
  expedition: process({
    clock: "idle",
    start: "away",
    locals: { trip: "", seconds: 1 },
    states: {
      away: (p) => wait(Math.max(1, p.locals.seconds), "back"),
      back: (p, ctx) => {
        if (ctx.get(p.locals.trip)) ctx.emit("expedition:returned", { trip: p.locals.trip });
        return done();
      },
    },
  }),
}));

export { MetaBase };

const rank = (r: Rarity): number => RARITIES.indexOf(r);

export const Meta: typeof MetaBase = MetaBase.rules((r) => [
  // ---------- runs ----------
  r.on("run:start").check((ev, ctx) => {
    if (ctx.derived("profile").profile.activeRun) return "a run is already in progress";
    if (ctx.derived("deck").length < DECK_MIN) return `put at least ${DECK_MIN} card in your deck`;
    const stage = STAGES.find((s) => s.id === ev.stage);
    if (!stage) return `no stage "${ev.stage}"`;
    if (stage.requires && !ctx.derived("profile").profile.cleared.includes(stage.requires)) return `clear ${stageDef(stage.requires).name} first`;
    return undefined;
  }),
  r.on("run:start", (ev, ctx) => {
    const profile = ctx.derived("profile");
    const n = profile.profile.nextRun;
    const path = ctx.open("run", String(n));
    Object.assign(ctx.mut(profile, "profile"), { nextRun: n + 1, runs: profile.profile.runs + 1, activeRun: path });
    const { bonuses, unlocked } = treeLoadout(ctx.derived("tree").tree.levels);
    const deck = ctx.derived("deck").map((o) => ({ id: o.owned.card, level: o.owned.level }));
    ctx.send(path, Run, "run:begin", { stage: stageDef(ev.stage).id, bonuses, unlocked, deck });
  }),
  r.on("run:abandon").check((_, ctx) => (ctx.derived("profile").profile.activeRun ? undefined : "no run in progress")),
  r.on("run:abandon", (_, ctx) => ctx.send(ctx.derived("profile").profile.activeRun, Run, "run:forfeit", {})),
  r.on("run:ended", (ev, ctx) => {
    const profile = ctx.derived("profile");
    const p = profile.profile;
    const records: string[] = [];
    if (ev.seconds > p.bestSeconds) records.push("time");
    if (ev.kills > p.bestKills) records.push("kills");
    if (ev.level > p.bestLevel) records.push("level");
    if (ev.outcome === "clear" && !p.cleared.includes(ev.stage)) records.push("first clear");
    ctx.close(p.activeRun);
    Object.assign(ctx.mut(profile, "profile"), {
      activeRun: "",
      clears: p.clears + (ev.outcome === "clear" ? 1 : 0),
      cleared: ev.outcome === "clear" && !p.cleared.includes(ev.stage) ? [...p.cleared, ev.stage] : [...p.cleared],
      bestSeconds: Math.max(p.bestSeconds, ev.seconds),
      bestKills: Math.max(p.bestKills, ev.kills),
      bestLevel: Math.max(p.bestLevel, ev.level),
      totalKills: p.totalKills + ev.kills,
    });
    const w = ctx.derived("wallet");
    Object.assign(ctx.mut(w, "wallet"), { coins: w.wallet.coins + ev.coins.total, lifetime: w.wallet.lifetime + ev.coins.total });
    const summary = RunSummary.parse(ev);
    const last = ctx.q("lastRun")[0];
    const value = { summary, records, run: p.nextRun - 1 };
    if (last) ctx.add(last, "lastRun", value);
    else ctx.spawn({ lastRun: value }, "last");
  }),

  // ---------- the shrine tree ----------
  r.on("tree:buy").check((ev, ctx) => {
    if (!TREE.some((n) => n.id === ev.node)) return `no node "${ev.node}"`;
    const node = treeNode(ev.node);
    const lvl = ctx.derived("tree").tree.levels[ev.node] ?? 0;
    switch (nodeState(ctx, ev.node)) {
      case "maxed":
        return `${node.name} is fully upgraded`;
      case "locked":
        if ((node.clears ?? 0) > ctx.derived("profile").profile.clears) return `${node.name} needs ${node.clears} stage clear${node.clears === 1 ? "" : "s"}`;
        return `${node.name} needs ${node.requires.map((id) => treeNode(id).name).join(" or ")} first`;
      case "poor":
        return `${node.name} costs ${node.costs[lvl]} (you have ${ctx.derived("wallet").wallet.coins})`;
      default:
        return undefined;
    }
  }),
  r.on("tree:buy", (ev, ctx) => {
    const node = treeNode(ev.node);
    const tree = ctx.derived("tree");
    const lvl = tree.tree.levels[ev.node] ?? 0;
    ctx.mut(ctx.derived("wallet"), "wallet").coins -= node.costs[lvl]!;
    ctx.mut(tree, "tree").levels[ev.node] = lvl + 1;
  }),

  // ---------- card packs ----------
  r.on("pack:buy").check((ev, ctx) => {
    if (!PACKS.some((p) => p.id === ev.pack)) return `no pack "${ev.pack}"`;
    if (ctx.derived("profile").profile.activeRun) return "finish your run first";
    if (ctx.derived("gacha").gacha.open) return "a pack is already open";
    const pack = packDef(ev.pack);
    const coins = ctx.derived("wallet").wallet.coins;
    return coins >= pack.cost ? undefined : `${pack.name} costs ${pack.cost} (you have ${coins})`;
  }),
  r.on("pack:buy", (ev, ctx) => {
    const pack = packDef(ev.pack);
    const rng = ctx.rng("gacha");
    const g = ctx.derived("gacha");
    ctx.mut(ctx.derived("wallet"), "wallet").coins -= pack.cost;
    const weights = RARITIES.map((r) => pack.odds[r]);
    const roll = (min: number): Rarity => {
      const allowed = RARITIES.filter((r) => rank(r) >= min);
      const ws = allowed.map((r) => weights[rank(r)]!);
      let x = rng.float() * ws.reduce((s, w) => s + w, 0);
      for (let i = 0; i < allowed.length; i++) {
        x -= ws[i]!;
        if (x < 0) return allowed[i]!;
      }
      return allowed[allowed.length - 1]!;
    };
    const rarities: Rarity[] = [];
    for (let i = 0; i < pack.cards; i++) rarities.push(roll(0));
    const pityRank = rank(pack.pity.rarity);
    let pity = false;
    if (!rarities.some((r) => rank(r) >= pityRank) && g.gacha.sinceHigh + 1 >= pack.pity.every) {
      rarities[rarities.length - 1] = roll(pityRank);
      pity = true;
    }
    const high = rarities.some((r) => rank(r) >= pityRank);
    Object.assign(ctx.mut(g, "gacha"), { sinceHigh: high ? 0 : g.gacha.sinceHigh + 1, opened: g.gacha.opened + 1, open: true });

    // Resolve each card against the collection now, so a reload mid-opening loses nothing.
    const pulls: { card: string; rarity: Rarity; outcome: "new" | "level" | "refund"; level: number; refund: number; pity: boolean }[] = [];
    const owned = new Map(ctx.derived("owned").map((o) => [o.owned.card, o]));
    const deckSize = ctx.derived("deck").length;
    let added = 0;
    rarities.forEach((rarity, i) => {
      const pool = CARDS.filter((c) => c.rarity === rarity);
      const card = rng.pick(pool);
      const have = owned.get(card.id);
      const pityCard = pity && i === rarities.length - 1;
      if (!have) {
        const id = ctx.spawn(
          { owned: { card: card.id, level: 1, copies: 1, inDeck: deckSize + added < DECK_MAX, fresh: true } },
          "owned",
        );
        added++;
        owned.set(card.id, ctx.req(id, "owned"));
        pulls.push({ card: card.id, rarity, outcome: "new", level: 1, refund: 0, pity: pityCard });
        return;
      }
      // Copy the numbers out first: after a mut in this node, req() hands back the live
      // writable copy, so reading it after the write would see the new values (NOTES.md).
      const { level, copies } = ctx.req(have.id, "owned").owned;
      if (level < MAX_CARD_LEVEL) {
        Object.assign(ctx.mut(have.id, "owned"), { level: level + 1, copies: copies + 1, fresh: true });
        pulls.push({ card: card.id, rarity, outcome: "level", level: level + 1, refund: 0, pity: pityCard });
        return;
      }
      const refund = RARITY_INFO[rarity].refund;
      ctx.mut(have.id, "owned").copies = copies + 1;
      ctx.mut(ctx.derived("wallet"), "wallet").coins += refund;
      pulls.push({ card: card.id, rarity, outcome: "refund", level, refund, pity: pityCard });
    });
    const path = ctx.open("pack");
    ctx.send(path, Pack, "pack:show", { pack: pack.id, pulls });
  }),
  r.on("pack:closed", (_, ctx) => {
    ctx.close("/pack");
    ctx.mut(ctx.derived("gacha"), "gacha").open = false;
  }),

  // ---------- the deck ----------
  r.on("deck:toggle").check((ev, ctx) => {
    const o = ctx.derived("owned").find((x) => x.owned.card === ev.card);
    if (!o) return `you do not own ${ev.card}`;
    const size = ctx.derived("deck").length;
    if (o.owned.inDeck && size <= DECK_MIN) return `the deck needs at least ${DECK_MIN} card`;
    if (!o.owned.inDeck && size >= DECK_MAX) return `the deck holds at most ${DECK_MAX} cards`;
    return undefined;
  }),
  r.on("deck:toggle", (ev, ctx) => {
    const o = ctx.derived("owned").find((x) => x.owned.card === ev.card)!;
    ctx.mut(o, "owned").inDeck = !o.owned.inDeck;
  }),
  // ---------- idle expeditions (M5) ----------
  r.on("time:resumed", (ev, ctx) => ctx.advance("idle", Math.min(ev.elapsed, MAX_ELAPSED_SECONDS))),
  r.on("expedition:send").check((ev, ctx) => {
    if (!DESTINATIONS.some((d) => d.id === ev.dest)) return `no destination "${ev.dest}"`;
    if (!ctx.derived("companions").includes(ev.who)) return `${ev.who} has not joined the shrine yet`;
    const trips = ctx.derived("trips");
    const name = CHARACTERS[ev.who as keyof typeof CHARACTERS]?.short ?? ev.who;
    if (trips.some((t) => t.expedition.who === ev.who)) return `${name} is already away`;
    return trips.length >= MAX_EXPEDITIONS ? `at most ${MAX_EXPEDITIONS} companions can be away at once` : undefined;
  }),
  r.on("expedition:send", (ev, ctx) => {
    const d = destination(ev.dest);
    const now = ctx.now("idle");
    const trip = ctx.spawn({ expedition: { who: ev.who, dest: d.id, startedAt: now, endsAt: now + d.seconds, back: false, pid: "" } }, "trip");
    ctx.mut(trip, "expedition").pid = ctx.start("expedition", { trip, seconds: d.seconds });
  }),
  r.on("expedition:returned", (ev, ctx) => void (ctx.mut(ev.trip, "expedition").back = true)),
  r.on("expedition:claim").check((ev, ctx) => (ctx.req(ev.trip, "expedition").expedition.back ? undefined : "they are not back yet")),
  r.on("expedition:claim", (ev, ctx) => {
    const d = destination(ctx.req(ev.trip, "expedition").expedition.dest);
    const w = ctx.derived("wallet");
    Object.assign(ctx.mut(w, "wallet"), { coins: w.wallet.coins + d.coins, lifetime: w.wallet.lifetime + d.coins });
    ctx.despawn(ev.trip);
  }),
  // Calling a companion home early forfeits the reward and cancels the waiting process.
  r.on("expedition:recall").check((ev, ctx) => (ctx.req(ev.trip, "expedition").expedition.back ? "they are already back: claim instead" : undefined)),
  r.on("expedition:recall", (ev, ctx) => {
    ctx.stop(ctx.req(ev.trip, "expedition").expedition.pid);
    ctx.despawn(ev.trip);
  }),

  r.on("cards:seen", (_, ctx) => {
    for (const o of ctx.derived("owned")) if (o.owned.fresh) ctx.mut(o, "owned").fresh = false;
  }),
]).migrations([
  // v0 -> v1: per-stage clears (stage 2 opens after stage 1). Old saves only had the one stage.
  (data) => ({
    ...data,
    entities: data.entities.map((e) => {
      const p = e.profile as { clears?: number } | undefined;
      return p ? { ...e, profile: { ...p, cleared: (p.clears ?? 0) > 0 ? ["lake"] : [] } } : e;
    }),
  }),
  // v1 -> v2: the shrine tree was rebuilt (flat bonuses, head starts): everything spent on the old one is refunded.
  (data) => {
    const tree = data.entities.find((e) => e.tree) as { tree: { levels: Record<string, number> } } | undefined;
    let refund = 0;
    for (const [id, lvl] of Object.entries(tree?.tree.levels ?? {})) refund += (OLD_TREE_COSTS[id] ?? []).slice(0, lvl).reduce((a, b) => a + b, 0);
    return {
      ...data,
      entities: data.entities.map((e) => {
        if (e.tree) return { ...e, tree: { levels: {} } };
        const w = e.wallet as { coins: number } | undefined;
        return w ? { ...e, wallet: { ...w, coins: w.coins + refund } } : e;
      }),
    };
  },
]);

/** The fixture for a new profile. */
export function newProfile(ctx: Ctx<MS>): void {
  ctx.spawn({ wallet: { coins: 0, lifetime: 0 } }, "wallet");
  ctx.spawn(
    { profile: { runs: 0, clears: 0, bestSeconds: 0, bestKills: 0, bestLevel: 0, totalKills: 0, activeRun: "", nextRun: 1, cleared: [] } },
    "profile",
  );
  ctx.spawn({ tree: { levels: {} } }, "tree");
  ctx.spawn({ gacha: { sinceHigh: 0, opened: 0, open: false } }, "gacha");
  for (const id of STARTER_CARDS) {
    cardDef(id);
    ctx.spawn({ owned: { card: id, level: 1, copies: 1, inDeck: true, fresh: false } }, "owned");
  }
}
