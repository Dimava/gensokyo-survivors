<script setup lang="ts">
import { computed } from "vue";
import { host, state } from "../host.ts";
import { PACKS } from "../../content/gacha.ts";
import { CARDS, RARITIES, RARITY_INFO, MAX_CARD_LEVEL } from "../../content/cards.ts";
import { CURRENCY } from "../../content/names.ts";
import { gacha, owned, wallet } from "./useGame.ts";
import PackOpening, { buyPacks, demo, fakePacks } from "./PackOpening.vue";
import CardBack from "./CardBack.vue";
import NavHints from "./NavHints.vue";

const open = computed(() => {
  void state.meta;
  return host.k.paths().includes("/pack");
});
const inRun = computed(() => {
  void state.meta;
  return !!host.path();
});
const ownedIds = computed(() => new Map(owned.value.map((o) => [o.card, o])));

function odds(packId: string) {
  const p = PACKS.find((x) => x.id === packId)!;
  const total = RARITIES.reduce((s, r) => s + p.odds[r], 0);
  return RARITIES.map((r) => {
    const pool = CARDS.filter((c) => c.rarity === r);
    return {
      r,
      pct: ((p.odds[r] / total) * 100).toFixed(1),
      have: pool.filter((c) => ownedIds.value.has(c.id)).length,
      maxed: pool.filter((c) => (ownedIds.value.get(c.id)?.level ?? 0) >= MAX_CARD_LEVEL).length,
      total: pool.length,
    };
  });
}

/** One pack, or ten in a row (a ×10 pull, shown as one opening). Alt+click pretends: free, nothing saved. */
function buy(id: string, count = 1, e?: MouseEvent): void {
  if (e?.altKey) fakePacks(id, count);
  else buyPacks(id, count);
}
/** Alt+click on the pack art pretends too (Alt+Shift: ×10), whatever the wallet says. */
function artClick(id: string, e: MouseEvent): void {
  if (e.altKey && !open.value && !demo.value) fakePacks(id, e.shiftKey ? 10 : 1);
}
</script>

<template>
  <div v-keynav="{ id: 'packs' }" class="screen packs">
    <div class="screen-head">
      <div>
        <h1>Card Packs</h1>
        <div class="sub">New skill cards join your collection (and your deck, if it has room). Duplicates level a card up.</div>
      </div>
      <div class="headr">
        <div class="coins"><span class="label">{{ CURRENCY.name }}</span> {{ CURRENCY.icon }} {{ wallet.coins }}</div>
        <button class="btn" @click="host.go('cards')">Skill Cards</button>
        <button class="btn back" @click="host.go('menu')">Back</button>
      </div>
    </div>
    <div class="shop">
      <div v-for="p in PACKS" :key="p.id" class="panel pack">
        <div class="packart" aria-hidden="true" @click="artClick(p.id, $event)">
          <CardBack class="under" />
          <CardBack />
          <div class="band"><span>御神</span><span>籤</span></div>
          <div class="seal">封</div>
          <span class="count">{{ p.cards }} cards</span>
        </div>
        <div class="info">
          <h2>{{ p.name }}</h2>
          <p class="blurb">{{ p.blurb }}</p>
          <!-- The odds per card, one column per rarity: its mark, the chance, how many of its cards you have found. -->
          <div class="odds">
            <div v-for="o in odds(p.id)" :key="o.r" class="lot" :style="{ '--rc': RARITY_INFO[o.r].css }">
              <b class="code">{{ o.r }}</b>
              <span class="rlabel">{{ RARITY_INFO[o.r].label }}</span>
              <span class="pct">{{ o.pct }}<small>%</small></span>
              <span class="have">{{ o.have }} / {{ o.total }} found<template v-if="o.maxed">, {{ o.maxed }} maxed</template></span>
            </div>
          </div>
          <!-- Pity: an omikuji stick lit for each pack since the last Super Rare or better. -->
          <div
            class="pity"
            :title="`A ${RARITY_INFO[p.pity.rarity].label} or better is guaranteed at least every ${p.pity.every} packs. Packs since your last one: ${gacha.sinceHigh}.`"
          >
            <span class="plabel">Pity</span>
            <span class="sticks" aria-hidden="true"><i v-for="n in p.pity.every" :key="n" :class="{ lit: n <= gacha.sinceHigh }"></i></span>
            <span>A {{ RARITY_INFO[p.pity.rarity].label }} or better within {{ Math.max(1, p.pity.every - gacha.sinceHigh) }} {{ Math.max(1, p.pity.every - gacha.sinceHigh) === 1 ? "pack" : "packs" }}</span>
          </div>
          <p class="muted small">Cards already at level {{ MAX_CARD_LEVEL }} refund {{ CURRENCY.name }} instead: {{ RARITIES.map((r) => `${r} ${RARITY_INFO[r].refund}`).join(", ") }}.</p>
          <div class="buys">
            <button class="btn gold buy" :disabled="wallet.coins < p.cost || inRun || open" @click="buy(p.id, 1, $event)">Open for {{ CURRENCY.icon }} {{ p.cost }}</button>
            <button class="btn gold buy" :disabled="wallet.coins < p.cost * 10 || inRun || open" @click="buy(p.id, 10, $event)">Open ×10 for {{ CURRENCY.icon }} {{ p.cost * 10 }}</button>
          </div>
          <p v-if="inRun" class="muted small">Finish your run in progress first.</p>
          <p v-else-if="wallet.coins < p.cost" class="muted small">You need {{ CURRENCY.icon }} {{ p.cost - wallet.coins }} more. Runs pay out {{ CURRENCY.name }}.</p>
          <p class="muted small">Packs opened: {{ gacha.opened }}</p>
        </div>
      </div>
    </div>
    <Transition name="fade">
      <PackOpening v-if="open || demo" :key="demo ? `demo${demo.id}` : gacha.opened" />
    </Transition>
    <NavHints v-if="!open && !demo" />
  </div>
