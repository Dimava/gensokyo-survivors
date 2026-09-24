// The player's death, Touhou style ("pichuun"), and the lighter revive. View
// only: the presenter starts it from the trace, it runs on wall time scaled by
// the anim-speed setting, and the only thing it asks of the simulation is to
// wait (the host holds the dead run's last tick until it has played, D56).
//
// Death: the field is already frozen (run:over stops the game clock). She
// flashes white while a ring closes on her, then bursts: a shockwave, star
// shards, her ribbon and amulets fluttering away, a shake, and the field
// drains to grey and dims before the ending overlay and the results.
// Revive: the same burst, smaller, then she rises back in a golden glow.

import { ColorMatrixFilter, Container, Graphics, Rectangle, type Ticker } from "pixi.js";
import { audio } from "./audio.ts";
import { prefs } from "./prefs.ts";
import type { Playfield } from "./renderer.ts";

type Where = () => { x: number; y: number } | null;

interface Piece {
  kind: "ribbon" | "amulet" | "shard";
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: number;
  phase: number;
  age: number;
  dur: number;
}

/** Death timeline, in seconds at anim speed 1. */
const DEATH = { burst: 0.32, sound: 0.75, grey: 0.9, dur: 1.6 };
/** Revive timeline. */
const REVIVE = { burst: 0.14, back: 0.4, dur: 1.15 };

const RED = 0xe8203a;
const GOLD = 0xffe08a;

function mat(f: ColorMatrixFilter, m: number[]): void {
  f.matrix = m as ColorMatrixFilter["matrix"];
}

/** White-out amount w (0..1): every channel pulled toward 1, alpha kept. */
function whiteMatrix(w: number): number[] {
  const k = 1 - w;
  return [k, 0, 0, 0, w, 0, k, 0, 0, w, 0, 0, k, 0, w, 0, 0, 0, 1, 0];
}

/** Desaturate by g (0..1) and scale brightness by b. */
function greyMatrix(g: number, b: number): number[] {
  const l = [0.299, 0.587, 0.114];
  const row = (i: number): number[] => [0, 1, 2].map((j) => b * ((1 - g) * (i === j ? 1 : 0) + g * l[j]!));
  return [...row(0), 0, 0, ...row(1), 0, 0, ...row(2), 0, 0, 0, 0, 0, 1, 0];
}

export class DeathFx {
  private layer = new Container();
  private g = new Graphics();
  private white = new ColorMatrixFilter();
  private grey = new ColorMatrixFilter();
  private pieces: Piece[] = [];
  private play: { kind: "death" | "revive"; where: Where; age: number; x: number; y: number; burst: boolean; sounded: boolean; finishAt: number } | null = null;
  /** The field is greyed until the dead run leaves the screen. */
  private greyed = false;
  private attached = false;

  constructor(private field: Playfield) {
    this.layer.addChild(this.g);
  }

  /** True while the death is still playing (the host holds the run's last tick). */
  holds(nowFixed: number): boolean {
    const p = this.play;
    return !!p && p.kind === "death" && p.age < DEATH.dur && nowFixed >= p.finishAt - 1;
  }

  /** Starts the death (the run ends at fixed tick `finishAt`) or a revive, at the player. */
  start(kind: "death" | "revive", where: Where, finishAt = 0): void {
    const at = where();
    if (!at || !this.field.ready) return;
    this.attach();
    this.play = { kind, where, age: 0, x: at.x, y: at.y, burst: false, sounded: false, finishAt };
    this.setPlayerWhite(0);
    // The closing ring: the moment before the burst.
    if (kind === "death") {
      this.field.ring(at.x, at.y, 110, 6, 0xffffff, DEATH.burst);
      this.field.flash(0xffffff, 0.25);
    } else this.field.ring(at.x, at.y, 70, 6, GOLD, REVIVE.burst);
  }

  private attach(): void {
    if (this.attached) return;
    this.attached = true;
    const stage = this.field.app.stage;
    stage.addChildAt(this.layer, stage.getChildIndex(this.field.fxNodes.world) + 1);
    this.field.app.ticker.add((t: Ticker) => this.update(Math.min(0.1, t.deltaMS / 1000)));
  }

  private setPlayerWhite(w: number): void {
    mat(this.white, whiteMatrix(w));
    for (const n of this.field.fxNodes.player) n.filters = w > 0 ? [this.white] : [];
  }

