<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { host } from "../host.ts";
import { audio } from "../audio.ts";
import { prefs } from "../prefs.ts";
import { CURRENCY } from "../../content/names.ts";
import { stageDef } from "../../content/stages.ts";
import { REWARD } from "../../sim/tuning.ts";
import { affordableNodes, fmtTime, lastRun, wallet } from "./useGame.ts";
import NavHints from "./NavHints.vue";
import Hanko from "./Hanko.vue";

const r = computed(() => lastRun.value?.summary ?? null);
const title = computed(() => (r.value?.outcome === "clear" ? "Stage Clear!" : r.value?.outcome === "quit" ? "Run Abandoned" : "Defeated"));
const rows = computed(() => {
  const c = r.value?.coins;
  if (!c) return [];
  return [
    { label: "Coins picked up", value: c.drops },
    { label: `Surviving the swarm (1 per ${REWARD.perSeconds}s)`, value: c.survival },
    { label: `Kills (1 per ${REWARD.perKills})`, value: c.kills },
    { label: "Spell card bonuses", value: c.spells },
  ];
});

// Count the total up, with a tick sound, at the animation speed.
const shown = ref(0);
let timer = 0;
onMounted(() => {
  const total = r.value?.coins.total ?? 0;
  const steps = Math.min(40, Math.max(1, total));
  let i = 0;
  timer = window.setInterval(
    () => {
      i++;
      shown.value = Math.round((total * i) / steps);
      if (i % 2 === 0) audio.play("coin", { vol: 0.5 });
      if (i >= steps) {
        clearInterval(timer);
        if (total > 0) audio.play("buy");
      }
    },
    35 / prefs.animSpeed,
  );
});
onBeforeUnmount(() => clearInterval(timer));

/** A record is stamped on the number it beat (a 新 seal), a first clear beside the stage's name (初). */
const rec = (k: string): boolean => !!lastRun.value?.records.includes(k);
</script>

<template>
  <div v-keynav class="screen results">
    <div v-if="r" class="panel box" :class="r.outcome">
      <h1>{{ title }}</h1>
      <p class="stage">
        {{ stageDef(r.stage).name }}<span v-if="rec('first clear')" class="first"><Hanko ch="初" />first clear</span>
      </p>
      <div class="grid">
        <div class="stat">
          <span class="muted">Survived</span><b>{{ fmtTime(r.seconds) }}<span v-if="rec('time')" class="new"><Hanko ch="新" />record</span></b>
        </div>
        <div class="stat">
          <span class="muted">Level</span><b>{{ r.level }}<span v-if="rec('level')" class="new"><Hanko ch="新" />record</span></b>
        </div>
        <div class="stat">
          <span class="muted">Kills</span><b>{{ r.kills }}<span v-if="rec('kills')" class="new"><Hanko ch="新" />record</span></b>
        </div>
        <div class="stat"><span class="muted">Grazes</span><b>{{ r.grazes }}</b></div>
        <div class="stat"><span class="muted">Cards played</span><b>{{ r.cardsPlayed }}</b></div>
        <div class="stat"><span class="muted">Spells captured</span><b>{{ r.spellsCaptured }} / {{ r.spellsTotal }}</b></div>
      </div>
      <h3>{{ CURRENCY.name }} earned</h3>
      <table>
        <tbody>
          <tr v-for="row in rows" :key="row.label" :class="{ zero: !row.value }">
            <td>{{ row.label }}</td>
            <td>{{ CURRENCY.icon }} {{ row.value }}</td>
          </tr>
          <tr v-if="r.coins.greed !== 1">
            <td>Greed multiplier</td>
            <td>×{{ r.coins.greed }}</td>
          </tr>
          <tr class="total">
            <td>Total</td>
            <td>{{ CURRENCY.icon }} {{ shown }}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted balance">You now have {{ CURRENCY.icon }} {{ wallet.coins }}.<span v-if="affordableNodes"> You can afford {{ affordableNodes }} shrine upgrade{{ affordableNodes > 1 ? "s" : "" }}.</span></p>
      <div class="buttons">
        <button class="btn back" @click="host.go('menu')">Main Menu</button>
        <button class="btn primary" @click="host.startRun(r.stage)">Play again</button>
        <button class="btn" :class="{ gold: affordableNodes > 0 }" @click="host.go('tree')">Shrine Upgrades</button>
      </div>
    </div>
    <div v-else class="panel box">
      <h1>No results yet</h1>
      <button class="btn back" @click="host.go('menu')">Main Menu</button>
    </div>
    <NavHints back="main menu" />
  </div>
</template>

<style scoped>
.results {
  justify-content: safe center;
}
.box {
  width: min(560px, 94vw);
  padding: 24px 28px;
  animation: rise calc(0.5s * var(--anim)) cubic-bezier(0.2, 1.2, 0.4, 1) both;
}
.box.clear {
  border-color: var(--gold);
}
h1 {
  margin: 0;
  font-size: 2.3rem;
}
.clear h1 {
  color: #e8c15a;
}
.dead h1 {
  color: #e8604a;
}
/* The stage, as the HUD names it: straw italic in the display face. */
.stage {
  margin: 2px 0 0;
  font-family: var(--display);
  font-style: italic;
  color: #d6c48c;
}
/* A record is stamped on its number: a small 新 seal and the word, in straw caps.
   The seals land one after another as the panel settles. */
.new,
.first {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 10px;
  font-family: "Segoe UI", system-ui, sans-serif;
  font-style: normal;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d6c48c;
  vertical-align: 0.2em;
}
.new :deep(.hanko),
.first :deep(.hanko) {
  width: 20px;
  height: 20px;
  animation: stamp calc(0.32s * var(--anim)) cubic-bezier(0.3, 1.6, 0.5, 1) both;
}
.first {
  margin-left: 12px;
}
.first :deep(.hanko) {
  animation-delay: calc(0.35s * var(--anim));
}
.stat:nth-child(1) .new :deep(.hanko) {
  animation-delay: calc(0.55s * var(--anim));
}
.stat:nth-child(2) .new :deep(.hanko) {
  animation-delay: calc(0.7s * var(--anim));
}
.stat:nth-child(3) .new :deep(.hanko) {
  animation-delay: calc(0.85s * var(--anim));
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 12px 0;
}
.stat {
  display: flex;
  flex-direction: column;
  padding: 4px 4px 5px;
  border-bottom: 1px solid rgba(232, 193, 90, 0.25);
}
.stat b {
  font-family: var(--display);
  font-size: 1.3rem;
}
h3 {
  margin: 8px 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--head);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
table {
  width: 100%;
  border-collapse: collapse;
}
td {
  padding: 2px 0;
}
td:last-child {
  text-align: right;
  font-weight: 700;
}
tr.zero {
  opacity: 0.5;
}
tr.total td {
  border-top: 1px solid var(--line);
  padding-top: 8px;
  font-size: 1.3rem;
  color: var(--gold);
}
.balance {
  margin: 8px 0 10px;
}
.buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
}
/* A stamp comes down from a little above, a touch too big, and settles. */
@keyframes stamp {
  from {
    scale: 1.8;
    opacity: 0;
  }
  60% {
    opacity: 1;
  }
}
</style>
