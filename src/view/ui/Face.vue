<script setup lang="ts">
// A character's face in a small round frame: the head of their field sprite,
// or a disc of their colour while they have no drawing yet.
import { computed } from "vue";
import { ART } from "../../art/index.ts";
import { svgOf } from "../../art/drawing.ts";
import { CHARACTERS, type CharacterId } from "../../content/names.ts";
import { hex } from "./useGame.ts";

/** Where the head sits in each sprite: its width and the height of its centre, as fractions of the drawing. */
const HEAD: Partial<Record<CharacterId, [w: number, y: number]>> = { reimu: [0.75, 0.32], daiyousei: [0.6, 0.4] };
const RIM = 2;

const props = withDefaults(defineProps<{ who: CharacterId; size?: number }>(), { size: 42 });
const face = computed(() => {
  const d = ART[props.who]?.sprite;
  const head = HEAD[props.who];
  if (!d || !head) return null;
  const inner = props.size - 2 * RIM;
  const k = (inner * 1.05) / (head[0] * d.w);
  const w = d.w * k;
  const h = d.h * k;
  return { svg: svgOf(d, 1), style: { width: `${w}px`, height: `${h}px`, left: `${(inner - w) / 2}px`, top: `${inner / 2 - head[1] * h}px` } };
});
</script>

<template>
  <span class="face" :style="{ width: `${size}px`, height: `${size}px`, background: face ? undefined : hex(CHARACTERS[who].color) }">
    <span v-if="face" class="art" :style="face.style" v-html="face.svg"></span>
  </span>
</template>

<style scoped>
.face {
  position: relative;
  flex: none;
  display: inline-block;
  overflow: hidden;
  border: 2px solid #e8c15a;
  border-radius: 50%;
  background: #2b201a;
}
.art {
  position: absolute;
}
.art :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
