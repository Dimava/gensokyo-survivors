<script setup lang="ts">
// The backdrop of every screen outside a run: the night over the Hakurei
// Shrine (the credits' sky, standing still). Stars twinkle by group and
// fireflies drift; everything else is one flat SVG, nothing repaints per frame.
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";

/** Deterministic stars (a small LCG), the same sky as the credits. */
const stars = (() => {
  let s = 20240917;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return Array.from({ length: 110 }, (_, i) => ({ i, x: r() * 1600, y: r() * 560, r: 0.6 + r() ** 3 * 2, o: 0.35 + r() * 0.65 }));
})();
const starGroups = [0, 1, 2].map((g) => stars.filter((st) => st.i % 3 === g));

/**
 * The words that stand straight on the sky. A star under one of them is put out: in a word it
 * reads as an accent or a stray comma ("Recȯrds", "most,have"), not as a star.
 */
const WORDS = [
  ".screen.title .logo",
  ".screen.title .foot",
  ".menu .logo",
  ".menu .entry > span",
  ".screen-head h1",
  ".screen-head .sub",
  ".screen-head .tab",
  ".screen-head .opt",
  ".screen.cards > .count",
  ".screen.cards > .warn",
].join(",");

const el = ref<HTMLElement>();
const hidden = shallowRef(new Set<number>());

/** Measures the words' own line boxes (not their blocks) and hides the stars that touch one. */
function clearWords(): void {
  const box = el.value?.getBoundingClientRect();
  if (!box) return;
  // The layers are a 1600x900 view box, "xMidYMax slice".
  const s = Math.max(box.width / 1600, box.height / 900);
  const x0 = box.left + (box.width - 1600 * s) / 2;
  const y0 = box.top + box.height - 900 * s;
  const lines: DOMRect[] = [];
  const range = document.createRange();
  for (const w of document.querySelectorAll(WORDS)) {
    range.selectNodeContents(w);
    lines.push(...range.getClientRects());
  }
  const out = new Set<number>();
  for (const st of stars) {
    const x = x0 + st.x * s;
    const y = y0 + st.y * s;
    const m = st.r * s + 3;
    if (lines.some((q) => x > q.left - m && x < q.right + m && y > q.top - m && y < q.bottom + m)) out.add(st.i);
  }
  if (out.size !== hidden.value.size || [...out].some((i) => !hidden.value.has(i))) hidden.value = out;
}

// Screens come and go, and words change, under the sky: look again after the DOM settles.
let frame = 0;
let late = 0;
function soon(): void {
  cancelAnimationFrame(frame);
  clearTimeout(late);
  frame = requestAnimationFrame(clearWords);
  late = window.setTimeout(clearWords, 450);
}
let watcher: MutationObserver | null = null;
onMounted(() => {
  soon();
  const ui = document.querySelector(".ui");
  if (ui) {
    watcher = new MutationObserver(soon);
    watcher.observe(ui, { childList: true, subtree: true, characterData: true });
  }
  window.addEventListener("resize", soon);
});
onBeforeUnmount(() => {
  watcher?.disconnect();
  window.removeEventListener("resize", soon);
  cancelAnimationFrame(frame);
  clearTimeout(late);
});
const flies = Array.from({ length: 9 }, (_, i) => ({ x: 120 + ((i * 173) % 1360), y: 700 + ((i * 53) % 150) }));
const flyGroups = [0, 1].map((g) => flies.filter((_, i) => i % 2 === g));
</script>

