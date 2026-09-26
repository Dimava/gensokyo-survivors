// Music engine: songs are data (songs.ts) compiled once into a timeline of
// note events; a lookahead scheduler places every note on the AudioContext
// clock a few hundred milliseconds ahead, so frame hitches never smear the
// beat. Instruments are sampled (a grand piano, a trumpet and real cymbals,
// cut from the University of Iowa samples by scripts/music-samples.ts) or
// synthesized (oscillators with filter and amp envelopes, FM for bells and
// e-piano); the kick, snare, clap and toms are synthesized once into buffers
// when the engine starts. A generated-impulse stereo reverb and a tempo-synced
// ping-pong echo are shared sends. The music's sum runs through a wind filter,
// a pause filter and a ducker.
//
// Notation (one string per voice, bars separated by "|"): a bar's tokens split
// the bar evenly, and "[...]" splits one slot again, so "a4 _ c5 [d5 e5]" is
// quarter, held, quarter, two eighths. Tokens:
//   c5 f#4 bb3   absolute note (octave 4 holds middle C)
//   0 1 2 ...    chord tone of the chord sounding then (0 root, 1 third,
//                2 fifth, 3 seventh or root an octave up), in the voice's range
//   *            the whole chord at once (a stab), in the voice's range
//   _            hold the previous note one more slot (across bars too)
//   .            rest
//   suffix ^ ,   an octave up / down (repeatable); ! accent; ? soft;
//                ' short (staccato); ~ a fall off the end (brass)
//   drums        any mix of k kick, s snare, x clap, h hat, f pedal hat,
//                o open hat, c crash, r ride, b ride bell, p splash, n china,
//                q choked crash, w cymbal swell (peaks on the next barline),
//                z bowed cymbal, t m l high/mid/low tom ("kh", "s!")
// A part shorter than its section repeats to fill it. A section's `tr`
// transposes everything in it (key changes); its `inst` swaps instruments;
// its `dyn` shapes the phrase (velocity from..to across the section).
//
// Chords: Am, F#m7, Bbmaj7, G7sus4, Dm7/C (a slash names the bass), "~" holds
// the chord before (a passing slot), "N" is no chord (the pad rests: a run
// between two chords). The pad moves between chords by the nearest voicing
// (inversions that step), and with Song.voiceLead the arp and keys follow the
// same voicing.
//
// Adaptive play: the game names what is happening (a part: "midboss",
// "spell0", "last") and the song moves to that part's section on the next
// barline (or beat), through a fill if the part names one. A `vamp` section
// repeats until a part moves the song on; sections outside the form are only
// reached that way. The music room plays the form straight through.

import { FAMILIES, MARK, type Family, type SampleNote } from "./instruments/index.ts";

export type Voice = "lead" | "counter" | "keys" | "arp" | "bass" | "pad" | "drums" | "perc";
export type Melodic = Exclude<Voice, "drums" | "perc">;
export const VOICES: readonly Voice[] = ["lead", "counter", "keys", "arp", "bass", "pad", "drums", "perc"];
const DRUMLIKE = new Set<Voice>(["drums", "perc"]);

/** One oscillator layer: wave, semitones, detune cents, level, and an optional stereo pan. */
export type Layer = readonly [OscillatorType, number, number, number, number?];

/** One instrument: sampled (when its family has loaded) or layered oscillators through a lowpass with an envelope. */
export interface Inst {
  /** Plays this sample family (instruments/index.ts) once loaded; the oscillators stand in until then. */
  sample?: Family;
  /** Level of the sampled voice against the synthesized one (default 1). */
  sampleGain?: number;
  /** Level against the voice's mix (default 1): an instrument lent to a quieter voice (a second trumpet on keys) keeps its weight. */
  gain?: number;
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
  /** A sampled voice's lowpass (the oscillators' cut, kt, env and fd do not apply to it): softer notes are darker. */
  tone?: { cut: number; kt?: number; env?: number; fd?: number };
  /** Fraction of a note's length it sounds (default 0.92; 1 is legato). */
  gate?: number;
  /** A sampled note rings at least this many seconds unless played short (a sustain pedal: runs blur a little, as on a piano). */
  ring?: number;
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
  /** Adaptive play: the section repeats until a part moves the song on (the music room plays it once). */
  vamp?: boolean;
  /** A section outside the form goes on to this one when it ends (default: the loop point). */
  next?: string;
}

/** Where a part of the game takes the song. */
export interface Part {
  /** The section it moves to (in the form, or one kept outside it). */
  to: string;
  /** A section played on the way (a fill into it). */
  via?: string;
  /** When the move may happen: the next beat, half bar, bar (default), or every n bars from the section's start. */
  q?: "beat" | "half" | "bar" | number;
  /** Only forward: no move while the song is already at or past `to` in its form. */
  advance?: boolean;
  /** When the game leaves this part, the song moves here (a vamp's way out). */
  then?: string;
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
  /** Adaptive play: the game's moments, and the sections they take the song to. */
  parts?: Record<string, Part>;
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
const KIT_PAN: Record<string, number> = { k: 0, s: 0.05, x: -0.1, h: 0.28, f: 0.28, o: 0.28, c: -0.35, r: -0.3, b: -0.3, p: 0.35, n: 0.4, q: -0.35, w: 0, z: 0, t: 0.3, m: 0, l: -0.3 };

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
  /** Articulation: ' short, ~ fall off. */
  art?: "'" | "~";
}

/** A chord or section on the song's timeline (bars from its start). */
export interface Span {
  name: string;
  from: number;
  to: number;
}

/** One stretch of the timeline: a section where the form (or a move) puts it. */
export interface Place extends Span {
  /** Index in the form; -1 for a section outside it (after the form's end on the timeline). */
  form: number;
  vamp: boolean;
  /** For a section outside the form: the place it goes on to (-1: the loop point). */
  next: number;
}

