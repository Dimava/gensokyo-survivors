// The soundtrack as data: instruments and songs in the notation music.ts
// describes. Minor keys with bright turns (harmonic-minor dominants, circle
// of fifths runs, the IV-V-iii-vi "royal road"), trumpet and piano leads over
// driving octave bass, fast arpeggios, and a key change up for the last hook,
// the way Touhou stage and boss themes are built. All original compositions.

import type { Inst, Song } from "./music.ts";

// ---------- instruments ----------

/** The ZUN-style trumpet: bright stacked saws that scoop up into the note, with a late vibrato. */
const trumpet: Inst = {
  osc: [
    ["sawtooth", 0, 0, 0.45],
    ["sawtooth", 0, 9, 0.3],
    ["square", 0, -6, 0.25],
  ],
  a: 0.02,
  d: 0.3,
  s: 0.72,
  r: 0.12,
  cut: 650,
  kt: 1.3,
  env: 3200,
  fd: 0.12,
  q: 1.1,
  scoop: 45,
  vib: { depth: 18, delay: 0.18 },
  gate: 0.95,
};
const darkTrumpet: Inst = { ...trumpet, cut: 420, kt: 1, env: 2000, q: 2.2, vib: { depth: 22, delay: 0.2 } };
const softBrass: Inst = { ...trumpet, a: 0.05, cut: 450, env: 1600, scoop: 25 };
/** A bright FM piano: a hammered attack that mellows. */
const piano: Inst = {
  osc: [
    ["sine", 0, 0, 0.5],
    ["triangle", 0, 3, 0.3],
    ["square", 0, 0, 0.2],
  ],
  fm: { ratio: 1, index: 1.3, decay: 0.2 },
  a: 0.003,
  d: 0.55,
  s: 0.22,
  r: 0.25,
  cut: 1400,
  kt: 1.2,
  env: 4200,
  fd: 0.18,
  vib: { depth: 6, delay: 0.35 },
};
const softPiano: Inst = { ...piano, d: 0.8, s: 0.15, r: 0.45, cut: 700, env: 1500 };
/** A tine e-piano (FM ratio 1): bell on the attack, round underneath. */
const epiano: Inst = {
  osc: [
    ["sine", 0, 0, 0.7],
    ["sine", 12, 4, 0.12],
    ["triangle", 0, -4, 0.18],
  ],
  fm: { ratio: 1, index: 2.2, decay: 0.1 },
  a: 0.003,
  d: 0.9,
  s: 0.25,
  r: 0.35,
};
const flute: Inst = {
  osc: [
    ["sine", 0, 0, 0.7],
    ["triangle", 0, 3, 0.3],
  ],
  a: 0.05,
  d: 0.4,
  s: 0.8,
  r: 0.25,
  vib: { depth: 14, delay: 0.22 },
  gate: 0.96,
};
const reed: Inst = {
  osc: [
    ["square", 0, 0, 0.5],
    ["sawtooth", 0, -6, 0.5],
  ],
  a: 0.03,
  d: 0.3,
  s: 0.75,
  r: 0.12,
  cut: 600,
  kt: 1,
  env: 900,
  fd: 0.15,
  q: 3,
  vib: { depth: 12, delay: 0.2 },
};
const organ: Inst = {
  osc: [
    ["sawtooth", 0, 0, 0.4],
    ["square", -12, 5, 0.35],
    ["sine", 12, 0, 0.25],
  ],
  a: 0.012,
  d: 0.5,
  s: 0.85,
  r: 0.2,
  cut: 1300,
  vib: { depth: 5, delay: 0.3 },
};
/** Strings: two detuned saws, spread left and right. */
const strings: Inst = {
  osc: [
    ["sawtooth", 0, -10, 0.5, -0.6],
    ["sawtooth", 0, 10, 0.5, 0.6],
  ],
  a: 0.45,
  d: 1.5,
  s: 0.85,
  r: 0.7,
  cut: 1300,
  kt: 0.5,
  q: 0.5,
  vib: { depth: 6, delay: 0.4 },
};
const darkStrings: Inst = { ...strings, cut: 650, kt: 0.3 };
const quickStrings: Inst = { ...strings, a: 0.08, r: 0.3 };
/** FM bell, inharmonic: ice. */
const bell: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 3.5, index: 1.6, decay: 0.35 }, a: 0.002, d: 0.6, s: 0, r: 0.5 };
/** FM glass pluck, harmonic: sparkling arpeggios. */
const glass: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 2, index: 1.2, decay: 0.08 }, a: 0.002, d: 0.16, s: 0, r: 0.12 };
/** FM celesta: a music box. */
const celesta: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 4, index: 0.8, decay: 0.2 }, a: 0.002, d: 0.4, s: 0, r: 0.3 };
const pluck: Inst = {
  osc: [
    ["square", 0, 0, 0.5],
    ["triangle", 0, 0, 0.5],
  ],
  a: 0.002,
  d: 0.14,
  s: 0,
  r: 0.08,
  cut: 700,
  kt: 1,
  env: 2500,
  fd: 0.06,
};
const marimba: Inst = {
  osc: [
    ["sine", 0, 0, 0.85],
    ["sine", 24, 0, 0.15],
  ],
  a: 0.002,
  d: 0.22,
  s: 0,
  r: 0.1,
};
/** Picked bass: a snappy filter over saw, square and a sine sub. */
const bass: Inst = {
  osc: [
    ["sawtooth", 0, 0, 0.5],
    ["square", 0, -8, 0.2],
    ["sine", -12, 0, 0.3],
  ],
  a: 0.003,
  d: 0.2,
  s: 0.5,
  r: 0.06,
  cut: 220,
  kt: 1,
  env: 1600,
  fd: 0.06,
  q: 3,
};
const softBass: Inst = {
  osc: [
    ["triangle", 0, 0, 0.7],
    ["sine", -12, 0, 0.3],
  ],
  a: 0.01,
  d: 0.4,
  s: 0.6,
  r: 0.15,
};

