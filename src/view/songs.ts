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

// ---------- recorded voices (instruments/: the University of Iowa's samples, cut by scripts/music-samples.ts) ----------

/** A grand piano: notes ring on a little as if the pedal were down, and soft ones are darker. The FM piano plays until it loads. */
const grand: Inst = { ...piano, sample: "piano", sampleGain: 0.78, tone: { cut: 2400, kt: 2, env: 9000, fd: 0.35 }, r: 0.45, ring: 0.3 };
/** The grand played quietly, with more pedal. */
const grandSoft: Inst = { ...grand, sampleGain: 0.66, tone: { cut: 1300, kt: 1.6, env: 3500, fd: 0.5 }, ring: 0.7 };
/** A trumpet: it scoops up into the note and takes a late vibrato when held. */
const brass: Inst = { ...trumpet, sample: "trumpet", sampleGain: 1.4, tone: { cut: 2800, kt: 1.2, env: 7000, fd: 0.25 }, scoop: 35, vib: { depth: 14, delay: 0.24 } };
/** The trumpet darkened, for the midboss. */
const darkBrass: Inst = { ...brass, tone: { cut: 1300, kt: 0.9, env: 2200, fd: 0.3 }, vib: { depth: 18, delay: 0.3 } };
/** A synth string section: four saws spread across the stereo field, bowed in slowly (the recorded section stands on it while it loads). */
const ensemble: Inst = {
  osc: [
    ["sawtooth", 0, -13, 0.28, -0.75],
    ["sawtooth", 0, 11, 0.28, 0.75],
    ["sawtooth", 0, -4, 0.22, -0.3],
    ["sawtooth", 0, 6, 0.22, 0.3],
  ],
  a: 0.4,
  d: 1.6,
  s: 0.85,
  r: 0.65,
  cut: 1150,
  kt: 0.55,
  q: 0.4,
  vib: { depth: 7, delay: 0.4 },
};
/** The picked bass without its sub-octave: the kick keeps the lowest octave to itself. */
const pickBass: Inst = {
  ...bass,
  osc: [
    ["sawtooth", 0, 0, 0.55],
    ["square", 0, -8, 0.2],
    ["sine", 0, 0, 0.25],
  ],
};
/**
 * A string section, recorded (VSCO 2 CE's violins, and violas below G3): bowed in, singing with the
 * players' own vibrato, darker when soft. The synth ensemble plays until it has loaded.
 */
const section: Inst = {
  osc: ensemble.osc,
  a: 0.25,
  d: 1.6,
  s: 0.85,
  r: 0.6,
  cut: 1150,
  kt: 0.55,
  q: 0.4,
  sample: "strings",
  sampleGain: 0.8,
  tone: { cut: 4000, kt: 1.5, env: 3000, fd: 0.5 },
};
/** The section muted and far off: the midboss, and the dialogue before the boss. */
const darkSection: Inst = { ...section, tone: { cut: 1100, kt: 0.6, env: 800, fd: 0.6 } };
/** The section taking a line of its own, bowed in quicker. */
const quickSection: Inst = { ...section, a: 0.05, r: 0.3 };
/** The strings as a quiet line under a verse (lent to the counter voice, which is louder than the pad). */
const climbSection: Inst = { ...section, gain: 0.6 };
/** A second trumpet in harmony under the lead, lent to the keys voice (quieter than the lead): it keeps a section's weight. */
const secondBrass: Inst = { ...brass, gain: 2.4, tone: { cut: 2200, kt: 1, env: 5000, fd: 0.25 }, scoop: 25 };

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
/** The same at half speed: a bridge's first bars. */
const ARP8 = "0 1 2 3 4 3 2 1";

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

// ---------- Misty Lake: "Fairies Dancing in the Morning Mist" (A minor; the chorus in C major, the last one in D) ----------
//
// One hook, in the first bar: from the fifth up a fourth and on up the scale to the minor third,
// off the beat (E-A-B-C), then a fall from the chord's seventh (E-D-C-A over F: the mist is that
// major seventh), answered a step lower over G and E7. The verse's second half climbs against a
// bass that sinks by half steps (A G# G F#), with bells answering a step higher each time. The
// pre-chorus climbs a whole scale on the bass with the trumpet a tenth above it, and the chorus
// breaks into C major on a deceptive E7-to-F: a little repeated-note figure that walks down the
// royal road and back up, then long notes over a falling bass. The bridge is a waterfall of seventh
// chords on the piano. The second verse gets a string line that climbs an octave under the hook,
// and the last chorus is a step up, in D, with a second trumpet in thirds under the first and the
// ride cymbal on every beat.
//
// In a run the e-piano and the drums' second layer come in as the swarm thickens. Daiyousei's
// stretch (M, outside the form) plays the hook in D minor on a dark trumpet over toms until she is
// gone; then the pre-chorus climbs out of it into the D major chorus. The boss's winds sweep the
// song away through a closing filter (Music.blowAway).

