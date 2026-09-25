<script setup lang="ts">
// The music room, Touhou style: the soundtrack as a list with play and stop
// (and, below it, earlier versions to compare, songs-legacy.ts), each track's
// composer comment, and a now-playing view: the section and key, the
// previous, current and next chords as cards, and a piano roll of the whole
// track (coloured per voice) with a playhead; clicking the roll seeks. Songs
// carry their own chords (music.ts compileSong), so nothing is analysed. The
// list scrolls in its own column; the roll fills the space beside it.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { audio } from "../audio.ts";
import { compileSong, songLength, type Voice } from "../music.ts";
import { TRACKS, type TrackInfo } from "../songs.ts";
import { LEGACY_TRACKS } from "../songs-legacy.ts";

const ALL: readonly TrackInfo[] = [...TRACKS, ...LEGACY_TRACKS];
const GROUPS: { label: string; tracks: readonly TrackInfo[] }[] = [
  { label: "Soundtrack", tracks: TRACKS },
  { label: "Earlier versions", tracks: LEGACY_TRACKS },
];

const playing = ref<string | null>(audio.listening);
const selId = ref<string>(playing.value ?? TRACKS[0]!.id);
const sel = computed(() => ALL.find((t) => t.id === selId.value) ?? TRACKS[0]!);
const compiled = computed(() => compileSong(sel.value.song));
const bar = ref(-1);
const roll = ref<HTMLCanvasElement | null>(null);
const rollBox = ref<HTMLElement | null>(null);

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

const lengths = new Map(ALL.map((t) => [t.id, mmss(songLength(t.song).total)]));

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

/** Clicking the roll plays the track from there (by the roll's displayed width). */
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

/** The roll's size in CSS pixels (from its box), and the notes drawn once per track and size. */
let W = 0;
let H = 0;
let bg: HTMLCanvasElement | null = null;

function drawBackground(dpr: number): HTMLCanvasElement {
  const c = compiled.value;
  const out = document.createElement("canvas");
  out.width = Math.round(W * dpr);
  out.height = Math.round(H * dpr);
  const g = out.getContext("2d")!;
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
  return out;
}

function paint(): void {
  const cv = roll.value;
  if (!cv || W < 2 || H < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(W * dpr);
  const ph = Math.round(H * dpr);
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw;
    cv.height = ph;
    bg = null;
  }
  const g = cv.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  bg ??= drawBackground(dpr);
  g.drawImage(bg, 0, 0);
  if (bar.value >= 0) {
    const px = (bar.value / compiled.value.bars) * pw;
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.fillRect(px, 0, 2 * dpr, ph);
  }
}

watch(selId, () => {
  bg = null;
  paint();
});

const resize = new ResizeObserver(([entry]) => {
  const r = entry!.contentRect;
  if (Math.round(r.width) === W && Math.round(r.height) === H) return;
  W = Math.round(r.width);
  H = Math.round(r.height);
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
  if (rollBox.value) resize.observe(rollBox.value);
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  resize.disconnect();
  cancelAnimationFrame(raf);
  // Leaving the room hands the music back to the game.
  audio.listen(null);
});
</script>

<template>
  <div class="music-room">
    <div class="tracks">
      <template v-for="grp in GROUPS" :key="grp.label">
        <div class="group">{{ grp.label }}</div>
        <button
          v-for="(t, i) in grp.tracks"
          :key="t.id"
          class="track"
          :class="{ on: playing === t.id, picked: selId === t.id }"
          @click="playing === t.id ? stop() : play(t.id)"
        >
          <span class="no">{{ String(i + 1).padStart(2, "0") }}</span>
          <span class="state">{{ playing === t.id ? "■" : "▶" }}</span>
          <span class="title">{{ t.title }}<small class="muted">{{ t.where }}</small></span>
          <span class="len muted">{{ lengths.get(t.id) }}</span>
        </button>
      </template>
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
          <span class="tag mono">{{ elapsed }} / {{ lengths.get(sel.id) }}</span>
        </div>
      </div>
      <p class="comment">{{ sel.comment }}</p>
      <div class="chords">
        <div class="chord dim">{{ now.prev || "·" }}</div>
        <div class="chord cur">{{ now.cur || "·" }}</div>
        <div class="chord dim">{{ now.next || "·" }}</div>
      </div>
      <div ref="rollBox" class="roll-box">
        <canvas ref="roll" class="roll" @click="seek"></canvas>
      </div>
      <div class="legend">
        <span v-for="v in LEGEND" :key="v"><i :style="{ background: COLORS[v] }"></i>{{ v }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-room {
  display: grid;
  grid-template-columns: minmax(280px, 380px) 1fr;
  gap: 14px;
  height: 100%;
  min-height: 0;
}
.tracks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.group {
  margin: 10px 2px 4px;
  font-size: 0.8em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.6;
}
.group:first-child {
  margin-top: 0;
}
.track {
  display: grid;
  grid-template-columns: 2em 1.2em 1fr 3em;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid rgba(232, 193, 90, 0.12);
  border-radius: 2px;
  background: rgba(10, 8, 7, 0.35);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  scroll-margin: 8px;
}
.track:hover,
.track.picked {
  background: rgba(46, 35, 28, 0.9);
}
.track.on {
  border-color: #e8c15a;
  background: rgba(232, 193, 90, 0.1);
}
.track .no {
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.track .title {
  font-weight: 600;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.track .title small {
  font-weight: 400;
  font-size: 0.8em;
}
.track .len {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.now {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
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
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.85em;
}
.mono {
  font-variant-numeric: tabular-nums;
}
.comment {
  margin: 8px 0 10px;
}
.chords {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}
.chord {
  min-width: 96px;
  padding: 10px 14px;
  border-radius: 2px;
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
  border-color: #e8c15a;
}
.roll-box {
  position: relative;
  flex: 1;
  min-height: 140px;
}
.roll {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 6px;
  cursor: pointer;
}
.legend {
  display: flex;
  flex-wrap: wrap;
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
