<script setup lang="ts">
// Key caps for a kds virtual code ("Action:pause", "Confirm", "ArrowY"...),
// read from the bindings in keys.ts, so a hint always shows the real keys.
import { computed } from "vue";
import { keyLabels } from "../keys.ts";

const props = defineProps<{ for: string | string[]; max?: number }>();
const labels = computed(() => {
  const codes = Array.isArray(props.for) ? props.for : [props.for];
  return [...new Set(codes.flatMap((c) => keyLabels(c)))].slice(0, props.max ?? Infinity);
});
</script>

<template>
  <span v-for="l in labels" :key="l" class="key">{{ l }}</span>
</template>
