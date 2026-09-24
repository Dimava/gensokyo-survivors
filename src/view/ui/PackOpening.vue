<script setup lang="ts">
// The pack opening, a gacha pull in shrine dress:
// 1. the sealed bundle (lacquer cards under a paper band and a vermilion seal)
//    rattles harder and harder, its seal glowing the best rarity inside;
// 2. it bursts: the band tears in two, the seal cracks, washi scraps fly;
// 3. the cards fly out and land face down;
// 4. one by one each card charges in its rim metal's colour (longer and
//    brighter the rarer: an SR lifts and trembles, an SSR darkens the room
//    behind light rays) and turns over; an SSR flashes the screen, throws
//    sparkles and shakes it. New cards get a NEW stamp, duplicates fill a
//    level chevron, maxed ones stamp MAX and refund coins.
// Confirm (click, Enter/Space/Z) moves on at once: opens the pack, lands the
// cards, flips the next card. Skip (X/Ctrl, or the button) reveals them all.
// All times run on the animation speed pref (the CSS ones through --anim).
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { prefs } from "../prefs.ts";
import { kds } from "../keys.ts";
import { Pack } from "../../sim/pack.ts";
import { MAX_CARD_LEVEL, RARITY_INFO, cardDef, type Rarity } from "../../content/cards.ts";
import { CURRENCY } from "../../content/names.ts";
import { packDef } from "../../content/gacha.ts";
import { wallet } from "./useGame.ts";
import CardFace from "./CardFace.vue";
import CardBack from "./CardBack.vue";
import Keys from "./Keys.vue";

const opening = computed(() => {
  void state.meta;
  return host.k.paths().includes("/pack") ? host.k.read("/pack", Pack) : null;
});
// The pulls of this opening, fixed at mount (the scope goes when it closes).
const pulls = opening.value?.pulls ?? [];
const packId = opening.value?.pack ?? "";
const pack = packId ? packDef(packId) : null;

const RANK: Record<Rarity, number> = { N: 0, R: 1, SR: 2, SSR: 3 };
/** The glow of each rarity: its rim metal (CardFace), SSR's the brightest gold. */
const METAL: Record<Rarity, string> = { N: "#e6ebf5", R: "#5aa8ff", SR: "#f0b040", SSR: "#fff1a8" };
/** Seconds a card charges before it turns, and the pause after it. */
const CHARGE: Record<Rarity, number> = { N: 0.24, R: 0.38, SR: 0.72, SSR: 1.25 };
const AFTER: Record<Rarity, number> = { N: 0.18, R: 0.22, SR: 0.4, SSR: 0.7 };
const PACK_T = 0.8;
const BURST_T = 0.2;
const DEAL_GAP = 0.1;
const DEAL_T = 0.38;
const CARD_W = 170;
const GAP = 34;

const best = pulls.reduce<Rarity>((b, p) => (RANK[p.rarity] > RANK[b] ? p.rarity : b), "N");

type Phase = "pack" | "burst" | "deal" | "reveal" | "done";
const phase = ref<Phase>("pack");
/** Seconds into the phase (scaled by the animation speed). */
const pt = ref(0);

interface CardState {
  dealt: number; // 0..1
  charge: number; // 0..1
  flipped: boolean;
}
const cards = reactive<CardState[]>(pulls.map(() => ({ dealt: 0, charge: 0, flipped: false })));
/** The card charging next, and the pause left before it starts. */
const current = ref(0);
let wait = 0;
let risen = -1;

// Washi scraps and lacquer chips thrown by the burst: fixed per opening.
const scraps = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
  const d = 160 + Math.random() * 260;
  return {
    kind: i % 3 === 2 ? "chip" : "paper",
    style: {
      "--dx": `${Math.cos(a) * d}px`,
      "--dy": `${Math.sin(a) * d * 0.7 - 60}px`,
      "--r": `${(Math.random() - 0.5) * 900}deg`,
      "--w": `${8 + Math.random() * 16}px`,
      "--h": `${14 + Math.random() * 26}px`,
      "--d": `${Math.random() * 0.08}s`,
    },
  };
});
// Sparkles an SR or SSR throws when it turns.
const sparks = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
  const d = 110 + Math.random() * 90;
  return { "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, "--d": `${Math.random() * 0.12}s`, "--s": `${0.6 + Math.random() * 0.8}` };
});

