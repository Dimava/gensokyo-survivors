// Music engine: songs are data (songs.ts) compiled once into a flat list of
// note events; a lookahead scheduler places every note on the AudioContext
// clock a few hundred milliseconds ahead, so frame hitches never smear the
// beat. Every voice is synthesized (oscillators, a shared noise buffer, FM for
// bells); a generated-impulse reverb and a tempo-synced echo are shared sends.
//
// Notation (one string per voice, bars separated by "|"): a bar's tokens split
// the bar evenly, and "[...]" splits one slot again, so "a4 _ c5 [d5 e5]" is
// quarter, held, quarter, two eighths. Tokens:
//   c5 f#4 bb3   absolute note (octave 4 holds middle C)
//   0 1 2 ...    chord tone of the chord sounding then (0 root, 1 third,
//                2 fifth, 3 seventh or root an octave up), in the voice's range
//   _            hold the previous note one more slot
//   .            rest
//   suffix ^     an octave up (repeatable); ! accent; ? soft
//   drums        any mix of k kick, s snare, h hat, o open hat, c crash ("kh")
// A part shorter than its section repeats to fill it.

export type Voice = "lead" | "counter" | "arp" | "bass" | "pad" | "drums";
const VOICES: readonly Voice[] = ["lead", "counter", "arp", "bass", "pad", "drums"];

/** One synthesized instrument: layered oscillators through a lowpass with an envelope. */
export interface Inst {
  /** [wave, semitones, detune cents, level] per layer; levels sum to about 1. */
  osc: readonly (readonly [OscillatorType, number, number, number])[];
  /** Frequency modulation of the first layer (bells, glass): modulator ratio, depth in multiples of the note, decay seconds. */
  fm?: { ratio: number; index: number; decay: number };
  /** Attack, decay (time constant), sustain level (0..1), release seconds. */
  a: number;
  d: number;
  s: number;
  r: number;
  /** Lowpass cutoff Hz (plus kt times the note's frequency); env Hz added at the onset, fading over fd seconds. */
  cut?: number;
  kt?: number;
  env?: number;
  fd?: number;
  q?: number;
  /** Delayed vibrato for held notes (cents, seconds before it swells in). */
  vib?: { depth: number; delay: number };
}

export interface Section {
  /** Chord symbols (Am, F#m, Bb, G7, Fmaj7, Esus4, C/G ...); a bar's chords split it evenly. */
  chords: string;
  lead?: string;
  counter?: string;
  arp?: string;
  bass?: string;
  drums?: string;
  /** Replaces the drums' last bar (a fill into the next section). */
  fill?: string;
  /** Sustained chords under everything (default on). */
  pad?: boolean;
  /** A crash on the first beat when the section has drums (default on). */
  crash?: boolean;
}

export interface Song {
  bpm: number;
  /** Delays every odd eighth by this fraction of an eighth (0 straight). */
  swing?: number;
  inst: { lead: Inst; counter: Inst; arp: Inst; bass: Inst; pad: Inst };
  /** Per-voice level overrides (see MIX). */
  mix?: Partial<Record<Voice, number>>;
  sections: Record<string, Section>;
  form: readonly string[];
  /** Index into form the song loops back to; null plays once and falls silent. */
  loop: number | null;
  /** Seconds the song takes to swell in. */
  fadeIn?: number;
}

/** Voice levels on the music bus: peaks sum to about 1.3 worst case, far less on average. */
const MIX: Record<Voice, number> = { lead: 0.2, counter: 0.1, arp: 0.075, bass: 0.22, pad: 0.05, drums: 0.3 };
/** Reverb and echo send per voice. */
const SEND: Record<Voice, [number, number]> = {
  lead: [0.28, 0.2],
  counter: [0.35, 0.12],
  arp: [0.3, 0.25],
  bass: [0.04, 0],
  pad: [0.5, 0],
  drums: [0.08, 0],
};
/** Lowest note of each voice's range for chord tones (the root lands within the octave above). */
const BASE: Record<Voice, number> = { lead: 67, counter: 55, arp: 60, bass: 33, pad: 55, drums: 0 };

