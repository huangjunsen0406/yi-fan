import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load } from '@tauri-apps/plugin-store'
import { providers, type TranslateProvider } from '../services/translate'

// 默认主页显示的 4 个引擎（免费/无需额外配置即可用的）
const DEFAULT_ENABLED = ['google', 'bing', 'transmart', 'deepl']

export const useSettingsStore = defineStore('settings', () => {
  // Dynamic config storage: { engineName: { fieldKey: value } }
  const configs = ref<Record<string, Record<string, string>>>({})

  // 主页引擎栏显示的引擎列表
  const enabledEngines = ref<string[]>([...DEFAULT_ENABLED])

  let storeInstance: Awaited<ReturnType<typeof load>> | null = null

  async function init() {
    try {
      storeInstance = await load('settings.json', { autoSave: true } as any)
      const saved = await storeInstance.get<Record<string, Record<string, string>>>('configs')
      if (saved) {
        configs.value = saved
      }
      const savedEnabled = await storeInstance.get<string[]>('enabledEngines')
      if (savedEnabled && savedEnabled.length > 0) {
        enabledEngines.value = savedEnabled
      }
    } catch (e) {
      console.warn('Settings init failed (expected in browser):', e)
    }
  }

  async function save() {
    if (!storeInstance) return
    await storeInstance.set('configs', configs.value)
    await storeInstance.set('enabledEngines', enabledEngines.value)
  }

  function getConfig(engineName: string): Record<string, string> {
    return configs.value[engineName] || {}
  }

  function setConfig(engineName: string, key: string, value: string) {
    if (!configs.value[engineName]) {
      configs.value[engineName] = {}
    }
    configs.value[engineName][key] = value
  }

  function isConfigured(engineName: string): boolean {
    const provider = providers.find((p: TranslateProvider) => p.name === engineName)
    if (!provider || !provider.needsConfig) return true
    const config = getConfig(engineName)
    return provider.configFields?.every((f) => !!config[f.key]) ?? true
  }

  function isEnabled(engineName: string): boolean {
    return enabledEngines.value.includes(engineName)
  }

  function toggleEngine(engineName: string) {
    const idx = enabledEngines.value.indexOf(engineName)
    if (idx >= 0) {
      // 至少保留一个引擎
      if (enabledEngines.value.length <= 1) return
      enabledEngines.value.splice(idx, 1)
    } else {
      enabledEngines.value.push(engineName)
    }
  }

  return {
    configs,
    enabledEngines,
    init,
    save,
    getConfig,
    setConfig,
    isConfigured,
    isEnabled,
    toggleEngine,
  }
})
