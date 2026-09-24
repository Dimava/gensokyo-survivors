// The music notation (src/view/music.ts): every song compiles, parts fill
// their sections, chords transpose, the pad's voicings step, and the notation
// features (slash bass, "~" hold, "N" no chord, stabs, dynamics) do what the
// header says. No audio runs here: compiling is pure.

import { describe, expect, test } from "bun:test";
import { compileSong, songLength, transposeName, voiceChord, type Inst, type Song } from "../src/view/music.ts";
import { TRACKS } from "../src/view/songs.ts";

const sine: Inst = { osc: [["sine", 0, 0, 1]], a: 0.01, d: 0.1, s: 0.5, r: 0.1 };
const inst = { lead: sine, counter: sine, keys: sine, arp: sine, bass: sine, pad: sine };

function song(sections: Song["sections"], extra: Partial<Song> = {}): Song {
  return { bpm: 120, inst, sections, form: Object.keys(sections), loop: 0, ...extra };
}

describe("music", () => {
  test("every track compiles, with every part filling whole bars", () => {
    for (const t of TRACKS) {
      const c = compileSong(t.song);
      expect(c.events.length).toBeGreaterThan(0);
      for (const [name, sec] of Object.entries(t.song.sections)) {
        const bars = sec.chords.split("|").length;
        for (const v of ["lead", "counter", "keys", "arp", "bass", "drums", "perc"] as const) {
          const part = sec[v];
          if (part) expect({ track: t.id, name, v, ok: bars % part.split("|").length === 0 }).toEqual({ track: t.id, name, v, ok: true });
        }
      }
      // Melodies stay in a sane range.
      for (const e of c.events) {
        if (e.drum) continue;
        expect(e.midi).toBeGreaterThanOrEqual(24);
        expect(e.midi).toBeLessThanOrEqual(100);
      }
      const len = songLength(t.song);
      expect(len.total).toBeGreaterThan(2);
    }
  });

  test("chord names transpose, slash bass included", () => {
    expect(transposeName("Dm7/C", 2)).toBe("Em7/D");
    expect(transposeName("Bbmaj7", 1)).toBe("Bmaj7");
    expect(transposeName("E minor", 2)).toBe("F# minor");
  });

  test("voicings lead by step: C to F keeps the common tone, moves the rest a step or two", () => {
    const c = voiceChord(0, [0, 4, 7], null);
    const f = voiceChord(5, [0, 4, 7], c);
    const moves = f.map((n) => Math.min(...c.map((m) => Math.abs(n - m))));
    expect(Math.max(...moves)).toBeLessThanOrEqual(2);
    expect(f).toContain(c.find((n) => n % 12 === 0)!);
  });

  test("slash chords put their bass under digit 0; ~ holds, N rests the pad", () => {
    const c = compileSong(song({ A: { chords: "C C/B | Am ~ | N | G", bass: "0 0 | 0 0 | . . | 0 _" } }));
    const bass = c.events.filter((e) => e.voice === "bass").map((e) => e.midi % 12);
    expect(bass).toEqual([0, 11, 9, 9, 7]);
    expect(c.chords.map((x) => x.name)).toEqual(["C", "C/B", "Am", "G"]);
    // Am held through "~" is one pad chord two beats long; bar 3 has none.
    const pad = c.events.filter((e) => e.voice === "pad");
    expect(pad.filter((e) => e.t >= 1 && e.t < 2).every((e) => e.len === 1)).toBe(true);
    expect(pad.some((e) => e.t >= 2 && e.t < 3)).toBe(false);
  });

  test("stabs sound the chord; tr transposes notes and chord names; dyn shapes velocity", () => {
    const c = compileSong(
      song({
        A: { chords: "C | C", keys: "* . . . | * . . .", dyn: [0.5, 1], pad: false },
        B: { chords: "C", lead: "c5", tr: 2, pad: false },
      }, { key: "C major" }),
    );
    const keys = c.events.filter((e) => e.voice === "keys");
    expect(keys.length).toBe(6);
    const v0 = keys.filter((e) => e.t === 0)[0]!.vel;
    const v1 = keys.filter((e) => e.t === 1)[0]!.vel;
    expect(v1).toBeGreaterThan(v0 * 1.4);
    expect(c.events.find((e) => e.voice === "lead")!.midi).toBe(74);
    expect(c.sections.map((s) => s.key)).toEqual(["C major", "D major"]);
    expect(c.chords.at(-1)!.name).toBe("D");
  });
});