const LAKE_HOOK = `e5 a5 _ b5 c6 _ b5 c6 | e6 _ _ d6 c6 _ a5 _ | d5 g5 _ a5 b5 _ a5 b5 | d6 _ _ c6 b5 _ g#5 _`;
const LAKE_VERSE = `${LAKE_HOOK} |
  e5 a5 _ b5 c6 _ b5 c6 | e6 _ _ d6 c6 _ d6 e6 | f6 _ _ e6 d6 _ c6 d6 | e6 _ _ _ b5 _ g#5 _ |
  e5 _ _ a5 c6 _ _ b5 | _ _ a5 _ b5 _ _ _ | e5 _ _ a5 c6 _ _ d6 | _ _ c6 _ d6 _ _ _ |
  e5 _ _ a5 c6 _ _ e6 | _ _ d6 _ e6 _ _ _ | d6 _ _ e6 f6 _ a6 _ | _ _ _ _ g#6 _ e6 _`;
const LAKE_CH_A = "Am | F | G | E7 | Am | F | Dm7 | E7 | Am | Am/G# | Am/G | D/F# | Fmaj7 | C/E | Dm7 | E7sus4 E7";
/** The second verse's colours: ninths, a sixth, the flat ninth on the dominant. */
const LAKE_CH_A2 = "Am9 | Fmaj7 | G6 | E7b9 | Am9 | Fmaj9 | Dm9 | E7 | Am | Am/G# | Am/G | D/F# | Fmaj7 | C/E | Dm7 | E7sus4 E7";
/** Bells answer the lament in its long notes, a step higher each time. */
const LAKE_A_BELLS = `. | . | . | . | . | . | . | . |
  . | . . . . e6 _ _ _ | . | . . . . f#6 _ _ _ | . | . . . . g6 _ _ _ | . | .`;
/** Strings under the second verse: one line that climbs an octave, A to A, while the bass falls. */
const LAKE_A2_CLIMB = `a4 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | b4 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ |
  c5 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | d5 _ _ _ _ _ _ _ | _ _ _ _ e5 _ _ _ |
  e5 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | f#5 _ _ _ _ _ _ _ |
  g5 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | a5 _ _ _ _ _ _ _ | _ _ _ _ g#5 _ _ _`;

const LAKE_CH_B = "Dm7 | Em7 | Fmaj7 | G | Am7 | Bm7b5 | Cmaj7 D | E7sus4 E7";
/** The climb: each bar the same figure a step higher, a tenth above the bass. */
const LAKE_B_CLIMB = `f5 _ _ e5 f5 _ a5 _ | g5 _ _ e5 g5 _ b5 _ | a5 _ _ g5 a5 _ c6 _ | b5 _ _ a5 b5 _ d6 _ |
  c6 _ _ b5 c6 _ e6 _ | d6 _ _ c6 d6 _ f6 _ | e6 _ _ d6 c6 _ d6 _`;
const LAKE_B = `${LAKE_B_CLIMB} | e6 _ _ _ d6 _ b5 _`;
/** The second time its last bar turns to F#7, for the chorus in D. */
const LAKE_B2 = `${LAKE_B_CLIMB} | e6 _ _ _ a#5 _ c#6 _`;
/** Piano sparkle in the trumpet's long notes: a run up the chord. */
const LAKE_B_RUNS = "4^ 5^ 6^ 7^ 8^ . . . . . . . . . . .";

const LAKE_CH_C = "Fmaj7 | G | Am | E7 | Fmaj7 | G | Am | G7/B | C | G/B | Am | Am/G | Fmaj7 | G | E7sus4 E7 | Am";
const LAKE_C_WALK = `c6 c6 e6 _ _ d6 c6 _ | b5 b5 d6 _ _ c6 b5 _ | a5 a5 c6 _ _ b5 a5 _ | g#5 g#5 b5 _ _ a5 g#5 _ |
  a5 a5 c6 _ _ b5 a5 _ | b5 b5 d6 _ _ c6 b5 _ | c6 c6 e6 _ _ d6 c6 _ | d6 d6 f6 _ _ e6 d6 _`;
