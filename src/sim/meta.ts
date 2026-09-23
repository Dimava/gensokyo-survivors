// The meta scope: the root of the kernel, saved across runs and page
// reloads. It holds donations, the shrine tree, the card collection and
// deck, the gacha pity counter (with its own rng stream, so runs never shift
// the pack odds), records and the last run's results. A run is a child scope
// opened at `/run:<n>`; a pack opening is a child scope at `/pack`.

import { z } from "zod";
import { defineScope, event, input, type Ctx, type SpecOf, type View } from "gamebones";
import { CARDS, MAX_CARD_LEVEL, RARITIES, RARITY_INFO, STARTER_CARDS, cardDef, type Rarity } from "../content/cards.ts";
import { DECK_MAX, DECK_MIN, PACKS, packDef } from "../content/gacha.ts";
import { STAGES, stageDef } from "../content/stages.ts";
import { TREE, treeNode } from "../content/tree.ts";
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
    }),
    tree: z.strictObject({ levels: z.record(z.string(), int) }),
    owned: z.strictObject({ card: z.string(), level: int, copies: int, inDeck: z.boolean(), fresh: z.boolean() }),
    gacha: z.strictObject({ sinceHigh: int, opened: int, open: z.boolean() }),
    lastRun: z.strictObject({ summary: RunSummary, records: z.array(z.string()), run: int }),
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
  },
  rng: ["gacha"],
  children: { run: Run, pack: Pack },
}).derive({
  wallet: (v) => v.q("wallet")[0]!,
  profile: (v) => v.q("profile")[0]!,
  tree: (v) => v.q("tree")[0]!,
  gacha: (v) => v.q("gacha")[0]!,
  owned: (v) => v.q("owned"),
  deck: (v) => v.q("owned").filter((o) => o.owned.inDeck),
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

const MetaBase = MetaDecl.exports((v) => ({
  coins: v.derived("wallet").wallet.coins,
  activeRun: v.derived("profile").profile.activeRun,
}))
  .options({
    "run:start": (v) => (v.derived("profile").profile.activeRun ? [] : STAGES.map((s) => ({ stage: s.id }))),
    "tree:buy": (v) => TREE.filter((n) => nodeState(v, n.id) === "buyable").map((n) => ({ node: n.id })),
    "pack:buy": (v) =>
      v.derived("profile").profile.activeRun || v.derived("gacha").gacha.open
        ? []
        : PACKS.filter((p) => v.derived("wallet").wallet.coins >= p.cost).map((p) => ({ pack: p.id })),
    "deck:toggle": (v) => v.derived("owned").map((o) => ({ card: o.owned.card })),
  });

export { MetaBase };

const rank = (r: Rarity): number => RARITIES.indexOf(r);

export const Meta: typeof MetaBase = MetaBase.rules((r) => [
  // ---------- runs ----------
  r.on("run:start").check((ev, ctx) => {
    if (ctx.derived("profile").profile.activeRun) return "a run is already in progress";
    if (ctx.derived("deck").length < DECK_MIN) return `put at least ${DECK_MIN} card in your deck`;
    return STAGES.some((s) => s.id === ev.stage) ? undefined : `no stage "${ev.stage}"`;
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
    if (ev.outcome === "clear" && p.clears === 0) records.push("first clear");
    ctx.close(p.activeRun);
    Object.assign(ctx.mut(profile, "profile"), {
      activeRun: "",
      clears: p.clears + (ev.outcome === "clear" ? 1 : 0),
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
  r.on("cards:seen", (_, ctx) => {
    for (const o of ctx.derived("owned")) if (o.owned.fresh) ctx.mut(o, "owned").fresh = false;
  }),
]);

/** The fixture for a new profile. */
export function newProfile(ctx: Ctx<MS>): void {
  ctx.spawn({ wallet: { coins: 0, lifetime: 0 } }, "wallet");
  ctx.spawn(
    { profile: { runs: 0, clears: 0, bestSeconds: 0, bestKills: 0, bestLevel: 0, totalKills: 0, activeRun: "", nextRun: 1 } },
    "profile",
  );
  ctx.spawn({ tree: { levels: {} } }, "tree");
  ctx.spawn({ gacha: { sinceHigh: 0, opened: 0, open: false } }, "gacha");
  for (const id of STARTER_CARDS) {
    cardDef(id);
    ctx.spawn({ owned: { card: id, level: 1, copies: 1, inDeck: true, fresh: false } }, "owned");
  }
}