<template>
  <div ref="el" class="nightsky" aria-hidden="true">
    <svg class="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="ns-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#060918" />
          <stop offset="0.45" stop-color="#111634" />
          <stop offset="0.68" stop-color="#261f48" />
          <stop offset="0.82" stop-color="#553252" />
          <stop offset="0.92" stop-color="#9a5650" />
          <stop offset="1" stop-color="#c8805a" />
        </linearGradient>
        <radialGradient id="ns-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#ffd890" stop-opacity="0.9" />
          <stop offset="1" stop-color="#ffd890" stop-opacity="0" />
        </radialGradient>
        <mask id="ns-moon">
          <circle cx="1270" cy="150" r="36" fill="#fff" />
          <circle cx="1286" cy="140" r="32" fill="#000" />
        </mask>
      </defs>
      <rect width="1600" height="900" fill="url(#ns-sky)" />
    </svg>
    <svg v-for="g in 3" :key="g" class="layer twinkle" :class="`t${g}`" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
      <template v-for="st in starGroups[g - 1]" :key="st.i">
        <circle v-if="!hidden.has(st.i)" :cx="st.x" :cy="st.y" :r="st.r" :opacity="st.o" fill="#fff6e0" />
      </template>
    </svg>
    <svg class="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
      <circle cx="1270" cy="150" r="36" fill="#fff2c8" mask="url(#ns-moon)" />
      <circle cx="1270" cy="150" r="70" fill="url(#ns-glow)" opacity="0.16" />
      <!-- Far hills, the shrine forest, the torii, the shrine hall and its steps. -->
      <path d="M0 700 C180 640 320 660 470 620 C620 585 760 640 900 610 C1060 575 1220 630 1380 600 C1480 585 1560 600 1600 610 L1600 900 L0 900 Z" fill="#221a38" />
      <path
        d="M0 760 C60 700 90 720 120 690 C150 720 190 680 230 700 C280 660 330 700 380 690 L420 760 Z M1000 760 C1040 690 1090 700 1130 670 C1180 690 1240 660 1290 690 C1350 670 1420 700 1480 690 C1540 700 1580 690 1600 700 L1600 760 Z"
        fill="#161126"
      />
      <g fill="#3a1624">
        <path d="M150 560 Q262 548 374 560 L384 543 Q262 528 140 543 Z" />
        <rect x="168" y="560" width="188" height="11" />
        <rect x="176" y="600" width="172" height="10" />
        <rect x="257" y="571" width="10" height="29" />
        <rect x="190" y="560" width="15" height="200" />
        <rect x="319" y="560" width="15" height="200" />
      </g>
      <g fill="#110d1e">
        <path d="M1010 650 Q1090 640 1160 580 Q1230 640 1310 650 L1296 662 L1024 662 Z" />
        <rect x="1052" y="662" width="216" height="98" />
        <rect x="1140" y="690" width="40" height="50" fill="#ffb46a" opacity="0.3" />
        <rect x="1080" y="690" width="30" height="36" fill="#ffb46a" opacity="0.18" />
        <rect x="1210" y="690" width="30" height="36" fill="#ffb46a" opacity="0.18" />
      </g>
      <path d="M0 760 L1600 760 L1600 900 L0 900 Z" fill="#0c0917" />
      <path d="M690 760 L910 760 L930 800 L670 800 Z M660 810 L940 810 L962 850 L638 850 Z M628 860 L972 860 L996 900 L604 900 Z" fill="#1a1430" />
    </svg>
    <svg v-for="g in 2" :key="g" class="layer flies" :class="`f${g}`" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
      <circle v-for="(fl, i) in flyGroups[g - 1]" :key="i" :cx="fl.x" :cy="fl.y" r="3" fill="#ffe7a0" />
    </svg>
  </div>
</template>

<style scoped>
.nightsky,
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.nightsky {
  background: #060918;
  pointer-events: none;
}
.twinkle {
  animation: twinkle calc(3.2s * var(--anim)) ease-in-out infinite alternate;
}
.t2 {
  animation-duration: calc(4.1s * var(--anim));
  animation-delay: calc(-1.3s * var(--anim));
}
.t3 {
  animation-duration: calc(2.7s * var(--anim));
  animation-delay: calc(-2.2s * var(--anim));
}
.flies {
  animation: drift calc(6s * var(--anim)) ease-in-out infinite alternate;
}
.f2 {
  animation-duration: calc(7.4s * var(--anim));
  animation-delay: calc(-3s * var(--anim));
  animation-direction: alternate-reverse;
}
@keyframes twinkle {
  from {
    opacity: 0.35;
  }
}
@keyframes drift {
  0% {
    transform: translate(0, 0);
    opacity: 0.2;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    transform: translate(18px, -26px);
    opacity: 0.3;
  }
}
</style>
