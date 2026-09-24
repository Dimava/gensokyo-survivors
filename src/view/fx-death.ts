// The player's death, Touhou style ("pichuun"), and the lighter revive. View
// only: the presenter starts it from the trace, it runs on wall time scaled by
// the anim-speed setting, and the only thing it asks of the simulation is to
// wait (the host holds the dead run's last tick until it has played, D56).
//
// Death: the field is already frozen (run:over stops the game clock). She
// flashes white while a ring closes on her, then bursts: a shockwave, star
// shards, her ribbon and amulets fluttering away, a shake, two echo rings,
// and the field drains to grey and darkens toward the edges while a soft
// afterglow lingers where she stood, before the results.
// Revive: the same burst, smaller, then she rises back in a golden glow.
//
// A Live2D Reimu never vanishes, she acts it out (renderer.ts playerKO, the
// animator's recoil and down poses): a hit-stop freezes her in a white-flashed
// recoil with speed lines round her; the burst launches her up and back in a
// slow-motion arc, tumbling, hair and sleeves whipping; she lands hard with a
// bounce and a puff of dust and lies limp, eyes shut, while the camera, which
// punched in on the hit, eases back. She is lifted out of the grey (she stays
// bright in a pool of light) and the burst flies outward, under her. On a
// revive she is knocked down, then rises in a golden pillar, floats up and
// lands upright in a gold burst.
//
// A death plays slowly; any fresh key, click or tap skips it to its end (host.ts).

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
  /** Time scale: a death's pieces drift in slow motion. */
  ts: number;
}

/** Death timeline (drawn player), in seconds at anim speed 1. `grace`: too soon to skip (a key meant for the run). */
const DEATH = { burst: 0.55, sound: 1.3, grey: 1.7, dur: 2.9, grace: 0.3 };
/**
 * A live rig's death: `snap` into the recoil, the hit-stop freeze until
 * `burst` (she is launched), the landing, the field grey by `grey`.
 */
const KO = { snap: 0.06, burst: 0.34, land: 1.3, grey: 2.2, dur: 3.0, grace: 0.3 };
/** The knock-back arc (world px; she is 52 tall): peak height, distance. */
const ARC = { height: 58, dist: 62 };
/** Camera punch-in: on the hit, at the arc's peak, on landing, and where it rests. */
const PUNCH = { hit: 1.3, peak: 1.5, land: 1.58, rest: 1.42 };
/** A death's burst and pieces run this much slower than a revive's. */
const DEATH_SLOW = 1.7;
/** Revive timeline (drawn player). */
const REVIVE = { burst: 0.14, back: 0.4, dur: 1.15 };
/** A live rig's revive: hit-stop, knocked down, lying, rising (floating up), landing upright. */
const REVIVE_KO = { burst: 0.12, fall: 0.42, rise: 0.62, top: 1.3, dur: 1.6 };
/** Lying on her side (radians, the renderer's default for down = 1). */
const LIE = 1.45;

const RED = 0xe8203a;
const GOLD = 0xffe08a;

/** Smoothstep of k, clamped to 0..1. */
function smooth(k: number): number {
  const t = Math.max(0, Math.min(1, k));
  return t * t * (3 - 2 * t);
}

/** Bounces after a landing, s seconds since it: a big one, then a small one (0..1). */
function bounce(s: number): number {
  if (s < 0) return 0;
  if (s < 0.26) return Math.sin((Math.PI * s) / 0.26);
  if (s < 0.42) return 0.3 * Math.sin((Math.PI * (s - 0.26)) / 0.16);
  return 0;
}

/**
 * Slow motion through the flight: progress along the arc at time fraction u,
 * fast off the ground and back into it, slowest at the top (its rate is the
 * derivative, 1 + SLOWMO cos 2 pi u).
 */
const SLOWMO = 0.72;
function arcTime(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return t + (SLOWMO * Math.sin(2 * Math.PI * t)) / (2 * Math.PI);
}

