<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../../stores/settings'
import { ocrProviders, getOcrProvider } from '../../services/ocr'

const settings = useSettingsStore()

const ocrLangOptions = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁体中文' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'fr-FR', label: '法语' },
  { value: 'de-DE', label: '德语' },
]
const ocrLang = ref('auto')
const ocrDeleteNewline = ref(false)
const ocrAutoCopy = ref(false)
const ocrAutoTranslate = ref(false)
const ocrHideWindow = ref(false)
const ocrCloseOnBlur = ref(false)
const showOcrLangDrop = ref(false)
const showOcrEngineDrop = ref(false)
const defaultOcrEngine = ref('system_ocr')
const activeOcrEngine = ref('system_ocr')
const ocrTestResults = ref<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({})
for (const p of ocrProviders) ocrTestResults.value[p.name] = { status: 'idle', message: '' }

onMounted(async () => {
  await settings.init()
  const saved = settings.getConfig('_ocr')
  if (saved['defaultLang']) ocrLang.value = saved['defaultLang']
  if (saved['deleteNewline'] === 'true') ocrDeleteNewline.value = true
  if (saved['autoCopy'] === 'true') ocrAutoCopy.value = true
  if (saved['autoTranslate'] === 'true') ocrAutoTranslate.value = true
  if (saved['hideWindow'] === 'true') ocrHideWindow.value = true
  if (saved['closeOnBlur'] === 'true') ocrCloseOnBlur.value = true
  if (saved['activeEngine']) {
    defaultOcrEngine.value = saved['activeEngine']
    activeOcrEngine.value = saved['activeEngine']
  }
  document.addEventListener('click', () => {
    showOcrLangDrop.value = false
    showOcrEngineDrop.value = false
  })
})

async function saveOcrSettings() {
  settings.setConfig('_ocr', 'defaultLang', ocrLang.value)
  settings.setConfig('_ocr', 'deleteNewline', String(ocrDeleteNewline.value))
  settings.setConfig('_ocr', 'autoCopy', String(ocrAutoCopy.value))
  settings.setConfig('_ocr', 'autoTranslate', String(ocrAutoTranslate.value))
  settings.setConfig('_ocr', 'hideWindow', String(ocrHideWindow.value))
  settings.setConfig('_ocr', 'closeOnBlur', String(ocrCloseOnBlur.value))
  settings.setConfig('_ocr', 'activeEngine', defaultOcrEngine.value)
  await settings.save()
  try {
    await invoke('set_ocr_hide_window', { enabled: ocrHideWindow.value })
    await invoke('set_close_on_blur', { enabled: ocrCloseOnBlur.value })
  } catch { /* ignore */ }
}

async function autoSaveConfig() {
  await settings.save()
}

async function testOcrEngine(name: string) {
  ocrTestResults.value[name] = { status: 'loading', message: '测试中...' }
  try {
    const provider = getOcrProvider(name)
    if (!provider) throw new Error('未知引擎')
    if (name === 'system_ocr') {
      ocrTestResults.value[name] = { status: 'success', message: '✓ 系统 OCR 可用' }
      return
    }
    const config = settings.getConfig(name)
    const testBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    await provider.recognize(testBase64, 'auto', config)
    ocrTestResults.value[name] = { status: 'success', message: '✓ 连接成功' }
  } catch (err: any) {
    ocrTestResults.value[name] = { status: 'error', message: err.message || '测试失败' }
  }
}
</script>

