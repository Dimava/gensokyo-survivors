// Life for a rig: it eases toward where it is told to look (a Look, as the
// drawn art uses), blinks at random intervals, breathes, sways a little on
// its own, talks when asked, and runs the hair physics. Pure: no DOM, so the
// same motion can be stepped in tests or pre-rendered.

import type { Look } from "../art/drawing.ts";
import type { Rig } from "./rig.ts";
import { BLINK, RATE } from "./tempo.ts";

/** Look (-1..1) to parameter scale. */
const ANGLE = 30;
const BODY = 8;

export class Animator {
  /** Where the character should look; the head eases toward it. */
  target: Look = { x: 0, y: 0 };
  /** Open and close the mouth as if speaking. */
  talking = false;
  /** Idle motion (breath, blinks, drift); off gives a still pose for snapshots. */
  idle = true;
  /** Idle cycles per second (wing flaps, bobbing, orb spin); 0 for portraits. */
  rate = 0;
  /**
   * How it moves: the move vector (its length is the speed fraction, 0 = standing)
   * and whether slowly (focus). Standing, walking and slow walking blend in over
   * a few frames: the stride cadence, bob, lean and trailing hair follow the mix.
   */
  move: Look = { x: 0, y: 0 };
  slow = false;
  /**
   * Knocked out (0..1): eyes shut, head drooping, the body sinking, arms and
   * hair hanging slack. `recoil` (0..1) is the flinch of being hit: eyes
   * squeezed, head snapped back, mouth open. The field tips the whole rig over
   * itself (renderer.ts); the springs keep swinging with the fall.
   */
  down = 0;
  recoil = 0;
  /** The side a hit knocks her toward (+1: +x; 0: none): on the recoil her sleeves, ribbon and hair fly the other way. */
  knock = 0;
  /** Blend weights of walking and slow walking (standing is the rest), and the eased move direction. */
  private walkW = 0;
  private slowW = 0;
  private dir: Look = { x: 0, y: 0 };
  private phase = 0;
  private look: Look = { x: 0, y: 0 };
  private eyes: Look = { x: 0, y: 0 };
  private t = 0;
  private nextBlink = 1.5;
  private blinkAt = -10;
  private mouth = 0;

  constructor(
    readonly rig: Rig,
    private readonly random: () => number = Math.random,
  ) {}

  /** Jump straight to the target (no easing, no physics swing). */
  snap(): void {
    this.look = { ...this.target };
    this.eyes = { ...this.target };
    this.apply(0);
  }

  step(dt: number): void {
    this.t += dt;
    // Eyes lead, the head follows (critically damped-ish exponential easing).
    const head = 1 - Math.exp(-dt * RATE.headFollow);
    const eye = 1 - Math.exp(-dt * RATE.eyeFollow);
    this.look.x += (this.target.x - this.look.x) * head;
    this.look.y += (this.target.y - this.look.y) * head;
    this.eyes.x += (this.target.x - this.eyes.x) * eye;
    this.eyes.y += (this.target.y - this.eyes.y) * eye;
    // Gait weights and direction ease in and out, never snapping.
    const speed = Math.min(1, Math.hypot(this.move.x, this.move.y));
    const moving = speed > 0.05 && this.down < 0.05;
    const ease = 1 - Math.exp(-dt * RATE.gaitBlend);
    this.walkW += ((moving && !this.slow ? speed : 0) - this.walkW) * ease;
    this.slowW += ((moving && this.slow ? speed : 0) - this.slowW) * ease;
    const len = Math.hypot(this.move.x, this.move.y) || 1;
    this.dir.x += ((moving ? this.move.x / len : 0) - this.dir.x) * ease;
    this.dir.y += ((moving ? this.move.y / len : 0) - this.dir.y) * ease;
    const stand = Math.max(0, 1 - this.walkW - this.slowW);
    // Strides per second: brisk walking, a deliberate slow walk, or the idle cycle.
    this.phase += dt * (stand * this.rate + this.walkW * RATE.walk + this.slowW * RATE.slowWalk);
    const hurt = Math.max(this.down, this.recoil);
    const talk = this.talking ? 0.5 + 0.5 * Math.sin(this.t * RATE.talkA) * Math.sin(this.t * RATE.talkB) : 0;
    this.mouth += (Math.max(0, talk, this.recoil * 0.9, this.down * 0.25) - this.mouth) * (1 - Math.exp(-dt * (hurt > 0 ? 30 : 20)));
    this.apply(dt);
  }

