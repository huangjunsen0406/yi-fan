import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh-CHS', '繁体中文': 'zh-CHT', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh-CHS',
  '中文-简': 'zh-CHS', '中文-繁': 'zh-CHT',
}

// ── SHA-256 ──
async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function truncate(q: string): string {
  const len = q.length
  if (len <= 20) return q
  return q.substring(0, 10) + len + q.substring(len - 10, len)
}

export const youdao: TranslateProvider = {
  name: 'youdao',
  label: '有道翻译',
  icon: 'ph-book-bookmark',
  needsConfig: true,
  helpUrl: 'https://ai.youdao.com/',
  description: '使用有道智云翻译 API，需要注册应用获取应用 ID 和密钥。',
  configFields: [
    { key: 'appKey', label: '应用 ID (App Key)', type: 'text', placeholder: '请输入有道应用 ID' },
    { key: 'appSecret', label: '应用密钥 (App Secret)', type: 'password', placeholder: '请输入应用密钥' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh-CHS'
    const salt = crypto.randomUUID()
    const curtime = Math.floor(Date.now() / 1000).toString()
    const input = truncate(text)
    const signStr = config.appKey + input + salt + curtime + config.appSecret
    const sign = await sha256(signStr)

    const params = new URLSearchParams({
      q: text,
      from: fromLang,
      to: toLang,
      appKey: config.appKey,
      salt,
      sign,
      signType: 'v3',
      curtime,
    })

    const response = await fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    const data = await response.json() as any
    if (data.errorCode !== '0') {
      throw new Error(`有道翻译错误: ${data.errorCode}`)
    }
    return data.translation?.join('\n') || ''
  },
}
