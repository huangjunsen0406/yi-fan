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

  // ── Auto-copy mode: 'disable' | 'source' | 'target' | 'source_target' ──
  type AutoCopyMode = 'disable' | 'source' | 'target' | 'source_target'
  const autoCopyMode = ref<AutoCopyMode>('disable')

  // ── Dynamic translate (auto-translate on input with debounce) ──
  const dynamicTranslate = ref(false)

  // ── Window always on top ──
  const alwaysOnTop = ref(false)


  // ── Code format labels ──
  const codeFormatLabels: Record<string, string> = {
    camelCase: '小驼峰 camelCase',
    PascalCase: '大驼峰 PascalCase',
    snake_case: '下划线 snake_case',
    'kebab-case': '短横线 kebab-case',
    'KEBAB-CASE': '大写短横线 KEBAB-CASE',
    CONSTANT_CASE: '常量 CONSTANT_CASE',
    words: '空格分词 words',
  }

  const codeFormats = Object.keys(codeFormatLabels)

  // 从 settings 加载用户设置的默认语言
  async function initDefaults() {
    const settings = useSettingsStore()
    await settings.init()
    const savedSrc = settings.getConfig('_translate')['defaultSourceLang']
    if (savedSrc) sourceLang.value = savedSrc
    const savedTgt = settings.getConfig('_translate')['defaultTargetLang']
    if (savedTgt) targetLang.value = savedTgt
    const savedAutoCopy = settings.getConfig('_translate')['autoCopyMode']
    if (savedAutoCopy && ['disable', 'source', 'target', 'source_target'].includes(savedAutoCopy)) {
      autoCopyMode.value = savedAutoCopy as AutoCopyMode
    }
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

  // ── Clipboard copy helper (pauses monitor to avoid re-triggering) ──
  async function copyToClipboard(text: string) {
    if (!text.trim()) return
    try {
      await invoke('pause_clipboard_monitor_temp')
      await invoke('clipboard_skip_next', { text })
      await writeText(text)
    } catch {
      // fallback
      try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    } finally {
      try { await invoke('resume_clipboard_monitor_temp') } catch { /* ignore */ }
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

      // Auto-copy based on mode
      if (autoCopyMode.value !== 'disable' && outputText.value) {
        await handleAutoCopy(inputText.value, outputText.value)
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
    if (autoCopyMode.value !== 'disable' && outputText.value) {
      await handleAutoCopy(inputText.value, outputText.value)
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

  // Auto-copy handler: copies based on current mode
  async function handleAutoCopy(source: string, target: string) {
    let textToCopy = ''
    switch (autoCopyMode.value) {
      case 'source':
        textToCopy = source
        break
      case 'target':
        textToCopy = target
        break
      case 'source_target':
        textToCopy = source.trim() + '\n\n' + target.trim()
        break
      default:
        return
    }
    // copyToClipboard already handles pause/resume of clipboard monitor
    await copyToClipboard(textToCopy)
  }

  // Cycle auto-copy mode: disable → target → source → source_target → disable
  async function cycleAutoCopyMode() {
    const modes: AutoCopyMode[] = ['disable', 'target', 'source', 'source_target']
    const idx = modes.indexOf(autoCopyMode.value)
    autoCopyMode.value = modes[(idx + 1) % modes.length]
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'autoCopyMode', autoCopyMode.value)
    await settings.save()
  }

  // Toggle multi-engine mode
  async function toggleMultiEngine() {
    multiEngineMode.value = !multiEngineMode.value
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'multiEngineMode', String(multiEngineMode.value))
    await settings.save()
  }

  // ── Reverse translate: swap source/target, translate outputText back ──
  async function reverseTranslate() {
    if (!outputText.value.trim()) return
    const oldOutput = outputText.value
    const oldSource = sourceLang.value
    const oldTarget = targetLang.value

    // Swap
    inputText.value = oldOutput
    sourceLang.value = oldTarget === '自动检测' ? oldTarget : oldTarget
    targetLang.value = oldSource === '自动检测' ? '简体中文' : oldSource

    await doTranslate()
  }

  // ── Delete newlines: clean up PDF-copied text ──
  function deleteNewlines() {
    if (!inputText.value.trim()) return
    inputText.value = inputText.value
      .replace(/-\s*\n/g, '')     // hyphenated line breaks
      .replace(/\n+/g, ' ')       // newlines → space
      .replace(/\s{2,}/g, ' ')    // collapse multiple spaces
      .trim()
  }

  // ── Toggle dynamic translate ──
  async function toggleDynamicTranslate() {
    dynamicTranslate.value = !dynamicTranslate.value
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'dynamicTranslate', String(dynamicTranslate.value))
    await settings.save()
  }

  // ── Cycle code naming format (Alt+Shift+U) ──
  async function cycleCodeFormat() {
    if (!outputText.value.trim()) return

    // Cycle to next format
    const idx = codeFormats.indexOf(activeFormat.value)
    activeFormat.value = codeFormats[(idx + 1) % codeFormats.length]

    // Format the current output text and copy to clipboard
    const formatted = toNamingFormat(outputText.value, activeFormat.value)
    await copyToClipboard(formatted)
    console.log(`[code-format] ${activeFormat.value}: ${formatted}`)
  }


  // ── Toggle always on top ──
  async function toggleAlwaysOnTop() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    alwaysOnTop.value = !alwaysOnTop.value
    await getCurrentWindow().setAlwaysOnTop(alwaysOnTop.value)
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
    autoCopyMode,
    dynamicTranslate,
    alwaysOnTop,
    toggleMode,
    clearInput,
    doTranslate,
    doMultiTranslate,
    initDefaults,
    detectInputLang,
    copyToClipboard,
    handleAutoCopy,
    cycleAutoCopyMode,
    toggleMultiEngine,
    reverseTranslate,
    deleteNewlines,
    toggleDynamicTranslate,
    toggleAlwaysOnTop,
    codeFormatLabels,
    cycleCodeFormat,
  }
})
