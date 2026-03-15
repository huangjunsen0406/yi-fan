import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

export const lingva: TranslateProvider = {
  name: 'lingva',
  label: 'Lingva',
  icon: 'ph-translate',
  needsConfig: false,
  description: '使用 Lingva 翻译（Google 翻译的开源前端），免费无需配置。',
  langMap,

  async translate(text, from, to) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const plainText = text.replace(/\//g, '@@')
    const encoded = encodeURIComponent(plainText)

    const res = await fetch(`https://lingva.pot-app.com/api/v1/${fromLang}/${toLang}/${encoded}`, {
      method: 'GET',
    })
    const data = await res.json() as any
    if (data.translation) return data.translation.replace(/@@/g, '/')
    throw new Error(`Lingva 翻译错误: ${JSON.stringify(data)}`)
  },
}
