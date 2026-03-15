<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useTranslateStore } from './stores/translate'
import { translate } from './services/translate'
import { useSettingsStore } from './stores/settings'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { addHistory } from './services/history'

const router = useRouter()
const store = useTranslateStore()

onMounted(async () => {
  // 1. 划词翻译
  await listen<string>('selection-text', (event) => {
    const text = event.payload
    if (text) {
      store.inputText = text
      if (store.mode === 'code') store.toggleMode()
      router.push('/')
    }
  })

  // 2. 截图识别完成
  await listen('ocr-recognize-done', () => {
    router.push('/recognize')
  })

  // 3. 截图翻译完成
  await listen<string>('ocr-translate-done', (event) => {
    const text = event.payload
    if (text) {
      store.inputText = text
      if (store.mode === 'code') store.toggleMode()
      router.push('/')
    }
  })

  // 4. 剪贴板监听：自动检测语言 → 中文翻译成英文，其他语言翻译成中文
  await listen<string>('clipboard-text', async (event) => {
    const text = event.payload
    if (!text || !text.trim()) return

    // Pause clipboard monitoring during translation to prevent infinite loop
    try { await invoke('pause_clipboard_monitor_temp') } catch { /* ignore */ }

    // Detect language via Rust lingua
    let detectedLang = ''
    try {
      detectedLang = await invoke<string>('detect_language', { text })
    } catch { /* ignore */ }

    // Smart language switching:
    // Chinese → translate to English
    // Anything else → translate to Chinese
    const isChinese = detectedLang === '简体中文' || detectedLang === '繁体中文'
    const sourceLang = detectedLang || '自动检测'
    const targetLang = isChinese ? '英语' : '简体中文'

    // Update store UI
    store.inputText = text.trim()
    store.sourceLang = sourceLang
    store.targetLang = targetLang
    store.detectedLang = detectedLang
    if (store.mode === 'code') store.toggleMode()
    router.push('/')

    // Auto-translate with the first enabled engine
    const settings = useSettingsStore()
    await settings.init()
    const engineName = store.activeEngine
    const config = settings.getConfig(engineName)

    try {
      store.loading = true
      store.error = ''
      const result = await translate(engineName, text.trim(), sourceLang, targetLang, config)
      store.outputText = result

      // Auto-copy the result back to clipboard
      if (result) {
        try {
          await invoke('clipboard_skip_next', { text: result })
          await writeText(result)
          console.log('[clipboard] Auto-copied result to clipboard:', result.slice(0, 50))
        } catch (e) {
          console.error('[clipboard] Auto-copy failed:', e)
        }

        // Save to history
        try {
          await addHistory({
            source_text: text.trim(),
            result_text: result,
            engine: engineName,
            source_lang: sourceLang,
            target_lang: targetLang,
          })
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      store.error = err.message || '翻译失败'
    } finally {
      store.loading = false
      // Resume clipboard monitoring (Rust will update previous_text to current clipboard)
      try { await invoke('resume_clipboard_monitor_temp') } catch { /* ignore */ }
    }
  })

  // 5. Alt+Shift+U → 循环转换代码命名格式
  await listen('cycle-code-format', async () => {
    await store.cycleCodeFormat()
    const label = store.codeFormatLabels[store.activeFormat] || store.activeFormat
    console.log(`[code-format] Cycled to: ${store.activeFormat} (${label})`)
  })

  // 6. 托盘菜单 → 导航
  await listen<string>('navigate', (event) => {
    const path = event.payload
    if (path) router.push(path)
  })

  // 6. 托盘菜单 → 剪贴板监听 toggle
  await listen('tray-clipboard-toggle', async () => {
    try {
      const settings = useSettingsStore()
      await settings.init()
      const current = settings.getConfig('_clipboard')['enabled'] === 'true'
      const newState = !current
      if (newState) {
        await invoke('start_clipboard_monitor')
      } else {
        await invoke('stop_clipboard_monitor')
      }
      settings.setConfig('_clipboard', 'enabled', String(newState))
      await settings.save()

      // Sync AppFooter clipboard button state
      const { emit } = await import('@tauri-apps/api/event')
      await emit('clipboard-monitor-state', newState)
    } catch (e) {
      console.error('Tray clipboard toggle failed:', e)
    }
  })
})
</script>

<template>
  <router-view />
</template>