// The pack opening: a child scope of the meta scope that holds one opened
// pack's pulls for the reveal. The cards already joined the collection when
// the pack was bought (so a reload mid-reveal loses nothing); this scope only
// remembers what to show and reports back when the player is done.

import { z } from "zod";
import { defineScope, event, input } from "gamebones";
import { RARITIES } from "../content/cards.ts";
import { MetaBase } from "./meta.ts";

export const Pull = z.object({
  card: z.string(),
  rarity: z.enum(RARITIES as unknown as ["N", "R", "SR", "SSR"]),
  outcome: z.enum(["new", "level", "refund"]),
  level: z.int(),
  refund: z.int(),
  pity: z.boolean(),
});
export type Pull = z.output<typeof Pull>;

const PackBase = defineScope("pack", {
  components: { opening: z.strictObject({ pack: z.string(), pulls: z.array(Pull), done: z.boolean() }) },
  events: {
    "pack:show": event({ pack: z.string(), pulls: z.array(Pull) }),
    "pack:close": input(),
  },
}).exports((v) => v.q("opening")[0]?.opening ?? null);

export const Pack: typeof PackBase = PackBase.rules((r) => [
  r.on("pack:show", (ev, ctx) => void ctx.spawn({ opening: { pack: ev.pack, pulls: ev.pulls.map((p) => ({ ...p })), done: false } }, "opening")),
  r.on("pack:close").check((_, ctx) => (ctx.q("opening")[0]?.opening.done === false ? undefined : "nothing to close")),
  r.on("pack:close", (_, ctx) => {
    ctx.mut(ctx.q("opening")[0]!, "opening").done = true;
    ctx.send("/", MetaBase, "pack:closed", {});
  }),
]);
