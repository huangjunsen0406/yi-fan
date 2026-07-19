/**
 * Theme: light | dark | system
 * Persisted via plugin-store; applies CSS variables + Arco Design dark class.
 */
import { ref } from 'vue'
import { load } from '@tauri-apps/plugin-store'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORE_FILE = 'settings.json'
const KEY = 'theme_mode'

export const themeMode = ref<ThemeMode>('system')
export const resolvedTheme = ref<'light' | 'dark'>('light')

let mediaQuery: MediaQueryList | null = null
let mediaHandler: ((e: MediaQueryListEvent) => void) | null = null

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

/** Apply theme to document + Arco */
export function applyTheme(mode: ThemeMode = themeMode.value) {
  const resolved = resolveTheme(mode)
  resolvedTheme.value = resolved

  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.classList.toggle('dark', resolved === 'dark')

  // Arco Design Vue
  if (resolved === 'dark') {
    document.body.setAttribute('arco-theme', 'dark')
  } else {
    document.body.removeAttribute('arco-theme')
  }
}

function bindSystemListener(enabled: boolean) {
  if (typeof window === 'undefined' || !window.matchMedia) return
  if (!mediaQuery) {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  }
  if (mediaHandler) {
    mediaQuery.removeEventListener('change', mediaHandler)
    mediaHandler = null
  }
  if (enabled) {
    mediaHandler = () => {
      if (themeMode.value === 'system') applyTheme('system')
    }
    mediaQuery.addEventListener('change', mediaHandler)
  }
}

async function getStore() {
  return load(STORE_FILE, { autoSave: true } as any)
}

/** Load saved preference and apply (call once at startup). */
export async function initTheme(): Promise<ThemeMode> {
  let mode: ThemeMode = 'system'
  try {
    const store = await getStore()
    const saved = await store.get<string>(KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      mode = saved
    }
  } catch {
    /* browser / first run */
  }
  themeMode.value = mode
  applyTheme(mode)
  bindSystemListener(mode === 'system')
  return mode
}

/** Change theme and persist. */
export async function setThemeMode(mode: ThemeMode): Promise<void> {
  themeMode.value = mode
  applyTheme(mode)
  bindSystemListener(mode === 'system')
  try {
    const store = await getStore()
    await store.set(KEY, mode)
  } catch {
    /* ignore */
  }
}

export const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: 'ph-sun' },
  { value: 'dark', label: '深色', icon: 'ph-moon' },
  { value: 'system', label: '跟随系统', icon: 'ph-desktop' },
]