const LAKE_C_LONG = `e6 _ _ _ _ _ d6 c6 | d6 _ _ _ _ _ c6 b5 | c6 _ _ _ _ _ b5 a5 | b5 _ _ _ g5 _ e5 _`;
const LAKE_C_HOME = `c6 c6 e6 _ _ d6 c6 _ | b5 b5 d6 _ _ c6 b5 _ | a5 _ _ _ g#5 _ b5 _ | a5 _ _ _ _ _ . .`;
const LAKE_C = `${LAKE_C_WALK} | ${LAKE_C_LONG} | ${LAKE_C_HOME}`;
/** The piano doubles the trumpet, an octave up for the long notes. */
const LAKE_C_PIANO = `${LAKE_C_WALK} | ${shift(LAKE_C_LONG, 12)} | ${LAKE_C_HOME}`;
/** The last chorus's second trumpet: thirds under the walk, a line of its own under the long notes, a tritone into the last E7. */
const LAKE_C_HARM = `a5 a5 c6 _ _ b5 a5 _ | g5 g5 b5 _ _ a5 g5 _ | e5 e5 a5 _ _ g#5 e5 _ | e5 e5 g#5 _ _ f#5 e5 _ |
  f5 f5 a5 _ _ g5 f5 _ | g5 g5 b5 _ _ a5 g5 _ | a5 a5 c6 _ _ b5 a5 _ | b5 b5 d6 _ _ c6 b5 _ |
  c6 _ _ _ g5 _ b5 a5 | b5 _ _ _ g5 _ a5 g5 | a5 _ _ _ e5 _ g5 e5 | g5 _ _ _ e5 _ c5 _ |
  a5 a5 c6 _ _ b5 a5 _ | g5 g5 b5 _ _ a5 g5 _ | e5 _ _ _ d5 _ g#5 _ | e5 _ _ _ _ _ . .`;

const LAKE_CH_D = "Fmaj7 | Em7 | Dm7 | Cmaj7 | Bbmaj7 | Am7 | Bm7b5 | E7";
/** A waterfall of sevenths: every bar lands on its chord's seventh, a step below the last. */
const LAKE_D = `e6 _ _ _ _ _ c6 _ | d6 _ _ _ _ _ b5 _ | c6 _ _ _ _ _ a5 _ | b5 _ _ _ _ _ g5 _ |
  a5 _ _ _ _ _ f5 _ | g5 _ _ _ _ _ e5 _ | f5 _ a5 _ d6 _ f6 _ | e6 _ _ _ d6 _ [c6 b5] [a5 g#5]`;

const LAKE_M = `a4 d5 _ e5 f5 _ e5 f5 | a5 _ _ g5 f5 _ d5 _ | g4 c5 _ d5 e5 _ d5 e5 | g5 _ _ f5 e5 _ c#5 _ |
  a4 d5 _ e5 f5 _ e5 f5 | a5 _ _ bb5 a5 _ f5 _ | g5 _ _ f5 e5 _ d5 e5 | f5 _ _ _ e5 _ c#5 _`;

const LAKE_BEAT = "k . h . s . h k . . h . s . h .";
const LAKE_BEAT_B = "k . h k s . h . k . h k s . h o";
const LAKE_BEAT_C = `kc . h k s . h . k . k h s . h o | ${Array(3).fill("k . h k s . h . k . k h s . h o").join(" | ")}`;
/** The last chorus rides: the ride on every beat over the chorus beat. */
const LAKE_BEAT_C2 = `kc . h k sr . h . kr . k h sr . h o | ${Array(3).fill("kr . h k sr . h . kr . k h sr . h o").join(" | ")}`;
const LAKE_PERC = ". h? h h? x h? h h? . h? h h? x h? h h?";
const LAKE_FILL = "k . h . s . s s t t t t m m l l";
const LAKE_BUILD = "kw . s . s . s s s s s s s! s! s! s!";
const OCTAVES = "0 0^ 0 0^ 0 0^ 0 0^";

