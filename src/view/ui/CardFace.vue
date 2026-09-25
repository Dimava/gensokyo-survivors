<script setup lang="ts">
// A skill card after Scarlet Weather Rhapsody's deck cards (refs/spellcards/
// STYLE.md): a metal rim whose metal is the rarity, a black field between a
// red-orange mist band and a crimson-violet one (stepped kasumi bands), and a
// glowing emblem in the card kind's colour with SWR's chevrons for the level.
// What SWR cards lack, ours add as a shrine talisman: an ofuda paper strip
// with the name set as sign and 「name」, stamped with the owner's seal.
import { computed } from "vue";
import { CARD_KINDS, cardDef, cardText, RARITY_INFO } from "../../content/cards.ts";
import { cardIcon } from "./cardIcons.ts";
import { CHARACTERS } from "../../content/names.ts";
import { hex } from "./useGame.ts";
import { SEAL_KANJI, signKanji, splitSpell } from "./spellName.ts";

const props = defineProps<{ card: string; level: number; unknown?: boolean }>();
const def = computed(() => cardDef(props.card));
const spell = computed(() => splitSpell(def.value.name));
const vars = computed(() => ({
  "--ac": hex(CHARACTERS[def.value.owner].color),
  "--kc": CARD_KINDS[def.value.kind].css,
}));
</script>

<template>
  <div class="face" :class="['rarity-' + def.rarity, { unknown }]" :style="vars">
    <svg class="field" viewBox="0 0 170 250" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="cf-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff8a2e" />
          <stop offset="0.55" stop-color="#e0301f" />
          <stop offset="1" stop-color="#8a1020" />
        </linearGradient>
        <linearGradient id="cf-bot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d0203e" />
          <stop offset="0.45" stop-color="#a8287a" />
          <stop offset="1" stop-color="#4a2380" />
        </linearGradient>
      </defs>
      <!-- Stepped kasumi mist bands, two layers each. -->
      <path fill="url(#cf-top)" d="M0 0H170V26H148V36H104V30H66V40H26V32H0Z" />
      <path fill="#ffb347" opacity="0.35" d="M0 8H44V14H92V9H170V16H120V21H58V17H0Z" />
      <path fill="url(#cf-bot)" d="M0 250V176H22V168H74V178H118V166H170V250Z" />
      <path fill="#ff6aa8" opacity="0.28" d="M0 196H40V190H98V197H170V204H112V210H30V204H0Z" />
      <path fill="#2a0e45" opacity="0.5" d="M0 232H56V226H132V234H170V250H0Z" />
    </svg>
    <div class="wm" aria-hidden="true">{{ unknown ? "符" : signKanji(spell.sign) }}</div>
    <svg class="brk" viewBox="0 0 170 250" aria-hidden="true">
      <path d="M5 20V5h15M165 20V5h-15M5 230v15h15M165 230v15h-15" />
    </svg>

    <div class="top">
      <span class="rar" :title="RARITY_INFO[def.rarity].label">{{ def.rarity }}</span>
      <span class="cost" :title="`Costs ${def.cost} Spirit`"><i v-for="n in def.cost" :key="n"></i></span>
    </div>
    <div class="emblem">
      <span v-if="unknown" class="disc q">?</span>
      <svg v-else class="disc" viewBox="0 0 24 24" fill="currentColor" v-html="cardIcon(def.id)"></svg>
      <svg v-if="!unknown" class="chev" viewBox="0 0 14 24" :aria-label="`Level ${level}`">
        <path v-for="n in 3" :key="n" :class="{ on: 4 - n <= level }" :d="`M1 ${n * 7 + 1}l6-5 6 5`" />
      </svg>
    </div>
    <div class="strip">
      <div class="sign">{{ unknown ? "Unknown" : spell.sign || CARD_KINDS[def.kind].label }}</div>
      <div class="name"><b>「</b>{{ unknown ? "? ? ?" : spell.name }}<b>」</b></div>
      <span class="seal" :title="CHARACTERS[def.owner].name">{{ unknown ? "?" : SEAL_KANJI[def.owner] }}</span>
    </div>
    <div class="text">{{ unknown ? "Not collected yet. Find it in Card Packs." : cardText(def, level) }}</div>
    <div class="owner">
      {{ unknown ? RARITY_INFO[def.rarity].label : `${CARD_KINDS[def.kind].label} · ${CHARACTERS[def.owner].short} · ${RARITY_INFO[def.rarity].label}` }}
    </div>
  </div>
</template>

