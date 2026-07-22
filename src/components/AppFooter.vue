<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useSettingsStore } from '../stores/settings'
import { useTranslateStore } from '../stores/translate'
import { themeMode, setThemeMode, type ThemeMode } from '../services/theme'
import { getAvailableUpdateVersion } from '../services/update'
import { startOnboardingTour } from '../services/onboarding'

const router = useRouter()
const settings = useSettingsStore()
const store = useTranslateStore()

const clipboardActive = ref(false)
const updateBadge = ref('')
let unlisten: UnlistenFn | null = null
let unlistenToggled: UnlistenFn | null = null
let badgeTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await settings.init()
  const saved = settings.getConfig('_clipboard')['enabled']
  if (saved === 'true') {
    clipboardActive.value = true
    try { await invoke('start_clipboard_monitor') } catch { /* ignore */ }
  }
  unlisten = await listen<boolean>('clipboard-monitor-state', (event) => {
    clipboardActive.value = event.payload
  })
  unlistenToggled = await listen<boolean>('clipboard-monitor-toggled', (event) => {
    clipboardActive.value = event.payload
  })
  try {
    updateBadge.value = await getAvailableUpdateVersion()
  } catch { /* ignore */ }
  // Refresh badge periodically (startup check may finish later)
  badgeTimer = setInterval(async () => {
    try {
      updateBadge.value = await getAvailableUpdateVersion()
    } catch { /* ignore */ }
  }, 8000)
})

onUnmounted(() => {
  unlisten?.()
  unlistenToggled?.()
  if (badgeTimer) clearInterval(badgeTimer)
})

async function toggleClipboard() {
  clipboardActive.value = !clipboardActive.value
  try {
    if (clipboardActive.value) {
      await invoke('start_clipboard_monitor')
    } else {
      await invoke('stop_clipboard_monitor')
    }
    settings.setConfig('_clipboard', 'enabled', String(clipboardActive.value))
    await settings.save()
  } catch (e) {
    console.error('Clipboard monitor toggle failed:', e)
    clipboardActive.value = !clipboardActive.value
  }
}

async function cycleTheme() {
  const order: ThemeMode[] = ['light', 'dark', 'system']
  const idx = order.indexOf(themeMode.value)
  await setThemeMode(order[(idx + 1) % order.length])
}

function goToSettings() {
  router.push('/settings')
}

function goToHistory() {
  router.push('/history')
}

function goToUpdate() {
  router.push({ path: '/settings' })
  // Settings defaults to hotkey; about is selected via query if we add it later
  sessionStorage.setItem('yi-fan-settings-page', 'about')
}

async function replayOnboardingTour() {
  let appVersion = '0.0.0'
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    appVersion = await getVersion()
  } catch {
    /* browser / test */
  }
  if (router.currentRoute.value.path !== '/') {
    await router.push('/')
  }
  await startOnboardingTour({ appVersion })
}
</script>

<template>
  <footer class="app-footer" role="contentinfo" aria-label="主窗口工具栏">
    <button
      class="footer-btn mode-btn"
      data-tour="mode-toggle"
      :title="store.mode === 'translate' ? '切换到代码模式' : '切换到翻译模式'"
      :aria-label="store.mode === 'translate' ? '切换到代码模式' : '切换到翻译模式'"
      @click="store.toggleMode()"
    >
      <i v-if="store.mode === 'translate'" class="ph ph-arrows-left-right" aria-hidden="true"></i>
      <i v-else class="ph ph-code" aria-hidden="true"></i>
    </button>
    <div class="footer-spacer"></div>
    <div class="footer-tools" data-tour="toolbar">
      <button
        class="footer-btn tour-btn"
        title="重新查看引导"
        aria-label="重新查看引导"
        @click="replayOnboardingTour"
      >
        <i class="ph ph-question" aria-hidden="true"></i>
      </button>
      <button
        class="footer-btn theme-btn"
        :title="`主题: ${themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '跟随系统'}（点击切换）`"
        :aria-label="`切换主题，当前：${themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '跟随系统'}`"
        @click="cycleTheme"
      >
        <i
          class="ph"
          :class="themeMode === 'dark' ? 'ph-moon' : themeMode === 'light' ? 'ph-sun' : 'ph-desktop'"
          aria-hidden="true"
        ></i>
      </button>
      <button
        class="footer-btn pin-btn"
        :class="{ active: store.alwaysOnTop }"
        @click="store.toggleAlwaysOnTop()"
        :title="store.alwaysOnTop ? '取消置顶' : '窗口置顶'"
        :aria-label="store.alwaysOnTop ? '取消置顶' : '窗口置顶'"
        :aria-pressed="store.alwaysOnTop"
      >
        <i class="ph" :class="store.alwaysOnTop ? 'ph-push-pin-simple-slash' : 'ph-push-pin-simple'" aria-hidden="true"></i>
      </button>
      <button
        class="footer-btn clipboard-btn"
        :class="{ active: clipboardActive }"
        @click="toggleClipboard"
        :title="clipboardActive ? '关闭剪贴板监听' : '开启剪贴板监听'"
        :aria-label="clipboardActive ? '关闭剪贴板监听' : '开启剪贴板监听'"
        :aria-pressed="clipboardActive"
      >
        <i class="ph ph-clipboard-text" aria-hidden="true"></i>
      </button>
      <button class="footer-btn" title="翻译历史" aria-label="翻译历史" @click="goToHistory">
        <i class="ph ph-clock-counter-clockwise" aria-hidden="true"></i>
      </button>
    </div>
    <button
      class="footer-btn settings-btn"
      data-tour="settings"
      :title="updateBadge ? `设置 · 有新版本 v${updateBadge}` : '设置'"
      :aria-label="updateBadge ? `设置，有新版本 v${updateBadge}` : '设置'"
      @click="updateBadge ? goToUpdate() : goToSettings()"
    >
      <i class="ph ph-gear" aria-hidden="true"></i>
      <span v-if="updateBadge" class="footer-dot" aria-hidden="true"></span>
    </button>
  </footer>
</template>

<style scoped>
.app-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 2px;
  flex-shrink: 0;
  min-height: 40px;
}

.footer-spacer {
  flex: 1;
}

.footer-tools {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  /* Explicit high-contrast colors — avoid near-invisible secondary on some builds */
  color: var(--color-text);
  opacity: 0.72;
  font-size: 20px;
  transition: all var(--transition-fast);
  background: transparent;
  border: none;
  flex-shrink: 0;
}

.footer-btn i {
  color: inherit;
  line-height: 1;
}

.footer-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-danger);
  box-shadow: 0 0 0 1.5px var(--color-bg);
}

.footer-btn:hover {
  opacity: 1;
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.footer-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  opacity: 1;
}

.clipboard-btn.active,
.pin-btn.active {
  opacity: 1;
  color: var(--color-primary);
}
</style>


