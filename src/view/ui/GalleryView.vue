<script setup lang="ts">
// The gallery: every drawn character and enemy (src/art), portraits and
// field sprites. They all look at the cursor: each drawing is re-rendered
// with a look from its own centre toward the pointer. The style switch shows
// the drawn set, the rigged Live2D-style set (src/art-l2d), or both side by side.
// Below them, the items and weapons at every level, as their level-up cards
// show them; the items in any of their looks, the chosen one used by the cards.
// Four tabs (Characters, Items, Music: the music room, Credits: the staff
// roll), switched by click or Q/E; only the open tab is mounted, and the
// last one is remembered.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import MusicRoom from "./MusicRoom.vue";
import CreditsRoll from "./CreditsRoll.vue";
import { prefs } from "../prefs.ts";
import { livePortrait } from "../art-set.ts";
import type { Model } from "../../art-l2d/rig.ts";
import { ART_L2D, type SpriteRig } from "../../art-l2d/index.ts";
import LivePortrait from "./LivePortrait.vue";
import { host } from "../host.ts";
import { ART } from "../../art/index.ts";
import { AHEAD, svgOf, type Drawing, type Look } from "../../art/drawing.ts";
import { CHARACTERS, type CharacterId } from "../../content/names.ts";
import { ENEMIES } from "../../content/enemies.ts";
import { PASSIVES } from "../../content/passives.ts";
import { WEAPONS } from "../../content/weapons.ts";
import { hex } from "./useGame.ts";
import ItemPreview from "./ItemPreview.vue";
import WeaponPreview from "./WeaponPreview.vue";
import { ITEM_LOOKS, type ItemLook } from "./items/index.ts";

interface Item {
  key: string;
  name: string;
  sub: string;
  portrait?: Drawing;
  sprite?: Drawing;
  live?: Model | null;
  /** The rigged field sprite (animated in the gallery). */
  liveSprite?: SpriteRig;
}

type Style = "drawn" | "live2d" | "both";
const style = ref<Style>(prefs.artStyle);
/** Live portraits: full portrait size alone, smaller beside the drawn one. */
const liveSize = computed(() => (style.value === "both" ? { width: 176, height: 256 } : { width: 220, height: 320 }));
const STYLES: [Style, string][] = [
  ["drawn", "Drawn"],
  ["live2d", "Live2D"],
  ["both", "Both"],
];

const characters: Item[] = (Object.keys(CHARACTERS) as CharacterId[])
  .filter((id) => ART[id])
  .map((id) => ({ key: id, name: CHARACTERS[id].name, sub: CHARACTERS[id].title, portrait: ART[id]!.portrait, sprite: ART[id]!.sprite, live: livePortrait(id, "live2d"), liveSprite: ART_L2D[id]?.sprite }));
const enemies: Item[] = ENEMIES.filter((e) => ART[e.id]?.sprite && !(e.id in CHARACTERS)).map((e) => ({ key: e.id, name: e.name, sub: e.blurb, sprite: ART[e.id]!.sprite, liveSprite: ART_L2D[e.id]?.sprite }));

/** Sprites are shown enlarged; they are tiny in the field. */
const SPRITE_ZOOM = 3;
/** The cursor this far from a drawing (px) makes it look fully that way. */
const REACH = 320;

const looks = reactive<Record<string, Look>>({});
const els = ref<Record<string, HTMLElement>>({});
const mouse = { x: -1, y: -1 };
let raf = 0;

function setEl(key: string, el: unknown): void {
  if (el instanceof HTMLElement) els.value[key] = el;
}

function frame(): void {
  raf = requestAnimationFrame(frame);
  if (mouse.x < 0) return;
  for (const [key, el] of Object.entries(els.value)) {
    const r = el.getBoundingClientRect();
    // Eyes sit in the upper part of a drawing.
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height * 0.4);
    const len = Math.sqrt(dx * dx + dy * dy);
    const k = Math.min(1, len / REACH) / (len || 1);
    const look = { x: Math.round(dx * k * 20) / 20, y: Math.round(dy * k * 20) / 20 };
    const cur = looks[key];
    if (!cur || cur.x !== look.x || cur.y !== look.y) looks[key] = look;
  }
}

function onMove(e: PointerEvent): void {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
}

