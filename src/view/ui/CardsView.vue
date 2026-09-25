<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { host } from "../host.ts";
import { CARDS, RARITIES } from "../../content/cards.ts";
import { DECK_MAX, DECK_MIN } from "../../content/gacha.ts";
import { STAT_DEFS } from "../../content/stats.ts";
import { loadout, owned } from "./useGame.ts";
import CardFace from "./CardFace.vue";
import NavHints from "./NavHints.vue";

const byId = computed(() => new Map(owned.value.map((o) => [o.card, o])));
const deckSize = computed(() => owned.value.filter((o) => o.inDeck).length);
/** Hand slots a run gives (base plus shrine upgrades); a smaller deck leaves some unused (the run's hand shrinks to the deck). */
const handSlots = computed(() => STAT_DEFS.hand.base + (loadout.value.bonuses.hand ?? 0));
const sorted = computed(() => [...CARDS].sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)));

function toggle(card: string): void {
  if (!byId.value.has(card)) return;
  host.meta("deck:toggle", { card });
}

onBeforeUnmount(() => {
  if (owned.value.some((o) => o.fresh)) host.meta("cards:seen", {});
});
</script>

<template>
  <div v-keynav="{ id: 'cards' }" class="screen cards">
    <div class="screen-head">
      <div>
        <h1>Skill Cards &amp; Deck</h1>
        <div class="sub">Each run shuffles your deck; grazing draws from it.</div>
      </div>
      <div class="headr">
        <div class="deck" :class="{ full: deckSize >= DECK_MAX }">Deck {{ deckSize }} / {{ DECK_MAX }}</div>
        <button class="btn" @click="host.go('packs')">Card Packs</button>
        <button class="btn back" @click="host.go('menu')">Back</button>
      </div>
    </div>
    <p class="muted count">Collected {{ owned.length }} of {{ CARDS.length }} cards. A deck needs at least {{ DECK_MIN }} card.</p>
    <p v-if="deckSize < handSlots" class="warn">
      Your hand holds {{ handSlots }} cards, but your deck has only {{ deckSize }}: a run's hand will have {{ deckSize }} slot{{ deckSize === 1 ? "" : "s" }}. Add
      {{ handSlots - deckSize }} more to use them all.
    </p>
    <div class="grid">
      <button
        v-for="c in sorted"
        :key="c.id"
        class="slot"
        :class="{ in: byId.get(c.id)?.inDeck, missing: !byId.has(c.id) }"
        :disabled="!byId.has(c.id)"
        @click="toggle(c.id)"
      >
        <CardFace :card="c.id" :level="byId.get(c.id)?.level ?? 1" :unknown="!byId.has(c.id)" />
        <span v-if="byId.get(c.id)?.fresh" class="new">NEW</span>
        <span v-if="byId.has(c.id)" class="state">{{ byId.get(c.id)?.inDeck ? "In deck ✓" : "Not in deck" }}</span>
        <span v-if="byId.has(c.id)" class="copies muted">Copies found: {{ byId.get(c.id)?.copies }}</span>
      </button>
    </div>
    <NavHints confirm="put in or take out" />
  </div>
</template>

<style scoped>
.headr {
  display: flex;
  gap: 10px;
  align-items: center;
}
.deck {
  white-space: nowrap;
  padding: 0.4em 0.9em;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-weight: 700;
}
.deck.full {
  border-color: var(--gold);
  color: var(--gold);
}
.count {
  width: min(1100px, 94vw);
  margin: 0 0 10px;
}
/* Not an alarm: a vermilion rule beside a plain line of text. */
.warn {
  width: min(1100px, 94vw);
  margin: -4px 0 10px;
  padding-left: 10px;
  border-left: 2px solid #c8352a;
  color: #e8d9c0;
}
.grid {
  width: min(1100px, 94vw);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  padding-bottom: 30px;
}
.slot {
  position: relative;
  background: none;
  border: none;
  padding: 6px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition:
    transform calc(0.12s * var(--anim)),
    filter var(--glide),
    box-shadow var(--glide);
}
.slot:hover:not(:disabled) {
  transform: translateY(-4px);
}
.slot.in {
  background: rgba(123, 216, 143, 0.12);
  outline: 2px solid rgba(123, 216, 143, 0.7);
}
.slot:not(.in):not(.missing) :deep(.face) {
  opacity: 0.6;
}
.slot:disabled {
  cursor: default;
}
.new {
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--gold);
  color: #2a1a00;
  font-weight: 800;
  font-size: 0.75rem;
}
.state {
  font-weight: 700;
  font-size: 0.85rem;
}
.slot.in .state {
  color: #b6ffc8;
}
.copies {
  font-size: 0.75rem;
}
</style>