export const lakeSong: Song = {
  bpm: 156,
  key: "A minor",
  voiceLead: true,
  inst: { lead: grand, counter: bell, keys: epiano, arp: glass, bass: pickBass, pad: section },
  mix: { lead: 0.2, counter: 0.1, keys: 0.045, arp: 0.055, bass: 0.19, pad: 0.045, drums: 0.24, perc: 0.2 },
  pan: { counter: -0.15, keys: 0.2 },
  layers: { perc: 0.4, keys: 0.25 },
  fadeIn: 0.05,
  sections: {
    intro: {
      chords: "Am | F | G | E7",
      lead: LAKE_HOOK,
      arp: ARP16,
      bass: "0 _ _ _ _ _ _ _",
      drums: ". | . | . | w . . . . . . .",
      crash: false,
      dyn: [0.62, 0.85],
    },
    A: {
      chords: LAKE_CH_A,
      lead: LAKE_VERSE,
      counter: LAKE_A_BELLS,
      keys: ". . * . . * . .",
      arp: ARP16,
      bass: "0 _ 0 0^ _ 0 0^ 0",
      drums: LAKE_BEAT,
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      dyn: [0.8, 0.92],
    },
    B: {
      chords: LAKE_CH_B,
      lead: LAKE_B,
      counter: LAKE_B_RUNS,
      keys: ". * . * . * . *",
      arp: ARP16,
      bass: OCTAVES,
      drums: LAKE_BEAT_B,
      perc: LAKE_PERC,
      fill: LAKE_BUILD,
      dyn: [0.85, 1],
      inst: { lead: brass, counter: grand },
    },
    C: {
      chords: LAKE_CH_C,
      lead: LAKE_C,
      counter: LAKE_C_PIANO,
      keys: ". * . * . * . *",
      arp: ARP16,
      bass: OCTAVES,
      drums: LAKE_BEAT_C,
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      crash: false,
      inst: { lead: brass, counter: grand },
    },
    D: {
      chords: LAKE_CH_D,
      lead: LAKE_D,
      keys: "* . . . . . * . | * . . . . . . .",
      arp: `${ARP8} | ${ARP8} | ${ARP8} | ${ARP8} | ${ARP16} | ${ARP16} | ${ARP16} | ${ARP16}`,
      bass: `0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _ | 0 _ _ _ 0^ _ _ _ | 0 _ _ _ 0^ _ _ _ | 0 _ 0^ _ 0 _ 0^ _ | ${OCTAVES}`,
      drums: `k . . . r . . . s? . . . r . . . | k . . . r . . . s? . . . r . . . | k . . . r . . . s? . . . r . . . | k . . . r . . . s? . . . r . r . |
        k . r . r . r . s . r . r . r . | k . r . r . r . s . r . r . r . | k . r . s . r . k . r . s . r s | k . r . s . r . k . r . s . r s`,
      // With the swarm thick, soft offbeat hats keep the pulse through the waterfall.
      perc: ". . h? . . . h? . . . h? . . . h? .",
      fill: LAKE_BUILD,
      crash: false,
      dyn: [0.8, 1],
      inst: { lead: grandSoft },
    },
    A2: {
      chords: LAKE_CH_A2,
      lead: LAKE_VERSE,
      counter: LAKE_A2_CLIMB,
      keys: ". . * . . * . *",
      arp: ARP16,
      bass: OCTAVES,
      drums: LAKE_BEAT_B,
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      inst: { counter: climbSection },
    },
    B2: {
      chords: "Dm7 | Em7 | Fmaj7 | G | Am7 | Bm7b5 | Cmaj7 D | E7 F#7",
      lead: LAKE_B2,
      counter: LAKE_B_RUNS,
      keys: ". * . * . * . *",
      arp: ARP16,
      bass: OCTAVES,
      drums: LAKE_BEAT_B,
      perc: LAKE_PERC,
      fill: LAKE_BUILD,
      dyn: [0.9, 1],
      inst: { lead: brass, counter: grand },
    },
    C2: {
      chords: LAKE_CH_C,
      lead: LAKE_C,
      counter: LAKE_C_PIANO,
      keys: LAKE_C_HARM,
      arp: ARP16,
      bass: OCTAVES,
      drums: LAKE_BEAT_C2,
      perc: LAKE_PERC,
      fill: LAKE_FILL,
      crash: false,
      tr: 2,
      inst: { lead: brass, counter: grand, keys: secondBrass },
    },
    turn: {
      chords: "G | E7",
      lead: "d5 g5 _ a5 b5 _ a5 b5 | d6 _ _ c6 b5 _ g#5 _",
      counter: "d5 g5 _ a5 b5 _ a5 b5 | d6 _ _ c6 b5 _ g#5 _",
      arp: ARP16,
      bass: OCTAVES,
      drums: "k . h k s . h . k . k h s . h o | s . s s t t t t m m m m l l s! s!",
      crash: false,
      inst: { lead: brass, counter: grand },
    },
    // Daiyousei holds the stage: the hook in D minor, dark, over toms. Outside the form; it repeats until she is gone.
    M: {
      chords: "Dm | Bb | C | A7 | Dm | Bb | Gm7 | A7",
      lead: LAKE_M,
      counter: "f4 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | g4 _ _ _ _ _ _ _ | a4 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | bb4 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | c#5 _ _ _ _ _ _ _",
      arp: "0 1 2 1 0 1 2 1 0 1 2 1 0 1 2 1",
      bass: "0 0 0 0 0 0 0 0",
      drums: "k . m . s . m k . k m . s . l l",
      perc: ". h h . . h h . . h h . . h h .",
      fill: "k . m . s . m k s s m m l l l! l!",
      vamp: true,
      inst: { lead: darkBrass, counter: darkSection, arp: pluck },
    },
  },
  form: ["intro", "A", "B", "C", "D", "A2", "B2", "C2", "turn"],
  loop: 1,
  parts: { midboss: { to: "M", q: "bar", then: "B2" } },
};

