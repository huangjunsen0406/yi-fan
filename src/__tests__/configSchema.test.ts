import { describe, it, expect } from 'vitest'
import {
  CONFIG_NS,
  APP_DEFAULTS,
  UI_DEFAULTS,
  getAppConfig,
  setAppConfig,
  getUiConfig,
  setUiConfig,
  isTruthyConfig,
  RESERVED_NAMESPACES,
} from '../services/configSchema'

describe('configSchema', () => {
  it('exposes reserved namespaces', () => {
    expect(RESERVED_NAMESPACES).toContain('_app')
    expect(RESERVED_NAMESPACES).toContain('_ui')
    expect(CONFIG_NS.APP).toBe('_app')
    expect(CONFIG_NS.UI).toBe('_ui')
  })

  it('reads defaults and sets via accessor', () => {
    const bag: Record<string, Record<string, string>> = {}
    const settings = {
      getConfig(ns: string) {
        return bag[ns] || {}
      },
      setConfig(ns: string, key: string, value: string) {
        if (!bag[ns]) bag[ns] = {}
        bag[ns][key] = value
      },
    }
    expect(getAppConfig(settings, 'preferLocalDict')).toBe(APP_DEFAULTS.preferLocalDict)
    setAppConfig(settings, 'preferLocalDict', 'false')
    expect(getAppConfig(settings, 'preferLocalDict')).toBe('false')

    expect(getUiConfig(settings, 'silentBubble')).toBe(UI_DEFAULTS.silentBubble)
    setUiConfig(settings, 'silentBubble', 'false')
    expect(getUiConfig(settings, 'silentBubble')).toBe('false')
  })

  it('isTruthyConfig', () => {
    expect(isTruthyConfig('true')).toBe(true)
    expect(isTruthyConfig('false')).toBe(false)
    expect(isTruthyConfig(undefined, true)).toBe(true)
  })
})
