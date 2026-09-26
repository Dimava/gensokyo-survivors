// The presenter: turns each dispatch's trace tree into feedback (a game-side
// slice of the kernel's missing Director, D53). A table maps event names to
// effects; the renderer draws them, the synth plays them, and UI-level
// messages (banners, toasts) go to the Vue shell through `ui`.

import { reactive } from "vue";
import type { DispatchResult, TraceNode } from "gamebones";
import { ENEMIES } from "../content/enemies.ts";
import { CARD_KINDS, cardDef } from "../content/cards.ts";
import { weaponDef, WEAPONS } from "../content/weapons.ts";
import { runView, type Game, type RunPath } from "../sim/game.ts";
import { audio, type Sfx } from "./audio.ts";
import type { Playfield } from "./renderer.ts";
import { CHARACTERS, type CharacterId } from "../content/names.ts";
import { bossDef } from "../content/bosses.ts";
import { EXPEDITIONS_ENABLED, destination } from "../content/expeditions.ts";
import { END_DELAY } from "../sim/tuning.ts";
import { DeathFx } from "./fx-death.ts";

export interface Banner {
  id: number;
  text: string;
  tone: "info" | "warn" | "boss" | "good" | "spell" | "bad";
  sub?: string;
}

export interface Toast {
  id: number;
  text: string;
  tone: "bad" | "good" | "info";
}

/** UI messages the Vue shell renders; each expires on its own. */
export const ui = reactive({
  banners: [] as Banner[],
  toasts: [] as Toast[],
  cardFlash: null as null | { id: number; card: string },
  /** The last level-up choice resolved by the sim (a pick index, or null for a reroll): LevelUpView animates the old cards out with it. */
  levelPick: null as null | { id: number; index: number | null },
});

let nextId = 1;

export function banner(text: string, tone: Banner["tone"], sub?: string, seconds = 2.6): void {
  const b: Banner = { id: nextId++, text, tone, sub };
  ui.banners.push(b);
  if (ui.banners.length > 3) ui.banners.shift();
  setTimeout(() => {
    const i = ui.banners.findIndex((x) => x.id === b.id);
    if (i >= 0) ui.banners.splice(i, 1);
  }, seconds * 1000);
}

export function toast(text: string, tone: Toast["tone"] = "bad", seconds = 2.2): void {
  const t: Toast = { id: nextId++, text, tone };
  ui.toasts.push(t);
  if (ui.toasts.length > 4) ui.toasts.shift();
  setTimeout(() => {
    const i = ui.toasts.findIndex((x) => x.id === t.id);
    if (i >= 0) ui.toasts.splice(i, 1);
  }, seconds * 1000);
}

const CARD_SFX: Record<string, Sfx> = {
  burst: "boom",
  clear: "chime",
  heal: "heal",
  empower: "power",
  grazeHeal: "chime",
  vengeance: "power",
  timeStop: "timestop",
  spark: "laser",
  gap: "whoosh",
  lastStand: "chime",
};

/**
 * Each card's own burst from the player when played, for cards whose effect
 * draws nothing by itself. Area cards (Fantasy Seal, Barrier), Master Spark
 * and Private Square show through their own events and the frozen world, so
 * they get none: one ring per card, never two. The burst is in the card's
 * kind colour (CARD_KINDS), the same as its badge in the hand and the cast plate.
 */
const CARD_FX: Record<string, { n: number; speed: number; star: boolean }> = {
  heal: { n: 16, speed: 2.2, star: true },
  empower: { n: 20, speed: 4, star: false },
  grazeHeal: { n: 14, speed: 2, star: true },
  vengeance: { n: 16, speed: 3, star: false },
  lastStand: { n: 18, speed: 2.5, star: true },
  // Gems flying in show the pull, but only when there are gems on screen.
  gap: { n: 24, speed: 6, star: false },
};

export class Presenter {
  /** Muted presenters (the title screen's attract mode) draw but make no sound or UI. */
  constructor(
    private field: Playfield,
    private quiet = false,
  ) {
    this.death = quiet ? null : new DeathFx(field);
  }

  /** The player's death and revive animation (fx-death.ts); none for muted presenters. */
  private death: DeathFx | null;

  /** True while the run's last tick must wait for the death animation (view time only; the sim is untouched). */
  holds(k: Game, path: RunPath): boolean {
    return !!this.death && k.paths().includes(path) && this.death.holds(runView(k, path).now("fixed"));
  }

  /** A death animation is playing and may be skipped. */
  deathSkippable(): boolean {
    return !!this.death?.skippable();
  }

  /** Jumps a playing death animation to its end; false if none was playing. */
  skipDeath(): boolean {
    return !!this.death?.skip();
  }

  /** Where the player of the run at `path` is now (null once the run is gone). */
  private playerAt(k: Game, path: RunPath | null): () => { x: number; y: number } | null {
    return () => (path && k.paths().includes(path) ? (runView(k, path).q("body")[0]?.body ?? null) : null);
  }