// ---------- Cirno: "The Strongest Frozen Tomboy" (B minor; the chorus in D major, the last one in E) ----------
//
// Her riff is the lake's hook frozen: the same climb from the fifth to the minor third, a step
// higher, chipped into staccato against a repeated F# (ice on a pedal), with the lake's fall from
// the seventh between. The dialogue waits on it in the bells; her first spell card drops the band
// in on it. The verse runs up in sequences on the piano with the trumpet holding thirds under it,
// the pre-chorus climbs to A7 and stops dead, and the chorus in D major sits on ninths (the ice)
// with a Just-the-Two-of-Us turn in its third phrase. The bridge remembers the lake's hook, slow,
// in B minor, then the riff climbs back into the last chorus, a step up in E, where a second
// trumpet takes the harmony under the tune and the bells ring it an octave up.
//
// In the fight the dialogue vamps on the intro; her first card lands the riff on the next beat,
// and from there the song plays on through its form while her later cards turn the band up round
// it (the parts' mixes below).

const CIRNO_RIFF = `f#5' b5' f#5' c#6' f#5' d6 _ e6 | f#6 _ _ e6 d6 _ b5 _ | e5' a5' e5' b5' e5' c#6 _ d6 | e6 _ _ d6 c#6 _ a#5 _ |
  f#5' b5' f#5' c#6' f#5' d6' f#5' e6' | f#6 _ _ _ [e6 f#6] [e6 d6] [c#6 d6] [b5 c#6] | d6' _ b5' _ g5' _ e5' _ | a#5 _ c#6 _ e6 _ f#6! _`;
const CIRNO_CH_RIFF = "Bm | Gmaj7 | A | F#7 | Bm | Gmaj7 | Em7 | F#7";
/** The riff in the bells, waiting: its first bars and their echoes. */
const CIRNO_WAIT = `f#5' b5' f#5' c#6' f#5' d6 _ _ | . | f#5' b5' f#5' c#6' f#5' d6 _ e6 | f#6 _ _ _ _ _ . . |
  e5' a5' e5' b5' e5' c#6 _ _ | . | e5' b5' e5' c#6' e5' d6 _ c#6 | e6 _ _ _ c#6 _ a#5 _`;

const CIRNO_CH_A = "Bm | A | G | F#7 | Bm | A | G | F#7 | Em7 | F#m7 | Gmaj7 | A | Bm | Bm/A | Gmaj7 | F#7sus4 F#7";
const CIRNO_A = `b5 _ a5 b5 d6 _ c#6 b5 | c#6 _ b5 c#6 e6 _ d6 c#6 | d6 _ c#6 d6 f#6 _ e6 d6 | c#6 _ _ a#5 f#5 _ _ _ |
  b5 _ a5 b5 d6 _ c#6 b5 | c#6 _ b5 c#6 e6 _ d6 c#6 | d6 e6 f#6 g6 f#6 _ e6 d6 | c#6 d6 e6 f#6 _ _ . . |
  g6 _ _ f#6 e6 _ b5 _ | a5 _ _ b5 c#6 _ e6 _ | f#6 _ _ e6 d6 _ b5 _ | c#6 _ _ d6 e6 _ a6 _ |
  f#6 _ _ e6 d6 _ c#6 d6 | e6 _ _ d6 c#6 _ a5 _ | b5 _ d6 _ g6 _ f#6 _ | e6 _ _ _ c#6 _ a#5 _`;
/** The trumpet holds the chord's fifth, then its third, under the piano's runs. */
const CIRNO_A_HORN = `f#5 _ _ _ _ _ _ _ | e5 _ _ _ _ _ _ _ | d5 _ _ _ _ _ _ _ | c#5 _ _ _ e5 _ _ _ |
  f#5 _ _ _ _ _ _ _ | e5 _ _ _ _ _ _ _ | d5 _ _ _ g5 _ _ _ | a#5 _ _ _ _ _ _ _ |
  g5 _ _ _ _ _ _ _ | a5 _ _ _ _ _ _ _ | b5 _ _ _ _ _ _ _ | c#6 _ _ _ _ _ _ _ |
  d6 _ _ _ _ _ _ _ | c#6 _ _ _ _ _ _ _ | b5 _ _ _ _ _ _ _ | a#5 _ _ _ _ _ _ _`;

const CIRNO_CH_B = "Em7 | F#m7 | Gmaj7 | A | Em7 | F#m7 | G A | A7";
/** Up in steps with a turn down inside each (the third, the ninth, the root), then a leap to the fifth; it stops dead on A7. */
const CIRNO_B = `g5 _ _ f#5 e5 _ b5 _ | a5 _ _ g#5 f#5 _ c#6 _ | b5 _ _ a5 g5 _ d6 _ | c#6 _ _ b5 a5 _ e6 _ |
  e6 _ _ d6 b5 _ g5 _ | f#5 _ _ a5 c#6 _ e6 _ | d6 _ _ _ c#6 _ _ _ | e6! . . . . . . .`;

