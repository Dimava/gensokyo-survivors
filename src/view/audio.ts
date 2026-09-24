// Synthesized sound: no audio assets, every effect and the music are built
// from oscillators and a noise buffer with WebAudio. Volumes follow prefs.

import { watch } from "vue";
import { Music, type Song } from "./music.ts";
import { prefs } from "./prefs.ts";
import { cirnoSong, clearSong, forestSong, lakeSong, menuSong, rumiaSong } from "./songs.ts";

export type Sfx =
  | "ui"
  | "back"
  | "deny"
  | "shoot"
  | "hit"
  | "pop"
  | "pickup"
  | "coin"
  | "heart"
  | "levelup"
  | "hurt"
  | "graze"
  | "draw"
  | "card"
  | "boom"
  | "chime"
  | "heal"
  | "power"
  | "laser"
  | "timestop"
  | "whoosh"
  | "spell"
  | "spellBreak"
  | "bossDown"
  | "death"
  | "clear"
  | "buy"
  | "flip"
  | "revealN"
  | "revealR"
  | "revealSR"
  | "revealSSR"
  | "warning"
  | "text"
  | "aura"
  | "revive"
  | "pichuun";

/** What plays: the title theme, the stage theme, the boss theme (both per stage), the clear fanfare, or silence. */
export type Track = "menu" | "stage" | "boss" | "clear" | null;

/** Minimum milliseconds between two plays of the same sound (bulk events would otherwise stack). */
const THROTTLE: Partial<Record<Sfx, number>> = { shoot: 70, hit: 45, pop: 40, pickup: 35, graze: 50, coin: 60, aura: 150, text: 40 };

class Synth {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last = new Map<Sfx, number>();
  private streak = 0;
  private streakAt = 0;
  private songs: Music | null = null;
  /** The current track and stage ("stage:lake"), null when silent, and its song. */
  private track: string | null = null;
  private song: Song | null = null;

