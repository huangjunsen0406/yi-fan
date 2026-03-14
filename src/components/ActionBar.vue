<template>
  <div class="action-bar">
    <button class="action-btn">
      <i class="ph ph-copy"></i>
      <span>仅复制</span>
    </button>
    <button class="action-btn">
      <i class="ph ph-arrow-bend-down-left"></i>
      <span>复制并隐藏</span>
    </button>
    <button class="action-btn">
      <i class="ph ph-pencil-simple"></i>
      <span>复制并输入</span>
    </button>
  </div>
</template>

<style scoped>
.action-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0 8px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-bg);
  transition: all var(--transition-fast);
  cursor: pointer;
  white-space: nowrap;
}

.action-btn:hover {
  border-color: var(--color-primary-border);
  background: var(--color-primary-bg);
  color: var(--color-primary);
}

.action-btn i {
  font-size: 16px;
}
</style>
