// Music engine: songs are data (songs.ts) compiled once into a flat list of
// note events; a lookahead scheduler places every note on the AudioContext
// clock a few hundred milliseconds ahead, so frame hitches never smear the
// beat. Every voice is synthesized (oscillators with filter and amp
// envelopes, FM for bells and e-piano, a shared noise buffer for drums); a
// generated-impulse stereo reverb and a tempo-synced ping-pong echo are
// shared sends. The music's sum runs through a pause filter and a ducker.
//
// Notation (one string per voice, bars separated by "|"): a bar's tokens split
// the bar evenly, and "[...]" splits one slot again, so "a4 _ c5 [d5 e5]" is
// quarter, held, quarter, two eighths. Tokens:
//   c5 f#4 bb3   absolute note (octave 4 holds middle C)
//   0 1 2 ...    chord tone of the chord sounding then (0 root, 1 third,
//                2 fifth, 3 seventh or root an octave up), in the voice's range
//   *            the whole chord at once (a stab), in the voice's range
//   _            hold the previous note one more slot
//   .            rest
//   suffix ^ ,   an octave up / down (repeatable); ! accent; ? soft
//   drums        any mix of k kick, s snare, x clap, h hat, o open hat,
//                c crash, r ride, t m l high/mid/low tom ("kh", "s!")
// A part shorter than its section repeats to fill it. A section's `tr`
// transposes everything in it (key changes); its `inst` swaps instruments;
// its `dyn` shapes the phrase (velocity from..to across the section).
//
// Chords: Am, F#m7, Bbmaj7, G7sus4, Dm7/C (a slash names the bass), "~" holds
// the chord before (a passing slot), "N" is no chord (the pad rests: a run
// between two chords). The pad moves between chords by the nearest voicing
// (inversions that step), and with Song.voiceLead the arp and keys follow the
// same voicing.

export type Voice = "lead" | "counter" | "keys" | "arp" | "bass" | "pad" | "drums" | "perc";
export type Melodic = Exclude<Voice, "drums" | "perc">;
export const VOICES: readonly Voice[] = ["lead", "counter", "keys", "arp", "bass", "pad", "drums", "perc"];
const DRUMLIKE = new Set<Voice>(["drums", "perc"]);

/** One oscillator layer: wave, semitones, detune cents, level, and an optional stereo pan. */
export type Layer = readonly [OscillatorType, number, number, number, number?];

/** One synthesized instrument: layered oscillators through a lowpass with an envelope. */
export interface Inst {
  /** Layers; levels sum to about 1. */
  osc: readonly Layer[];
  /** Frequency modulation of the first layer (bells, e-piano, glass): modulator ratio, depth in multiples of the note, decay seconds. */
  fm?: { ratio: number; index: number; decay: number };
  /** Attack, decay (time constant), sustain level (0..1), release seconds. */
  a: number;
  d: number;
  s: number;
  r: number;
  /** Lowpass cutoff Hz (plus kt times the note's frequency); env Hz (times velocity) added at the onset, fading over fd seconds. */
  cut?: number;
  kt?: number;
  env?: number;
  fd?: number;
  q?: number;
  /** Delayed vibrato for held notes (cents, seconds before it swells in). */
  vib?: { depth: number; delay: number };
  /** The note starts this many cents flat and bends up (a brass scoop). */
  scoop?: number;
  /** Fraction of a note's length it sounds (default 0.92; 1 is legato). */
  gate?: number;
}

export interface Section {
  /** Chord symbols (Am, F#m, Bb, G7, Fmaj7, Esus4, C/G ...); a bar's chords split it evenly. */
  chords: string;
  lead?: string;
  counter?: string;
  keys?: string;
  arp?: string;
  bass?: string;
  drums?: string;
  /** The extra drum layer: it fades in with the game's intensity (Song.layers). */
  perc?: string;
  /** Replaces the drums' last bar (a fill into the next section). */
  fill?: string;
  /** Sustained chords under everything (default on). */
  pad?: boolean;
  /** A crash on the first beat when the section has drums (default on). */
  crash?: boolean;
  /** Semitones this section is transposed by (a key change). */
  tr?: number;
  /** Instruments swapped in for this section. */
  inst?: Partial<Record<Melodic, Inst>>;
  /** Phrase dynamics: velocity scale at the section's start and end (default 1, 1). */
  dyn?: readonly [number, number];
}

