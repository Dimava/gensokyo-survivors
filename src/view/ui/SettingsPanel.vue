<script setup lang="ts">
import { ref } from "vue";
import { prefs } from "../prefs.ts";
import { audio } from "../audio.ts";
import { host } from "../host.ts";

defineProps<{ inRun?: boolean }>();

const confirmErase = ref(false);
const pct = (v: number): string => `${Math.round(v * 100)}%`;
/** How far a slider is filled (its vermilion cord). */
const fill = (v: number, min = 0, max = 1): Record<string, string> => ({ "--v": `${((v - min) / (max - min)) * 100}%` });

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
        <input v-model.number="prefs.master" :style="fill(prefs.master)" type="range" min="0" max="1" step="0.05" @change="test" />
        <b>{{ pct(prefs.master) }}</b>
      </label>
      <label>
        <span>Sound effects</span>
        <input v-model.number="prefs.sfx" :style="fill(prefs.sfx)" type="range" min="0" max="1" step="0.05" @change="test" />
        <b>{{ pct(prefs.sfx) }}</b>
      </label>
      <label>
        <span>Music</span>
        <input v-model.number="prefs.music" :style="fill(prefs.music)" type="range" min="0" max="1" step="0.05" />
        <b>{{ pct(prefs.music) }}</b>
      </label>
    </section>
    <section>
      <h3>Motion</h3>
      <label>
        <span>Animation speed</span>
        <input v-model.number="prefs.animSpeed" :style="fill(prefs.animSpeed, 0.5, 2)" type="range" min="0.5" max="2" step="0.25" />
        <b>{{ prefs.animSpeed }}×</b>
      </label>
      <p class="help muted">How fast menus, cards and effects animate. The game itself always runs at the same speed.</p>
      <label>
        <span>Screen shake</span>
        <input v-model.number="prefs.shake" :style="fill(prefs.shake)" type="range" min="0" max="1" step="0.1" />
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
      <label>
        <span>Art style</span>
        <select v-model="prefs.artStyle">
          <option value="drawn">Drawn</option>
          <option value="live2d">Live2D (animated)</option>
        </select>
        <b></b>
      </label>
      <p class="help muted">Live2D animates every character and enemy: rigged portraits in dialogue, flapping, blinking sprites in the field.</p>
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
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--head);
  letter-spacing: 0.16em;
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
/* Sliders: a thin line, the filled part a vermilion cord, the thumb Reimu's yin-yang orb (refs/gui/NOTES.md, Slider). */
input[type="range"] {
  appearance: none;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
input[type="range"]::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, #c8352a var(--v), rgba(246, 240, 225, 0.16) var(--v));
}
input[type="range"]::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: rgba(246, 240, 225, 0.16);
}
input[type="range"]::-moz-range-progress {
  height: 4px;
  border-radius: 2px;
  background: #c8352a;
}
input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  border: none;
  border-radius: 50%;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 2 2'%3E%3Ccircle r='.94' fill='%23fff'/%3E%3Cpath d='M0-.94A.94.94 0 0 1 0 .94A.47.47 0 0 1 0 0A.47.47 0 0 0 0-.94Z' fill='%23e0314b'/%3E%3Ccircle cy='-.47' r='.15' fill='%23e0314b'/%3E%3Ccircle cy='.47' r='.15' fill='%23fff'/%3E%3Ccircle r='.94' fill='none' stroke='%231b1512' stroke-width='.12'/%3E%3C/svg%3E") center / 100% 100%;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
}
input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='-1 -1 2 2'%3E%3Ccircle r='.94' fill='%23fff'/%3E%3Cpath d='M0-.94A.94.94 0 0 1 0 .94A.47.47 0 0 1 0 0A.47.47 0 0 0 0-.94Z' fill='%23e0314b'/%3E%3Ccircle cy='-.47' r='.15' fill='%23e0314b'/%3E%3Ccircle cy='.47' r='.15' fill='%23fff'/%3E%3Ccircle r='.94' fill='none' stroke='%231b1512' stroke-width='.12'/%3E%3C/svg%3E") center / 100% 100%;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.5);
}
/* The browser's own checkbox and select (a blue tick, a white box) dressed in the game's colours. */
input[type="checkbox"] {
  appearance: none;
  flex: none;
  display: grid;
  place-content: center;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1px solid rgba(214, 196, 140, 0.55);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition:
    background-color var(--glide),
    border-color var(--glide);
}
input[type="checkbox"]:checked {
  border-color: #e8c15a;
  background: #c8352a;
}
input[type="checkbox"]:checked::before {
  content: "";
  width: 9px;
  height: 5px;
  border: solid #f6f0e1;
  border-width: 0 0 2px 2px;
  transform: translateY(-1px) rotate(-45deg);
}
select {
  appearance: none;
  justify-self: start;
  padding: 0.35em 2.2em 0.35em 0.75em;
  border: 1px solid var(--line);
  border-radius: 3px;
  font: inherit;
  color: var(--text);
  background: var(--panel-2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23d6c48c' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 0.75em center / 10px 6px;
  cursor: pointer;
}
select option {
  background: #10142a;
  color: var(--text);
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