</template>

<style scoped>
.headr {
  display: flex;
  gap: 10px;
  align-items: center;
}
.shop {
  width: min(900px, 94vw);
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 30px;
}
.pack {
  display: flex;
  gap: 24px;
  padding: 22px;
  flex-wrap: wrap;
}
.packart {
  /* The sealed bundle the opening breaks: lacquer card backs under a paper band and a vermilion seal. */
  position: relative;
  width: 170px;
  height: 250px;
  margin: 4px 6px 12px 4px;
  animation: bob calc(3s * var(--anim)) ease-in-out infinite;
}
.packart > * {
  position: absolute;
  inset: 0;
}
.packart .under {
  transform: translate(6px, 6px) rotate(3deg);
  filter: brightness(0.6);
}
.band {
  inset: 100px -8px auto;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background:
    repeating-linear-gradient(90deg, rgba(150, 128, 90, 0.1) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, #fbf6ea, #f4ecd8 55%, #e3d5b4);
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.7),
    inset 0 -2px 0 rgba(120, 90, 50, 0.4),
    0 3px 8px rgba(0, 0, 0, 0.6);
  font: 900 17px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #1b1512;
}
.seal {
  inset: 96px auto auto 56px;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 40% 35%, #f0604a, #b01e1a 60%, #6a0c0a);
  box-shadow:
    inset 0 0 0 3px rgba(255, 190, 160, 0.35),
    inset 0 0 0 6px #a31a16,
    inset 0 0 0 7px rgba(255, 210, 180, 0.5),
    0 3px 6px rgba(0, 0, 0, 0.6);
  font: 900 26px/1 "Yu Mincho", "Hiragino Mincho ProN", "MS Mincho", serif;
  color: #ffe4d4;
}
.count {
  inset: auto 0 -28px;
  text-align: center;
  font-family: var(--display);
  font-weight: 700;
  color: #d6c48c;
}
.info {
  flex: 1 1 400px;
}
.info h2 {
  margin: 0 0 6px;
}
.blurb {
  margin: 0;
  font-family: var(--display);
  font-style: italic;
  color: #d6c48c;
}
/* The odds: four lots between two gold rules, each in its rarity's colour on the mark only. */
.odds {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 14px 0 12px;
  border-block: 1px solid rgba(232, 193, 90, 0.28);
}
.lot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 10px 6px 9px;
}
.lot + .lot {
  border-left: 1px solid rgba(232, 193, 90, 0.14);
}
.code {
  font-family: var(--display);
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.15;
  color: var(--rc);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.5);
}
.rlabel {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d6c48c;
}
.pct {
  margin-top: 5px;
  font-family: var(--display);
  font-size: 1.25rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f6f0e1;
}
.pct small {
  margin-left: 1px;
  font-size: 0.7em;
  color: #b9ab8a;
}
.have {
  font-size: 0.78rem;
  color: var(--muted);
}
.pity {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 2px 0 8px;
  font-size: 0.92rem;
  color: #e6dfcd;
}
.plabel {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d6c48c;
}
/* Omikuji sticks: dark wood until drawn, then gold. */
.sticks {
  display: inline-flex;
  gap: 3px;
}
.sticks i {
  width: 5px;
  height: 17px;
  border-radius: 1px;
  background: #3a2c20;
  box-shadow: inset 0 0 0 1px rgba(214, 196, 140, 0.25);
}
.sticks i.lit {
  background: #e8c15a;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.55);
}
.small {
  font-size: 0.85rem;
  margin: 6px 0;
}
.buys {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}
.buy {
  font-size: 1.1rem;
}
@keyframes bob {
  50% {
    transform: translateY(-6px) rotate(-1deg);
  }
}
</style>