export interface Song {
  bpm: number;
  /** The home key, for display ("E minor"); sections with `tr` show it transposed. */
  key?: string;
  /** Arp digits and keys stabs use the pad's voice-led voicing instead of root position. */
  voiceLead?: boolean;
  /** Pads stacked from the root in a fixed range instead of voice-led (how the first engine voiced them; kept for the earlier versions). */
  rootPads?: boolean;
  /** Delays every odd eighth by this fraction of an eighth (0 straight). */
  swing?: number;
  inst: Record<Melodic, Inst>;
  /** Per-voice level overrides (see MIX). */
  mix?: Partial<Record<Voice, number>>;
  /** Per-voice stereo pan overrides (see PAN). */
  pan?: Partial<Record<Voice, number>>;
  /** Intensity (0..1) at which a voice fades in; voices not listed always play. Default: perc at 0.45. */
  layers?: Partial<Record<Voice, number>>;
  sections: Record<string, Section>;
  form: readonly string[];
  /** Index into form the song loops back to; null plays once and falls silent. */
  loop: number | null;
  /** Seconds the song takes to swell in. */
  fadeIn?: number;
}

/** Voice levels on the music bus. */
const MIX: Record<Voice, number> = { lead: 0.2, counter: 0.1, keys: 0.07, arp: 0.07, bass: 0.22, pad: 0.045, drums: 0.3, perc: 0.2 };
const PAN: Record<Voice, number> = { lead: 0, counter: -0.3, keys: -0.2, arp: 0.3, bass: 0, pad: 0, drums: 0, perc: 0.1 };
/** Reverb and echo send per voice. */
const SEND: Record<Voice, [number, number]> = {
  lead: [0.26, 0.18],
  counter: [0.35, 0.1],
  keys: [0.3, 0.05],
  arp: [0.3, 0.22],
  bass: [0.03, 0],
  pad: [0.5, 0],
  drums: [0.1, 0],
  perc: [0.14, 0.05],
};
/** Lowest note of each voice's range for chord tones (the root lands within the octave above). */
const BASE: Record<Voice, number> = { lead: 67, counter: 55, keys: 57, arp: 60, bass: 33, pad: 55, drums: 0, perc: 0 };
/** Stereo place of each drum. */
const KIT_PAN: Record<string, number> = { k: 0, s: 0.05, x: -0.1, h: 0.28, o: 0.28, c: -0.35, r: -0.3, t: 0.3, m: 0, l: -0.3 };

/** Seconds scheduled ahead; a hidden tab's timers run about once a second, so it looks further. */
const LOOK = 0.3;
const LOOK_HIDDEN = 1.5;
const TICK_MS = 40;

// ---------- compiling ----------

export interface Ev {
  /** Start and length in bars from the song's start. */
  t: number;
  len: number;
  voice: Voice;
  midi: number;
  drum: string;
  vel: number;
  inst: Inst | null;
}

/** A chord or section on the song's timeline (bars from its start). */
export interface Span {
  name: string;
  from: number;
  to: number;
}

export interface Compiled {
  events: Ev[];
  bars: number;
  loopBar: number;
  loopIdx: number;
  /** Chord symbols as sounding (transposed), and sections with their key. */
  chords: Span[];
  sections: (Span & { key: string })[];
}

