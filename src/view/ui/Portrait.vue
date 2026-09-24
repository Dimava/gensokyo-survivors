<script setup lang="ts">
// A VN portrait: the character's drawing (src/art) when there is one, else a
// placeholder bust drawn from the character's colour. `look` turns the head.
// With the Live2D art style, characters with a rigged model animate instead
// (they follow the cursor when no look is given, and move their lips while talking).
import { computed } from "vue";
import { livePortrait } from "../art-set.ts";
import LivePortrait from "./LivePortrait.vue";
import { ART } from "../../art/index.ts";
import { AHEAD, svgOf, type Look } from "../../art/drawing.ts";
import { CHARACTERS, type CharacterId } from "../../content/names.ts";
import { hex } from "./useGame.ts";

const props = defineProps<{ who: CharacterId; flip?: boolean; look?: Look; talking?: boolean }>();
const live = computed(() => livePortrait(props.who));
const drawn = computed(() => {
  const d = ART[props.who]?.portrait;
  // Mirrored portraits look the other way, so mirror the look too.
  const look = props.look ?? AHEAD;
  return d ? svgOf(d, 1, props.flip ? { x: -look.x, y: look.y } : look) : null;
});
const c = computed(() => hex(CHARACTERS[props.who].color));
const hair = computed(() => {
  const map: Partial<Record<CharacterId, string>> = { reimu: "#3a2418", marisa: "#f2d36b", sakuya: "#d8dde8", yukari: "#f2e2a0", cirno: "#6fb6ff", rumia: "#f2e27a", daiyousei: "#7bd88f" };
  return map[props.who] ?? "#3a2418";
});
const wings = computed(() => props.who === "cirno" || props.who === "daiyousei");
</script>

<template>
  <LivePortrait v-if="live" class="portrait" :model="live" :width="240" :height="340" :flip="flip" :look="look" :talking="talking" />
  <div v-else-if="drawn" class="portrait drawn" :style="{ transform: flip ? 'scaleX(-1)' : undefined }" v-html="drawn"></div>
  <svg v-else class="portrait" viewBox="0 0 220 320" :style="{ transform: flip ? 'scaleX(-1)' : undefined }">
    <defs>
      <radialGradient :id="`glow-${who}`" cx="50%" cy="45%" r="60%">
        <stop offset="0%" :stop-color="c" stop-opacity="0.45" />
        <stop offset="100%" :stop-color="c" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle cx="110" cy="150" r="140" :fill="`url(#glow-${who})`" />
    <g v-if="wings" opacity="0.85">
      <polygon points="60,170 8,130 30,190" fill="#bdf2ff" />
      <polygon points="60,200 4,190 34,228" fill="#bdf2ff" />
      <polygon points="160,170 212,130 190,190" fill="#bdf2ff" />
      <polygon points="160,200 216,190 186,228" fill="#bdf2ff" />
    </g>
    <path d="M40 320 C45 220 70 190 110 190 C150 190 175 220 180 320 Z" :fill="c" />
    <path d="M85 195 L110 240 L135 195 Z" fill="#ffffff" />
    <circle cx="110" cy="120" r="58" fill="#ffe4d2" />
    <path d="M50 118 C50 60 80 44 110 44 C140 44 170 60 170 118 C160 90 140 78 110 78 C80 78 60 90 50 118 Z" :fill="hair" />
    <path d="M52 118 L46 190 L66 150 Z" :fill="hair" />
    <path d="M168 118 L174 190 L154 150 Z" :fill="hair" />
    <ellipse cx="88" cy="128" rx="8" ry="11" fill="#2a1a3a" />
    <ellipse cx="132" cy="128" rx="8" ry="11" fill="#2a1a3a" />
    <circle cx="90" cy="124" r="3" fill="#fff" />
    <circle cx="134" cy="124" r="3" fill="#fff" />
    <path d="M100 152 Q110 160 120 152" stroke="#9a4a4a" stroke-width="3" fill="none" stroke-linecap="round" />
    <g v-if="who === 'reimu'">
      <polygon points="110,52 60,20 66,70" fill="#e0314b" />
      <polygon points="110,52 160,20 154,70" fill="#e0314b" />
      <circle cx="110" cy="52" r="9" fill="#fff" />
    </g>
    <g v-else>
      <polygon points="110,50 76,30 80,62" :fill="c" />
      <polygon points="110,50 144,30 140,62" :fill="c" />
    </g>
  </svg>
</template>

<style scoped>
.portrait {
  width: 240px;
  height: 340px;
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.5));
}
.portrait.drawn :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