const CIRNO_CH_C = "Gmaj7 | A | F#m7 | Bm7 | Gmaj7 | A | Dmaj7 | D7 | Gmaj7 | F#7 | Bm7 | Am7 D7 | Gmaj7 | A | F#7sus4 F#7 | Bm";
const CIRNO_C = `a5 _ _ _ b5 _ d6 _ | c#6 _ _ _ b5 _ a5 _ | c#6 _ _ _ e6 _ _ d6 | _ _ c#6 _ b5 _ _ _ |
  a5 _ _ _ b5 _ d6 _ | c#6 _ _ _ b5 _ e6 _ | _ _ _ _ d6 _ c#6 _ | c6 _ _ _ a5 _ f#5 _ |
  d6 d6 _ e6 _ d6 b5 _ | c#6 c#6 _ e6 _ c#6 a#5 _ | d6 d6 _ c#6 _ b5 a5 _ | c6 _ _ b5 a5 _ f#5 _ |
  a5 _ _ _ b5 _ d6 _ | c#6 _ _ _ b5 _ e6 _ | _ _ _ _ c#6 _ a#5 _ | b5 _ _ _ _ _ . .`;

/** The last chorus's second trumpet, under the lead: thirds, a held B against the ninths, a D7 walking down. */
const CIRNO_C_HARM = `f#5 _ _ _ g5 _ b5 _ | a5 _ _ _ g#5 _ e5 _ | a5 _ _ _ c#6 _ _ b5 | _ _ a5 _ f#5 _ _ _ |
  f#5 _ _ _ g5 _ b5 _ | a5 _ _ _ g#5 _ c#6 _ | _ _ _ _ f#5 _ a5 _ | a5 _ _ _ f#5 _ d5 _ |
  b5 b5 _ b5 _ b5 g5 _ | a#5 a#5 _ c#6 _ a#5 f#5 _ | b5 b5 _ a5 _ g5 f#5 _ | a5 _ _ g5 f#5 _ d5 _ |
  f#5 _ _ _ g5 _ b5 _ | a5 _ _ _ g#5 _ c#6 _ | _ _ _ _ a#5 _ f#5 _ | f#5 _ _ _ _ _ . .`;

const CIRNO_CH_D = "Bm | Gmaj7 | A | F#7 | Em7 | F#m7 | Gmaj7 | B7sus4 B7";
/** The lake's hook, slow and soft, then her riff climbing back on a pedal. */
const CIRNO_D = `${shift(LAKE_HOOK, 2)} |
  e5' g5' e5' a5' e5' b5' e5' d6' | f#5' a5' f#5' b5' f#5' c#6' f#5' e6' | g5' b5' g5' c#6' g5' d6' g5' f#6' | f#5' b5' f#5' c#6' d#6' e6' f#6' a6'`;

const CIRNO_BEAT = "k . h k s . h . k k h . s . h o";
const CIRNO_BEAT4 = `kc . h k s . h . k k h . s . h o | ${Array(3).fill(CIRNO_BEAT).join(" | ")}`;
const CIRNO_PERC = ". h? h h? x h? h h? . h? h h? x h? h t";
const CIRNO_FILL = "k . h k s . h . s s t t m m l! l!";
const CIRNO_BUILD = "kw . s . s . s s s s s s s! s! s! s!";

