// ── Global hotkey service (single source of truth) ──
// Rust only initializes the plugin; all registration happens here from settings.

import { invoke } from '@tauri-apps/api/core'
import {
  register,
  unregister,
  unregisterAll,
  isRegistered,
} from '@tauri-apps/plugin-global-shortcut'

export interface HotkeyDef {
  id: string
  label: string
  /** Tauri command name to invoke */
  command: string
  defaultValue: string
}

/** Canonical hotkey definitions used by Settings UI and app bootstrap */
export const HOTKEY_DEFS: HotkeyDef[] = [
  { id: 'toggle', label: '唤出/隐藏窗口', command: 'toggle_window', defaultValue: 'Control+Cmd+Space' },
  { id: 'selection', label: '划词翻译', command: 'selection_translate', defaultValue: 'Control+Cmd+D' },
  { id: 'ocr_recognize', label: '截图识别(OCR)', command: 'ocr_recognize', defaultValue: 'Control+Alt+O' },
  { id: 'ocr_translate', label: '截图翻译', command: 'ocr_translate', defaultValue: 'Control+Alt+P' },
  { id: 'code_format', label: '代码格式切换', command: 'cycle_code_format', defaultValue: 'Control+Alt+U' },
  { id: 'clipboard', label: '剪贴板监听', command: 'toggle_clipboard_monitor', defaultValue: 'Control+Alt+L' },
]

export const DEFAULT_HOTKEYS: Record<string, string> = Object.fromEntries(
  HOTKEY_DEFS.map((d) => [d.id, d.defaultValue])
)

/** Debounce window-toggle to avoid flicker from key repeat */
let lastToggleAt = 0
const TOGGLE_DEBOUNCE_MS = 500

async function dispatchCommand(command: string) {
  if (command === 'toggle_window') {
    const now = Date.now()
    if (now - lastToggleAt < TOGGLE_DEBOUNCE_MS) return
    lastToggleAt = now
  }
  try {
    await invoke(command)
  } catch (e) {
    console.error(`[hotkeys] invoke ${command} failed:`, e)
  }
}

/**
 * Unregister everything, then register from saved bindings (fallback to defaults).
 * @returns number of failed registrations
 */
export async function registerAllHotkeys(
  saved: Record<string, string> = {}
): Promise<number> {
  try {
    await unregisterAll()
  } catch {
    /* ignore */
  }

  let failCount = 0
  for (const def of HOTKEY_DEFS) {
    const key = (saved[def.id] || def.defaultValue || '').trim()
    if (!key) continue
    try {
      const already = await isRegistered(key)
      if (already) await unregister(key)
      await register(key, (event) => {
        if (event.state === 'Pressed') {
          void dispatchCommand(def.command)
        }
      })
    } catch (e) {
      console.warn(`[hotkeys] failed to register ${def.id} (${key}):`, e)
      failCount++
    }
  }
  return failCount
}

/** Register a single shortcut (used after user confirms one key in settings). */
export async function registerOneHotkey(
  command: string,
  key: string
): Promise<void> {
  const already = await isRegistered(key)
  if (already) await unregister(key)
  await register(key, (event) => {
    if (event.state === 'Pressed') {
      void dispatchCommand(command)
    }
  })
}

export async function unregisterAllHotkeys(): Promise<void> {
  try {
    await unregisterAll()
  } catch {
    /* ignore */
  }
}
