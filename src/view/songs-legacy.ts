// Earlier versions of the soundtrack, kept for the music room to compare
// against the current one (songs.ts); the game never plays them. The first
// soundtrack (v1, from before the rebuild) is kept as written, with its own
// instruments; v1() puts back that engine's levels, mono voices and
// root-position pads. Its drums and effects are the current engine's.
// Then "Dawn at the Hakurei Shrine", the title that replaced v1's and was
// itself replaced, with the heavier instruments it was written for.

import type { Inst, Song } from "./music.ts";
import type { TrackInfo } from "./songs.ts";

/** A v1 song (no keys voice) in the first engine's mix. */
function v1(song: Omit<Song, "inst"> & { inst: Omit<Song["inst"], "keys"> }): Song {
  return {
    ...song,
    inst: { ...song.inst, keys: song.inst.pad },
    rootPads: true,
    mix: { lead: 0.2, counter: 0.1, arp: 0.075, bass: 0.22, pad: 0.05, drums: 0.3, ...song.mix },
    pan: { counter: 0, keys: 0, arp: 0, perc: 0 },
  };
}

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

const menuSong = v1({
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
});

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

const lakeSong = v1({
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
});

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

const cirnoSong = v1({
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
});

// ---------- Forest of Magic: "Mushrooms under the Canopy" (E dorian, lilting) ----------

const FOREST_A = `e5 _ g5 _ b5 _ a5 g5 | e5 _ a5 _ c#6 _ b5 a5 | b5 _ g5 _ e5 _ f#5 g5 | f#5 _ e5 _ c#5 _ e5 _ |
  g5 _ e5 _ c6 _ b5 g5 | a5 _ f#5 _ d6 _ c6 a5 | b5 _ _ _ f#5 _ d5 _ | d#5 _ f#5 _ a5 _ b5 _`;
const FOREST_B = `e6 _ _ b5 g5 _ e5 _ | f#5 _ a5 _ d6 _ c6 a5 | b5 _ _ _ d6 _ f#5 _ | g5 _ e5 _ b5 _ g5 _ |
  c6 _ a5 _ e6 _ c6 _ | d6 _ c6 _ a5 _ f#5 _ | d#6 _ _ _ b5 _ a5 _ | f#5 _ _ _ d#5 _ [e5 f#5] [g5 a5]`;
const FOREST_CH_A = "Em | A | Em | A | C | D | Bm | B7";
const FOREST_CH_B = "Cmaj7 | D | Bm | Em | Am | D | B7 | B7";
const FOREST_BEAT = "kh h sh h kh h sh o";
const FOREST_FILL = "kh h sh h s s s! s!";

const forestSong = v1({
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
});

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

const rumiaSong = v1({
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
});

// ---------- stage clear: a two-bar fanfare, then silence ----------

const clearSong = v1({
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
});

// ---------- "Dawn at the Hakurei Shrine": the rich-harmony title, replaced before it was committed ----------
//
// With the instruments as they were then: the four-layer piano (a saw an
// octave up), strings over a sub-octave saw, and piano-voiced sixteenth arpeggios.

