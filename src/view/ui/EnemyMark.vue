<script setup lang="ts">
// Touhou's enemy marker: a small "ENEMY" tag on the bottom edge of the screen
// under the boss (or a midboss holding the stage), with a hairline rising from
// it, so her column can be read through heavy danmaku and while she moves. Off
// the side of the screen, the tag waits at that edge and points her way.
// Where the HUD's bottom shelf stands (Spirit, the hand, the draw pile), the tag
// rides on top of it instead of covering a card.
import { computed } from "vue";
import { host, state } from "../host.ts";

/** The shelf pieces the tag steps over, with how far above each one's top it rides (the hand's key caps stand proud of the cards). */
const SHELF: [string, number][] = [
  [".hud .bottom > .hand", 13],
  [".hud .bottom > .spirit", 4],
  [".hud .bottom > .pile", 4],
];

/** How high the bottom shelf stands under screen x, in px from the screen's foot. */
function shelf(x: number, H: number): number {
  let lift = 0;
  for (const [sel, pad] of SHELF) {
    const el = document.querySelector<HTMLElement>(sel);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (x > r.left - 26 && x < r.right + 26) lift = Math.max(lift, H - r.top + pad);
  }
  return lift;
}

const mark = computed(() => {
  void state.frame;
  const m = host.field.enemyMark;
  if (!m) return null;
  const W = host.field.app.screen.width;
  const H = host.field.app.screen.height;
  const off = m.x < 0 ? -1 : m.x > W ? 1 : 0;
  const x = Math.max(30, Math.min(W - 30, m.x));
  return { x, off, lift: shelf(x, H) };
});
</script>

<template>
  <div
    v-if="mark"
    class="emark"
    :class="{ left: mark.off < 0, right: mark.off > 0 }"
    :style="{ left: `${mark.x}px`, bottom: `${mark.lift}px` }"
    aria-hidden="true"
  >
    <i class="rise" />
    <span class="tag">ENEMY</span>
  </div>
</template>

<style scoped>
.emark {
  position: absolute;
  bottom: 0;
  translate: -50% 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none !important;
  /* Stepping onto the shelf and off it is a quick hop, not a jump cut. */
  transition: bottom calc(0.16s * var(--anim)) cubic-bezier(0.2, 0.9, 0.3, 1);
}
.rise {
  width: 1px;
  height: 30px;
  background: linear-gradient(to top, rgba(229, 83, 45, 0.9), rgba(229, 83, 45, 0));
}
.tag {
  padding: 2px 6px 1px;
  background: #17110e;
  border-top: 2px solid #e5532d;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.6);
  font: 700 9px/1.2 var(--display);
  letter-spacing: 0.24em;
  color: #f6f0e1;
}
/* Off screen: no line (she is not above it), and a vermilion arrow points her way. */
.left .rise,
.right .rise {
  opacity: 0;
}
.left .tag::before {
  content: "\2039 ";
  color: #e5532d;
}
.right .tag::after {
  content: " \203A";
  color: #e5532d;
}
</style>