interface Chord {
  sym: string;
  from: number;
  to: number;
  root: number;
  bass: number;
  tones: readonly number[];
  /** The pad's voicing (MIDI notes, ascending), led from the chord before. */
  voicing: number[];
  /** Semitones the section is transposed by. */
  tr: number;
}

export interface Compiled {
  events: Ev[];
  /** The form's length in bars (sections outside it come after, on the same timeline). */
  bars: number;
  loopBar: number;
  /** Chord symbols as sounding (transposed), and sections with their key. */
  chords: Span[];
  sections: (Span & { key: string })[];
  /** The timeline's stretches: the form's sections in order, then the ones outside it. */
  places: Place[];
  /** The place the song loops back to. */
  loopPlace: number;
  /** Chords with their tones and voicing (for flourishes on the chord sounding). */
  harmony: Chord[];
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
  "7b9": [0, 4, 7, 10, 13],
  mmaj7: [0, 3, 7, 11],
  "5": [0, 7, 12],
};
const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

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

function parseChord(sym: string): Omit<Chord, "sym" | "from" | "to" | "voicing" | "tr"> {
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

/** Resolves a melodic token to MIDI notes (a stab gives several), a velocity and an articulation. */
function resolve(tok: string, voice: Voice, chord: Chord | undefined, voiced: boolean): [number[], number, Ev["art"]] {
  let vel = 0.8;
  let up = 0;
  let art: Ev["art"];
  let s = tok;
  for (;;) {
    const c = s.at(-1);
    if (c === "!") vel = 1;
    else if (c === "?") vel = 0.5;
    else if (c === "^") up += 12;
    else if (c === ",") up -= 12;
    else if (c === "'" || c === "~") art = c;
    else break;
    s = s.slice(0, -1);
  }
  const note = /^([a-g])([#b]?)(\d)$/.exec(s);
  if (note) return [[12 * (Number(note[3]) + 1) + PC[note[1]!]! + (note[2] === "#" ? 1 : note[2] === "b" ? -1 : 0) + up], vel, art];
  if (!chord) throw new Error(`music: ${tok} needs a chord`);
  const base = BASE[voice];
  const inRange = (pc: number): number => base + ((pc - base + 120) % 12);
  if (voiced && voice !== "bass" && chord.voicing.length) {
    const v = lift(chord.voicing, base);
    if (s === "*") return [v.map((x) => x + up), vel, art];
    if (/^\d$/.test(s)) {
      const i = Number(s);
      return [[v[i % v.length]! + 12 * Math.floor(i / v.length) + up], vel, art];
    }
  }
  if (s === "*") return [chord.tones.map((iv) => inRange(chord.root + iv) + up), vel, art];
  if (/^\d$/.test(s)) {
    const i = Number(s);
    const root = inRange(i === 0 && voice === "bass" ? chord.bass : chord.root);
    const n = chord.tones.length;
    const iv = i === 0 && voice === "bass" ? 0 : chord.tones[i % n]!;
    return [[root + iv + 12 * Math.floor(i / n) + up], vel, art];
  }
  throw new Error(`music: bad token ${tok}`);
}

const cache = new WeakMap<Song, Compiled>();

/** Compiles a song once (cached): its events in time order, its sections and chords, and where it loops. */
export function compileSong(song: Song): Compiled {
  const hit = cache.get(song);
  if (hit) return hit;
  const events: Ev[] = [];
  const chordSpans: Span[] = [];
  const sectionSpans: Compiled["sections"] = [];
  const places: Place[] = [];
  const harmony: Chord[] = [];
  let voicing: number[] | null = null;
  let bar = 0;
  let loopPlace = 0;
  let seed = 7;
  const jitter = (): number => {
    seed = (seed * 16807) % 2147483647;
    return 0.96 + (seed / 2147483647) * 0.08;
  };
  const islands = Object.keys(song.sections).filter((n) => !song.form.includes(n));
  const order: [string, number][] = [...song.form.map((n, i): [string, number] => [n, i]), ...islands.map((n): [string, number] => [n, -1])];
  let formBars = 0;
  for (const [name, fi] of order) {
    const sec = song.sections[name];
    if (!sec) throw new Error(`music: no section ${name}`);
    if (fi === -1 && !formBars) formBars = bar;
    if (fi === song.loop) loopPlace = places.length;
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
          chords.push({ ...c, sym, from, to, voicing, tr });
        }
      });
    });
    const bars = chordBars.length;
    for (const c of chords) {
      chordSpans.push({ name: transposeName(c.sym, tr), from: bar + c.from, to: bar + c.to });
      harmony.push({ ...c, from: bar + c.from, to: bar + c.to });
    }
    sectionSpans.push({ name, from: bar, to: bar + bars, key: song.key ? transposeName(song.key, tr) : "" });
    places.push({ name, from: bar, to: bar + bars, form: fi, vamp: !!sec.vamp, next: -1 });
    const chordAt = (t: number): Chord | undefined => chords.find((c) => t + 1e-6 >= c.from && t + 1e-6 < c.to);
    const [dyn0, dyn1] = sec.dyn ?? [1, 1];
    const push = (voice: Voice, local: number, length: number, midi: number, drum: string, vel: number, art?: Ev["art"]): void => {
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
      const ev: Ev = { t, len, voice, midi: midi + (drum ? 0 : tr), drum, vel: vel * accent * shape * jitter(), inst };
      if (art) ev.art = art;
      events.push(ev);
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
            // A swell rises to the next barline, whatever else shares its slot.
            for (const d of tok) push(voice, local, d === "w" ? Math.ceil(local + 1e-6) - local : h.len, 0, d, vel);
          } else {
            const [notes, vel, art] = resolve(h.tok, voice, chordAt(local), !!song.voiceLead);
            for (const n of notes) push(voice, local, h.len, n, "", vel, art);
          }
        }
      }
    }
    if (sec.drums && sec.crash !== false) push("drums", 0, 1, 0, "c", 0.7);
    if (sec.pad !== false) {
      for (const c of chords) for (const n of c.voicing) push("pad", c.from, c.to - c.from, n, "", 0.8);
    }
    bar += bars;
  }
  if (!formBars) formBars = bar;
  for (const p of places) {
    const next = song.sections[p.name]!.next;
    if (p.form === -1 && next) p.next = places.findIndex((q) => q.name === next);
  }
  events.sort((a, b) => a.t - b.t);
  const out: Compiled = { events, bars: formBars, loopBar: places[loopPlace]?.from ?? 0, chords: chordSpans, sections: sectionSpans, places, loopPlace, harmony };
  cache.set(song, out);
  return out;
}

