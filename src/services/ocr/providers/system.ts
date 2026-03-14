// System OCR Provider — wraps the Rust system_ocr command (macOS Vision / Windows OCR / Linux Tesseract)
import { invoke } from '@tauri-apps/api/core'
import type { OcrProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto',
  '简体中文': 'zh-Hans',
  '繁体中文': 'zh-Hant',
  '英语': 'en-US',
  '日语': 'ja-JP',
  '韩语': 'ko-KR',
  '法语': 'fr-FR',
  '德语': 'de-DE',
}

export const systemOcr: OcrProvider = {
  name: 'system_ocr',
  label: '系统 OCR',
  icon: 'ph-desktop',
  needsConfig: false,
  description: '使用系统原生 OCR（macOS Vision / Windows OCR / Linux Tesseract），免费离线。',
  langMap,

  async recognize(_base64: string, lang: string): Promise<string> {
    // System OCR reads from the cut screenshot file directly via Rust
    const mappedLang = langMap[lang] || lang || 'auto'
    return await invoke<string>('system_ocr', { lang: mappedLang })
  },
}