function mat(f: ColorMatrixFilter, m: number[]): void {
  f.matrix = m as ColorMatrixFilter["matrix"];
}

/** Wash amount w (0..1) toward a colour: every channel pulled toward it, alpha kept (white: a white-out). */
function washMatrix(w: number, color = 0xffffff): number[] {
  const k = 1 - w;
  const c = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map((v) => (v / 255) * w);
  return [k, 0, 0, 0, c[0]!, 0, k, 0, 0, c[1]!, 0, 0, k, 0, c[2]!, 0, 0, 0, 1, 0];
}

/** Desaturate by g (0..1) and scale brightness by b. */
function greyMatrix(g: number, b: number): number[] {
  const l = [0.299, 0.587, 0.114];
  const row = (i: number): number[] => [0, 1, 2].map((j) => b * ((1 - g) * (i === j ? 1 : 0) + g * l[j]!));
  return [...row(0), 0, 0, ...row(1), 0, 0, ...row(2), 0, 0, 0, 0, 0, 1, 0];
}

type Play = {
  kind: "death" | "revive";
  /** Acted by the live rig (else the drawn sprite's old fade). */
  live: boolean;
  where: Where;
  age: number;
  x: number;
  y: number;
  burst: boolean;
  landed: boolean;
  sounded: boolean;
  finishAt: number;
  echoes: number;
  /** The speed lines' angles, fixed for the play. */
  lines: number[];
};

export class DeathFx {
  private layer = new Container();
  private g = new Graphics();
  // At the screen's resolution: the default (1x) would blur her on hi-DPI screens.
  private white = new ColorMatrixFilter({ resolution: "inherit", antialias: "inherit" });
  private grey = new ColorMatrixFilter();
  private pieces: Piece[] = [];
  private play: Play | null = null;
  /** The field is greyed until the dead run leaves the screen. */
  private greyed = false;
  private attached = false;

  constructor(private field: Playfield) {
    this.layer.addChild(this.g);
  }

  private dur(p: Play): number {
    return p.live ? KO.dur : DEATH.dur;
  }

  /** True while the death is still playing (the host holds the run's last tick). */
  holds(nowFixed: number): boolean {
    const p = this.play;
    return !!p && p.kind === "death" && p.age < this.dur(p) && nowFixed >= p.finishAt - 1;
  }

  /** A death is playing and may be skipped (past its first moment). */
  skippable(): boolean {
    const p = this.play;
    return !!p && p.kind === "death" && p.age >= (p.live ? KO.grace : DEATH.grace) && p.age < this.dur(p);
  }

  /** Jumps a playing death to its end: burst done, pieces gone, the field grey. False if none. */
  skip(): boolean {
    const p = this.play;
    if (!p || p.kind !== "death" || p.age >= this.dur(p)) return false;
    p.burst = true;
    p.landed = true;
    p.sounded = true;
    p.echoes = 2;
    p.age = this.dur(p);
    this.pieces = [];
    if (p.live) this.lying(1, 0, 0);
    else this.gone(1);
    this.field.koZoom = p.live ? PUNCH.rest : 1;
    this.setPlayerWash(0);
    this.setGrey(0.85);
    return true;
  }

  /** Starts the death (the run ends at fixed tick `finishAt`) or a revive, at the player. */
  start(kind: "death" | "revive", where: Where, finishAt = 0): void {
    const at = where();
    if (!at || !this.field.ready) return;
    this.attach();
    const live = this.field.livePlayer;
    const lines = Array.from({ length: 30 }, (_, i) => ((i + Math.random() * 0.8) / 30) * Math.PI * 2);
    this.play = { kind, live, where, age: 0, x: at.x, y: at.y, burst: false, landed: false, sounded: false, finishAt, echoes: 0, lines };
    this.setPlayerWash(0);
    // The closing ring: the moment before the burst.
    if (kind === "death") {
      const t = live ? KO.burst : DEATH.burst;
      this.field.ring(at.x, at.y, 110, 6, 0xffffff, t);
      this.field.ring(at.x, at.y, 170, 10, RED, t * 0.9);
      this.field.flash(live ? RED : 0xffffff, 0.3);
      this.field.shake(live ? 9 : 5);
    } else this.field.ring(at.x, at.y, 70, 6, GOLD, REVIVE.burst);
  }

