// The presenter: turns each dispatch's trace tree into feedback (a game-side
// slice of the kernel's missing Director, D53). A table maps event names to
// effects; the renderer draws them, the synth plays them, and UI-level
// messages (banners, toasts) go to the Vue shell through `ui`.

import { reactive } from "vue";
import type { DispatchResult, TraceNode } from "gamebones";
import { ENEMIES } from "../content/enemies.ts";
import { cardDef } from "../content/cards.ts";
import { bossDef } from "../content/bosses.ts";
import { weaponDef, WEAPONS } from "../content/weapons.ts";
import { runView, type Game, type RunPath } from "../sim/game.ts";
import { audio, type Sfx } from "./audio.ts";
import type { Playfield } from "./renderer.ts";
import { CHARACTERS, type CharacterId } from "../content/names.ts";
import { destination } from "../content/expeditions.ts";

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
export const ui = reactive({ banners: [] as Banner[], toasts: [] as Toast[], cardFlash: null as null | { id: number; card: string } });

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

export class Presenter {
  /** Muted presenters (the title screen's attract mode) draw but make no sound or UI. */
  constructor(
    private field: Playfield,
    private quiet = false,
  ) {}

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
        f.wave(p.x as number, p.y as number, p.radius as number, 0xff5470, 0.4);
        f.shake(8);
        f.flash(0xffffff, 0.25);
        break;
      case "player:hurt":
        if (player) {
          f.burst(player.x, player.y, 0xff3355, 18, 4, 1.2);
          f.floater(player.x, player.y - 26, `-${Math.round(p.dmg as number)}`, 0xff5c7a);
        }
        f.flash(0xff2040, 0.35);
        f.shake(10);
        this.sfx("hurt");
        break;
      case "player:revived":
        if (player) f.ring(player.x, player.y, 10, 300, 0xffe08a, 0.8);
        f.flash(0xffffff, 0.6);
        this.sfx("revive");
        break;
      case "graze": {
        const n2 = p.n as number;
        f.burst(p.x as number, p.y as number, 0xffffff, Math.min(6, n2 * 2), 3, 0.5, true);
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
        if (player && (p.coins as number) > 0) f.floater(player.x + 18, player.y - 30, `+${p.coins} ¥`, 0xffc94d, 15);
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
          if (!this.quiet) {
            ui.cardFlash = { id: nextId++, card: def.id };
            banner(def.name, "spell", undefined, 1.6);
          }
          this.sfx("card");
          this.sfx(CARD_SFX[def.effect] ?? "chime");
          f.flash(0xffffff, 0.3);
          if (player) f.ring(player.x, player.y, 20, 160, 0xffffff, 0.5);
        }
        break;
      }
      case "banner":
        if (!this.quiet) banner(p.text as string, p.tone as Banner["tone"]);
        if (p.tone === "warn") this.sfx("warning", { vol: 0.6 });
        break;
      case "boss:approach":
        this.sfx("warning");
        break;
      case "boss:dialogue":
        // The dialogue takes the stage: clear the banners behind it.
        if (!this.quiet) ui.banners.splice(0);
        break;
      case "spell:start": {
        const boss = v?.derived("boss");
        if (boss) {
          const def = bossDef(boss.boss.id);
          const spell = def.spells[p.index as number]!;
          if (!this.quiet) banner(spell.name, "boss", `Spell card ${(p.index as number) + 1} of ${def.spells.length}`, 3.2);
          this.sfx("spell");
          f.flash(0x6fd3ff, 0.3);
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
          f.ring(player.x, player.y - 150, 20, 600, 0x6fd3ff, 1.2);
          f.burst(player.x, player.y - 150, 0x6fd3ff, 80, 8, 2, true);
        }
        this.sfx("bossDown");
        break;
      case "run:over":
        this.sfx(p.outcome === "clear" ? "clear" : p.outcome === "dead" ? "death" : "back");
        if (p.outcome === "dead") f.flash(0x000000, 0.4);
        break;
      case "levelup:pick":
        this.sfx("ui");
        break;
      case "vn:next":
        this.sfx("text");
        break;
      case "expedition:returned": {
        const trip = k.view().get(p.trip as string) as { expedition?: { who: string; dest: string } } | undefined;
        if (trip?.expedition && !this.quiet) {
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