const dPiano: Inst = {
  osc: [
    ["sine", 0, 0, 0.45],
    ["triangle", 0, 3, 0.3],
    ["sawtooth", 12, -3, 0.1],
    ["square", 0, 0, 0.15],
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
const dSoftPiano: Inst = { ...dPiano, d: 0.8, s: 0.15, r: 0.45, cut: 700, env: 1500 };
const dTrumpet: Inst = {
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
const dSoftBrass: Inst = { ...dTrumpet, a: 0.05, cut: 450, env: 1600, scoop: 25 };
const dEpiano: Inst = {
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
const dStrings: Inst = {
  osc: [
    ["sawtooth", 0, -10, 0.35, -0.6],
    ["sawtooth", 0, 10, 0.35, 0.6],
    ["sawtooth", -12, 0, 0.3],
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
const dSoftBass: Inst = {
  osc: [
    ["triangle", 0, 0, 0.7],
    ["sine", -12, 0, 0.3],
  ],
  a: 0.01,
  d: 0.4,
  s: 0.6,
  r: 0.15,
};

const ARP16 = "0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1";
const DAWN_A = `e5 _ _ f#5 g5 _ b5 _ | c6 _ b5 a5 b5 _ d#5 _ | e5 _ _ f#5 g5 _ b5 _ | e6 _ d6 c#6 b5 _ g5 _ |
  a5 _ _ g5 f#5 _ e5 _ | f#5 _ g5 _ e6 _ d6 c6 | c6 _ a5 _ f#5 _ d#5 _ | e5 _ _ _ _ _ [f#5 g5] [a5 b5]`;
const DAWN_A_COUNTER = `b4 _ _ _ _ _ a4 _ | g4 _ _ _ f#4 _ _ _ | b4 _ _ _ _ _ a4 _ | g4 _ _ _ _ _ _ _ |
  e4 _ _ _ f#4 _ _ _ | f#4 _ _ _ e4 _ _ _ | e4 _ _ _ d#4 _ _ _ | e4 _ _ _ _ _ _ _`;
const DAWN_CH_A = "Em Em/D | Cmaj7 B7 | Em Em/D | C#m7b5 Cmaj7 | Am7 D7 | Gmaj7 Cmaj7 | F#m7b5 B7 | Em Em/D";
const DAWN_A_BASS = `e2 _ g2 _ d2 _ f#2 _ | c2 _ e2 _ b1 _ d#2 _ | e2 _ g2 _ d2 _ f#2 _ | c#2 _ e2 _ c2 _ e2 _ |
  a2 _ g2 _ f#2 _ d2 _ | g2 _ f#2 _ e2 _ c2 _ | f#2 _ a2 _ b1 _ d#2 _ | e2 _ b1 _ d2 _ d2 _`;
const DAWN_B = `g5 _ c6 _ e6 _ d6 c6 | d6 _ _ b5 g5 _ b5 _ | c6 _ e6 _ g6 _ f#6 _ | d6 _ _ _ f6 _ e6 d6 |
  e6 _ _ g6 f#6 _ d6 _ | f#6 _ d6 b5 g#5 _ b5 _ | a6 _ _ g6 f#6 _ c6 _ | g6 _ _ _ _ _ . .`;
const DAWN_B_COUNTER = `e5 _ _ _ f#5 _ _ _ | f#5 _ _ _ g5 _ _ _ | e5 _ _ _ g5 _ f#5 _ | d5 _ _ _ f5 _ _ _ |
  e5 _ _ _ f#5 _ _ _ | d5 _ _ _ e5 _ g#5 _ | e5 _ _ _ d5 _ c5 _ | c5 _ _ _ b4 _ _ _`;
const DAWN_CH_B = "Cmaj7 D | Bm7 Em7 | Am7 ~ D7sus4 D7 | Gmaj7 G7 | Cmaj7 D | Bm7 E7 | Am7 D7 | Gsus4 G";
const DAWN_C = `c6 _ a5 _ b5 _ g5 _ | a5 _ f5 _ b5 _ d6 _ | e6 _ _ d6 c6 _ a5 _ | d6 _ _ c6 b5 _ g#5 _ |
  a5 _ c6 _ e6 _ g6 _ | a6 _ _ g6 g#6 _ e6 _ | [a6 g#6] [f6 e6] [d6 c6] [b5 a5] [g#5 a5] [b5 c6] [d6 e6] [f6 g6] | g6 _ e6 _ c#6 _ e6 _`;
const DAWN_CH_C = "Fmaj7 Em7 | Dm7 G7 | Cmaj7 Fmaj7 | Bm7b5 E7 | Am7 Am7/G | Fmaj7 E7 | N | Em7 A7";
const DAWN_C_BASS = `f2 _ _ _ e2 _ _ _ | d2 _ _ _ g2 _ _ _ | c2 _ _ _ f2 _ _ _ | b1 _ _ _ e2 _ _ _ |
  a2 _ _ _ g2 _ _ _ | f2 _ _ _ e2 _ _ _ | . . . . . . . . | e2 _ _ _ a1 _ _ _`;
const DAWN_C_ARP = `${Array(6).fill(ARP16).join(" | ")} | ${Array(16).fill(".").join(" ")} | ${ARP16}`;
const DAWN_BEAT = "k . h . s? . h . k . h . s? . h h?";
const DAWN_BEAT_B = "k . h . s . h k . k h . s . h o";

const dawnSong: Song = {
  bpm: 96,
  key: "E minor",
  voiceLead: true,
  inst: { lead: dPiano, counter: dStrings, keys: dEpiano, arp: dSoftPiano, bass: dSoftBass, pad: dStrings },
  mix: { lead: 0.2, arp: 0.075, drums: 0.18, pad: 0.035, counter: 0.08, keys: 0.05 },
  pan: { arp: -0.15, counter: 0.3, keys: 0.2 },
  layers: {},
  fadeIn: 2.5,
  sections: {
    intro: {
      chords: "Em Em/D | C#m7b5 Cmaj7 | Am7 D7 | Gmaj7 B7/F#",
      counter: "b4 _ _ _ _ _ a4 _ | g4 _ _ _ _ _ _ _ | e4 _ _ _ f#4 _ _ _ | f#4 _ _ _ d#4 _ _ _",
      arp: ARP16,
      bass: "e2 _ _ _ d2 _ _ _ | c#2 _ _ _ c2 _ _ _ | a1 _ _ _ d2 _ _ _ | g2 _ _ _ f#2 _ _ _",
      dyn: [0.55, 0.85],
    },
    A: { chords: DAWN_CH_A, lead: DAWN_A, arp: ARP16, bass: DAWN_A_BASS, drums: DAWN_BEAT, dyn: [0.75, 0.92] },
    B: {
      chords: DAWN_CH_B,
      lead: DAWN_B,
      arp: ARP16,
      keys: ". * . * . * . *",
      bass: "0 _ 0^ 0 0 _ 0^ 2",
      drums: DAWN_BEAT_B,
      fill: "k . h . s . h k s s s s s! s t l",
      dyn: [0.9, 1],
      inst: { lead: dSoftBrass },
    },
    A2: {
      chords: DAWN_CH_A,
      lead: DAWN_A,
      counter: DAWN_A_COUNTER,
      arp: ARP16,
      keys: ". . * . . . * .",
      bass: DAWN_A_BASS,
      drums: DAWN_BEAT,
      dyn: [0.8, 0.95],
    },
    B2: {
      chords: DAWN_CH_B,
      lead: DAWN_B,
      counter: DAWN_B_COUNTER,
      arp: ARP16,
      keys: ". * . * . * . *",
      bass: "0 _ 0^ 0 0 _ 0^ 2",
      drums: DAWN_BEAT_B,
      fill: "k . h . s . h k s s s s s! s t l",
      dyn: [0.9, 1],
      inst: { lead: dSoftBrass },
    },
    C: {
      chords: DAWN_CH_C,
      lead: DAWN_C,
      counter: "a4 _ _ _ g4 _ _ _ | f4 _ _ _ f4 _ _ _ | e4 _ _ _ e4 _ _ _ | d4 _ _ _ d4 _ _ _ | c4 _ _ _ _ _ _ _ | c4 _ _ _ b3 _ _ _ | . . . . . . . . | b3 _ _ _ c#4 _ _ _",
      arp: DAWN_C_ARP,
      bass: DAWN_C_BASS,
      drums: "k . r . s? . r . k . r . s? . r .",
      fill: "k . . . s . . . s s s s s! s! s! s!",
      dyn: [0.7, 1],
    },
    B3: {
      chords: DAWN_CH_B,
      lead: DAWN_B,
      counter: DAWN_B_COUNTER,
      arp: ARP16,
      keys: ". * . * . * . *",
      bass: "0 _ 0^ 0 0 _ 0^ 2",
      drums: DAWN_BEAT_B,
      perc: ". h h? h . h h? h . h h? h . h h? h",
      tr: 2,
      inst: { lead: dTrumpet },
    },
    turn: {
      chords: "Cmaj7 ~ Am7/C ~ | B7sus4 ~ B7 ~",
      lead: "e6 _ d6 c6 b5 _ a5 _ | f#5 _ _ _ d#5 _ b4 _",
      counter: "g4 _ _ _ a4 _ _ _ | e4 _ _ _ d#4 _ _ _",
      arp: ARP16,
      bass: "c2 _ _ _ c2 _ _ _ | b1 _ _ _ a1 _ _ _",
      drums: "k . h . s . h . k . h . s . h . | k . s . s s s s t t m m l l s! s!",
      crash: false,
      dyn: [0.95, 0.75],
    },
  },
  form: ["intro", "A", "B", "A2", "B2", "C", "B3", "turn"],
  loop: 1,
};

// ---------- v2: the rebuilt engine's first Misty Lake and Cirno themes (replaced by songs.ts's current pair) ----------
//
// Kept as they were written, with the synthesized trumpet and FM piano they
// were written for: the "before" for the rewrite that gave the pair sampled
// instruments, a motif each, harmony that climbs, and adaptive parts.

/** Transposes a part's absolute notes by n semitones (chord-tone digits are left alone). */
function v2shift(part: string, n: number): string {
  const names = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
  const pc: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  return part.replace(/\b([a-g])([#b]?)(\d)/g, (_, l: string, acc: string, o: string) => {
    const m = 12 * Number(o) + pc[l]! + (acc === "#" ? 1 : acc === "b" ? -1 : 0) + n;
    return `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12)}`;
  });
}

const V2_ARP16 = "0 1 2 3 4 3 2 1 0 1 2 3 4 3 2 1";

/** The ZUN-style trumpet: bright stacked saws that scoop up into the note, with a late vibrato. */
const v2Trumpet: Inst = {
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
/** A bright FM piano: a hammered attack that mellows. */
const v2Piano: Inst = {
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
/** A tine e-piano (FM ratio 1): bell on the attack, round underneath. */
const v2Epiano: Inst = {
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
/** Strings: two detuned saws, spread left and right. */
const v2Strings: Inst = {
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
const v2QuickStrings: Inst = { ...v2Strings, a: 0.08, r: 0.3 };
/** FM bell, inharmonic: ice. */
const v2Bell: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 3.5, index: 1.6, decay: 0.35 }, a: 0.002, d: 0.6, s: 0, r: 0.5 };
/** FM glass pluck, harmonic: sparkling arpeggios. */
const v2Glass: Inst = { osc: [["sine", 0, 0, 1]], fm: { ratio: 2, index: 1.2, decay: 0.08 }, a: 0.002, d: 0.16, s: 0, r: 0.12 };
/** Picked bass: a snappy filter over saw, square and a sine sub. */
const v2Bass: Inst = {
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

// ---------- Misty Lake: "Fairies Dancing in the Morning Mist" (A minor, a C major hook that lifts to D) ----------

const V2_LAKE_A = `a4 _ c5 e5 a5 _ g5 e5 | g5 _ a5 _ e5 _ c5 _ | f5 _ e5 f5 a5 _ c6 _ | b5 _ _ _ g#5 _ e5 _ |
  a5 _ b5 c6 e6 _ d6 c6 | b5 _ c6 _ g5 _ e5 _ | f5 _ a5 _ c6 _ d6 c6 | b5 _ _ _ g#5 _ [a5 b5] _`;
const V2_LAKE_B = `d6 _ _ c6 a5 _ f5 _ | g5 _ a5 _ b5 _ d6 _ | e6 _ _ d6 c6 _ g5 _ | a5 _ c6 _ f6 _ e6 _ |
  d6 _ _ c6 b5 _ f5 _ | g#5 _ b5 _ e6 _ d6 _ | c6 _ b5 a5 e5 _ a5 _ | b5 _ _ _ e6 _ g#5 _`;
const V2_LAKE_C = `c6 _ a5 c6 f6 _ e6 c6 | d6 _ b5 d6 g6 _ f6 d6 | e6 _ _ d6 b5 _ g5 b5 | c6 _ _ _ a5 _ e5 _ |
  f5 _ a5 _ d6 _ f6 _ | g6 _ f6 _ e6 _ d6 _ | e6 _ _ _ g#6 _ b6 _ | a6 _ _ _ _ _ . .`;
const V2_LAKE_CH_A = "Am | Am/G | Fmaj7 | E7 | Am | Am/G | Dm7 | E7";
const V2_LAKE_CH_B = "Dm7 | G | Cmaj7 | Fmaj7 | Bm7b5 | E7 | Am | E7";
const V2_LAKE_CH_C = "Fmaj7 | G | Em7 | Am | Dm7 | G | E7 | Am";
const V2_LAKE_BASS = "0 0 0^ 0 0 0 0^ 2";
const V2_LAKE_BEAT = "kh . h . sh . h kh . h kh . sh . h .";
const V2_LAKE_PERC = ". h? h h? x h? h h? . h? h h? x h? h h?";
const V2_LAKE_FILL = "kh . h . sh . h . s s t t m m l l";

const v2LakeSong: Song = {
  bpm: 152,
  voiceLead: true,
  inst: { lead: v2Piano, counter: v2Bell, keys: v2Epiano, arp: v2Glass, bass: v2Bass, pad: v2Strings },
  sections: {
    intro: {
      chords: "Am | F | G | E7",
      arp: V2_ARP16,
      bass: "0 . . 0 . . 0 .",
      drums: "k . . . h . . . k . . . h . . .",
      fill: "k . s . k . s . s s s s s! s s! s!",
      crash: false,
    },
    A: { chords: V2_LAKE_CH_A, lead: V2_LAKE_A, arp: V2_ARP16, keys: ". . * . . * . .", bass: V2_LAKE_BASS, drums: V2_LAKE_BEAT, perc: V2_LAKE_PERC },
    B: {
      chords: V2_LAKE_CH_B,
      lead: V2_LAKE_B,
      counter: "3 _ _ _ 2 _ _ _",
      arp: V2_ARP16,
      keys: ". * . * . * . *",
      bass: "0 0 0^ 0 0 0^ 0 0^",
      drums: V2_LAKE_BEAT,
      perc: V2_LAKE_PERC,
      fill: V2_LAKE_FILL,
      inst: { lead: v2Trumpet, counter: v2QuickStrings },
    },
    C: {
      chords: V2_LAKE_CH_C,
      lead: V2_LAKE_C,
      counter: "2^ _ _ _ 1^ _ 2^ _",
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: "* . . * . . * .",
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      perc: V2_LAKE_PERC,
      fill: V2_LAKE_FILL,
      inst: { lead: v2Trumpet },
    },
    A2: {
      chords: V2_LAKE_CH_A,
      lead: V2_LAKE_A,
      counter: "2^ _ _ _ 1^ _ _ _",
      arp: V2_ARP16,
      keys: ". . * . . * . .",
      bass: V2_LAKE_BASS,
      drums: V2_LAKE_BEAT,
      perc: V2_LAKE_PERC,
    },
    C2: {
      chords: V2_LAKE_CH_C,
      lead: V2_LAKE_C,
      counter: v2shift(V2_LAKE_C, -12),
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: "* . . * . . * .",
      bass: "0 0^ 0 0^ 0 0^ 0 0^",
      drums: "kh . h h sh . h . kh . kh h sh . h o",
      perc: V2_LAKE_PERC,
      fill: V2_LAKE_FILL,
      tr: 2,
      inst: { lead: v2Trumpet, counter: v2QuickStrings },
    },
    turn: {
      chords: "F | E7",
      lead: "a5 _ c6 _ f6 _ e6 _ | g#5 _ _ _ b5 _ e6 _",
      arp: V2_ARP16,
      bass: "0 0 0^ 0 0 0 0^ 0",
      drums: "kh . h . sh . h . kh . h . sh . h . | s . s s s s s s t t m m l l s! s!",
      crash: false,
      inst: { lead: v2Trumpet },
    },
  },
  form: ["intro", "A", "B", "C", "A2", "B", "C", "C2", "turn"],
  loop: 1,
};

// ---------- Cirno: "The Strongest Frozen Tomboy" (D minor, icy and fast; the last hook in E minor) ----------

const V2_CIRNO_A = `a5 _ d6 _ [c6 a5] [f5 a5] d6 _ | e6 _ f6 _ [e6 d6] [c6 d6] a5 _ | bb5 _ d6 _ f6 _ [e6 f6] g6 | e6 _ _ _ c6 _ g5 _ |
  a5 _ d6 _ [c6 a5] [f5 a5] d6 _ | e6 _ f6 _ a6 _ [g6 f6] e6 | d6 _ [bb5 d6] g6 _ f6 e6 d6 | c#6 _ e6 _ a6 _ g6 e6`;
const V2_CIRNO_B = `f6 _ _ e6 d6 _ bb5 _ | c6 _ d6 _ e6 _ g6 _ | e6 _ _ d6 c6 _ a5 _ | d6 _ _ _ f6 _ a6 _ |
  g6 _ _ f6 d6 _ bb5 _ | c6 _ e6 _ g6 _ bb6 _ | a6 _ _ _ f6 _ c6 _ | e6 _ c#6 _ a5 _ [c#6 e6] [g6 bb6]`;
const V2_CIRNO_C = `d6 _ f6 _ [e6 d6] c6 d6 _ | e6 _ g6 _ [f6 e6] d6 e6 _ | c6 _ e6 _ a6 _ g6 e6 | f6 _ _ _ d6 _ a5 _ |
  d6 _ f6 _ [e6 d6] c6 d6 _ | e6 _ g6 _ c7 _ bb6 g6 | a6 _ _ _ c#6 _ e6 _ | d6 _ _ _ _ _ . .`;
const V2_CIRNO_CH_A = "Dm | Dm | Bb | C | Dm | Dm | Gm | A7";
const V2_CIRNO_CH_B = "Bb | C | Am | Dm | Gm | C | F | A7";
const V2_CIRNO_CH_C = "Bb | C | Am | Dm | Bb | C | A7 | Dm";
const V2_CIRNO_BASS = "0 0^ 0 0^ 0 0^ 0 0^";
const V2_CIRNO_BEAT = "kh . h h sh . h . kh . kh h sh . h o";
const V2_CIRNO_PERC = ". h h? h x h h? h . h h? h x h h? t";
const V2_CIRNO_FILL = "kh . h h sh . h . s s t t [s s] [m m] l! l!";
const V2_CIRNO_KEYS = "* . . * . . * .";

const v2CirnoSong: Song = {
  bpm: 172,
  voiceLead: true,
  inst: { lead: v2Piano, counter: v2Bell, keys: v2Epiano, arp: v2Glass, bass: v2Bass, pad: v2Strings },
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
      fill: V2_CIRNO_FILL,
      crash: false,
    },
    A: { chords: V2_CIRNO_CH_A, lead: V2_CIRNO_A, arp: V2_ARP16, keys: V2_CIRNO_KEYS, bass: V2_CIRNO_BASS, drums: V2_CIRNO_BEAT, perc: V2_CIRNO_PERC },
    B: {
      chords: V2_CIRNO_CH_B,
      lead: V2_CIRNO_B,
      counter: "2 _ _ _ 1 _ _ _",
      arp: V2_ARP16,
      keys: ". * . * . * . *",
      bass: "0 0 0^ 0 0 0 0^ 2",
      drums: V2_CIRNO_BEAT,
      perc: V2_CIRNO_PERC,
      fill: V2_CIRNO_FILL,
      inst: { lead: v2Trumpet, counter: v2QuickStrings },
    },
    C: {
      chords: V2_CIRNO_CH_C,
      lead: V2_CIRNO_C,
      counter: "3^ _ 2^ _ 1^ _ 2^ _",
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: V2_CIRNO_KEYS,
      bass: V2_CIRNO_BASS,
      drums: V2_CIRNO_BEAT,
      perc: V2_CIRNO_PERC,
      fill: V2_CIRNO_FILL,
      inst: { lead: v2Trumpet },
    },
    A2: {
      chords: V2_CIRNO_CH_A,
      lead: V2_CIRNO_A,
      counter: v2shift(V2_CIRNO_A, -12),
      arp: V2_ARP16,
      keys: V2_CIRNO_KEYS,
      bass: V2_CIRNO_BASS,
      drums: V2_CIRNO_BEAT,
      perc: V2_CIRNO_PERC,
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
      chords: V2_CIRNO_CH_C,
      lead: V2_CIRNO_C,
      counter: v2shift(V2_CIRNO_C, -12),
      arp: "0 2 4 2 1 3 5 3 0 2 4 2 1 3 5 3",
      keys: V2_CIRNO_KEYS,
      bass: V2_CIRNO_BASS,
      drums: V2_CIRNO_BEAT,
      perc: V2_CIRNO_PERC,
      fill: V2_CIRNO_FILL,
      tr: 2,
      inst: { lead: v2Trumpet, counter: v2QuickStrings },
    },
    turn: {
      chords: "C | A7",
      lead: "e6 _ g6 _ c7 _ bb6 _ | a6 _ _ _ c#6 _ e6 _",
      arp: V2_ARP16,
      bass: V2_CIRNO_BASS,
      drums: "kh . h h sh . h . kh . kh h sh . h o | s s s s s s s s t t m m l l s! s!",
      crash: false,
      inst: { lead: v2Trumpet },
    },
  },
  form: ["intro", "A", "B", "C", "A2", "B", "break", "C", "C2", "turn"],
  loop: 1,
};

// ---------- the music room's earlier versions ----------

const V1 = "The first soundtrack, from before the synth and the songs were rebuilt: two eight-bar sections a song, one triad a bar, mono voices, root-position pads, the first instruments.";

export const LEGACY_TRACKS: readonly TrackInfo[] = [
  { id: "v1-menu", title: "Dawn over the Hakurei Shrine (v1)", where: "Title screen, first version", comment: `${V1} A calm B minor flute tune over piano arpeggios.`, song: menuSong },
  { id: "v1-lake", title: "Fairies over the Fog (v1)", where: "Misty Lake, first version", comment: `${V1} Trumpet over glass arpeggios in A minor.`, song: lakeSong },
  { id: "v1-cirno", title: "Frozen Tomboy of the Lake (v1)", where: "Cirno's theme, first version", comment: `${V1} A piano lead in D minor at 168 BPM.`, song: cirnoSong },
  { id: "v1-forest", title: "Mushrooms under the Canopy (v1)", where: "Forest of Magic, first version", comment: `${V1} A swung reed tune in E dorian.`, song: forestSong },
  { id: "v1-rumia", title: "Darkness that Swallows the Moon (v1)", where: "Rumia's theme, first version", comment: `${V1} A dark trumpet and organ in C harmonic minor.`, song: rumiaSong },
  { id: "v1-clear", title: "Stage Clear (v1)", where: "Stage clear, first version", comment: `${V1} The two-bar fanfare.`, song: clearSong },
  {
    id: "dawn",
    title: "Dawn at the Hakurei Shrine (old title)",
    where: "Title screen, replaced",
    comment:
      "The rich-harmony title that came between the first version and Wind Chimes: sevenths and slash chords two to a bar, a chromatic walking bass, voice-led sixteenth arpeggios, a no-chord run in the bridge and a whole-step lift, with the heavier piano and strings of the time. Replaced because its verse had no hook and spent all its richness at once.",
    song: dawnSong,
  },
  {
    id: "v2-lake",
    title: "Fairies Dancing in the Morning Mist (v2)",
    where: "Misty Lake, second version",
    comment:
      "The rebuilt engine's first stage 1 theme, with its synthesized trumpet and FM piano: an A minor tune, a circle-of-fifths bridge and a royal-road hook lifted a step for its last round. Replaced because nothing in it stuck after a run: no motif ran through it, and every section sat at the same level.",
    song: v2LakeSong,
  },
  {
    id: "v2-cirno",
    title: "The Strongest Frozen Tomboy (v2)",
    where: "Cirno's theme, second version",
    comment:
      "The rebuilt engine's first Cirno theme: D minor at 172 BPM, a piano riff and a trumpet hook, bells and glass for the ice. Replaced by a theme that knows when her spell cards come.",
    song: v2CirnoSong,
  },
].map((t) => ({ credit: "Original composition for Gensokyo Survivors", ...t }));
