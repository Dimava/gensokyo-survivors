// Synthesized sound: no audio assets, every effect and the music are built
// from oscillators and a noise buffer with WebAudio. Volumes follow prefs.

import { watch } from "vue";
import { prefs } from "./prefs.ts";

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
  | "revive";

export type Track = "menu" | "stage" | "boss" | null;

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
  private track: Track = null;
  private seqTimer: number | null = null;
  private step = 0;
  private nextAt = 0;

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
    if (this.track) this.startSeq();
  }

  applyVolumes(): void {
    if (!this.ctx) return;
    this.master.gain.value = prefs.master;
    this.sfxBus.gain.value = prefs.sfx * 0.55;
    this.musicBus.gain.value = prefs.music * 0.32;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide?: number, delay = 0, bus?: GainNode): void {
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
    g.connect(bus ?? this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, freq: number, delay = 0, bus?: GainNode): void {
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
    g.connect(bus ?? this.sfxBus);
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
    }
  }

  // ---------- music: a tiny step sequencer ----------

  music(track: Track): void {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (this.seqTimer !== null) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
    if (track && this.ctx) this.startSeq();
  }

  private startSeq(): void {
    if (!this.ctx || this.seqTimer !== null) return;
    this.nextAt = this.ctx.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 25);
  }

  private schedule(): void {
    const ctx = this.ctx;
    const song = this.track ? SONGS[this.track] : null;
    if (!ctx || !song) return;
    const stepDur = 60 / song.bpm / 4;
    while (this.nextAt < ctx.currentTime + 0.12) {
      const delay = Math.max(0, this.nextAt - ctx.currentTime);
      const s = this.step % (song.lead.length);
      const lead = song.lead[s]!;
      if (lead >= 0) this.tone(noteHz(song.root + lead), stepDur * 1.8, song.leadWave, 0.09, undefined, delay, this.musicBus);
      const bass = song.bass[s % song.bass.length]!;
      if (bass >= 0) this.tone(noteHz(song.root - 24 + bass), stepDur * 1.5, "triangle", 0.16, undefined, delay, this.musicBus);
      if (song.hat && s % 2 === 0) this.noise(0.03, s % 4 === 0 ? 0.05 : 0.025, "highpass", 7000, delay, this.musicBus);
      if (song.kick && s % 4 === 0) this.tone(120, 0.12, "sine", 0.22, 45, delay, this.musicBus);
      this.step++;
      this.nextAt += stepDur;
    }
  }
}

function noteHz(semitone: number): number {
  return 440 * Math.pow(2, (semitone - 9) / 12);
}

interface Song {
  bpm: number;
  root: number;
  leadWave: OscillatorType;
  lead: number[];
  bass: number[];
  hat: boolean;
  kick: boolean;
}

const _ = -1;
// Pentatonic phrases in semitones above the root (-1 rests).
const SONGS: Record<Exclude<Track, null>, Song> = {
  menu: {
    bpm: 84,
    root: 12,
    leadWave: "sine",
    lead: [0, _, 7, _, 12, _, 9, _, 7, _, 4, _, 2, _, _, _, 0, _, 4, _, 7, _, 9, _, 7, _, _, _, _, _, _, _],
    bass: [0, _, _, _, _, _, _, _, 5, _, _, _, _, _, _, _, 7, _, _, _, _, _, _, _, 5, _, _, _, 0, _, _, _],
    hat: false,
    kick: false,
  },
  stage: {
    bpm: 138,
    root: 14,
    leadWave: "square",
    lead: [0, _, 3, 5, 7, _, 10, _, 7, 5, 3, _, 5, _, _, _, 0, _, 3, 5, 7, _, 12, _, 10, 7, 5, _, 7, _, _, _],
    bass: [0, _, 0, _, 0, _, 0, _, 8, _, 8, _, 10, _, 10, _],
    hat: true,
    kick: true,
  },
  boss: {
    bpm: 158,
    root: 16,
    leadWave: "sawtooth",
    lead: [0, 3, 7, 10, 12, 10, 7, 3, 5, 8, 12, 15, 12, _, 10, _, 0, 3, 7, 10, 12, 15, 17, 15, 12, 10, 7, 5, 3, _, 2, _],
    bass: [0, _, 0, 0, _, 0, 0, _, 8, _, 8, 8, _, 7, 7, _],
    hat: true,
    kick: true,
  },
};

export const audio = new Synth();

watch(
  () => [prefs.master, prefs.sfx, prefs.music],
  () => audio.applyVolumes(),
);
