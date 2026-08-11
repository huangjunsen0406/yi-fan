import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
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

const SAVE_DEBOUNCE_MS = 250

/**
 * Deep-clone plain data for plugin-store IPC (avoid Vue reactive Proxy).
 */
function cloneStoreValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(toRaw(value as object))) as T
}

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
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let saveChain: Promise<void> = Promise.resolve()
  /** True when setConfig happened while store was not ready — flush after init */
  let pendingSave = false

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
        if (pendingSave) {
          pendingSave = false
          await persistNow()
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

  /**
   * Write configs + enabledEngines to disk and force-flush.
   * Serialized so concurrent callers cannot interleave set/save.
   */
  async function persistNow(): Promise<void> {
    saveChain = saveChain.then(async () => {
      if (!storeInstance) {
        pendingSave = true
        // Try to init if never started (e.g. early ServicePanel blur)
        try {
          await init()
        } catch {
          /* ignore */
        }
        if (!storeInstance) return
        pendingSave = false
      }
      try {
        const rawConfigs = cloneStoreValue(configs.value)
        const rawEnabled = cloneStoreValue(enabledEngines.value)
        await storeInstance!.set('configs', rawConfigs)
        await storeInstance!.set('enabledEngines', rawEnabled)
        // Force flush: autoSave debounce alone can lose data on quit / hide
        if (typeof (storeInstance as any).save === 'function') {
          await (storeInstance as any).save()
        }
      } catch (e) {
        console.warn('Settings save failed:', e)
        throw e
      }
    })
    return saveChain
  }

  async function save() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await persistNow()
  }

  /** Debounced save — used by setConfig so typing still lands on disk */
  function scheduleSave(delayMs = SAVE_DEBOUNCE_MS) {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      void persistNow().catch(() => {
        /* logged in persistNow */
      })
    }, delayMs)
  }

  function getConfig(engineName: string): Record<string, string> {
    return configs.value[engineName] || {}
  }

  function setConfig(engineName: string, key: string, value: string) {
    if (!configs.value[engineName]) {
      configs.value[engineName] = {}
    }
    configs.value[engineName][key] = value
    // Auto-persist: don't rely solely on blur (packaged builds lose blur on switch/quit)
    scheduleSave()
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
    // Only fields with required !== false must be non-empty
    return (
      provider.configFields?.every((f) => {
        if (f.required === false) return true
        return !!config[f.key]
      }) ?? true
    )
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
