// ── Provider interface for translation engines ──

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
}

export interface TranslateProvider {
  /** Unique engine key, e.g. 'google', 'baidu' */
  name: string
  /** Display label, e.g. '谷歌翻译' */
  label: string
  /** Phosphor icon class, e.g. 'ph-globe-simple' */
  icon: string
  /** Whether this engine requires API key configuration */
  needsConfig: boolean
  /** Help URL for getting API keys */
  helpUrl?: string
  /** Description shown in settings */
  description?: string

  /** Config fields definition (only for engines that need config) */
  configFields?: ConfigField[]

  /** Supported language map: display name → engine-specific code */
  langMap: Record<string, string>

  /** Core translate function */
  translate(text: string, from: string, to: string, config?: Record<string, string>): Promise<string>
}
