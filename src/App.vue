<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { Message } from '@arco-design/web-vue'
import { useTranslateStore } from './stores/translate'
import { useSettingsStore } from './stores/settings'
import { registerAllHotkeys } from './services/hotkeys'
import {
  getAutoCheck,
  getSkippedVersion,
  checkForUpdates,
} from './services/update'

const router = useRouter()
const store = useTranslateStore()

onMounted(async () => {
  const settings = useSettingsStore()
  await settings.init()
  await store.initDefaults()

  // ── 全局快捷键：仅从 settings 注册（单源） ──
  try {
    const savedHotkeys = settings.getConfig('_hotkeys')
    const failCount = await registerAllHotkeys(savedHotkeys)
    if (failCount > 0) {
      console.warn(`[hotkeys] ${failCount} shortcut(s) failed to register`)
    }
  } catch (e) {
    console.error('[hotkeys] bootstrap failed:', e)
  }

  // ── 启动静默检查更新（ccMesh 同款：有新版本再提示） ──
  setTimeout(async () => {
    try {
      if (!(await getAutoCheck())) return
      const info = await checkForUpdates()
      if (!info.available) return
      const skipped = await getSkippedVersion()
      if (skipped && skipped === info.version) return
      Message.info({
        content: `发现新版本 v${info.version}，可在设置 → 关于 中更新`,
        duration: 5000,
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

  // 1. 划词翻译（静默：复制结果 + 轻提示）
  await listen<string>('selection-text', async (event) => {
    const res = await store.silentTranslate(event.payload)
    if (res.ok) {
      Message.success({ content: '已翻译并复制', duration: 1500 })
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
    if (res.ok) {
      Message.success({ content: '剪贴板已翻译并复制', duration: 1500 })
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
</script>

<template>
  <router-view />
</template>
