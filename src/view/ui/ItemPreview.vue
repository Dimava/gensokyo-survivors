<script setup lang="ts">
// A level-up card's picture of an item at the offered level: a symbol of what
// it gives, the effect grown to that level (itemArt.ts); small pips under it
// count the levels. The onigiri and the offering: their icon alone.
import { computed } from "vue";
import { itemArt } from "./itemArt.ts";
import { itemIcon } from "./itemIcons.ts";
import { PASSIVE_BY_ID } from "../../content/passives.ts";

const props = defineProps<{
  id: string;
  color: string;
  /** The offered level, 1-based; none for the onigiri and the offering. */
  level?: number;
  max?: number;
  active: boolean;
}>();

const S = 64;
const svg = computed(() => (props.level && props.max && PASSIVE_BY_ID[props.id] ? itemArt(PASSIVE_BY_ID[props.id]!.stat, props.level, props.max) : `<g transform="translate(4 4) scale(1.6667)">${itemIcon(props.id)}</g>`));
const pips = computed(() => {
  const max = props.max ?? 0;
  return [...Array(max).keys()].map((i) => ({ x: (i - (max - 1) / 2) * 9, lit: i < (props.level ?? 0) }));
});
</script>

<template>
  <div class="ipv" :style="{ color }">
    <svg class="art" viewBox="0 0 48 48" fill="currentColor" :width="S" :height="S" v-html="svg"></svg>
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
  gap: 4px;
  margin-bottom: 2px;
  /* The card's colour where the icon sits: the flat icons' cut-outs show it. */
  --hole: #252c57;
}
.art {
  overflow: visible;
}
</style>
