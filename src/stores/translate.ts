import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translate } from '../services/translate'
import { useSettingsStore } from './settings'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { addHistory } from '../services/history'

export interface EngineResult {
  engine: string
  label: string
  text: string
  loading: boolean
  error: string
}

export const useTranslateStore = defineStore('translate', () => {
  const mode = ref<'translate' | 'code'>('code')
  const inputText = ref('')
  const outputText = ref('')
  const detectedLang = ref('')
  const activeEngine = ref('google')
  const sourceLang = ref('自动检测')
  const targetLang = ref('英语')
  const activeFormat = ref('camelCase')
  const loading = ref(false)
  const error = ref('')

  // ── Multi-engine results ──
  const multiEngineResults = ref<EngineResult[]>([])
  const multiEngineMode = ref(false)

  // ── Auto-copy ──
  const autoCopy = ref(false)

  // 从 settings 加载用户设置的默认语言
  async function initDefaults() {
    const settings = useSettingsStore()
    await settings.init()
    const savedSrc = settings.getConfig('_translate')['defaultSourceLang']
    if (savedSrc) sourceLang.value = savedSrc
    const savedTgt = settings.getConfig('_translate')['defaultTargetLang']
    if (savedTgt) targetLang.value = savedTgt
    const savedAutoCopy = settings.getConfig('_translate')['autoCopy']
    if (savedAutoCopy === 'true') autoCopy.value = true
    const savedMulti = settings.getConfig('_translate')['multiEngineMode']
    if (savedMulti === 'true') multiEngineMode.value = true
  }

  function toggleMode() {
    mode.value = mode.value === 'translate' ? 'code' : 'translate'
    inputText.value = ''
    outputText.value = ''
    multiEngineResults.value = []
  }

  function clearInput() {
    inputText.value = ''
    outputText.value = ''
    detectedLang.value = ''
    error.value = ''
    multiEngineResults.value = []
  }

  // ── Language detection (Rust lingua) ──
  async function detectInputLang() {
    if (!inputText.value.trim()) {
      detectedLang.value = ''
      return
    }
    try {
      const lang = await invoke<string>('detect_language', { text: inputText.value })
      detectedLang.value = lang
    } catch {
      detectedLang.value = ''
    }
  }

  // ── Auto-copy helper ──
  async function copyToClipboard(text: string) {
    if (!text.trim()) return
    try {
      await writeText(text)
    } catch {
      // fallback
      try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    }
  }

  // ── Save to history ──
  async function saveToHistory(sourceText: string, resultText: string, engineName: string) {
    try {
      await addHistory({
        source_text: sourceText,
        result_text: resultText,
        engine: engineName,
        source_lang: sourceLang.value,
        target_lang: targetLang.value,
      })
    } catch (e) {
      console.warn('Save history failed:', e)
    }
  }

  // ── Single-engine translate ──
  async function doTranslate() {
    if (!inputText.value.trim()) {
      outputText.value = ''
      return
    }

    const settings = useSettingsStore()

    // Multi-engine mode
    if (multiEngineMode.value && mode.value === 'translate') {
      await doMultiTranslate()
      return
    }

    if (!settings.isConfigured(activeEngine.value)) {
      error.value = `请先在设置中配置该翻译引擎的 API Key`
      return
    }

    loading.value = true
    error.value = ''

    try {
      const config = settings.getConfig(activeEngine.value)

      if (mode.value === 'code') {
        // Code 模式：先翻译成英文，再转格式
        const englishResult = await translate(
          activeEngine.value,
          inputText.value,
          sourceLang.value,
          '英语',
          config
        )
        outputText.value = toNamingFormat(englishResult, activeFormat.value)
      } else {
        outputText.value = await translate(
          activeEngine.value,
          inputText.value,
          sourceLang.value,
          targetLang.value,
          config
        )
      }

      // Auto-copy
      if (autoCopy.value && outputText.value) {
        await copyToClipboard(outputText.value)
      }

      // Save history
      if (outputText.value) {
        await saveToHistory(inputText.value, outputText.value, activeEngine.value)
      }
    } catch (err: any) {
      error.value = err.message || '翻译失败'
      outputText.value = ''
    } finally {
      loading.value = false
    }
  }

  // ── Multi-engine parallel translate ──
  async function doMultiTranslate() {
    const settings = useSettingsStore()
    const engines = settings.enabledEngines

    if (engines.length === 0) return

    // Initialize results
    const { providers } = await import('../services/translate')
    multiEngineResults.value = engines.map(name => {
      const p = providers.find(pp => pp.name === name)
      return {
        engine: name,
        label: p?.label || name,
        text: '',
        loading: true,
        error: '',
      }
    })

    // Also set main output from first engine
    loading.value = true
    error.value = ''

    // Fire all in parallel
    const promises = engines.map(async (engineName, idx) => {
      try {
        if (!settings.isConfigured(engineName)) {
          multiEngineResults.value[idx].loading = false
          multiEngineResults.value[idx].error = '未配置'
          return
        }
        const config = settings.getConfig(engineName)
        const result = await translate(
          engineName,
          inputText.value,
          sourceLang.value,
          targetLang.value,
          config
        )
        multiEngineResults.value[idx].text = result
        multiEngineResults.value[idx].loading = false

        // First successful result becomes main output
        if (idx === 0 || !outputText.value) {
          outputText.value = result
        }
      } catch (err: any) {
        multiEngineResults.value[idx].loading = false
        multiEngineResults.value[idx].error = err.message || '翻译失败'
      }
    })

    await Promise.allSettled(promises)
    loading.value = false

    // Auto-copy first successful result
    if (autoCopy.value && outputText.value) {
      await copyToClipboard(outputText.value)
    }

    // Save first successful result to history
    if (outputText.value) {
      await saveToHistory(inputText.value, outputText.value, engines[0])
    }
  }

  // 将英文文本转换为代码命名格式
  function toNamingFormat(text: string, format: string): string {
    // 拆词：英文翻译结果 → 单词数组
    const words = text
      .replace(/[^\w\s]/g, '') // 去标点
      .trim()
      .split(/[\s_\-]+/)
      .filter(Boolean)
      .map(w => w.toLowerCase())

    if (words.length === 0) return text

    switch (format) {
      case 'camelCase':
        return words[0] + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('')
      case 'PascalCase':
        return words.map(w => w[0].toUpperCase() + w.slice(1)).join('')
      case 'snake_case':
        return words.join('_')
      case 'kebab-case':
        return words.join('-')
      case 'KEBAB-CASE':
        return words.map(w => w.toUpperCase()).join('-')
      case 'CONSTANT_CASE':
        return words.map(w => w.toUpperCase()).join('_')
      case 'words':
        return words.join(' ')
      default:
        return words[0] + words.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('')
    }
  }

  // Toggle auto-copy
  async function toggleAutoCopy() {
    autoCopy.value = !autoCopy.value
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'autoCopy', String(autoCopy.value))
    await settings.save()
  }

  // Toggle multi-engine mode
  async function toggleMultiEngine() {
    multiEngineMode.value = !multiEngineMode.value
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'multiEngineMode', String(multiEngineMode.value))
    await settings.save()
  }

  return {
    mode,
    inputText,
    outputText,
    detectedLang,
    activeEngine,
    sourceLang,
    targetLang,
    activeFormat,
    loading,
    error,
    multiEngineResults,
    multiEngineMode,
    autoCopy,
    toggleMode,
    clearInput,
    doTranslate,
    doMultiTranslate,
    initDefaults,
    detectInputLang,
    copyToClipboard,
    toggleAutoCopy,
    toggleMultiEngine,
  }
})