/** A song's length in seconds (to its end, and the looping part). */
export function songLength(song: Song): { total: number; loop: number } {
  const c = compileSong(song);
  const spb = 240 / song.bpm;
  return { total: c.bars * spb, loop: song.loop === null ? 0 : (c.bars - c.loopBar) * spb };
}

/** Index of the first event at or after bar `t`. */
function lowerBound(evs: readonly Ev[], t: number): number {
  let lo = 0;
  let hi = evs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (evs[mid]!.t < t - 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The bar a move happens on: the first boundary of quantum `q` at or after `bar` (within the place). */
export function moveBar(q: Part["q"], bar: number, place: Span): number {
  const eps = 1e-6;
  let b: number;
  if (q === "beat") b = Math.ceil(bar * 4 - eps) / 4;
  else if (q === "half") b = Math.ceil(bar * 2 - eps) / 2;
  else if (typeof q === "number") b = place.from + Math.ceil((bar - place.from) / q - eps) * q;
  else b = Math.ceil(bar - eps);
  return Math.min(Math.max(b, place.from), place.to);
}

// ---------- samples ----------

interface SampleSet {
  buf: AudioBuffer;
  /** Each note with its start in the buffer (seconds). */
  notes: (SampleNote & { off: number })[];
}

const SAMPLES = new WeakMap<BaseAudioContext, Partial<Record<Family, SampleSet>>>();
const LOADING = new WeakMap<BaseAudioContext, Promise<void>>();

/** Fetches and decodes the sample families for a context (once); notes play synthesized until they arrive. */
export function loadSamples(ctx: BaseAudioContext, url: (family: Family) => string = (f) => FAMILIES[f].url): Promise<void> {
  const had = LOADING.get(ctx);
  if (had) return had;
  const sets: Partial<Record<Family, SampleSet>> = {};
  SAMPLES.set(ctx, sets);
  const job = Promise.all(
    (Object.keys(FAMILIES) as Family[]).map(async (f) => {
      try {
        const res = await fetch(url(f));
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        sets[f] = { buf, notes: FAMILIES[f].notes.map((n) => ({ ...n, off: findMark(buf) + n.at })) };
      } catch (e) {
        console.warn(`music: ${f} samples did not load`, e);
      }
    }),
  ).then(() => undefined);
  LOADING.set(ctx, job);
  return job;
}

/**
 * Where a family's timing marker sits in its decoded buffer (seconds): a
 * short 5 kHz burst MARK seconds into the file, after silence, moved by any
 * codec delay. Found by shape, not loudness (the notes are louder): the
 * first sample above 0.2, then the centre of the burst's energy around it.
 */
export function findMark(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const lim = Math.min(d.length, Math.floor(sr * 0.3));
  let i0 = 0;
  while (i0 < lim && Math.abs(d[i0]!) < 0.2) i0++;
  let sum = 0;
  let at = 0;
  for (let i = Math.max(0, i0 - Math.floor(sr * 0.002)); i < Math.min(lim, i0 + Math.floor(sr * 0.008)); i++) {
    const e = d[i]! * d[i]!;
    sum += e;
    at += e * i;
  }
  const mark = sum ? at / sum / sr : MARK;
  return mark >= MARK - 0.01 && mark <= MARK + 0.1 ? mark : MARK;
}

/** Which kit sample each drum letter plays (several: taken in turn). */
const KIT_SAMPLE: Record<string, readonly string[]> = {
  h: ["hat"],
  f: ["pedal"],
  o: ["open"],
  c: ["crash", "crash2"],
  r: ["ride"],
  b: ["bell"],
  p: ["splash"],
  n: ["china"],
  q: ["choke"],
  w: ["swell"],
  z: ["bow"],
};
/** Kit sample levels against the synthesized drums. */
const KIT_GAIN: Record<string, number> = { h: 0.55, f: 0.5, o: 0.5, c: 0.75, r: 0.55, b: 0.5, p: 0.65, n: 0.6, q: 0.8, w: 0.9, z: 0.8 };

// ---------- baked drums: synthesized once into buffers ----------

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff) * 2 - 1;
  };
}

