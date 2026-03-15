import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

export const caiyun: TranslateProvider = {
  name: 'caiyun',
  label: '彩云小译',
  icon: 'ph-cloud-sun',
  needsConfig: true,
  helpUrl: 'https://fanyi.caiyunapp.com/#/api',
  description: '使用彩云小译 API，需要 Token。',
  configFields: [
    { key: 'token', label: 'Token', type: 'password', placeholder: '请输入彩云小译 Token' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'

    const res = await fetch('https://api.interpreter.caiyunai.com/v1/translator', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': `token ${config.token}`,
      },
      body: JSON.stringify({
        source: [text],
        trans_type: `${fromLang}2${toLang}`,
        request_id: 'yi-fan',
        detect: true,
      }),
    })
    const data = await res.json() as any
    if (data.target?.[0]) return data.target[0]
    throw new Error(`彩云小译错误: ${JSON.stringify(data)}`)
  },
}
