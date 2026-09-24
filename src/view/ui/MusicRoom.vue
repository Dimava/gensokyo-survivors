<script setup lang="ts">
// The music room, Touhou style: the soundtrack as a list with play and stop,
// each track's composer comment, and a now-playing view: the section and key,
// the previous, current and next chords as cards, and a piano roll of the
// whole track (coloured per voice) with a playhead. Songs carry their own
// chords (music.ts compileSong), so nothing is analysed.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { audio } from "../audio.ts";
import { compileSong, songLength, type Voice } from "../music.ts";
import { TRACKS } from "../songs.ts";

const playing = ref<string | null>(audio.listening);
const selId = ref<string>(playing.value ?? TRACKS[0]!.id);
const sel = computed(() => TRACKS.find((t) => t.id === selId.value) ?? TRACKS[0]!);
const compiled = computed(() => compileSong(sel.value.song));
const bar = ref(-1);
const roll = ref<HTMLCanvasElement | null>(null);

const COLORS: Record<Voice, string> = {
  lead: "#ff6b6b",
  counter: "#6fd3ff",
  keys: "#c98bff",
  arp: "#ffd166",
  bass: "#7bd88f",
  pad: "rgba(255,255,255,0.13)",
  drums: "#9aa3b5",
  perc: "#6d7486",
};
const LEGEND: Voice[] = ["lead", "counter", "keys", "arp", "bass", "pad", "drums"];

function mmss(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function length(id: string): string {
  const t = TRACKS.find((x) => x.id === id)!;
  const l = songLength(t.song);
  return mmss(l.total);
}

function play(id: string): void {
  audio.unlock();
  audio.listen(id);
  playing.value = id;
  selId.value = id;
}

function stop(): void {
  audio.listen("");
  playing.value = null;
}

/** Clicking the roll plays the track from there. */
function seek(e: MouseEvent): void {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const b = ((e.clientX - r.left) / r.width) * compiled.value.bars;
  if (playing.value !== sel.value.id) play(sel.value.id);
  audio.seek(b);
}

/** The chord cards and section at the playhead (or the track's start when stopped). */
const now = computed(() => {
  const c = compiled.value;
  const b = Math.max(0, bar.value);
  const i = c.chords.findIndex((x) => b >= x.from && b < x.to);
  const at = i < 0 ? c.chords.findIndex((x) => x.from > b) - 1 : i;
  const sec = c.sections.find((s) => b >= s.from && b < s.to) ?? c.sections[0];
  const name = (k: number): string => (k >= 0 && k < c.chords.length ? c.chords[k]!.name : "");
  return { prev: name(at - 1), cur: i < 0 ? "N.C." : name(at), next: name(at + 1 < c.chords.length ? at + 1 : c.loopBar ? c.chords.findIndex((x) => x.from >= c.loopBar) : -1), section: sec?.name ?? "", key: sec?.key ?? "" };
});

const elapsed = computed(() => (bar.value < 0 ? "0:00" : mmss((bar.value * 240) / sel.value.song.bpm)));

// ---------- the piano roll ----------

let bg: HTMLCanvasElement | null = null;
const W = 880;
const H = 190;

function drawBackground(): void {
  const c = compiled.value;
  const dpr = window.devicePixelRatio || 1;
  bg = document.createElement("canvas");
  bg.width = W * dpr;
  bg.height = H * dpr;
  const g = bg.getContext("2d")!;
  g.scale(dpr, dpr);
  g.fillStyle = "rgba(10,12,24,0.85)";
  g.fillRect(0, 0, W, H);
  const notes = c.events.filter((e) => !e.drum);
  const lo = Math.min(...notes.map((e) => e.midi)) - 1;
  const hi = Math.max(...notes.map((e) => e.midi)) + 1;
  const top = 16;
  const drumH = 16;
  const span = H - top - drumH - 4;
  const x = (t: number): number => (t / c.bars) * W;
  const y = (m: number): number => top + ((hi - m) / (hi - lo)) * span;
  // Sections: alternate shading and names; the loop point is marked.
  c.sections.forEach((s, i) => {
    if (i % 2) {
      g.fillStyle = "rgba(255,255,255,0.035)";
      g.fillRect(x(s.from), 0, x(s.to) - x(s.from), H);
    }
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.font = "10px sans-serif";
    g.fillText(s.name, x(s.from) + 3, 11);
  });
  if (sel.value.song.loop !== null) {
    g.strokeStyle = "rgba(255,209,102,0.7)";
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(x(c.loopBar) + 0.5, 0);
    g.lineTo(x(c.loopBar) + 0.5, H);
    g.stroke();
    g.setLineDash([]);
  }
  const rowH = Math.max(1.5, span / (hi - lo));
  for (const v of ["pad", "bass", "keys", "arp", "counter", "lead"] as Voice[]) {
    g.fillStyle = COLORS[v];
    for (const e of notes) if (e.voice === v) g.fillRect(x(e.t), y(e.midi) - rowH / 2, Math.max(1, x(e.len) - 0.5), rowH);
  }
  for (const e of c.events) {
    if (!e.drum) continue;
    g.fillStyle = COLORS[e.voice];
    const row = e.drum === "k" ? 0 : e.drum === "s" || e.drum === "x" ? 1 : 2;
    g.fillRect(x(e.t), H - drumH + row * 5, 1, 4);
  }
}

function paint(): void {
  const cv = roll.value;
  if (!cv) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== W * dpr) {
    cv.width = W * dpr;
    cv.height = H * dpr;
  }
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!bg) drawBackground();
  g.drawImage(bg!, 0, 0);
  if (bar.value >= 0) {
    const px = (bar.value / compiled.value.bars) * W * dpr;
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(px, 0, 2 * dpr, H * dpr);
  }
}

