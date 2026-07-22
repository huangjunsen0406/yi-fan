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

export function isHotkeyMacPlatform(
  ua: string = typeof navigator !== 'undefined'
    ? navigator.platform || navigator.userAgent || ''
    : ''
): boolean {
  return /Mac|iPhone|iPad/i.test(ua)
}

/**
 * Platform defaults.
 * macOS uses Control+Cmd for toggle/selection (common on Mac apps).
 * Windows has no Cmd key — Control+Cmd fails to register (user screenshot).
 * Win defaults use Control+Alt for the whole set, avoiding reserved Win combos.
 */
const MAC_DEFAULTS: Record<string, string> = {
  toggle: 'Control+Cmd+Space',
  selection: 'Control+Cmd+D',
  ocr_recognize: 'Control+Alt+O',
  ocr_translate: 'Control+Alt+P',
  code_format: 'Control+Alt+U',
  clipboard: 'Control+Alt+L',
}

const WIN_DEFAULTS: Record<string, string> = {
  toggle: 'Control+Alt+T',
  selection: 'Control+Alt+D',
  ocr_recognize: 'Control+Alt+O',
  ocr_translate: 'Control+Alt+P',
  code_format: 'Control+Alt+U',
  clipboard: 'Control+Alt+L',
}

export function getDefaultHotkey(
  id: string,
  isMac: boolean = isHotkeyMacPlatform()
): string {
  const table = isMac ? MAC_DEFAULTS : WIN_DEFAULTS
  return table[id] || ''
}

/** Canonical hotkey definitions used by Settings UI and app bootstrap */
export const HOTKEY_DEFS: HotkeyDef[] = [
  {
    id: 'toggle',
    label: '唤出/隐藏窗口',
    command: 'toggle_window',
    get defaultValue() {
      return getDefaultHotkey('toggle')
    },
  },
  {
    id: 'selection',
    label: '划词翻译',
    command: 'selection_translate',
    get defaultValue() {
      return getDefaultHotkey('selection')
    },
  },
  {
    id: 'ocr_recognize',
    label: '截图识别(OCR)',
    command: 'ocr_recognize',
    get defaultValue() {
      return getDefaultHotkey('ocr_recognize')
    },
  },
  {
    id: 'ocr_translate',
    label: '截图翻译',
    command: 'ocr_translate',
    get defaultValue() {
      return getDefaultHotkey('ocr_translate')
    },
  },
  {
    id: 'code_format',
    label: '代码格式切换',
    command: 'cycle_code_format',
    get defaultValue() {
      return getDefaultHotkey('code_format')
    },
  },
  {
    id: 'clipboard',
    label: '剪贴板监听',
    command: 'toggle_clipboard_monitor',
    get defaultValue() {
      return getDefaultHotkey('clipboard')
    },
  },
]

/** Snapshot of platform defaults (evaluated at call time via getters on defs) */
export function getDefaultHotkeys(
  isMac: boolean = isHotkeyMacPlatform()
): Record<string, string> {
  return Object.fromEntries(
    HOTKEY_DEFS.map((d) => [d.id, getDefaultHotkey(d.id, isMac)])
  )
}

/** @deprecated prefer getDefaultHotkeys() — kept for existing imports */
export const DEFAULT_HOTKEYS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_t, prop: string) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined
      return getDefaultHotkey(prop)
    },
    ownKeys() {
      return HOTKEY_DEFS.map((d) => d.id)
    },
    getOwnPropertyDescriptor(_t, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined
      return {
        configurable: true,
        enumerable: true,
        value: getDefaultHotkey(prop),
      }
    },
  }
)

/**
 * Normalize a stored binding for the current OS.
 * Windows users who previously saved macOS "Cmd" combos get migrated to Win defaults.
 */