  /** Call from a user gesture: browsers start audio only after one. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    this.applyVolumes();
    this.songs = new Music(ctx, this.musicBus, this.noiseBuf);
    this.songs.play(this.song);
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = prefs.master;
    this.sfxBus.gain.value = prefs.sfx * 0.55;
    this.musicBus.gain.value = prefs.music * 0.32;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private arp(freqs: number[], step: number, dur: number, type: OscillatorType, vol: number): void {
    freqs.forEach((f, i) => this.tone(f, dur, type, vol, undefined, i * step));
  }

  play(name: Sfx, opts: { pitch?: number; vol?: number } = {}): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = performance.now();
    const gap = THROTTLE[name];
    if (gap !== undefined && now - (this.last.get(name) ?? -1e9) < gap) return;
    this.last.set(name, now);
    const p = opts.pitch ?? 1;
    const v = opts.vol ?? 1;
    switch (name) {
      case "ui":
        return this.tone(880 * p, 0.05, "square", 0.08 * v);
      case "back":
        return this.tone(520 * p, 0.06, "square", 0.07 * v);
      case "deny":
        this.tone(160, 0.07, "square", 0.12 * v);
        return this.tone(130, 0.09, "square", 0.12 * v, undefined, 0.08);
      case "shoot":
        return this.tone(1500 * p, 0.035, "triangle", 0.035 * v, 900 * p);
      case "hit":
        return this.noise(0.035, 0.09 * v, "highpass", 2800);
      case "pop":
        this.tone(700 * p, 0.08, "sine", 0.1 * v, 180);
        return this.noise(0.05, 0.05 * v, "bandpass", 1500);
      case "pickup": {
        if (now - this.streakAt > 600) this.streak = 0;
        this.streakAt = now;
        this.streak = Math.min(this.streak + 1, 24);
        return this.tone(880 * Math.pow(2, this.streak / 24), 0.05, "sine", 0.07 * v);
      }
      case "coin":
        this.tone(1318, 0.06, "square", 0.05 * v);
        return this.tone(1760, 0.12, "square", 0.05 * v, undefined, 0.06);
      case "heart":
        return this.arp([523, 659, 784], 0.05, 0.12, "sine", 0.1 * v);
      case "levelup":
        return this.arp([523, 659, 784, 1047, 1319], 0.06, 0.22, "triangle", 0.14 * v);
      case "hurt":
        this.tone(260, 0.28, "sawtooth", 0.14 * v, 70);
        return this.noise(0.2, 0.12 * v, "lowpass", 900);
      case "graze":
        return this.noise(0.025, 0.05 * v, "highpass", 6500);
      case "draw":
        return this.tone(500, 0.14, "sine", 0.1 * v, 1300);
      case "card":
        this.arp([784, 988, 1175, 1568], 0.03, 0.2, "triangle", 0.09 * v);
        return this.noise(0.25, 0.04 * v, "highpass", 5000);
      case "boom":
        this.tone(140, 0.45, "sine", 0.3 * v, 38);
        return this.noise(0.4, 0.2 * v, "lowpass", 700);
      case "chime":
        return this.arp([1047, 1319, 1568, 2093], 0.04, 0.4, "sine", 0.08 * v);
      case "heal":
        return this.arp([392, 523, 659, 784, 1047], 0.05, 0.25, "sine", 0.09 * v);
      case "power":
        this.tone(200, 0.5, "sawtooth", 0.08 * v, 900);
        return this.arp([523, 784, 1047], 0.08, 0.3, "square", 0.05 * v);
      case "laser":
        this.tone(180, 0.8, "sawtooth", 0.12 * v, 60);
        this.tone(360, 0.8, "square", 0.05 * v, 120);
        return this.noise(0.8, 0.15 * v, "bandpass", 1200);
      case "timestop":
        this.tone(1760, 0.08, "square", 0.06 * v);
        this.tone(1760, 0.08, "square", 0.06 * v, undefined, 0.25);
        return this.tone(900, 0.6, "sine", 0.1 * v, 220, 0.05);
      case "whoosh":
        return this.noise(0.4, 0.14 * v, "bandpass", 900);
      case "spell":
        this.tone(220, 1.2, "sine", 0.16 * v);
        this.tone(330, 1.2, "sine", 0.1 * v);
        return this.noise(0.6, 0.06 * v, "highpass", 3000);
      case "spellBreak":
        this.arp([659, 784, 988, 1319, 1568], 0.05, 0.35, "triangle", 0.12 * v);
        return this.noise(0.3, 0.08 * v, "highpass", 4000);
      case "bossDown":
        this.tone(110, 1.2, "sine", 0.3 * v, 30);
        this.noise(1.0, 0.25 * v, "lowpass", 900);
        return this.arp([523, 659, 784, 1047], 0.12, 0.6, "triangle", 0.12 * v);
      case "death":
        return this.arp([523, 415, 330, 262, 196], 0.12, 0.35, "triangle", 0.14 * v);
      case "clear":
        return this.arp([523, 659, 784, 1047, 784, 1047, 1319], 0.1, 0.4, "square", 0.08 * v);
      case "buy":
        this.tone(1318, 0.06, "square", 0.06 * v);
        return this.arp([1568, 2093], 0.06, 0.25, "sine", 0.08 * v);
      case "flip":
        return this.noise(0.06, 0.1 * v, "bandpass", 2500);
      case "revealN":
        return this.tone(660, 0.12, "triangle", 0.1 * v);
      case "revealR":
        return this.arp([660, 880], 0.06, 0.25, "triangle", 0.11 * v);
      case "revealSR":
        return this.arp([660, 880, 1109, 1319], 0.06, 0.4, "triangle", 0.12 * v);
      case "revealSSR":
        this.arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.07, 0.6, "square", 0.08 * v);
        return this.noise(0.8, 0.06 * v, "highpass", 5000);
      case "warning":
        for (let i = 0; i < 3; i++) {
          this.tone(880, 0.18, "square", 0.08 * v, undefined, i * 0.4);
          this.tone(660, 0.18, "square", 0.08 * v, undefined, i * 0.4 + 0.2);
        }
        return;
      case "text":
        return this.tone(700 + Math.random() * 60, 0.025, "square", 0.025 * v);
      case "aura":
        return this.tone(160, 0.25, "sine", 0.08 * v, 90);
      case "revive":
        return this.arp([392, 523, 659, 784, 1047, 1319], 0.08, 0.4, "sine", 0.12 * v);
      case "pichuun":
        // The shot-down "pichuun": a bright chirp falling fast over a burst of noise.
        this.tone(2400, 0.3, "square", 0.06 * v, 300);
        this.tone(1200, 0.45, "sine", 0.14 * v, 140);
        return this.noise(0.4, 0.16 * v, "bandpass", 2200);
    }
  }

  // ---------- music (music.ts plays, songs.ts holds the notes) ----------

  /** Picks the song for a track; stage and boss tracks have one per stage (the lake's by default). */
  music(track: Track, stage = "lake"): void {
    const key = track && `${track}:${stage}`;
    if (key === this.track) return;
    this.track = key;
    this.song = songFor(track, stage);
    this.songs?.play(this.song);
  }
}

const SONGS: Record<string, Song> = {
  menu: menuSong,
  clear: clearSong,
  "stage:lake": lakeSong,
  "boss:lake": cirnoSong,
  "stage:forest": forestSong,
  "boss:forest": rumiaSong,
};

function songFor(track: Track, stage: string): Song | null {
  if (!track) return null;
  return SONGS[`${track}:${stage}`] ?? SONGS[track] ?? SONGS[`${track}:lake`] ?? null;
}

export const audio = new Synth();

watch(
  () => [prefs.master, prefs.sfx, prefs.music],
  () => audio.applyVolumes(),
);
