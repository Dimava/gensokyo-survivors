<script setup lang="ts">
// A level-up card's picture of an item: its HUD icon (itemIcons.ts), one, big,
// in the item's colour, dressed up as a better tier at each level:
//   1 plain · 2 a silver medallion rim · 3 a gold rim on a plate, the icon
//   gilded · 4 gems set in the rim · 5 (max) a crown and slowly turning rays.
// Items with fewer levels spread the same tiers (the Duplex Tome: 1 and 5).
// Pips under it count the levels. The onigiri and the offering: the icon alone.
import { computed } from "vue";
import { itemIcon } from "./itemIcons.ts";

const props = defineProps<{
  id: string;
  color: string;
  /** The offered level, 1-based; none for the onigiri and the offering. */
  level?: number;
  max?: number;
  /** Animating (the live offer); a leaving copy holds still. */
  active: boolean;
}>();

const S = 96;
const C = 46;
const R = 31;
const SILVER = "#d6dcec";
const GOLD = "#ffcf5a";
const GOLD_DARK = "#a8771a";

const tier = computed(() => {
  const { level, max } = props;
  if (!level || !max) return 0;
  return max <= 1 ? 5 : Math.round(1 + ((level - 1) * 4) / (max - 1));
});
const icon = computed(() => (tier.value >= 2 ? 42 : 52));
const gems = [45, 135, 225, 315].map((d) => ({ x: C + Math.cos((d * Math.PI) / 180) * R, y: C + Math.sin((d * Math.PI) / 180) * R }));
const rays = [...Array(12).keys()].map((i) => {
  const a = (i / 12) * Math.PI * 2;
  const w = 0.13;
  const p = (ang: number, r: number) => `${(C + Math.cos(ang) * r).toFixed(1)},${(C + Math.sin(ang) * r).toFixed(1)}`;
  return `${p(a - w, R - 2)} ${p(a, R + 13)} ${p(a + w, R - 2)}`;
});
const pips = computed(() => {
  const max = props.max ?? 0;
  return [...Array(max).keys()].map((i) => ({ x: S / 2 + (i - (max - 1) / 2) * 9, lit: i < (props.level ?? 0) }));
});
</script>

<template>
  <svg class="ipv" :class="[`t${tier}`, { still: !active }]" :viewBox="`0 0 ${S} ${S}`" :width="S" :height="S" :style="{ color }">
    <defs>
      <radialGradient :id="`plate-${id}`" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#3a4380" />
        <stop offset="100%" stop-color="#171c3c" />
      </radialGradient>
    </defs>
    <!-- 5: rays behind, turning slowly -->
    <g v-if="tier >= 5" class="rays">
      <polygon v-for="(r, i) in rays" :key="i" :points="r" :fill="GOLD" opacity="0.55" />
    </g>
    <!-- 2+: the medallion; 3+ on a plate in gold -->
    <circle v-if="tier >= 3" :cx="C" :cy="C" :r="R" :fill="`url(#plate-${id})`" />
    <circle v-if="tier >= 2" :cx="C" :cy="C" :r="R" fill="none" :stroke="tier >= 3 ? GOLD : SILVER" :stroke-width="tier >= 3 ? 3.2 : 2.4" />
    <circle v-if="tier >= 3" :cx="C" :cy="C" :r="R - 3.6" fill="none" :stroke="GOLD_DARK" stroke-width="1" />
    <!-- 4+: gems in the rim -->
    <g v-if="tier >= 4">
      <g v-for="(g, i) in gems" :key="i" :transform="`translate(${g.x} ${g.y}) rotate(45)`">
        <rect x="-4" y="-4" width="8" height="8" :fill="GOLD" />
        <rect x="-2.6" y="-2.6" width="5.2" height="5.2" fill="currentColor" />
        <rect x="-2.6" y="-2.6" width="2" height="2" fill="#fff" opacity="0.7" />
      </g>
    </g>
    <!-- 5: a crown on top -->
    <g v-if="tier >= 5" :transform="`translate(${C} ${C - R - 1})`">
      <path d="M-11 0 L-12 -11 L-5.5 -5 L0 -13 L5.5 -5 L12 -11 L11 0 Z" :fill="GOLD" :stroke="GOLD_DARK" stroke-width="1" stroke-linejoin="round" />
      <circle cx="0" cy="-5" r="1.9" fill="currentColor" />
    </g>
    <svg
      class="icon"
      :x="C - icon / 2"
      :y="C - icon / 2"
      :width="icon"
      :height="icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      :style="{ '--hole': tier >= 3 ? '#2a3163' : '#252c57' }"
      v-html="itemIcon(id)"
    ></svg>
    <circle v-for="(p, i) in pips" :key="'p' + i" :cx="p.x" :cy="S - 6" r="2.6" :fill="p.lit ? GOLD : 'rgba(255,255,255,0.18)'" />
  </svg>
</template>

<style scoped>
.ipv {
  display: block;
  align-self: center;
  overflow: visible;
  margin-bottom: 2px;
}
.icon {
  overflow: visible;
  filter: drop-shadow(0 0 6px color-mix(in srgb, currentColor 50%, transparent));
}
/* 3+: the icon gilded, a thin gold outline round it. */
.t3 .icon,
.t4 .icon,
.t5 .icon {
  filter: drop-shadow(0.6px 0 0 #ffcf5a) drop-shadow(-0.6px 0 0 #ffcf5a) drop-shadow(0 0.6px 0 #ffcf5a) drop-shadow(0 -0.6px 0 #ffcf5a)
    drop-shadow(0 0 6px color-mix(in srgb, currentColor 50%, transparent));
}
.rays {
  transform-origin: 46px 46px;
  animation: turn calc(30s * var(--anim)) linear infinite;
}
.still .rays {
  animation-play-state: paused;
}
@keyframes turn {
  to {
    transform: rotate(1turn);
  }
}
</style>