  private attach(): void {
    if (this.attached) return;
    this.attached = true;
    const stage = this.field.app.stage;
    stage.addChildAt(this.layer, stage.getChildIndex(this.field.fxNodes.world) + 1);
    this.field.app.ticker.add((t: Ticker) => this.update(Math.min(0.1, t.deltaMS / 1000)));
  }

  private setPlayerWash(w: number, color = 0xffffff): void {
    mat(this.white, washMatrix(w, color));
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
    this.field.playerKO = null;
    this.field.koZoom = 1;
    this.setPlayerWash(0);
    this.setGrey(0);
  }

  /**
   * She is struck out: a drawn sprite vanishes, a live rig stays and lies
   * `down` (0..1) instead, flinching by `recoil`.
   */
  private gone(down: number, recoil = 0): void {
    if (this.field.livePlayer) {
      this.field.playerAlpha = 1;
      this.field.playerKO = { down, recoil };
    } else this.field.playerAlpha = 0;
  }

  /** A live rig at the end of the knock-back: lying where she landed, bounced `b` (0..1) off the ground. */
  private lying(down: number, recoil: number, b: number): void {
    this.field.playerAlpha = 1;
    this.field.playerKO = { down, recoil, turn: LIE - 0.12 * b, lift: 14 * b, slide: ARC.dist, rate: 1 };
  }

  /** Where she lies after a death's knock-back (her middle), in world px. */
  private restSpot(p: Play): { x: number; y: number } {
    if (!p.live) return p;
    return { x: p.x + this.field.knockSide * (ARC.dist + 6), y: p.y + 10 };
  }

