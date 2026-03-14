import { defineStore } from 'pinia'
import { ref } from 'vue'
import { translate } from '../services/translate'
import { useSettingsStore } from './settings'

export const useTranslateStore = defineStore('translate', () => {
  const mode = ref<'translate' | 'code'>('translate')
  const inputText = ref('')
  const outputText = ref('')
  const detectedLang = ref('')
  const activeEngine = ref('google')
  const sourceLang = ref('自动检测')
  const targetLang = ref('英语')
  const activeFormat = ref('camelCase')
  const loading = ref(false)
  const error = ref('')

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
      outputText.value = await translate(
        activeEngine.value,
        inputText.value,
        sourceLang.value,
        targetLang.value,
        config
      )
    } catch (err: any) {
      error.value = err.message || '翻译失败'
      outputText.value = ''
    } finally {
      loading.value = false
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
  }
})
