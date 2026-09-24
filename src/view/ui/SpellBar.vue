<script setup lang="ts">
// The boss's spell card name bar, Touhou style (refs/spellcards/STYLE.md §6):
// it slides in from the right when a card is declared, the sign small over
// 「name」 in outlined white serif, on a bar that runs from clear through the
// boss's colour to dark with halftone dots at the end, a hairline under it and
// the capture bonus below. Keyed by the card index, so each card slides in anew.
import { computed } from "vue";
import { CHARACTERS, CURRENCY, type CharacterId } from "../../content/names.ts";
import { hex } from "./useGame.ts";
import { splitSpell } from "./spellName.ts";

const props = defineProps<{ who: CharacterId; spell: string; index: number; bonus: number; late: boolean; intro: boolean }>();
const parts = computed(() => splitSpell(props.spell));
const ac = computed(() => hex(CHARACTERS[props.who].color));
</script>

<template>
  <div :key="index" class="sbar" :class="{ intro, late }" :style="{ '--ac': ac }">
    <div class="plate">
      <span v-if="parts.sign" class="sign">{{ parts.sign }}</span>
      <span class="nm"><b>「</b>{{ parts.name }}<b>」</b></span>
    </div>
    <div class="sub">
      <template v-if="late">Bonus failed</template>
      <template v-else>Bonus <b>{{ CURRENCY.icon }} {{ bonus }}</b></template>
    </div>
  </div>
</template>

<style scoped>
.sbar {
  --ac2: color-mix(in oklab, var(--ac) 55%, #fff);
  margin: 6px -12px 0 auto;
  width: fit-content;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  animation: declare calc(0.55s * var(--anim, 1)) cubic-bezier(0.2, 0.9, 0.25, 1) both;
}
.plate {
  position: relative;
  padding: 3px 14px 4px 48px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ac) 70%, transparent) 30%, color-mix(in srgb, var(--ac) 45%, #120812) 75%, #0c0610);
  clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%);
}
.plate::after {
  /* Halftone dots fading in toward the bar's right end. */
  content: "";
  position: absolute;
  inset: 0 0 0 55%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.28) 0.9px, transparent 1.5px) 0 0 / 5px 5px;
  mask-image: linear-gradient(90deg, transparent, #000);
  pointer-events: none;
}
.sign {
  font: 700 10px/1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ac2);
  text-shadow: 0 1px 2px #000;
  white-space: nowrap;
}
.nm {
  font: 700 17px/1.15 Georgia, "Yu Mincho", "Times New Roman", serif;
  color: #fff;
  white-space: nowrap;
  text-shadow:
    0 0 2px #000,
    1px 1px 0 #000,
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000;
}
.nm b {
  color: #ff8a8a;
  font-weight: 700;
}
.sub {
  margin-top: 2px;
  padding: 1px 14px 0 30px;
  border-top: 1px solid color-mix(in srgb, var(--ac2) 70%, transparent);
  font: 600 11px/1.3 "Segoe UI", system-ui, sans-serif;
  color: #e8e2f0;
  text-shadow: 0 1px 2px #000;
}
.sub b {
  color: var(--gold, #ffc94d);
  font-variant-numeric: tabular-nums;
}
.late .sub {
  color: var(--red-2, #ff5c7a);
}
.late .plate {
  filter: saturate(0.4) brightness(0.8);
}
.intro .plate {
  animation: flash calc(0.9s * var(--anim, 1)) ease-out 0.4s both;
}
@keyframes declare {
  from {
    transform: translateX(70vw);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  to {
    transform: none;
  }
}
@keyframes flash {
  from {
    filter: brightness(1.9);
  }
  to {
    filter: none;
  }
}
</style>
