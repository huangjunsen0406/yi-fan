import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': '', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
  '中文-简': 'zh', '中文-繁': 'zh',
}

export const yandex: TranslateProvider = {
  name: 'yandex',
  label: 'Yandex',
  icon: 'ph-circle-half',
  needsConfig: false,
  description: '使用 Yandex 翻译免费接口，无需 API Key。',
  langMap,

  async translate(text, from, to) {
    const fromLang = langMap[from] || ''
    const toLang = langMap[to] || 'zh'

    const uuid = String(crypto.randomUUID()).replace(/-/g, '')
    const params = new URLSearchParams({
      id: `${uuid}-0-0`,
      srv: 'android',
    })

    const body = new URLSearchParams({
      source_lang: fromLang,
      target_lang: toLang,
      text,
    })

    const res = await fetch(`https://translate.yandex.net/api/v1/tr.json/translate?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = await res.json() as any
    if (data.text?.[0]) return data.text[0]
    throw new Error(`Yandex 翻译错误: ${JSON.stringify(data)}`)
  },
}
