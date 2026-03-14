import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh-CN', '繁体中文': 'zh-TW', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh-CN',
  '中文-简': 'zh-CN', '中文-繁': 'zh-TW',
}

export const google: TranslateProvider = {
  name: 'google',
  label: '谷歌翻译',
  icon: 'ph-globe-simple',
  needsConfig: false,
  description: '使用 Google 翻译网页接口，无需 API Key，开箱即用。',
  langMap,

  async translate(text, from, to) {
    const sl = langMap[from] || 'auto'
    const tl = langMap[to] || 'zh-CN'

    // 使用 translate.googleapis.com 避免被墙
    const url = new URL('https://translate.googleapis.com/translate_a/single')
    url.searchParams.set('client', 'gtx')
    url.searchParams.set('sl', sl)
    url.searchParams.set('tl', tl)
    url.searchParams.set('hl', tl)
    url.searchParams.set('dt', 't')
    url.searchParams.set('ie', 'UTF-8')
    url.searchParams.set('oe', 'UTF-8')
    url.searchParams.set('q', text)

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`谷歌翻译 HTTP 错误: ${response.status}`)
    }

    const data = await response.json() as any
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      throw new Error('谷歌翻译返回格式异常')
    }

    let result = ''
    for (const item of data[0]) {
      if (item[0]) result += item[0]
    }
    return result.trim()
  },
}
