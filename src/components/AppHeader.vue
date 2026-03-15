<script setup lang="ts">
import { useTranslateStore } from '../stores/translate'

const translateStore = useTranslateStore()
</script>


<template>
  <header class="app-header">
    <div class="header-left"></div>
    <div class="header-icon">
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <circle cx="10" cy="8" r="2.5" fill="#4F6EF7" opacity="0.5" />
        <circle cx="18" cy="8" r="2.5" fill="#4F6EF7" opacity="0.5" />
        <circle cx="10" cy="16" r="2.5" fill="#4F6EF7" opacity="0.7" />
        <text x="18" y="22" font-size="16" font-weight="700" fill="#4F6EF7" font-family="serif">中</text>
        <text x="22" y="34" font-size="15" font-weight="700" fill="#4F6EF7" font-family="sans-serif">A</text>
      </svg>
    </div>
    <div class="header-right">
      <button
        class="pin-btn"
        :class="{ active: translateStore.alwaysOnTop }"
        @click="translateStore.toggleAlwaysOnTop()"
        :title="translateStore.alwaysOnTop ? '取消置顶' : '窗口置顶'"
      >
        <i class="ph" :class="translateStore.alwaysOnTop ? 'ph-push-pin-simple-slash' : 'ph-push-pin-simple'"></i>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-icon {
  display: flex;
  align-items: center;
}

.clipboard-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 18px;
}

.clipboard-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-bg);
}

.clipboard-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 0 8px rgba(79, 110, 247, 0.35);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(79, 110, 247, 0.35); }
  50% { box-shadow: 0 0 14px rgba(79, 110, 247, 0.55); }
}

.header-right {
  display: flex;
  align-items: center;
}

.pin-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 17px;
  opacity: 0.6;
}

.pin-btn:hover {
  color: var(--color-primary);
  opacity: 1;
}

.pin-btn.active {
  color: var(--color-primary);
  opacity: 1;
}
</style>
