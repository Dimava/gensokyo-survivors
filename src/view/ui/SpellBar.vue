<script setup lang="ts">
// The boss's spell card name bar, Touhou style (refs/spellcards/STYLE.md §6):
// it slides in from the right when a card is declared, the sign small in her
// colour beside 「name」 in the display serif, on a lacquer plate with a stripe
// of her colour at its leading edge, a hairline under it and the capture bonus
// below. Keyed by the card index, so each card slides in anew.
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
  padding: 4px 14px 5px 22px;
  display: flex;
  align-items: baseline;
  gap: 10px;
  background: rgba(20, 15, 12, 0.9);
  border-left: 4px solid var(--ac);
}
.sign {
  font: 700 10px/1 var(--display);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--ac2);
  white-space: nowrap;
}
.nm {
  font: 700 18px/1.15 var(--display);
  color: #f6f0e1;
  white-space: nowrap;
}
.nm b {
  color: #e5532d;
  font-weight: 700;
}
.sub {
  margin-top: 2px;
  padding: 1px 14px 0 30px;
  border-top: 1px solid rgba(232, 193, 90, 0.55);
  font: 600 11px/1.3 "Segoe UI", system-ui, sans-serif;
  color: #d6cdb8;
  text-shadow: 0 1px 2px #000;
}
.sub b {
  color: #e8c15a;
  font-variant-numeric: tabular-nums;
}
.late .sub {
  color: #e5532d;
}
.late .plate {
  filter: saturate(0.4) brightness(0.8);
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
</style>
