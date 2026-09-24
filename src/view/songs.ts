// The soundtrack as data: instruments and songs in the notation music.ts
// describes. Minor keys with bright turns (harmonic-minor dominants, the
// IV-V-iii-vi "royal road"), trumpet and piano leads over driving octave bass,
// arpeggiated chords, the way Touhou stage and boss themes are built.

import type { Inst, Song } from "./music.ts";

// ---------- instruments ----------

const trumpet: Inst = {
  osc: [
    ["sawtooth", 0, 0, 0.5],
    ["sawtooth", 0, 8, 0.3],
    ["square", -12, 0, 0.2],
  ],
  a: 0.025,
  d: 0.25,
  s: 0.7,
  r: 0.12,
  cut: 700,
  kt: 1.2,
  env: 2600,
  fd: 0.1,
  vib: { depth: 14, delay: 0.22 },
};
const darkLead: Inst = { ...trumpet, cut: 450, kt: 0.9, env: 1800, q: 2.5, vib: { depth: 18, delay: 0.25 } };
const piano: Inst = {
  osc: [
    ["triangle", 0, 0, 0.55],
    ["square", 0, 4, 0.3],
    ["square", 12, -4, 0.15],
  ],
  a: 0.004,
  d: 0.45,
  s: 0.3,
  r: 0.18,
  cut: 900,
  kt: 1.5,
  env: 3000,
  fd: 0.2,
  vib: { depth: 8, delay: 0.3 },
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
  vib: { depth: 12, delay: 0.25 },
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
};
/** FM bell, inharmonic: ice. */
const bell: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 3.5, index: 1.6, decay: 0.35 }, a: 0.002, d: 0.6, s: 0, r: 0.5 };
/** FM glass pluck, harmonic: sparkling arpeggios. */
const glass: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 2, index: 1.2, decay: 0.08 }, a: 0.002, d: 0.16, s: 0, r: 0.12 };
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
const softPiano: Inst = { ...piano, d: 0.7, s: 0.15, r: 0.4, cut: 500, env: 1200 };
const bass: Inst = {
  osc: [
    ["sawtooth", 0, 0, 0.55],
    ["triangle", 0, 0, 0.45],
  ],
  a: 0.004,
  d: 0.18,
  s: 0.55,
  r: 0.06,
  cut: 280,
  kt: 1,
  env: 900,
  fd: 0.07,
  q: 2,
};
const softBass: Inst = { osc: [["triangle", 0, 0, 1]], a: 0.01, d: 0.4, s: 0.6, r: 0.15 };
const pad: Inst = {
  osc: [
    ["sawtooth", 0, -7, 0.5],
    ["sawtooth", 0, 7, 0.5],
  ],
  a: 0.35,
  d: 1,
  s: 0.8,
  r: 0.5,
  cut: 900,
};
const warmPad: Inst = {
  osc: [
    ["triangle", 0, -5, 0.6],
    ["sine", 12, 5, 0.4],
  ],
  a: 0.6,
  d: 1.5,
  s: 0.85,
  r: 0.9,
};
const darkPad: Inst = { ...pad, cut: 550, q: 1.5 };