/** An RBJ biquad over a whole buffer. */
function biquad(x: Float32Array, type: "lp" | "hp" | "bp", f: number, q: number, sr: number): Float32Array {
  const w = (2 * Math.PI * f) / sr;
  const cw = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (type === "lp") [b0, b1, b2] = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2];
  else if (type === "hp") [b0, b1, b2] = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2];
  else [b0, b1, b2] = [alpha, 0, -alpha];
  const a0 = 1 + alpha;
  const a1 = -2 * cw;
  const a2 = 1 - alpha;
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b0 * x[i]! + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x[i]!;
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** The kick, snare, clap and toms, a few takes of each (taken in turn so repeats never sound identical). */
function bakeDrums(sr: number): Record<string, Float32Array[]> {
  const out: Record<string, Float32Array[]> = {};
  const len = (s: number): number => Math.floor(s * sr);
  const sat = (v: number, k: number): number => Math.tanh(v * k) / Math.tanh(k);
  out.k = [0, 1, 2].map((v) => {
    const n = len(0.5);
    const noise = rng(11 + v);
    const click = new Float32Array(n);
    for (let i = 0; i < len(0.01); i++) click[i] = noise() * Math.exp(-i / sr / 0.0022);
    const cl = biquad(click, "lp", 5500, 0.7, sr);
    const x = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // A body that drops from a punch to 50 Hz, a beater click on top.
      const f = 50 + (125 + v * 4) * Math.exp(-t / 0.032) + 70 * Math.exp(-t / 0.004);
      ph += (2 * Math.PI * f) / sr;
      const amp = Math.min(1, t / 0.001) * (0.75 * Math.exp(-t / 0.24) + 0.25 * Math.exp(-t / 0.05));
      x[i] = sat(Math.sin(ph) * amp * 1.1 + cl[i]! * 0.5, 1.6);
    }
    return x;
  });
  out.s = [0, 1, 2].map((v) => {
    const n = len(0.42);
    const noise = rng(101 + v * 7);
    const white = new Float32Array(n);
    for (let i = 0; i < n; i++) white[i] = noise();
    // Wires: bright noise, a crack at the front and a hiss that rings on.
    const wires = biquad(biquad(white, "hp", 1400 + v * 60, 0.6, sr), "lp", 9500, 0.6, sr);
    const crack = biquad(white, "bp", 3200, 0.8, sr);
    const x = new Float32Array(n);
    let p1 = 0;
    let p2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // Two drumhead modes that drop a little as they are struck.
      p1 += (2 * Math.PI * (182 + v * 3) * (1 + 0.35 * Math.exp(-t / 0.01))) / sr;
      p2 += (2 * Math.PI * 331 * (1 + 0.2 * Math.exp(-t / 0.008))) / sr;
      const body = Math.sin(p1) * Math.exp(-t / 0.07) + 0.55 * Math.sin(p2) * Math.exp(-t / 0.04);
      const hiss = wires[i]! * (0.72 * Math.exp(-t / 0.15) + 0.5 * Math.exp(-t / 0.018)) + crack[i]! * 0.8 * Math.exp(-t / 0.012);
      x[i] = sat(Math.min(1, t / 0.0008) * (0.62 * body + 0.95 * hiss), 1.4) * 0.9;
    }
    return x;
  });
  out.x = [0, 1].map((v) => {
    const n = len(0.35);
    const noise = rng(301 + v);
    const white = new Float32Array(n);
    for (let i = 0; i < n; i++) white[i] = noise();
    const band = biquad(biquad(white, "bp", 1150 + v * 80, 1.1, sr), "hp", 600, 0.7, sr);
    const x = new Float32Array(n);
    const hits = [0, 0.0105, 0.0215, 0.031];
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      let e = 0;
      for (const h of hits) if (t >= h) e = Math.max(e, Math.exp(-(t - h) / 0.0045));
      if (t >= 0.031) e = Math.max(e, 0.75 * Math.exp(-(t - 0.031) / 0.11));
      x[i] = sat(band[i]! * e * 2.4, 1.2);
    }
    return x;
  });
  const tom = (f0: number, seed: number): Float32Array[] =>
    [0, 1].map((v) => {
      const n = len(0.55);
      const noise = rng(seed + v);
      const x = new Float32Array(n);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        ph += (2 * Math.PI * f0 * (1 + 0.45 * Math.exp(-t / 0.045) + v * 0.01)) / sr;
        x[i] = sat((Math.sin(ph) * Math.exp(-t / 0.3) + noise() * 0.18 * Math.exp(-t / 0.012)) * Math.min(1, t / 0.001), 1.3);
      }
      return x;
    });
  out.t = tom(205, 501);
  out.m = tom(152, 601);
  out.l = tom(104, 701);
  return out;
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
  /** Adaptive play: vamps hold and parts move the song. */
  adaptive: boolean;
  /** The part the game last named. */
  part: string;
  /** Context time of bar 0 for the stretch playing now, and earlier ones: [context time it holds from, t0]. */
  t0: number;
  history: [number, number][];
  /** Next event to schedule, and the place (Compiled.places) it is in. */
  idx: number;
  place: number;
  /** A move waiting: the bar it cuts in at, and the places to play from there. */
  cut: number | null;
  queue: number[];
  /** Context time scheduled up to. */
  frontier: number;
  /** Context time the song (played once) ends; Infinity while it loops. */
  endsAt: number;
  /** Each bus's level, and the context time its fade-in reaches it. */
  levels: Record<Voice, number>;
  steady: number;
  /** A song fading out plays on until its fade ends (Infinity while it is the song). */
  until: number;
  /** Its notes still sounding, for moves that cut them short. */
  held: Held[];
}

/** A sounding note, for moves that cut held notes short. */
interface Held {
  gain: GainNode;
  end: number;
  r: number;
}

export interface PlayOpts {
  /** Crossfade seconds from the song before (default 0.9; 1.6 to silence). */
  fade?: number;
  /** Start at this bar. */
  from?: number;
  /** The game's part: vamps hold, and the song starts at the part's section. */
  part?: string;
  /** Adaptive play (the game); the music room plays straight through. */
  adaptive?: boolean;
  /** Seconds before the song starts. */
  delay?: number;
}

export class Music {
  /** The music's sum: every bus and effect return, before the wind filter, pause filter and ducker. */
  private sum: GainNode;
  private windFilter: BiquadFilterNode;
  private pauseFilter: BiquadFilterNode;
  private pauseGain: GainNode;
  private duckGain: GainNode;
  private reverb: GainNode;
  private echo: GainNode;
  private echoDelays: DelayNode[];
  private lfo: OscillatorNode;
  /** A tape: the mix through a delay whose time the winds stretch, so everything slows and drops flat. */
  private tape: DelayNode;
  /** Flourishes and winds: always heard, whatever the song's layers. */
  private fx: GainNode;
  private now: Playing | null = null;
  /** Songs fading out: they play on through their fade (a crossfade, the winds' sweep). */
  private leaving: Playing[] = [];
  private timer: number | null = null;
  private noiseAt = 0;
  private level = 0;
  private held: Held[] = [];
  private drums: Record<string, AudioBuffer[]>;
  private turn = new Map<string, number>();

