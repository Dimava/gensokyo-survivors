<script setup lang="ts">
// Idle expeditions: send companions away for real time; claim what they bring back.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { host, state } from "../host.ts";
import { audio } from "../audio.ts";
import { CHARACTERS, CURRENCY, type CharacterId } from "../../content/names.ts";
import { DESTINATIONS, MAX_EXPEDITIONS, destination } from "../../content/expeditions.ts";
import { hex, wallet } from "./useGame.ts";

const picked = ref<string>("");
const confirmRecall = ref("");
const now = ref(0);
let timer = 0;
onMounted(() => {
  now.value = host.idleNow();
  timer = window.setInterval(() => (now.value = host.idleNow()), 250);
});
onBeforeUnmount(() => clearInterval(timer));

const charOf = (id: string) => CHARACTERS[id as CharacterId];

const companions = computed(() => {
  void state.meta;
  const v = host.k.view();
  const trips = v.derived("trips");
  return v.derived("companions").map((id) => {
    const c = charOf(id);
    return { id, short: c.short, title: c.title, color: hex(c.color), away: trips.some((t) => t.expedition.who === id) };
  });
});

const trips = computed(() => {
  void state.meta;
  return host.k
    .view()
    .derived("trips")
    .map((t) => {
      const d = destination(t.expedition.dest);
      const left = Math.max(0, t.expedition.endsAt - now.value);
      return {
        id: t.id,
        who: charOf(t.expedition.who).short,
        color: hex(charOf(t.expedition.who).color),
        dest: d,
        back: t.expedition.back,
        left,
        frac: Math.min(1, 1 - left / d.seconds),
      };
    });
});

const full = computed(() => trips.value.length >= MAX_EXPEDITIONS);

function fmt(seconds: number): string {
  const s = Math.ceil(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}
function pick(id: string): void {
  picked.value = picked.value === id ? "" : id;
  audio.play("ui");
}
function send(dest: string): void {
  if (!picked.value) return;
  const res = host.meta("expedition:send", { who: picked.value, dest });
  if (res.ok) picked.value = "";
}
function claim(trip: string): void {
  host.meta("expedition:claim", { trip });
}
function recall(trip: string): void {
  confirmRecall.value = "";
  host.meta("expedition:recall", { trip });
}
</script>

<template>
  <div class="screen">
    <div class="screen-head">
      <div>
        <h1>Expeditions</h1>
        <div class="sub">
          Companions leave the shrine for real time, even while the game is closed, and bring back {{ CURRENCY.name }}. Up to {{ MAX_EXPEDITIONS }} at once.
        </div>
      </div>
      <div class="headr">
        <div class="coins"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
        <button class="btn" @click="host.go('menu')">Back <span class="key">Esc</span></button>
      </div>
    </div>
    <div class="body">
      <section class="panel box">
        <h3>1. Choose a companion</h3>
        <div class="comps">
          <button v-for="c in companions" :key="c.id" class="comp" :class="{ sel: picked === c.id, away: c.away }" :disabled="c.away" @click="pick(c.id)">
            <i :style="{ background: c.color }"></i>
            <b>{{ c.short }}</b>
            <span class="muted">{{ c.away ? "Away" : c.title }}</span>
          </button>
        </div>
        <p class="muted small">More companions join when you collect one of their skill cards (Marisa, Sakuya, Yukari) from Card Packs.</p>
      </section>
      <section class="panel box">
        <h3>2. Send them somewhere</h3>
        <div v-for="d in DESTINATIONS" :key="d.id" class="dest">
          <div>
            <b>{{ d.name }}</b>
            <div class="muted small">{{ d.blurb }}</div>
          </div>
          <div class="meta">
            <span>{{ fmt(d.seconds) }}</span>
            <span class="gold">{{ CURRENCY.icon }} {{ d.coins }}</span>
          </div>
          <button class="btn small" :disabled="!picked || full" @click="send(d.id)">
            {{ full ? "All slots busy" : picked ? `Send ${charOf(picked).short}` : "Pick a companion" }}
          </button>
        </div>
      </section>
      <section class="panel box wide">
        <h3>Away now</h3>
        <p v-if="!trips.length" class="muted">Nobody is away.</p>
        <TransitionGroup name="pop">
          <div v-for="t in trips" :key="t.id" class="trip" :class="{ back: t.back }">
            <i :style="{ background: t.color }"></i>
            <div class="grow">
              <div>
                <b>{{ t.who }}</b> · {{ t.dest.name }}
              </div>
              <div class="bar"><div class="fill" :style="{ width: (t.back ? 100 : t.frac * 100) + '%' }"></div></div>
              <div class="muted small">{{ t.back ? "Back at the shrine!" : `Back in ${fmt(t.left)}` }}</div>
            </div>
            <button v-if="t.back" class="btn gold small" @click="claim(t.id)">Claim {{ CURRENCY.icon }} {{ t.dest.coins }}</button>
            <template v-else>
              <button v-if="confirmRecall !== t.id" class="btn small ghost" @click="confirmRecall = t.id">Call back…</button>
              <span v-else class="confirm">
                No reward if called back.
                <button class="btn small primary" @click="recall(t.id)">Call back</button>
                <button class="btn small" @click="confirmRecall = ''">Let them go on</button>
              </span>
            </template>
          </div>
        </TransitionGroup>
      </section>
    </div>
  </div>
</template>

<style scoped>
.headr {
  display: flex;
  gap: 10px;
  align-items: center;
}
.body {
  width: min(1000px, 94vw);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-bottom: 30px;
}
.box {
  padding: 18px 20px;
}
.box.wide {
  grid-column: 1 / -1;
}
h3 {
  margin: 0 0 10px;
  color: var(--cyan);
}
.comps {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.comp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 132px;
  padding: 10px;
  border-radius: 12px;
  border: 2px solid var(--line);
  background: rgba(255, 255, 255, 0.03);
  font-size: 0.85rem;
  text-align: center;
}
.comp i {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.comp.sel {
  border-color: var(--gold);
  box-shadow: 0 0 14px rgba(255, 201, 77, 0.5);
}
.comp.away {
  opacity: 0.45;
}
.dest {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.9rem;
}
.gold {
  color: var(--gold);
  font-weight: 700;
}
.small {
  font-size: 0.8rem;
}
.trip {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
}
.trip i {
  flex: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.grow {
  flex: 1;
}
.bar {
  height: 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.4);
  overflow: hidden;
  margin: 4px 0;
}
.fill {
  height: 100%;
  background: linear-gradient(90deg, #4da3ff, #6fd3ff);
  transition: width calc(0.25s * var(--anim));
}
.trip.back .fill {
  background: linear-gradient(90deg, #ffc94d, #ffe39a);
}
.confirm {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 0.85rem;
}
</style>