/** Seconds scheduled ahead; a hidden tab's timers run about once a second, so it looks further. */
const LOOK = 0.3;
const LOOK_HIDDEN = 1.5;
const TICK_MS = 40;

// ---------- compiling ----------

interface Ev {
  /** Start and length in bars from the song's start. */
  t: number;
  len: number;
  voice: Voice;
  midi: number;
  drum: string;
  vel: number;
}

interface Compiled {
  events: Ev[];
  bars: number;
  loopBar: number;
  loopIdx: number;
}

const QUALITY: Record<string, readonly number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  m7b5: [0, 3, 6, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
};
const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

interface Chord {
  sym: string;
  from: number;
  to: number;
  root: number;
  bass: number;
  tones: readonly number[];
}

function pitchClass(letter: string, acc: string | undefined): number {
  return (PC[letter.toLowerCase()]! + (acc === "#" ? 1 : acc === "b" ? -1 : 0) + 12) % 12;
}

function parseChord(sym: string): Omit<Chord, "sym" | "from" | "to"> {
  const m = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(sym);
  const tones = m ? QUALITY[m[3]!] : undefined;
  if (!m || !tones) throw new Error(`music: bad chord ${sym}`);
  const root = pitchClass(m[1]!, m[2]);
  return { root, bass: m[4] ? pitchClass(m[4], m[5]) : root, tones };
}

interface Hit {
  /** Bar index within the part plus position in the bar, and length, in bars. */
  at: number;
  len: number;
  tok: string;
}

type Node = string | Node[];

/** Parses one part into hits grouped by the part's bars. */
function parsePart(src: string): Hit[][] {
  const bars: Hit[][] = [];
  let last: Hit | null = null;
  src.split("|").forEach((bar, b) => {
    const stack: Node[][] = [[]];
    for (const tok of bar.replace(/\[/g, " [ ").replace(/\]/g, " ] ").split(/\s+/)) {
      if (!tok) continue;
      if (tok === "[") stack.push([]);
      else if (tok === "]") {
        const group = stack.pop()!;
        stack.at(-1)!.push(group);
      } else stack.at(-1)!.push(tok);
    }
    const hits: Hit[] = [];
    const walk = (nodes: Node[], at: number, len: number): void => {
      const step = len / nodes.length;
      nodes.forEach((n, i) => {
        const p = at + i * step;
        if (Array.isArray(n)) return walk(n, p, step);
        if (n === ".") last = null;
        else if (n === "_" || n === "-") {
          if (last) last.len += step;
        } else {
          last = { at: p, len: step, tok: n };
          hits.push(last);
        }
      });
    };
    walk(stack[0]!, b, 1);
    bars.push(hits);
  });
  return bars;
}

