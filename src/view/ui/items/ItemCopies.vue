<script setup lang="ts">
// A level-up card's picture of an item at the offered level: its HUD icon
// (itemIcons.ts) drawn big in the item's colour, as many times as the level
// (one charm at Lv 1, five at Lv 5), with a glow that grows with the level and
// a calm wave bobbing through them. The onigiri and the offering: one icon.
import { computed } from "vue";
import { itemIcon } from "../itemIcons.ts";

const props = defineProps<{
  id: string;
  color: string;
  /** The offered level, 1-based; none for the onigiri and the offering. */
  level?: number;
  max?: number;
  /** Animating (the live offer); a leaving copy holds still. */
  active: boolean;
}>();

const W = 196;
const H = 90;
const n = computed(() => Math.max(1, props.level ?? 1));
/** Each copy's size: one big icon, shrinking as more share the row. */
const size = computed(() => Math.min(66, (W - 8 - (n.value - 1) * 6) / n.value));
/** 0..1: how far up its levels the item is (a lone icon counts as full). */
const power = computed(() => (props.level && props.max ? props.level / props.max : 1));
const copies = computed(() =>
  [...Array(n.value).keys()].map((i) => {
    const off = i - (n.value - 1) / 2;
    // A gentle arc: the middle one highest.
    return { x: W / 2 + off * (size.value + 6), y: H / 2 + off * off * 2.2 - (n.value > 1 ? 3 : 0), delay: i * 0.12 };
  }),
);
</script>

<template>
  <div class="ipv" :class="{ still: !active }" :style="{ width: W + 'px', height: H + 'px', color, '--glow': `${4 + 10 * power}px`, '--glowA': `${Math.round(35 + 45 * power)}%` }">
    <svg
      v-for="(c, i) in copies"
      :key="i"
      class="copy"
      viewBox="0 0 24 24"
      fill="currentColor"
      :style="{ width: size + 'px', height: size + 'px', left: c.x - size / 2 + 'px', top: c.y - size / 2 + 'px', '--d': c.delay }"
      v-html="itemIcon(id)"
    ></svg>
  </div>
</template>

<style scoped>
.ipv {
  position: relative;
  align-self: center;
  max-width: 100%;
  margin-bottom: 4px;
  /* The card's colour where the icon sits: the icons' cut-outs show it. */
  --hole: #252c57;
}
.copy {
  position: absolute;
  overflow: visible;
  filter: drop-shadow(0 0 var(--glow) color-mix(in srgb, currentColor var(--glowA), transparent));
  animation:
    bob calc(2.4s * var(--anim)) ease-in-out calc(var(--d) * 1s * var(--anim)) infinite,
    shine calc(2.4s * var(--anim)) ease-in-out calc(var(--d) * 1s * var(--anim)) infinite;
}
.still .copy {
  animation-play-state: paused;
}
@keyframes bob {
  0%,
  40%,
  100% {
    transform: translateY(0);
  }
  20% {
    transform: translateY(-4px);
  }
}
@keyframes shine {
  0%,
  40%,
  100% {
    filter: drop-shadow(0 0 var(--glow) color-mix(in srgb, currentColor var(--glowA), transparent));
  }
  20% {
    filter: drop-shadow(0 0 calc(var(--glow) + 6px) currentColor) brightness(1.25);
  }
}
</style>