const stage = ref<HTMLElement | null>(null);
const flash = ref<HTMLElement | null>(null);
const root = ref<HTMLElement | null>(null);

let raf = 0;
let last = 0;

function setPhase(p: Phase): void {
  phase.value = p;
  pt.value = 0;
  if (p === "burst") {
    // The paper tears (a snap and a rustle) as the seal gives.
    audio.play("pop", { pitch: 0.7 });
    audio.play("flip");
    audio.play("whoosh");
    punch(0.35, 0.18);
  }
  if (p === "reveal") {
    current.value = 0;
    wait = 0.08;
  }
}

function frame(now: number): void {
  const dt = (Math.min(50, now - last) / 1000) * prefs.animSpeed;
  last = now;
  pt.value += dt;
  const t = pt.value;
  if (phase.value === "pack" && t >= PACK_T) setPhase("burst");
  else if (phase.value === "burst" && t >= BURST_T) setPhase("deal");
  else if (phase.value === "deal") {
    let all = true;
    cards.forEach((c, i) => {
      const k = Math.max(0, Math.min(1, (t - i * DEAL_GAP) / DEAL_T));
      if (c.dealt < 1 && k >= 1) audio.play("flip", { pitch: 1 + i * 0.1 });
      c.dealt = k;
      if (k < 1) all = false;
    });
    if (all) setPhase("reveal");
  } else if (phase.value === "reveal") {
    const i = current.value;
    const c = cards[i];
    const pull = pulls[i];
    if (!c || !pull) setPhase("done");
    else if (wait > 0) wait -= dt;
    else {
      if (risen !== i && RANK[pull.rarity] >= 2) {
        risen = i;
        audio.play("power", { vol: pull.rarity === "SSR" ? 1 : 0.6 });
      }
      c.charge = Math.min(1, c.charge + dt / CHARGE[pull.rarity]);
      if (c.charge >= 1) flip(i);
    }
  }
  raf = requestAnimationFrame(frame);
}

/** Turns card i over now, with its rarity's show. */
function flip(i: number, quiet = false): void {
  const c = cards[i];
  const pull = pulls[i];
  if (!c || !pull || c.flipped) return;
  c.charge = 1;
  c.flipped = true;
  if (!quiet) {
    audio.play(`reveal${pull.rarity}` as "revealN");
    if (pull.outcome === "refund") setTimeout(() => audio.play("coin"), 350 / prefs.animSpeed);
    if (pull.outcome === "level") setTimeout(() => audio.play("levelup", { vol: 0.5 }), 300 / prefs.animSpeed);
  }
  if (pull.rarity === "SSR") {
    flashScreen(0.9);
    punch(1, 0.45);
  } else if (pull.rarity === "SR") punch(0.35, 0.2);
  current.value = i + 1;
  wait = AFTER[pull.rarity];
  if (current.value >= cards.length) setPhase("done");
}

function flashScreen(strength: number): void {
  flash.value?.animate([{ opacity: strength }, { opacity: 0 }], { duration: 420 / prefs.animSpeed, easing: "ease-out" });
}
/** A short screen shake, by the shake pref. */
function punch(amp: number, seconds: number): void {
  const a = amp * prefs.shake * 9;
  if (!stage.value || a <= 0) return;
  const k = [0, 1, -0.8, 0.6, -0.4, 0.2, 0].map((f, j) => ({ transform: `translate(${f * a * (j % 2 ? 1 : -0.6)}px, ${f * a * 0.7}px)` }));
  stage.value.animate(k, { duration: (seconds * 1000) / prefs.animSpeed, easing: "ease-out" });
}

