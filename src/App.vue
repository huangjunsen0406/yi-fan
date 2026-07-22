<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Message } from '@arco-design/web-vue'
import { useTranslateStore } from './stores/translate'
import { useSettingsStore } from './stores/settings'

import {
  getAutoCheck,
  getSkippedVersion,
  checkForUpdates,
} from './services/update'
import { initWindowStatePersistence } from './services/windowState'
import {
  destroyOnboardingTour,
  isOnboardingDone,
  scrubDriverResidue,
  startOnboardingTour,
} from './services/onboarding'
import { bindNetworkListeners, isOnline } from './services/network'
import { loadGlossary } from './services/glossary'

const router = useRouter()
const store = useTranslateStore()

async function resolveAppVersion(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app')
    return await getVersion()
  } catch {
    return '0.0.0'
  }
}

function scheduleOnboardingTour(appVersion: string) {
  const start = () => {
    // Safety: never drive while residual overlay still blocks clicks
    scrubDriverResidue()
    void startOnboardingTour({
      appVersion,
      ensureHome: async () => {
        if (router.currentRoute.value.path !== '/') {
          await router.push('/')
        }
      },
    })
  }
  const ric = (window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }).requestIdleCallback
  if (typeof ric === 'function') {
    ric(start, { timeout: 1200 })
  } else {
    setTimeout(start, 600)
  }
}

