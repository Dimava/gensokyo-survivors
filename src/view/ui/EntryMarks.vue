<script setup lang="ts">
// Formations on their way (telegraph.ts): for the second before a formation comes in, the stretch of
// the screen's edge it will cross is lit from outside, vermilion, as wide as the formation, pulsing
// twice, with a small arrow for each lane pointing the way it will fly; a circle closing in lights the whole frame.
// It is the field's own light, so it stands behind the HUD, in front of the field; along the bottom,
// where the shelf (Spirit, the hand, the pile) stands on the edge, it rises from behind the shelf.
import { computed } from "vue";
import { host, state } from "../host.ts";
import { shelfPieces } from "./hudEdges.ts";

/** How far behind a shelf piece's top edge the light's own edge is tucked (px). */
const TUCK = 3;

interface Seg {
  side: string;
  all: boolean;
  style: Record<string, string | number>;
  arrows: string[];
}

const segs = computed(() => {
  void state.frame;
  const H = host.field.app.screen.height;
  const out: Seg[] = [];
  const shelf = host.field.entryMarks.some((g) => g.side === "bottom") ? shelfPieces(H) : [];
  for (const g of host.field.entryMarks) {
    const len = g.to - g.from;
    // The arrows step in a little with each pulse.
    const step = `${4 * (0.5 - 0.5 * Math.cos(g.k * Math.PI * 4))}px`;
    const all = g.lanes.length === 0;
    // An arrow where each lane comes in: a line reads as a row of them, a V as its spread, a stream as one.
    const arrows = g.lanes;
    // Cut at the shelf pieces' sides along the bottom; any other edge is one stretch.
    const cuts = [g.from, g.to];
    if (g.side === "bottom") for (const p of shelf) cuts.push(p.from, p.to);
    const xs = [...new Set(cuts)].filter((x) => x >= g.from && x <= g.to).sort((a, b) => a - b);
    const along = g.side === "left" || g.side === "right" ? "top" : "left";
    const size = along === "top" ? "height" : "width";
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i]!;
      const x1 = xs[i + 1]!;
      if (x1 - x0 < 0.5) continue;
      const mid = (x0 + x1) / 2;
      const lift = g.side === "bottom" ? Math.max(0, (shelf.find((p) => mid > p.from && mid < p.to)?.top ?? 0) - TUCK) : 0;
      out.push({
        side: g.side,
        all,
        style: {
          [along]: `${x0}px`,
          [size]: `${x1 - x0}px`,
          ...(lift ? { bottom: `${lift}px` } : {}),
          opacity: g.a,
          // The ends fade over the whole stretch, however it was cut.
          maskSize: along === "top" ? `100% ${len}px` : `${len}px 100%`,
          maskPosition: along === "top" ? `0 ${g.from - x0}px` : `${g.from - x0}px 0`,
          "--step": step,
        },
        arrows: arrows.filter((l) => l >= x0 && l < x1).map((l) => `${l - x0}px`),
      });
    }
  }
  return out;
});

</script>

<template>
  <div class="entries" aria-hidden="true">
    <div v-for="(s, i) in segs" :key="i" class="gate" :class="[s.side, { all: s.all }]" :style="s.style">
      <i v-for="(a, j) in s.arrows" :key="j" :style="{ '--at': a }" />
    </div>
  </div>
</template>

<style scoped>
.entries {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none !important;
}
/* The lit stretch: a crisp vermilion line on the edge, its light falling off inward, its ends fading. */
.gate {
  --lit: 229, 83, 45;
  --deep: 56px;
  position: absolute;
  background: linear-gradient(var(--in), rgba(var(--lit), 1) 0 2px, rgba(var(--lit), 0.55) 3px, rgba(var(--lit), 0.22) 40%, rgba(var(--lit), 0) 100%);
  mask-image: linear-gradient(var(--along), transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%);
  mask-repeat: no-repeat;
}
.gate.all {
  --deep: 36px;
  mask-image: none;
}
.gate.left {
  --in: to right;
  --along: to bottom;
  left: 0;
  width: var(--deep);
}
.gate.right {
  --in: to left;
  --along: to bottom;
  right: 0;
  width: var(--deep);
}
.gate.top {
  --in: to bottom;
  --along: to right;
  top: 0;
  height: var(--deep);
}
.gate.bottom {
  --in: to top;
  --along: to right;
  bottom: 0;
  height: var(--deep);
}
/* The arrow, just inside the line, pointing the way the formation will fly. */
.gate i {
  position: absolute;
  width: 11px;
  height: 12px;
  /* Outlined in ink, so it holds against a pale ground (a clip-path would cut its own shadow off). */
  filter: drop-shadow(0 0 1px rgba(12, 8, 6, 0.95));
}
.gate i::before {
  content: "";
  position: absolute;
  inset: 0;
  background: #ff7a50;
  clip-path: polygon(0 0, 100% 50%, 0 100%, 30% 50%);
}
.left i {
  left: calc(9px + var(--step));
  top: calc(var(--at) - 6px);
}
.right i {
  right: calc(9px + var(--step));
  top: calc(var(--at) - 6px);
  scale: -1 1;
}
.top i {
  top: calc(9px + var(--step));
  left: calc(var(--at) - 5.5px);
  rotate: 90deg;
}
.bottom i {
  bottom: calc(9px + var(--step));
  left: calc(var(--at) - 5.5px);
  rotate: -90deg;
}
</style>
