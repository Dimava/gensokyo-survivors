<script setup lang="ts">
import { computed } from "vue";
import { CARD_KINDS, cardDef, cardText, RARITY_INFO } from "../../content/cards.ts";
import { cardIcon } from "./cardIcons.ts";
import { CHARACTERS } from "../../content/names.ts";
import { hex } from "./useGame.ts";

const props = defineProps<{ card: string; level: number; unknown?: boolean }>();
const def = computed(() => cardDef(props.card));
</script>

<template>
  <div class="face" :class="['rarity-' + def.rarity, { unknown }]">
    <div class="top">
      <span class="rar">{{ def.rarity }}</span>
      <span class="cost" :title="`Costs ${def.cost} Spirit`"><i v-for="n in def.cost" :key="n"></i></span>
    </div>
    <div class="art" :style="{ '--c': hex(CHARACTERS[def.owner].color), '--kc': CARD_KINDS[def.kind].css }">
      <span v-if="unknown">?</span>
      <svg
        v-else
        class="glyph"
        viewBox="0 0 24 24"
        fill="currentColor"
        v-html="cardIcon(def.id)"
      ></svg>
    </div>
    <div class="name">{{ unknown ? "Unknown card" : def.name }}</div>
    <div class="owner muted">{{ unknown ? RARITY_INFO[def.rarity].label : `${CARD_KINDS[def.kind].label} · ${CHARACTERS[def.owner].short} · ${RARITY_INFO[def.rarity].label}` }}</div>
    <div class="text">{{ unknown ? "Not collected yet. Find it in Card Packs." : cardText(def, level) }}</div>
    <div v-if="!unknown" class="lvl">
      Lv <i v-for="n in 3" :key="n" :class="{ on: n <= level }"></i>
    </div>
  </div>
</template>

<style scoped>
.face {
  width: 170px;
  height: 250px;
  padding: 10px;
  border-radius: 12px;
  border: 2px solid var(--rc);
  background: linear-gradient(180deg, rgba(40, 46, 86, 0.98), rgba(16, 20, 42, 0.98));
  box-shadow: 0 0 18px color-mix(in srgb, var(--rc) 35%, transparent);
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
  position: relative;
}
.face.unknown {
  filter: grayscale(0.8) brightness(0.7);
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.rar {
  font-weight: 900;
  color: var(--rc);
  letter-spacing: 0.05em;
}
.cost {
  display: flex;
  gap: 3px;
}
.cost i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6fd3ff;
  box-shadow: 0 0 6px #6fd3ff;
}
.art {
  height: 72px;
  border-radius: 8px;
  background:
    radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--c) 90%, white) 0 18%, transparent 19%),
    radial-gradient(circle at 50% 40%, var(--c) 0 34%, transparent 35%),
    repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--rc) 25%, transparent) 0 10deg, transparent 10deg 20deg),
    #0e1328;
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 900;
}
.glyph {
  width: 52px;
  height: 52px;
  padding: 8px;
  border-radius: 50%;
  background: var(--kc);
  color: #0b0f22;
  box-shadow: 0 0 14px var(--kc);
}
.name {
  font-weight: 800;
  font-size: 0.9rem;
  line-height: 1.15;
}
.owner {
  font-size: 0.75rem;
}
.text {
  font-size: 0.78rem;
  color: #d0d6ee;
  line-height: 1.25;
}
.lvl {
  margin-top: auto;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 3px;
  color: var(--muted);
}
.lvl i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--gold);
}
.lvl i.on {
  background: var(--gold);
}
</style>