<style scoped>
.face {
  --ink: #1b1512;
  --paper: #f4ecd8;
  --seal: #d23a2a;
  /* The rim metal: the rarity (SWR: silver system cards, gold spell cards). */
  --m1: #eef0f4;
  --m2: #9aa0ac;
  --m3: #50555f;
  width: 170px;
  height: 250px;
  position: relative;
  padding: 8px 9px 7px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 5px;
  text-align: left;
  color: #f2eee6;
  border-radius: 4px;
  overflow: hidden;
  background: #07060c;
  /* A bevelled metal rim: light top-left, dark bottom-right, a dark inner line. */
  box-shadow:
    inset 0 0 0 1px var(--m3),
    inset 2px 2px 0 1px var(--m1),
    inset -2px -2px 0 1px var(--m3),
    inset 0 0 0 4px var(--m2),
    inset 0 0 0 5px #000,
    0 4px 12px rgba(0, 0, 0, 0.55);
}
.rarity-R {
  --m1: #d6ecff;
  --m2: #4d8fd6;
  --m3: #1f3f73;
}
.rarity-SR {
  --m1: #fff1c2;
  --m2: #c9962e;
  --m3: #6e4a10;
}
.rarity-SSR {
  --m1: #fffbe0;
  --m2: #f0c040;
  --m3: #8a5a08;
  box-shadow:
    inset 0 0 0 1px var(--m3),
    inset 2px 2px 0 1px var(--m1),
    inset -2px -2px 0 1px var(--m3),
    inset 0 0 0 4px var(--m2),
    inset 0 0 0 5px #000,
    0 4px 12px rgba(0, 0, 0, 0.55),
    0 0 16px rgba(255, 201, 77, 0.55);
}
.face.unknown {
  filter: grayscale(0.85) brightness(0.65);
}
.field,
.brk {
  position: absolute;
  inset: 5px;
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  pointer-events: none;
}
.brk {
  display: none;
  fill: none;
  stroke: var(--m1);
  stroke-width: 2;
}
.rarity-SSR .brk {
  display: block;
}
.wm {
  position: absolute;
  left: 10px;
  top: 40px;
  writing-mode: vertical-rl;
  font: 900 34px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #fff;
  opacity: 0.1;
  pointer-events: none;
}
.top,
.emblem,
.strip,
.text,
.owner {
  position: relative;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 15px;
}
.rar {
  font: 900 10px/1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.06em;
  padding: 2px 4px;
  border-radius: 2px;
  color: #1a1206;
  background: linear-gradient(180deg, var(--m1), var(--m2));
  box-shadow: 0 0 0 1px var(--m3);
}
.cost {
  display: flex;
  gap: 3px;
}
.cost i {
  /* SWR's blue spirit orbs. */
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff 0 12%, #8fdcff 25%, #2a8fe0 60%, #0d3f86);
  box-shadow: 0 0 5px rgba(111, 211, 255, 0.8);
}
.emblem {
  height: 70px;
  display: grid;
  place-items: center;
}
.disc {
  width: 56px;
  height: 56px;
  padding: 9px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--kc) 55%, white), var(--kc) 70%);
  color: #0b0a12;
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.7),
    0 0 0 4px color-mix(in srgb, var(--kc) 60%, transparent),
    0 0 18px 4px var(--kc);
}
.disc.q {
  display: grid;
  place-items: center;
  font: 900 30px/1 Georgia, serif;
}
.chev {
  position: absolute;
  left: calc(50% + 32px);
  bottom: 2px;
  width: 14px;
  height: 24px;
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.chev path {
  stroke: rgba(255, 255, 255, 0.18);
}
.chev path.on {
  stroke: var(--kc);
  filter: drop-shadow(0 0 2px var(--kc));
}
.strip {
  /* The ofuda: a washi label, ink rules, the name, the owner's seal. */
  margin: 0 -2px;
  padding: 4px 22px 5px 8px;
  text-align: center;
  color: var(--ink);
  background:
    repeating-linear-gradient(90deg, rgba(150, 128, 90, 0.08) 0 1px, transparent 1px 4px, rgba(150, 128, 90, 0.05) 4px 5px, transparent 5px 9px),
    linear-gradient(180deg, #fbf6ea, var(--paper) 55%, #e8dcc0);
  box-shadow:
    inset 0 0 0 1px rgba(27, 21, 18, 0.6),
    inset 0 0 0 3px var(--paper),
    inset 0 0 0 4px color-mix(in oklab, var(--ac) 70%, var(--ink)),
    0 2px 5px rgba(0, 0, 0, 0.6);
}
.sign {
  font: 700 8.5px/1.1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--ac) 70%, var(--ink));
}
.name {
  font: 700 13.5px/1.15 Georgia, "Yu Mincho", "Times New Roman", serif;
  margin-top: 1px;
}
.name b {
  color: var(--seal);
  font-weight: 700;
}
.seal {
  /* The owner's vermilion stamp, pressed on at a slight angle. */
  position: absolute;
  right: 4px;
  bottom: 4px;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  rotate: -8deg;
  font: 900 13px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: var(--seal);
  border: 1.5px solid var(--seal);
  border-radius: 2px;
  mix-blend-mode: multiply;
  opacity: 0.9;
}
.text {
  flex: 1;
  padding: 5px 6px;
  border-radius: 3px;
  font: 500 11px/1.28 "Segoe UI", system-ui, sans-serif;
  color: #f4f0f8;
  background: rgba(8, 4, 16, 0.62);
  text-shadow: 0 1px 1px #000;
}
.owner {
  font: 700 9px/1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.04em;
  text-align: center;
  color: rgba(255, 236, 250, 0.85);
  text-shadow: 0 1px 2px #000;
}
</style>
