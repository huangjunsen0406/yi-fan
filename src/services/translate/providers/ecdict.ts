import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import { readTranslationResponse } from '../utils/response'
import { TranslateError } from '../../errors'
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
    const data = await readTranslationResponse(res, 'ecdict', 'ECDICT')
    let out = ''
    if (typeof data === 'string') out = data.trim()
    else if (data && typeof data === 'object') {
      const result = data as Record<string, unknown>
      if (typeof result.translation === 'string') out = result.translation.trim()
      else if (Array.isArray(result.explanations)) {
        const lines = result.explanations.map((entry: unknown) => {
          if (!entry || typeof entry !== 'object') return null
          const explanation = entry as Record<string, unknown>
          if (!Array.isArray(explanation.explains) ||
            !explanation.explains.every((item: unknown) => typeof item === 'string')) return null
          const meaning = (explanation.explains as string[]).map((item) => item.trim()).filter(Boolean).join('; ')
          if (!meaning) return ''
          const trait = typeof explanation.trait === 'string' ? explanation.trait.trim() : ''
          return trait ? `${trait} ${meaning}` : meaning
        })
        if (lines.every((line) => line !== null)) out = lines.filter(Boolean).join('\n')
      }
    }

    if (!out) {
      throw new TranslateError('invalid_response', 'ECDICT 返回格式异常或释义为空', { engine: 'ecdict' })
    }
    try {
      const { rememberLocalDict } = await import('../../localDict')
      await rememberLocalDict(word, out)
    } catch {
      /* ignore cache persistence failure */
    }
    return out
  },
}
