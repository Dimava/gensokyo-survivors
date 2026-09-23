<script setup lang="ts">
import SettingsPanel from "./SettingsPanel.vue";
defineEmits<{ close: [] }>();
</script>

<template>
  <div class="screen">
    <div class="screen-head">
      <h1>Settings</h1>
      <button class="btn" @click="$emit('close')">Back <span class="key">Esc</span></button>
    </div>
    <div class="panel body">
      <SettingsPanel />
    </div>
  </div>
</template>

<style scoped>
.body {
  width: min(720px, 94vw);
  padding: 22px 26px;
  margin-bottom: 30px;
}
</style>
