<script setup lang="ts">
import AppFooter from '../components/AppFooter.vue'
</script>

<template>
  <div class="app-layout">
    <div class="drag-region" data-tauri-drag-region></div>
    <main class="app-main">
      <router-view />
    </main>
    <AppFooter />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 0 20px 12px;
  background: var(--color-bg);
  overflow: hidden;
}

/* Overlay titlebar: full-width drag strip under traffic lights */
.drag-region {
  height: 38px;
  flex-shrink: 0;
  -webkit-app-region: drag;
  /* leave space for macOS traffic lights on the left */
  margin-left: 0;
  padding-left: 72px;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.app-main > :deep(*) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>

