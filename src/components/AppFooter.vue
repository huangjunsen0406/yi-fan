<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useTranslateStore } from '../stores/translate'

const router = useRouter()
const store = useTranslateStore()

function goToSettings() {
  router.push('/settings')
}
</script>

<template>
  <footer class="app-footer">
    <button
      class="footer-btn mode-btn"
      :title="store.mode === 'translate' ? '切换到代码模式' : '切换到翻译模式'"
      @click="store.toggleMode()"
    >
      <i v-if="store.mode === 'translate'" class="ph ph-arrows-left-right"></i>
      <i v-else class="ph ph-code"></i>
    </button>
    <button class="footer-btn settings-btn" title="设置" @click="goToSettings">
      <i class="ph ph-gear"></i>
    </button>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  flex-shrink: 0;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 20px;
  transition: all var(--transition-fast);
}

.footer-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
</style>
