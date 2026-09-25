<script setup lang="ts">
import { computed } from "vue";
import { host } from "../host.ts";
import { CARDS } from "../../content/cards.ts";
import { TREE } from "../../content/tree.ts";
import { CURRENCY } from "../../content/names.ts";
import { STAGES, stageDef } from "../../content/stages.ts";
import { fmtTime, gacha, lastRun, owned, profile, treeLevels, wallet } from "./useGame.ts";
import NavHints from "./NavHints.vue";

const nodes = computed(() => {
  const total = TREE.reduce((s, n) => s + n.costs.length, 0);
  const have = TREE.reduce((s, n) => s + (treeLevels.value[n.id] ?? 0), 0);
  return { have, total };
});
const last = computed(() => lastRun.value?.summary ?? null);
</script>

<template>
  <div v-keynav class="screen">
    <div class="screen-head">
      <h1>Records</h1>
      <button class="btn back" @click="host.go('menu')">Back</button>
    </div>
    <div class="panel body">
      <div class="grid">
        <div class="stat"><span class="muted">Runs started</span><b>{{ profile.runs }}</b></div>
        <div class="stat"><span class="muted">Stage clears</span><b>{{ profile.clears }}</b></div>
        <div class="stat"><span class="muted">Stages cleared</span><b>{{ profile.cleared.length }} / {{ STAGES.length }}</b></div>
        <div class="stat"><span class="muted">Longest survival</span><b>{{ fmtTime(profile.bestSeconds) }}</b></div>
        <div class="stat"><span class="muted">Most kills in a run</span><b>{{ profile.bestKills }}</b></div>
        <div class="stat"><span class="muted">Highest level</span><b>{{ profile.bestLevel }}</b></div>
        <div class="stat"><span class="muted">Enemies defeated, all runs</span><b>{{ profile.totalKills }}</b></div>
        <div class="stat"><span class="muted">{{ CURRENCY.name }} earned, all time</span><b>{{ CURRENCY.icon }} {{ wallet.lifetime }}</b></div>
        <div class="stat"><span class="muted">Shrine upgrade levels</span><b>{{ nodes.have }} / {{ nodes.total }}</b></div>
        <div class="stat"><span class="muted">Cards collected</span><b>{{ owned.length }} / {{ CARDS.length }}</b></div>
        <div class="stat"><span class="muted">Card packs opened</span><b>{{ gacha.opened }}</b></div>
      </div>
      <h3>Last run</h3>
      <p v-if="last">
        {{ stageDef(last.stage).name }}: {{ last.outcome === "clear" ? "cleared" : last.outcome === "dead" ? "defeated" : "abandoned" }} at {{ fmtTime(last.seconds) }}, level {{ last.level }},
        {{ last.kills }} kills, {{ last.spellsCaptured }} spell cards captured, {{ CURRENCY.icon }} {{ last.coins.total }} earned.
      </p>
      <p v-else class="muted">No runs yet.</p>
    </div>
    <NavHints />
  </div>
</template>

<style scoped>
.body {
  width: min(800px, 94vw);
  padding: 22px 26px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.stat {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.stat b {
  font-size: 1.4rem;
}
h3 {
  margin: 20px 0 6px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--head);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
</style>