  consume(k: Game, path: RunPath | null, res: DispatchResult): void {
    for (const input of res.inputs ?? []) this.walk(k, path, input.trace);
    this.walk(k, path, res.trace);
  }

  private sfx(name: Sfx, opts?: { pitch?: number; vol?: number }): void {
    if (!this.quiet) audio.play(name, opts);
  }

  private walk(k: Game, path: RunPath | null, n: TraceNode): void {
    this.node(k, path, n);
    for (const c of n.children) this.walk(k, path, c);
  }

  private node(k: Game, path: RunPath | null, n: TraceNode): void {
    const f = this.field;
    const p = n.payload as Record<string, unknown>;
    if (n.rejected) {
      if (n.event === "card:play" || n.event === "tree:buy" || n.event === "pack:buy" || n.event === "deck:toggle" || n.event === "levelup:reroll" || n.event.startsWith("expedition:")) {
        this.sfx("deny");
        if (!this.quiet) toast(n.rejected.reason);
      }
      return;
    }
    const v = path && k.paths().includes(path) ? runView(k, path) : null;
    const player = v?.q("body")[0]?.body;
    switch (n.event) {
      case "weapon:fire": {
        const w = v?.get(p.weapon as string);
        const id = (w as { weapon?: { id: string } } | undefined)?.weapon?.id;
        if (id && weaponDef(id).behaviour === "fan") this.sfx("shoot", { pitch: 0.8 + WEAPONS.findIndex((x) => x.id === id) * 0.1 });
        break;
      }
      case "swarm:struck": {
        const xs = p.xs as number[];
        const ys = p.ys as number[];
        for (let i = 0; i < xs.length; i++) f.burst(xs[i]!, ys[i]!, 0xffffff, 2, 2, 0.6);
        this.sfx("hit");
        break;
      }
      case "enemies:died": {
        const xs = p.xs as number[];
        const ys = p.ys as number[];
        const kinds = p.kinds as number[];
        for (let i = 0; i < xs.length; i++) {
          const def = ENEMIES[kinds[i]!]!;
          f.burst(xs[i]!, ys[i]!, def.color, def.radius > 18 ? 16 : 6, def.radius > 18 ? 5 : 3, def.radius > 18 ? 1.6 : 1);
          if (def.radius > 18) {
            f.ring(xs[i]!, ys[i]!, 10, 80, def.color, 0.4);
            f.shake(4);
          }
        }
        this.sfx("pop", { pitch: 0.9 + Math.random() * 0.3 });
        break;
      }
      case "aura":
        f.wave(p.x as number, p.y as number, p.radius as number, p.color as number, 0.32);
        this.sfx("aura");
        break;
      case "beam":
        f.beam(p.x as number, p.y as number, p.dx as number, p.dy as number, p.length as number, p.width as number, p.color as number, p.source === "card" ? 0.8 : 0.4);
        f.shake(p.source === "card" ? 10 : 3);
        if (p.source !== "card") this.sfx("laser", { vol: 0.35 });
        break;
      case "blast":
        f.ring(p.x as number, p.y as number, 10, p.radius as number, 0xffe08a, 0.45);
        // Blasts come from attack cards (Fantasy Seal, Vengeful Amulet): the attack kind's colour.
        f.wave(p.x as number, p.y as number, p.radius as number, CARD_KINDS.attack.color, 0.4);
        f.shake(8);
        f.flash(0xffffff, 0.25);
        break;
      case "player:hurt":
        if (player) {
          f.burst(player.x, player.y, 0xff3355, 18, 4, 1.2);
          f.floater(player.x, player.y - 26, `-${Math.round(p.dmg as number)}`, 0xf0604a);
        }
        f.flash(0xff2040, 0.35);
        f.shake(10);
        this.sfx("hurt");
        break;
      case "player:revived":
        if (this.death) this.death.start("revive", this.playerAt(k, path));
        else if (player) f.ring(player.x, player.y, 10, 300, 0xffe08a, 0.8);
        f.flash(0xffffff, 0.6);
        this.sfx("revive");
        break;
      case "graze": {
        const n2 = p.n as number;
        f.burst(p.x as number, p.y as number, 0xffffff, Math.min(6, n2 * 2), 3, 0.5, true);
        f.grazeFlash();
        this.sfx("graze");
        break;
      }
      case "bullets:erase":
        if ((p.radius as number) < 1e5) f.ring(p.x as number, p.y as number, 20, p.radius as number, 0xb6f0ff, 0.5);
        else f.flash(0xb6f0ff, 0.25);
        break;
      case "drops:collected": {
        if ((p.coins as number) > 0) this.sfx("coin");
        if ((p.hearts as number) > 0) this.sfx("heart");
        if ((p.xp as number) > 0) this.sfx("pickup");
        if (player && (p.coins as number) > 0) f.floater(player.x + 18, player.y - 30, `+${p.coins} ¥`, 0xe8c15a, 15);
        break;
      }
      case "level:up":
        if (player) f.ring(player.x, player.y, 10, 140, 0x7bd88f, 0.6);
        this.sfx("levelup");
        break;
      case "card:drawn":
        this.sfx("draw");
        break;
      case "card:played": {
        const card = v?.get(p.card as string) as { card?: { id: string; effect: string } } | undefined;
        if (card?.card) {
          const def = cardDef(card.card.id);
          // The card's name rises from the hand (HudView), not a banner over the field.
          if (!this.quiet) {
            const flash = { id: nextId++, card: def.id };
            ui.cardFlash = flash;
            setTimeout(() => {
              // By id: reading through the reactive `ui` returns a proxy, never `flash` itself.
              if (ui.cardFlash?.id === flash.id) ui.cardFlash = null;
            }, 1200);
          }
          this.sfx("card");
          this.sfx(CARD_SFX[def.effect] ?? "chime");
          const fx = CARD_FX[def.effect];
          if (fx && player) f.burst(player.x, player.y, CARD_KINDS[def.kind].color, fx.n, fx.speed, 1, fx.star);
        }
        break;
      }
      case "banner":
        if (!this.quiet) banner(p.text as string, p.tone as Banner["tone"]);
        if (p.tone === "warn") this.sfx("warning", { vol: 0.6 });
        break;
      case "boss:approach":
        this.sfx("warning");
        if (!this.quiet) audio.gust();
        break;
      case "boss:dialogue":
        // The dialogue takes the stage: clear the banners behind it.
        if (!this.quiet) ui.banners.splice(0);
        break;
      case "spell:start": {
        const boss = v?.derived("boss");
        if (boss) {
          // The name bar (SpellBar) and the cut-in (SpellCutIn) declare the card; the last
          // card's result banner makes way, or her portrait would sweep across its words.
          if (!this.quiet) ui.banners.splice(0);
          this.sfx("spell");
          // The declaration flashes in the boss's own colour (Rumia's near-black reads as violet, as her spell circle does).
          const c = CHARACTERS[bossDef(boss.boss.id).character].color;
          f.flash(c === 0x2b2238 ? 0xb9a6ff : c, 0.3);
        }
        break;
      }
      case "spell:break": {
        const boss = v?.derived("boss");
        const res = boss?.boss.results[p.index as number];
        if (!this.quiet) {
          if (res === "captured") banner("Spell Card Captured!", "good", "Bonus doubled: no hits taken");
          else if (res === "broken") banner("Spell Card Bonus!", "good");
          else banner("Spell Card Broken", "info", "Too late for the bonus");
        }
        this.sfx("spellBreak");
        if (!this.quiet && res) audio.flourish(res);
        f.flash(0xffffff, 0.5);
        f.shake(12);
        break;
      }
      case "spell:late":
        if (!this.quiet) banner("Bonus Failed", "bad", "Time is up: break the spell card anyway to go on");
        this.sfx("back");
        break;
      case "boss:defeated":
        f.flash(0xffffff, 0.9);
        f.shake(22);
        if (player) {
          f.ring(player.x, player.y - 150, 20, 600, 0xe8c15a, 1.2);
          f.burst(player.x, player.y - 150, 0xf0e6cc, 80, 8, 2, true);
        }
        this.sfx("bossDown");
        break;
      case "run:over":
        // A death plays its own animation and sounds (fx-death.ts); the run ends END_DELAY ticks later.
        if (p.outcome === "dead" && this.death && v) this.death.start("death", this.playerAt(k, path), v.now("fixed") + END_DELAY);
        else {
          this.sfx(p.outcome === "clear" ? "clear" : p.outcome === "dead" ? "death" : "back");
          if (p.outcome === "dead") f.flash(0x000000, 0.4);
        }
        break;
      case "levelup:pick":
        if (!this.quiet) ui.levelPick = { id: nextId++, index: p.index as number };
        this.sfx("ui");
        break;
      case "levelup:reroll":
        if (!this.quiet) ui.levelPick = { id: nextId++, index: null };
        break;
      case "vn:next":
        this.sfx("text");
        break;
      case "expedition:returned": {
        const trip = k.view().get(p.trip as string) as { expedition?: { who: string; dest: string } } | undefined;
        if (trip?.expedition && EXPEDITIONS_ENABLED && !this.quiet) {
          const who = CHARACTERS[trip.expedition.who as CharacterId]?.short ?? trip.expedition.who;
          toast(`${who} is back from ${destination(trip.expedition.dest).name}: claim the donations in Expeditions`, "good", 4);
          this.sfx("chime");
        }
        break;
      }
      case "expedition:send":
        this.sfx("whoosh");
        break;
      case "expedition:claim":
        this.sfx("buy");
        break;
      case "expedition:recall":
        this.sfx("back");
        break;
      case "tree:buy":
        this.sfx("buy");
        break;
      case "deck:toggle":
        this.sfx("ui");
        break;
      case "timestop:end":
        this.sfx("timestop", { vol: 0.5 });
        break;
    }
  }
}
