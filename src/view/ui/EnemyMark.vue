<script setup lang="ts">
// Touhou's enemy marker: a small "ENEMY" tag on the bottom edge of the screen
// under the boss (or a midboss holding the stage), with a hairline rising from
// it, so her column can be read through heavy danmaku and while she moves. Off
// the side of the screen, the tag waits at that edge and points her way.
import { computed } from "vue";
import { host, state } from "../host.ts";

const mark = computed(() => {
  void state.frame;
  const m = host.field.enemyMark;
  if (!m) return null;
  const W = host.field.app.screen.width;
  const off = m.x < 0 ? -1 : m.x > W ? 1 : 0;
  return { x: Math.max(30, Math.min(W - 30, m.x)), off };
});
</script>

<template>
  <div v-if="mark" class="emark" :class="{ left: mark.off < 0, right: mark.off > 0 }" :style="{ left: `${mark.x}px` }" aria-hidden="true">
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
