<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listen } from '@tauri-apps/api/event'
import { useTranslateStore } from './stores/translate'

const router = useRouter()
const store = useTranslateStore()

onMounted(async () => {
  // 全局快捷键事件监听（App 级别，不受路由切换影响）
  // Rust 端完成所有阻塞操作后再 emit 以下事件

  // 1. 划词翻译：Rust 已获取选区文字 + 显示窗口
  await listen<string>('selection-text', (event) => {
    const text = event.payload
    if (text) {
      store.inputText = text
      if (store.mode === 'code') store.toggleMode()
      router.push('/')
    }
  })

  // 2. 截图识别完成：Rust 已 screencapture + 显示窗口，直接跳转
  await listen('ocr-recognize-done', () => {
    router.push('/recognize')
  })

  // 3. 截图翻译完成：Rust 已 screencapture + OCR + 显示窗口，收到文字
  await listen<string>('ocr-translate-done', (event) => {
    const text = event.payload
    if (text) {
      store.inputText = text
      if (store.mode === 'code') store.toggleMode()
      router.push('/')
    }
  })
})
</script>

<template>
  <router-view />
</template>