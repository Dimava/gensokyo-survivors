<script setup lang="ts">
// A level-up card's picture of an item: its HUD icon (itemIcons.ts) drawn big
// in the item's colour, the level in small pips under it. The onigiri and the
// offering: their icon alone.
import { computed } from "vue";
import { itemIconAt } from "../itemIcons.ts";

const props = defineProps<{ id: string; color: string; level?: number; max?: number; active: boolean }>();

const pips = computed(() => {
  const max = props.max ?? 0;
  return [...Array(max).keys()].map((i) => ({ x: (i - (max - 1) / 2) * 9, lit: i < (props.level ?? 0) }));
});
</script>

<template>
  <div class="ipv" :style="{ color }">
    <svg class="art" viewBox="0 0 24 24" fill="currentColor" width="60" height="60" v-html="itemIconAt(id, level ?? 1)"></svg>
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
  gap: 8px;
  margin: 4px 0 2px;
  /* The card's colour where the icon sits: the icons' cut-outs show it. */
  --hole: #252c57;
}
.art {
  overflow: visible;
  filter: drop-shadow(0 0 8px color-mix(in srgb, currentColor 45%, transparent));
}
</style>
