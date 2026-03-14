import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': '', '简体中文': 'zh-Hans', '繁体中文': 'zh-Hant', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh-Hans',
  '中文-简': 'zh-Hans', '中文-繁': 'zh-Hant',
  '意大利语': 'it', '葡萄牙语': 'pt', '阿拉伯语': 'ar',
  '泰语': 'th', '越南语': 'vi', '印尼语': 'id',
}

export const bing: TranslateProvider = {
  name: 'bing',
  label: '必应翻译',
  icon: 'ph-microsoft-outlook-logo',
  needsConfig: false,
  description: '使用微软必应翻译免费接口，无需 API Key。',
  langMap,

  async translate(text, from, to) {
    const fromLang = langMap[from] || ''
    const toLang = langMap[to] || 'zh-Hans'

    // Step 1: Get auth token
    const tokenRes = await fetch('https://edge.microsoft.com/translate/auth', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42',
      },
    })
    const token = await tokenRes.text()
    if (!token) throw new Error('必应翻译获取 Token 失败')

    // Step 2: Translate
    const params = new URLSearchParams({
      from: fromLang,
      to: toLang,
      'api-version': '3.0',
      includeSentenceLength: 'true',
    })

    const res = await fetch(`https://api-edge.cognitive.microsofttranslator.com/translate?${params}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36 Edg/113.0.1774.42',
      },
      body: JSON.stringify([{ Text: text }]),
    })

    const data = await res.json() as any
    if (Array.isArray(data) && data[0]?.translations?.[0]?.text) {
      return data[0].translations[0].text.trim()
    }
    throw new Error(`必应翻译错误: ${JSON.stringify(data)}`)
  },
}
