// Builds the sampled instruments the music plays (src/view/instruments/):
// a grand piano, a trumpet and a cymbal kit cut from the University of Iowa
// Musical Instrument Samples (theremin.music.uiowa.edu, "freely available
// ... may be downloaded and used for any projects, without restrictions").
// The recordings are downloaded into refs/music (git-ignored) when missing,
// decoded with ffmpeg, cut into single notes (onsets by level, pitch by YIN,
// tuning corrected per note), trimmed, given crossfaded sustain loops where
// an instrument sustains, levelled, and packed one family per MP3 with a
// timing marker at the start (the loader finds it, so any encoder delay is
// measured instead of guessed). index.ts lists every note's place.
//
//   bun scripts/music-samples.ts          (needs ffmpeg on PATH)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const REFS = join(ROOT, "refs", "music");
const OUT = join(ROOT, "src", "view", "instruments");
const SR = 44100;
const MIS = "https://theremin.music.uiowa.edu/sound%20files/MIS/";

// ---------- decoding and analysis ----------

async function source(path: string): Promise<Float32Array> {
  const file = join(REFS, path.split("/").at(-1)!);
  if (!existsSync(file)) {
    mkdirSync(REFS, { recursive: true });
    console.log(`downloading ${path}`);
    const res = await fetch(MIS + path.split("/").map(encodeURIComponent).join("/"));
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    await Bun.write(file, await res.arrayBuffer());
  }
  const p = Bun.spawnSync(["ffmpeg", "-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"]);
  if (p.exitCode !== 0) throw new Error(`ffmpeg: ${p.stderr.toString()}`);
  const b = p.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}

/** RMS per hop (10 ms). */
function envelope(x: Float32Array, hop = 441): Float32Array {
  const n = Math.floor(x.length / hop);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) s += x[j]! * x[j]!;
    e[i] = Math.sqrt(s / hop);
  }
  return e;
}

/** Sounding regions: above `relDb` of the file's loudest moment, split by `gap` seconds of quiet. */
function segments(x: Float32Array, relDb = -35, gap = 0.12): [number, number][] {
  const hop = 441;
  const e = envelope(x, hop);
  let max = 0;
  for (const v of e) max = Math.max(max, v);
  const thr = max * 10 ** (relDb / 20);
  const out: [number, number][] = [];
  let i = 0;
  while (i < e.length) {
    if (e[i]! <= thr) {
      i++;
      continue;
    }
    let j = i;
    let quiet = 0;
    while (j < e.length && quiet < (gap * SR) / hop) {
      quiet = e[j]! > thr ? 0 : quiet + 1;
      j++;
    }
    out.push([i * hop, (j - quiet) * hop]);
    i = j;
  }
  return out;
}

/** YIN fundamental (Hz) of a window, 0 if none. */
function yin(x: Float32Array, fmin = 50, fmax = 2400): number {
  const W = Math.floor(x.length / 2);
  const tmax = Math.min(W - 1, Math.floor(SR / fmin));
  const tmin = Math.floor(SR / fmax);
  const d = new Float64Array(tmax + 1);
  for (let t = 1; t <= tmax; t++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const v = x[i]! - x[i + t]!;
      s += v * v;
    }
    d[t] = s;
  }
  const c = new Float64Array(tmax + 1);
  c[0] = 1;
  let run = 0;
  for (let t = 1; t <= tmax; t++) {
    run += d[t]!;
    c[t] = (d[t]! * t) / Math.max(run, 1e-12);
  }
  let best = -1;
  for (let t = tmin; t < tmax; t++) {
    if (c[t]! < 0.12 && c[t]! <= c[t + 1]!) {
      best = t;
      break;
    }
  }
  if (best < 0) {
    let m = Infinity;
    for (let t = tmin; t < tmax; t++) if (c[t]! < m) [m, best] = [c[t]!, t];
  }
  const a = c[best - 1] ?? c[best]!;
  const b = c[best]!;
  const cc = c[best + 1] ?? c[best]!;
  const den = a - 2 * b + cc;
  const p = den ? best + (0.5 * (a - cc)) / den : best;
  return SR / p;
}

