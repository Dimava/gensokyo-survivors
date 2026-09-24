// M5 (stretch): idle expeditions. Real time enters the simulation only as an
// input payload (`time:resumed { elapsed }`) that advances an elapsed clock;
// each expedition is a process sleeping on it, so offline catch-up is exact.

import { describe, expect, test } from "bun:test";
import { harness } from "gamebones";
import { destination } from "../src/content/expeditions.ts";
import { loadGame } from "../src/sim/game.ts";
import { fixtureGame, render } from "./helpers.ts";

describe("M5 idle expeditions", () => {
  test("send, come back after real time, claim; refusals; recall", () => {
    const h = harness(() => fixtureGame("m5", { cards: ["power-charm", "gap"] }), { render });
    const k = h.kernel;
    const v = k.view();
    expect([...v.derived("companions")].sort()).toEqual(["daiyousei", "marisa", "yukari"]);
    h.play("/", "expedition:send", { who: "reimu", dest: "errand" });
    expect(k.rejections.at(-1)?.reason).toBe("reimu has not joined the shrine yet");
    h.play("/", "expedition:send", { who: "marisa", dest: "village" });
    h.play("/", "expedition:send", { who: "marisa", dest: "errand" });
    expect(k.rejections.at(-1)?.reason).toBe("Marisa is already away");
    h.play("/", "expedition:send", { who: "daiyousei", dest: "errand" });
    h.play("/", "expedition:send", { who: "yukari", dest: "festival" });
    const trips = () => v.derived("trips").map((t) => `${t.expedition.who}:${t.expedition.back ? "back" : "away"}`);
    const tripOf = (who: string) => v.derived("trips").find((t) => t.expedition.who === who)!.id;

    // The game was closed for 10 minutes: the errand is back, the village trip is not.
    h.play("/", "time:resumed", { elapsed: 600 });
    expect(trips()).toEqual(["marisa:away", "daiyousei:back", "yukari:away"]);
    h.play("/", "expedition:claim", { trip: tripOf("marisa") });
    expect(k.rejections.at(-1)?.reason).toBe("they are not back yet");
    const coins = v.derived("wallet").wallet.coins;
    h.play("/", "expedition:claim", { trip: tripOf("daiyousei") });
    expect(v.derived("wallet").wallet.coins).toBe(coins + destination("errand").coins);

    // Called home early: no reward, and the process is cancelled.
    h.play("/", "expedition:recall", { trip: tripOf("yukari") });
    // A whole day passes in one resume; the village trip returns exactly at its own wake tick.
    h.play("/", "time:resumed", { elapsed: 24 * 3600 });
    expect(trips()).toEqual(["marisa:back"]);
    expect(v.now("idle")).toBe(600 + 24 * 3600);
    h.play("/", "expedition:claim", { trip: tripOf("marisa") });
    expect(trips()).toEqual([]);
    expect(h.transcript()).toMatchSnapshot();
    h.verifyReplay();
  });
});

describe("M5 second stage", () => {
  test("the forest opens after the lake is cleared; an old save migrates its clears", () => {
    const k = fixtureGame("m5-stage");
    const res = k.dispatch("/", "run:start", { stage: "forest" });
    expect(res.ok).toBe(false);
    expect(k.rejections.at(-1)?.reason).toBe("clear Misty Lake first");
    expect(k.options("/", "run:start").map((o) => o.stage)).toEqual(["lake"]);

    // A version-0 save (before per-stage clears) with one clear loads with the lake cleared.
    const save = JSON.parse(JSON.stringify(k.save()));
    save.scopes["/"].version = 0;
    for (const e of save.scopes["/"].entities) {
      if (e.profile) {
        delete e.profile.cleared;
        e.profile.clears = 1;
      }
    }
    const k2 = loadGame(save);
    expect(k2.view().derived("profile").profile.cleared).toEqual(["lake"]);
    expect(k2.options("/", "run:start").map((o) => o.stage)).toEqual(["lake", "forest"]);
    expect(k2.dispatch("/", "run:start", { stage: "forest" }).ok).toBe(true);
  });
});
