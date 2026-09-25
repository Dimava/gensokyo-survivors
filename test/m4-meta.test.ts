// M4: meta progression. Donations from runs, the shrine tree (prerequisites,
// levels, costs) changing the next run, card packs with rarity and a pity
// counter on the meta scope's own rng stream, the deck, and saves that
// survive a reload (mid-run included).

import { describe, expect, test } from "bun:test";
import { canonicalJson, harness } from "gamebones";
import { activeRun, loadGame, runView } from "../src/sim/game.ts";
import { Pack } from "../src/sim/pack.ts";
import { PACKS } from "../src/content/gacha.ts";
import { RARITIES } from "../src/content/cards.ts";
import { fixtureGame, render } from "./helpers.ts";
import { renderPack, renderTree } from "../src/view/text-renderer.ts";

describe("M4 meta progression", () => {
  test("scripted: tree, deck, packs with pity, a run that uses the loadout, save and load", () => {
    const h = harness(() => fixtureGame("m4", { coins: 1500 }), { render, maxChanges: 8 });
    const k = h.kernel;

    // The tree: locked, poor and maxed nodes refuse with a reason.
    h.play("/", "tree:buy", { node: "weaponLevel" });
    expect(k.rejections.at(-1)?.reason).toBe("Practiced Throw needs Sharpened Ink first");
    h.play("/", "tree:buy", { node: "spark" });
    expect(k.rejections.at(-1)?.reason).toBe("Borrowed Hakkero needs 1 stage clear");
    h.play("/", "tree:buy", { node: "core" });
    h.play("/", "tree:buy", { node: "hp1" });
    h.play("/", "tree:buy", { node: "dmg1" });
    h.play("/", "tree:buy", { node: "weaponLevel" });
    expect(k.view().derived("tree").tree.levels).toMatchObject({ core: 1, hp1: 1, dmg1: 1, weaponLevel: 1 });
    h.play("/", "tree:buy", { node: "weaponLevel" });
    expect(k.rejections.at(-1)?.reason).toBe("Practiced Throw is fully upgraded");
    expect(k.options("/", "tree:buy").length).toBeGreaterThan(0);
    h.note(renderTree(k));

    // Packs: rarity rolls on the meta's own gacha stream, pity guarantees SR+ every 8 packs.
    const pity = PACKS[0]!.pity;
    let since = 0;
    let pityHit = false;
    for (let i = 0; i < 9; i++) {
      h.play("/", "pack:buy", { pack: "omikuji" });
      const opening = k.read("/pack", Pack)!;
      const high = opening.pulls.some((p) => RARITIES.indexOf(p.rarity) >= RARITIES.indexOf(pity.rarity));
      since = high ? 0 : since + 1;
      expect(since).toBeLessThan(pity.every);
      if (opening.pulls.some((p) => p.pity)) pityHit = true;
      if (i === 0) h.note(renderPack(k));
      // A second pack cannot open while one is on screen.
      if (i === 0) {
        h.play("/", "pack:buy", { pack: "omikuji" });
        expect(k.rejections.at(-1)?.reason).toBe("a pack is already open");
      }
      h.play("/pack", "pack:close", {});
    }
    h.note(`pity triggered during the nine packs: ${pityHit}`);
    expect(k.view().derived("gacha").gacha.opened).toBe(9);

    // The deck: new cards joined it while it had room; the limits refuse politely.
    const deck = k.view().derived("deck").map((o) => o.owned.card);
    expect(deck.length).toBeGreaterThan(3);
    for (const c of deck.slice(1)) h.quiet("/", "deck:toggle", { card: c });
    h.play("/", "deck:toggle", { card: deck[0]! });
    expect(k.rejections.at(-1)?.reason).toBe("the deck needs at least 1 card");
    for (const c of deck.slice(1)) h.quiet("/", "deck:toggle", { card: c });

    // A run starts with the tree's loadout: more HP, flat damage, the first weapon a level up.
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as "/run:1";
    const v = runView(k, path);
    expect(v.derived("stats").maxHp).toBe(100 + 10 + 15);
    expect(v.derived("stats").dmg).toBe(1);
    expect(v.derived("weapons")[0]!.weapon.level).toBe(2);
    k.queue(path, "move", { x: 70, y: 70 });
    h.tick(path, "fixed", 600);

    // Save mid-run, load it into a fresh kernel, and play both on: they stay identical.
    const save = JSON.parse(JSON.stringify(k.save()));
    const k2 = loadGame(save);
    expect(activeRun(k2)).toBe(path);
    for (const kk of [k, k2]) {
      kk.queue(path, "move", { x: -100, y: 0 });
      for (let i = 0; i < 300; i++) {
        kk.tick(path, "fixed");
        const ov = runView(kk, path).derived("state").run.overlay;
        if (ov === "levelup") kk.dispatch(`${path}/levelup` as "/run:1/levelup", "levelup:pick", { index: 0 });
      }
    }
    expect(canonicalJson(JSON.parse(JSON.stringify(k2.save())))).toBe(canonicalJson(JSON.parse(JSON.stringify(k.save()))));
    h.note(`save size mid-run: ${JSON.stringify(save).length} bytes`);

    // Quit the run: donations are paid out and the results are kept for the results screen.
    const before = k.view().derived("wallet").wallet.coins;
    h.play("/", "run:abandon", {});
    h.tick(path, "fixed", 1);
    expect(activeRun(k)).toBeNull();
    const last = k.view().q("lastRun")[0]!.lastRun;
    expect(last.summary.outcome).toBe("quit");
    expect(k.view().derived("wallet").wallet.coins).toBe(before + last.summary.coins.total);
    expect(h.transcript()).toMatchSnapshot();
    h.verifyReplay();

    // Meta survives a reload: the save loads and matches.
    const reloaded = loadGame(JSON.parse(JSON.stringify(k.save())));
    expect(canonicalJson(reloaded.save())).toBe(canonicalJson(k.save()));
  });

  test("pity: the eighth pack without a Super Rare is guaranteed one", () => {
    let forced = 0;
    for (let i = 0; i < 12; i++) {
      const k = fixtureGame(`pity-${i}`, { coins: 100, sinceHigh: PACKS[0]!.pity.every - 1 });
      k.dispatch("/", "pack:buy", { pack: "omikuji" });
      const pulls = k.read("/pack", Pack)!.pulls;
      expect(pulls.some((p) => RARITIES.indexOf(p.rarity) >= RARITIES.indexOf("SR"))).toBe(true);
      if (pulls.some((p) => p.pity)) forced++;
      expect(k.view().derived("gacha").gacha.sinceHigh).toBe(0);
    }
    // Most of these packs would have had no SR on their own; pity stepped in.
    expect(forced).toBeGreaterThan(6);
  });
});
