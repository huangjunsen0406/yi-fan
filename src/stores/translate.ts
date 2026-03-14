import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translate } from '../services/translate'
import { useSettingsStore } from './settings'

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

  // 从 settings 加载用户设置的默认语言
  async function initDefaults() {
    const settings = useSettingsStore()
    await settings.init()
    const savedSrc = settings.getConfig('_translate')['defaultSourceLang']
    if (savedSrc) sourceLang.value = savedSrc
    const savedTgt = settings.getConfig('_translate')['defaultTargetLang']
    if (savedTgt) targetLang.value = savedTgt
  }

  function toggleMode() {
    mode.value = mode.value === 'translate' ? 'code' : 'translate'
    inputText.value = ''
    outputText.value = ''
  }

  function clearInput() {
    inputText.value = ''
    outputText.value = ''
    detectedLang.value = ''
    error.value = ''
  }

  async function doTranslate() {
    if (!inputText.value.trim()) {
      outputText.value = ''
      return
    }

    const settings = useSettingsStore()
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
    } catch (err: any) {
      error.value = err.message || '翻译失败'
      outputText.value = ''
    } finally {
      loading.value = false
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
    toggleMode,
    clearInput,
    doTranslate,
    initDefaults,
  }
})
