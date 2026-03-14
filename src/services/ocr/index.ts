// ── OCR Provider Registry ──
// Follows the same pattern as translate providers.

import { invoke } from '@tauri-apps/api/core'
import type { OcrProvider } from './types'
import { systemOcr } from './providers/system'
import { baiduOcr } from './providers/baidu'
import { tencentOcr } from './providers/tencent'
import { volcengineOcr } from './providers/volcengine'

export type { OcrProvider, OcrConfigField } from './types'

/** All registered OCR providers */
export const ocrProviders: OcrProvider[] = [
  systemOcr,
  baiduOcr,
  tencentOcr,
  volcengineOcr,
]

/** Lookup provider by name */
export function getOcrProvider(name: string): OcrProvider | undefined {
  return ocrProviders.find(p => p.name === name)
}

/** Perform OCR using a named provider */
export async function recognize(
  engineName: string,
  base64: string,
  lang: string,
  config?: Record<string, string>
): Promise<string> {
  const provider = getOcrProvider(engineName)
  if (!provider) throw new Error(`未知 OCR 引擎: ${engineName}`)
  return provider.recognize(base64, lang, config)
}

// ── Re-export legacy helpers for RecognizeView / App.vue ──

/** Take a full screen screenshot */
export async function takeScreenshot(): Promise<string> {
  return await invoke<string>('screenshot')
}

/** Cut a region from the screenshot */
export async function cutImage(left: number, top: number, width: number, height: number): Promise<string> {
  return await invoke<string>('cut_image', { left, top, width, height })
}

/** Get base64 encoded string of the cut screenshot */
export async function getBase64(): Promise<string> {
  return await invoke<string>('get_base64')
}

/** macOS native interactive screencapture */
export async function screencaptureSelect(): Promise<boolean> {
  return await invoke<boolean>('screencapture_select')
}

/** Get currently selected text */
export async function getSelectedText(): Promise<string> {
  return await invoke<string>('get_selected_text')
}

/** Legacy wrapper: system OCR directly */
export async function systemOCR(lang: string = 'auto'): Promise<string> {
  return await invoke<string>('system_ocr', { lang })
}
