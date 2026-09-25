<script setup lang="ts">
// The Hakurei seal: a vermilion hanko reading 博麗, its ink a little uneven,
// stamped beside the game's name on the title and the main menu.
</script>

<template>
  <svg class="hseal" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <!-- Stamped ink: the edges and the carved lines wander a little. -->
      <filter id="hseal-ink" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="7" />
        <feDisplacementMap in="SourceGraphic" scale="4" />
      </filter>
    </defs>
    <g filter="url(#hseal-ink)">
      <rect x="5" y="5" width="90" height="90" rx="7" fill="#c8352a" />
      <rect x="13" y="13" width="74" height="74" rx="3" fill="none" stroke="#f6f0e1" stroke-width="3" opacity="0.8" />
      <text x="50" y="47" text-anchor="middle" font-size="37" font-weight="700" fill="#f6f0e1" lang="ja">博</text>
      <text x="50" y="81" text-anchor="middle" font-size="37" font-weight="700" fill="#f6f0e1" lang="ja">麗</text>
    </g>
  </svg>
</template>

<style scoped>
.hseal {
  font-family: "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  opacity: 0.94;
}
</style>
