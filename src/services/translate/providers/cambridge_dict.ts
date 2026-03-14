import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'chinese-simplified', '繁体中文': 'chinese-traditional',
  '英语': 'english', '日语': 'japanese', '韩语': 'korean',
  '法语': 'french', '德语': 'german', '西班牙语': 'spanish', '俄语': 'russian',
  '文言文': 'chinese-simplified',
  '中文-简': 'chinese-simplified', '中文-繁': 'chinese-traditional',
}

export const cambridgeDict: TranslateProvider = {
  name: 'cambridge_dict',
  label: '剑桥词典',
  icon: 'ph-graduation-cap',
  needsConfig: false,
  description: '使用剑桥词典查询英语单词释义（仅支持英语），免费无需配置。',
  langMap,

  async translate(text, _from, to) {
    const word = text.trim()
    if (word.split(' ').length > 1) return '' // only single words
    const toLang = langMap[to] || 'chinese-simplified'

    const res = await fetch(
      `https://dictionary.cambridge.org/search/direct/?datasetsearch=english-${toLang}&q=${encodeURIComponent(word)}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'text/html;charset=UTF-8' },
      }
    )
    const html = await res.text()

    // Simple extraction of definitions from HTML
    const defRegex = /class="def ddef_d db">(.*?)<\/div>/gs
    const transRegex = /class="trans dtrans dtrans-se[^"]*"[^>]*>(.*?)<\/span>/gs
    const defs: string[] = []
    const trans: string[] = []

    let match
    while ((match = defRegex.exec(html))) {
      defs.push(match[1].replace(/<[^>]*>/g, '').trim())
    }
    while ((match = transRegex.exec(html))) {
      trans.push(match[1].replace(/<[^>]*>/g, '').trim())
    }

    if (trans.length > 0) return trans.join('\n')
    if (defs.length > 0) return defs.join('\n')
    throw new Error(`剑桥词典未收录: ${word}`)
  },
}