type Tab = "characters" | "items" | "music" | "credits";
const TABS: [Tab, string][] = [
  ["characters", "Characters"],
  ["items", "Items"],
  ["music", "Music"],
  ["credits", "Credits"],
];
const TAB_KEY = "gensokyo-survivors/gallery-tab";
const tab = ref<Tab>(TABS.find(([id]) => id === sessionStorage.getItem(TAB_KEY))?.[0] ?? "characters");
watch(tab, (t) => {
  sessionStorage.setItem(TAB_KEY, t);
  // The drawings of the tab closed are gone; stop following them.
  els.value = {};
});

/** Q and E (or PageUp and PageDown) step through the tabs. */
function onKey(e: KeyboardEvent): void {
  if (e.ctrlKey || e.altKey || e.metaKey || (e.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
  const d = e.code === "KeyQ" || e.code === "PageUp" ? -1 : e.code === "KeyE" || e.code === "PageDown" ? 1 : 0;
  if (!d) return;
  e.preventDefault();
  const i = TABS.findIndex(([id]) => id === tab.value);
  tab.value = TABS[(i + d + TABS.length) % TABS.length]![0];
}

onMounted(() => {
  window.addEventListener("pointermove", onMove);
  window.addEventListener("keydown", onKey);
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("keydown", onKey);
  cancelAnimationFrame(raf);
});

function pickItemArt(look: ItemLook): void {
  prefs.itemArt = look;
  prefs.itemArtPicked = true;
}

function draw(d: Drawing, key: string, px: number): string {
  return svgOf(d, px, looks[key] ?? AHEAD);
}
</script>

<template>
  <div v-keynav="{ pointer: true }" class="screen gallery">
    <div class="screen-head">
      <h1>Gallery</h1>
      <div class="tabs">
        <span class="key">Q</span>
        <button v-for="[id, label] in TABS" :key="id" class="btn small tab" :class="{ primary: tab === id }" @click="tab = id">{{ label }}</button>
        <span class="key">E</span>
      </div>
      <div v-if="tab === 'characters'" class="styles">
        <button v-for="[id, label] in STYLES" :key="id" class="btn small" :class="{ primary: style === id }" @click="style = id">{{ label }}</button>
      </div>
      <button class="btn back" @click="host.go('menu')">Back</button>
    </div>
    <div class="panel body" :class="{ music: tab === 'music', credits: tab === 'credits', 'fabric-scroll': tab !== 'music' && tab !== 'credits', 'no-fabric': tab === 'credits' }">
      <MusicRoom v-if="tab === 'music'" />
      <CreditsRoll v-if="tab === 'credits'" />
      <template v-if="tab === 'characters'">
      <h3>Characters</h3>
      <div class="grid" :class="{ wide: style !== 'drawn' }">
        <div v-for="c in characters" :key="c.key" class="item" tabindex="0">
          <div class="art" :class="{ both: style === 'both' }">
            <div
              v-if="c.portrait && (style !== 'live2d' || !c.live)"
              :ref="(el) => setEl(c.key + ':p', el)"
              class="portrait"
              v-html="draw(c.portrait, c.key + ':p', 1)"
            ></div>
            <LivePortrait v-if="c.live && style !== 'drawn'" class="portrait live" :model="c.live" v-bind="liveSize" follow />
            <div
              v-if="c.sprite && (style !== 'live2d' || !c.liveSprite)"
              :ref="(el) => setEl(c.key + ':s', el)"
              class="sprite"
              v-html="draw(c.sprite, c.key + ':s', SPRITE_ZOOM)"
            ></div>
            <LivePortrait
              v-if="c.liveSprite && style !== 'drawn'"
              class="sprite live"
              :model="c.liveSprite.model"
              :width="c.liveSprite.w * SPRITE_ZOOM"
              :height="c.liveSprite.h * SPRITE_ZOOM"
              :rate="c.liveSprite.rate"
              follow
            />
          </div>
          <div class="name">{{ c.name }}</div>
          <div class="sub muted">{{ c.sub }}</div>
        </div>
      </div>
      <h3>Enemies</h3>
      <div class="grid" :class="{ wide: style === 'both' }">
        <div v-for="e in enemies" :key="e.key" class="item" tabindex="0">
          <div class="art">
            <div v-if="style !== 'live2d' || !e.liveSprite" :ref="(el) => setEl(e.key, el)" class="sprite" v-html="draw(e.sprite!, e.key, SPRITE_ZOOM)"></div>
            <LivePortrait
              v-if="e.liveSprite && style !== 'drawn'"
              class="sprite live"
              :model="e.liveSprite.model"
              :width="e.liveSprite.w * SPRITE_ZOOM"
              :height="e.liveSprite.h * SPRITE_ZOOM"
              :rate="e.liveSprite.rate"
              follow
            />
          </div>
          <div class="name">{{ e.name }}</div>
          <div class="sub muted">{{ e.sub }}</div>
        </div>
      </div>
      </template>
      <template v-if="tab === 'items'">
      <div class="section-head">
        <h3>Items</h3>
        <div class="styles">
          <button v-for="l in ITEM_LOOKS" :key="l.id" class="btn small" :class="{ primary: prefs.itemArt === l.id }" :title="l.blurb" @click="pickItemArt(l.id)">{{ l.label }}</button>
        </div>
      </div>
      <p class="muted look-note">{{ ITEM_LOOKS.find((l) => l.id === prefs.itemArt)?.blurb }}. The level-up cards use the look picked here.</p>
      <div class="rows">
        <div v-for="p in PASSIVES" :key="p.id" class="item row" tabindex="0">
          <div class="levels">
            <div v-for="l in p.max" :key="l" class="lv">
              <ItemPreview :id="p.id" :color="hex(p.color)" :level="l" :max="p.max" :look="prefs.itemArt" active />
              <span class="muted">Lv {{ l }}</span>
            </div>
          </div>
          <div class="name">{{ p.name }}</div>
          <div class="sub muted">{{ p.desc }}</div>
        </div>
      </div>
      <h3>Weapons</h3>
      <div class="rows">
        <div v-for="w in WEAPONS" :key="w.id" class="item row" tabindex="0">
          <div class="levels">
            <div v-for="l in w.levels.length" :key="l" class="lv">
              <WeaponPreview :id="w.id" :level="l" active />
              <span class="muted">Lv {{ l }}</span>
            </div>
          </div>
          <div class="name">{{ w.name }}</div>
          <div class="sub muted">{{ w.desc }} (from {{ w.from }})</div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
h3 {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--head);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
/* Full screen: the head stays put, the body fills the rest and scrolls inside itself (the music room scrolls its own list). */
.gallery {
  overflow: hidden;
}
.gallery .screen-head {
  width: min(1600px, 96vw);
  flex: none;
}
.body {
  width: min(1600px, 96vw);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.body.music {
  overflow: hidden;
}
.body.credits {
  overflow: hidden;
  padding: 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 14px;
}
/* Rigged portraits are drawn at portrait size next to the sprite: give each character a wide card. */
.grid.wide {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
}
.item {
  min-width: 0;
  overflow: hidden;
  background: rgba(10, 8, 7, 0.45);
  border: 1px solid rgba(232, 193, 90, 0.16);
  border-radius: 2px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.art {
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  align-items: flex-end;
  justify-content: safe center;
  gap: 8px;
  min-height: 150px;
}
.portrait :deep(svg) {
  display: block;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.5));
}
.art.both .portrait:not(.live) :deep(svg) {
  width: 176px;
  height: 256px;
}
.portrait.live {
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.5));
}
.styles {
  display: flex;
  gap: 6px;
  margin-left: auto;
  margin-right: 12px;
}
.tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 18px;
}
.sprite :deep(svg) {
  display: block;
}
.name {
  margin-top: 8px;
  font-weight: 600;
}
.sub {
  font-size: 12px;
  margin-top: 2px;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.section-head .styles {
  margin-left: auto;
  margin-right: 0;
}
.look-note {
  margin: 4px 0 10px;
  font-size: 13px;
}
.rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.levels {
  display: flex;
  flex-wrap: wrap;
  justify-content: safe center;
  align-items: flex-end;
  gap: 6px 14px;
}
.lv {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 12px;
}
/* Eight weapon levels on one line. */
.lv :deep(.wpv) {
  width: 116px !important;
  height: 53px !important;
}
</style>
