import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'
import { simpleMd5 } from '../utils/md5'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'cht', '英语': 'en',
  '日语': 'jp', '韩语': 'kor', '法语': 'fra', '德语': 'de',
  '西班牙语': 'spa', '俄语': 'ru', '文言文': 'wyw',
  '中文-简': 'zh', '中文-繁': 'cht',
}

export const baidu: TranslateProvider = {
  name: 'baidu',
  label: '百度翻译',
  icon: 'ph-translate',
  needsConfig: true,
  helpUrl: 'https://fanyi-api.baidu.com/',
  description: '使用百度翻译开放平台 API，需要注册应用获取 App ID 和密钥。',
  configFields: [
    { key: 'appId', label: 'App ID', type: 'text', placeholder: '请输入百度翻译 App ID' },
    { key: 'secretKey', label: '密钥 (Secret Key)', type: 'password', placeholder: '请输入密钥' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const salt = Date.now().toString()
    const sign = simpleMd5(config.appId + text + salt + config.secretKey)

    const params = new URLSearchParams({
      q: text, from: fromLang, to: toLang,
      appid: config.appId, salt, sign,
    })

    const response = await fetch(`https://fanyi-api.baidu.com/api/trans/vip/translate?${params}`, { method: 'GET' })
    const data = await response.json() as any
    if (data.error_code) throw new Error(`百度翻译错误: ${data.error_msg} (${data.error_code})`)
    return data.trans_result?.map((r: any) => r.dst).join('\n') || ''
  },
}