/** Transposes a part's absolute notes by n semitones (chord-tone digits are left alone). */
function shift(part: string, n: number): string {
  const names = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
  const pc: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  return part.replace(/\b([a-g])([#b]?)(\d)/g, (_, l: string, acc: string, o: string) => {
    const m = 12 * Number(o) + pc[l]! + (acc === "#" ? 1 : acc === "b" ? -1 : 0) + n;
    return `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12)}`;
  });
}

// ---------- title: "Dawn over the Hakurei Shrine" (B minor, calm) ----------

const MENU_A = `b4 _ _ c#5 d5 _ f#5 _ | g5 _ f#5 e5 d5 _ b4 _ | a4 _ d5 _ f#5 _ e5 d5 | e5 _ _ _ c#5 _ a4 _ |
  b4 _ _ c#5 d5 _ f#5 _ | g5 _ f#5 g5 a5 _ b5 _ | g5 _ f#5 e5 b4 _ e5 _ | f#5 _ _ _ a#4 _ c#5 _`;
const MENU_B = `d5 _ g5 _ b5 _ a5 g5 | a5 _ _ e5 c#5 _ e5 _ | f#5 _ e5 f#5 a5 _ c#6 _ | b5 _ _ _ f#5 _ d5 _ |
  e5 _ g5 _ b5 _ a5 g5 | a5 _ g5 f#5 e5 _ c#5 _ | d5 _ _ _ _ _ a4 _ | d5 _ _ _ . . c#5 _`;
const MENU_CH_A = "Bm | G | D | A | Bm | G | Em | F#";
const MENU_CH_B = "G | A | F#m | Bm | Em | A | D | D";

export const menuSong: Song = {
  bpm: 92,
  inst: { lead: flute, counter: softPiano, arp: softPiano, bass: softBass, pad: warmPad },
  mix: { lead: 0.17, arp: 0.06, drums: 0.16, pad: 0.06 },
  fadeIn: 2.5,
  sections: {
    intro: { chords: "Bm | G | D | A", arp: "0 1 2 3 4 3 2 1", bass: "0 _ _ _ _ _ _ _" },
    A: { chords: MENU_CH_A, lead: MENU_A, arp: "0 1 2 3 4 3 2 1", bass: "0 _ _ 2 _ _ 3 _" },
    B: {
      chords: MENU_CH_B,
      lead: MENU_B,
      arp: "0 2 3 4 3 2 1 2",
      bass: "0 _ _ 2 _ _ 3 _",
      drums: "k . h . s? . h . | k . h k s? . h h?",
    },
    A2: {
      chords: MENU_CH_A,
      lead: MENU_A,
      counter: "2 _ _ _ 1 _ _ _ | 3 _ _ _ 2 _ _ _",
      arp: "0 1 2 3 4 3 2 1",
      bass: "0 _ _ 2 _ _ 3 _",
      drums: "k . h . . . h . | k . h . . k h .",
    },
  },
  form: ["intro", "A", "B", "A2", "B"],
  loop: 1,
};

// ---------- Misty Lake: "Fairies over the Fog" (A minor, upbeat) ----------

const LAKE_A = `a4 _ c5 e5 a5 _ g5 a5 | f5 _ e5 c5 a4 _ c5 _ | d5 _ b4 d5 g5 _ f5 g5 | e5 _ _ _ c5 _ d5 _ |
  e5 _ a5 _ c6 _ b5 a5 | a5 _ f5 _ c6 _ a5 _ | b5 _ g5 _ d6 _ c6 b5 | g#5 _ _ _ e5 _ [f5 g#5] _`;
const LAKE_B = `a5 _ g5 a5 c6 _ a5 _ | b5 _ a5 g5 d5 _ g5 _ | g5 _ e5 _ b4 _ e5 g5 | a5 _ _ _ e5 _ a5 b5 |
  d6 _ c6 a5 f5 _ a5 _ | b5 _ d6 _ g5 _ b5 _ | a5 _ _ _ _ _ _ _ | g#5 _ _ _ b5 _ [c6 d6] _`;
const LAKE_C = `c6 _ a5 _ [c6 d6] [e6 d6] c6 a5 | d6 _ b5 _ g5 _ [a5 b5] d6 | e6 _ _ b5 g5 _ e5 g5 | a5 _ c6 _ e6 _ _ _ |
  f6 _ e6 _ c6 _ a5 _ | d6 _ b5 _ g5 _ b5 d6 | e6 _ _ _ d6 _ b5 _ | g#5 _ b5 _ e5 _ . .`;
const LAKE_CH_A = "Am | F | G | Am | Am | F | G | E";
const LAKE_ARP = "0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1";
const LAKE_BASS = "0 0 0^ 0 0 0 0^ 2";
const LAKE_BEAT = "kh . h . sh . h . kh . h kh sh . h .";
const LAKE_FILL = "kh . h . sh . h . s s s s s! s s! s!";

export const lakeSong: Song = {
  bpm: 150,
  inst: { lead: trumpet, counter: bell, arp: glass, bass, pad },
  sections: {
    intro: {
      chords: "Am | F | G | E",
      arp: LAKE_ARP,
      bass: "0 . . 0 . . 0 .",
      drums: "k . . . h . . . k . . . h . . .",
      fill: "k . s . k . s . s s s s s! s s! s!",
      crash: false,
    },
    A: { chords: LAKE_CH_A, lead: LAKE_A, arp: LAKE_ARP, bass: LAKE_BASS, drums: LAKE_BEAT },
    B: {
      chords: "Fmaj7 | G | Em | Am | Dm | G | Esus4 | E",
      lead: LAKE_B,
      counter: "3 _ _ _ 2 _ _ _",
      arp: LAKE_ARP,
      bass: "0 0 0^ 0 0 0^ 0 0^",
      drums: LAKE_BEAT,
      fill: LAKE_FILL,
    },
    C: {
      chords: "F | G | Em | Am | F | G | E | E",
      lead: LAKE_C,
      counter: "4^ _ _ _ 3^ _ 2^ _",
      arp: LAKE_ARP,
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      fill: LAKE_FILL,
    },
    A2: { chords: LAKE_CH_A, lead: LAKE_A, counter: "2 _ _ _ 1 _ _ _", arp: LAKE_ARP, bass: LAKE_BASS, drums: LAKE_BEAT },
  },
  form: ["intro", "A", "B", "C", "A2", "B", "C"],
  loop: 1,
};

// ---------- Cirno: "Frozen Tomboy of the Lake" (D minor, fast and icy) ----------

const CIRNO_A = `d5 _ f5 a5 d6 _ c6 a5 | bb5 _ a5 f5 d5 _ f5 _ | g5 _ e5 c5 g5 _ [a5 bb5] c6 | a5 _ _ _ f5 _ d5 _ |
  d6 _ c6 a5 [bb5 c6] d6 _ a5 | bb5 _ f5 _ d6 _ bb5 _ | g5 _ bb5 _ d6 _ c6 bb5 | a5 _ _ _ c#6 _ e6 _`;
const CIRNO_B = `f5 _ bb5 _ d6 _ c6 bb5 | c6 _ g5 _ e5 _ g5 _ | a5 _ c6 _ e6 _ d6 c6 | d6 _ _ _ a5 _ f5 _ |
  g5 _ bb5 d6 g6 _ f6 d6 | e6 _ c6 _ g5 _ e6 _ | f6 _ _ _ c6 _ a5 _ | e6 _ _ _ c#6 _ [a5 c#6] [e6 g6]`;
const CIRNO_C = `[d6 c6] [bb5 a5] bb5 d6 f6 _ d6 bb5 | [c6 d6] [e6 g6] _ e6 c6 _ g5 _ | a5 _ d6 _ f6 _ e6 d6 | a6 _ _ _ f6 _ d6 _ |
  f6 _ d6 bb5 [a5 bb5] d6 f6 _ | g6 _ e6 c6 [bb5 c6] e6 g6 _ | a6 _ _ _ g6 _ e6 _ | c#6 _ _ _ a5 _ . .`;
const CIRNO_CH_A = "Dm | Bb | C | Dm | Dm | Bb | Gm | A";
const CIRNO_ARP = "0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1";
const CIRNO_BASS = "0 0^ 0 0^ 0 0^ 0 0^";
const CIRNO_BEAT = "kh . h h sh . h . kh . kh h sh . h o";
const CIRNO_FILL = "kh . h h sh . h . s s s s [s s] [s s] s! s!";

export const cirnoSong: Song = {
  bpm: 168,
  inst: { lead: piano, counter: bell, arp: glass, bass, pad },
  mix: { lead: 0.22, counter: 0.09 },
  fadeIn: 0.1,
  sections: {
    intro: {
      chords: "Dm | Bb | C | A7",
      arp: "0 1 2 3 1 2 3 4 2 3 4 5 3 4 5 6",
      bass: "0 . . 0 . . 0 .",
      drums: "k . . . s . . . k . k . s . . .",
      fill: CIRNO_FILL,
      crash: false,
    },
    A: { chords: CIRNO_CH_A, lead: CIRNO_A, arp: CIRNO_ARP, bass: CIRNO_BASS, drums: CIRNO_BEAT },
    B: {
      chords: "Bb | C | Am | Dm | Gm | C | F | A7",
      lead: CIRNO_B,
      counter: "2 _ _ _ 1 _ _ _",
      arp: CIRNO_ARP,
      bass: "0 0 0^ 0 0 0 0^ 2",
      drums: CIRNO_BEAT,
      fill: CIRNO_FILL,
    },
    A2: { chords: CIRNO_CH_A, lead: CIRNO_A, counter: shift(CIRNO_A, 12), arp: CIRNO_ARP, bass: CIRNO_BASS, drums: CIRNO_BEAT },
    C: {
      chords: "Bb | C | Dm | Dm | Bb | C | A | A",
      lead: CIRNO_C,
      counter: "3^ _ 2^ _ 1^ _ 2^ _",
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      bass: CIRNO_BASS,
      drums: CIRNO_BEAT,
      fill: CIRNO_FILL,
    },
  },
  form: ["intro", "A", "B", "A2", "C"],
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
const FOREST_FILL = "kh h sh h s s s! s!";

export const forestSong: Song = {
  bpm: 138,
  swing: 0.14,
  inst: { lead: reed, counter: flute, arp: marimba, bass, pad },
  mix: { arp: 0.1, counter: 0.09 },
  sections: {
    intro: { chords: "Em | A | Em | A", arp: "0 2 1 2 3 2 1 2", bass: "0 . . 0 . . 2 .", drums: "k . h . . . h .", fill: FOREST_FILL, crash: false },
    A: { chords: FOREST_CH_A, lead: FOREST_A, arp: "0 2 1 2 3 2 1 2", bass: "0 . 0^ 0 . 0 2 .", drums: FOREST_BEAT },
    B: { chords: FOREST_CH_B, lead: FOREST_B, arp: "0 1 2 3 4 3 2 1", bass: "0 . 0^ 0 . 0 2 .", drums: FOREST_BEAT, fill: FOREST_FILL },
    A2: {
      chords: FOREST_CH_A,
      lead: FOREST_A,
      counter: "2^ _ _ _ 1^ _ _ _",
      arp: "0 2 1 2 3 2 1 2",
      bass: "0 . 0^ 0 . 0 2 .",
      drums: FOREST_BEAT,
    },
    B2: {
      chords: FOREST_CH_B,
      lead: FOREST_B,
      counter: shift(FOREST_B, -12),
      arp: "0 1 2 3 4 3 2 1",
      bass: "0 0 0^ 0 0 0 2 0^",
      drums: "kh h sh h kh kh sh o",
      fill: FOREST_FILL,
    },
  },
  form: ["intro", "A", "B", "A2", "B2"],
  loop: 1,
};

// ---------- Rumia: "Darkness that Swallows the Moon" (C harmonic minor) ----------

const RUMIA_A = `c5 _ _ eb5 g5 _ c6 _ | d6 _ c6 b5 c6 _ g5 _ | ab5 _ _ g5 f5 _ eb5 _ | c5 _ eb5 _ ab5 _ g5 ab5 |
  f5 _ ab5 _ c6 _ bb5 ab5 | g5 _ _ _ b5 _ d6 _ | eb6 _ d6 c6 g5 _ eb5 _ | d5 _ _ _ [b4 c5] [d5 f5] g5 _`;
const RUMIA_B = `c6 _ _ bb5 ab5 _ eb5 _ | d6 _ _ c6 bb5 _ f5 _ | g5 _ bb5 _ d6 _ c6 bb5 | c6 _ _ _ g5 _ eb5 _ |
  f5 _ ab5 _ c6 _ f6 _ | d6 _ _ _ bb5 _ f5 _ | g5 _ bb5 _ eb6 _ d6 eb6 | f6 _ _ _ d6 _ b5 _`;
const RUMIA_C = `g5 _ c6 _ eb6 _ [d6 c6] [b5 c6] | ab5 _ c6 _ eb6 _ [f6 eb6] [c6 ab5] | bb5 _ d6 _ f6 _ eb6 d6 | eb6 _ _ _ bb5 _ g5 _ |
  c6 _ ab5 _ eb6 _ c6 _ | f6 _ eb6 _ c6 _ ab5 _ | b5 _ _ _ d6 _ f6 _ | g6 _ _ _ [f6 d6] [b5 g5] . .`;
const RUMIA_ARP = "0 2 1 2 0 2 1 2 0 2 1 2 0 2 1 2";
const RUMIA_BASS = "0 0 0 0^ 0 0 0 0^";
const RUMIA_BEAT = "kh . h . sh . h . kh . kh . sh . h h";
const RUMIA_FILL = "kh . h . sh . h . s s s s s! s! kh! .";

export const rumiaSong: Song = {
  bpm: 160,
  inst: { lead: darkLead, counter: organ, arp: pluck, bass, pad: darkPad },
  mix: { counter: 0.08, pad: 0.06 },
  fadeIn: 0.1,
  sections: {
    intro: {
      chords: "Cm | Ab | Fm | G",
      arp: RUMIA_ARP,
      bass: "0 _ _ _ _ _ _ _",
      drums: "k . . . . . . . k . . . . . . .",
      fill: RUMIA_FILL,
      crash: false,
    },
    A: { chords: "Cm | Cm | Ab | Ab | Fm | G | Cm | G", lead: RUMIA_A, arp: RUMIA_ARP, bass: RUMIA_BASS, drums: RUMIA_BEAT },
    B: {
      chords: "Ab | Bb | Gm | Cm | Fm | Bb | Eb | G",
      lead: RUMIA_B,
      counter: "1 _ _ _ 2 _ _ _",
      arp: "0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1",
      bass: RUMIA_BASS,
      drums: RUMIA_BEAT,
      fill: RUMIA_FILL,
    },
    C: {
      chords: "Cm | Ab | Bb | Eb | Ab | Fm | G | G",
      lead: RUMIA_C,
      counter: shift(RUMIA_C, -12),
      arp: RUMIA_ARP,
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      fill: RUMIA_FILL,
    },
  },
  form: ["intro", "A", "B", "C"],
  loop: 1,
};

// ---------- stage clear: a two-bar fanfare, then silence ----------

export const clearSong: Song = {
  bpm: 132,
  inst: { lead: trumpet, counter: bell, arp: glass, bass, pad },
  sections: {
    fanfare: {
      chords: "F G | C",
      lead: "c5 . e5 . g5 . [c6 _ _ d6] | e6! _ _ _ _ _ _ _",
      counter: "e5 . g5 . b5 . [e6 _ _ f6] | g6 _ _ _ _ _ _ _",
      arp: "0 1 2 3 4 3 2 1 | 0 1 2 3 4 5 6 7",
      bass: "0 _ 0 _ 0 _ 0 _ | 0 _ _ _ _ _ _ _",
      drums: "k . s . k . s s | kc! . . . . . . .",
      crash: false,
    },
  },
  form: ["fanfare"],
  loop: null,
};
