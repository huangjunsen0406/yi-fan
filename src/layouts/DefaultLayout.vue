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

.drag-region {
  height: 28px;
  flex-shrink: 0;
  -webkit-app-region: drag;
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

