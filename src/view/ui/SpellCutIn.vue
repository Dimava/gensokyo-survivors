<script setup lang="ts">
// The spell card cut-in (refs/spellcards/STYLE.md §6): as a boss declares a
// card, a slanted band of dark glass in her colour crosses the field, two thin
// strips of small type running along its edges in opposite directions (the
// card's sign above, "Spell Card Attack" below, as in Touhou) and the sign's
// kanji faint inside; her portrait glides through it from lower right to upper
// left and fades. Plays once per declared card, during the card's intro.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { CHARACTERS } from "../../content/names.ts";
import { hex } from "./useGame.ts";
import { hud } from "./useRun.ts";
import { state } from "../host.ts";
import { signKanji, splitSpell } from "./spellName.ts";
import Portrait from "./Portrait.vue";

const boss = computed(() => hud.value?.boss ?? null);
// Waits for the field to be in view: the first card's intro starts under the boss dialogue.
const key = computed(() =>
  boss.value?.intro && hud.value?.overlay === "none" && !state.paused ? `${boss.value.name}#${boss.value.index}` : "",
);
const shown = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
watch(key, (k) => {
  if (!k || k === shown.value) return;
  shown.value = k;
  clearTimeout(timer);
  timer = setTimeout(() => (shown.value = ""), 1800);
});
onBeforeUnmount(() => clearTimeout(timer));
// The sign, or the name for cards without one ("Barrier Talisman").
const sign = computed(() => {
  const s = boss.value ? splitSpell(boss.value.spell) : null;
  return s ? s.sign || s.name : "";
});
const kanji = computed(() => (boss.value ? signKanji(splitSpell(boss.value.spell).sign) : ""));
/** One run of a strip's text, repeated wide enough to cross the band while it scrolls. */
const run = (t: string) => Array.from({ length: 14 }, () => t).join("  ·  ");
const ac = computed(() => (boss.value ? hex(CHARACTERS[boss.value.who].color) : "#fff"));
</script>

<template>
  <div v-if="shown && boss" :key="shown" class="cutin" :style="{ '--ac': ac }" aria-hidden="true">
    <div class="band">
      <div class="strip top"><span>{{ run(sign) }}</span></div>
      <span class="kanji">{{ kanji }}</span>
      <div class="strip bot"><span>{{ run("Spell Card Attack") }}</span></div>
    </div>
    <div class="who"><Portrait :who="boss.who" /></div>
  </div>
</template>

<style scoped>
.cutin.cutin {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
/* Dark glass tinted by her colour, flat, with a hairline edge: no glow. */
.band {
  position: absolute;
  left: -20%;
  right: -20%;
  top: 38%;
  height: 156px;
  rotate: -14deg;
  background: color-mix(in srgb, var(--ac) 26%, rgba(12, 9, 8, 0.62));
  border-block: 1px solid color-mix(in srgb, var(--ac) 55%, #f6f0e1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  animation: band calc(1.8s * var(--anim, 1)) cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.strip {
  height: 19px;
  background: rgba(12, 9, 8, 0.72);
  overflow: hidden;
  white-space: nowrap;
  font: 700 11px/19px var(--display);
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--ac) 45%, #f6f0e1);
}
.strip span {
  display: inline-block;
  animation: scroll calc(1.8s * var(--anim, 1)) linear both;
}
.strip.bot span {
  animation-direction: reverse;
}
.kanji {
  position: absolute;
  right: 30%;
  top: 50%;
  translate: 0 -50%;
  font: 700 104px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  letter-spacing: 0.1em;
  color: #f6f0e1;
  opacity: 0.13;
}
.who {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 240px;
  height: 340px;
  margin: -170px 0 0 -120px;
  /* The bust fades out at its cut edge, as Touhou's cut-ins do. */
  mask-image: linear-gradient(180deg, #000 62%, transparent 92%);
  animation: sweep calc(1.8s * var(--anim, 1)) cubic-bezier(0.15, 0.7, 0.35, 1) both;
}
@keyframes scroll {
  from {
    transform: translateX(-4%);
  }
  to {
    transform: translateX(-24%);
  }
}
@keyframes band {
  from {
    transform: translateX(80%) scaleY(0.3);
    opacity: 0;
  }
  15% {
    transform: translateX(0) scaleY(1);
    opacity: 1;
  }
  75% {
    transform: translateX(-4%);
    opacity: 1;
  }
  to {
    transform: translateX(-60%) scaleY(0.6);
    opacity: 0;
  }
}
@keyframes sweep {
  from {
    transform: translate(45vw, 30vh) scale(1.25);
    opacity: 0;
  }
  18% {
    transform: translate(12vw, 6vh) scale(1.3);
    opacity: 0.92;
  }
  75% {
    transform: translate(-4vw, -3vh) scale(1.3);
    opacity: 0.92;
  }
  to {
    transform: translate(-30vw, -20vh) scale(1.3);
    opacity: 0;
  }
}
</style>
