<script setup lang="ts">
import { ref, computed } from 'vue'
import { providers } from '../services/translate'
import { useSettingsStore } from '../stores/settings'

const props = defineProps<{
  activeEngine: string
  activeFormat: string
  mode: 'translate' | 'code'
  sourceLang: string
  targetLang: string
}>()

const emit = defineEmits<{
  'update:activeEngine': [value: string]
  'update:activeFormat': [value: string]
  'update:sourceLang': [value: string]
  'update:targetLang': [value: string]
}>()

// ── Engines from provider registry (filtered by user settings) ──
const settings = useSettingsStore()
const engines = computed(() =>
  providers
    .filter(p => settings.enabledEngines.includes(p.name))
    .map(p => ({ id: p.name, name: p.label, icon: p.icon }))
)

// ── Code naming formats ──
interface NamingFormat {
  id: string
  label: string
}

const namingFormats: NamingFormat[] = [
  { id: 'camelCase', label: '驼峰(小)' },
  { id: 'PascalCase', label: '驼峰(大)' },
  { id: 'snake_case', label: '下划线' },
  { id: 'kebab-case', label: '中划线(小)' },
  { id: 'KEBAB-CASE', label: '中划线(大)' },
  { id: 'words', label: '分词(小)' },
]

// ── Language options (translate mode) ──
const sourceLanguages = [
  '自动检测', '简体中文', '繁体中文', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语', '文言文',
]
const targetLanguages = [
  '中文-简', '中文-繁', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语',
]

const showLangDropdown = ref(false)
const showFormatDropdown = ref(false)

const activeFormatLabel = computed(() => {
  return namingFormats.find(f => f.id === props.activeFormat)?.label || '驼峰(小)'
})

function toggleLangDropdown() {
  showLangDropdown.value = !showLangDropdown.value
  showFormatDropdown.value = false
}

function selectSourceLang(lang: string) {
  emit('update:sourceLang', lang)
}

function selectTargetLang(lang: string) {
  emit('update:targetLang', lang)
  showLangDropdown.value = false
}

function selectFormat(id: string) {
  emit('update:activeFormat', id)
  showFormatDropdown.value = false
}

function toggleFormatDropdown() {
  showFormatDropdown.value = !showFormatDropdown.value
  showLangDropdown.value = false
}

function onClickOutside() {
  showFormatDropdown.value = false
  showLangDropdown.value = false
}

// Expose for parent to call
defineExpose({ onClickOutside })
</script>

<template>
  <div class="middle-bar">
    <div class="engine-tabs">
      <button
        v-for="engine in engines"
        :key="engine.id"
        class="engine-tab"
        :class="{ active: activeEngine === engine.id }"
        @click="emit('update:activeEngine', engine.id)"
      >
        <span class="engine-icon">
          <i class="ph" :class="engine.icon"></i>
        </span>
        <span class="engine-name">{{ engine.name }}</span>
      </button>
    </div>

    <div class="middle-controls">
      <!-- Bookmark -->
      <button class="icon-btn" title="收藏">
        <i class="ph ph-bookmark-simple"></i>
      </button>

      <div class="controls-divider"></div>

      <!-- Translate mode: language selector -->
      <div v-if="mode === 'translate'" class="lang-dropdown-wrapper">
        <button class="lang-selector" @click.stop="toggleLangDropdown">
          <span class="lang-label">{{ sourceLang }}</span>
          <i class="ph ph-arrow-right lang-arrow"></i>
          <span class="lang-label">{{ targetLang }}</span>
          <i class="ph" :class="showLangDropdown ? 'ph-caret-up' : 'ph-caret-down'" style="font-size: 12px; margin-left: 2px; color: var(--color-text-secondary)"></i>
        </button>
        <div v-if="showLangDropdown" class="lang-dropdown">
          <div class="lang-dropdown-columns">
            <div class="lang-column">
              <div class="lang-column-title">源语言</div>
              <button
                v-for="lang in sourceLanguages"
                :key="'s-' + lang"
                class="lang-option"
                :class="{ active: sourceLang === lang }"
                @click.stop="selectSourceLang(lang)"
              >
                {{ lang }}
              </button>
            </div>
            <div class="lang-column-divider"></div>
            <div class="lang-column">
              <div class="lang-column-title">目标语言</div>
              <button
                v-for="lang in targetLanguages"
                :key="'t-' + lang"
                class="lang-option"
                :class="{ active: targetLang === lang }"
                @click.stop="selectTargetLang(lang)"
              >
                {{ lang }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Code mode: naming format dropdown -->
      <div v-else class="format-dropdown-wrapper">
        <button class="format-selector" @click.stop="toggleFormatDropdown">
          <span>{{ activeFormatLabel }}</span>
          <i class="ph" :class="showFormatDropdown ? 'ph-caret-up' : 'ph-caret-down'"></i>
        </button>
        <div v-if="showFormatDropdown" class="format-dropdown">
          <button
            v-for="format in namingFormats"
            :key="format.id"
            class="format-option"
            :class="{ active: activeFormat === format.id }"
            @click.stop="selectFormat(format.id)"
          >
            {{ format.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.middle-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  flex-shrink: 0;
  gap: 8px;
}

.engine-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.engine-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  white-space: nowrap;
  cursor: pointer;
}

.engine-tab:hover {
  background: var(--color-bg-hover);
}

.engine-tab.active {
  color: var(--color-primary);
  font-weight: 500;
}

.engine-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.youdao-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #E74C3C;
  color: white;
  font-size: 11px;
  font-weight: 700;
  border-radius: 3px;
}

.google-g {
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(135deg, #4285F4, #EA4335, #FBBC05, #34A853);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.active .tencent-icon svg circle,
.active .tencent-icon svg path {
  stroke: #1A73E8;
}

/* Middle controls */
.middle-controls {
  display: flex;
  align-items: center;
  gap: 6px;
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

.controls-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border);
  margin: 0 4px;
}

.lang-dropdown-wrapper {
  position: relative;
}

.lang-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: var(--font-size-sm);
  white-space: nowrap;
  background: var(--color-bg);
}

.lang-selector:hover {
  border-color: var(--color-primary-border);
  background: var(--color-bg-hover);
}

.lang-label {
  font-weight: 500;
  color: var(--color-text);
}

.lang-arrow {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.lang-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 8px;
  z-index: 100;
  min-width: 260px;
}

.lang-dropdown-columns {
  display: flex;
  gap: 0;
}

.lang-column {
  flex: 1;
  min-width: 0;
  max-height: 200px;
  overflow-y: auto;
}

.lang-column-title {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  padding: 4px 10px 6px;
  font-weight: 500;
}

.lang-column-divider {
  width: 1px;
  background: var(--color-border-light);
  margin: 4px 4px;
}

.lang-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  transition: background var(--transition-fast);
  cursor: pointer;
  white-space: nowrap;
}

.lang-option:hover {
  background: var(--color-bg-hover);
}

.lang-option.active {
  color: var(--color-primary);
  font-weight: 500;
  background: var(--color-primary-bg);
}

/* Format dropdown */
.format-dropdown-wrapper {
  position: relative;
}

.format-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-bg);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.format-selector:hover {
  border-color: var(--color-primary-border);
  background: var(--color-bg-hover);
}

.format-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 100;
}

.format-option {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  transition: background var(--transition-fast);
  cursor: pointer;
}

.format-option:hover {
  background: var(--color-bg-hover);
}

.format-option.active {
  color: var(--color-primary);
  font-weight: 500;
  background: var(--color-primary-bg);
}
</style>
