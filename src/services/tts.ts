// ── TTS 语音朗读服务 ──
// 使用 Lingva API（和 pot-desktop 一致），备选 Web Speech API

import { fetch } from '@tauri-apps/plugin-http'

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

/** 停止当前播放 */
export function stopTTS() {
  if (currentSource) {
    try {
      currentSource.stop()
      currentSource.disconnect()
    } catch { /* noop */ }
    currentSource = null
  }
}

/** 通过 Lingva API 朗读文本 */
export async function speakByLingva(text: string, lang: string): Promise<void> {
  stopTTS()
  const langCode = langMap[lang] || lang || 'en'
  const encoded = encodeURIComponent(text)

  const res = await fetch(`https://lingva.pot-app.com/api/v1/audio/${langCode}/${encoded}`, {
    method: 'GET',
  })

  if (!res.ok) throw new Error(`TTS 请求失败: ${res.status}`)

  const data = await res.json() as any
  const audioData: number[] = data.audio
  if (!audioData || audioData.length === 0) throw new Error('TTS 返回空音频')

  // 和 pot-desktop 一致：将数据转为 Uint8Array 后用 decodeAudioData 解码播放
  if (!audioCtx) audioCtx = new AudioContext()

  const uint8Array = new Uint8Array(audioData)
  const audioBuffer = await audioCtx.decodeAudioData(uint8Array.buffer.slice(0))

  const source = audioCtx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(audioCtx.destination)
  source.start()
  currentSource = source

  return new Promise((resolve) => {
    source.onended = () => {
      source.disconnect()
      currentSource = null
      resolve()
    }
  })
}

/** 通过浏览器内置 Web Speech API 朗读（备选方案） */
export function speakByWebSpeech(text: string, lang: string): Promise<void> {
  stopTTS()
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      reject(new Error('浏览器不支持 Web Speech API'))
      return
    }

    const langCode = langMap[lang] || lang || 'en'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = langCode
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(new Error(`TTS 错误: ${e.error}`))

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}

/** 统一的朗读函数 —— 先尝试 Lingva，失败则用 Web Speech */
export async function speak(text: string, lang: string): Promise<void> {
  if (!text.trim()) return

  try {
    await speakByLingva(text, lang)
  } catch (e) {
    console.warn('Lingva TTS 失败，使用 Web Speech 备选:', e)
    await speakByWebSpeech(text, lang)
  }
}