const midiOf = (hz: number): number => 69 + 12 * Math.log2(hz / 440);

/** The strongest frequency within a semitone of `hz`, cent by cent (a Hann-windowed DFT at each). */
function peakHz(x: Float32Array, hz: number): number {
  const n = x.length;
  const win = x.map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1))));
  let best = hz;
  let bestP = -1;
  for (let c = -100; c <= 100; c++) {
    const f = hz * 2 ** (c / 1200);
    const w = (2 * Math.PI * f) / SR;
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      re += win[i]! * Math.cos(w * i);
      im -= win[i]! * Math.sin(w * i);
    }
    if (re * re + im * im > bestP) [bestP, best] = [re * re + im * im, f];
  }
  return best;
}
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const noteName = (m: number): string => `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;

/** The first sample where the signal reaches `frac` of its peak within the next `win` seconds, backed off to the attack's start. */
function onset(x: Float32Array, from: number, win = 0.3, frac = 0.02): number {
  let peak = 0;
  const end = Math.min(x.length, from + Math.floor(win * SR));
  for (let i = from; i < end; i++) peak = Math.max(peak, Math.abs(x[i]!));
  for (let i = from; i < end; i++) if (Math.abs(x[i]!) >= peak * frac) return Math.max(from, i - Math.floor(0.002 * SR));
  return from;
}

function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, b - a));
}

// ---------- cutting ----------

interface Cut {
  name: string;
  /** Sounding pitch (MIDI) and the cents it is off from it (unpitched: 0, 0). */
  midi: number;
  cents: number;
  data: Float32Array;
  /** Sustain loop (samples from the note's start), if any. */
  loop?: [number, number];
  /** Where a swell peaks (samples from the start). */
  peak?: number;
  /** Playback gain that levels it with its family. */
  gain: number;
}

interface CutOpts {
  /** Seconds kept from the onset, and the fade at their end. */
  len: number;
  fade?: number;
  /** Seconds skipped after the onset (a cymbal roll's quiet start). */
  skip?: number;
  /** Crossfaded sustain loop between these seconds after the onset. */
  loop?: [number, number];
  /** Level the note's first `measure` seconds to this RMS. */
  level?: number;
  measure?: number;
}

function cut(x: Float32Array, start: number, name: string, midi: number, cents: number, o: CutOpts): Cut {
  const a = onset(x, start) + Math.floor((o.skip ?? 0) * SR);
  let n = Math.min(Math.floor(o.len * SR), x.length - a);
  let data = x.slice(a, a + n);
  let loop: [number, number] | undefined;
  if (o.loop) {
    // A loop a whole number of periods long, its last stretch crossfaded into what precedes its start
    // (linearly: the two stretches are in phase, so an equal-power fade would swell by 3 dB).
    const period = SR / (440 * 2 ** ((midi + cents / 100 - 69) / 12));
    const la = Math.floor(o.loop[0] * SR);
    const periods = Math.max(1, Math.round(((o.loop[1] - o.loop[0]) * SR) / period));
    const lb = Math.min(la + Math.round(periods * period), n - 1);
    const X = Math.min(Math.floor(0.12 * SR), la);
    const orig = data.slice();
    for (let i = 0; i < X; i++) {
      const w = i / X;
      data[lb - X + i] = orig[lb - X + i]! * (1 - w) + orig[la - X + i]! * w;
    }
    // Past the loop's end the note goes on as it does from the loop's start, for 40 ms: a loop end
    // read a sample or two late (rounding, resampling, a decoder's delay) still joins seamlessly.
    n = lb + Math.floor(0.04 * SR);
    data = data.slice(0, n);
    for (let i = lb; i < n; i++) data[i] = orig[la + (i - lb)]!;
    loop = [la, lb];
  } else {
    const f = Math.floor((o.fade ?? 0.2) * SR);
    for (let i = 0; i < f; i++) data[n - 1 - i] = data[n - 1 - i]! * (i / f) ** 2;
  }
  // A 2 ms fade-in keeps the cut click-free.
  const fi = Math.floor(0.002 * SR);
  for (let i = 0; i < fi; i++) data[i] = data[i]! * (i / fi);
  // Stored at full scale; `gain` brings its first `measure` seconds to the RMS `level` asks for.
  let pk = 0;
  for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(data[i]!));
  for (let i = 0; i < n; i++) data[i] = (data[i]! * 0.85) / pk;
  const gain = (o.level ?? 0.1) / Math.max(rms(data, 0, Math.min(n, Math.floor((o.measure ?? 0.25) * SR))), 1e-9);
  let peakAt: number | undefined;
  if (o.skip !== undefined) {
    const e = envelope(data, 441);
    let m = 0;
    e.forEach((v, i) => {
      if (v > (e[m] ?? 0)) m = i;
    });
    peakAt = m * 441;
  }
  return { name, midi, cents, data, loop, peak: peakAt, gain };
}

/** Every note of a chromatic run file: [MIDI, cents, start sample]. */
function notesOf(x: Float32Array): [number, number, number][] {
  return segments(x)
    .filter(([a, b]) => b - a > 0.5 * SR)
    .map(([a]) => {
      const w = x.subarray(a + Math.floor(0.25 * SR), a + Math.floor(0.25 * SR) + 4096);
      const m = midiOf(yin(w));
      return [Math.round(m), Math.round((m - Math.round(m)) * 100), a];
    });
}

// ---------- the instruments ----------

async function piano(): Promise<Cut[]> {
  const out: Cut[] = [];
  const names = ["A2", "C3", "Eb3", "Gb3", "A3", "C4", "Eb4", "Gb4", "A4", "C5", "Eb5", "Gb5", "A5", "C6", "Eb6", "Gb6", "A6", "C7", "Eb7", "Gb7", "A7", "C8"];
  for (const n of names) {
    const x = await source(`Piano_Other/piano/Piano.ff.${n}.aiff`);
    // The strike: the first stretch within 20 dB of the loudest (the room's hiss sits 35 dB down).
    const [a] = segments(x, -20)[0]!;
    const midi = 12 * (Number(n.at(-1)) + 1) + ({ C: 0, Eb: 3, Gb: 6, A: 9 } as Record<string, number>)[n.slice(0, -1)]!;
    const hz = 440 * 2 ** ((midi - 69) / 12);
    // Tuning by the fundamental's peak, not YIN: the top octaves are stretched up to half a semitone sharp.
    const w = x.subarray(a + Math.floor(0.1 * SR), a + Math.floor(0.1 * SR) + 16384);
    const cents = Math.round(1200 * Math.log2(peakHz(w, hz) / hz));
    // Lower strings ring longer; the top of the piano is gone in a second and a half, its last octave in one.
    const len = midi < 57 ? 3.2 : midi < 69 ? 2.7 : midi < 81 ? 2.1 : midi < 97 ? 1.5 : 1.1;
    // Levelled by the strike's first 0.1 s: over longer, a high note's quick decay would earn it a louder attack.
    out.push(cut(x, a, `piano ${n}`, midi, cents, { len, fade: 0.5, level: 0.87, measure: 0.1 }));
  }
  return out;
}

async function trumpet(): Promise<Cut[]> {
  const out: Cut[] = [];
  const want = [60, 63, 66, 69, 72, 75, 78, 81, 84, 87];
  for (const f of ["C4B4", "C5B5", "C6Eb6"]) {
    const x = await source(`Brass/Bbtrumpet/Trumpet.novib.ff.${f}.aiff`);
    for (const [midi, cents, a] of notesOf(x)) {
      if (!want.includes(midi) || out.some((c) => c.midi === midi)) continue;
      // Past the attack the tone is steady: loop 0.55 to 1.25 s, keep 1.5 s.
      out.push(cut(x, a, `trumpet ${noteName(midi)}`, midi, cents, { len: 1.5, loop: [0.55, 1.25], level: 0.29, measure: 0.4 }));
    }
  }
  return out.sort((p, q) => p.midi - q.midi);
}

/** Cymbals and hats: [kit letter, file, options]. Unpitched (MIDI 0). */
async function kit(): Promise<Cut[]> {
  const C = "Percussion/cymbals/";
  const parts: [string, string, CutOpts][] = [
    ["crash", `${C}suspended cymbals/stick/18crash.stick.normal.ff.aif`, { len: 3.4, fade: 1.6, level: 0.16, measure: 0.4 }],
    ["crash2", `${C}suspended cymbals/stick/17crash.stick.normal.ff.aif`, { len: 3.0, fade: 1.4, level: 0.16, measure: 0.4 }],
    ["ride", `${C}suspended cymbals/stick/21ride.stick.normal.mf.aif`, { len: 1.6, fade: 1.0, level: 0.1, measure: 0.3 }],
    ["bell", `${C}suspended cymbals/stick/21ride.stick.bell.mf.aif`, { len: 1.6, fade: 1.0, level: 0.1, measure: 0.3 }],
    ["splash", `${C}suspended cymbals/stick/splash.stick.normal.ff.aif`, { len: 1.6, fade: 0.9, level: 0.14, measure: 0.3 }],
    ["china", `${C}suspended cymbals/stick/16chinese.stick.normal.ff.aif`, { len: 2.0, fade: 1.2, level: 0.16, measure: 0.3 }],
    ["choke", `${C}suspended cymbals/choke/17crash.chokecrash.aif`, { len: 1.3, fade: 0.2, level: 0.16, measure: 0.3 }],
    ["hat", `${C}hihat/hihat.normal.mf.aif`, { len: 0.22, fade: 0.16, level: 0.12, measure: 0.05 }],
    ["hatff", `${C}hihat/hihat.normal.ff.aif`, { len: 0.26, fade: 0.18, level: 0.12, measure: 0.05 }],
    ["pedal", `${C}hihat/hihat.footclose.mf.aif`, { len: 0.18, fade: 0.1, level: 0.1, measure: 0.05 }],
    ["open", `${C}hihat/hihat.normal.ff.aif`, { len: 0.75, fade: 0.45, level: 0.1, measure: 0.1 }],
    // A mallet roll that swells for three seconds, and a bowed cymbal: mist and wind.
    ["swell", `${C}suspended cymbals/rolls/17crash.mallet.roll.aif`, { len: 5.2, fade: 1.8, skip: 0.15, level: 0.05, measure: 3 }],
    ["bow", `${C}suspended cymbals/bowed/13crash.bow.aif`, { len: 5.5, fade: 2.5, skip: 0, level: 0.05, measure: 3 }],
  ];
  const out: Cut[] = [];
  for (const [name, path, o] of parts) {
    const x = await source(path);
    const [a] = segments(x, -20)[0]!;
    out.push(cut(x, a, name, 0, 0, o));
  }
  return out;
}

// ---------- packing ----------

interface Placed {
  name: string;
  midi: number;
  cents: number;
  /** Seconds from the marker to the note, its length, loop and swell peak (seconds from the note's start). */
  at: number;
  len: number;
  loop?: [number, number];
  peak?: number;
  gain: number;
}

/** The marker: a 5 kHz burst whose envelope peaks exactly MARK seconds into the file. */
const MARK = 0.05;

function pack(family: string, cuts: Cut[]): Placed[] {
  const pre = Math.floor(0.08 * SR);
  const gapS = Math.floor(0.06 * SR);
  let total = Math.floor(MARK * SR) + pre;
  for (const c of cuts) total += c.data.length + gapS;
  const buf = new Float32Array(total + SR / 10);
  const m0 = Math.floor(MARK * SR);
  const bw = Math.floor(0.004 * SR);
  for (let i = -bw; i <= bw; i++) {
    const w = 0.5 + 0.5 * Math.cos((Math.PI * i) / bw);
    buf[m0 + i] = 0.5 * w * Math.sin((2 * Math.PI * 5000 * i) / SR);
  }
  let at = m0 + pre;
  const placed: Placed[] = [];
  for (const c of cuts) {
    buf.set(c.data, at);
    placed.push({
      name: c.name,
      midi: c.midi,
      cents: c.cents,
      at: +((at - m0) / SR).toFixed(6),
      len: +(c.data.length / SR).toFixed(4),
      loop: c.loop && [+(c.loop[0] / SR).toFixed(6), +(c.loop[1] / SR).toFixed(6)],
      peak: c.peak === undefined ? undefined : +(c.peak / SR).toFixed(3),
      gain: +c.gain.toFixed(3),
    });
    at += c.data.length + gapS;
  }
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.98) throw new Error(`${family}: peak ${peak.toFixed(2)}, lower the levels`);
  const wav = join(OUT, `${family}.tmp.wav`);
  writeFileSync(wav, wavBytes(buf));
  const mp3 = join(OUT, `${family}.mp3`);
  const p = Bun.spawnSync(["ffmpeg", "-y", "-v", "error", "-i", wav, "-c:a", "libmp3lame", "-q:a", "4", "-ac", "1", mp3]);
  if (p.exitCode !== 0) throw new Error(`ffmpeg: ${p.stderr.toString()}`);
  Bun.spawnSync(["rm", "-f", wav]);
  console.log(`${family}: ${cuts.length} notes, ${(buf.length / SR).toFixed(1)} s, peak ${(20 * Math.log10(peak)).toFixed(1)} dB, ${(Bun.file(mp3).size / 1024).toFixed(0)} KB`);
  for (const c of placed) console.log(`   ${c.name.padEnd(14)} ${c.midi ? noteName(c.midi).padEnd(4) : "    "} ${String(c.cents).padStart(4)}c  ${c.len.toFixed(2)} s${c.loop ? `  loop ${c.loop[0]}-${c.loop[1]}` : ""}${c.peak !== undefined ? `  peak ${c.peak}` : ""}  gain ${c.gain}`);
  return placed;
}

function wavBytes(x: Float32Array): Uint8Array {
  const out = new DataView(new ArrayBuffer(44 + x.length * 2));
  const w = (o: number, s: string): void => [...s].forEach((ch, i) => out.setUint8(o + i, ch.charCodeAt(0)));
  w(0, "RIFF");
  out.setUint32(4, 36 + x.length * 2, true);
  w(8, "WAVEfmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, SR, true);
  out.setUint32(28, SR * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  w(36, "data");
  out.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i]!)) * 32767, true);
  return new Uint8Array(out.buffer);
}

/** A placed note as TypeScript object fields: `name: "piano A4", midi: 69, ...`. */
const fields = (n: Placed): string =>
  Object.entries(n)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v).replace(/,/g, ", ")}`)
    .join(", ");

