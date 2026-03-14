<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useTranslateStore } from '../stores/translate'
import TextInput from '../components/TextInput.vue'
import EngineBar from '../components/EngineBar.vue'
import DragHandle from '../components/DragHandle.vue'
import TextOutput from '../components/TextOutput.vue'
import ActionBar from '../components/ActionBar.vue'

const store = useTranslateStore()

// ── Auto-translate with debounce ──
const debouncedTranslate = useDebounceFn(() => {
  store.doTranslate()
}, 600)

// Watch input text, engine, and language changes to trigger translation
watch(
  () => store.inputText,
  () => debouncedTranslate()
)

watch(
  () => [store.activeEngine, store.sourceLang, store.targetLang],
  () => {
    if (store.inputText.trim()) {
      debouncedTranslate()
    }
  }
)

// ── Ratio-based drag resize ──
const splitRatio = ref(0.5)
const viewRef = ref<HTMLElement | null>(null)

const MIN_RATIO = 0.25
const MAX_RATIO = 0.8

const inputFlex = computed(() => splitRatio.value)
const outputFlex = computed(() => 1 - splitRatio.value)

function onDrag(deltaY: number) {
  if (!viewRef.value) return

  const inputEl = viewRef.value.querySelector('.input-wrapper') as HTMLElement
  const outputEl = viewRef.value.querySelector('.output-wrapper') as HTMLElement
  if (!inputEl || !outputEl) return

  const flexibleHeight = inputEl.clientHeight + outputEl.clientHeight
  if (flexibleHeight <= 0) return

  const deltaRatio = deltaY / flexibleHeight
  const newRatio = Math.max(MIN_RATIO, Math.min(splitRatio.value + deltaRatio, MAX_RATIO))
  splitRatio.value = newRatio
}
</script>

<template>
  <div ref="viewRef" class="translate-view">
    <div class="input-wrapper" :style="{ flex: inputFlex }">
      <TextInput
        v-model="store.inputText"
        :mode="store.mode"
        :detected-lang="store.detectedLang"
        :source-lang="store.sourceLang"
        @clear="store.clearInput"
      />
    </div>

    <EngineBar
      v-model:active-engine="store.activeEngine"
      v-model:active-format="store.activeFormat"
      v-model:source-lang="store.sourceLang"
      v-model:target-lang="store.targetLang"
      :mode="store.mode"
    />

    <DragHandle @drag="onDrag" />

    <div class="output-wrapper" :style="{ flex: outputFlex }">
      <TextOutput />
    </div>

    <ActionBar />
  </div>
</template>

<style scoped>
.translate-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 0;
  gap: 0;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 0;
}

.output-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 0;
}
</style>
