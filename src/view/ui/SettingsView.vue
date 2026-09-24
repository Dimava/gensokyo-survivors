<script setup lang="ts">
import SettingsPanel from "./SettingsPanel.vue";
import Keys from "./Keys.vue";
import NavHints from "./NavHints.vue";
defineEmits<{ close: [] }>();
</script>

<template>
  <div v-keynav class="screen">
    <div class="screen-head">
      <h1>Settings</h1>
      <button class="btn" @click="$emit('close')">Back <Keys for="Back" /></button>
    </div>
    <div class="panel body">
      <SettingsPanel />
    </div>
    <NavHints />
  </div>
</template>

<style scoped>
.body {
  width: min(720px, 94vw);
  padding: 22px 26px;
  margin-bottom: 30px;
}
</style>
