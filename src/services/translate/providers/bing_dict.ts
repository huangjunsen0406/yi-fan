import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh-cn', '繁体中文': 'zh-tw', '英语': 'en-us',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh-cn',
}

export const bingDict: TranslateProvider = {
  name: 'bing_dict',
  label: '必应词典',
  icon: 'ph-book-open',
  needsConfig: false,
  description: '使用必应词典查询单词释义，适合查词，免费无需配置。',
  langMap,

  async translate(text) {
    const word = text.trim()
    const res = await fetch(
      `https://www.bing.com/api/v6/dictionarywords/search?q=${encodeURIComponent(word)}&appid=371E7B2AF0F9B84EC491D731DF90A55719C7D209&mkt=zh-cn&pname=bingdict`,
      { method: 'GET' }
    )
    const data = await res.json() as any
    const groups = data.value?.[0]?.meaningGroups
    if (!groups || groups.length === 0) throw new Error(`必应词典未收录: ${word}`)

    const lines: string[] = []
    for (const g of groups) {
      const pos = g.partsOfSpeech?.[0]?.name || ''
      const desc = g.partsOfSpeech?.[0]?.description || ''
      const meanings = g.meanings?.map((m: any) =>
        m.richDefinitions?.map((rd: any) =>
          rd.fragments?.map((f: any) => f.text).join('')
        ).join('; ')
      ).join('; ') || ''
      if (desc === '发音') lines.push(`🔊 ${pos}: ${meanings}`)
      else if (desc === '快速释义') lines.push(`📖 ${pos} ${meanings}`)
      else if (desc === '变形') lines.push(`📝 ${meanings}`)
      else lines.push(`${pos} ${meanings}`)
    }
    return lines.join('\n')
  },
}