  constructor(
    private ctx: BaseAudioContext,
    out: AudioNode,
    private noiseBuf: AudioBuffer,
    /** Offline rendering: no timer; pump() schedules. */
    private offline = false,
  ) {
    this.sum = ctx.createGain();
    this.tape = ctx.createDelay(1.5);
    this.tape.delayTime.value = 0;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 20000;
    this.windFilter.Q.value = 0.7;
    this.pauseFilter = ctx.createBiquadFilter();
    this.pauseFilter.type = "lowpass";
    this.pauseFilter.frequency.value = 20000;
    this.pauseFilter.Q.value = 0.9;
    this.pauseGain = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.sum.connect(this.tape);
    this.tape.connect(this.windFilter);
    this.windFilter.connect(this.pauseFilter);
    this.pauseFilter.connect(this.pauseGain);
    this.pauseGain.connect(this.duckGain);
    this.duckGain.connect(out);

    // Reverb: a convolver over 2.4 s of stereo noise that decays and darkens, after a short pre-delay.
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * 2.4);
    const pre = Math.floor(sr * 0.016);
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

    this.fx = ctx.createGain();
    this.fx.gain.value = 1;
    this.fx.connect(this.pauseFilter);
    const fxRev = ctx.createGain();
    fxRev.gain.value = 0.35;
    this.fx.connect(fxRev);
    fxRev.connect(this.reverb);

