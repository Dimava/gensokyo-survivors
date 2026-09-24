<script setup lang="ts">
// A level-up card's picture of an item, "Icon + effect": the HUD icon, the
// same size and place at every level, and a plain effect layer round it that
// grows with the level (iconEffect.ts); pips count the levels. The Duplex
// Tome's effect is its shadow copies (itemIconAt). The onigiri and the
// offering: their icon alone.
import { computed } from "vue";
import { itemIconAt } from "../itemIcons.ts";
import { iconEffect } from "./iconEffect.ts";

const props = defineProps<{ id: string; color: string; level?: number; max?: number; active: boolean }>();

const step = computed(() => {
  const { level, max } = props;
  if (!level || !max) return 0;
  return max <= 1 ? 5 : Math.round(1 + ((level - 1) * 4) / (max - 1));
});
const svg = computed(() => (step.value ? iconEffect(props.id, step.value) : "") + `<g transform="translate(11 11) scale(${26 / 24})">${itemIconAt(props.id, props.level ?? 1)}</g>`);
const pips = computed(() => {
  const max = props.max ?? 0;
  return [...Array(max).keys()].map((i) => ({ x: (i - (max - 1) / 2) * 9, lit: i < (props.level ?? 0) }));
});
</script>

<template>
  <div class="ipv" :style="{ color }">
    <svg class="art" viewBox="0 0 48 48" fill="currentColor" width="84" height="84" v-html="svg"></svg>
    <svg v-if="pips.length" class="pips" viewBox="-40 -4 80 8" width="80" height="8">
      <circle v-for="(p, i) in pips" :key="i" :cx="p.x" cy="0" r="2.6" :fill="p.lit ? '#ffcf5a' : 'rgba(255,255,255,0.18)'" />
    </svg>
  </div>
</template>

<style scoped>
.ipv {
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-bottom: 2px;
  /* The card's colour where the icon sits: the icon's cut-outs show it. */
  --hole: #252c57;
}
.art {
  overflow: visible;
}
</style>
