// ── TTS 语音朗读服务 ──
// 使用 Lingva API（和 pot-desktop 一致），备选 Web Speech API

import { fetch } from '@tauri-apps/plugin-http'
import { ref } from 'vue'

// Lingva TTS 语言映射
const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh_HANT', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
  '中文-简': 'zh', '中文-繁': 'zh_HANT',
  '意大利语': 'it', '葡萄牙语': 'pt',
}

let audioCtx: AudioContext | null = null
let currentSource: AudioBufferSourceNode | null = null
let currentRequestId = 0  // 递增 ID，用于取消旧请求

/** 当前朗读来源：'input' | 'output' | ''（未在播放） */
export const speakingSource = ref('')

/** 停止当前播放和所有待处理请求 */
export function stopTTS() {
  currentRequestId++  // 使所有进行中的请求失效
  if (currentSource) {
    try {
      currentSource.stop()
      currentSource.disconnect()
    } catch { /* noop */ }
    currentSource = null
  }
  // 同时停止 Web Speech
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  speakingSource.value = ''
}

/** 通过 Lingva API 朗读文本 */
async function speakByLingva(text: string, lang: string, requestId: number): Promise<void> {
  const langCode = langMap[lang] || lang || 'en'
  const encoded = encodeURIComponent(text)

  const res = await fetch(`https://lingva.pot-app.com/api/v1/audio/${langCode}/${encoded}`, {
    method: 'GET',
  })

  // 请求完成后检查是否已被取消
  if (requestId !== currentRequestId) return

  if (!res.ok) throw new Error(`TTS 请求失败: ${res.status}`)

  const data = await res.json() as any
  const audioData: number[] = data.audio
  if (!audioData || audioData.length === 0) throw new Error('TTS 返回空音频')

  // 再次检查
  if (requestId !== currentRequestId) return

  if (!audioCtx) audioCtx = new AudioContext()

  const uint8Array = new Uint8Array(audioData)
  const audioBuffer = await audioCtx.decodeAudioData(uint8Array.buffer.slice(0))

  // 播放前最后检查
  if (requestId !== currentRequestId) return

  const source = audioCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioCtx.destination)
  source.start()
  currentSource = source

  return new Promise((resolve) => {
    source.onended = () => {
      source.disconnect()
      if (currentSource === source) {
        currentSource = null
        speakingSource.value = ''
      }
      resolve()
    }
  })
}

/** 通过浏览器内置 Web Speech API 朗读（备选方案） */
function speakByWebSpeech(text: string, lang: string, requestId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('浏览器不支持 Web Speech API'))
      return
    }

    if (requestId !== currentRequestId) { resolve(); return }

    const langCode = langMap[lang] || lang || 'en'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langCode
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => {
      if (requestId === currentRequestId) speakingSource.value = ''
      resolve()
    }
    utterance.onerror = (e) => {
      if (requestId === currentRequestId) speakingSource.value = ''
      reject(new Error(`TTS 错误: ${e.error}`))
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

/**
 * 统一的朗读函数
 * @param sourceId 来源标识，如 'input' 或 'output'
 * 同一来源再次点击 → 停止；不同来源点击 → 停掉旧的，开始新的
 */
export async function speak(text: string, lang: string, sourceId: string = 'default'): Promise<void> {
  if (!text.trim()) return

  // 同一来源再次点击 → 只停止
  if (speakingSource.value === sourceId) {
    stopTTS()
    return
  }

  // 停止之前的（不同来源或旧请求），开始新的
  stopTTS()
  const myId = currentRequestId
  speakingSource.value = sourceId

  try {
    await speakByLingva(text, lang, myId)
  } catch (e) {
    if (myId !== currentRequestId) return
    console.warn('Lingva TTS 失败，使用 Web Speech 备选:', e)
    try {
      await speakByWebSpeech(text, lang, myId)
    } catch {
      if (myId === currentRequestId) speakingSource.value = ''
    }
  }
}