  private apply(dt: number): void {
    const r = this.rig;
    const drift = this.idle ? { x: Math.sin(this.t * RATE.driftX) * 0.05, y: Math.sin(this.t * RATE.driftY) * 0.04 } : { x: 0, y: 0 };
    const lx = this.look.x + drift.x;
    const ly = this.look.y + drift.y;
    r.set("AngleX", lx * ANGLE);
    r.set("AngleY", -ly * ANGLE);
    r.set("AngleZ", -lx * ly * 12 + (this.idle ? Math.sin(this.t * RATE.tilt) * 2 : 0));
    r.set("BodyAngleX", lx * BODY);
    r.set("EyeBallX", this.eyes.x);
    r.set("EyeBallY", -this.eyes.y);
    r.set("Breath", this.idle ? 0.5 + 0.5 * Math.sin(this.t * RATE.breath) : 0);
    r.set("MouthOpen", this.mouth);
    let open = 1;
    if (this.idle) {
      if (this.t >= this.nextBlink) {
        this.blinkAt = this.t;
        this.nextBlink = this.t + BLINK.minWait + this.random() * (BLINK.maxWait - BLINK.minWait);
      }
      // Close fast, open a little slower.
      const s = this.t - this.blinkAt;
      open = s < BLINK.close ? 1 - s / BLINK.close : s < BLINK.close + BLINK.open ? (s - BLINK.close) / BLINK.open : 1;
    }
    // Hurt: the eyes squeeze shut and stay shut while she is down.
    open = Math.min(open, 1 - Math.min(1, Math.max(this.recoil * 1.6, this.down * 1.4)));
    r.set("EyeLOpen", open);
    r.set("EyeROpen", open);
    const walk = this.walkW;
    const slow = this.slowW;
    const stand = Math.max(0, 1 - walk - slow);
    const a = this.phase * Math.PI * 2;
    if (this.idle && (this.rate > 0 || walk + slow > 0.01)) {
      cycle(r, this.phase, false);
      // Walking bobs twice a stride (once per step); standing floats gently.
      r.set("Bob", stand * 0.9 * Math.sin(a - 0.4) + walk * 0.9 * Math.sin(2 * a) + slow * 0.35 * Math.sin(2 * a));
      r.set("Step", (walk + slow * 0.7) * Math.sin(a));
    }
    // Lean into the move: the body turns and tilts toward it, more at full speed.
    const lean = this.dir.x;
    r.set("AngleZ", (r.params.AngleZ ?? 0) - lean * (12 * walk + 5 * slow));
    r.set("BodyAngleX", lx * BODY + lean * (7 * walk + 3 * slow));
    const down = this.down;
    const recoil = this.recoil;
    if (down > 0 || recoil > 0) {
      // The head snaps back on the hit, then droops; the body sinks and goes still.
      r.set("AngleY", (r.params.AngleY ?? 0) * (1 - down) + recoil * ANGLE * 0.9 - down * ANGLE * 0.8);
      r.set("AngleZ", (r.params.AngleZ ?? 0) * (1 - down) + down * 14 - recoil * 6);
      r.set("BodyAngleX", (r.params.BodyAngleX ?? 0) * (1 - down));
      r.set("Bob", (r.params.Bob ?? 0) * (1 - down) - down + recoil * 0.6);
      r.set("Step", (r.params.Step ?? 0) * (1 - down));
      r.set("Breath", (r.params.Breath ?? 0) * (1 - down * 0.8));
    }
    if (dt > 0) r.step(dt);
    // Hair, ribbons and sleeves trail opposite the motion, swinging with the stride.
    const trail = -lean * (0.75 * walk + 0.3 * slow);
    const swing = (k: number, lag: number) => (walk + slow * 0.5) * k * Math.sin(a - lag);
    const add = (id: string, v: number) => r.set(id, (r.params[id] ?? 0) + v);
    add("HairSide", trail + swing(0.2, 1.2));
    add("HairBack", trail * 0.9 + swing(0.15, 1.5));
    add("HairFront", trail * 0.4);
    add("Ribbon", trail * 1.1 + swing(0.25, 1.1));
    r.set("Sleeve", trail * 0.9 + swing(0.35, 0.9));
    // The hit flings her sleeves, ribbon and hair back from where she is knocked.
    if (recoil > 0 && this.knock) {
      const k = -this.knock * recoil;
      add("Sleeve", k * 0.95);
      add("Ribbon", k * 0.8);
      add("HairSide", k * 0.6);
      add("HairBack", k * 0.5);
      add("HairFront", k * 0.3);
    }
    // Down: sleeves, ribbon and hair hang slack toward the ground she fell to.
    if (down > 0) {
      add("Sleeve", down * 0.7 - (r.params.Sleeve ?? 0) * down * 0.5);
      add("Ribbon", down * 0.5);
      add("HairSide", down * 0.45);
      add("HairBack", down * 0.3);
    }
  }
}

/**
 * One idle cycle at `phase` (0..1, wraps): wings up while the body sinks,
 * the hair and ribbons trailing a little behind, orbs turning one step.
 * The field bakes a few phases per look; live rigs run it continuously.
 */
export function cycle(rig: Rig, phase: number, sway = true): void {
  const a = phase * Math.PI * 2;
  rig.set("Flap", Math.sin(a));
  rig.set("Bob", Math.sin(a - 0.4) * 0.9);
  rig.set("Spin", ((phase % 1) + 1) % 1);
  if (!sway) return;
  rig.set("HairFront", Math.sin(a - 1) * 0.25);
  rig.set("HairSide", Math.sin(a - 1.2) * 0.4);
  rig.set("HairBack", Math.sin(a - 1.5) * 0.35);
  rig.set("Ribbon", Math.sin(a - 1.1) * 0.45);
}

/** Default rig parameters for a still pose looking toward `look` (for pre-renders). */
export function pose(rig: Rig, look: Look): void {
  const a = new Animator(rig);
  a.idle = false;
  a.target = look;
  a.snap();
}
