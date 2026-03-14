// ── OCR Provider interface ──

export interface OcrConfigField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
}

export interface OcrProvider {
  /** Unique engine key, e.g. 'system_ocr', 'baidu_ocr' */
  name: string
  /** Display label */
  label: string
  /** Phosphor icon class */
  icon: string
  /** Whether this engine requires API key config */
  needsConfig: boolean
  /** Description shown in settings */
  description?: string
  /** Config fields definition */
  configFields?: OcrConfigField[]
  /** Language map: display label → engine-specific code */
  langMap: Record<string, string>

  /**
   * Perform OCR on an image
   * @param base64 Base64-encoded image (PNG)
   * @param lang Language code (engine-specific)
   * @param config User config (API keys etc.)
   * @returns Recognized text
   */
  recognize(base64: string, lang: string, config?: Record<string, string>): Promise<string>
}
