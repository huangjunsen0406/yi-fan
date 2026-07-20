<script setup lang="ts">
import { ref } from 'vue'
import { markOnboardingDone, ONBOARDING_STEPS } from '../services/onboarding'

const emit = defineEmits<{ close: [] }>()
const step = ref(0)
const steps = ONBOARDING_STEPS

async function finish() {
  await markOnboardingDone()
  emit('close')
}

function next() {
  if (step.value < steps.length - 1) step.value++
  else void finish()
}
</script>

<template>
  <div class="ob-mask" role="dialog" aria-modal="true" aria-labelledby="ob-title">
    <div class="ob-card">
      <div class="ob-step">{{ step + 1 }} / {{ steps.length }}</div>
      <h2 id="ob-title" class="ob-title">{{ steps[step].title }}</h2>
      <p class="ob-body">{{ steps[step].body }}</p>
      <div class="ob-actions">
        <button v-if="step < steps.length - 1" class="ob-btn ghost" @click="finish">跳过</button>
        <button class="ob-btn primary" @click="next">
          {{ step < steps.length - 1 ? '下一步' : '开始使用' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ob-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.ob-card {
  width: min(420px, 100%);
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: 24px 22px 18px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
}
.ob-step {
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-bottom: 8px;
}
.ob-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: 10px;
}
.ob-body {
  font-size: 13px;
  line-height: 1.65;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  min-height: 88px;
}
.ob-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
.ob-btn {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-size: 13px;
  cursor: pointer;
  border: none;
}
.ob-btn.primary {
  background: var(--color-primary);
  color: #fff;
}
.ob-btn.ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.ob-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