onMounted(async () => {
  // Cold start / HMR: clear any leftover driver.js click-block before UI use
  scrubDriverResidue()

  const settings = useSettingsStore()
  await settings.init()
  await store.initDefaults()
  bindNetworkListeners()
  void loadGlossary()

  // 窗口位置 / 大小 / 置顶记忆
  try {
    const ws = await initWindowStatePersistence()
    if (ws?.alwaysOnTop) store.setAlwaysOnTopState(true)
  } catch {
    /* ignore */
  }

  // ── 全局快捷键：仅从 settings 注册（单源） ──
  try {
    const {
      registerAllHotkeysDetailed,
      formatHotkeyFailure,
      sanitizeHotkeyBindings,
    } = await import('./services/hotkeys')
    const savedHotkeys = settings.getConfig('_hotkeys')
    // Windows: migrate illegal mac-style "Cmd" bindings to platform defaults
    const { bindings, changed } = sanitizeHotkeyBindings(savedHotkeys)
    if (changed) {
      for (const [id, key] of Object.entries(bindings)) {
        settings.setConfig('_hotkeys', id, key)
      }
      await settings.save()
    }
    const result = await registerAllHotkeysDetailed(bindings)
    if (result.failCount > 0) {
      const names = result.failed.map((f) => formatHotkeyFailure(f)).join('；')
      console.warn(`[hotkeys] ${result.failCount} shortcut(s) failed:`, result.failed)
      Message.warning({
        content: `${result.failCount} 个快捷键未生效：${names}。请到设置 → 快捷键更换组合（系统无法列出占用方）`,
        duration: 6000,
      })
    }
  } catch (e) {
    console.error('[hotkeys] bootstrap failed:', e)
  }

  // First-run / new-version product tour — after bootstrap.
  // Version mismatch forces the tour once per release (even if already seen).
  try {
    const appVersion = await resolveAppVersion()
    if (!(await isOnboardingDone(undefined, appVersion))) {
      scheduleOnboardingTour(appVersion)
    }
  } catch {
    /* ignore */
  }

  // 离线提示
  if (!isOnline.value) {
    Message.warning({ content: '当前离线，在线翻译引擎可能不可用', duration: 4000 })
  }

  // 默认引擎健康检查（延迟，不阻塞）
  setTimeout(async () => {
    if (!isOnline.value) return
    try {
      const { checkDefaultEngineHealth } = await import('./services/health')
      const h = await checkDefaultEngineHealth()
      if (!h.ok) {
        Message.warning({
          content: `默认引擎「${h.engine}」异常：${h.message}，可在设置中更换`,
          duration: 5000,
        })
      }
    } catch { /* ignore */ }
  }, 6000)

  // ── 启动静默检查更新（ccMesh 同款：有新版本再提示） ──
  setTimeout(async () => {
    try {
      if (!(await getAutoCheck())) return
      const info = await checkForUpdates()
      if (!info.available) return
      const skipped = await getSkippedVersion()
      if (skipped && skipped === info.version) return
      const { setAvailableUpdateVersion } = await import('./services/update')
      await setAvailableUpdateVersion(info.version)
      Message.info({
        id: 'update-available',
        content: `发现新版本 v${info.version}，可在设置 → 关于 中更新`,
        duration: 6000,
      })
    } catch {
      /* 网络失败静默忽略 */
    }
  }, 4000)

  // Sync OCR settings to Rust backend
  {
    const ocrCfg = settings.getConfig('_ocr')
    try {
      await invoke('set_ocr_hide_window', { enabled: ocrCfg['hideWindow'] === 'true' })
      await invoke('set_close_on_blur', { enabled: ocrCfg['closeOnBlur'] === 'true' })
    } catch { /* ignore in browser */ }
  }

  // 1. 划词翻译（静默：复制 + 短气泡展示译文）
  await listen<string>('selection-text', async (event) => {
    const res = await store.silentTranslate(event.payload)
    if (res.ok && res.result) {
      const preview = res.result.length > 80 ? res.result.slice(0, 80) + '…' : res.result
      Message.success({ content: `已复制：${preview}`, duration: 2800 })
    } else if (res.error) {
      Message.error({ content: res.error, duration: 2500 })
    }
  })

  // 2. 截图识别完成
  await listen('ocr-recognize-done', () => {
    router.push('/recognize')
  })

  // 3. 截图翻译完成
  await listen<string>('ocr-translate-done', async (event) => {
    const text = event.payload
    if (text) {
      store.inputText = text
      if (store.mode === 'code') store.toggleMode()
      router.push('/')
      await store.doTranslate()
    }
  })

  // 4. 剪贴板监听 → 静默翻译并回到主页
  await listen<string>('clipboard-text', async (event) => {
    router.push('/')
    const res = await store.silentTranslate(event.payload)
    if (res.ok && res.result) {
      const preview = res.result.length > 80 ? res.result.slice(0, 80) + '…' : res.result
      Message.success({ content: `剪贴板已复制：${preview}`, duration: 2800 })
    } else if (res.error) {
      Message.error({ content: res.error, duration: 2500 })
    }
  })

  // 5. 代码命名格式循环
  await listen('cycle-code-format', async () => {
    await store.cycleCodeFormat()
    const label = store.codeFormatLabels[store.activeFormat] || store.activeFormat
    Message.info({ content: `命名格式: ${label}`, duration: 1200 })
  })

  // 6. 托盘菜单 → 导航
  await listen<string>('navigate', (event) => {
    const path = event.payload
    if (path) router.push(path)
  })

  // 托盘「检查更新」→ 打开设置关于页
  await listen('open-settings-about', () => {
    try {
      sessionStorage.setItem('yi-fan-settings-page', 'about')
    } catch { /* ignore */ }
    router.push('/settings')
  })

  // 7. 托盘菜单 → 剪贴板监听 toggle
  await listen('tray-clipboard-toggle', async () => {
    try {
      await settings.init()
      // 仅当明确为 true 时视为开启
      const current = settings.getConfig('_clipboard')['enabled'] === 'true'
      const newState = !current
      if (newState) {
        await invoke('start_clipboard_monitor')
      } else {
        await invoke('stop_clipboard_monitor')
      }
      settings.setConfig('_clipboard', 'enabled', String(newState))
      await settings.save()

      const { emit } = await import('@tauri-apps/api/event')
      await emit('clipboard-monitor-state', newState)
      Message.info({ content: newState ? '剪贴板监听已开启' : '剪贴板监听已关闭', duration: 1500 })
    } catch (e) {
      console.error('Tray clipboard toggle failed:', e)
    }
  })

  // 8. 快捷键 toggle_clipboard_monitor 时同步持久化（AppFooter 在设置页会卸载）
  await listen<boolean>('clipboard-monitor-toggled', async (event) => {
    try {
      await settings.init()
      settings.setConfig('_clipboard', 'enabled', String(event.payload))
      await settings.save()
      const { emit } = await import('@tauri-apps/api/event')
      await emit('clipboard-monitor-state', event.payload)
      Message.info({
        content: event.payload ? '剪贴板监听已开启' : '剪贴板监听已关闭',
        duration: 1500,
      })
    } catch (e) {
      console.warn('Persist clipboard state failed:', e)
    }
  })
})

// HMR / unmount: tear down tour so residual overlay never blocks next paint
onUnmounted(() => {
  destroyOnboardingTour()
})
</script>

<template>
  <router-view />
</template>
