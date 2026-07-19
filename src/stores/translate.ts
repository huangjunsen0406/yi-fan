import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translate } from '../services/translate'
import { useSettingsStore } from './settings'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { addHistory } from '../services/history'
import { friendlyError } from '../services/errors'
import { toNamingFormat } from '../utils/naming'

export interface EngineResult {
  engine: string
  label: string
  text: string
  loading: boolean
  error: string
}

export const useTranslateStore = defineStore('translate', () => {
  const mode = ref<'translate' | 'code'>('translate')
  const inputText = ref('')
  const outputText = ref('')
  const detectedLang = ref('')
  const activeEngine = ref('google')
  const sourceLang = ref('自动检测')
  const targetLang = ref('简体中文')
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
  const dynamicTranslate = ref(true)

  /**
   * When true, TranslateView must NOT auto-trigger doTranslate.
   * Used by silentTranslate (划词/剪贴板) so writing inputText won't race
   * and cancel the clipboard write-back.
   */
  const suppressAutoTranslate = ref(false)

  // ── Window always on top ──
  const alwaysOnTop = ref(false)

  // ── Race protection: ignore stale responses ──
  let translateSeq = 0

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

  // 从 settings 加载用户设置
  async function initDefaults() {
    const settings = useSettingsStore()
    await settings.init()
    const cfg = settings.getConfig('_translate')
    if (cfg['defaultSourceLang']) sourceLang.value = cfg['defaultSourceLang']
    if (cfg['defaultTargetLang']) targetLang.value = cfg['defaultTargetLang']
    if (cfg['autoCopyMode'] && ['disable', 'source', 'target', 'source_target'].includes(cfg['autoCopyMode'])) {
      autoCopyMode.value = cfg['autoCopyMode'] as AutoCopyMode
    }
    if (cfg['multiEngineMode'] === 'true') multiEngineMode.value = true
    if (cfg['multiEngineMode'] === 'false') multiEngineMode.value = false
    if (cfg['defaultEngine']) activeEngine.value = cfg['defaultEngine']
    // 恢复动态翻译开关（仅当明确保存过）
    if (cfg['dynamicTranslate'] === 'false') dynamicTranslate.value = false
    if (cfg['dynamicTranslate'] === 'true') dynamicTranslate.value = true
  }

  function toggleMode() {
    mode.value = mode.value === 'translate' ? 'code' : 'translate'
    // 保留原文，只清空译文与多引擎结果
    outputText.value = ''
    multiEngineResults.value = []
    error.value = ''
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
    const seq = ++translateSeq

    // Multi-engine mode
    if (multiEngineMode.value && mode.value === 'translate') {
      await doMultiTranslate(seq)
      return
    }

    if (!settings.isConfigured(activeEngine.value)) {
      error.value = `请先在设置中配置该翻译引擎的 API Key`
      return
    }

    // 自动检测语言并智能切换目标语言
    if (sourceLang.value === '自动检测' && mode.value === 'translate') {
      if (!detectedLang.value) {
        await detectInputLang()
      }
      if (seq !== translateSeq) return
      if (detectedLang.value && detectedLang.value === targetLang.value) {
        const isChinese = detectedLang.value === '简体中文' || detectedLang.value === '繁体中文'
        targetLang.value = isChinese ? '英语' : '简体中文'
      }
    }

    loading.value = true
    error.value = ''

    try {
      const config = settings.getConfig(activeEngine.value)
      const sourceSnapshot = inputText.value
      let result = ''

      if (mode.value === 'code') {
        const englishResult = await translate(
          activeEngine.value,
          sourceSnapshot,
          sourceLang.value,
          '英语',
          config
        )
        if (seq !== translateSeq) return
        result = toNamingFormat(englishResult, activeFormat.value)
      } else {
        result = await translate(
          activeEngine.value,
          sourceSnapshot,
          sourceLang.value,
          targetLang.value,
          config
        )
        if (seq !== translateSeq) return
      }

      outputText.value = result

      if (autoCopyMode.value !== 'disable' && result) {
        await handleAutoCopy(sourceSnapshot, result)
      }

      if (result) {
        await saveToHistory(sourceSnapshot, result, activeEngine.value)
      }
    } catch (err: any) {
      if (seq !== translateSeq) return
      error.value = friendlyError(err, '翻译失败')
      outputText.value = ''
    } finally {
      if (seq === translateSeq) {
        loading.value = false
      }
    }
  }

  // ── Multi-engine parallel translate ──
  async function doMultiTranslate(seq?: number) {
    const requestSeq = seq ?? ++translateSeq
    const settings = useSettingsStore()
    const engines = settings.enabledEngines

    if (engines.length === 0) return

    const { providers } = await import('../services/translate')
    const sourceSnapshot = inputText.value
    const from = sourceLang.value
    const to = targetLang.value

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

    loading.value = true
    error.value = ''
    outputText.value = ''

    // Limit concurrency to avoid rate-limits when many engines enabled
    const CONCURRENCY = 3
    let cursor = 0
    const runOne = async (engineName: string, idx: number) => {
      try {
        if (!settings.isConfigured(engineName)) {
          if (requestSeq !== translateSeq) return
          multiEngineResults.value[idx].loading = false
          multiEngineResults.value[idx].error = '未配置'
          return
        }
        const config = settings.getConfig(engineName)
        const result = await translate(engineName, sourceSnapshot, from, to, config)
        if (requestSeq !== translateSeq) return
        multiEngineResults.value[idx].text = result
        multiEngineResults.value[idx].loading = false

        if (result && !outputText.value) {
          outputText.value = result
        }
      } catch (err: any) {
        if (requestSeq !== translateSeq) return
        multiEngineResults.value[idx].loading = false
        multiEngineResults.value[idx].error = friendlyError(err, '翻译失败')
      }
    }
    const worker = async () => {
      while (cursor < engines.length) {
        const idx = cursor++
        await runOne(engines[idx], idx)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, engines.length) }, () => worker())
    )
    if (requestSeq !== translateSeq) return

    loading.value = false

    if (autoCopyMode.value !== 'disable' && outputText.value) {
      await handleAutoCopy(sourceSnapshot, outputText.value)
    }

    if (outputText.value) {
      const firstOk = multiEngineResults.value.find(r => r.text)
      await saveToHistory(sourceSnapshot, outputText.value, firstOk?.engine || engines[0])
    }
  }

  /**
   * Silent translate for selection / clipboard:
   * detect language → translate → **always write result back to clipboard** → history.
   * Suppresses dynamic auto-translate so it won't race and skip the copy.
   */
  async function silentTranslate(
    text: string,
    _options: { showWindow?: boolean } = {}
  ): Promise<{ ok: boolean; result?: string; error?: string }> {
    const trimmed = text?.trim()
    if (!trimmed) return { ok: false }

    const seq = ++translateSeq
    // Block TranslateView watchers BEFORE mutating inputText / langs
    suppressAutoTranslate.value = true
    try { await invoke('pause_clipboard_monitor_temp') } catch { /* ignore */ }

    try {
      let detected = ''
      try {
        detected = await invoke<string>('detect_language', { text: trimmed })
      } catch { /* ignore */ }

      if (seq !== translateSeq) return { ok: false }

      const isChinese = detected === '简体中文' || detected === '繁体中文'
      const from = detected || '自动检测'
      const to = isChinese ? '英语' : '简体中文'

      inputText.value = trimmed
      sourceLang.value = from
      targetLang.value = to
      detectedLang.value = detected
      if (mode.value === 'code') {
        mode.value = 'translate'
        multiEngineResults.value = []
      }

      const settings = useSettingsStore()
      await settings.init()
      const engineName = activeEngine.value
      const config = settings.getConfig(engineName)

      if (!settings.isConfigured(engineName)) {
        error.value = '请先在设置中配置该翻译引擎的 API Key'
        return { ok: false, error: error.value }
      }

      loading.value = true
      error.value = ''

      try {
        const result = await translate(engineName, trimmed, from, to, config)

        // 译文写回剪贴板是静默翻译的核心行为：即使 UI 请求序号已变，也必须执行
        if (result) {
          await copyToClipboard(result)
          try {
            await saveToHistory(trimmed, result, engineName)
          } catch { /* ignore */ }
        }

        // 仅在仍是最新请求时更新界面
        if (seq === translateSeq) {
          outputText.value = result || ''
          loading.value = false
        }

        return { ok: !!result, result: result || undefined }
      } catch (err: any) {
        const msg = friendlyError(err, '翻译失败')
        if (seq === translateSeq) {
          error.value = msg
          loading.value = false
        }
        return { ok: false, error: msg }
      }
    } finally {
      suppressAutoTranslate.value = false
      try { await invoke('resume_clipboard_monitor_temp') } catch { /* ignore */ }
    }
  }

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
    await copyToClipboard(textToCopy)
  }

  async function cycleAutoCopyMode() {
    const modes: AutoCopyMode[] = ['disable', 'target', 'source', 'source_target']
    const idx = modes.indexOf(autoCopyMode.value)
    autoCopyMode.value = modes[(idx + 1) % modes.length]
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'autoCopyMode', autoCopyMode.value)
    await settings.save()
  }

  async function toggleMultiEngine() {
    multiEngineMode.value = !multiEngineMode.value
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'multiEngineMode', String(multiEngineMode.value))
    await settings.save()
  }

  async function reverseTranslate() {
    if (!outputText.value.trim()) return
    const oldOutput = outputText.value
    const oldSource = sourceLang.value
    const oldTarget = targetLang.value

    inputText.value = oldOutput
    sourceLang.value = oldTarget
    targetLang.value = oldSource === '自动检测' ? '简体中文' : oldSource

    await doTranslate()
  }

  function deleteNewlines() {
    if (!inputText.value.trim()) return
    inputText.value = inputText.value
      .replace(/-\s*\n/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  async function toggleDynamicTranslate() {
    dynamicTranslate.value = !dynamicTranslate.value
    const settings = useSettingsStore()
    settings.setConfig('_translate', 'dynamicTranslate', String(dynamicTranslate.value))
    await settings.save()
  }

  async function cycleCodeFormat() {
    if (!outputText.value.trim()) return

    const idx = codeFormats.indexOf(activeFormat.value)
    activeFormat.value = codeFormats[(idx + 1) % codeFormats.length]

    const formatted = toNamingFormat(outputText.value, activeFormat.value)
    outputText.value = formatted
    await copyToClipboard(formatted)
  }

  async function toggleAlwaysOnTop() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    alwaysOnTop.value = !alwaysOnTop.value
    await getCurrentWindow().setAlwaysOnTop(alwaysOnTop.value)
    try {
      const { saveWindowState } = await import('../services/windowState')
      await saveWindowState({ alwaysOnTop: alwaysOnTop.value })
    } catch { /* ignore */ }
  }

  function setAlwaysOnTopState(v: boolean) {
    alwaysOnTop.value = v
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
    suppressAutoTranslate,
    alwaysOnTop,
    toggleMode,
    clearInput,
    doTranslate,
    doMultiTranslate,
    silentTranslate,
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
    setAlwaysOnTopState,
    codeFormatLabels,
    cycleCodeFormat,
  }
})
