<script setup lang="ts">
import { computed } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { STAT_DEFS, STAT_KEYS, formatStat } from "../../content/stats.ts";
import { CURRENCY } from "../../content/names.ts";
import { hud } from "./useRun.ts";
import { fmtTime } from "./useGame.ts";
import SettingsPanel from "./SettingsPanel.vue";
import HelpPanel from "./HelpPanel.vue";
import Keys from "./Keys.vue";
import NavHints from "./NavHints.vue";

const h = computed(() => hud.value);

function resume(): void {
  state.paused = false;
  state.pausePage = "main";
  audio.play("ui");
}
function page(p: typeof state.pausePage): void {
  state.pausePage = p;
  audio.play("ui");
}
function quit(): void {
  host.abandonRun();
}
</script>

<template>
  <div class="pause">
    <div v-if="state.pausePage === 'main'" v-keynav="{ id: 'pause' }" class="panel box">
      <h2>Paused</h2>
      <div class="cols">
        <div class="menu">
          <button class="btn primary" @click="resume">Resume <Keys for="Action:pause" /></button>
          <button class="btn" @click="page('settings')">Settings</button>
          <button class="btn" @click="page('help')">How to Play</button>
          <button class="btn" @click="page('quit')">Quit run…</button>
        </div>
        <div v-if="h" class="stats">
          <div class="row"><span class="muted">Time</span><b>{{ fmtTime(h.seconds) }}</b></div>
          <div class="row"><span class="muted">Level</span><b>{{ h.level }}</b></div>
          <div class="row"><span class="muted">Kills</span><b>{{ h.kills }}</b></div>
          <div class="row"><span class="muted">{{ CURRENCY.name }} so far</span><b>{{ CURRENCY.icon }} {{ h.coins }}</b></div>
          <h4>Your stats</h4>
          <div v-for="k in STAT_KEYS" :key="k" class="row" :title="STAT_DEFS[k].help">
            <span class="muted">{{ STAT_DEFS[k].label }}</span><b>{{ formatStat(k, h.stats[k]) }}</b>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="state.pausePage === 'settings'" v-keynav class="panel box wide">
      <h2>Settings</h2>
      <SettingsPanel in-run />
      <button class="btn back" @click="page('main')">Back <Keys for="Back" /></button>
    </div>
    <div v-else-if="state.pausePage === 'help'" v-keynav class="panel box wide scroll">
      <h2>How to Play</h2>
      <HelpPanel />
      <button class="btn back" @click="page('main')">Back <Keys for="Back" /></button>
    </div>
    <div v-else v-keynav class="panel box">
      <h2>Quit this run?</h2>
      <p>You keep the {{ CURRENCY.name }} earned so far (time, kills and coins). The run counts as retreated.</p>
      <div class="menu row2">
        <button class="btn primary" @click="quit">Quit run</button>
        <button class="btn" data-autofocus @click="page('main')">Keep playing</button>
      </div>
    </div>
    <NavHints :back="state.pausePage === 'main' ? 'resume' : 'back'" />
  </div>
</template>

<style scoped>
.pause {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(4, 6, 16, 0.55);
  animation: fadein calc(0.2s * var(--anim)) both;
}
.box {
  padding: 22px 26px;
  min-width: 360px;
  max-width: 94vw;
}
.box.wide {
  width: min(760px, 94vw);
}
.scroll {
  max-height: 88vh;
  overflow: auto;
}
h2 {
  margin: 0 0 14px;
}
.cols {
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
}
.menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
}
.row2 {
  flex-direction: row;
}
.stats {
  min-width: 240px;
  font-size: 0.9rem;
}
.stats h4 {
  margin: 12px 0 6px;
  color: var(--cyan);
  text-transform: uppercase;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0;
}
.back {
  margin-top: 16px;
}
@keyframes fadein {
  from {
    opacity: 0;
  }
}
</style>
