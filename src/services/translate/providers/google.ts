import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import type { TranslateProvider } from '../types'
import { splitChunks } from '../../../utils/textChunk'
import { TranslateError } from '../../errors'
import { encodeGoogleText, decodeGoogleText } from '../utils/htmlText'
import { readTranslationResponse } from '../utils/response'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh-CN', '繁体中文': 'zh-TW', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh-CN',
  '意大利语': 'it', '葡萄牙语': 'pt', '阿拉伯语': 'ar',
  '泰语': 'th', '越南语': 'vi', '印尼语': 'id',
}

// Google Translate Web's public client key; users do not supply a Cloud API key.
// Protocol reference: https://github.com/mengxi-ream/read-frog/blob/main/src/utils/host/translate/api/google.ts
const GOOGLE_TRANSLATE_HTML_URL = 'https://translate-pa.googleapis.com/v1/translateHtml'
const GOOGLE_TRANSLATE_HTML_API_KEY = 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520'
const MAX_CHUNK_CHARS = 1800

async function translateChunk(text: string, sl: string, tl: string): Promise<string> {
  // HTML translation can discard punctuation-only fragments.
  if (!/[\p{L}\p{N}]/u.test(text)) return text
  const response = await fetch(GOOGLE_TRANSLATE_HTML_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json+protobuf',
      'X-Goog-API-Key': GOOGLE_TRANSLATE_HTML_API_KEY,
    },
    body: JSON.stringify([[[encodeGoogleText(text)], sl, tl], 'wt_lib']),
  })
  const data = await readTranslationResponse(response, 'google', '谷歌翻译')
  if (!Array.isArray(data) || !Array.isArray(data[0]) || data[0].length !== 1 || typeof data[0][0] !== 'string') {
    throw new TranslateError('invalid_response', '谷歌翻译返回格式异常', { engine: 'google' })
  }
  if (!data[0][0].trim()) {
    throw new TranslateError('empty_result', '谷歌翻译返回为空', { engine: 'google' })
  }
  return decodeGoogleText(data[0][0], text)
}

export const google: TranslateProvider = {
  name: 'google',
  label: '谷歌翻译',
  icon: 'ph-globe-simple',
  needsConfig: false,
  description: '使用 Google 翻译网页接口，无需用户 API Key。',
  langMap,

  async translate(text, from, to) {
    if (!text.trim()) return ''
    const sl = langMap[from] || 'auto'
    const tl = langMap[to] || 'zh-CN'
    const parts = splitChunks(text, MAX_CHUNK_CHARS)
    const out: string[] = []
    for (const part of parts) {
      out.push(await translateChunk(part, sl, tl))
    }
    return out.join('\n\n')
  },
}
