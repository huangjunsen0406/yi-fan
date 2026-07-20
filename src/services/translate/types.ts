// ── Provider interface for translation engines ──

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
}

/** Provider capability flags for routing (offline / dictionary priority) */
export interface ProviderCapabilities {
  /** True if engine can work without network (local dict) */
  offline?: boolean
  /** Dictionary / word lookup style (prefer local dict when offline or single word) */
  dictionary?: boolean
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

  /** Optional capability flags */
  capabilities?: ProviderCapabilities

  /**
   * Core translate function.
   * Prefer throwing `TranslateError` from `services/errors` for structured codes;
   * the registry normalizes via `toTranslateError`.
   */
  translate(
    text: string,
    from: string,
    to: string,
    config?: Record<string, string>
  ): Promise<string>
}
