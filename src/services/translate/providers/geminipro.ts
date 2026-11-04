import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import { readTranslationResponse } from '../utils/response'
import type { TranslateProvider } from '../types'

const DEFAULT_REQUEST_PATH = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'Simplified Chinese', '繁体中文': 'Traditional Chinese', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'Classical Chinese',
}

export const geminipro: TranslateProvider = {
  name: 'geminipro',
  label: 'Gemini',
  icon: 'ph-diamond',
  needsConfig: true,
  helpUrl: 'https://aistudio.google.com/app/apikey',
  description: '使用 Google Gemini 进行翻译，需要 API Key。',
  configFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入 Gemini API Key' },
    { key: 'requestPath', label: '请求地址 (可选)', type: 'text', placeholder: DEFAULT_REQUEST_PATH, required: false },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'Simplified Chinese'
    let requestPath = config.requestPath || DEFAULT_REQUEST_PATH
    if (!/https?:\/\/.+/.test(requestPath)) requestPath = `https://${requestPath}`
    if (requestPath.endsWith('/')) requestPath = requestPath.slice(0, -1)
    const url = `${requestPath}:generateContent?key=${config.apiKey}`

    const contents = [
      { role: 'user', parts: [{ text: `Translate the following text from ${fromLang} to ${toLang}. Preserve the original line breaks and paragraph structure. Only return the translated text, nothing else.\n\n${text}` }] },
    ]

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    })

    const data = await readTranslationResponse(res, 'geminipro', 'Gemini') as any
    const parts = data?.candidates?.[0]?.content?.parts
    const result = Array.isArray(parts)
      ? parts.filter((part: any) => !part?.thought && typeof part?.text === 'string').map((part: any) => part.text).join('').trim()
      : ''
    if (result) {
      let clean = result
      if (clean.startsWith('"')) clean = clean.slice(1)
      if (clean.endsWith('"')) clean = clean.slice(0, -1)
      return clean.trim()
    }
    throw new Error(`Gemini 翻译错误: ${JSON.stringify(data)}`)
  },
}