/** Resolves a melodic token to a MIDI note and a velocity. */
function resolve(tok: string, voice: Voice, chord: Chord | undefined): [number, number] | null {
  let vel = 0.8;
  let up = 0;
  let s = tok;
  for (;;) {
    const c = s.at(-1);
    if (c === "!") vel = 1;
    else if (c === "?") vel = 0.5;
    else if (c === "^") up += 12;
    else break;
    s = s.slice(0, -1);
  }
  const note = /^([a-g])([#b]?)(\d)$/.exec(s);
  if (note) return [12 * (Number(note[3]) + 1) + PC[note[1]!]! + (note[2] === "#" ? 1 : note[2] === "b" ? -1 : 0) + up, vel];
  if (/^\d$/.test(s) && chord) {
    const i = Number(s);
    const base = BASE[voice];
    const pc = i === 0 && voice === "bass" ? chord.bass : chord.root;
    const root = base + ((pc - base + 120) % 12);
    const n = chord.tones.length;
    return [root + chord.tones[i % n]! + 12 * Math.floor(i / n) + up, vel];
  }
  throw new Error(`music: bad token ${tok}`);
}

const cache = new WeakMap<Song, Compiled>();

/** Compiles a song once (cached): its events sorted by time, and where it loops. */
function compile(song: Song): Compiled {
  const hit = cache.get(song);
  if (hit) return hit;
  const events: Ev[] = [];
  let bar = 0;
  let loopBar = 0;
  let seed = 7;
  const jitter = (): number => {
    seed = (seed * 16807) % 2147483647;
    return 0.96 + (seed / 2147483647) * 0.08;
  };
  song.form.forEach((name, fi) => {
    const sec = song.sections[name];
    if (!sec) throw new Error(`music: no section ${name}`);
    if (fi === song.loop) loopBar = bar;
    const chords: Chord[] = [];
    const chordBars = sec.chords.split("|");
    chordBars.forEach((cb, b) => {
      const syms = cb.split(/\s+/).filter(Boolean);
      syms.forEach((sym, i) => {
        const from = b + i / syms.length;
        const to = b + (i + 1) / syms.length;
        // A repeated chord holds on (the pad does not re-attack).
        const prev = chords.at(-1);
        if (prev && prev.sym === sym && Math.abs(prev.to - from) < 1e-6) prev.to = to;
        else chords.push({ ...parseChord(sym), sym, from, to });
      });
    });
    const bars = chordBars.length;
    const chordAt = (t: number): Chord | undefined => chords.find((c) => t + 1e-6 >= c.from && t + 1e-6 < c.to);
    const push = (voice: Voice, local: number, length: number, midi: number, drum: string, vel: number): void => {
      let t = bar + local;
      let len = length;
      const eighth = local * 8;
      if (song.swing && voice !== "pad" && Math.abs(eighth - Math.round(eighth)) < 1e-6 && Math.round(eighth) % 2 === 1) {
        t += song.swing / 8;
        len -= song.swing / 8;
      }
      // Metric accent: beats lead, eighths follow, sixteenths trail; a little jitter keeps it human.
      const beat = local * 4;
      const accent = Math.abs(beat - Math.round(beat)) < 1e-6 ? 1 : Math.abs(eighth - Math.round(eighth)) < 1e-6 ? 0.88 : 0.78;
      events.push({ t, len, voice, midi, drum, vel: vel * accent * jitter() });
    };
    for (const voice of VOICES) {
      if (voice === "pad") continue;
      const src = sec[voice];
      if (!src) continue;
      const part = parsePart(src);
      const fill = voice === "drums" && sec.fill ? parsePart(sec.fill)[0] : undefined;
      for (let b = 0; b < bars; b++) {
        const pb = b % part.length;
        const hits = fill && b === bars - 1 ? fill.map((h) => ({ ...h, at: h.at + pb })) : part[pb]!;
        for (const h of hits) {
          const local = b + (h.at - pb);
          if (voice === "drums") {
            const tok = h.tok.replace(/[!?]/g, "");
            const vel = h.tok.includes("!") ? 1 : h.tok.includes("?") ? 0.5 : 0.8;
            for (const d of tok) push(voice, local, h.len, 0, d, vel);
          } else {
            const r = resolve(h.tok, voice, chordAt(local));
            if (r) push(voice, local, h.len, r[0], "", r[1]);
          }
        }
      }
    }
    if (sec.drums && sec.crash !== false) push("drums", 0, 1, 0, "c", 0.7);
    if (sec.pad !== false) {
      for (const c of chords) {
        const base = BASE.pad;
        for (const iv of c.tones) push("pad", c.from, c.to - c.from, base + ((c.root + iv - base + 120) % 12), "", 0.8);
      }
    }
    bar += bars;
  });
  events.sort((a, b) => a.t - b.t);
  const loopIdx = song.loop === null ? events.length : Math.max(0, events.findIndex((e) => e.t >= loopBar - 1e-9));
  const out = { events, bars: bar, loopBar, loopIdx };
  cache.set(song, out);
  return out;
}

// ---------- playing ----------

interface Playing {
  song: Song;
  c: Compiled;
  buses: Record<Voice, GainNode>;
  sends: GainNode[];
  /** Context time of bar 0 (moves forward a loop's length each time it wraps). */
  t0: number;
  idx: number;
}

export class Music {
  private reverb: GainNode;
  private echo: GainNode;
  private echoDelay: DelayNode;
  private lfo: OscillatorNode;
  private now: Playing | null = null;
  private timer: number | null = null;
  private noiseAt = 0;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
    private noiseBuf: AudioBuffer,
  ) {
    // Reverb: a convolver over 1.6 s of decaying stereo noise, darkened by a lowpass.
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 99;
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = ((seed / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 3);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const revTone = ctx.createBiquadFilter();
    revTone.type = "lowpass";
    revTone.frequency.value = 4500;
    const revOut = ctx.createGain();
    revOut.gain.value = 0.55;
    this.reverb = ctx.createGain();
    this.reverb.connect(conv);
    conv.connect(revTone);
    revTone.connect(revOut);
    revOut.connect(out);
    // Echo: a dotted-eighth delay whose repeats darken as they feed back.
    this.echo = ctx.createGain();
    this.echoDelay = ctx.createDelay(2);
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 2600;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.3;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.5;
    this.echo.connect(this.echoDelay);
    this.echoDelay.connect(echoTone);
    echoTone.connect(feedback);
    feedback.connect(this.echoDelay);
    echoTone.connect(echoOut);
    echoOut.connect(out);
    echoOut.connect(this.reverb);
    // One shared vibrato LFO; held notes tap it through their own depth gain.
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.6;
    this.lfo.start();
  }

  /** Crossfades to a song (null fades out). */
  play(song: Song | null): void {
    if (this.now?.song === song) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    if (this.now) this.retire(this.now, at, song ? 0.9 : 1.6);
    this.now = null;
    if (!song) return;
    const c = compile(song);
    const buses = {} as Record<Voice, GainNode>;
    const sends: GainNode[] = [];
    const level = { ...MIX, ...song.mix };
    for (const v of VOICES) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(level[v], at + (song.fadeIn ?? 0.25));
      g.connect(this.out);
      const [rev, echo] = SEND[v];
      for (const [amt, dest] of [
        [rev, this.reverb],
        [echo, this.echo],
      ] as const) {
        if (!amt) continue;
        const s = ctx.createGain();
        s.gain.value = amt;
        g.connect(s);
        s.connect(dest);
        sends.push(s);
      }
      buses[v] = g;
    }
    this.echoDelay.delayTime.setTargetAtTime((240 / song.bpm) * (3 / 16), at, 0.05);
    this.now = { song, c, buses, sends, t0: at + 0.08, idx: 0 };
    this.schedule();
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  /** Fades a song's buses out, then disconnects them once every scheduled note has rung out. */
  private retire(p: Playing, at: number, fade: number): void {
    for (const v of VOICES) {
      const g = p.buses[v].gain;
      // Hold wherever a fade-in had got to (Firefox lacks cancelAndHold: .value is close enough there).
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at);
      else {
        g.cancelScheduledValues(at);
        g.setValueAtTime(g.value, at);
      }
      g.linearRampToValueAtTime(0, at + fade);
    }
    window.setTimeout(
      () => {
        for (const v of VOICES) p.buses[v].disconnect();
        for (const s of p.sends) s.disconnect();
      },
      (fade + LOOK_HIDDEN + 2) * 1000,
    );
  }

  private schedule(): void {
    const p = this.now;
    if (!p) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const horizon = now + (document.hidden ? LOOK_HIDDEN : LOOK);
    const spb = 240 / p.song.bpm;
    const evs = p.c.events;
    for (;;) {
      if (p.idx >= evs.length) {
        if (p.song.loop === null) return;
        p.idx = p.c.loopIdx;
        p.t0 += (p.c.bars - p.c.loopBar) * spb;
        continue;
      }
      const e = evs[p.idx]!;
      const t = p.t0 + e.t * spb;
      if (t > horizon) return;
      p.idx++;
      // Notes the scheduler fell behind on are dropped, never played in a burst.
      if (t < now - 0.02) continue;
      const bus = p.buses[e.voice];
      if (e.voice === "drums") this.drum(e.drum, t, e.vel, bus);
      else {
        const gate = e.len * spb * (e.voice === "pad" ? 1 : 0.92);
        this.note(p.song.inst[e.voice], e.midi, t, gate, e.vel, bus);
      }
    }
  }

  // ---------- voices ----------

  private note(inst: Inst, midi: number, t: number, gate: number, vel: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    const nodes: AudioNode[] = [];
    const amp = ctx.createGain();
    nodes.push(amp);
    const end = t + Math.max(gate, inst.a + 0.01);
    const stop = end + inst.r * 1.5 + 0.03;
    const g = amp.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(vel, t + inst.a);
    if (inst.s < 1) g.setTargetAtTime(vel * inst.s, t + inst.a, inst.d);
    g.setTargetAtTime(0, end, inst.r / 4);
    let into: AudioNode = amp;
    if (inst.cut) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = inst.q ?? 0.7;
      const cut = Math.min(16000, inst.cut + (inst.kt ?? 0) * hz);
      f.frequency.setValueAtTime(Math.min(16000, cut + (inst.env ?? 0)), t);
      if (inst.env) f.frequency.setTargetAtTime(cut, t, inst.fd ?? 0.1);
      f.connect(amp);
      nodes.push(f);
      into = f;
    }
    amp.connect(dest);
    let vib: GainNode | null = null;
    if (inst.vib && gate > inst.vib.delay + 0.1) {
      vib = ctx.createGain();
      vib.gain.setValueAtTime(0, t + inst.vib.delay);
      vib.gain.linearRampToValueAtTime(inst.vib.depth, t + inst.vib.delay + 0.3);
      this.lfo.connect(vib);
      nodes.push(vib);
    }
    let last: OscillatorNode | null = null;
    for (const [i, [type, semi, cents, level]] of inst.osc.entries()) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz * Math.pow(2, semi / 12);
      o.detune.value = cents;
      if (vib) vib.connect(o.detune);
      const lg = ctx.createGain();
      lg.gain.value = level;
      o.connect(lg);
      lg.connect(into);
      nodes.push(o, lg);
      if (i === 0 && inst.fm) {
        const m = ctx.createOscillator();
        m.frequency.value = hz * inst.fm.ratio;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(hz * inst.fm.index, t);
        mg.gain.setTargetAtTime(hz * inst.fm.index * 0.08, t, inst.fm.decay);
        m.connect(mg);
        mg.connect(o.frequency);
        m.start(t);
        m.stop(stop);
        nodes.push(m, mg);
      }
      o.start(t);
      o.stop(stop);
      last = o;
    }
    const v = vib;
    last?.addEventListener("ended", () => {
      if (v) this.lfo.disconnect(v);
      for (const n of nodes) n.disconnect();
    });
  }

  private noise(t: number, dur: number, vel: number, type: BiquadFilterType, hz: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    this.noiseAt = (this.noiseAt + 0.137) % 0.8;
    src.start(t, this.noiseAt);
    src.stop(t + dur + 0.02);
    src.addEventListener("ended", () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    });
  }

  private thump(t: number, from: number, to: number, dur: number, vel: number, type: OscillatorType, dest: AudioNode): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.addEventListener("ended", () => {
      o.disconnect();
      g.disconnect();
    });
  }

  private drum(kind: string, t: number, vel: number, dest: AudioNode): void {
    switch (kind) {
      case "k":
        return this.thump(t, 150, 42, 0.3, vel, "sine", dest);
      case "s":
        this.thump(t, 220, 150, 0.09, vel * 0.35, "triangle", dest);
        return this.noise(t, 0.17, vel * 0.55, "highpass", 1400, dest);
      case "h":
        return this.noise(t, 0.035, vel * 0.22, "highpass", 7500, dest);
      case "o":
        return this.noise(t, 0.22, vel * 0.18, "highpass", 7000, dest);
      case "c":
        return this.noise(t, 1.3, vel * 0.22, "highpass", 4500, dest);
    }
  }
}