export const cirnoSong: Song = {
  bpm: 176,
  key: "B minor",
  voiceLead: true,
  inst: { lead: grand, counter: bell, keys: epiano, arp: glass, bass: pickBass, pad: section },
  mix: { lead: 0.2, counter: 0.1, keys: 0.045, arp: 0.06, bass: 0.19, pad: 0.045, drums: 0.24, perc: 0.2 },
  pan: { counter: -0.15, keys: 0.2 },
  layers: { perc: 0.45 },
  fadeIn: 0.8,
  sections: {
    // The dialogue: the riff in the bells over a bowed cymbal, until her first spell card.
    intro: {
      chords: "Bm | Bm | Gmaj7 | Gmaj7 | Em9 | Em9 | F#7sus4 | F#7",
      counter: CIRNO_WAIT,
      arp: ARP16,
      bass: "0 _ _ _ _ _ _ _",
      drums: "z . . . . . . . | . | . | . | . | . | . | w . . . . . . .",
      crash: false,
      vamp: true,
      dyn: [0.62, 0.72],
      inst: { pad: darkSection },
    },
    launch: {
      chords: CIRNO_CH_RIFF,
      lead: CIRNO_RIFF,
      counter: CIRNO_RIFF,
      keys: ". * . * . * . *",
      arp: ARP16,
      bass: OCTAVES,
      drums: CIRNO_BEAT4,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      crash: false,
    },
    A: {
      chords: CIRNO_CH_A,
      lead: CIRNO_A,
      counter: CIRNO_A_HORN,
      keys: ". * . * . * . *",
      arp: ARP16,
      bass: OCTAVES,
      drums: CIRNO_BEAT,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      inst: { counter: brass },
    },
    B: {
      chords: CIRNO_CH_B,
      lead: CIRNO_B,
      keys: `. * . * . * . * | . * . * . * . * | . * . * . * . * | . * . * . * . * | . * . * . * . * | . * . * . * . * | * . * . * . * . | * . . . . . . .`,
      arp: `${ARP16} | ${ARP16} | ${ARP16} | ${ARP16} | ${ARP16} | ${ARP16} | ${ARP16} | 0 . . . . . . . . . . . . . . .`,
      bass: `${OCTAVES} | ${OCTAVES} | ${OCTAVES} | ${OCTAVES} | ${OCTAVES} | ${OCTAVES} | ${OCTAVES} | 0 . . . . . . .`,
      drums: CIRNO_BEAT,
      perc: CIRNO_PERC,
      fill: "kc! . . . s . s . s s s s s! s! s! s!",
      inst: { lead: brass },
    },
    C: {
      chords: CIRNO_CH_C,
      lead: CIRNO_C,
      counter: CIRNO_C,
      keys: shift(CIRNO_C, 12),
      arp: ARP16,
      bass: OCTAVES,
      drums: CIRNO_BEAT4,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      crash: false,
      inst: { lead: brass, counter: grand, keys: bell },
    },
    D: {
      chords: CIRNO_CH_D,
      lead: CIRNO_D,
      counter: ". | . | . | . | b4 _ _ _ _ _ _ _ | c#5 _ _ _ _ _ _ _ | d5 _ _ _ _ _ _ _ | e5 _ _ _ d#5 _ _ _",
      arp: ARP16,
      bass: `0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _ | 0 _ _ _ _ _ _ _ | ${OCTAVES} | ${OCTAVES} | ${OCTAVES} | ${OCTAVES}`,
      drums: `k . . . r . . . s? . . . r . . . | k . . . r . . . s? . . . r . . . | k . . . r . . . s? . . . r . . . | k . . . r . . . s? . . . r . r . |
        k . h . s . h . k . h . s . h . | k . h . s . h . k . h . s . s . | k . s . s . s . s . s . s s s s | k . s . s . s . s . s . s s s s`,
      fill: CIRNO_BUILD,
      crash: false,
      dyn: [0.72, 1],
      inst: { lead: grandSoft, counter: quickSection },
    },
    C2: {
      chords: CIRNO_CH_C,
      lead: CIRNO_C,
      counter: CIRNO_C,
      keys: CIRNO_C_HARM,
      arp: shift(CIRNO_C, 12),
      bass: OCTAVES,
      drums: CIRNO_BEAT4,
      perc: CIRNO_PERC,
      fill: CIRNO_FILL,
      crash: false,
      tr: 2,
      inst: { lead: brass, counter: grand, keys: secondBrass, arp: bell },
    },
    turn: {
      chords: "A | F#7",
      lead: "e5' a5' e5' b5' e5' c#6 _ d6 | e6 _ _ d6 c#6 _ a#5 _",
      counter: "e5' a5' e5' b5' e5' c#6 _ d6 | e6 _ _ d6 c#6 _ a#5 _",
      arp: ARP16,
      bass: OCTAVES,
      drums: `${CIRNO_BEAT} | s . s s t t t t m m m m l l s! s!`,
      crash: false,
    },
  },
  form: ["intro", "launch", "A", "B", "C", "D", "C2", "turn"],
  loop: 1,
  // Her first spell card launches the song out of the dialogue; after that it never jumps: each card
  // brings more of the band in over whatever is playing (as Celeste's boss themes do), so a card
  // declared mid-phrase lifts the phrase instead of cutting it off. The first card is the band alone
  // (piano, bass and a lighter kit; the bells, stabs, arp and strings held far back, no shaker);
  // the second, everyone; the last, the strings and the bells up front and the kit harder.
  parts: {
    intro: { to: "intro" },
    spell0: { to: "launch", q: "beat", mix: { counter: 0.25, keys: 0.3, arp: 0.3, pad: 0.5, drums: 0.8, perc: 0 }, glide: 0.3 },
    spell1: { mix: {} },
    last: { mix: { lead: 1.1, counter: 1.6, keys: 1.3, arp: 1.4, pad: 3, drums: 1.15, perc: 1.4 } },
  },
};

// ---------- the lake's hush: after the boss's winds, until Cirno speaks ----------
//
// The winds have blown the lake's theme away; frost gathers on F#, the dominant of her B minor,
// so that her dialogue's first chord is the one it was waiting for. Muted strings hold F# with the
// fourth hanging over it (it falls to A#, the leading note, in the fourth bar), a soft F# in the
// bass, and ice forms high up in the bells. A bowed cymbal breathes in with each round and a
// mallet roll swells back into it.

