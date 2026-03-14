<script setup lang="ts">
</script>

<template>
  <header class="app-header">
    <div class="header-logo">
    </div>
    <div class="header-icon">
      <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
        <circle cx="10" cy="8" r="2.5" fill="#4F6EF7" opacity="0.5" />
        <circle cx="18" cy="8" r="2.5" fill="#4F6EF7" opacity="0.5" />
        <circle cx="10" cy="16" r="2.5" fill="#4F6EF7" opacity="0.7" />
        <text x="18" y="22" font-size="16" font-weight="700" fill="#4F6EF7" font-family="serif">中</text>
        <text x="22" y="34" font-size="15" font-weight="700" fill="#4F6EF7" font-family="sans-serif">A</text>
      </svg>
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

.header-logo {
  display: flex;
  align-items: center;
}

.logo-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg-page);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  letter-spacing: 0.5px;
}

.header-icon {
  display: flex;
  align-items: center;
}
</style>
