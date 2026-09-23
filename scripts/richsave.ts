// Writes a save of a well-upgraded profile (for browser tours that need to reach the boss quickly).
import { writeFileSync, mkdirSync } from "node:fs";
import { createKernel } from "gamebones";
import { Meta, newProfile } from "../src/sim/meta.ts";
import { MATH } from "../src/sim/game.ts";
const k = createKernel(Meta, {
  seed: "tour",
  math: MATH,
  setup: (ctx) => {
    newProfile(ctx);
    ctx.mut(ctx.q("wallet")[0]!, "wallet").coins = 900;
    ctx.mut(ctx.q("tree")[0]!, "tree").levels = { core: 3, might1: 3, hp1: 3, armor1: 2, regen1: 2, magnet1: 2, cooldown1: 2, area1: 1, spirit1: 2, graze1: 1, hand1: 1 };
    for (const id of ["power-charm", "master-spark", "pocket-watch"]) ctx.spawn({ owned: { card: id, level: 1, copies: 1, inDeck: true, fresh: true } }, "owned");
  },
});
mkdirSync(".tmp", { recursive: true });
writeFileSync(".tmp/save-rich.json", JSON.stringify(k.save()));
console.log("ok");
