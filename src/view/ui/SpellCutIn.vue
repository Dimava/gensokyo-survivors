<script setup lang="ts">
// The spell card cut-in (refs/spellcards/STYLE.md §6): as a boss declares a
// card, a slanted band in her colour sweeps across the field carrying the
// card's sign in English ("ICE SIGN"), and her portrait glides through it from lower right to upper
// left and fades. Plays once per declared card, during the card's intro.
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { CHARACTERS } from "../../content/names.ts";
import { hex } from "./useGame.ts";
import { hud } from "./useRun.ts";
import { state } from "../host.ts";
import { splitSpell } from "./spellName.ts";
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
const ac = computed(() => (boss.value ? hex(CHARACTERS[boss.value.who].color) : "#fff"));
</script>

<template>
  <div v-if="shown && boss" :key="shown" class="cutin" :style="{ '--ac': ac }" aria-hidden="true">
    <div class="band">
      <span class="sign">{{ sign }}</span>
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
.band {
  position: absolute;
  left: -20%;
  right: -20%;
  top: 38%;
  height: 150px;
  rotate: -14deg;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.07) 0 2px, transparent 2px 9px),
    linear-gradient(180deg, transparent, color-mix(in srgb, var(--ac) 55%, transparent) 18%, color-mix(in srgb, var(--ac) 40%, rgba(10, 6, 20, 0.7)) 82%, transparent);
  border-block: 2px solid color-mix(in srgb, var(--ac) 40%, white);
  box-shadow: 0 0 24px color-mix(in srgb, var(--ac) 50%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: band calc(1.8s * var(--anim, 1)) cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.sign {
  font: 900 96px/1 Georgia, "Times New Roman", serif;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #fff;
  opacity: 0.16;
  white-space: nowrap;
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
