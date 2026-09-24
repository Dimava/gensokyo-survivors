<script setup lang="ts">
// A level-up card's picture of an item, in the look the preferences pick (or
// the one passed in: the gallery shows each). The looks live in ./items.
import { computed } from "vue";
import { prefs } from "../prefs.ts";
import { itemLook, type ItemLook } from "./items/index.ts";

const props = defineProps<{ id: string; color: string; level?: number; max?: number; active: boolean; look?: ItemLook }>();
const component = computed(() => itemLook(props.look ?? prefs.itemArt).component);
</script>

<template>
  <component :is="component" :id="id" :color="color" :level="level" :max="max" :active="active" />
</template>
