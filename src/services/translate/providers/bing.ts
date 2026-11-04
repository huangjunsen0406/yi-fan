import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import type { TranslateProvider } from '../types'
import { TranslateError } from '../../errors'
import { escapeTranslationText, decodeTranslationText } from '../utils/htmlText'
import { readTranslationResponse } from '../utils/response'

const langMap: Record<string, string> = {
  '自动检测': '', '简体中文': 'zh-Hans', '繁体中文': 'zh-Hant', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh-Hans',
  '意大利语': 'it', '葡萄牙语': 'pt', '阿拉伯语': 'ar',
  '泰语': 'th', '越南语': 'vi', '印尼语': 'id',
}

// Replaces the retired /translate/auth + cognitive.microsofttranslator.com flow.
const MICROSOFT_TRANSLATE_URL = 'https://edge.microsoft.com/translate/translatetext'

export const bing: TranslateProvider = {
  name: 'bing',
  label: '必应翻译',
  icon: 'ph-microsoft-outlook-logo',
  needsConfig: false,
  description: '使用微软 Edge 翻译接口，无需 API Key。',
  langMap,

  async translate(text, from, to) {
    if (!text.trim()) return ''
    const params = new URLSearchParams({
      from: langMap[from] || '',
      to: langMap[to] || 'zh-Hans',
      isEnterpriseClient: 'false',
    })
    const res = await fetch(`${MICROSOFT_TRANSLATE_URL}?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Even this text-only endpoint interprets raw angle brackets as HTML.
      body: JSON.stringify([escapeTranslationText(text)]),
    })
    const data = await readTranslationResponse(res, 'bing', '必应翻译')
    if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.translations?.[0]?.text !== 'string') {
      throw new TranslateError('invalid_response', '必应翻译返回格式异常', { engine: 'bing' })
    }
    const result = decodeTranslationText(data[0].translations[0].text).trim()
    if (!result) {
      throw new TranslateError('empty_result', '必应翻译返回为空', { engine: 'bing' })
    }
    return result
  },
}
