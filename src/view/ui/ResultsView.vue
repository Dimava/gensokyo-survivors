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

const r = computed(() => lastRun.value?.summary ?? null);
const title = computed(() => (r.value?.outcome === "clear" ? "Stage Clear!" : r.value?.outcome === "quit" ? "Run Abandoned" : "Defeated"));
const rows = computed(() => {
  const c = r.value?.coins;
  if (!c) return [];
  return [
    { label: "Coins picked up", value: c.drops },
    { label: `Survival (1 per ${REWARD.perSeconds}s)`, value: c.survival },
    { label: `Kills (1 per ${REWARD.perKills})`, value: c.kills },
    { label: "Spell card bonuses", value: c.spells },
    { label: "Stage clear bonus", value: c.clear },
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

const RECORD_LABEL: Record<string, string> = { time: "Longest survival", kills: "Most kills", level: "Highest level", "first clear": "First stage clear" };
</script>

<template>
  <div v-keynav class="screen results">
    <div v-if="r" class="panel box" :class="r.outcome">
      <h1>{{ title }}</h1>
      <p class="muted">{{ stageDef(r.stage).name }}</p>
      <div v-if="lastRun && lastRun.records.length" class="records">
        <span v-for="rec in lastRun.records" :key="rec" class="rec">New record: {{ RECORD_LABEL[rec] ?? rec }}</span>
      </div>
      <div class="grid">
        <div class="stat"><span class="muted">Survived</span><b>{{ fmtTime(r.seconds) }}</b></div>
        <div class="stat"><span class="muted">Level</span><b>{{ r.level }}</b></div>
        <div class="stat"><span class="muted">Kills</span><b>{{ r.kills }}</b></div>
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
  box-shadow: 0 0 60px rgba(255, 201, 77, 0.25);
}
h1 {
  margin: 0;
  font-size: 2.3rem;
}
.clear h1 {
  color: #fff0c0;
}
.dead h1 {
  color: #ff9aac;
}
.records {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0;
}
.rec {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--gold);
  color: #2a1a00;
  font-weight: 700;
  font-size: 0.85rem;
  animation: pop calc(0.4s * var(--anim)) cubic-bezier(0.2, 1.5, 0.4, 1) both;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 16px 0;
}
.stat {
  display: flex;
  flex-direction: column;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.stat b {
  font-size: 1.3rem;
}
h3 {
  margin: 8px 0;
  color: var(--gold);
}
table {
  width: 100%;
  border-collapse: collapse;
}
td {
  padding: 4px 0;
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
  margin: 12px 0;
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
@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}
</style>