    const baked = bakeDrums(sr);
    this.drums = {};
    for (const [k, takes] of Object.entries(baked)) {
      this.drums[k] = takes.map((x) => {
        const b = ctx.createBuffer(1, x.length, sr);
        b.getChannelData(0).set(x);
        return b;
      });
    }
  }

  /** The song playing, if any. */
  get song(): Song | null {
    return this.now?.song ?? null;
  }

  /** Where the song playing is: its bar on the timeline (fractional; after a loop or a move, where it moved to). */
  position(): { song: Song; c: Compiled; bar: number } | null {
    const p = this.now;
    if (!p) return null;
    const now = this.ctx.currentTime;
    let t0 = p.history[0]?.[1] ?? p.t0;
    for (const [at, t] of p.history) if (at <= now) t0 = t;
    return { song: p.song, c: p.c, bar: Math.max(0, (now - t0) / (240 / p.song.bpm)) };
  }

  /** The section playing now. */
  section(): string | null {
    const pos = this.position();
    if (!pos) return null;
    return pos.c.places.find((pl) => pos.bar >= pl.from - 1e-6 && pos.bar < pl.to)?.name ?? null;
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
    this.play(p.song, { fade: 0, from: Math.max(0, Math.min(bar, p.c.places.at(-1)!.to - 0.01)), adaptive: p.adaptive, part: p.part });
  }

  /** Crossfades to a song (null fades out). */
  play(song: Song | null, opts: PlayOpts = {}): void {
    if (this.now?.song === song) return;
    const ctx = this.ctx;
    const at = ctx.currentTime;
    if (this.now) this.retire(this.now, at, opts.fade ?? (song ? 0.9 : 1.6));
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
    const start = at + (opts.delay ?? 0);
    // Where it starts: a bar asked for, else the part's section (straight in, no fill), else the top.
    const part = opts.part ?? "";
    const target = song.parts?.[part]?.to;
    const partPlace = target ? c.places.findIndex((pl) => pl.name === target) : -1;
    const from = opts.from ?? (partPlace >= 0 ? c.places[partPlace]!.from : 0);
    const place = Math.max(0, c.places.findIndex((pl) => from >= pl.from - 1e-6 && from < pl.to));
    const steady = start + (from ? 0.04 : (song.fadeIn ?? 0.25));
    for (const v of VOICES) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(level[v], steady);
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
    const t0 = start + 0.08 - from * (240 / song.bpm);
    this.now = {
      song,
      c,
      buses,
      gates,
      nodes,
      kit,
      adaptive: !!opts.adaptive,
      part,
      t0,
      history: [[at, t0]],
      idx: lowerBound(c.events, from),
      place,
      cut: null,
      queue: [],
      frontier: at,
      endsAt: Infinity,
      levels: level,
      steady,
      until: Infinity,
      held: [],
    };
    this.schedule();
    if (this.timer === null && !this.offline) this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  /**
   * The game's moment: moves the song to the part's section on its next
   * boundary (a vamp holds until then). Leaving a part with a way out
   * (`then`) moves the song there.
   */
  part(name: string): void {
    const p = this.now;
    if (!p || name === p.part) return;
    const prev = p.part;
    p.part = name;
    if (!p.adaptive) return;
    const parts = p.song.parts ?? {};
    const out = parts[prev]?.then;
    const def: Part | undefined = parts[name] ?? (out ? { to: out, q: parts[prev]!.q } : undefined);
    if (def) this.move(p, def);
  }

  private move(p: Playing, def: Part): void {
    const c = p.c;
    const target = c.places.findIndex((pl) => pl.name === def.to);
    if (target < 0) return;
    const cur = c.places[p.place]!;
    const tp = c.places[target]!;
    if (def.advance && cur.form >= 0 && tp.form >= 0 && cur.form >= tp.form) return;
    const spb = 240 / p.song.bpm;
    // After everything already scheduled, on the part's boundary (or the place's end, if sooner).
    const bar = (Math.max(p.frontier, this.ctx.currentTime) - p.t0) / spb + 1e-4;
    p.cut = moveBar(def.q, Math.max(bar, cur.from), cur);
    const via = def.via ? c.places.findIndex((pl) => pl.name === def.via) : -1;
    p.queue = via >= 0 ? [via, target] : [target];
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

  /**
   * The boss's winds take the song: a gust rises, the music is swept up
   * into a closing, whistling filter and bent flat, and it is gone. The
   * wind blows on for `seconds`.
   */
  blowAway(seconds = 4): void {
    const ctx = this.ctx;
    const at = ctx.currentTime;
    const p = this.now;
    this.now = null;
    if (p) this.retire(p, at + 0.9, 1.1);
    const f = this.windFilter.frequency;
    const q = this.windFilter.Q;
    const d = this.tape.delayTime;
    for (const prm of [f, q, d]) prm.cancelScheduledValues(at);
    f.setValueAtTime(20000, at);
    f.exponentialRampToValueAtTime(5000, at + 0.35);
    f.exponentialRampToValueAtTime(1400, at + 0.9);
    f.exponentialRampToValueAtTime(320, at + 1.9);
    f.setValueAtTime(20000, at + 2.4);
    q.setValueAtTime(0.7, at);
    q.linearRampToValueAtTime(7, at + 1.2);
    q.setValueAtTime(0.7, at + 2.4);
    // A warble, then a fall: the tape stretches (pitch drops as the delay grows), slack, then drags to a stop.
    const curve = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      const x = (i / 63) * 2.2;
      curve[i] = x < 0.25 ? 0.024 * x : x < 0.5 ? 0.006 - 0.008 * (x - 0.25) : x < 0.8 ? 0.004 + 0.027 * (x - 0.5) : 0.012 + 0.21 * (x - 0.8) ** 2;
    }
    d.setValueCurveAtTime(curve, at, 2.2);
    d.setValueAtTime(0, at + 2.45);
    // The effects bus skips the voices' levels: these sit a little over where the music was.
    this.gust(at, seconds, 0.55);
    this.sample("kit", "choke", at + 0.85, 0.3, this.fx, 1);
    this.sample("kit", "bow", at + 0.2, 0.5, this.fx, 1);
  }

  /** A gust of wind on the music's own bus: filtered noise that howls and pans across. */
  gust(at: number, seconds: number, strength: number): void {
    const ctx = this.ctx;
    const noise = rng(4242 + Math.floor(at * 10));
    for (const [side, hz, qv, lvl] of [
      [-0.6, 420, 1.4, 0.5],
      [0.6, 610, 1.4, 0.5],
      [0, 950, 9, 0.28],
    ] as const) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = qv;
      // The pitch of the wind wanders: a slow random walk, rising as it peaks.
      const fr = bp.frequency;
      fr.setValueAtTime(hz * 0.6, at);
      for (let k = 1; k <= seconds * 4; k++) {
        const t = at + k / 4;
        const rise = Math.sin(Math.min(1, t - at) * Math.PI * 0.5);
        fr.linearRampToValueAtTime(hz * (0.7 + 0.6 * rise + 0.35 * noise()), t);
      }
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(lvl * strength * 0.5, at + 0.5);
      g.gain.linearRampToValueAtTime(lvl * strength, at + 1.1);
      g.gain.setTargetAtTime(lvl * strength * 0.55, at + 1.6, 0.6);
      g.gain.setTargetAtTime(0, at + seconds - 1.2, 0.4);
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(side, at);
      pan.pan.linearRampToValueAtTime(-side * 0.8, at + seconds);
      src.connect(bp);
      bp.connect(g);
      g.connect(pan);
      pan.connect(this.fx);
      src.start(at, (Math.abs(noise()) * 0.8) % 0.8);
      src.stop(at + seconds + 0.1);
      src.addEventListener("ended", () => {
        for (const n of [src, bp, g, pan]) n.disconnect();
      });
    }
  }

  /**
   * A flourish over the song on its chord: a run of glass up two octaves on
   * the next sixteenth (a spell card captured), shorter for one broken.
   */
  flourish(kind: "captured" | "broken"): void {
    const p = this.now;
    if (!p) return;
    const spb = 240 / p.song.bpm;
    const now = Math.max(this.ctx.currentTime + 0.05, p.frontier);
    const bar = Math.ceil(((now - p.t0) / spb) * 16) / 16;
    const chord = p.c.harmony.find((h) => bar >= h.from - 1e-6 && bar < h.to) ?? p.c.harmony.find((h) => h.from >= bar);
    if (!chord) return;
    const n = kind === "captured" ? 12 : 6;
    const v = lift(chord.voicing, 72).map((m) => m + chord.tr);
    const glass: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 2, index: 1.2, decay: 0.08 }, a: 0.002, d: 0.22, s: 0, r: 0.2 };
    for (let i = 0; i < n; i++) {
      const midi = v[i % v.length]! + 12 * Math.floor(i / v.length);
      // On the effects bus (no voice level): about as loud as the lead, rising.
      this.note(glass, Math.min(midi, 100), p.t0 + (bar + i / 32) * spb, 0.12, 0.085 + (0.075 * i) / n, this.fx);
    }
    if (kind === "captured") this.sample("kit", "crash", p.t0 + (bar + n / 32) * spb, 0.2, this.fx, 1);
  }

  /** Offline rendering: schedules every note up to context time `until`. */
  pump(until: number): void {
    this.schedule(until);
  }

  /** Fades a song's buses out, then disconnects them once every scheduled note has rung out. */
  private retire(p: Playing, at: number, fade: number): void {
    for (const v of VOICES) {
      const g = p.buses[v].gain;
      // The fade starts from the level at `at`: a fade-in still rising is held where it got to (Firefox
      // lacks cancelAndHold: .value is close enough there); a steady bus is set there, since with nothing
      // scheduled after `at` Chrome's cancelAndHold adds no event, and the ramp would run from the
      // fade-in's end, dropping the song at once instead of fading it.
      if (at < p.steady && g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at);
      else {
        g.cancelScheduledValues(at);
        g.setValueAtTime(at < p.steady ? g.value : p.levels[v], at);
      }
      g.linearRampToValueAtTime(0, at + fade);
    }
    p.until = at + fade;
    this.leaving.push(p);
    if (this.offline) return;
    window.setTimeout(
      () => {
        for (const v of VOICES) p.buses[v].disconnect();
        for (const n of p.nodes) n.disconnect();
      },
      (at - this.ctx.currentTime + fade + LOOK_HIDDEN + 3) * 1000,
    );
  }

  /** Cuts a song's notes still sounding at `at` short (a move jumps away from what they belonged to). */
  private releaseAt(p: Playing, at: number): void {
    this.trim(p.held);
    for (const h of p.held) {
      if (h.end <= at + 0.02) continue;
      const g = h.gain.gain;
      g.cancelScheduledValues(at);
      g.setTargetAtTime(0, at, Math.min(0.05, h.r / 4));
      h.end = at;
    }
  }

  /** Drops notes that have ended from a held list (in place: run() lends it to note()). */
  private trim(held: Held[]): void {
    const now = this.ctx.currentTime;
    let k = 0;
    for (const h of held) if (h.end > now - 0.05) held[k++] = h;
    held.length = k;
  }

  private schedule(until?: number): void {
    const now = this.ctx.currentTime;
    const horizon = until ?? now + (typeof document !== "undefined" && document.hidden ? LOOK_HIDDEN : LOOK);
    this.leaving = this.leaving.filter((q) => q.until > now);
    if (this.held.length > 64) this.trim(this.held);
    for (const q of this.leaving) this.run(q, Math.min(horizon, q.until));
    const p = this.now;
    if (p) this.run(p, horizon);
    else if (!this.leaving.length && this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Schedules a song's notes up to `horizon`. */
  private run(p: Playing, horizon: number): void {
    const now = this.ctx.currentTime;
    const outer = this.held;
    if (p.held.length > 64) this.trim(p.held);
    this.held = p.held;
    try {
      this.runNotes(p, horizon, now);
    } finally {
      this.held = outer;
    }
    p.frontier = Math.max(p.frontier, horizon);
  }

  private runNotes(p: Playing, horizon: number, now: number): void {
    const spb = 240 / p.song.bpm;
    const evs = p.c.events;
    for (;;) {
      const place = p.c.places[p.place]!;
      const end = p.cut ?? place.to;
      const e = evs[p.idx];
      if (!e || e.t >= end - 1e-9) {
        // This stretch ends: on to the next place (the form's next section, a vamp again, a move, the loop).
        const at = p.t0 + end * spb;
        if (at > horizon) break;
        if (!this.advance(p, end, at)) break;
        continue;
      }
      const t = p.t0 + e.t * spb;
      if (t > horizon) break;
      p.idx++;
      // Notes the scheduler fell behind on are dropped, never played in a burst.
      if (t < now - 0.02) continue;
      if (e.inst) {
        const gate = e.len * spb * (e.voice === "pad" ? 1 : e.art === "'" ? 0.45 : (e.inst.gate ?? 0.92));
        this.note(e.inst, e.midi, t, gate, e.vel, p.buses[e.voice], e.art);
      } else {
        const kit = p.kit[e.voice as "drums" | "perc"];
        this.drum(e.drum, t, e.vel, kit[e.drum] ?? p.buses[e.voice], e.len * spb);
      }
    }
  }

  /** Moves the song on at bar `end` (context time `at`); false when a song played once is over. */
  private advance(p: Playing, end: number, at: number): boolean {
    const c = p.c;
    const place = c.places[p.place]!;
    let next: number;
    if (p.queue.length) next = p.queue.shift()!;
    else if (p.adaptive && place.vamp && p.cut === null) next = p.place;
    else if (place.form === -1) next = place.next >= 0 ? place.next : c.loopPlace;
    else if (place.form + 1 < p.song.form.length) next = p.place + 1;
    else if (p.song.loop === null) {
      p.endsAt = Math.min(p.endsAt, at + 2);
      p.idx = c.events.length;
      p.cut = null;
      return false;
    } else next = c.loopPlace;
    const to = c.places[next]!.from;
    const jump = Math.abs(to - end) > 1e-6;
    p.t0 = at - to * (240 / p.song.bpm);
    if (jump) {
      p.history.push([at, p.t0]);
      if (p.history.length > 8) p.history.shift();
      this.releaseAt(p, at);
    }
    p.idx = lowerBound(c.events, to);
    p.place = next;
    p.cut = null;
    return true;
  }

  // ---------- voices ----------

  private note(inst: Inst, midi: number, t: number, gate: number, vel: number, dest: AudioNode, art?: Ev["art"]): void {
    const set = inst.sample ? SAMPLES.get(this.ctx)?.[inst.sample] : undefined;
    if (set) return this.sampled(set, inst, midi, t, art === "'" ? gate : Math.max(gate, inst.ring ?? 0), vel, dest, art === "~");
    const fall = art === "~";
    const ctx = this.ctx;
    const hz = 440 * Math.pow(2, (midi - 69) / 12);
    const nodes: AudioNode[] = [];
    const amp = ctx.createGain();
    nodes.push(amp);
    const end = t + Math.max(gate, inst.a + 0.01);
    const stop = end + inst.r * 1.5 + 0.03;
    const g = amp.gain;
    const peak = vel * (inst.gain ?? 1);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(peak, t + inst.a);
    if (inst.s < 1) g.setTargetAtTime(peak * inst.s, t + inst.a, inst.d);
    g.setTargetAtTime(0, end, inst.r / 4);
    this.held.push({ gain: amp, end, r: inst.r });
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
      if (fall) o.detune.setTargetAtTime(cents - 500, end - 0.02, 0.07);
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

  /** A sampled note: the nearest recorded note, repitched, looped through its sustain if it is held past it. */
  private sampled(set: SampleSet, inst: Inst, midi: number, t: number, gate: number, vel: number, dest: AudioNode, fall: boolean): void {
    const ctx = this.ctx;
    let n = set.notes[0]!;
    for (const x of set.notes) if (Math.abs(x.midi - midi) < Math.abs(n.midi - midi) || (Math.abs(x.midi - midi) === Math.abs(n.midi - midi) && x.midi > n.midi)) n = x;
    const cents = (midi - n.midi) * 100 - n.cents;
    const src = ctx.createBufferSource();
    src.buffer = set.buf;
    const rate = Math.pow(2, cents / 1200);
    src.playbackRate.value = rate;
    if (n.loop) {
      src.loop = true;
      src.loopStart = n.off + n.loop[0];
      src.loopEnd = n.off + n.loop[1];
    }
    const d = src.detune;
    if (inst.scoop) {
      d.setValueAtTime(-inst.scoop, t);
      d.linearRampToValueAtTime(0, t + 0.07);
    }
    const end = t + Math.max(gate, 0.03);
    if (fall) d.setTargetAtTime(-600, end - 0.03, 0.08);
    const amp = ctx.createGain();
    const lvl = Math.pow(vel, 1.4) * n.gain * (inst.sampleGain ?? 1) * (inst.gain ?? 1);
    const g = amp.gain;
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(lvl, t + Math.max(0.002, Math.min(inst.a, 0.03)));
    g.setTargetAtTime(0, end, inst.r / 4);
    this.held.push({ gain: amp, end, r: inst.r });
    const nodes: AudioNode[] = [src, amp];
    let into: AudioNode = amp;
    const tone = inst.tone;
    if (tone) {
      const hz = 440 * Math.pow(2, (midi - 69) / 12);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.Q.value = 0.5;
      const cut = Math.min(18000, tone.cut + (tone.kt ?? 0) * hz);
      f.frequency.setValueAtTime(Math.min(18000, cut + (tone.env ?? 0) * vel * vel), t);
      if (tone.env) f.frequency.setTargetAtTime(cut, t, tone.fd ?? 0.2);
      f.connect(amp);
      nodes.push(f);
      into = f;
    }
    src.connect(into);
    amp.connect(dest);
    let vib: GainNode | null = null;
    if (inst.vib && gate > inst.vib.delay + 0.1) {
      vib = ctx.createGain();
      vib.gain.setValueAtTime(0, t + inst.vib.delay);
      vib.gain.linearRampToValueAtTime(inst.vib.depth, t + inst.vib.delay + 0.35);
      this.lfo.connect(vib);
      vib.connect(d);
      nodes.push(vib);
    }
    const room = n.loop ? Infinity : n.len / rate;
    src.start(t, n.off);
    src.stop(Math.min(t + room, end + inst.r * 1.5 + 0.03));
    const v = vib;
    src.addEventListener("ended", () => {
      if (v) this.lfo.disconnect(v);
      for (const x of nodes) x.disconnect();
    });
  }

  /** One kit sample by name; false if the kit has not loaded. */
  private sample(family: Family, name: string, t: number, vel: number, dest: AudioNode, rate: number, len?: number): boolean {
    const set = SAMPLES.get(this.ctx)?.[family];
    const n = set?.notes.find((x) => x.name === name);
    if (!set || !n) return false;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = set.buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vel * n.gain;
    src.connect(g);
    g.connect(dest);
    // A swell peaks where its note ends: it starts that far before its peak.
    let off = n.off;
    let when = t;
    if (len !== undefined && n.peak !== undefined) {
      const lead = n.peak / rate;
      if (len < lead) off += (lead - len) * rate;
      else when += len - lead;
    }
    src.start(when, off);
    src.stop(when + (n.len - (off - n.off)) / rate);
    src.addEventListener("ended", () => {
      src.disconnect();
      g.disconnect();
    });
    return true;
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

  /** A baked drum: its takes in turn. */
  private baked(kind: string, t: number, vel: number, dest: AudioNode): void {
    const takes = this.drums[kind]!;
    const i = (this.turn.get(kind) ?? 0) % takes.length;
    this.turn.set(kind, i + 1);
    const src = this.ctx.createBufferSource();
    src.buffer = takes[i]!;
    const g = this.ctx.createGain();
    g.gain.value = vel;
    src.connect(g);
    g.connect(dest);
    src.start(t);
    src.addEventListener("ended", () => {
      src.disconnect();
      g.disconnect();
    });
  }

  private drum(kind: string, t: number, vel: number, dest: AudioNode, len: number): void {
    const names = KIT_SAMPLE[kind];
    if (names) {
      const i = (this.turn.get(kind) ?? 0) % names.length;
      this.turn.set(kind, i + 1);
      // Hats a hair off each time, so a run of them never sounds like one sound repeated.
      const rate = kind === "h" || kind === "f" ? 0.97 + ((i * 7 + Math.floor(t * 1000)) % 7) * 0.01 : 1;
      const name = kind === "h" && vel > 0.9 ? "hatff" : names[i]!;
      if (this.sample("kit", name, t, vel * KIT_GAIN[kind]!, dest, rate, kind === "w" ? len : undefined)) return;
    }
    switch (kind) {
      case "k":
        return this.baked("k", t, vel * 1.05, dest);
      case "s":
        return this.baked("s", t, vel * 0.72, dest);
      case "x":
        return this.baked("x", t, vel * 0.6, dest);
      case "t":
      case "m":
      case "l":
        return this.baked(kind, t, vel * 0.62, dest);
      // Stand-ins while the kit loads.
      case "h":
      case "f":
        return this.noise(t, 0.04, vel * 0.3, "highpass", 8000, dest);
      case "o":
        return this.noise(t, 0.28, vel * 0.22, "highpass", 7200, dest);
      case "c":
      case "p":
      case "n":
      case "q":
        this.noise(t, 1.8, vel * 0.22, "highpass", 4200, dest);
        return this.noise(t, 0.5, vel * 0.14, "bandpass", 8500, dest, 1.5);
      case "r":
      case "b":
        return this.noise(t, 0.35, vel * 0.14, "bandpass", 7200, dest, 2.5);
    }
  }
}
