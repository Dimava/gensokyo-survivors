<script setup lang="ts">
import { ref } from "vue";
import { prefs } from "../prefs.ts";
import { audio } from "../audio.ts";
import { host } from "../host.ts";

defineProps<{ inRun?: boolean }>();

const confirmErase = ref(false);
const pct = (v: number): string => `${Math.round(v * 100)}%`;

function test(): void {
  audio.unlock();
  audio.play("levelup");
}
function resetHints(): void {
  prefs.seen = [];
  prefs.hints = true;
  audio.play("chime");
}
function erase(): void {
  confirmErase.value = false;
  host.eraseEverything();
  audio.play("back");
}
</script>

<template>
  <div class="settings">
    <section>
      <h3>Sound</h3>
      <label>
        <span>Master volume</span>
        <input v-model.number="prefs.master" type="range" min="0" max="1" step="0.05" @change="test" />
        <b>{{ pct(prefs.master) }}</b>
      </label>
      <label>
        <span>Sound effects</span>
        <input v-model.number="prefs.sfx" type="range" min="0" max="1" step="0.05" @change="test" />
        <b>{{ pct(prefs.sfx) }}</b>
      </label>
      <label>
        <span>Music</span>
        <input v-model.number="prefs.music" type="range" min="0" max="1" step="0.05" />
        <b>{{ pct(prefs.music) }}</b>
      </label>
    </section>
    <section>
      <h3>Motion</h3>
      <label>
        <span>Animation speed</span>
        <input v-model.number="prefs.animSpeed" type="range" min="0.5" max="2" step="0.25" />
        <b>{{ prefs.animSpeed }}×</b>
      </label>
      <p class="help muted">How fast menus, cards and effects animate. The game itself always runs at the same speed.</p>
      <label>
        <span>Screen shake</span>
        <input v-model.number="prefs.shake" type="range" min="0" max="1" step="0.1" />
        <b>{{ pct(prefs.shake) }}</b>
      </label>
    </section>
    <section>
      <h3>Interface</h3>
      <label class="check">
        <input v-model="prefs.hints" type="checkbox" />
        <span>Show tutorial hints during runs</span>
      </label>
      <label class="check">
        <input v-model="prefs.fps" type="checkbox" />
        <span>Show frame rate and simulation cost</span>
      </label>
      <button class="btn small" @click="resetHints">Replay the tutorial hints</button>
    </section>
    <section v-if="!inRun">
      <h3>Save data</h3>
      <p class="help muted">Progress saves automatically in this browser.</p>
      <button v-if="!confirmErase" class="btn small" @click="confirmErase = true">Erase all progress…</button>
      <div v-else class="confirm">
        <span>Erase donations, upgrades, cards and records? This cannot be undone.</span>
        <button class="btn small primary" @click="erase">Erase everything</button>
        <button class="btn small" @click="confirmErase = false">Keep my progress</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h3 {
  margin: 0 0 4px;
  font-size: 1rem;
  color: var(--cyan);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
label {
  display: grid;
  grid-template-columns: 170px 1fr 56px;
  gap: 12px;
  align-items: center;
}
label b {
  text-align: right;
}
label.check {
  display: flex;
  gap: 10px;
}
section > .btn {
  align-self: flex-start;
}
.help {
  margin: 0;
  font-size: 0.85rem;
}
.confirm {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 92, 122, 0.6);
  background: rgba(255, 92, 122, 0.08);
}
</style>
