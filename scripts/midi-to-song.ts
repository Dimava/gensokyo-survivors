// Turns a Standard MIDI File into the song notation of src/view/music.ts, for
// arranging: one part string per MIDI track and channel, quantized to a grid,
// melodies reduced to their top line. The game never loads MIDI; this prints
// text to paste into songs.ts and edit by hand.
//
//   bun scripts/midi-to-song.ts refs/music/some.mid [--grid 16] [--from 1] [--bars 16] [--tr 0]
//
// --grid: slots per bar (8 eighths, 16 sixteenths); --from/--bars: which bars
// (1-based); --tr: semitones to transpose. 4/4 is assumed for the bar lines.

import { readFileSync } from "node:fs";

interface Note {
  track: number;
  ch: number;
  midi: number;
  on: number;
  off: number;
  vel: number;
}

function parse(buf: Uint8Array): { ppq: number; tempo: number; notes: Note[]; names: Map<number, string> } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const str = (o: number, n: number): string => String.fromCharCode(...buf.subarray(o, o + n));
  if (str(0, 4) !== "MThd") throw new Error("not a MIDI file");
  const ntracks = dv.getUint16(10);
  const ppq = dv.getUint16(12);
  if (ppq & 0x8000) throw new Error("SMPTE time division is not supported");
  let tempo = 500000;
  const notes: Note[] = [];
  const names = new Map<number, string>();
  let pos = 8 + dv.getUint32(4);
  for (let t = 0; t < ntracks && pos < buf.length; t++) {
    if (str(pos, 4) !== "MTrk") throw new Error(`bad track ${t}`);
    const end = pos + 8 + dv.getUint32(pos + 4);
    let p = pos + 8;
    let tick = 0;
    let status = 0;
    const open = new Map<number, Note>();
    const vlq = (): number => {
      let v = 0;
      for (;;) {
        const b = buf[p++]!;
        v = (v << 7) | (b & 0x7f);
        if (!(b & 0x80)) return v;
      }
    };
    while (p < end) {
      tick += vlq();
      // Running status: a data byte first reuses the last status.
      if (buf[p]! & 0x80) status = buf[p++]!;
      const type = status & 0xf0;
      const ch = status & 0x0f;
      if (status === 0xff) {
        const meta = buf[p++]!;
        const len = vlq();
        if (meta === 0x51 && !notes.length) tempo = (buf[p]! << 16) | (buf[p + 1]! << 8) | buf[p + 2]!;
        if (meta === 0x03) names.set(t, str(p, len));
        p += len;
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else if (type === 0x90 || type === 0x80) {
        const midi = buf[p++]!;
        const vel = buf[p++]!;
        const key = ch * 128 + midi;
        const prev = open.get(key);
        if (prev) {
          prev.off = tick;
          open.delete(key);
        }
        if (type === 0x90 && vel > 0) {
          const n = { track: t, ch, midi, on: tick, off: tick, vel };
          notes.push(n);
          open.set(key, n);
        }
      } else p += type === 0xc0 || type === 0xd0 ? 1 : 2;
    }
    pos = end;
  }
  return { ppq, tempo, notes, names };
}

const NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
const name = (m: number): string => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

const args = process.argv.slice(2);
const opt = (k: string, d: number): number => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const file = args.find((a) => !a.startsWith("--") && !/^-?\d+$/.test(a));
if (!file) throw new Error("usage: bun scripts/midi-to-song.ts file.mid [--grid 16] [--from 1] [--bars 16] [--tr 0]");
const grid = opt("grid", 16);
const from = opt("from", 1) - 1;
const bars = opt("bars", 16);
const tr = opt("tr", 0);
const { ppq, tempo, notes, names } = parse(new Uint8Array(readFileSync(file)));
const slot = (ppq * 4) / grid;
console.log(`// ${file}: ${Math.round(60000000 / tempo)} BPM, ${notes.length} notes`);
const parts = new Map<string, Note[]>();
for (const n of notes) {
  const k = `${n.track}:${n.ch}`;
  if (!parts.has(k)) parts.set(k, []);
  parts.get(k)!.push(n);
}
for (const [k, list] of parts) {
  const [t, ch] = k.split(":").map(Number) as [number, number];
  // Per slot, the highest note starting there (the top line of chords).
  const starts = new Map<number, Note>();
  for (const n of list) {
    const s = Math.round(n.on / slot);
    if ((starts.get(s)?.midi ?? -1) < n.midi) starts.set(s, n);
  }
  const out: string[] = [];
  for (let b = from; b < from + bars; b++) {
    const toks: string[] = [];
    let held = 0;
    for (let i = 0; i < grid; i++) {
      const s = b * grid + i;
      const n = starts.get(s);
      if (n) {
        toks.push(name(n.midi + tr) + (n.vel > 100 ? "!" : n.vel < 50 ? "?" : ""));
        held = Math.max(1, Math.round((n.off - n.on) / slot)) - 1;
      } else if (held > 0) {
        toks.push("_");
        held--;
      } else toks.push(".");
    }
    out.push(toks.join(" "));
  }
  if (out.every((b) => /^[._ ]*$/.test(b))) continue;
  console.log(`\n// track ${t} ${names.get(t) ?? ""} channel ${ch + 1}${ch === 9 ? " (drums: map GM notes by hand)" : ""}`);
  console.log(`\`${out.join(" |\n  ")}\``);
}