/** Confirm: the next step now. */
function advance(): void {
  if (phase.value === "pack") setPhase("burst");
  else if (phase.value === "burst") setPhase("deal");
  else if (phase.value === "deal") {
    cards.forEach((c) => (c.dealt = 1));
    setPhase("reveal");
  } else if (phase.value === "reveal") {
    wait = 0;
    flip(current.value);
  }
}
/** Skip: every card face up at once, one sound for the best of them. */
function revealAll(): void {
  if (phase.value === "done") return;
  cards.forEach((c) => (c.dealt = 1));
  let flashed = false;
  pulls.forEach((p, i) => {
    if (cards[i]!.flipped) return;
    flip(i, true);
    flashed ||= p.rarity === "SSR";
  });
  audio.play(`reveal${best}` as "revealN");
  if (pulls.some((p) => p.outcome === "refund")) audio.play("coin");
  if (!flashed) flashScreen(0.25);
  phase.value = "done";
}

function onConfirm(): void {
  if (phase.value !== "done") return advance();
  // Done: Confirm presses the selected button (Continue unless one was picked).
  const a = document.activeElement;
  if (a instanceof HTMLButtonElement && root.value?.contains(a)) a.click();
  else close();
}
function onBack(): void {
  if (phase.value === "done") close();
  else revealAll();
}
function close(): void {
  audio.play("ui");
  host.closePack();
}
const canAgain = computed(() => !!pack && wallet.value.coins >= pack.cost);
function again(): void {
  if (!pack) return;
  host.closePack();
  host.meta("pack:buy", { pack: pack.id });
  audio.play("buy");
}

// Skip (X/Ctrl) reveals every card; kds hands it to us whatever has focus.
const offSkip = kds.on({ code: "Action:skip", mods: undefined, event: { repeat: false } }, (e) => {
  e.event.preventDefault();
  revealAll();
});
onMounted(() => {
  audio.play("whoosh", { vol: 0.6 });
  last = performance.now();
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  offSkip();
});

/** Where each card lies, as an offset from the row's centre. */
const offset = (i: number) => (i - (pulls.length - 1) / 2) * (CARD_W + GAP);
const easeOutBack = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

function slotStyle(i: number): Record<string, string | number> {
  const c = cards[i]!;
  const p = pulls[i]!;
  const e = easeOutBack(c.dealt);
  const charging = !c.flipped && c.charge > 0;
  const rank = RANK[p.rarity];
  // Rarer cards lift towards the viewer while they charge.
  const lift = charging ? c.charge * (rank >= 3 ? 26 : rank >= 2 ? 14 : 4) : 0;
  return {
    "--mc": METAL[p.rarity],
    "--glow": c.flipped ? 0 : c.charge * (0.45 + rank * 0.2),
    "--tremble": charging && rank >= 2 ? c.charge * (rank >= 3 ? 3 : 1.6) : 0,
    transform: `translate(${-offset(i) * (1 - e)}px, ${(1 - e) * 20 - lift}px) scale(${0.55 + 0.45 * e + (charging ? c.charge * rank * 0.02 : 0)}) rotate(${(1 - c.dealt) * (i - 1) * -18}deg)`,
    opacity: c.dealt > 0 ? Math.min(1, c.dealt * 4) : 0,
    zIndex: charging ? 3 : 1,
  };
}

/** The SSR moment: the room dims while it charges. */
const dim = computed(() => {
  if (phase.value !== "reveal") return 0;
  const i = current.value;
  return pulls[i]?.rarity === "SSR" ? (cards[i]?.charge ?? 0) * 0.55 : 0;
});
const packStyle = computed(() => {
  const k = phase.value === "pack" ? Math.min(1, pt.value / PACK_T) : 1;
  return {
    // Rarer insides rattle harder.
    "--amp": (k * k * (0.8 + RANK[best] * 0.2)).toFixed(3),
    "--seal": phase.value === "pack" ? Math.max(0, (k - 0.45) / 0.55).toFixed(3) : "1",
    "--sc": METAL[best],
  };
});

const summary = computed(() => {
  const n = pulls.filter((p) => p.outcome === "new").length;
  const l = pulls.filter((p) => p.outcome === "level").length;
  const coins = pulls.reduce((s, p) => s + (p.outcome === "refund" ? p.refund : 0), 0);
  return [n && `${n} new`, l && `${l} level up${l > 1 ? "s" : ""}`, coins && `+${coins} ${CURRENCY.icon}`].filter(Boolean).join(" · ");
});
const newNames = pulls.filter((p) => p.outcome === "new").map((p) => cardDef(p.card).name);
</script>