  private burst(x: number, y: number, death: boolean): void {
    const f = this.field;
    const s = death ? 1 : 0.6;
    const slow = death ? DEATH_SLOW : 1;
    f.ring(x, y, 8, 260 * s, 0xffffff, 0.5 * slow);
    f.ring(x, y, 8, 170 * s, death ? RED : GOLD, 0.7 * slow);
    f.wave(x, y, 120 * s, 0xffffff, 0.35 * slow);
    f.burst(x, y, 0xffffff, Math.round((death ? 70 : 40) * s), 7, 1.4, true);
    f.burst(x, y, death ? RED : GOLD, Math.round((death ? 44 : 24) * s), 5, 1.1);
    if (death) f.burst(x, y, 0xff9ab8, 26, 3, 1.8, true);
    f.shake(death ? 26 : 9);
    // A live rig's flash is lighter: she must stay in sight as she is launched.
    f.flash(0xffffff, death ? (f.livePlayer ? 0.5 : 0.85) : 0.5);
    audio.play("pichuun", { vol: death ? 1 : 0.6 });
    // A live rig stays on screen: the pieces start clear of her and fly outward, so they don't hide her.
    const live = f.livePlayer;
    const r0 = live ? 30 : 0;
    const add = (kind: Piece["kind"], n: number, color: number, w: number, h: number, speed: number): void => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (live ? 0.9 + Math.random() * 0.6 : 0.5 + Math.random() * 0.7);
        const up = live ? speed * 0.15 : speed * 0.6;
        this.pieces.push({ kind, x: x + Math.cos(a) * r0, y: y + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, rot: a, vr: (Math.random() - 0.5) * 10, w, h, color, phase: Math.random() * 6, age: 0, dur: 0.9 + Math.random() * 0.5, ts: 1 / slow });
      }
    };
    // Her bow in two halves, the amulets she carried, and glass-like shards.
    add("ribbon", death ? 2 : 1, RED, 22, 9, 3.2);
    add("amulet", death ? 12 : 3, 0xfff6e8, 9, 16, 4);
    add("shard", death ? 16 : 5, 0xffffff, 7, 7, 6);
    if (death) add("shard", 10, 0xff9ab8, 11, 11, 4.5);
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
      if (p.kind === "death") {
        if (p.live) this.stepKO(p);
        else this.stepDeath(p);
      } else if (p.live) this.stepReviveKO(p);
      else this.stepRevive(p);
    }
    this.stepPieces(fdt);
  }

  /** Drawn player: she whitens, bursts and is gone. */
  private stepDeath(p: Play): void {
    if (!p.burst) {
      // A frozen beat, then she whitens and swells a little before bursting.
      this.setPlayerWash(Math.min(1, (p.age / DEATH.burst) * 2.5));
      this.field.playerAlpha = 1;
      if (p.age >= DEATH.burst) {
        p.burst = true;
        this.setPlayerWash(0);
        this.gone(0);
        this.burst(p.x, p.y, true);
      }
      return;
    }
    this.gone(1);
    if (!p.sounded && p.age >= DEATH.sound) {
      p.sounded = true;
      audio.play("death");
    }
    const since = p.age - DEATH.burst;
    this.echo(p, since);
    const ease = smooth(since / (DEATH.grey - DEATH.burst));
    this.setGrey(ease * 0.85);
    this.drawAftermath(p.x, p.y, since, ease);
    // Stay at the end: the grey holds until the run leaves the screen.
    if (p.age >= DEATH.dur) p.age = DEATH.dur;
  }

  /** Two echo rings after the burst, wider and slower. */
  private echo(p: Play, since: number): void {
    const ECHO = [0.22, 0.5];
    if (p.echoes < ECHO.length && since >= ECHO[p.echoes]!) {
      const e = p.echoes++;
      this.field.ring(p.x, p.y, 20, 380 + e * 140, 0xffffff, 1 + e * 0.3);
      this.field.ring(p.x, p.y, 10, 300 + e * 120, RED, 1.2 + e * 0.3);
      if (e === 0) this.field.shake(10);
    }
  }

  /** Live rig: hit-stop, knock-back arc, landing, lying still. */
  private stepKO(p: Play): void {
    const f = this.field;
    const a = p.age;
    const side = f.knockSide;
    f.playerAlpha = 1;
    if (a < KO.burst) {
      // Hit-stop: she snaps into the recoil and freezes there, flashing white, the speed lines round her.
      const snap = a < KO.snap;
      const k = (a - KO.snap) / (KO.burst - KO.snap);
      this.setPlayerWash(snap ? 1 : Math.floor(a / 0.045) % 2 ? 0.3 : 0.95 * (1 - k * 0.35));
      f.playerKO = { down: 0, recoil: 1, turn: -0.22 * smooth(a / KO.snap), lift: 6 * smooth(a / KO.snap), slide: 0, rate: snap ? 1 : 0 };
      f.koZoom = 1 + (PUNCH.hit - 1) * smooth(a / 0.08);
      this.drawHitStop(p, a / KO.burst);
      return;
    }
    if (!p.burst) {
      p.burst = true;
      this.setPlayerWash(0);
      this.burst(p.x, p.y, true);
    }
    const since = a - KO.burst;
    this.echo(p, since);
    if (a < KO.land) {
      // Launched: up and back along an arc, tumbling toward her side, in slow motion at the top.
      const u = since / (KO.land - KO.burst);
      const w = arcTime(u);
      const rate = Math.max(0.3, Math.min(1, 1 + SLOWMO * Math.cos(2 * Math.PI * u)));
      const turn = -0.22 + (LIE + 0.22) * w + 0.5 * Math.sin(Math.PI * w);
      const lift = ARC.height * 4 * w * (1 - w);
      f.playerKO = { down: 0.55 * smooth((w - 0.3) / 0.7), recoil: 1 - 0.6 * smooth(w), turn, lift, slide: ARC.dist * w, rate };
      f.koZoom = PUNCH.hit + (PUNCH.peak - PUNCH.hit) * Math.sin(Math.PI * Math.min(1, u * 1.6) * 0.5);
      // A trail of sparks where she flies.
      const cx = p.x + side * ARC.dist * w;
      const cy = p.y - lift;
      if (Math.random() < 0.8) f.burst(cx, cy, Math.random() < 0.5 ? 0xffffff : 0xff9ab8, 2, 0.8, 1.1, true);
      this.drawAftermath(p.x, p.y, since, 0.35 * smooth(since / 0.2));
      return;
    }
    const s = a - KO.land;
    const rest = this.restSpot(p);
    if (!p.landed) {
      // The landing: a heavy thud, a puff of dust and petals, a shake.
      p.landed = true;
      const fx = p.x + side * ARC.dist;
      const fy = p.y + 14;
      f.burst(fx, fy, 0xd9c7a8, 30, 3.2, 1.3);
      f.burst(rest.x, fy, 0xff9ab8, 18, 2.4, 1.5, true);
      f.burst(rest.x, fy, 0xffffff, 14, 4, 1.1, true);
      f.ring(rest.x, fy, 8, 110, 0xffffff, 0.45);
      f.wave(rest.x, fy, 70, 0xd9c7a8, 0.35);
      f.shake(16);
      f.flash(0xffffff, 0.18);
    }
    if (!p.sounded && a >= KO.land) {
      p.sounded = true;
      audio.play("death");
    }
    const b = bounce(s);
    this.lying(0.55 + 0.45 * smooth(s / 0.45), 0.4 * (1 - smooth(s / 0.3)), b);
    const settle = smooth((s - 0.1) / (KO.grey - KO.land));
    f.koZoom = PUNCH.land + (PUNCH.rest - PUNCH.land) * settle - 0.04 * b;
    const ease = smooth(s / (KO.grey - KO.land));
    this.setGrey(ease * 0.85);
    this.drawAftermath(rest.x, rest.y, since, Math.max(0.35, ease), true);
    if (p.age >= KO.dur) p.age = KO.dur;
  }

  /** The hit-stop: the field darkens and speed lines burst round her, flickering. */
  private drawHitStop(p: Play, k: number): void {
    const g = this.g;
    const a = Math.min(1, k * 6);
    for (let r = 60; r < 1400; r += 60) g.circle(p.x, p.y, r).stroke({ width: 60, color: 0x05030c, alpha: 0.4 * a * Math.min(1, r / 300) });
    const flick = Math.floor(p.age / 0.045) % 2;
    for (let i = 0; i < p.lines.length; i++) {
      const ang = p.lines[i]! + flick * 0.05;
      const r0 = 44 + ((i * 37) % 30);
      const r1 = 700;
      const hw = 0.012 + ((i * 13) % 7) * 0.003;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      g.poly([p.x + c * r0, p.y + s * r0, p.x + Math.cos(ang + hw) * r1, p.y + Math.sin(ang + hw) * r1, p.x + Math.cos(ang - hw) * r1, p.y + Math.sin(ang - hw) * r1]).fill({ color: i % 4 ? 0xffffff : RED, alpha: 0.6 * a });
    }
  }

  /**
   * After the burst: the field darkens toward the edges around where she
   * fell (bands of a vignette, eased in with the grey) and a soft afterglow
   * with rising motes lingers on the spot. This layer is above the greyed
   * field, so it keeps its colour. `pool`: a pool of light she lies in.
   */
  private drawAftermath(x: number, y: number, since: number, ease: number, pool = false): void {
    const g = this.g;
    for (let r = 150; r < 1600; r += 50) {
      const a = ease * 0.7 * Math.min(1, (r - 150) / 520);
      g.circle(x, y, r).stroke({ width: 50, color: 0x05030c, alpha: a });
    }
    if (pool) {
      for (let r = 120; r > 20; r -= 14) g.ellipse(x, y + 4, r, r * 0.55).fill({ color: 0xfff0f4, alpha: 0.05 * ease });
    }
    const glow = Math.exp(-since * 0.9) * Math.min(1, since * 6);
    g.circle(x, y, 46 + since * 12).fill({ color: 0xff9ab8, alpha: 0.16 * glow });
    g.circle(x, y, 22 + since * 6).fill({ color: 0xffffff, alpha: 0.28 * glow });
    const motes = Math.min(1, since * 2) * (0.4 + 0.6 * glow);
    for (let i = 0; i < 12; i++) {
      const t = (since * 0.3 + i / 12) % 1;
      const mx = x + Math.sin(i * 2.1 + since * 1.5) * (18 + 40 * t);
      g.circle(mx, y - 10 - t * 150, 2.2 - t).fill({ color: i % 3 ? 0xffffff : 0xff9ab8, alpha: motes * (1 - t) * 0.85 });
    }
  }

  /** Drawn player: burst, gone, then she fades back in from white inside a pillar of light. */
  private stepRevive(p: Play): void {
    if (!p.burst) {
      this.setPlayerWash(Math.min(1, p.age / REVIVE.burst));
      if (p.age >= REVIVE.burst) {
        p.burst = true;
        this.burst(p.x, p.y, false);
        this.gone(0, 1);
      }
      return;
    }
    if (p.age < REVIVE.back) {
      this.gone(1);
      return;
    }
    const k = Math.min(1, (p.age - REVIVE.back) / (REVIVE.dur - REVIVE.back));
    this.field.playerAlpha = Math.min(1, k * 3);
    this.setPlayerWash(1 - k);
    this.drawPillar(p.x, p.y, k, 1);
    if (p.age >= REVIVE.dur) this.endRevive();
  }

  private endRevive(): void {
    this.play = null;
    this.field.playerAlpha = null;
    this.field.playerKO = null;
    this.field.koZoom = 1;
    this.setPlayerWash(0);
  }

  /** A pillar of golden light over (x, y) at progress k (0..1), `s` its size. */
  private drawPillar(x: number, y: number, k: number, s: number): void {
    const g = this.g;
    const a = Math.sin(Math.PI * k);
    for (let i = 0; i < 4; i++) {
      const w = (60 - i * 13) * s;
      g.rect(x - w / 2, y - 220 * s + (1 - k) * 60, w, 250 * s).fill({ color: i === 3 ? 0xffffff : GOLD, alpha: 0.1 * a * (s > 1 ? 1.6 : 1) });
    }
    g.circle(x, y, (34 + 20 * k) * s).fill({ color: GOLD, alpha: 0.22 * a });
    g.circle(x, y, (34 + 20 * k) * s).stroke({ width: 2, color: 0xffffff, alpha: 0.6 * a });
    for (let i = 0; i < 6 * s; i++) {
      const t = (k * 1.6 + i / (6 * s)) % 1;
      g.circle(x + Math.sin(i * 2.4 + k * 6) * 26 * s, y + 20 - t * 110 * s, 2.5).fill({ color: 0xffffff, alpha: a * (1 - t) });
    }
  }

  /** Live rig: a short hit-stop, knocked down, then she rises in a golden pillar, floats up and lands upright. */
  private stepReviveKO(p: Play): void {
    const f = this.field;
    const a = p.age;
    const R = REVIVE_KO;
    f.playerAlpha = 1;
    const DIST = 22;
    if (a < R.burst) {
      this.setPlayerWash(a < 0.05 ? 1 : 0.5);
      f.playerKO = { down: 0, recoil: 1, turn: -0.2, lift: 5, slide: 0, rate: a < 0.05 ? 1 : 0 };
      f.koZoom = 1 + 0.12 * smooth(a / 0.06);
      return;
    }
    if (!p.burst) {
      p.burst = true;
      this.setPlayerWash(0);
      this.burst(p.x, p.y, false);
    }
    if (a < R.fall) {
      // Knocked down: a short hop back onto her side.
      const w = (a - R.burst) / (R.fall - R.burst);
      f.playerKO = { down: w, recoil: 1 - w * 0.7, turn: -0.2 + (LIE + 0.2) * w * w, lift: 28 * 4 * w * (1 - w), slide: DIST * w, rate: 1 };
      return;
    }
    if (a < R.rise) {
      const b = bounce(a - R.fall);
      if (!p.landed) {
        p.landed = true;
        f.burst(p.x + f.knockSide * DIST, p.y + 14, 0xd9c7a8, 14, 2.4, 1.1);
        f.shake(6);
      }
      f.playerKO = { down: 1, recoil: 0.3 * (1 - smooth((a - R.fall) / 0.15)), turn: LIE - 0.1 * b, lift: 8 * b, slide: DIST, rate: 1 };
      f.koZoom = 1.12;
      return;
    }
    const cx = p.x + f.knockSide * DIST * 0.5;
    if (a < R.top) {
      // Rising: gold light washes over her as she floats up out of the pillar, turning upright.
      const k = (a - R.rise) / (R.top - R.rise);
      const up = smooth(k * 1.2);
      f.playerKO = { down: 1 - up, recoil: 0, turn: LIE * (1 - up), lift: 26 * smooth(k * 1.6), slide: DIST * (1 - up), rate: 1 };
      this.setPlayerWash(0.55 * Math.sin(Math.PI * k), GOLD);
      f.koZoom = 1.12 + 0.06 * smooth(k);
      this.drawPillar(cx, p.y, k, 1.4);
      if (Math.random() < 0.6) f.burst(cx + (Math.random() - 0.5) * 50, p.y + 10, GOLD, 1, 1.2, 1.2, true);
      return;
    }
    // Down on her feet: a gold burst, and the camera lets go.
    if (!p.sounded) {
      p.sounded = true;
      f.ring(p.x, p.y, 10, 150, GOLD, 0.6);
      f.ring(p.x, p.y, 10, 90, 0xffffff, 0.4);
      f.burst(p.x, p.y, GOLD, 34, 4.5, 1.3, true);
      f.flash(GOLD, 0.35);
      f.shake(5);
    }
    const k = (a - R.top) / (R.dur - R.top);
    f.playerKO = { down: 0, recoil: 0, turn: 0, lift: 26 * (1 - smooth(k * 2.5)) + 4 * bounce((k - 0.4) * (R.dur - R.top)), slide: 0, rate: 1 };
    this.setPlayerWash(0.3 * (1 - k), GOLD);
    f.koZoom = 1 + 0.18 * (1 - smooth(k));
    if (a >= R.dur) this.endRevive();
  }

  private stepPieces(fdt: number): void {
    const g = this.g;
    this.pieces = this.pieces.filter((q) => (q.age += fdt * q.ts) < q.dur);
    for (const q of this.pieces) {
      const f = fdt * q.ts * 60;
      // Paper flutters: drag, a little gravity, and a sideways sway.
      const drag = q.kind === "shard" ? 0.94 : 0.9;
      q.vx *= drag ** f;
      q.vy = q.vy * drag ** f + (q.kind === "shard" ? 0.05 : 0.09) * f;
      q.x += (q.vx + (q.kind === "shard" ? 0 : Math.sin(q.age * 7 + q.phase) * 1.2)) * f;
      q.y += q.vy * f;
      q.rot += q.vr * fdt * q.ts;
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