export function sanitizeHotkeyBinding(
  id: string,
  key: string | undefined | null,
  isMac: boolean = isHotkeyMacPlatform()
): string {
  const raw = (key || '').trim()
  if (!raw) return getDefaultHotkey(id, isMac)
  // "Cmd" is mac-only in our recorder; on Win/Linux it almost always fails to register
  if (!isMac && /\bCmd\b/i.test(raw)) {
    return getDefaultHotkey(id, isMac)
  }
  return raw
}

/** Apply sanitize to a full saved map; returns cleaned bindings + whether anything changed */
export function sanitizeHotkeyBindings(
  saved: Record<string, string> = {},
  isMac: boolean = isHotkeyMacPlatform()
): { bindings: Record<string, string>; changed: boolean } {
  const bindings: Record<string, string> = {}
  let changed = false
  for (const def of HOTKEY_DEFS) {
    const next = sanitizeHotkeyBinding(def.id, saved[def.id], isMac)
    bindings[def.id] = next
    if ((saved[def.id] || '') !== next) changed = true
  }
  return { bindings, changed }
}

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

export interface HotkeyRegisterFailure {
  id: string
  label: string
  key: string
  error?: string
}

export interface HotkeyRegisterResult {
  failCount: number
  failed: HotkeyRegisterFailure[]
  ok: string[]
}

/**
 * Unregister everything, then register from saved bindings (fallback to defaults).
 * Returns detailed failures (OS cannot enumerate who owns a hotkey — only try-register).
 */
export async function registerAllHotkeysDetailed(
  saved: Record<string, string> = {}
): Promise<HotkeyRegisterResult> {
  try {
    await unregisterAll()
  } catch {
    /* ignore */
  }

  const isMac = isHotkeyMacPlatform()
  const { bindings } = sanitizeHotkeyBindings(saved, isMac)

  const failed: HotkeyRegisterFailure[] = []
  const ok: string[] = []
  for (const def of HOTKEY_DEFS) {
    const key = bindings[def.id] || ''
    if (!key) continue
    try {
      const already = await isRegistered(key)
      if (already) await unregister(key)
      await register(key, (event) => {
        if (event.state === 'Pressed') {
          void dispatchCommand(def.command)
        }
      })
      ok.push(def.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e ?? '')
      console.warn(`[hotkeys] failed to register ${def.id} (${key}):`, e)
      failed.push({ id: def.id, label: def.label, key, error: msg })
    }
  }
  return { failCount: failed.length, failed, ok }
}

/** @returns number of failed registrations */
export async function registerAllHotkeys(
  saved: Record<string, string> = {}
): Promise<number> {
  const r = await registerAllHotkeysDetailed(saved)
  return r.failCount
}

/** User-facing conflict tips (no OS-level scan — platforms don't expose owners). */
export function hotkeyConflictHint(key?: string): string {
  const base =
    '系统不会告诉我们是谁占用了该组合，只能通过「试注册」判断是否可用。请更换修饰键或主键。'
  const isMac = isHotkeyMacPlatform()
  if (isMac) {
    return (
      base +
      ' macOS 常见占用：截图(⇧⌘3/4/5)、聚焦搜索(⌘Space)、输入法切换。可到「系统设置 → 键盘 → 键盘快捷键」对照。' +
      (key ? ` 当前组合：${key}` : '')
    )
  }
  const cmdHint =
    key && /\bCmd\b/i.test(key)
      ? ' 提示：Windows 上没有 Cmd 键，请改用 Control/Alt/Shift 组合（可点「恢复默认」）。'
      : ''
  return (
    base +
    ' Windows 常见占用：Win+…、部分输入法/截图工具、其它翻译软件。可用第三方 HotKeysList 等工具排查。' +
    cmdHint +
    (key ? ` 当前组合：${key}` : '')
  )
}

/** Friendly one-line status for a failed key */
export function formatHotkeyFailure(f: HotkeyRegisterFailure): string {
  return `「${f.label}」(${f.key}) 注册失败`
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
