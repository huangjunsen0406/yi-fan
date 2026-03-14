<script setup lang="ts">
import { ref } from 'vue'
import { useTranslateStore } from '../stores/translate'
import { speak, stopTTS } from '../services/tts'

const store = useTranslateStore()
const speaking = ref(false)

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

    <!-- Normal output -->
    <div v-else class="output-content" :class="{ 'code-mode': store.mode === 'code' }">
      <p class="output-text">{{ store.outputText }}</p>
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
  flex-shrink: 0;
}

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
</style>
