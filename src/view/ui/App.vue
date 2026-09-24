<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watchEffect } from "vue";
import { host, state } from "../host.ts";
import { prefs } from "../prefs.ts";
import { ui } from "../presenter.ts";
import TitleScreen from "./TitleScreen.vue";
import MainMenu from "./MainMenu.vue";
import RunView from "./RunView.vue";
import ResultsView from "./ResultsView.vue";
import TreeView from "./TreeView.vue";
import CardsView from "./CardsView.vue";
import PacksView from "./PacksView.vue";
import RecordsView from "./RecordsView.vue";
import ExpeditionsView from "./ExpeditionsView.vue";
import SettingsView from "./SettingsView.vue";
import HelpView from "./HelpView.vue";
import GalleryView from "./GalleryView.vue";
import CreditsView from "./CreditsView.vue";

const field = ref<HTMLDivElement>();
const failed = ref("");

/**
 * The interface is laid out for about 1100x720 CSS pixels; smaller screens
 * (phones) get all of it zoomed down to fit, the field is scaled separately.
 */
const uiScale = ref(1);
function fit(): void {
  uiScale.value = Math.max(
    0.5,
    Math.min(1, window.innerWidth / 1100, window.innerHeight / 720),
  );
}
fit();
window.addEventListener("resize", fit);
onBeforeUnmount(() => window.removeEventListener("resize", fit));

onMounted(async () => {
  try {
    await host.start(field.value!);
  } catch (e) {
    failed.value = (e as Error).message;
  }
});

watchEffect(() => {
  document.documentElement.style.setProperty(
    "--anim",
    String(1 / prefs.animSpeed),
  );
});
</script>

<template>
  <div class="root">
    <div ref="field" class="field"></div>
    <div class="ui" :style="{ zoom: uiScale }">
      <Transition name="fade" mode="out-in">
        <TitleScreen v-if="state.screen === 'title'" key="title" />
        <MainMenu v-else-if="state.screen === 'menu'" key="menu" />
        <RunView v-else-if="state.screen === 'run'" key="run" />
        <ResultsView v-else-if="state.screen === 'results'" key="results" />
        <TreeView v-else-if="state.screen === 'tree'" key="tree" />
        <CardsView v-else-if="state.screen === 'cards'" key="cards" />
        <PacksView v-else-if="state.screen === 'packs'" key="packs" />
        <RecordsView v-else-if="state.screen === 'records'" key="records" />
        <GalleryView v-else-if="state.screen === 'gallery'" key="gallery" />
        <CreditsView v-else-if="state.screen === 'credits'" key="credits" />
        <ExpeditionsView
          v-else-if="state.screen === 'expeditions'"
          key="expeditions"
        />
        <SettingsView
          v-else-if="state.screen === 'settings'"
          key="settings"
          @close="state.screen = state.back"
        />
        <HelpView
          v-else-if="state.screen === 'help'"
          key="help"
          @close="state.screen = state.back"
        />
      </Transition>

      <div class="toasts">
        <TransitionGroup name="pop">
          <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.tone">
            {{ t.text }}
          </div>
        </TransitionGroup>
      </div>

      <div v-if="prefs.fps" class="fps">
        {{ state.fps }} fps · {{ state.msPerTick }} ms/tick
      </div>

      <div v-if="state.loadError" v-keynav class="modal-wrap">
        <div class="panel modal">
          <h2>Your save could not be loaded</h2>
          <p class="muted">{{ state.loadError }}</p>
          <p>
            A new profile was started. The old save was kept aside in this
            browser (key <code>gensokyo-survivors/save.broken</code>) and was
            not overwritten.
          </p>
          <button class="btn primary" @click="state.loadError = ''">
            Continue with a new profile
          </button>
        </div>
      </div>
      <div v-if="failed" v-keynav class="modal-wrap">
        <div class="panel modal">
          <h2>The game could not start</h2>
          <p class="muted">{{ failed }}</p>
          <p>
            This game needs WebGL. Try a current version of Chrome, Edge or
            Firefox.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.root {
  position: relative;
  width: 100%;
  height: 100%;
}
.field {
  position: absolute;
  inset: 0;
  touch-action: none;
}
.ui {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
:where(.ui) > * {
  pointer-events: auto;
}
.toasts {
  position: absolute;
  left: 50%;
  bottom: 170px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  z-index: 50;
}
.toast {
  padding: 8px 16px;
  border-radius: 10px;
  background: rgba(20, 24, 48, 0.95);
  border: 1px solid var(--line);
  font-weight: 600;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
}
.toast.bad {
  border-color: rgba(255, 92, 122, 0.7);
  color: #ffd0da;
}
.toast.good {
  border-color: rgba(123, 216, 143, 0.7);
  color: #d4ffe0;
}
.fps {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-size: 12px;
  color: var(--muted);
  z-index: 60;
  pointer-events: none;
}
.modal-wrap {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
}
.modal {
  max-width: 520px;
  padding: 24px 28px;
}
.modal h2 {
  margin-top: 0;
}
</style>