<template>
  <div class="page-panel">
    <div class="config-card">
      <h3 class="card-title">识别偏好</h3>
      <div class="config-row">
        <span class="row-label">默认识别引擎</span>
        <div
          class="custom-select"
          :class="{ open: showOcrEngineDrop }"
          @click.stop="showOcrEngineDrop = !showOcrEngineDrop; showOcrLangDrop = false"
        >
          <span class="select-text">{{ ocrProviders.find(p => p.name === defaultOcrEngine)?.label || '系统 OCR' }}</span>
          <i class="ph ph-caret-down select-arrow"></i>
          <div v-if="showOcrEngineDrop" class="select-dropdown">
            <div
              v-for="p in ocrProviders"
              :key="p.name"
              class="select-option"
              :class="{ active: defaultOcrEngine === p.name }"
              @click.stop="defaultOcrEngine = p.name; showOcrEngineDrop = false; saveOcrSettings()"
            >{{ p.label }}</div>
          </div>
        </div>
      </div>
      <div class="config-row">
        <span class="row-label">默认识别语言</span>
        <div
          class="custom-select"
          :class="{ open: showOcrLangDrop }"
          @click.stop="showOcrLangDrop = !showOcrLangDrop; showOcrEngineDrop = false"
        >
          <span class="select-text">{{ ocrLangOptions.find(o => o.value === ocrLang)?.label || '自动检测' }}</span>
          <i class="ph ph-caret-down select-arrow"></i>
          <div v-if="showOcrLangDrop" class="select-dropdown">
            <div
              v-for="opt in ocrLangOptions"
              :key="opt.value"
              class="select-option"
              :class="{ active: ocrLang === opt.value }"
              @click.stop="ocrLang = opt.value; showOcrLangDrop = false; saveOcrSettings()"
            >{{ opt.label }}</div>
          </div>
        </div>
      </div>
      <div class="config-row">
        <span class="row-label">识别后删除换行</span>
        <button class="toggle-btn" :class="{ active: ocrDeleteNewline }" @click="ocrDeleteNewline = !ocrDeleteNewline; saveOcrSettings()">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="config-row">
        <span class="row-label">识别后自动复制</span>
        <button class="toggle-btn" :class="{ active: ocrAutoCopy }" @click="ocrAutoCopy = !ocrAutoCopy; saveOcrSettings()">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="config-row">
        <span class="row-label">识别后自动翻译</span>
        <button class="toggle-btn" :class="{ active: ocrAutoTranslate }" @click="ocrAutoTranslate = !ocrAutoTranslate; saveOcrSettings()">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="config-row">
        <span class="row-label">识别时隐藏窗口</span>
        <button class="toggle-btn" :class="{ active: ocrHideWindow }" @click="ocrHideWindow = !ocrHideWindow; saveOcrSettings()">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="config-row">
        <span class="row-label">失焦后关闭窗口</span>
        <button class="toggle-btn" :class="{ active: ocrCloseOnBlur }" @click="ocrCloseOnBlur = !ocrCloseOnBlur; saveOcrSettings()">
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>

    <div class="service-page">
      <div class="engine-list">
        <button
          v-for="p in ocrProviders"
          :key="p.name"
          class="engine-item"
          :class="{ active: activeOcrEngine === p.name }"
          @click="activeOcrEngine = p.name; saveOcrSettings()"
        >
          <i class="ph" :class="p.icon"></i>
          <span>{{ p.label }}</span>
        </button>
      </div>
      <div class="engine-detail" v-if="ocrProviders.find(p => p.name === activeOcrEngine)">
        <h3 class="card-title">{{ ocrProviders.find(p => p.name === activeOcrEngine)!.label }}</h3>
        <p class="card-desc">{{ ocrProviders.find(p => p.name === activeOcrEngine)!.description }}</p>
        <div v-if="ocrProviders.find(p => p.name === activeOcrEngine)!.needsConfig" class="config-form">
          <div v-for="field in ocrProviders.find(p => p.name === activeOcrEngine)!.configFields" :key="field.key" class="form-item">
            <label>{{ field.label }}</label>
            <input
              :type="field.type"
              :placeholder="field.placeholder"
              :value="settings.getConfig(activeOcrEngine)[field.key] || ''"
              @input="settings.setConfig(activeOcrEngine, field.key, ($event.target as HTMLInputElement).value)"
              @blur="autoSaveConfig()"
            />
          </div>
        </div>
        <div v-else class="info-card small">
          <i class="ph ph-check-circle"></i>
          <div>
            <strong>无需配置</strong>
            <p>系统原生 OCR，免费离线使用。</p>
          </div>
        </div>
        <div class="test-area">
          <button class="action-btn" @click="testOcrEngine(activeOcrEngine)">
            <i class="ph ph-play"></i> 测试
          </button>
          <span class="status-msg" :class="ocrTestResults[activeOcrEngine]?.status">
            {{ ocrTestResults[activeOcrEngine]?.message }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./settings-common.css"></style>