mkdirSync(OUT, { recursive: true });
const families: Record<string, Placed[]> = {
  piano: pack("piano", await piano()),
  trumpet: pack("trumpet", await trumpet()),
  kit: pack("kit", await kit()),
};
const lines = [
  "// Generated by scripts/music-samples.ts: where each sampled note sits in its family's MP3.",
  "// Sources: University of Iowa Musical Instrument Samples (theremin.music.uiowa.edu), free for any use.",
  "// at, len: seconds from the file's timing marker (MARK seconds in); loop, peak: seconds from the note's start.",
  "",
  "export interface SampleNote {",
  "  name: string;",
  "  midi: number;",
  "  cents: number;",
  "  at: number;",
  "  len: number;",
  "  loop?: readonly [number, number];",
  "  peak?: number;",
  "  /** Playback gain that levels the note with the rest of its family. */",
  "  gain: number;",
  "}",
  "",
  `export const MARK = ${MARK};`,
  "",
  "export const FAMILIES = {",
  ...Object.entries(families).map(
    ([f, notes]) =>
      `  ${f}: { url: new URL("./${f}.mp3", import.meta.url).href, notes: [\n${notes.map((n) => `    { ${fields(n)} },`).join("\n")}\n  ] as SampleNote[] },`,
  ),
  "} as const;",
  "",
  "export type Family = keyof typeof FAMILIES;",
  "",
];
writeFileSync(join(OUT, "index.ts"), lines.join("\n"));
