import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '中文-简': 'zh',
}

export const ecdict: TranslateProvider = {
  name: 'ecdict',
  label: 'ECDICT',
  icon: 'ph-book',
  needsConfig: false,
  description: '使用 ECDICT 开源英汉词典查询，适合查词，免费无需配置。',
  langMap,

  async translate(text) {
    const word = text.trim()
    const res = await fetch('https://pot-app.com/api/dict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word }),
    })
    const data = await res.json() as any
    if (typeof data === 'string') return data
    if (data.explanations) {
      return data.explanations.map((e: any) => `${e.trait} ${e.explains?.join('; ')}`).join('\n')
    }
    if (data.translation) return data.translation
    return JSON.stringify(data)
  },
}
