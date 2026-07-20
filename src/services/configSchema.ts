/**
 * Unified configuration namespaces for settings store.
 *
 * Engine API keys stay under their provider name (`google`, `openai`, …).
 * App-level / UI / feature groups use reserved `_` prefixes:
 *
 * | Namespace     | Purpose                                      |
 * |---------------|----------------------------------------------|
 * | `_app`        | App lifecycle: update auto-check, flags      |
 * | `_ui`         | UI prefs: silent bubble, etc.                |
 * | `_hotkeys`    | Global shortcut bindings                     |
 * | `_translate`  | Default langs / default engine               |
 * | `_ocr`        | OCR options                                  |
 * | `_clipboard`  | Clipboard monitor on/off                     |
 *
 * Theme / window geometry may live in dedicated stores (theme service,
 * windowState); `_ui` is for prefs read via settings.getConfig.
 */

export const CONFIG_NS = {
  APP: '_app',
  UI: '_ui',
  HOTKEYS: '_hotkeys',
  TRANSLATE: '_translate',
  OCR: '_ocr',
  CLIPBOARD: '_clipboard',
} as const

export type ConfigNamespace = (typeof CONFIG_NS)[keyof typeof CONFIG_NS]

/** Known keys under `_app` */
export type AppConfigKey =
  | 'updateAutoCheck' // 'true' | 'false'
  | 'preferLocalDict' // 'true' | 'false' — offline/local dict priority

/** Known keys under `_ui` */
export type UiConfigKey =
  | 'silentBubble' // 'true' | 'false'
  | 'showEngineHealth' // 'true' | 'false'

/** Defaults applied when key missing */
export const APP_DEFAULTS: Record<AppConfigKey, string> = {
  updateAutoCheck: 'true',
  preferLocalDict: 'true',
}

export const UI_DEFAULTS: Record<UiConfigKey, string> = {
  silentBubble: 'true',
  showEngineHealth: 'true',
}

export interface SettingsConfigAccessor {
  getConfig(ns: string): Record<string, string>
  setConfig(ns: string, key: string, value: string): void
}

export function getAppConfig(
  settings: SettingsConfigAccessor,
  key: AppConfigKey
): string {
  return settings.getConfig(CONFIG_NS.APP)[key] ?? APP_DEFAULTS[key]
}

export function setAppConfig(
  settings: SettingsConfigAccessor,
  key: AppConfigKey,
  value: string
): void {
  settings.setConfig(CONFIG_NS.APP, key, value)
}

export function getUiConfig(
  settings: SettingsConfigAccessor,
  key: UiConfigKey
): string {
  return settings.getConfig(CONFIG_NS.UI)[key] ?? UI_DEFAULTS[key]
}

export function setUiConfig(
  settings: SettingsConfigAccessor,
  key: UiConfigKey,
  value: string
): void {
  settings.setConfig(CONFIG_NS.UI, key, value)
}

export function isTruthyConfig(value: string | undefined, defaultTrue = false): boolean {
  if (value === undefined || value === '') return defaultTrue
  return value === 'true' || value === '1'
}

/** All reserved namespaces (for docs / migration tooling) */
export const RESERVED_NAMESPACES: readonly string[] = Object.values(CONFIG_NS)
