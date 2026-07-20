import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
}

export const ecdict: TranslateProvider = {
  name: 'ecdict',
  label: 'ECDICT',
  icon: 'ph-book',
  needsConfig: false,
  description:
    'ECDICT 英汉词典：优先本地词库（离线可用），未命中再请求在线接口。适合查词。',
  langMap,
  capabilities: { offline: true, dictionary: true },

  async translate(text) {
    const word = text.trim()
    // Local-first (also covered by registry; keep for direct provider calls)
    try {
      const { lookupLocalDict } = await import('../../localDict')
      const local = await lookupLocalDict(word)
      if (local) return local
    } catch {
      /* continue online */
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(`离线且本地词库未收录: ${word}`)
    }

    const res = await fetch('https://pot-app.com/api/dict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: word }),
    })
    const data = (await res.json()) as any
    let out = ''
    if (typeof data === 'string') out = data
    else if (data.explanations) {
      out = data.explanations
        .map((e: any) => `${e.trait} ${e.explains?.join('; ')}`)
        .join('\n')
    } else if (data.translation) out = data.translation
    else out = JSON.stringify(data)

    if (out) {
      try {
        const { rememberLocalDict } = await import('../../localDict')
        await rememberLocalDict(word, out)
      } catch {
        /* ignore */
      }
    }
    return out
  },
}
