// The level-up overlay: a child scope of the run that holds the offer while
// the run's `game` clock is paused. The player picks by index (options() lists
// the legal picks, for the UI, hotkeys and bots); the overlay reports back to
// the run by sending it an event, and the run closes it (D51, D52).

import { z } from "zod";
import { defineScope, event, input } from "gamebones";
import { OfferChoice } from "./schemas.ts";
import { RunBase } from "./run.ts";

const LevelUpBase = defineScope("levelup", {
  components: {
    offer: z.strictObject({ choices: z.array(OfferChoice), rerolls: z.int(), level: z.int(), done: z.boolean() }),
  },
  events: {
    "levelup:show": event({ choices: z.array(OfferChoice), rerolls: z.int(), level: z.int() }),
    "levelup:pick": input({ index: z.int().min(0) }),
    "levelup:reroll": input(),
  },
})
  .derive({ offer: (v) => v.q("offer")[0] })
  .exports((v) => v.q("offer")[0]?.offer ?? null)
  .options({
    "levelup:pick": (v) => (v.q("offer")[0]?.offer.choices ?? []).map((_, index) => ({ index })),
    "levelup:reroll": (v) => {
      const o = v.q("offer")[0]?.offer;
      return o && o.rerolls > 0 && !o.done ? [{}] : [];
    },
  });

/** The parent of a scope path: "/run:3/levelup" -> "/run:3". */
export function parentPath(path: string): string {
  return path.slice(0, path.lastIndexOf("/")) || "/";
}

export const LevelUp: typeof LevelUpBase = LevelUpBase.rules((r) => [
  r.on("levelup:show", (ev, ctx) => {
    const cur = ctx.derived("offer");
    const value = { choices: ev.choices.map((c) => ({ ...c })), rerolls: ev.rerolls, level: ev.level, done: false };
    if (cur) Object.assign(ctx.mut(cur, "offer"), value);
    else ctx.spawn({ offer: value }, "offer");
  }),

  r.on("levelup:pick").check((ev, ctx) => {
    const o = ctx.derived("offer")?.offer;
    if (!o || o.done) return "no offer is open";
    return ev.index < o.choices.length ? undefined : `pick 0..${o.choices.length - 1}`;
  }),
  r.on("levelup:pick", (ev, ctx) => {
    ctx.mut(ctx.derived("offer")!, "offer").done = true;
    ctx.send(parentPath(ctx.path), RunBase, "levelup:picked", { index: ev.index });
  }),

  r.on("levelup:reroll").check((_, ctx) => {
    const o = ctx.derived("offer")?.offer;
    if (!o || o.done) return "no offer is open";
    return o.rerolls > 0 ? undefined : "no rerolls left";
  }),
  r.on("levelup:reroll", (_, ctx) => {
    ctx.mut(ctx.derived("offer")!, "offer").done = true;
    ctx.send(parentPath(ctx.path), RunBase, "levelup:reroll", {});
  }),
]);
