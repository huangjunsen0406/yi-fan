import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh-TW', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
  '意大利语': 'it', '葡萄牙语': 'pt', '越南语': 'vi',
  '印尼语': 'id', '泰语': 'th', '土耳其语': 'tr',
  '阿拉伯语': 'ar', '马来语': 'ms',
}

export const transmart: TranslateProvider = {
  name: 'transmart',
  label: '腾讯交互',
  icon: 'ph-chats-circle',
  needsConfig: true,
  helpUrl: 'https://transmart.qq.com/',
  description: '使用腾讯交互翻译 (TranSmart) 接口，需要配置 Username 和 Token。登录 transmart.qq.com 后在个人资料页获取。',
  configFields: [
    { key: 'username', label: 'Username', type: 'text', placeholder: '请输入 TranSmart 用户名' },
    { key: 'token', label: 'Token', type: 'password', placeholder: '请输入 TranSmart Token' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'zh'
    const toLang = langMap[to] || 'en'

    // 和 pot-desktop 保持一致：有 username/token 时传入 header
    const headerObj: Record<string, string> = { fn: 'auto_translation' }
    if (config.username && config.token) {
      headerObj.user = config.username
      headerObj.token = config.token
    }

    const body = {
      header: headerObj,
      type: 'plain',
      source: { lang: fromLang, text_list: [text] },
      target: { lang: toLang },
    }

    const response = await fetch('https://transmart.qq.com/api/imt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`腾讯交互翻译 HTTP 错误: ${response.status}`)
    }

    const data = await response.json() as any
    if (data.auto_translation) {
      return data.auto_translation.join('\n').trim()
    }
    throw new Error(`腾讯交互翻译错误: ${JSON.stringify(data)}`)
  },
}
