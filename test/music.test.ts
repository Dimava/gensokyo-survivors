// The music notation (src/view/music.ts): every song compiles, parts fill
// their sections, chords transpose, the pad's voicings step, and the notation
// features (slash bass, "~" hold, "N" no chord, stabs, dynamics, articulations,
// swells, parts and vamps) do what the header says; the sampled instruments'
// index is sound and the loader finds their timing marker. No audio runs
// here: compiling is pure.

import { describe, expect, test } from "bun:test";
import { FAMILIES } from "../src/view/instruments/index.ts";
import { compileSong, findMark, moveBar, partMix, partSection, songLength, transposeName, voiceChord, type Inst, type Melodic, type Song } from "../src/view/music.ts";
import { cirnoSong, lakeWaitSong, TRACKS } from "../src/view/songs.ts";
import { LEGACY_TRACKS } from "../src/view/songs-legacy.ts";

const sine: Inst = { osc: [["sine", 0, 0, 1]], a: 0.01, d: 0.1, s: 0.5, r: 0.1 };
const inst = { lead: sine, counter: sine, keys: sine, arp: sine, bass: sine, pad: sine };

function song(sections: Song["sections"], extra: Partial<Song> = {}): Song {
  return { bpm: 120, inst, sections, form: Object.keys(sections), loop: 0, ...extra };
}