<template>
  <div
    v-if="pack"
    ref="root"
    v-keynav="{ confirm: onConfirm, back: onBack, autofocus: false }"
    class="opening"
    :class="[phase, 'best' + best]"
    @click="phase !== 'done' && advance()"
  >
    <div class="dimmer" :style="{ opacity: dim }"></div>
    <div ref="stage" class="stage">
      <header>
        <h2>{{ pack.name }}</h2>
        <p class="hint">
          <template v-if="phase === 'pack'">Click or <Keys for="Confirm" :max="2" /> to break the seal</template>
          <template v-else-if="phase !== 'done'">Click or <Keys for="Confirm" :max="2" /> flips the next card</template>
          <template v-else>{{ summary }}</template>
        </p>
      </header>

      <div class="table">
        <!-- The sealed bundle. -->
        <div v-if="phase === 'pack' || phase === 'burst' || phase === 'deal'" class="bundle" :class="{ broken: phase !== 'pack' }" :style="packStyle">
          <div class="body">
            <CardBack class="under u1" />
            <CardBack class="under u2" />
            <CardBack />
          </div>
          <div class="wrap left"><span>御神</span></div>
          <div class="wrap right"><span>籤</span></div>
          <div class="sealglow"></div>
          <div class="seal left"><i>封</i></div>
          <div class="seal right"><i>封</i></div>
          <div class="burstlight"></div>
          <template v-if="phase !== 'pack'">
            <i v-for="(s, k) in scraps" :key="k" class="scrap" :class="s.kind" :style="s.style"></i>
          </template>
        </div>

        <div class="row">
          <div v-for="(p, i) in pulls" :key="i" class="slot" :class="['r' + p.rarity, { flipped: cards[i]!.flipped, charging: !cards[i]!.flipped && cards[i]!.charge > 0 }]" :style="slotStyle(i)">
            <div v-if="p.rarity === 'SSR'" class="rays"></div>
            <div class="flipper">
              <div class="back"><CardBack /><div class="aura"></div></div>
              <div class="front">
                <CardFace :card="p.card" :level="p.level" />
                <div v-if="p.outcome === 'refund'" class="maxed"><b>MAX</b></div>
              </div>
            </div>
            <template v-if="cards[i]!.flipped">
              <div class="ring"></div>
              <template v-if="RANK[p.rarity] >= 2">
                <i v-for="(s, k) in sparks" :key="k" class="spark" :style="s"></i>
              </template>
              <div v-if="p.outcome === 'new'" class="badge new">NEW</div>
              <div v-if="p.outcome === 'refund'" class="coinrise">+{{ p.refund }} {{ CURRENCY.icon }}</div>
            </template>
          </div>
        </div>
      </div>

      <div class="labels">
        <div v-for="(p, i) in pulls" :key="i" class="label" :class="{ show: cards[i]!.flipped }">
          <b class="rname" :style="{ color: RARITY_INFO[p.rarity].css }">{{ RARITY_INFO[p.rarity].label }}</b>
          <span v-if="p.outcome === 'new'" class="out">New card!</span>
          <span v-else-if="p.outcome === 'level'" class="out lvl">
            Level up
            <svg class="chev" viewBox="0 0 44 14" :aria-label="`Level ${p.level}`">
              <path v-for="n in MAX_CARD_LEVEL" :key="n" :class="{ on: n < p.level, up: n === p.level }" :d="`M${n * 13 - 9} 11l5-6 5 6`" />
            </svg>
            <span class="lv">Lv {{ p.level }}</span>
          </span>
          <span v-else class="out coin">Max level: +{{ p.refund }} {{ CURRENCY.name }}</span>
          <span v-if="p.pity" class="pity">Pity guarantee</span>
        </div>
      </div>

      <div class="foot" @click.stop>
        <template v-if="phase === 'done'">
          <button class="btn again" :disabled="!canAgain" @click="again">Open another {{ CURRENCY.icon }} {{ pack.cost }}</button>
          <button class="btn primary" @click="close">Continue <Keys for="Confirm" :max="2" /></button>
        </template>
        <button v-else class="btn skip" @click="revealAll">Reveal all <Keys for="Action:skip" :max="1" /></button>
      </div>
      <p v-if="phase === 'done'" class="muted small">
        {{ newNames.length ? `New cards join your deck while it has room: ${newNames.join(", ")}.` : "No new cards this time." }}
        <span class="coins">{{ CURRENCY.icon }} {{ wallet.coins }}</span>
      </p>
    </div>
    <div ref="flash" class="flash" :class="'f' + best"></div>
  </div>
