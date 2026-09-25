<script setup lang="ts">
// The menu key legend: select, confirm, back (and any extras), read from the kds bindings.
import Keys from "./Keys.vue";

withDefaults(defineProps<{ confirm?: string; back?: string | false; extra?: [code: string, label: string][] }>(), { confirm: "confirm", back: "back", extra: () => [] });
</script>

<template>
  <div class="navhints">
    <span><Keys :for="['ArrowY', 'ArrowX']" /> select</span>
    <span><Keys for="Confirm" :max="2" /> {{ confirm }}</span>
    <span v-for="[code, label] in extra" :key="code"><Keys :for="code" /> {{ label }}</span>
    <span v-if="back"><Keys for="Back" /> {{ back }}</span>
  </div>
</template>

<style scoped>
.navhints {
  position: fixed;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  padding: 4px 12px;
  border-radius: 2px;
  background: rgba(14, 10, 9, 0.72);
  color: var(--muted);
  font-size: 0.85rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 40;
}
.navhints .key {
  margin-right: 2px;
}
@media (pointer: coarse) {
  .navhints {
    display: none;
  }
}
</style>
