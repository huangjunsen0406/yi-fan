<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTranslateStore } from '../stores/translate'
import { speak, stopTTS } from '../services/tts'

const store = useTranslateStore()
const speaking = ref(false)
const justCopied = ref(false)

const autoCopyLabel = computed(() => {
  switch (store.autoCopyMode) {
    case 'source': return '原文'
    case 'target': return '译文'
    case 'source_target': return '双语'
    default: return '自动'
  }
})

const autoCopyIcon = computed(() => {
  switch (store.autoCopyMode) {
    case 'source': return 'ph-clipboard-text'
    case 'target': return 'ph-clipboard-text'
    case 'source_target': return 'ph-files'
    default: return 'ph-clipboard-text'
  }
})

const autoCopyTitle = computed(() => {
  switch (store.autoCopyMode) {
    case 'source': return '自动复制: 原文'
    case 'target': return '自动复制: 译文'
    case 'source_target': return '自动复制: 原文+译文'
    default: return '自动复制: 关闭'
  }
})

async function handleSpeak() {
  if (speaking.value) {
    stopTTS()
    speaking.value = false
    return
  }
  if (!store.outputText.trim()) return
  speaking.value = true
  try {
    await speak(store.outputText, store.targetLang)
  } catch (e) {
    console.warn('TTS 朗读失败:', e)
  } finally {
    speaking.value = false
  }
}

async function handleCopy() {
  if (!store.outputText.trim()) return
  await store.copyToClipboard(store.outputText)
  justCopied.value = true
  setTimeout(() => { justCopied.value = false }, 1500)
}
</script>

<template>
  <section class="output-section">
    <!-- Loading indicator -->
    <div v-if="store.loading" class="output-content loading-state">
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
      <span class="loading-text">翻译中...</span>
    </div>

    <!-- Error message -->
    <div v-else-if="store.error" class="output-content error-state">
      <i class="ph ph-warning-circle error-icon"></i>
      <span class="error-text">{{ store.error }}</span>
    </div>

    <!-- Multi-engine results -->
    <div v-else-if="store.multiEngineMode && store.multiEngineResults.length > 0" class="output-content multi-results">
      <div
        v-for="result in store.multiEngineResults"
        :key="result.engine"
        class="engine-result"
        :class="{ 'has-error': result.error }"
      >
        <div class="engine-result-header">
          <span class="engine-label">{{ result.label }}</span>
          <div v-if="result.loading" class="mini-loading"></div>
          <span v-if="result.error" class="engine-error">{{ result.error }}</span>
        </div>
        <p v-if="result.text" class="engine-result-text">{{ result.text }}</p>
      </div>
    </div>

    <!-- Normal single output / bilingual display -->
    <div v-else class="output-content" :class="{ 'code-mode': store.mode === 'code' }">
      <!-- Bilingual mode: show source + target -->
      <div v-if="store.autoCopyMode === 'source_target' && store.outputText && store.inputText" class="bilingual-output">
        <p class="bilingual-source">{{ store.inputText }}</p>
        <div class="bilingual-divider"><i class="ph ph-arrow-down"></i></div>
        <p class="output-text">{{ store.outputText }}</p>
      </div>
      <!-- Normal mode -->
      <p v-else class="output-text">{{ store.outputText }}</p>
      <div v-if="store.mode === 'code'" class="code-watermark">
        &lt;code/&gt;
      </div>
    </div>

    <div class="output-footer">
      <button
        class="icon-btn"
        :class="{ 'speaking': speaking }"
        :title="speaking ? '停止' : '朗读'"
        :disabled="!store.outputText.trim()"
        @click="handleSpeak"
      >
        <i class="ph" :class="speaking ? 'ph-stop-circle' : 'ph-speaker-high'"></i>
      </button>
      <button
        class="icon-btn"
        :class="{ 'copied': justCopied }"
        :title="justCopied ? '已复制' : '复制译文'"
        :disabled="!store.outputText.trim()"
        @click="handleCopy"
      >
        <i class="ph" :class="justCopied ? 'ph-check' : 'ph-copy'"></i>
      </button>

      <div class="spacer"></div>

      <!-- Auto-copy mode cycle -->
      <button
        class="icon-btn auto-copy-btn"
        :class="{ active: store.autoCopyMode !== 'disable' }"
        :title="autoCopyTitle"
        @click="store.cycleAutoCopyMode()"
      >
        <i class="ph" :class="autoCopyIcon"></i>
        <span class="auto-label">{{ autoCopyLabel }}</span>
      </button>

      <!-- Multi-engine toggle -->
      <button
        class="icon-btn multi-btn"
        :class="{ active: store.multiEngineMode }"
        :title="store.multiEngineMode ? '多引擎: 开' : '多引擎: 关'"
        @click="store.toggleMultiEngine()"
      >
        <i class="ph ph-stack"></i>
        <span class="auto-label">并行</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.output-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px 8px;
  background: var(--color-bg-page);
}

.output-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  position: relative;
}

.output-content.code-mode {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.output-text {
  font-size: var(--font-size-lg);
  line-height: 1.7;
  color: var(--color-text);
}

.code-mode .output-text {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  font-size: 17px;
  font-weight: 500;
}

.code-watermark {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 72px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.04);
  font-family: 'SF Mono', 'Fira Code', monospace;
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
}

/* Bilingual display */
.bilingual-output {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bilingual-source {
  font-size: var(--font-size-base);
  line-height: 1.6;
  color: var(--color-text-secondary);
  opacity: 0.7;
}

.bilingual-divider {
  color: var(--color-text-placeholder);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bilingual-divider::before,
.bilingual-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border-light);
}

/* Multi-engine results */
.multi-results {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.engine-result {
  padding: 10px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  transition: border-color 0.2s;
}

.engine-result:hover {
  border-color: var(--color-primary-border);
}

.engine-result.has-error {
  opacity: 0.6;
}

.engine-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.engine-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-primary);
}

.engine-error {
  font-size: 11px;
  color: #F53F3F;
}

.engine-result-text {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--color-text);
}

.mini-loading {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.4); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

.loading-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Error state */
.error-state {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
}

.error-icon {
  font-size: 18px;
  color: #F53F3F;
  flex-shrink: 0;
  margin-top: 1px;
}

.error-text {
  font-size: var(--font-size-sm);
  color: #F53F3F;
  line-height: 1.5;
}

.output-footer {
  display: flex;
  align-items: center;
  padding-top: 8px;
  gap: 4px;
  flex-shrink: 0;
}

.spacer { flex: 1; }

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  font-size: 18px;
}

.icon-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.icon-btn.copied {
  color: #00B42A;
}

.auto-copy-btn, .multi-btn {
  width: auto;
  padding: 2px 8px;
  gap: 3px;
  font-size: 14px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
}

.auto-copy-btn.active, .multi-btn.active {
  color: var(--color-primary);
  border-color: var(--color-primary-border);
  background: var(--color-primary-bg);
}

.auto-label {
  font-size: 11px;
  font-weight: 500;
}
</style>
