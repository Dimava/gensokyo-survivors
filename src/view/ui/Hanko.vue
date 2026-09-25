<script setup lang="ts">
// A small hanko: one kanji carved in a vermilion seal, its ink a little uneven,
// stamped a few degrees off square (refs/gui/NOTES.md, Badge). The badge of the
// game: 新 a new record, 初 a first clear. Always paired with an English word
// beside it; the seal is the mark, not the label.
withDefaults(defineProps<{ ch: string; tilt?: number }>(), { tilt: -6 });
</script>

<template>
  <svg class="hanko" viewBox="0 0 100 100" :style="{ rotate: `${tilt}deg` }" aria-hidden="true">
    <defs>
      <filter id="hanko-ink" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="3" />
        <feDisplacementMap in="SourceGraphic" scale="5" />
      </filter>
    </defs>
    <g filter="url(#hanko-ink)">
      <rect x="6" y="6" width="88" height="88" rx="8" fill="#c8352a" />
      <rect x="15" y="15" width="70" height="70" rx="3" fill="none" stroke="#f6f0e1" stroke-width="4" opacity="0.75" />
      <text x="50" y="71" text-anchor="middle" font-size="58" font-weight="700" fill="#f6f0e1" lang="ja">{{ ch }}</text>
    </g>
  </svg>
</template>

<style scoped>
.hanko {
  display: inline-block;
  flex: none;
  width: 1.25em;
  height: 1.25em;
  vertical-align: -0.2em;
  font-family: "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  opacity: 0.95;
}
</style>