</template>

<style scoped>
.opening {
  position: absolute;
  inset: 0;
  z-index: 20;
  overflow: hidden;
  cursor: pointer;
  background:
    radial-gradient(ellipse at 50% 55%, rgba(122, 20, 32, 0.35), transparent 60%),
    radial-gradient(ellipse at center, rgba(16, 20, 42, 0.96), rgba(4, 4, 12, 0.98));
}
.opening.done {
  cursor: default;
}
.dimmer {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgba(60, 40, 0, 0.3), #000 75%);
  pointer-events: none;
}
.stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: safe center;
  gap: 8px;
}
header {
  position: relative;
  z-index: 6;
  text-align: center;
}
h2 {
  margin: 0;
  font-size: 2rem;
}
.hint {
  margin: 4px 0 0;
  min-height: 1.4em;
  color: var(--muted);
}
.done .hint {
  color: #fff;
  font-weight: 700;
}
.table {
  position: relative;
  margin: 18px 0 6px;
}
.row {
  display: flex;
  gap: 34px;
  perspective: 1000px;
}

/* ---------- the sealed bundle ---------- */
.bundle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 170px;
  height: 250px;
  margin: -125px 0 0 -85px;
  z-index: 5;
  animation: enter calc(0.3s * var(--anim)) cubic-bezier(0.2, 1.5, 0.4, 1) both;
}
.body {
  position: absolute;
  inset: 0;
  animation: rattle calc(0.09s * var(--anim)) linear infinite alternate;
}
.under {
  position: absolute;
  inset: 0;
}
.u1 {
  transform: translate(5px, 5px) rotate(3deg);
  filter: brightness(0.6);
}
.u2 {
  transform: translate(-4px, 3px) rotate(-2.5deg);
  filter: brightness(0.75);
}
.body > :last-child {
  position: relative;
}
.wrap {
  /* The paper band round the bundle, torn in two at the burst. */
  position: absolute;
  top: 100px;
  height: 50px;
  width: 92px;
  background:
    repeating-linear-gradient(90deg, rgba(150, 128, 90, 0.1) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, #fbf6ea, #f4ecd8 55%, #e3d5b4);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.7),
    inset 0 -2px 0 rgba(120, 90, 50, 0.4),
    0 3px 8px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  font: 900 17px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #1b1512;
  animation: rattle calc(0.09s * var(--anim)) linear infinite alternate;
}
.wrap.left {
  left: -8px;
  justify-content: flex-start;
  padding-left: 14px;
  clip-path: polygon(0 0, 100% 0, 92% 20%, 100% 38%, 90% 60%, 100% 78%, 94% 100%, 0 100%);
}
.wrap.right {
  right: -8px;
  justify-content: flex-end;
  padding-right: 16px;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 6% 100%, 0 78%, 10% 60%, 0 38%, 8% 20%);
}
.seal {
  /* The round vermilion seal where the band closes, glowing the best card's colour. */
  position: absolute;
  left: 50%;
  top: 125px;
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 40% 35%, #f0604a, #b01e1a 60%, #6a0c0a);
  box-shadow:
    inset 0 0 0 3px rgba(255, 190, 160, 0.35),
    inset 0 0 0 6px #a31a16,
    inset 0 0 0 7px rgba(255, 210, 180, 0.5);
  font: 900 26px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #ffe4d4;
  text-shadow: 0 0 calc(var(--seal) * 10px) var(--sc);
  animation: rattle calc(0.09s * var(--anim)) linear infinite alternate;
}
.sealglow {
  /* The seal's glow, apart from the halves (their clip-path would cut it). */
  position: absolute;
  left: 50%;
  top: 125px;
  width: 58px;
  height: 58px;
  margin: -29px 0 0 -29px;
  border-radius: 50%;
  box-shadow:
    0 0 calc(var(--seal) * 16px) calc(var(--seal) * 4px) #fff,
    0 0 calc(var(--seal) * 60px) calc(var(--seal) * 24px) var(--sc),
    0 3px 6px rgba(0, 0, 0, 0.6);
  animation: rattle calc(0.09s * var(--anim)) linear infinite alternate;
}
.broken .sealglow {
  opacity: 0;
}
.seal.left {
  clip-path: polygon(0 0, 50% 0, 44% 30%, 56% 52%, 46% 74%, 52% 100%, 0 100%);
}
.seal.right {
  clip-path: polygon(50% 0, 100% 0, 100% 100%, 52% 100%, 46% 74%, 56% 52%, 44% 30%);
}
.bestSSR .seal {
  background: radial-gradient(circle at 40% 35%, #fff4c0, #f0604a 40%, #b01e1a 70%, #6a0c0a);
}
.burstlight {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff, var(--sc) 40%, transparent 70%);
  opacity: 0;
  pointer-events: none;
}
/* Burst: the band halves and seal halves fly apart, the bundle swells and fades into light. */
.broken .body {
  animation: swell calc(0.4s * var(--anim)) ease-in forwards;
}
.broken .wrap.left {
  animation: tearL calc(0.6s * var(--anim)) cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
}
.broken .wrap.right {
  animation: tearR calc(0.6s * var(--anim)) cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
}
.broken .seal.left {
  animation: crackL calc(0.55s * var(--anim)) ease-out forwards;
}
.broken .seal.right {
  animation: crackR calc(0.55s * var(--anim)) ease-out forwards;
}
.broken .burstlight {
  animation: light calc(0.45s * var(--anim)) ease-out forwards;
}
.scrap {
  position: absolute;
  left: 50%;
  top: 50%;
  width: var(--w);
  height: var(--h);
  margin: calc(var(--h) / -2) 0 0 calc(var(--w) / -2);
  background: linear-gradient(180deg, #fbf6ea, #e3d5b4);
  clip-path: polygon(0 8%, 30% 0, 100% 12%, 88% 60%, 100% 100%, 20% 92%, 6% 50%);
  animation: fly calc(0.8s * var(--anim)) cubic-bezier(0.15, 0.7, 0.4, 1) var(--d) both;
  pointer-events: none;
}
.scrap.chip {
  background: linear-gradient(160deg, #a01c28, #3a060c);
  clip-path: polygon(0 0, 100% 20%, 70% 100%, 10% 70%);
}

/* ---------- the cards ---------- */
.slot {
  position: relative;
  width: 170px;
  height: 250px;
  will-change: transform;
}
.flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform calc(0.42s * var(--anim)) cubic-bezier(0.3, 1.35, 0.5, 1);
}
.flipped .flipper {
  transform: rotateY(180deg);
}
.charging .flipper {
  animation: tremble calc(0.06s * var(--anim)) linear infinite alternate;
}
.back,
.front {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 4px;
}
.front {
  transform: rotateY(180deg);
}
.back {
  /* The charge: a glow in the rim metal's colour, building round and over the back. */
  box-shadow:
    0 0 calc(var(--glow) * 44px) calc(var(--glow) * 10px) var(--mc),
    0 0 calc(var(--glow) * 10px) calc(var(--glow) * 3px) #fff;
}
.aura {
  position: absolute;
  inset: 0;
  border-radius: 4px;
  background: radial-gradient(circle at 50% 50%, var(--mc), transparent 70%);
  mix-blend-mode: screen;
  opacity: calc(var(--glow) * 0.9);
  pointer-events: none;
}
.rSSR .aura {
  background:
    radial-gradient(circle at 50% 50%, #fff 0 12%, transparent 60%),
    conic-gradient(from 0deg, #ff6a8a, #ffd24a, #7affb0, #6ad0ff, #c58aff, #ff6a8a);
}
.maxed {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 8, 16, 0.45);
  border-radius: 4px;
}
.maxed b {
  font: 900 30px/1 Georgia, serif;
  letter-spacing: 0.12em;
  color: #d23a2a;
  border: 3px solid #d23a2a;
  padding: 4px 8px 2px;
  background: rgba(244, 236, 216, 0.9);
  rotate: -14deg;
  animation: stamp calc(0.3s * var(--anim)) cubic-bezier(0.3, 1.6, 0.5, 1) calc(0.25s * var(--anim)) both;
}

/* The SSR's light rays: fading in with its charge, turning slowly after. */
.rays {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 620px;
  height: 620px;
  margin: -310px 0 0 -310px;
  border-radius: 50%;
  background: repeating-conic-gradient(from 0deg, rgba(255, 236, 160, 0.55) 0 5deg, transparent 5deg 18deg);
  mask: radial-gradient(circle, #000 12%, transparent 68%);
  opacity: calc(var(--glow) * 0.9);
  pointer-events: none;
  animation: spin calc(14s * var(--anim)) linear infinite;
}
.rSSR.flipped .rays {
  opacity: 0.55;
  transition: opacity calc(1.2s * var(--anim));
}

/* Turning over: a ring of the rim metal, sparkles for SR and SSR. */
.ring {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 180px;
  height: 180px;
  margin: -90px 0 0 -90px;
  border-radius: 50%;
  border: 4px solid var(--mc);
  box-shadow:
    0 0 20px var(--mc),
    inset 0 0 20px var(--mc);
  pointer-events: none;
  animation: ring calc(0.5s * var(--anim)) ease-out both;
}
.rN .ring {
  border-width: 2px;
  animation-duration: calc(0.35s * var(--anim));
}
.spark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  background: #fff;
  clip-path: polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%);
  filter: drop-shadow(0 0 4px var(--mc));
  pointer-events: none;
  z-index: 4;
  animation: spark calc(0.75s * var(--anim)) cubic-bezier(0.1, 0.8, 0.3, 1) var(--d) both;
}
.rSSR .spark {
  background: #fff6c8;
}
.badge.new {
  /* A vermilion paper tag stamped on the corner. */
  position: absolute;
  top: -12px;
  right: -14px;
  z-index: 4;
  padding: 5px 9px 4px;
  font: 900 15px/1 "Segoe UI", system-ui, sans-serif;
  letter-spacing: 0.12em;
  color: #fff;
  background: linear-gradient(180deg, #f0503a, #b41e18);
  border: 2px solid #ffe0b0;
  border-radius: 3px;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.6);
  rotate: 10deg;
  animation: stamp calc(0.32s * var(--anim)) cubic-bezier(0.3, 1.6, 0.5, 1) calc(0.22s * var(--anim)) both;
}
.coinrise {
  position: absolute;
  left: 50%;
  top: 40%;
  z-index: 4;
  translate: -50% 0;
  white-space: nowrap;
  font: 900 22px/1 "Segoe UI", system-ui, sans-serif;
  color: var(--gold, #ffc94d);
  text-shadow:
    0 0 8px rgba(255, 201, 77, 0.8),
    0 2px 3px #000;
  pointer-events: none;
  animation: coin calc(1.1s * var(--anim)) ease-out calc(0.3s * var(--anim)) both;
}

/* ---------- labels and footer ---------- */
.labels {
  display: flex;
  gap: 34px;
}
.label {
  width: 170px;
  min-height: 62px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity calc(0.25s * var(--anim)) calc(0.15s * var(--anim)),
    transform calc(0.25s * var(--anim)) calc(0.15s * var(--anim));
}
.label.show {
  opacity: 1;
  transform: none;
}
.rname {
  font-size: 1.05rem;
  letter-spacing: 0.04em;
}
.out {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}
.out.coin {
  color: var(--gold, #ffc94d);
}
.chev {
  width: 44px;
  height: 14px;
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.chev path {
  stroke: rgba(255, 255, 255, 0.2);
}
.chev path.on,
.chev path.up {
  stroke: #7dffb0;
  filter: drop-shadow(0 0 2px #7dffb0);
}
.show .chev path.up {
  animation: chev calc(0.5s * var(--anim)) cubic-bezier(0.3, 1.6, 0.5, 1) calc(0.4s * var(--anim)) both;
  transform-box: fill-box;
  transform-origin: center;
}
.lv {
  color: #7dffb0;
}
.pity {
  font-size: 0.75rem;
  color: var(--gold, #ffc94d);
}
.foot {
  min-height: 46px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.btn.skip {
  opacity: 0.75;
}
.small {
  font-size: 0.85rem;
  margin: 0;
}
.coins {
  margin-left: 10px;
  color: var(--gold, #ffc94d);
  font-weight: 700;
}
.flash {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 50%, #fff, #fff6d0 50%, rgba(255, 230, 150, 0.6));
  opacity: 0;
  pointer-events: none;
  z-index: 30;
}

@keyframes enter {
  from {
    transform: translateY(60vh) scale(0.7) rotate(-10deg);
  }
}
@keyframes rattle {
  from {
    transform: translate(calc(var(--amp) * -5px), 0) rotate(calc(var(--amp) * -3.5deg));
  }
  to {
    transform: translate(calc(var(--amp) * 5px), calc(var(--amp) * -2px)) rotate(calc(var(--amp) * 3.5deg));
  }
}
@keyframes swell {
  0% {
    transform: scale(1);
    filter: brightness(1);
  }
  30% {
    transform: scale(0.92);
  }
  100% {
    transform: scale(1.25);
    filter: brightness(3);
    opacity: 0;
  }
}
@keyframes tearL {
  to {
    transform: translate(-260px, -120px) rotate(-70deg);
    opacity: 0;
  }
}
@keyframes tearR {
  to {
    transform: translate(260px, 90px) rotate(80deg);
    opacity: 0;
  }
}
@keyframes crackL {
  to {
    transform: translate(-90px, -200px) rotate(-160deg);
    opacity: 0;
  }
}
@keyframes crackR {
  to {
    transform: translate(110px, -170px) rotate(140deg);
    opacity: 0;
  }
}
@keyframes light {
  0% {
    opacity: 1;
    transform: scale(0.5);
  }
  100% {
    opacity: 0;
    transform: scale(14);
  }
}
@keyframes fly {
  0% {
    transform: translate(0, 0) rotate(0);
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), calc(var(--dy) + 120px)) rotate(var(--r));
    opacity: 0;
  }
}
@keyframes tremble {
  from {
    transform: translate(calc(var(--tremble) * -1px), 0) rotate(calc(var(--tremble) * -0.4deg));
  }
  to {
    transform: translate(calc(var(--tremble) * 1px), calc(var(--tremble) * -0.5px)) rotate(calc(var(--tremble) * 0.4deg));
  }
}
@keyframes spin {
  to {
    rotate: 360deg;
  }
}
@keyframes ring {
  from {
    transform: scale(0.6);
    opacity: 1;
  }
  to {
    transform: scale(2.1);
    opacity: 0;
  }
}
@keyframes spark {
  0% {
    transform: translate(0, 0) scale(0);
    opacity: 1;
  }
  30% {
    transform: translate(calc(var(--dx) * 0.6), calc(var(--dy) * 0.6)) scale(var(--s));
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx), calc(var(--dy) + 40px)) scale(0);
    opacity: 0;
  }
}
@keyframes stamp {
  from {
    transform: scale(2.4);
    opacity: 0;
  }
}
@keyframes coin {
  0% {
    transform: translateY(10px) scale(0.6);
    opacity: 0;
  }
  20% {
    transform: translateY(0) scale(1.15);
    opacity: 1;
  }
  75% {
    opacity: 1;
  }
  100% {
    transform: translateY(-70px) scale(1);
    opacity: 0;
  }
}
@keyframes chev {
  0% {
    transform: scale(0);
    stroke: #fff;
  }
}
</style>
