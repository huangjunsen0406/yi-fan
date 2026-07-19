/**
 * Persist main window position, size, and always-on-top.
 */
import { getCurrentWindow, LogicalSize, LogicalPosition } from '@tauri-apps/api/window'
import { load } from '@tauri-apps/plugin-store'

const STORE = 'settings.json'
const KEY = 'window_state'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  alwaysOnTop?: boolean
}

async function getStore() {
  return load(STORE, { autoSave: true } as any)
}

export async function loadWindowState(): Promise<WindowState | null> {
  try {
    const store = await getStore()
    const s = await store.get<WindowState>(KEY)
    if (s && s.width >= 400 && s.height >= 400) return s
  } catch {
    /* ignore */
  }
  return null
}

export async function saveWindowState(partial?: Partial<WindowState>): Promise<void> {
  try {
    const win = getCurrentWindow()
    const size = await win.outerSize()
    const pos = await win.outerPosition()
    const scale = await win.scaleFactor()
    const alwaysOnTop = await win.isAlwaysOnTop()

    const state: WindowState = {
      width: Math.round(size.width / scale),
      height: Math.round(size.height / scale),
      x: Math.round(pos.x / scale),
      y: Math.round(pos.y / scale),
      alwaysOnTop,
      ...partial,
    }
    const store = await getStore()
    await store.set(KEY, state)
  } catch {
    /* ignore in browser */
  }
}

/** Apply saved geometry on startup */
export async function restoreWindowState(): Promise<WindowState | null> {
  const s = await loadWindowState()
  if (!s) return null
  try {
    const win = getCurrentWindow()
    await win.setSize(new LogicalSize(s.width, s.height))
    if (typeof s.x === 'number' && typeof s.y === 'number') {
      await win.setPosition(new LogicalPosition(s.x, s.y))
    }
    if (s.alwaysOnTop) {
      await win.setAlwaysOnTop(true)
    }
  } catch {
    /* ignore */
  }
  return s
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced save after move/resize */
export function scheduleSaveWindowState(delayMs = 400) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveWindowState()
  }, delayMs)
}

export async function initWindowStatePersistence(): Promise<WindowState | null> {
  const restored = await restoreWindowState()
  try {
    const win = getCurrentWindow()
    await win.onResized(() => scheduleSaveWindowState())
    await win.onMoved(() => scheduleSaveWindowState())
  } catch {
    /* ignore */
  }
  return restored
}