const QUALITY: Record<string, readonly number[]> = {
  "": [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  "6": [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  "9": [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  sus4: [0, 5, 7],
  sus2: [0, 2, 7],
  "7sus4": [0, 5, 7, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  m7b5: [0, 3, 6, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  "5": [0, 7, 12],
};
const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

interface Chord {
  sym: string;
  from: number;
  to: number;
  root: number;
  bass: number;
  tones: readonly number[];
  /** The pad's voicing (MIDI notes, ascending), led from the chord before. */
  voicing: number[];
}

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

/** A chord symbol or key name moved by n semitones ("Dm7/C" +2 is "Em7/D"). */
export function transposeName(sym: string, n: number): string {
  if (!n) return sym;
  return sym.replace(/(^|\/)([A-G])([#b]?)/g, (_, pre: string, l: string, acc: string) => pre + NAMES[(pitchClass(l, acc) + n + 120) % 12]!);
}

/**
 * Voices a chord (at most four tones: a fifth is dropped first) as a close
 * stack between about E3 and G5, picking the inversion that moves least from
 * the voicing before.
 */
export function voiceChord(root: number, tones: readonly number[], prev: readonly number[] | null): number[] {
  let ivs = [...tones];
  if (ivs.length > 4) ivs = ivs.filter((iv) => iv !== 7);
  const pcs = [...new Set(ivs.map((iv) => (root + iv) % 12))];
  let best: number[] = [];
  let bestCost = Infinity;
  for (let r = 0; r < pcs.length; r++) {
    const rot = [...pcs.slice(r), ...pcs.slice(0, r)];
    for (const start of [52, 64]) {
      let n = start + ((rot[0]! - start + 120) % 12);
      const v = [n];
      for (const pc of rot.slice(1)) {
        n += (pc - n + 120) % 12 || 12;
        v.push(n);
      }
      if (v[0]! > 66 || v.at(-1)! > 79) continue;
      // Movement both ways: every new note to its nearest old one and back, so no voice leaps.
      const cost = prev
        ? v.reduce((sum, x) => sum + Math.min(...prev.map((y) => Math.abs(x - y))), 0) + prev.reduce((sum, y) => sum + Math.min(...v.map((x) => Math.abs(x - y))), 0)
        : Math.abs(v.reduce((a, b) => a + b, 0) / v.length - 62);
      if (cost < bestCost) {
        bestCost = cost;
        best = v;
      }
    }
  }
  return best;
}

function pitchClass(letter: string, acc: string | undefined): number {
  return (PC[letter.toLowerCase()]! + (acc === "#" ? 1 : acc === "b" ? -1 : 0) + 12) % 12;
}

function parseChord(sym: string): Omit<Chord, "sym" | "from" | "to" | "voicing"> {
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

/** A voicing moved by octaves so its lowest note sits at or above a voice's base. */
function lift(v: readonly number[], base: number): number[] {
  const k = Math.ceil((base - v[0]!) / 12) * 12;
  return v.map((x) => x + k);
}

/** Resolves a melodic token to MIDI notes (a stab gives several) and a velocity. */
function resolve(tok: string, voice: Voice, chord: Chord | undefined, voiced: boolean): [number[], number] {
  let vel = 0.8;
  let up = 0;
  let s = tok;
  for (;;) {
    const c = s.at(-1);
    if (c === "!") vel = 1;
    else if (c === "?") vel = 0.5;
    else if (c === "^") up += 12;
    else if (c === ",") up -= 12;
    else break;
    s = s.slice(0, -1);
  }
  const note = /^([a-g])([#b]?)(\d)$/.exec(s);
  if (note) return [[12 * (Number(note[3]) + 1) + PC[note[1]!]! + (note[2] === "#" ? 1 : note[2] === "b" ? -1 : 0) + up], vel];
  if (!chord) throw new Error(`music: ${tok} needs a chord`);
  const base = BASE[voice];
  const inRange = (pc: number): number => base + ((pc - base + 120) % 12);
  if (voiced && voice !== "bass" && chord.voicing.length) {
    const v = lift(chord.voicing, base);
    if (s === "*") return [v.map((x) => x + up), vel];
    if (/^\d$/.test(s)) {
      const i = Number(s);
      return [[v[i % v.length]! + 12 * Math.floor(i / v.length) + up], vel];
    }
  }
  if (s === "*") return [chord.tones.map((iv) => inRange(chord.root + iv) + up), vel];
  if (/^\d$/.test(s)) {
    const i = Number(s);
    const root = inRange(i === 0 && voice === "bass" ? chord.bass : chord.root);
    const n = chord.tones.length;
    const iv = i === 0 && voice === "bass" ? 0 : chord.tones[i % n]!;
    return [[root + iv + 12 * Math.floor(i / n) + up], vel];
  }
  throw new Error(`music: bad token ${tok}`);
}

const cache = new WeakMap<Song, Compiled>();

/** Compiles a song once (cached): its events sorted by time, and where it loops. */
export function compileSong(song: Song): Compiled {
  const hit = cache.get(song);
  if (hit) return hit;
  const events: Ev[] = [];
  const chordSpans: Span[] = [];
  const sectionSpans: Compiled["sections"] = [];
  let voicing: number[] | null = null;
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
    const tr = sec.tr ?? 0;
    const chords: Chord[] = [];
    const chordBars = sec.chords.split("|");
    chordBars.forEach((cb, b) => {
      const syms = cb.split(/\s+/).filter(Boolean);
      syms.forEach((sym, i) => {
        const from = b + i / syms.length;
        const to = b + (i + 1) / syms.length;
        // A repeated chord, or "~", holds on (the pad does not re-attack); "N" leaves a gap.
        const prev = chords.at(-1);
        if (prev && (prev.sym === sym || sym === "~") && Math.abs(prev.to - from) < 1e-6) prev.to = to;
        else if (sym !== "N" && sym !== "~") {
          const c = parseChord(sym);
          // The first engine's pads: every tone in root position from G3 up (Song.rootPads).
          voicing = song.rootPads ? c.tones.map((iv) => BASE.pad + ((c.root + iv - BASE.pad + 120) % 12)).sort((x, y) => x - y) : voiceChord(c.root, c.tones, voicing);
          chords.push({ ...c, sym, from, to, voicing });
        }
      });
    });
    const bars = chordBars.length;
    for (const c of chords) chordSpans.push({ name: transposeName(c.sym, tr), from: bar + c.from, to: bar + c.to });
    sectionSpans.push({ name, from: bar, to: bar + bars, key: song.key ? transposeName(song.key, tr) : "" });
    const chordAt = (t: number): Chord | undefined => chords.find((c) => t + 1e-6 >= c.from && t + 1e-6 < c.to);
    const [dyn0, dyn1] = sec.dyn ?? [1, 1];
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
      const inst = DRUMLIKE.has(voice) ? null : (sec.inst?.[voice as Melodic] ?? song.inst[voice as Melodic]);
      const shape = dyn0 + ((dyn1 - dyn0) * local) / bars;
      events.push({ t, len, voice, midi: midi + (drum ? 0 : tr), drum, vel: vel * accent * shape * jitter(), inst });
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
          if (DRUMLIKE.has(voice)) {
            const tok = h.tok.replace(/[!?]/g, "");
            const vel = h.tok.includes("!") ? 1 : h.tok.includes("?") ? 0.5 : 0.8;
            for (const d of tok) push(voice, local, h.len, 0, d, vel);
          } else {
            const [notes, vel] = resolve(h.tok, voice, chordAt(local), !!song.voiceLead);
            for (const n of notes) push(voice, local, h.len, n, "", vel);
          }
        }
      }
    }
    if (sec.drums && sec.crash !== false) push("drums", 0, 1, 0, "c", 0.7);
    if (sec.pad !== false) {
      for (const c of chords) for (const n of c.voicing) push("pad", c.from, c.to - c.from, n, "", 0.8);
    }
    bar += bars;
  });
  events.sort((a, b) => a.t - b.t);
  const loopIdx = song.loop === null ? events.length : Math.max(0, events.findIndex((e) => e.t >= loopBar - 1e-9));
  const out = { events, bars: bar, loopBar, loopIdx, chords: chordSpans, sections: sectionSpans };
  cache.set(song, out);
  return out;
}

/** A song's length in seconds (to its end, and the looping part). */
export function songLength(song: Song): { total: number; loop: number } {
  const c = compileSong(song);
  const spb = 240 / song.bpm;
  return { total: c.bars * spb, loop: song.loop === null ? 0 : (c.bars - c.loopBar) * spb };
}

// ---------- playing ----------

interface Playing {
  song: Song;
  c: Compiled;
  buses: Record<Voice, GainNode>;
  /** Intensity gates, for the voices Song.layers lists. */
  gates: Partial<Record<Voice, GainNode>>;
  /** Everything else built for this song, disconnected when it retires. */
  nodes: AudioNode[];
  /** The drum kit's per-drum panners, per drum voice. */
  kit: Record<"drums" | "perc", Record<string, AudioNode>>;
  /** Context time of bar 0 (moves forward a loop's length each time it wraps). */
  t0: number;
  /** The bar-0 time before the last wrap, and the context time the wrap takes over. */
  t0Prev: number;
  wrapAt: number;
  idx: number;
  /** Context time the song (played once) ends. */
  endsAt: number;
}

export class Music {
  /** The music's sum: every bus and effect return, before the pause filter and ducker. */
  private sum: GainNode;
  private pauseFilter: BiquadFilterNode;
  private pauseGain: GainNode;
  private duckGain: GainNode;
  private reverb: GainNode;
  private echo: GainNode;
  private echoDelays: DelayNode[];
  private lfo: OscillatorNode;
  private now: Playing | null = null;
  private timer: number | null = null;
  private noiseAt = 0;
  private level = 0;

  constructor(
    private ctx: BaseAudioContext,
    out: AudioNode,
    private noiseBuf: AudioBuffer,
    /** Offline rendering: no timer; pump() schedules. */
    private offline = false,
  ) {
    this.sum = ctx.createGain();
    this.pauseFilter = ctx.createBiquadFilter();
    this.pauseFilter.type = "lowpass";
    this.pauseFilter.frequency.value = 20000;
    this.pauseFilter.Q.value = 0.9;
    this.pauseGain = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.sum.connect(this.pauseFilter);
    this.pauseFilter.connect(this.pauseGain);
    this.pauseGain.connect(this.duckGain);
    this.duckGain.connect(out);

    // Reverb: a convolver over 2.2 s of stereo noise that decays and darkens, after a short pre-delay.
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 2.2);
    const pre = Math.floor(sr * 0.014);
    const ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let seed = 99 + ch * 7919;
      let y = 0;
      for (let i = pre; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const x = (seed / 0x7fffffff) * 2 - 1;
        const k = (i - pre) / (len - pre);
        // A one-pole lowpass that closes as the tail goes on: highs die first.
        y += (0.85 - 0.7 * k) * (x - y);
        d[i] = y * Math.pow(1 - k, 2.2) * (1 + (i < pre + sr * 0.06 ? 0.6 : 0));
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const revOut = ctx.createGain();
    revOut.gain.value = 0.5;
    const revLow = ctx.createBiquadFilter();
    revLow.type = "highpass";
    revLow.frequency.value = 180;
    this.reverb = ctx.createGain();
    this.reverb.connect(revLow);
    revLow.connect(conv);
    conv.connect(revOut);
    revOut.connect(this.sum);

    // Echo: a ping-pong dotted-eighth whose repeats darken as they bounce left and right.
    this.echo = ctx.createGain();
    const dl = ctx.createDelay(2);
    const dr = ctx.createDelay(2);
    const toneL = ctx.createBiquadFilter();
    const toneR = ctx.createBiquadFilter();
    for (const f of [toneL, toneR]) {
      f.type = "lowpass";
      f.frequency.value = 2800;
    }
    const fbL = ctx.createGain();
    const fbR = ctx.createGain();
    fbL.gain.value = 0.42;
    fbR.gain.value = 0.42;
    const merge = ctx.createChannelMerger(2);
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.55;
    this.echo.connect(dl);
    dl.connect(toneL);
    toneL.connect(merge, 0, 0);
    toneL.connect(fbL);
    fbL.connect(dr);
    dr.connect(toneR);
    toneR.connect(merge, 0, 1);
    toneR.connect(fbR);
    fbR.connect(dl);
    merge.connect(echoOut);
    echoOut.connect(this.sum);
    echoOut.connect(this.reverb);
    this.echoDelays = [dl, dr];

    // One shared vibrato LFO; held notes tap it through their own depth gain.
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.5;
    this.lfo.start();
  }

  /** The song playing, if any. */
  get song(): Song | null {
    return this.now?.song ?? null;
  }

  /** Where the song playing is: its bar from the start (fractional; after a wrap, back inside the loop). */
  position(): { song: Song; c: Compiled; bar: number } | null {
    const p = this.now;
    if (!p) return null;
    const now = this.ctx.currentTime;
    const t0 = now < p.wrapAt ? p.t0Prev : p.t0;
    return { song: p.song, c: p.c, bar: Math.max(0, (now - t0) / (240 / p.song.bpm)) };
  }

  /** True once a song played once (no loop) has rung out. */
  get done(): boolean {
    const p = this.now;
    return !!p && p.song.loop === null && this.ctx.currentTime > p.endsAt;
  }

  /** Jumps the song playing to `bar`: a quick crossfade into it starting there. */
  seek(bar: number): void {
    const p = this.now;
    if (!p) return;
    this.now = null;
    this.retire(p, this.ctx.currentTime, 0.06);
    this.play(p.song, 0, Math.max(0, Math.min(bar, p.c.bars - 0.01)));
  }

  /** Crossfades to a song (null fades out), from bar `from` (0: its start). */
  play(song: Song | null, fade?: number, from = 0): void {
    if (this.now?.song === song) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    if (this.now) this.retire(this.now, at, fade ?? (song ? 0.9 : 1.6));
    this.now = null;
    if (!song) return;
    const c = compileSong(song);
    const buses = {} as Record<Voice, GainNode>;
    const gates: Partial<Record<Voice, GainNode>> = {};
    const nodes: AudioNode[] = [];
    const level = { ...MIX, ...song.mix };
    const pan = { ...PAN, ...song.pan };
    const layers = song.layers ?? { perc: 0.45 };
    const kit = { drums: {}, perc: {} } as Playing["kit"];
    for (const v of VOICES) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(level[v], at + (from ? 0.04 : (song.fadeIn ?? 0.25)));
      let tail: AudioNode = g;
      const th = layers[v];
      if (th !== undefined) {
        const gate = ctx.createGain();
        gate.gain.value = this.level >= th ? 1 : 0;
        g.connect(gate);
        gates[v] = gate;
        nodes.push(gate);
        tail = gate;
      }
      if (pan[v]) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan[v];
        tail.connect(p);
        nodes.push(p);
        tail = p;
      }
      tail.connect(this.sum);
      const [rev, echo] = SEND[v];
      for (const [amt, dest] of [
        [rev, this.reverb],
        [echo, this.echo],
      ] as const) {
        if (!amt) continue;
        const s = ctx.createGain();
        s.gain.value = amt;
        tail.connect(s);
        s.connect(dest);
        nodes.push(s);
      }
      buses[v] = g;
      if (v === "drums" || v === "perc") {
        for (const [d, x] of Object.entries(KIT_PAN)) {
          const p = ctx.createStereoPanner();
          p.pan.value = x;
          p.connect(g);
          kit[v][d] = p;
          nodes.push(p);
        }
      }
    }
    for (const d of this.echoDelays) d.delayTime.setTargetAtTime((240 / song.bpm) * (3 / 16), at, 0.05);
    const t0 = at + 0.08 - from * (240 / song.bpm);
    const idx = from ? c.events.findIndex((e) => e.t >= from) : 0;
    this.now = { song, c, buses, gates, nodes, kit, t0, t0Prev: t0, wrapAt: 0, idx: idx < 0 ? c.events.length : idx, endsAt: t0 + c.bars * (240 / song.bpm) + 2 };
    this.schedule();
    if (this.timer === null && !this.offline) this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  /** How hard the game is going (0..1): voices Song.layers lists fade in above their threshold. */
  intensity(x: number): void {
    if (Math.abs(x - this.level) < 0.02) return;
    this.level = x;
    const p = this.now;
    if (!p) return;
    const layers = p.song.layers ?? { perc: 0.45 };
    const at = this.ctx.currentTime;
    for (const [v, gate] of Object.entries(p.gates) as [Voice, GainNode][]) gate.gain.setTargetAtTime(x >= layers[v]! ? 1 : 0, at, 0.9);
  }

  /** Paused: the music sinks behind a closing lowpass; unpaused it opens again. */
  paused(on: boolean): void {
    const at = this.ctx.currentTime;
    this.pauseFilter.frequency.setTargetAtTime(on ? 550 : 20000, at, on ? 0.18 : 0.3);
    this.pauseGain.gain.setTargetAtTime(on ? 0.6 : 1, at, 0.2);
  }

  /** Dips the music under a big sound: by `depth` (0..1), recovering after `hold` seconds. */
  duck(depth: number, hold: number): void {
    const g = this.duckGain.gain;
    const at = this.ctx.currentTime;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.setTargetAtTime(1 - depth, at, 0.03);
    g.setTargetAtTime(1, at + hold, 0.45);
  }

  /** Offline rendering: schedules every note up to context time `until`. */
  pump(until: number): void {
    this.schedule(until);
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
    if (this.offline) return;
    window.setTimeout(
      () => {
        for (const v of VOICES) p.buses[v].disconnect();
        for (const n of p.nodes) n.disconnect();
      },
      (fade + LOOK_HIDDEN + 3) * 1000,
    );
  }

  private schedule(until?: number): void {
    const p = this.now;
    if (!p) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      return;
    }
    const now = this.ctx.currentTime;
    const horizon = until ?? now + (document.hidden ? LOOK_HIDDEN : LOOK);
    const spb = 240 / p.song.bpm;
    const evs = p.c.events;
    for (;;) {
      if (p.idx >= evs.length) {
        if (p.song.loop === null) return;
        p.idx = p.c.loopIdx;
        p.t0Prev = p.t0;
        p.t0 += (p.c.bars - p.c.loopBar) * spb;
        p.wrapAt = p.t0Prev + p.c.bars * spb;
        continue;
      }
      const e = evs[p.idx]!;
      const t = p.t0 + e.t * spb;
      if (t > horizon) return;
      p.idx++;
      // Notes the scheduler fell behind on are dropped, never played in a burst.
      if (t < now - 0.02) continue;
      if (e.inst) {
        const gate = e.len * spb * (e.voice === "pad" ? 1 : (e.inst.gate ?? 0.92));
        this.note(e.inst, e.midi, t, gate, e.vel, p.buses[e.voice]);
      } else {
        const kit = p.kit[e.voice as "drums" | "perc"];
        this.drum(e.drum, t, e.vel, kit[e.drum] ?? p.buses[e.voice]);
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
      f.frequency.setValueAtTime(Math.min(16000, cut + (inst.env ?? 0) * (0.4 + 0.6 * vel)), t);
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
    for (const [i, [type, semi, cents, level, pan]] of inst.osc.entries()) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz * Math.pow(2, semi / 12);
      if (inst.scoop) {
        o.detune.setValueAtTime(cents - inst.scoop, t);
        o.detune.linearRampToValueAtTime(cents, t + 0.06);
      } else o.detune.value = cents;
      if (vib) vib.connect(o.detune);
      const lg = ctx.createGain();
      lg.gain.value = level;
      o.connect(lg);
      if (pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        lg.connect(p);
        p.connect(into);
        nodes.push(p);
      } else lg.connect(into);
      nodes.push(o, lg);
      if (i === 0 && inst.fm) {
        const m = ctx.createOscillator();
        m.frequency.value = hz * inst.fm.ratio;
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(hz * inst.fm.index * (0.6 + 0.4 * vel), t);
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

  private noise(t: number, dur: number, vel: number, type: BiquadFilterType, hz: number, dest: AudioNode, q = 0.7): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
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

  /** A pitched hit: a tone that drops from `from` to `to` Hz while it decays. */
  private thump(t: number, from: number, to: number, drop: number, dur: number, vel: number, type: OscillatorType, dest: AudioNode): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + drop);
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
        // A body that drops fast from a click, for punch.
        this.thump(t, 190, 46, 0.06, 0.34, vel * 1.1, "sine", dest);
        return this.noise(t, 0.012, vel * 0.35, "lowpass", 3500, dest);
      case "s":
        this.thump(t, 240, 175, 0.05, 0.12, vel * 0.45, "triangle", dest);
        this.noise(t, 0.19, vel * 0.6, "bandpass", 1900, dest, 0.6);
        return this.noise(t, 0.11, vel * 0.3, "highpass", 6000, dest);
      case "x":
        // A clap: three quick bursts and a tail.
        this.noise(t, 0.018, vel * 0.5, "bandpass", 1150, dest, 1.3);
        this.noise(t + 0.011, 0.018, vel * 0.5, "bandpass", 1150, dest, 1.3);
        return this.noise(t + 0.022, 0.15, vel * 0.55, "bandpass", 1150, dest, 1.3);
      case "h":
        return this.noise(t, 0.04, vel * 0.3, "highpass", 8000, dest);
      case "o":
        return this.noise(t, 0.28, vel * 0.22, "highpass", 7200, dest);
      case "c":
        this.noise(t, 1.8, vel * 0.22, "highpass", 4200, dest);
        return this.noise(t, 0.5, vel * 0.14, "bandpass", 8500, dest, 1.5);
      case "r":
        return this.noise(t, 0.35, vel * 0.14, "bandpass", 7200, dest, 2.5);
      case "t":
        return this.thump(t, 300, 210, 0.08, 0.28, vel * 0.55, "sine", dest);
      case "m":
        return this.thump(t, 220, 150, 0.08, 0.3, vel * 0.6, "sine", dest);
      case "l":
        return this.thump(t, 150, 95, 0.1, 0.36, vel * 0.7, "sine", dest);
    }
  }
}
