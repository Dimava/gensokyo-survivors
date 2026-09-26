<script setup lang="ts">
import { computed } from "vue";
import { host } from "../host.ts";
import { CARDS } from "../../content/cards.ts";
import { TREE } from "../../content/tree.ts";
import { CURRENCY, type CharacterId } from "../../content/names.ts";
import { STAGES, stageDef } from "../../content/stages.ts";
import { bossDef } from "../../content/bosses.ts";
import { fmtTime, gacha, lastRun, owned, profile, treeLevels, wallet } from "./useGame.ts";
import NavHints from "./NavHints.vue";
import Face from "./Face.vue";
import Hanko from "./Hanko.vue";

const nodes = computed(() => {
  const total = TREE.reduce((s, n) => s + n.costs.length, 0);
  const have = TREE.reduce((s, n) => s + (treeLevels.value[n.id] ?? 0), 0);
  return { have, total };
});
const last = computed(() => lastRun.value?.summary ?? null);
/** Each stage by its boss's face: cleared ones stamped 済, the rest in shadow. */
const stageFaces = computed(() =>
  STAGES.map((s) => ({ id: s.id, name: s.name, who: bossDef(s.boss).character as CharacterId, cleared: profile.value.cleared.includes(s.id) })),
);
</script>

<template>
  <div v-keynav class="screen">
    <div class="screen-head">
      <h1>Records</h1>
      <button class="btn back" @click="host.go('menu')">Back</button>
    </div>
    <div class="panel body">
      <h3>Best run</h3>
      <div class="grid best">
        <div class="stat"><span class="muted">Longest survival</span><b>{{ fmtTime(profile.bestSeconds) }}</b></div>
        <div class="stat"><span class="muted">Most kills</span><b>{{ profile.bestKills }}</b></div>
        <div class="stat"><span class="muted">Highest level</span><b>{{ profile.bestLevel }}</b></div>
      </div>
      <h3>All runs</h3>
      <div class="grid">
        <div class="stat"><span class="muted">Runs started</span><b>{{ profile.runs }}</b></div>
        <div class="stat"><span class="muted">Stage clears</span><b>{{ profile.clears }}</b></div>
        <div class="stat"><span class="muted">Enemies defeated</span><b>{{ profile.totalKills }}</b></div>
        <div class="stat"><span class="muted">{{ CURRENCY.name }} earned</span><b>{{ CURRENCY.icon }} {{ wallet.lifetime }}</b></div>
      </div>
      <h3>The shrine</h3>
      <div class="grid">
        <div class="stat">
          <span class="muted">Stages cleared</span>
          <span class="faces">
            <span v-for="s in stageFaces" :key="s.id" class="sf" :class="{ cleared: s.cleared }" :title="`${s.name}: ${s.cleared ? 'cleared' : 'not cleared yet'}`">
              <Face :who="s.who" :size="34" />
              <Hanko v-if="s.cleared" ch="済" class="done" />
            </span>
          </span>
        </div>
        <div class="stat"><span class="muted">Shrine upgrades</span><b>{{ nodes.have }} / {{ nodes.total }}</b></div>
        <div class="stat"><span class="muted">Cards collected</span><b>{{ owned.length }} / {{ CARDS.length }}</b></div>
        <div class="stat"><span class="muted">Card packs opened</span><b>{{ gacha.opened }}</b></div>
      </div>
      <h3>Last run</h3>
      <p v-if="last" class="lastrun">
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
  padding: 18px 26px 20px;
}
/* Three groups: the best run, all runs, and what the shrine holds. */
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.grid.best {
  grid-template-columns: repeat(3, 1fr);
}
/* A record is a row on a gold baseline, its number in the display serif. */
.stat {
  display: flex;
  flex-direction: column;
  padding: 6px 4px 6px;
  border-bottom: 1px solid rgba(232, 193, 90, 0.25);
}
.stat b {
  font-family: var(--display);
  font-size: 1.4rem;
}
.best .stat b {
  font-size: 1.75rem;
}
h3 {
  margin: 18px 0 2px;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--head);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
h3:first-child {
  margin-top: 0;
}
/* The stages as their bosses' faces: cleared ones stamped, the rest in shadow. */
.faces {
  display: flex;
  gap: 10px;
  padding: 4px 0 1px;
}
.sf {
  position: relative;
  display: inline-flex;
}
.sf:not(.cleared) :deep(.art) {
  filter: grayscale(1) brightness(0.45);
}
.sf:not(.cleared) :deep(.face) {
  border-color: rgba(214, 196, 140, 0.35);
}
.sf .done {
  position: absolute;
  right: -7px;
  bottom: -5px;
  width: 17px;
  height: 17px;
}
.lastrun {
  margin: 8px 0 0;
}
</style>