describe("music", () => {
  test("every track (every earlier version, and the hush before a boss) compiles, with every part filling whole bars", () => {
    for (const t of [...TRACKS, ...LEGACY_TRACKS, { id: "hush:lake", song: lakeWaitSong }]) {
      const c = compileSong(t.song);
      expect(c.events.length).toBeGreaterThan(0);
      for (const [name, sec] of Object.entries(t.song.sections)) {
        const bars = sec.chords.split("|").length;
        for (const v of ["lead", "counter", "keys", "arp", "bass", "drums", "perc"] as const) {
          const part = sec[v];
          if (part) expect({ track: t.id, name, v, ok: bars % part.split("|").length === 0 }).toEqual({ track: t.id, name, v, ok: true });
        }
      }
      // Melodies stay in a sane range, and a recorded voice within four semitones of its recordings (stretched further, it thins).
      for (const e of c.events) {
        if (e.drum) continue;
        const sample = (e.inst ?? t.song.inst[e.voice as Melodic]).sample;
        const midis = sample ? FAMILIES[sample].notes.map((n) => n.midi) : [27, 105];
        const range = [Math.min(...midis) - 4, Math.max(...midis) + 4];
        expect({ track: t.id, voice: e.voice, midi: e.midi, ok: e.midi >= range[0]! && e.midi <= range[1]! }).toEqual({ track: t.id, voice: e.voice, midi: e.midi, ok: true });
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

  test("' plays a note short, ~ lets it fall; a swell rises to the next barline", () => {
    const c = compileSong(song({ A: { chords: "C | C", lead: "c5' d5~ e5 _ | .", drums: ". w . . | [. w] . . .", pad: false } }));
    expect(c.events.filter((e) => e.voice === "lead").map((e) => e.art)).toEqual(["'", "~", undefined]);
    const swells = c.events.filter((e) => e.drum === "w");
    expect(swells.map((e) => e.t + e.len)).toEqual([1, 2]);
  });

  test("sections outside the form are kept after it; vamps and moves land on their quantum", () => {
    const c = compileSong(
      song(
        { intro: { chords: "C", vamp: true, pad: false }, A: { chords: "C | G", pad: false }, M: { chords: "Am | E", pad: false } },
        { form: ["intro", "A"], parts: { midboss: { to: "M", then: "A" } } },
      ),
    );
    expect(c.places.map((p) => [p.name, p.form, p.vamp])).toEqual([
      ["intro", 0, true],
      ["A", 1, false],
      ["M", -1, false],
    ]);
    // The form's length leaves the islands out.
    expect(c.bars).toBe(3);
    const a = { name: "A", from: 1, to: 3 };
    expect(moveBar("beat", 1.3, a)).toBe(1.5);
    expect(moveBar("half", 1.3, a)).toBe(1.5);
    expect(moveBar("bar", 1.3, a)).toBe(2);
    expect(moveBar(2, 1.3, a)).toBe(3);
    expect(moveBar("bar", 2.9, a)).toBe(3);
  });

  test("a part that only changes the mix starts where the part before it does, and keeps its mix until another names one", () => {
    const s = song(
      { intro: { chords: "C", vamp: true, pad: false }, A: { chords: "C | G", pad: false } },
      { parts: { intro: { to: "intro" }, one: { to: "A", mix: { perc: 0, keys: 0.5 } }, two: {}, three: { mix: { lead: 1.2 } } } },
    );
    expect([partSection(s, "intro"), partSection(s, "one"), partSection(s, "two"), partSection(s, "three"), partSection(s, "")]).toEqual(["intro", "A", "A", "A", undefined]);
    expect(partMix(s, "intro").perc).toBe(1);
    expect([partMix(s, "one").perc, partMix(s, "one").keys, partMix(s, "one").lead]).toEqual([0, 0.5, 1]);
    expect(partMix(s, "two").perc).toBe(0);
    expect([partMix(s, "three").perc, partMix(s, "three").lead]).toEqual([1, 1.2]);
    expect(partMix(s, "gone").perc).toBe(1);
  });

  test("Cirno's later spell cards never jump her theme: they only change its mix", () => {
    const parts = cirnoSong.parts!;
    expect(parts.spell0!.to).toBe("launch");
    for (const name of ["spell1", "last"]) expect({ name, to: parts[name]!.to, mix: !!parts[name]!.mix }).toEqual({ name, to: undefined, mix: true });
    // Every part's section exists.
    for (const def of Object.values(parts)) if (def.to) expect(cirnoSong.sections[def.to]).toBeDefined();
  });

  test("every sampled note lies inside its file, in order, its loop inside it", () => {
    for (const [family, f] of Object.entries(FAMILIES)) {
      let end = 0;
      for (const n of f.notes) {
        expect({ family, note: n.name, ok: n.at >= end && n.len > 0 && n.gain > 0 }).toEqual({ family, note: n.name, ok: true });
        if (n.loop) expect({ family, note: n.name, ok: n.loop[0] > 0 && n.loop[1] > n.loop[0] && n.loop[1] < n.len }).toEqual({ family, note: n.name, ok: true });
        end = n.at + n.len;
      }
      if (family !== "kit") for (let i = 1; i < f.notes.length; i++) expect(f.notes[i]!.midi).toBeGreaterThan(f.notes[i - 1]!.midi);
    }
  });

  test("the loader finds the timing marker by its shape, not by the loudest sample", () => {
    const sr = 44100;
    const d = new Float32Array(sr);
    // A codec's delay moved the marker 12.3 ms late; the first note is louder than it.
    const mark = 0.05 + 0.0123;
    const m0 = Math.round(mark * sr);
    const bw = Math.floor(0.004 * sr);
    for (let i = -bw; i <= bw; i++) d[m0 + i] = 0.5 * (0.5 + 0.5 * Math.cos((Math.PI * i) / bw)) * Math.sin((2 * Math.PI * 5000 * i) / sr);
    for (let i = 0; i < sr * 0.2; i++) d[Math.round(0.13 * sr) + i] = 0.85 * Math.exp(-i / sr / 0.1) * Math.sin((2 * Math.PI * 440 * i) / sr);
    const buf = { sampleRate: sr, length: d.length, getChannelData: () => d } as unknown as AudioBuffer;
    expect(Math.abs(findMark(buf) - m0 / sr)).toBeLessThan(0.0002);
    // No marker at all: the nominal place.
    const quiet = { sampleRate: sr, length: d.length, getChannelData: () => new Float32Array(sr) } as unknown as AudioBuffer;
    expect(findMark(quiet)).toBeCloseTo(0.05, 6);
  });
});
