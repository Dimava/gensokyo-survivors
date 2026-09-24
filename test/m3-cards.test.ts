// M3: skill cards in the fight. Deck, hand and discard are one ordered
// relation; grazing draws; playing costs Spirit (computable) and is refused
// by a check rule when short; Power Charm works through a `modify` rule on
// weapon damage, Graze Ribbon through a triggers row stored on the player.

import { describe, expect, test } from "bun:test";
import { formatTrace, harness, type TraceNode } from "gamebones";
import { activeRun, runView } from "../src/sim/game.ts";
import { handCards, spiritAt } from "../src/sim/cards.ts";
import { botSteer, botPick, SKILL, type BotInputs } from "../src/sim/bot.ts";
import { weaponStats } from "../src/sim/weapons.ts";
import { fixtureGame, render } from "./helpers.ts";
import { renderHand } from "../src/view/text-renderer.ts";

function find(n: TraceNode, pred: (n: TraceNode) => boolean): TraceNode | undefined {
  if (pred(n)) return n;
  for (const c of n.children) {
    const f = find(c, pred);
    if (f) return f;
  }
  return undefined;
}

describe("M3 skill cards", () => {
  test("scripted playthrough: refused play, Power Charm (modify), Graze Ribbon (trigger), graze draws", () => {
    const h = harness(() => fixtureGame("m3", { cards: ["power-charm", "graze-ribbon"], onlyDeck: true }), { render, maxChanges: 8 });
    const k = h.kernel;
    h.play("/", "run:start", { stage: "lake" });
    const path = activeRun(k)! as "/run:1";
    const v = runView(k, path);
    const cardId = (name: string): string => v.q("card").find((c) => c.card.id === name)!.id;
    const hand = (): string[] => handCards(v).map((c) => v.req(c.id, "card").card.id);

    // The opening hand holds one card; Spirit starts at 1, both cards cost 2.
    expect(hand()).toHaveLength(1);
    h.note(renderHand(k, path));
    const first = hand()[0]!;
    h.play(path, "card:play", { card: cardId(first) });
    expect(k.rejections.at(-1)?.reason).toBe("needs 2 Spirit (you have 1)");
    // A card that is not in the hand is refused by the same check.
    const other = first === "power-charm" ? "graze-ribbon" : "power-charm";
    h.play(path, "card:play", { card: cardId(other) });
    expect(k.rejections.at(-1)?.reason).toContain("is not in your hand");

    // Spirit is computable: nothing ticks it; it is evaluated from { base, t0 }.
    h.tick(path, "fixed", 240);
    expect(spiritAt(v, v.now("action"))).toBeCloseTo(2, 5);

    // Bot steering from here on; it grazes the sunflower fairies' shots, which draws the second card.
    const last: BotInputs = { move: { x: 0, y: 0 } };
    const step = (): ReturnType<typeof k.tick> => {
      if (v.derived("state").run.overlay === "levelup") {
        k.dispatch(`${path}/levelup` as "/run:1/levelup", "levelup:pick", { index: botPick(k, path) });
      }
      botSteer(k, path, last, SKILL.expert);
      return k.tick(path, "fixed");
    };
    let guard = 0;
    while (hand().length < 2 && guard++ < 60 * 150) step();
    expect(hand().length).toBe(2);
    expect(v.derived("player").progress.grazes).toBeGreaterThan(0);
    h.note(renderHand(k, path));
    h.note(`the graze meter drew the second card after ${v.derived("player").progress.grazes} grazes`);
    while (spiritAt(v, v.now("action")) < 2) step();

    // Power Charm: a status the modify rule on weapon:fire reads.
    h.play(path, "card:play", { card: cardId("power-charm") });
    expect(v.has(v.derived("player"), "empowered")).toBe(true);
    let fire: TraceNode | undefined;
    for (let i = 0; i < 120 && !fire; i++) fire = find(step().trace, (n) => n.event === "weapon:fire");
    expect(fire).toBeDefined();
    const w = v.req((fire!.payload as { weapon: string }).weapon, "weapon").weapon;
    // The weapon's table damage, times might (a modify rule), times 1.5 (Power Charm, another modify rule).
    const might = v.derived("stats").might;
    const base = weaponStats(w.id, w.level).dmg;
    expect((fire!.payload as { dmg: number }).dmg).toBeCloseTo(base * might * 1.5, 6);
    h.note(`weapon:fire after Power Charm: ${JSON.stringify(fire!.payload)} (might ${might}, +50%)`);

    // Graze Ribbon: a triggers row on the player naming a registered rule (D19).
    while (spiritAt(v, v.now("action")) < 2 || !hand().includes("graze-ribbon")) step();
    h.play(path, "card:play", { card: cardId("graze-ribbon") });
    const pl = v.derived("player");
    expect(v.has(pl, "triggers") && pl.triggers.some((t) => t.rule === "grazeHeal")).toBe(true);
    let healed: TraceNode | undefined;
    for (let i = 0; i < 60 * 60 && !healed; i++) {
      const g = find(step().trace, (n) => n.event === "graze");
      healed = g && g.changes.some((c) => c.by === "grazeHeal") ? g : undefined;
    }
    expect(healed).toBeDefined();
    h.note("a graze under Graze Ribbon ran the trigger row's rule:");
    h.note(formatTrace(healed!));
    // It expires on its own (a scheduled status:expire removes the row).
    for (let i = 0; i < 60 * 35; i++) step();
    const after = v.derived("player");
    expect(v.has(after, "triggers") && after.triggers.some((t) => t.rule === "grazeHeal")).toBe(false);
    h.note(render(k));
    expect(h.transcript()).toMatchSnapshot();
    h.verifyReplay();
  }, 60_000);
});
