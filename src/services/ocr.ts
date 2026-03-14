// OCR service layer - calls Rust backend commands
import { invoke } from '@tauri-apps/api/core'

/**
 * Take a full screen screenshot
 * @returns Path to the saved screenshot PNG
 */
export async function takeScreenshot(): Promise<string> {
  return await invoke<string>('screenshot')
}

/**
 * Cut a region from the screenshot
 */
export async function cutImage(left: number, top: number, width: number, height: number): Promise<string> {
  return await invoke<string>('cut_image', { left, top, width, height })
}

/**
 * Get base64 encoded string of the cut screenshot
 */
export async function getBase64(): Promise<string> {
  return await invoke<string>('get_base64')
}

/**
 * Perform OCR on the cut screenshot using macOS Vision
 * @param lang Language code (e.g. 'zh-Hans', 'en-US', 'ja-JP', 'auto')
 */
export async function systemOCR(lang: string = 'auto'): Promise<string> {
  return await invoke<string>('system_ocr', { lang })
}

/**
 * macOS native interactive screencapture (region selection)
 * @returns true if screenshot was taken, false if user cancelled
 */
export async function screencaptureSelect(): Promise<boolean> {
  return await invoke<boolean>('screencapture_select')
}

/**
 * Get currently selected text (macOS only, uses Cmd+C trick)
 */
export async function getSelectedText(): Promise<string> {
  return await invoke<string>('get_selected_text')
}