export const lakeWaitSong: Song = {
  bpm: 176,
  key: "B minor",
  inst: { lead: bell, counter: bell, keys: epiano, arp: glass, bass: { ...softBass, gate: 1 }, pad: darkSection },
  mix: { counter: 0.11, bass: 0.06, pad: 0.12, drums: 0.24 },
  pan: { counter: 0.25 },
  fadeIn: 1.5,
  sections: {
    frost: {
      chords: "F#sus4 | F#sus4 | F#sus4 | F#",
      counter: ". . . . c#7? . . . | . . f#6? . . . b6? . | . . . . . . e7? . | . c#7? . . a#6? . . .",
      bass: "0 _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _ | _ _ _ _ _ _ _ _",
      drums: "z . . . . . . . | . | . | w . . . . . . .",
      crash: false,
      vamp: true,
      dyn: [0.55, 0.72],
    },
  },
  form: ["frost"],
  loop: 0,
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

// ---------- Misty Lake cleared: the lake's hook in D major on the trumpet (the key its last chorus reached), then silence ----------

export const lakeClearSong: Song = {
  bpm: 150,
  key: "D major",
  voiceLead: true,
  inst: { lead: brass, counter: grand, keys: epiano, arp: glass, bass: pickBass, pad: section },
  mix: { counter: 0.12, bass: 0.19, drums: 0.24 },
  sections: {
    fanfare: {
      chords: "D | Bm | G A | D",
      lead: "a4 d5 _ e5 f#5 _ e5 f#5 | a5 _ _ g5 f#5 _ d5 _ | g5 _ _ f#5 e5 _ [f#5 g5] [a5 b5] | d6! _ _ _ _ _ _ _",
      counter: "a5 d6 _ e6 f#6 _ e6 f#6 | a6 _ _ g6 f#6 _ d6 _ | g6 _ _ f#6 e6 _ [f#6 g6] [a6 b6] | d7 _ _ _ _ _ _ _",
      arp: `${ARP16} | ${ARP16} | ${ARP16} | 0 1 2 3 4 5 6 7 . . . . . . . .`,
      bass: "0 _ 0 0^ _ 0 0^ 0 | 0 _ 0 0^ _ 0 0^ 0 | 0 _ 0 _ 0 _ 0 _ | 0 _ _ _ _ _ _ _",
      drums: "kc . h . s . h k . . h . s . h . | k . h . s . h k . . h . s . h . | k . h . s . h . s s t t m m l l | kc! . . . . . . . . . . . . . . .",
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
  /** The run's moments the track answers, for the music room to play: a part (Song.parts; "" leaves one), or "winds". */
  moments?: readonly Moment[];
}

/** A moment of a run that moves the music: its name in the music room, and the part the game names then. */
export interface Moment {
  label: string;
  part: string;
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
    comment:
      "The stage 1 theme. The piano plays the hook alone in the first bar: up a fourth from the fifth and on up to the minor third, off the beat, then a fall from the seventh. The verse sinks over a lament bass, the trumpet climbs a whole scale a tenth above the bass, and the chorus breaks into C major on a deceptive cadence. The last chorus is a step up, with a second trumpet under the first. In a run it thickens with the swarm, Daiyousei gets the hook in D minor over toms, and the boss's winds blow it away: frost gathers on F# until Cirno speaks.",
    song: lakeSong,
    moments: [
      { label: "Daiyousei", part: "midboss" },
      { label: "She leaves", part: "" },
      { label: "The winds", part: "winds" },
    ],
  },
  {
    id: "cirno",
    title: "The Strongest Frozen Tomboy",
    where: "Cirno's theme",
    comment:
      "Her riff is the lake's hook frozen: the same climb a step higher, chipped into staccato over a repeated F#. The dialogue waits on it in the bells, her first spell card drops the band in, and each card after it brings more of it in over the same music. The chorus goes to D major, the last one a step up with a second trumpet under the tune. The bridge remembers the lake.",
    song: cirnoSong,
    moments: [
      { label: "Her dialogue", part: "intro" },
      { label: "First spell card", part: "spell0" },
      { label: "Second spell card", part: "spell1" },
      { label: "Last spell card", part: "last" },
    ],
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
  {
    id: "clear-lake",
    title: "The Mist Lifts",
    where: "Misty Lake cleared",
    comment: "The lake's hook once more, in D major on the trumpet, where its last chorus left off.",
    song: lakeClearSong,
  },
  { id: "over", title: "Pichuun", where: "Game over", comment: "It happens to everyone. Continue?", song: overSong },
] satisfies Omit<TrackInfo, "credit">[]).map((t) => ({ credit: ORIGINAL, ...t }));
