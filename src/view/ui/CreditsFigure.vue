<script setup lang="ts">
// A figure beside a credits line: a character's or enemy's drawn art (src/art)
// as SVG, idling with a CSS bob. With the Live2D art style, a portrait runs its
// rig (src/art-l2d) live, but only while the figure is on screen in the roll
// and at 30 fps; a sprite rig's idle cycle is baked once into a flip-book
// (credits/flipbook.ts) and played by CSS, so a crowd of fairies costs nothing.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import LivePortrait from "./LivePortrait.vue";
import { flipbook } from "./credits/flipbook.ts";
import { ART } from "../../art/index.ts";
import { svgOf } from "../../art/drawing.ts";
import { ART_L2D } from "../../art-l2d/index.ts";
import { prefs } from "../prefs.ts";

const props = withDefaults(defineProps<{ art: string; kind?: "sprite" | "portrait"; zoom?: number; flip?: boolean; delay?: number }>(), { kind: "sprite", zoom: 2, flip: false, delay: 0 });

/** Frames baked per idle cycle of a sprite rig. */
const FRAMES = 6;

const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const el = ref<HTMLElement>();
const seen = ref(false);

/** Portraits are laid out at the drawn portraits' size; sprites at their own (drawn, else rigged). */
const PORTRAIT = { w: 220, h: 320 };
const size = computed(() => {
  const z = props.zoom;
  if (props.kind === "portrait") return { w: Math.round(PORTRAIT.w * z), h: Math.round(PORTRAIT.h * z) };
  const d = ART[props.art]?.sprite ?? ART_L2D[props.art]?.sprite;
  return d ? { w: Math.round(d.w * z), h: Math.round(d.h * z) } : { w: 0, h: 0 };
});
/** The drawn art; a character with no drawn portrait shows her field sprite in its place. */
const svg = computed(() => {
  const set = ART[props.art];
  const d = (props.kind === "portrait" ? set?.portrait : null) ?? set?.sprite;
  return d ? svgOf(d, props.zoom) : "";
});
const rigged = computed(() => !reduced && prefs.artStyle === "live2d");
const livePortrait = computed(() => {
  const m = rigged.value && props.kind === "portrait" ? ART_L2D[props.art]?.portrait : undefined;
  return m ? { model: m, w: size.value.w * 1.1, h: size.value.h * 1.06 } : null;
});
const spriteRig = computed(() => (rigged.value && props.kind === "sprite" ? (ART_L2D[props.art]?.sprite ?? null) : null));

/** The baked flip-book of the sprite rig, once it has been on screen. */
const strip = ref("");
watch(
  [seen, spriteRig],
  async ([on, sr]) => {
    if (!on || !sr || strip.value) return;
    const w = sr.w * props.zoom;
    const h = sr.h * props.zoom;
    strip.value = await flipbook(props.art, sr, w, h, FRAMES);
  },
  { immediate: true },
);
const stripBox = computed(() => {
  const sr = spriteRig.value;
  return sr ? { w: sr.w * props.zoom, h: sr.h * props.zoom, cycle: 1 / sr.rate } : null;
});

let io: IntersectionObserver | null = null;
onMounted(() => {
  if (!el.value) return;
  // Once near the view it stays set: a live rig then stays mounted (it idles off screen by itself), so it is built and uploaded only once.
  io = new IntersectionObserver((es) => (seen.value ||= es.some((e) => e.isIntersecting)), { root: el.value.closest(".credits-roll"), rootMargin: "600px 0px" });
  io.observe(el.value);
});
onBeforeUnmount(() => io?.disconnect());
</script>

<template>
  <div ref="el" class="fig" :class="[kind, { still: reduced }]" :style="{ width: `${size.w}px`, height: `${size.h}px`, '--delay': `${delay}s` }">
    <LivePortrait v-if="livePortrait && seen" class="live" :model="livePortrait.model" :width="livePortrait.w" :height="livePortrait.h" :flip="flip" :fps="30" follow />
    <div
      v-else-if="strip && stripBox"
      class="flip"
      :style="{ width: `${stripBox.w}px`, height: `${stripBox.h}px`, transform: flip ? 'scaleX(-1)' : undefined }"
    >
      <img
        class="strip"
        :src="strip"
        alt=""
        :style="{ width: `${stripBox.w * FRAMES}px`, height: `${stripBox.h}px`, animationDuration: `calc(${stripBox.cycle}s * var(--anim))`, animationTimingFunction: `steps(${FRAMES})`, animationDelay: `calc(${-delay}s * var(--anim))` }"
      />
    </div>
    <div v-else class="drawn" :style="{ transform: flip ? 'scaleX(-1)' : undefined }" v-html="svg"></div>
  </div>
</template>

<style scoped>
.fig {
  position: relative;
  flex: none;
  display: grid;
  place-items: end center;
}
.drawn,
.live,
.flip {
  grid-area: 1 / 1;
  /* The shadow sits on the moving layer itself, so a bob moves a finished layer instead of re-filtering it every frame. */
  filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.45));
}
.drawn :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.sprite .drawn {
  animation: bob calc(1.6s * var(--anim)) ease-in-out calc(var(--delay) * var(--anim)) infinite alternate;
}
.portrait .drawn {
  animation: breathe calc(4.5s * var(--anim)) ease-in-out calc(var(--delay) * var(--anim)) infinite alternate;
  transform-origin: 50% 100%;
}
.flip {
  overflow: hidden;
}
.strip {
  display: block;
  max-width: none;
  animation-name: play;
  animation-iteration-count: infinite;
}
.still .drawn {
  animation: none;
}
@keyframes bob {
  to {
    translate: 0 -5px;
  }
}
@keyframes breathe {
  to {
    scale: 1 1.012;
  }
}
@keyframes play {
  to {
    transform: translateX(-100%);
  }
}
</style>
