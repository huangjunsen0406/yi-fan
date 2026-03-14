import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'cht', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
  '中文-简': 'zh', '中文-繁': 'cht',
}

export const niutrans: TranslateProvider = {
  name: 'niutrans',
  label: '小牛翻译',
  icon: 'ph-cow',
  needsConfig: true,
  helpUrl: 'https://niutrans.com/cloud/api/list',
  description: '使用小牛翻译 API，需要 API Key。',
  configFields: [
    { key: 'apikey', label: 'API Key', type: 'password', placeholder: '请输入小牛翻译 API Key' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'

    const res = await fetch('https://api.niutrans.com/NiuTransServer/translation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromLang, to: toLang, apikey: config.apikey, src_text: text }),
    })
    const data = await res.json() as any
    if (data.tgt_text) return data.tgt_text.trim()
    throw new Error(`小牛翻译错误: ${JSON.stringify(data)}`)
  },
}
