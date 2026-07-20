import { defineStore } from 'pinia'
import { ref } from 'vue'
import { load } from '@tauri-apps/plugin-store'
import { providers, type TranslateProvider } from '../services/translate'
import {
  CONFIG_NS,
  getAppConfig as schemaGetApp,
  setAppConfig as schemaSetApp,
  getUiConfig as schemaGetUi,
  setUiConfig as schemaSetUi,
  type AppConfigKey,
  type UiConfigKey,
} from '../services/configSchema'

// 默认主页显示的 4 个引擎（免费/无需额外配置即可用的）
const DEFAULT_ENABLED = ['google', 'bing', 'transmart', 'deepl']

/**
 * Settings store.
 * Engine keys: provider name → field map.
 * Reserved namespaces: `_app` `_ui` `_hotkeys` `_translate` `_ocr` `_clipboard`
 * (see `services/configSchema.ts`).
 */
export const useSettingsStore = defineStore('settings', () => {
  // Dynamic config storage: { engineName: { fieldKey: value } }
  const configs = ref<Record<string, Record<string, string>>>({})

  // 主页引擎栏显示的引擎列表
  const enabledEngines = ref<string[]>([...DEFAULT_ENABLED])

  let storeInstance: Awaited<ReturnType<typeof load>> | null = null
  let initPromise: Promise<void> | null = null

  async function init() {
    // Prevent redundant initialization: return existing promise if already in progress
    if (initPromise) return initPromise
    if (storeInstance) return

    initPromise = (async () => {
      try {
        storeInstance = await load('settings.json', { autoSave: true } as any)
        const saved = await storeInstance.get<Record<string, Record<string, string>>>('configs')
        if (saved) {
          configs.value = saved
          // Ensure reserved namespaces exist as objects
          for (const ns of Object.values(CONFIG_NS)) {
            if (!configs.value[ns]) configs.value[ns] = {}
          }
        }
        const savedEnabled = await storeInstance.get<string[]>('enabledEngines')
        if (savedEnabled && savedEnabled.length > 0) {
          enabledEngines.value = savedEnabled
        }
      } catch (e) {
        console.warn('Settings init failed (expected in browser):', e)
        // Reset so it can be retried
        storeInstance = null
      } finally {
        initPromise = null
      }
    })()
    return initPromise
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

  const accessor = {
    getConfig,
    setConfig,
  }

  function getApp(key: AppConfigKey): string {
    return schemaGetApp(accessor, key)
  }

  function setApp(key: AppConfigKey, value: string) {
    schemaSetApp(accessor, key, value)
  }

  function getUi(key: UiConfigKey): string {
    return schemaGetUi(accessor, key)
  }

  function setUi(key: UiConfigKey, value: string) {
    schemaSetUi(accessor, key, value)
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

  async function toggleEngine(engineName: string) {
    const idx = enabledEngines.value.indexOf(engineName)
    if (idx >= 0) {
      // 至少保留一个引擎
      if (enabledEngines.value.length <= 1) return
      enabledEngines.value.splice(idx, 1)
    } else {
      enabledEngines.value.push(engineName)
    }
    await save()
  }

  return {
    configs,
    enabledEngines,
    init,
    save,
    getConfig,
    setConfig,
    getApp,
    setApp,
    getUi,
    setUi,
    isConfigured,
    isEnabled,
    toggleEngine,
  }
})