/** Transposes a part's absolute notes by n semitones (chord-tone digits are left alone). */
function shift(part: string, n: number): string {
  const names = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
  const pc: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  return part.replace(/\b([a-g])([#b]?)(\d)/g, (_, l: string, acc: string, o: string) => {
    const m = 12 * Number(o) + pc[l]! + (acc === "#" ? 1 : acc === "b" ? -1 : 0) + n;
    return `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12)}`;
  });
}

const ARP16 = "0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1";

// ---------- title: "Wind Chimes at the Hakurei Shrine" (B minor; the last hook lifts to E major) ----------
//
// Built on one motif: a leap up a fourth and a step back, in a 3-3-2 rhythm
// whose last note is pushed ahead of the bar and tied over (F#-B-A, then
// down G-F#-D). The chimes preview it in the intro; the piano states it,
// answers it a step higher, climbs with it, and holds the phrase's peak (E6)
// for its last bar. The song grows: the verse is one chord a bar on roots and
// fifths with a light arpeggio; the trumpet hook turns the motif to the
// relative major with sevenths and a slash chord; the bridge spends the
// colour (secondary dominants, a half-diminished turn, a harmonic-minor run
// over no chord, a ii-V into the new key); the last hook is a whole step up.

const TITLE_MOTIF = `f#5 _ _ b5 _ _ a5 _ | _ _ g5 _ f#5 _ d5 _`;
const TITLE_A = `${TITLE_MOTIF} | g5 _ _ c#6 _ _ b5 _ | _ _ a5 _ f#5 _ c#5 _ |
  f#5 _ _ b5 _ _ d6 _ | _ _ c#6 _ b5 _ g5 _ | [e5 f#5] g5 _ b5 _ _ e6 _ | _ _ _ _ c#6 _ a#5 _`;
const TITLE_CH_A = "Bm | G | A | F#m | Bm | G | Em | F#";
/** Strings under the second verse: long notes that move against the melody's pushes. */
const TITLE_A_COUNTER = `d5 _ _ _ _ _ _ _ | b4 _ _ _ _ _ _ _ | c#5 _ _ _ e5 _ _ _ | c#5 _ _ _ _ _ _ _ |
  d5 _ _ _ _ _ _ _ | d5 _ _ _ b4 _ _ _ | b4 _ _ _ g4 _ _ _ | a#4 _ _ _ c#5 _ _ _`;

const TITLE_B = `b5 _ _ e6 _ _ d6 _ | _ _ c#6 _ a5 _ e5 _ | a5 _ _ d6 _ _ c#6 _ | _ _ b5 _ f#5 _ d5 _ |
  b5 _ _ e6 _ _ f#6 _ | _ _ e6 _ c#6 _ a5 _ | d6 _ _ f#6 _ _ a6 _ | _ _ _ _ f#6 _ e6 _`;
const TITLE_CH_B = "Gmaj7 | A | F#m7 | Bm | Gmaj7 | A | Bm A/C# | D";
const TITLE_B_COUNTER = `f#5 _ _ _ _ _ _ _ | e5 _ _ _ _ _ _ _ | c#5 _ _ _ _ _ _ _ | d5 _ _ _ _ _ _ _ |
  f#5 _ _ _ _ _ _ _ | e5 _ _ _ g5 _ _ _ | f#5 _ _ _ e5 _ _ _ | f#5 _ _ _ _ _ _ _`;

const TITLE_C = `g5 _ _ b5 _ _ d6 _ | _ _ c#6 _ e6 _ g6 _ | f#6 _ _ e6 _ _ c#6 _ | b5 _ d6 _ f6 _ g#5 _ |
  a5 _ _ c#6 _ _ e6 _ | _ _ d#6 _ f#6 _ a6 _ | [g6 f#6] [e6 d6] [c#6 b5] [a#5 b5] [c#6 d6] [e6 f#6] [g6 a#6] [b6 a6] | f#6 _ d6 _ e6 _ g#6 _`;
const TITLE_CH_C = "Em7 | A7 | Dmaj7 | G#m7b5 C#7 | F#m7 | B7 | N | Bm7 E7";
const TITLE_C_BASS = `e2 _ _ _ b1 _ _ _ | a1 _ _ _ e2 _ _ _ | d2 _ _ _ c#2 _ _ _ | g#1 _ _ _ c#2 _ _ _ |
  f#2 _ _ _ e2 _ _ _ | b1 _ _ _ d#2 _ _ _ | . . . . . . . . | b1 _ _ _ e2 _ _ _`;
const TITLE_ARP = "0 1 2 1 0 1 2 1";
/** The bridge's arpeggio rests under the run. */
const TITLE_C_ARP = `${Array(6).fill(TITLE_ARP).join(" | ")} | . . . . . . . . | ${TITLE_ARP}`;

/** The bass and the kick share the motif's 3-3-2. */
const TITLE_BASS = "0 _ _ 0 _ _ 2 _";
const TITLE_BEAT_A = "k . h . . . k h . . h . k . h .";
const TITLE_BEAT = "k . h . s . k h . . h k s . h .";
const TITLE_BEAT_B = "k . h k s . h k . k h . s . h o";
const TITLE_FILL = "k . h k s . h k s s t t m m l l";

export const menuSong: Song = {
  bpm: 126,
  key: "B minor",
  voiceLead: true,
  inst: { lead: piano, counter: quickStrings, keys: epiano, arp: glass, bass, pad: strings },
  mix: { lead: 0.2, counter: 0.08, keys: 0.05, arp: 0.06, pad: 0.04, drums: 0.24 },
  pan: { counter: 0.3, arp: -0.25, keys: 0.2 },
  layers: {},
  fadeIn: 1.5,
  sections: {
    intro: {
      chords: "Bm | G | Em | F#",
      lead: "f#5 _ _ b5 _ _ a5 _ | _ _ g5 _ f#5 _ d5 _ | e5 _ _ g5 _ _ b5 _ | a#5 _ _ _ _ _ _ _",
      bass: "0 _ _ _ _ _ _ _",
      dyn: [0.55, 0.8],
      inst: { lead: bell },
    },
    A: { chords: TITLE_CH_A, lead: TITLE_A, arp: TITLE_ARP, bass: TITLE_BASS, drums: TITLE_BEAT_A, fill: TITLE_FILL, dyn: [0.75, 0.88] },
    A2: {
      chords: TITLE_CH_A,
      lead: TITLE_A,
      counter: TITLE_A_COUNTER,
      arp: TITLE_ARP,
      bass: "0 _ 0^ 0 _ 0^ 2 _",
      drums: TITLE_BEAT,
      fill: TITLE_FILL,
      dyn: [0.85, 0.95],
    },
    B: {
      chords: TITLE_CH_B,
      lead: TITLE_B,
      counter: TITLE_B_COUNTER,
      arp: "0 1 2 3 2 1 2 1",
      keys: "* . . * . . * .",
      bass: "0 _ 0^ 0 _ 0^ 2 _",
      drums: TITLE_BEAT_B,
      fill: TITLE_FILL,
      dyn: [0.95, 1],
      inst: { lead: trumpet },
    },
    C: {
      chords: TITLE_CH_C,
      lead: TITLE_C,
      counter: "b4 _ _ _ _ _ _ _ | c#5 _ _ _ _ _ _ _ | a4 _ _ _ _ _ _ _ | b4 _ _ _ b4 _ _ _ | a4 _ _ _ _ _ _ _ | a4 _ _ _ _ _ _ _ | . . . . . . . . | a4 _ _ _ g#4 _ _ _",
      arp: TITLE_C_ARP,
      bass: TITLE_C_BASS,
      drums: "k . r . . . r . k . r . s? . r .",
      fill: "k . . . s . . . s s s s s! s! s! s!",
      crash: false,
      dyn: [0.7, 1],
    },
    B2: {
      chords: TITLE_CH_B,
      lead: TITLE_B,
      counter: TITLE_B_COUNTER,
      arp: "0 1 2 3 2 1 2 1",
      keys: "* . . * . . * .",
      bass: "0 _ 0^ 0 _ 0^ 2 _",
      drums: TITLE_BEAT_B,
      fill: TITLE_FILL,
      tr: 2,
      inst: { lead: trumpet },
    },
    turn: {
      chords: "G | F#",
      lead: "b5 _ _ d6 _ _ g6 _ | f#6 _ _ _ c#6 _ a#5 _",
      arp: TITLE_ARP,
      bass: "0 _ _ 0 _ _ 0 _",
      drums: "k . h k s . h k . k h . s . h . | s . s s s s s s t t m m l l s! s!",
      crash: false,
      dyn: [1, 0.85],
      inst: { lead: trumpet },
    },
  },
  form: ["intro", "A", "A2", "B", "C", "B2", "turn"],
  loop: 1,
};

// ---------- shop and the menus between runs: "A Quiet Afternoon at the Shrine" (F major, lounge) ----------

const SHOP_A = `a5 _ _ g5 a5 _ c6 _ | g5 _ e5 _ c#5 _ e5 _ | f5 _ _ e5 f5 _ a5 _ | g5 _ eb5 _ c5 _ eb5 _ |
  d6 _ _ c6 a5 _ f5 _ | e5 _ _ _ c#5 _ e5 g5 | f5 _ a5 _ b5 _ d6 _ | c6 _ _ _ bb5 _ g5 _`;
const SHOP_B = `f5 _ a5 _ d6 _ c6 _ | c6 _ _ _ e5 _ g5 _ | bb5 _ a5 _ g5 _ f5 _ | e5 _ _ _ c5 _ _ _ |
  d5 _ f5 _ a5 _ d6 _ | c6 _ e6 _ f#6 _ d6 _ | d6 _ bb5 _ g5 _ bb5 _ | c6 _ _ _ e5 _ g5 _`;

export const shopSong: Song = {
  bpm: 88,
  voiceLead: true,
  swing: 0.3,
  inst: { lead: epiano, counter: flute, keys: softPiano, arp: marimba, bass: softBass, pad: strings },
  mix: { lead: 0.2, counter: 0.1, keys: 0.06, drums: 0.16, pad: 0.03 },
  fadeIn: 1.5,
  sections: {
    A: {
      chords: "Fmaj7 | Em7 A7 | Dm7 | Cm7 F7 | Bbmaj7 | A7 | Dm7 G7 | Gm7 C7",
      lead: SHOP_A,
      keys: ". * . . . * . .",
      bass: "0 _ 2 _ 1 _ 2 _",
      drums: "k . h h? s? . h h?",
    },
    B: {
      chords: "Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | Am7 D7 | Gm7 | C7sus4 C7",
      lead: SHOP_B,
      counter: "3 _ _ _ 2 _ _ _",
      keys: ". * . . . * . .",
      bass: "0 _ 2 _ 1 _ 2 _",
      drums: "k . r r? s? . r r?",
    },
    A2: {
      chords: "Fmaj7 | Em7 A7 | Dm7 | Cm7 F7 | Bbmaj7 | A7 | Dm7 G7 | Gm7 C7",
      lead: SHOP_A,
      counter: shift(SHOP_A, -12),
      keys: ". * . . . * . .",
      arp: "0 2 1 3 2 1 0 1",
      bass: "0 _ 2 _ 1 _ 2 _",
      drums: "k . h h? s? . h h?",
      inst: { counter: flute },
    },
  },
  form: ["A", "B", "A2", "B"],
  loop: 0,
};

// ---------- Misty Lake: "Fairies Dancing in the Morning Mist" (A minor, a C major hook that lifts to D) ----------

const LAKE_A = `a4 _ c5 e5 a5 _ g5 e5 | g5 _ a5 _ e5 _ c5 _ | f5 _ e5 f5 a5 _ c6 _ | b5 _ _ _ g#5 _ e5 _ |
  a5 _ b5 c6 e6 _ d6 c6 | b5 _ c6 _ g5 _ e5 _ | f5 _ a5 _ c6 _ d6 c6 | b5 _ _ _ g#5 _ [a5 b5] _`;
const LAKE_B = `d6 _ _ c6 a5 _ f5 _ | g5 _ a5 _ b5 _ d6 _ | e6 _ _ d6 c6 _ g5 _ | a5 _ c6 _ f6 _ e6 _ |
  d6 _ _ c6 b5 _ f5 _ | g#5 _ b5 _ e6 _ d6 _ | c6 _ b5 a5 e5 _ a5 _ | b5 _ _ _ e6 _ g#5 _`;
const LAKE_C = `c6 _ a5 c6 f6 _ e6 c6 | d6 _ b5 d6 g6 _ f6 d6 | e6 _ _ d6 b5 _ g5 b5 | c6 _ _ _ a5 _ e5 _ |
  f5 _ a5 _ d6 _ f6 _ | g6 _ f6 _ e6 _ d6 _ | e6 _ _ _ g#6 _ b6 _ | a6 _ _ _ _ _ . .`;
const LAKE_CH_A = "Am | Am/G | Fmaj7 | E7 | Am | Am/G | Dm7 | E7";
const LAKE_CH_B = "Dm7 | G | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am | E7";
const LAKE_CH_C = "Fmaj7 | G | Em7 | Am | Dm7 | G | E7 | Am";
const LAKE_BASS = "0 0 0^ 0 0 0 0^ 2";
const LAKE_BEAT = "kh . h . sh . h kh . h kh . sh . h .";
const LAKE_PERC = ". h? h h? x h? h h? . h? h h? x h? h h?";
const LAKE_FILL = "kh . h . sh . h . s s t t m m l l";

export const lakeSong: Song = {
  bpm: 152,
  voiceLead: true,
  inst: { lead: piano, counter: bell, keys: epiano, arp: glass, bass, pad: strings },
  sections: {
    intro: {
      chords: "Am | F | G | E7",
      arp: ARP16,
      bass: "0 . . 0 . . 0 .",
      drums: "k . . . h . . . k . . . h . . .",
      fill: "k . s . k . s . s s s s s! s s! s!",
      crash: false,
    },
    A: { chords: LAKE_CH_A, lead: LAKE_A, arp: ARP16, keys: ". . * . . * . .", bass: LAKE_BASS, drums: LAKE_BEAT, perc: LAKE_PERC },
    B: {
      chords: LAKE_CH_B,
      lead: LAKE_B,
      counter: "3 _ _ _ 2 _ _ _",
      arp: ARP16,
      keys: ". * . * . * . *",
      bass: "0 0 0^ 0 0 0^ 0 0^",
      drums: LAKE_BEAT,
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      inst: { lead: trumpet, counter: quickStrings },
    },
    C: {
      chords: LAKE_CH_C,
      lead: LAKE_C,
      counter: "2^ _ _ _ 1^ _ 2^ _",
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: "* . . * . . * .",
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      inst: { lead: trumpet },
    },
    A2: {
      chords: LAKE_CH_A,
      lead: LAKE_A,
      counter: "2^ _ _ _ 1^ _ _ _",
      arp: ARP16,
      keys: ". . * . . * . .",
      bass: LAKE_BASS,
      drums: LAKE_BEAT,
      perc: LAKE_PERC,
    },
    C2: {
      chords: LAKE_CH_C,
      lead: LAKE_C,
      counter: shift(LAKE_C, -12),
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: "* . . * . . * .",
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      tr: 2,
      inst: { lead: trumpet, counter: quickStrings },
    },
    turn: {
      chords: "F | E7",
      lead: "a5 _ c6 _ f6 _ e6 _ | g#5 _ _ _ b5 _ e6 _",
      arp: ARP16,
      bass: "0 0 0^ 0 0 0 0^ 0",
      drums: "kh . h . sh . h . kh . h . sh . h . | s . s s s s s s t t m m l l s! s!",
      crash: false,
      inst: { lead: trumpet },
    },
  },
  form: ["intro", "A", "B", "C", "A2", "B", "C", "C2", "turn"],
  loop: 1,
};

// ---------- Cirno: "The Strongest Frozen Tomboy" (D minor, icy and fast; the last hook in E minor) ----------

const CIRNO_A = `a5 _ d6 _ [c6 a5] [f5 a5] d6 _ | e6 _ f6 _ [e6 d6] [c6 d6] a5 _ | bb5 _ d6 _ f6 _ [e6 f6] g6 | e6 _ _ _ c6 _ g5 _ |
  a5 _ d6 _ [c6 a5] [f5 a5] d6 _ | e6 _ f6 _ a6 _ [g6 f6] e6 | d6 _ [bb5 d6] g6 _ f6 e6 d6 | c#6 _ e6 _ a6 _ g6 e6`;
const CIRNO_B = `f6 _ _ e6 d6 _ bb5 _ | c6 _ d6 _ e6 _ g6 _ | e6 _ _ d6 c6 _ a5 _ | d6 _ _ _ f6 _ a6 _ |
  g6 _ _ f6 d6 _ bb5 _ | c6 _ e6 _ g6 _ bb6 _ | a6 _ _ _ f6 _ c6 _ | e6 _ c#6 _ a5 _ [c#6 e6] [g6 bb6]`;
const CIRNO_C = `d6 _ f6 _ [e6 d6] c6 d6 _ | e6 _ g6 _ [f6 e6] d6 e6 _ | c6 _ e6 _ a6 _ g6 e6 | f6 _ _ _ d6 _ a5 _ |
  d6 _ f6 _ [e6 d6] c6 d6 _ | e6 _ g6 _ c7 _ bb6 g6 | a6 _ _ _ c#6 _ e6 _ | d6 _ _ _ _ _ . .`;
const CIRNO_CH_A = "Dm | Dm | Bb | C | Dm | Dm | Gm | A7";
const CIRNO_CH_B = "Bb | C | Am | Dm | Gm | C | F | A7";
const CIRNO_CH_C = "Bb | C | Am | Dm | Bb | C | A7 | Dm";
const CIRNO_BASS = "0 0^ 0 0^ 0 0^ 0 0^";
const CIRNO_BEAT = "kh . h h sh . h . kh . kh h sh . h o";
const CIRNO_PERC = ". h h? h x h h? h . h h? h x h h? t";
const CIRNO_FILL = "kh . h h sh . h . s s t t [s s] [m m] l! l!";
const CIRNO_KEYS = "* . . * . . * .";

export const cirnoSong: Song = {
  bpm: 172,
  voiceLead: true,
  inst: { lead: piano, counter: bell, keys: epiano, arp: glass, bass, pad: strings },
  mix: { lead: 0.22, counter: 0.09 },
  layers: { perc: 0.4, counter: 0 },
  fadeIn: 0.1,
  sections: {
    intro: {
      chords: "Dm | Bb | C | A7",
      arp: "0 1 2 3 1 2 3 4 2 3 4 5 3 4 5 6",
      counter: "3^ . . . . . . . | . . . . . . . .",
      bass: "0 . . 0 . . 0 .",
      drums: "k . . . s . . . k . k . s . . .",
      fill: CIRNO_FILL,
      crash: false,
    },
    A: { chords: CIRNO_CH_A, lead: CIRNO_A, arp: ARP16, keys: CIRNO_KEYS, bass: CIRNO_BASS, drums: CIRNO_BEAT, perc: CIRNO_PERC },
    B: {
      chords: CIRNO_CH_B,
      lead: CIRNO_B,
      counter: "2 _ _ _ 1 _ _ _",
      arp: ARP16,
      keys: ". * . * . * . *",
      bass: "0 0 0^ 0 0 0 0^ 2",
      drums: CIRNO_BEAT,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      inst: { lead: trumpet, counter: quickStrings },
    },
    C: {
      chords: CIRNO_CH_C,
      lead: CIRNO_C,
      counter: "3^ _ 2^ _ 1^ _ 2^ _",
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: CIRNO_KEYS,
      bass: CIRNO_BASS,
      drums: CIRNO_BEAT,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      inst: { lead: trumpet },
    },
    A2: {
      chords: CIRNO_CH_A,
      lead: CIRNO_A,
      counter: shift(CIRNO_A, -12),
      arp: ARP16,
      keys: CIRNO_KEYS,
      bass: CIRNO_BASS,
      drums: CIRNO_BEAT,
      perc: CIRNO_PERC,
    },
    break: {
      chords: "Gm | A7 | Bb | A7",
      counter: "d6 _ _ _ bb5 _ _ _ | c#6 _ _ _ e6 _ _ _ | f6 _ _ _ d6 _ _ _ | e6 _ _ _ a6 _ _ _",
      arp: "0 1 2 3 1 2 3 4 2 3 4 5 3 4 5 6",
      bass: "0 _ _ _ 0 _ _ _",
      drums: "k . . . . . . . k . . . . . . .",
      fill: "s . s . s s s s s s s s s! s! s! s!",
      crash: false,
    },
    C2: {
      chords: CIRNO_CH_C,
      lead: CIRNO_C,
      counter: shift(CIRNO_C, -12),
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: CIRNO_KEYS,
      bass: CIRNO_BASS,
      drums: CIRNO_BEAT,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      tr: 2,
      inst: { lead: trumpet, counter: quickStrings },
    },
    turn: {
      chords: "C | A7",
      lead: "e6 _ g6 _ c7 _ bb6 _ | a6 _ _ _ c#6 _ e6 _",
      arp: ARP16,
      bass: CIRNO_BASS,
      drums: "kh . h h sh . h . kh . kh h sh . h o | s s s s s s s s t t m m l l s! s!",
      crash: false,
      inst: { lead: trumpet },
    },
  },
  form: ["intro", "A", "B", "C", "A2", "B", "break", "C", "C2", "turn"],
  loop: 1,
};

// ---------- Forest of Magic: "Mushrooms under the Canopy" (E dorian, lilting) ----------

const FOREST_A = `e5 _ g5 _ b5 _ a5 g5 | e5 _ a5 _ c#6 _ b5 a5 | b5 _ g5 _ e5 _ f#5 g5 | f#5 _ e5 _ c#5 _ e5 _ |
  g5 _ e5 _ c6 _ b5 g5 | a5 _ f#5 _ d6 _ c6 a5 | b5 _ _ _ f#5 _ d5 _ | d#5 _ f#5 _ a5 _ b5 _`;
const FOREST_B = `e6 _ _ b5 g5 _ e5 _ | f#5 _ a5 _ d6 _ c6 a5 | b5 _ _ _ d6 _ f#5 _ | g5 _ e5 _ b5 _ g5 _ |
  c6 _ a5 _ e6 _ c6 _ | d6 _ c6 _ a5 _ f#5 _ | d#6 _ _ _ b5 _ a5 _ | f#5 _ _ _ d#5 _ [e5 f#5] [g5 a5]`;
const FOREST_CH_A = "Em | A | Em | A | C | D | Bm | B7";
const FOREST_CH_B = "Cmaj7 | D | Bm | Em | Am | D | B7 | B7";
const FOREST_BEAT = "kh h sh h kh h sh o";
const FOREST_PERC = "t? . x . . t? x .";
const FOREST_FILL = "kh h sh h s s s! s!";

export const forestSong: Song = {
  bpm: 138,
  voiceLead: true,
  swing: 0.14,
  inst: { lead: reed, counter: flute, keys: epiano, arp: marimba, bass, pad: strings },
  mix: { arp: 0.1, counter: 0.09 },
  sections: {
    intro: { chords: "Em | A | Em | A", arp: "0 2 1 2 3 2 1 2", bass: "0 . . 0 . . 2 .", drums: "k . h . . . h .", fill: FOREST_FILL, crash: false },
    A: { chords: FOREST_CH_A, lead: FOREST_A, arp: "0 2 1 2 3 2 1 2", keys: ". * . . . * . .", bass: "0 . 0^ 0 . 0 2 .", drums: FOREST_BEAT, perc: FOREST_PERC },
    B: {
      chords: FOREST_CH_B,
      lead: FOREST_B,
      arp: "0 1 2 3 4 3 2 1",
      keys: ". * . * . * . *",
      bass: "0 . 0^ 0 . 0 2 .",
      drums: FOREST_BEAT,
      perc: FOREST_PERC,
      fill: FOREST_FILL,
      inst: { lead: trumpet },
    },
    A2: {
      chords: FOREST_CH_A,
      lead: FOREST_A,
      counter: "2^ _ _ _ 1^ _ _ _",
      arp: "0 2 1 2 3 2 1 2",
      keys: ". * . . . * . .",
      bass: "0 . 0^ 0 . 0 2 .",
      drums: FOREST_BEAT,
      perc: FOREST_PERC,
    },
    B2: {
      chords: FOREST_CH_B,
      lead: FOREST_B,
      counter: shift(FOREST_B, -12),
      arp: "0 1 2 3 4 3 2 1",
      keys: ". * . * . * . *",
      bass: "0 0 0^ 0 0 0 2 0^",
      drums: "kh h sh h kh kh sh o",
      perc: FOREST_PERC,
      fill: FOREST_FILL,
      tr: 2,
      inst: { lead: trumpet, counter: quickStrings },
    },
    turn: { chords: "Cmaj7 | B7", lead: "e6 _ d6 _ c6 _ b5 _ | d#6 _ _ _ f#6 _ _ _", arp: "0 1 2 3 4 3 2 1", bass: "0 . 0^ 0 . 0 2 .", drums: FOREST_BEAT, fill: FOREST_FILL, crash: false },
  },
  form: ["intro", "A", "B", "A2", "B2", "turn"],
  loop: 1,
};

// ---------- Rumia: "Darkness that Swallows the Moon" (C harmonic minor; the last hook a half step up) ----------

const RUMIA_A = `c5 _ _ d5 eb5 _ g5 _ | ab5 _ g5 _ f5 _ eb5 d5 | c5 _ _ eb5 ab5 _ c6 _ | bb5 _ ab5 _ g5 _ eb5 _ |
  f5 _ ab5 _ c6 _ f6 _ | eb6 _ d6 _ c6 _ ab5 _ | b5 _ _ _ d6 _ f6 _ | g6 _ f6 _ d6 _ b5 _`;
const RUMIA_B = `c6 _ _ bb5 ab5 _ eb5 _ | d6 _ _ c6 bb5 _ f5 _ | g5 _ bb5 _ d6 _ c6 bb5 | c6 _ _ _ g5 _ eb5 _ |
  f5 _ ab5 _ c6 _ f6 _ | d6 _ _ _ bb5 _ f5 _ | g5 _ bb5 _ eb6 _ d6 eb6 | f6 _ _ _ d6 _ b5 _`;
const RUMIA_C = `g5 _ c6 _ eb6 _ [d6 c6] [b5 c6] | ab5 _ c6 _ eb6 _ [f6 eb6] [c6 ab5] | bb5 _ d6 _ f6 _ eb6 d6 | eb6 _ _ _ bb5 _ g5 _ |
  c6 _ ab5 _ eb6 _ c6 _ | f6 _ eb6 _ c6 _ ab5 _ | b5 _ _ _ d6 _ f6 _ | g6 _ _ _ [f6 d6] [b5 g5] c6 _`;
const RUMIA_CH_A = "Cm | Cm | Ab | Ab | Fm | Fm | G7 | G7";
const RUMIA_CH_B = "Ab | Bb | Gm | Cm | Fm | Bb | Eb | G7";
const RUMIA_CH_C = "Cm | Ab | Bb | Eb | Ab | Fm | G7 | Cm";
const RUMIA_ARP = "0 2 1 2 0 2 1 2 0 2 1 2 0 2 1 2";
const RUMIA_BASS = "0 0 0 0^ 0 0 0 0^";
const RUMIA_BEAT = "kh . h . sh . h . kh . kh . sh . h h";
const RUMIA_PERC = ". h h . x . h h . h h . x . h t";
const RUMIA_FILL = "kh . h . sh . h . s s m m l l kh! .";
const RUMIA_KEYS = "* _ . * _ . * .";

export const rumiaSong: Song = {
  bpm: 158,
  voiceLead: true,
  inst: { lead: darkTrumpet, counter: organ, keys: organ, arp: pluck, bass, pad: darkStrings },
  mix: { counter: 0.08, keys: 0.05, pad: 0.05 },
  fadeIn: 0.1,
  sections: {
    intro: {
      chords: "Cm | Ab | Fm | G7",
      arp: RUMIA_ARP,
      bass: "0 _ _ _ _ _ _ _",
      drums: "k . . . . . . . k . . . . . . .",
      fill: RUMIA_FILL,
      crash: false,
    },
    A: { chords: RUMIA_CH_A, lead: RUMIA_A, arp: RUMIA_ARP, keys: RUMIA_KEYS, bass: RUMIA_BASS, drums: RUMIA_BEAT, perc: RUMIA_PERC },
    B: {
      chords: RUMIA_CH_B,
      lead: RUMIA_B,
      counter: "1 _ _ _ 2 _ _ _",
      arp: "0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1",
      keys: RUMIA_KEYS,
      bass: RUMIA_BASS,
      drums: RUMIA_BEAT,
      perc: RUMIA_PERC,
      fill: RUMIA_FILL,
    },
    C: {
      chords: RUMIA_CH_C,
      lead: RUMIA_C,
      counter: shift(RUMIA_C, -12),
      arp: RUMIA_ARP,
      keys: RUMIA_KEYS,
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      perc: RUMIA_PERC,
      fill: RUMIA_FILL,
      inst: { lead: trumpet, counter: quickStrings },
    },
    A2: {
      chords: RUMIA_CH_A,
      lead: RUMIA_A,
      counter: "3 _ _ _ 2 _ _ _",
      arp: RUMIA_ARP,
      keys: RUMIA_KEYS,
      bass: RUMIA_BASS,
      drums: RUMIA_BEAT,
      perc: RUMIA_PERC,
    },
    D: {
      chords: "Ab | Ab | G | G",
      counter: "c5 _ _ _ eb5 _ _ _ | ab5 _ _ _ g5 _ _ _ | b4 _ _ _ d5 _ _ _ | f5 _ _ _ g5 _ _ _",
      arp: RUMIA_ARP,
      bass: "0 _ _ _ _ _ _ _",
      drums: "k . . k . . . . k . . k . . . .",
      fill: "s . s . s s s s s s s s s! s! s! s!",
      crash: false,
    },
    C1: {
      chords: RUMIA_CH_C,
      lead: RUMIA_C,
      counter: shift(RUMIA_C, -12),
      arp: RUMIA_ARP,
      keys: RUMIA_KEYS,
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      perc: RUMIA_PERC,
      fill: RUMIA_FILL,
      tr: 1,
      inst: { lead: trumpet, counter: quickStrings },
    },
    turn: {
      chords: "Ab | G7",
      lead: "c6 _ eb6 _ ab6 _ g6 _ | f6 _ d6 _ b5 _ g5 _",
      arp: RUMIA_ARP,
      bass: RUMIA_BASS,
      drums: "kh . h . sh . h . kh . kh . sh . h h | s s s s s s m m m m l l l l kh! .",
      crash: false,
    },
  },
  form: ["intro", "A", "B", "C", "A2", "B", "D", "C", "C1", "turn"],
  loop: 1,
};

// ---------- stage clear: a four-bar fanfare, then silence ----------

export const clearSong: Song = {
  bpm: 140,
  voiceLead: true,
  inst: { lead: trumpet, counter: softBrass, keys: epiano, arp: glass, bass, pad: strings },
  mix: { counter: 0.12 },
  sections: {
    fanfare: {
      chords: "C | Am | F G | C",
      lead: "g5 . c6 . e6 . [g6 _ _ e6] _ | a6 _ _ g6 e6 _ c6 _ | d6 _ c6 d6 e6 _ f6 _ | g6! _ _ _ _ _ _ _",
      counter: "e5 . g5 . c6 . [e6 _ _ c6] _ | e6 _ _ e6 c6 _ a5 _ | a5 _ a5 b5 c6 _ d6 _ | e6 _ _ _ _ _ _ _",
      arp: `${ARP16} | ${ARP16} | ${ARP16} | 0 1 2 3 4 5 6 7 . . . . . . . .`,
      bass: "0 _ 0 _ 0 _ 0 _ | 0 _ 0 _ 0 _ 0 _ | 0 _ 0 _ 0 _ 0 _ | 0 _ _ _ _ _ _ _",
      drums: "k . s . k . s . | k . s . k . s . | k . s . k s s s | kc! . . . . . . .",
      crash: false,
    },
  },
  form: ["fanfare"],
  loop: null,
};

// ---------- game over: a falling sting, then silence ----------

export const overSong: Song = {
  bpm: 70,
  inst: { lead: softPiano, counter: strings, keys: epiano, arp: celesta, bass: softBass, pad: darkStrings },
  mix: { lead: 0.22, pad: 0.06 },
  fadeIn: 0.05,
  sections: {
    sting: {
      chords: "Am | Fm | Am",
      lead: ". . e5 _ c5 _ a4 _ | ab4 _ f4 _ c4 _ _ _ | e4 _ _ _ _ _ _ _",
      arp: ". . . . . . . . . . . . . . . . | . . . . . . . . . . . . . . . . | 0^ 1^ 2^ 3^ . . . . . . . . . . . .",
      bass: ". . 0 _ _ _ _ _ | 0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _",
    },
  },
  form: ["sting"],
  loop: null,
};

// ---------- the music room ----------

export interface TrackInfo {
  id: string;
  title: string;
  /** Where it plays. */
  where: string;
  /** A composer's comment, music-room style. */
  comment: string;
  /** Who wrote it (an arrangement credits the original). */
  credit: string;
  song: Song;
}

const ORIGINAL = "Original composition for Gensokyo Survivors";

export const TRACKS: readonly TrackInfo[] = ([
  {
    id: "menu",
    title: "Wind Chimes at the Hakurei Shrine",
    where: "Title screen",
    comment: "A wind chime on the shrine eaves plays the tune first. It is one small figure, up a fourth and back with a push over the bar line, answered a step higher, then climbing until it holds the top note. The trumpet takes it into D major, the bridge wanders through borrowed chords and a harmonic minor run, and the last hook comes back a whole step up.",
    song: menuSong,
  },
  {
    id: "shop",
    title: "A Quiet Afternoon at the Shrine",
    where: "Menus, shop and packs",
    comment: "Tea, a donation box that stays empty, and a lot of sitting on the veranda. A swung lounge tune on e-piano and flute.",
    song: shopSong,
  },
  {
    id: "lake",
    title: "Fairies Dancing in the Morning Mist",
    where: "Misty Lake",
    comment: "The stage 1 theme: bright and a little mischievous, with a circle-of-fifths bridge and a royal-road hook that lifts a step for its last round.",
    song: lakeSong,
  },
  {
    id: "cirno",
    title: "The Strongest Frozen Tomboy",
    where: "Cirno's theme",
    comment: "Fast, icy and very sure of itself. Bells and glass arpeggios for the ice, a piano riff for the attitude, and a trumpet that refuses to lose.",
    song: cirnoSong,
  },
  {
    id: "forest",
    title: "Mushrooms under the Canopy",
    where: "Forest of Magic",
    comment: "A lilting dorian tune with a swing to it; the forest is friendly until the spores get to you.",
    song: forestSong,
  },
  {
    id: "rumia",
    title: "Darkness that Swallows the Moon",
    where: "Rumia's theme",
    comment: "Harmonic minor, an organ, and a trumpet in the dark. The last hook rises a half step, like the night closing in.",
    song: rumiaSong,
  },
  { id: "clear", title: "Stage Clear", where: "Stage clear", comment: "Four bars of fanfare. You earned them.", song: clearSong },
  { id: "over", title: "Pichuun", where: "Game over", comment: "It happens to everyone. Continue?", song: overSong },
] satisfies Omit<TrackInfo, "credit">[]).map((t) => ({ credit: ORIGINAL, ...t }));