watch(selId, () => {
  bg = null;
  paint();
});

let raf = 0;
function frame(): void {
  raf = requestAnimationFrame(frame);
  const p = audio.position();
  const b = p && playing.value && p.song === sel.value.song ? p.bar : -1;
  if (Math.abs(b - bar.value) > 0.004) {
    bar.value = b;
    paint();
  }
}

onMounted(() => {
  paint();
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  // Leaving the room hands the music back to the game.
  audio.listen(null);
});
</script>

<template>
  <div class="music-room">
    <div class="tracks">
      <button
        v-for="(t, i) in TRACKS"
        :key="t.id"
        class="track"
        :class="{ on: playing === t.id, picked: selId === t.id }"
        @click="playing === t.id ? stop() : play(t.id)"
      >
        <span class="no">{{ String(i + 1).padStart(2, "0") }}</span>
        <span class="state">{{ playing === t.id ? "■" : "▶" }}</span>
        <span class="title">{{ t.title }}</span>
        <span class="where muted">{{ t.where }}</span>
        <span class="len muted">{{ length(t.id) }}</span>
      </button>
    </div>
    <div class="now panel">
      <div class="head">
        <div>
          <div class="np-title">{{ sel.title }}</div>
          <div class="muted small">{{ sel.credit }}</div>
        </div>
        <div class="meta">
          <span class="tag">{{ sel.song.bpm }} BPM</span>
          <span v-if="now.key" class="tag">{{ now.key }}</span>
          <span class="tag">{{ now.section }}</span>
          <span class="tag mono">{{ elapsed }} / {{ length(sel.id) }}</span>
        </div>
      </div>
      <p class="comment">{{ sel.comment }}</p>
      <div class="chords">
        <div class="chord dim">{{ now.prev || "·" }}</div>
        <div class="chord cur">{{ now.cur || "·" }}</div>
        <div class="chord dim">{{ now.next || "·" }}</div>
      </div>
      <canvas ref="roll" class="roll" :style="{ width: W + 'px', height: H + 'px' }" @click="seek"></canvas>
      <div class="legend">
        <span v-for="v in LEGEND" :key="v"><i :style="{ background: COLORS[v] }"></i>{{ v }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-room {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tracks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.track {
  display: grid;
  grid-template-columns: 2.2em 1.6em 1fr auto 3.5em;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.track:hover,
.track.picked {
  background: rgba(255, 255, 255, 0.08);
}
.track.on {
  border-color: #ffd166;
  background: rgba(255, 209, 102, 0.12);
}
.track .no {
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.track .title {
  font-weight: 600;
}
.track .len {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.now {
  padding: 14px 16px;
}
.head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.np-title {
  font-size: 1.2em;
  font-weight: 700;
}
.small {
  font-size: 0.85em;
}
.meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tag {
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.85em;
}
.mono {
  font-variant-numeric: tabular-nums;
}
.comment {
  margin: 8px 0 10px;
  max-width: 880px;
}
.chords {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.chord {
  min-width: 96px;
  padding: 10px 14px;
  border-radius: 8px;
  text-align: center;
  font-size: 1.3em;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.chord.dim {
  opacity: 0.5;
  font-size: 1.05em;
  align-self: center;
}
.chord.cur {
  border-color: #ffd166;
  box-shadow: 0 0 12px rgba(255, 209, 102, 0.25);
}
.roll {
  display: block;
  cursor: pointer;
  max-width: 100%;
  border-radius: 6px;
}
.legend {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 0.8em;
  opacity: 0.8;
}
.legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border-radius: 2px;
  vertical-align: -1px;
}
</style>
