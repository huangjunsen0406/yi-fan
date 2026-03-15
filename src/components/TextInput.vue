<script setup lang="ts">
import { computed } from 'vue'
import { speak, speakingSource } from '../services/tts'
import { useTranslateStore } from '../stores/translate'

const store = useTranslateStore()

const props = defineProps<{
  modelValue: string
  mode: 'translate' | 'code'
  detectedLang: string
  sourceLang?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
}>()

const speaking = computed(() => speakingSource.value === 'input')

async function handleSpeak() {
  if (!props.modelValue.trim()) return
  try {
    await speak(props.modelValue, props.sourceLang || props.detectedLang || '自动检测', 'input')
  } catch (e) {
    console.warn('TTS 朗读失败:', e)
  }
}

function handleDeleteNewlines() {
  store.deleteNewlines()
  emit('update:modelValue', store.inputText)
}

function handleKeydown(e: KeyboardEvent) {
  // Enter = translate, Shift+Enter = newline
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    store.doTranslate()
  }
}
</script>

<template>
  <section class="input-section">
    <textarea
      :value="modelValue"
      class="text-area"
      :placeholder="mode === 'translate' ? '请输入要翻译的文本... (Enter 翻译, Shift+Enter 换行)' : '请输入要转换的文本...'"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      @keydown="handleKeydown"
    ></textarea>
    <div class="input-footer">
      <button
        class="icon-btn"
        :class="{ 'speaking': speaking }"
        :title="speaking ? '停止' : '朗读'"
        :disabled="!modelValue.trim()"
        @click="handleSpeak"
      >
        <i class="ph" :class="speaking ? 'ph-stop-circle' : 'ph-speaker-high'"></i>
      </button>
      <button
        class="icon-btn"
        title="删除换行（清理PDF文本）"
        :disabled="!modelValue.trim()"
        @click="handleDeleteNewlines"
      >
        <i class="ph ph-text-align-justify"></i>
      </button>
      <span v-if="detectedLang" class="detected-lang">
        检测到: {{ detectedLang }}
      </span>
      <div class="spacer"></div>
      <button
        class="icon-btn translate-btn"
        title="翻译 (Enter)"
        :disabled="!modelValue.trim()"
        @click="store.doTranslate()"
      >
        <i class="ph ph-translate"></i>
      </button>
      <button v-if="modelValue" class="icon-btn clear-btn" title="清除" @click="emit('clear')">
        <i class="ph ph-x"></i>
      </button>
    </div>
  </section>
</template>

<style scoped>
.input-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 1.5px solid var(--color-primary-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px 8px;
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
}

.input-section:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(79, 110, 247, 0.08);
}

.text-area {
  flex: 1;
  width: 100%;
  font-size: var(--font-size-lg);
  line-height: 1.7;
  color: var(--color-text);
  min-height: 30px;
  border: none;
  background: none;
  resize: none;
  outline: none;
  font-family: inherit;
}

.text-area::placeholder {
  color: var(--color-text-placeholder);
}

.input-footer {
  display: flex;
  align-items: center;
  padding-top: 8px;
  gap: 8px;
  flex-shrink: 0;
}

.detected-lang {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

.spacer {
  flex: 1;
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

.clear-btn {
  font-size: 16px;
}
</style>