  private setGrey(g: number): void {
    mat(this.grey, greyMatrix(g, 1 - g * 0.45));
    this.greyed = g > 0;
    for (const n of this.field.fxNodes.scene) n.filters = g > 0 ? [this.grey] : [];
    if (g > 0) this.fitFilterArea();
  }

  /**
   * Particle containers report no bounds, so the filter's area is given: the
   * screen, in each node's own space (the world's moves with the camera).
   */
  private fitFilterArea(): void {
    const s = this.field.app.screen;
    const pad = 40;
    for (const n of this.field.fxNodes.scene) {
      const k = n.scale.x || 1;
      const r = (n.filterArea ??= new Rectangle());
      r.x = (-pad - n.position.x) / k;
      r.y = (-pad - n.position.y) / k;
      r.width = (s.width + pad * 2) / k;
      r.height = (s.height + pad * 2) / k;
    }
  }

  /** Clears everything (the dead run left the screen, or a new run began). */
  private reset(): void {
    this.play = null;
    this.pieces = [];
    this.g.clear();
    this.field.playerAlpha = null;
    this.setPlayerWhite(0);
    this.setGrey(0);
  }

  private burst(x: number, y: number, death: boolean): void {
    const f = this.field;
    const s = death ? 1 : 0.6;
    f.ring(x, y, 8, 260 * s, 0xffffff, 0.5);
    f.ring(x, y, 8, 170 * s, death ? RED : GOLD, 0.7);
    f.wave(x, y, 120 * s, 0xffffff, 0.35);
    f.burst(x, y, 0xffffff, Math.round(40 * s), 7, 1.4, true);
    f.burst(x, y, death ? RED : GOLD, Math.round(24 * s), 5, 1.1);
    f.shake(death ? 18 : 9);
    f.flash(0xffffff, death ? 0.7 : 0.5);
    audio.play("pichuun", { vol: death ? 1 : 0.6 });
    const add = (kind: Piece["kind"], n: number, color: number, w: number, h: number, speed: number): void => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.5 + Math.random() * 0.7);
        this.pieces.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.6, rot: a, vr: (Math.random() - 0.5) * 10, w, h, color, phase: Math.random() * 6, age: 0, dur: 0.9 + Math.random() * 0.5 });
      }
    };
    // Her bow in two halves, the amulets she carried, and glass-like shards.
    add("ribbon", death ? 2 : 1, RED, 22, 9, 3.2);
    add("amulet", death ? 7 : 3, 0xfff6e8, 9, 16, 4);
    add("shard", death ? 12 : 5, 0xffffff, 7, 7, 6);
  }

  private update(dt: number): void {
    const world = this.field.fxNodes.world;
    if (!world.visible) {
      if (this.play || this.greyed || this.pieces.length) this.reset();
      return;
    }
    const p = this.play;
    if (!p && !this.pieces.length) {
      this.g.clear();
      return;
    }
    const fdt = dt * prefs.animSpeed;
    this.layer.position.copyFrom(world.position);
    this.layer.scale.copyFrom(world.scale);
    const g = this.g;
    g.clear();
    if (p) {
      p.age += fdt;
      const at = p.where();
      if (at) {
        p.x = at.x;
        p.y = at.y;
      }
      if (p.kind === "death") this.stepDeath(p);
      else this.stepRevive(p);
    }
    this.stepPieces(fdt);
  }

  private stepDeath(p: NonNullable<DeathFx["play"]>): void {
    if (!p.burst) {
      // A frozen beat, then she whitens and swells a little before bursting.
      const k = p.age / DEATH.burst;
      this.setPlayerWhite(Math.min(1, k * 2.5));
      this.field.playerAlpha = 1;
      if (p.age >= DEATH.burst) {
        p.burst = true;
        this.setPlayerWhite(0);
        this.field.playerAlpha = 0;
        this.burst(p.x, p.y, true);
      }
      return;
    }
    this.field.playerAlpha = 0;
    if (!p.sounded && p.age >= DEATH.sound) {
      p.sounded = true;
      audio.play("death");
    }
    const k = Math.min(1, (p.age - DEATH.burst) / (DEATH.grey - DEATH.burst));
    this.setGrey(k * k * (3 - 2 * k) * 0.85);
    // Stay at the end: the grey holds until the run leaves the screen.
    if (p.age >= DEATH.dur) p.age = DEATH.dur;
  }

  private stepRevive(p: NonNullable<DeathFx["play"]>): void {
    const g = this.g;
    if (!p.burst) {
      this.setPlayerWhite(Math.min(1, p.age / REVIVE.burst));
      if (p.age >= REVIVE.burst) {
        p.burst = true;
        this.burst(p.x, p.y, false);
        this.field.playerAlpha = 0;
      }
      return;
    }
    if (p.age < REVIVE.back) {
      this.field.playerAlpha = 0;
      return;
    }
    // Rising back: she fades in from white inside a pillar of light.
    const k = Math.min(1, (p.age - REVIVE.back) / (REVIVE.dur - REVIVE.back));
    this.field.playerAlpha = Math.min(1, k * 3);
    this.setPlayerWhite(1 - k);
    const a = Math.sin(Math.PI * k);
    for (let i = 0; i < 4; i++) {
      const w = 60 - i * 13;
      g.rect(p.x - w / 2, p.y - 220 + (1 - k) * 60, w, 250).fill({ color: i === 3 ? 0xffffff : GOLD, alpha: 0.1 * a });
    }
    g.circle(p.x, p.y, 34 + 20 * k).fill({ color: GOLD, alpha: 0.22 * a });
    g.circle(p.x, p.y, 34 + 20 * k).stroke({ width: 2, color: 0xffffff, alpha: 0.6 * a });
    for (let i = 0; i < 6; i++) {
      const t = (k * 1.6 + i / 6) % 1;
      g.circle(p.x + Math.sin(i * 2.4 + k * 6) * 26, p.y + 20 - t * 110, 2.5).fill({ color: 0xffffff, alpha: a * (1 - t) });
    }
    if (p.age >= REVIVE.dur) {
      this.play = null;
      this.field.playerAlpha = null;
      this.setPlayerWhite(0);
    }
  }

  private stepPieces(fdt: number): void {
    const g = this.g;
    const f = fdt * 60;
    this.pieces = this.pieces.filter((q) => (q.age += fdt) < q.dur);
    for (const q of this.pieces) {
      // Paper flutters: drag, a little gravity, and a sideways sway.
      const drag = q.kind === "shard" ? 0.94 : 0.9;
      q.vx *= drag ** f;
      q.vy = q.vy * drag ** f + (q.kind === "shard" ? 0.05 : 0.09) * f;
      q.x += (q.vx + (q.kind === "shard" ? 0 : Math.sin(q.age * 7 + q.phase) * 1.2)) * f;
      q.y += q.vy * f;
      q.rot += q.vr * fdt;
      const k = q.age / q.dur;
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      // Flipping in 3D: the width breathes with the spin.
      const flip = q.kind === "shard" ? 1 : Math.abs(Math.cos(q.age * 9 + q.phase)) * 0.8 + 0.2;
      const c = Math.cos(q.rot);
      const s = Math.sin(q.rot);
      const hw = (q.w / 2) * flip;
      const hh = q.h / 2;
      const pt = (x: number, y: number): number[] => [q.x + x * c - y * s, q.y + x * s + y * c];
      if (q.kind === "shard") {
        g.poly([...pt(0, -hh), ...pt(hw, 0), ...pt(0, hh), ...pt(-hw, 0)]).fill({ color: q.color, alpha });
      } else {
        g.poly([...pt(-hw, -hh), ...pt(hw, -hh), ...pt(hw, hh), ...pt(-hw, hh)]).fill({ color: q.color, alpha });
        // An amulet's red seal; a ribbon's darker fold.
        if (q.kind === "amulet") g.poly([...pt(-hw * 0.6, -hh * 0.3), ...pt(hw * 0.6, -hh * 0.3), ...pt(hw * 0.6, hh * 0.3), ...pt(-hw * 0.6, hh * 0.3)]).fill({ color: RED, alpha });
        else g.poly([...pt(-hw * 0.2, -hh), ...pt(hw * 0.2, -hh), ...pt(hw * 0.2, hh), ...pt(-hw * 0.2, hh)]).fill({ color: 0x9a0f22, alpha });
      }
    }
  }
}
