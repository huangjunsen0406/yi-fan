import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'ZH', '繁体中文': 'ZH', '英语': 'EN',
  '日语': 'JA', '韩语': 'KO', '法语': 'FR', '德语': 'DE',
  '西班牙语': 'ES', '俄语': 'RU', '文言文': 'ZH',
  '中文-简': 'ZH', '中文-繁': 'ZH',
  '意大利语': 'IT', '葡萄牙语': 'PT', '波兰语': 'PL',
  '荷兰语': 'NL', '土耳其语': 'TR',
}

function getICount(text: string) { return text.split('i').length - 1 }
function getTimeStamp(iCount: number) {
  const ts = Date.now()
  return iCount !== 0 ? ts - (ts % (iCount + 1)) + (iCount + 1) : ts
}
function getRandomNumber() { return (Math.floor(Math.random() * 99999) + 100000) * 1000 }

export const deepl: TranslateProvider = {
  name: 'deepl',
  label: 'DeepL',
  icon: 'ph-text-aa',
  needsConfig: false,
  description: '使用 DeepL 免费网页接口翻译，无需 API Key。如需使用官方 API，请配置 Auth Key。',
  configFields: [
    { key: 'authKey', label: 'Auth Key (可选)', type: 'password', placeholder: '留空则使用免费接口' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    if (config.authKey) {
      return translateByKey(text, from, to, config.authKey, langMap)
    }
    return translateByFree(text, from, to, langMap)
  },
}

async function translateByFree(text: string, from: string, to: string, lm: Record<string, string>): Promise<string> {
  const fromLang = lm[from] || 'auto'
  const toLang = lm[to] || 'ZH'
  const rand = getRandomNumber()
  const body: any = {
    jsonrpc: '2.0',
    method: 'LMT_handle_texts',
    params: {
      splitting: 'newlines',
      lang: {
        source_lang_user_selected: fromLang !== 'auto' ? fromLang.slice(0, 2) : 'auto',
        target_lang: toLang.slice(0, 2),
      },
      texts: [{ text, requestAlternatives: 3 }],
      timestamp: getTimeStamp(getICount(text)),
    },
    id: rand,
  }
  let bodyStr = JSON.stringify(body)
  if ((rand + 5) % 29 === 0 || (rand + 3) % 13 === 0) {
    bodyStr = bodyStr.replace('"method":"', '"method" : "')
  } else {
    bodyStr = bodyStr.replace('"method":"', '"method": "')
  }

  const res = await fetch('https://www2.deepl.com/jsonrpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr,
  })
  const result = await res.json() as any
  if (result?.result?.texts?.[0]?.text) {
    return result.result.texts[0].text.trim()
  }
  throw new Error(`DeepL 翻译错误: ${JSON.stringify(result)}`)
}

async function translateByKey(text: string, from: string, to: string, key: string, lm: Record<string, string>): Promise<string> {
  const toLang = lm[to] || 'ZH'
  const body: any = { text: [text], target_lang: toLang }
  const fromLang = lm[from]
  if (fromLang && fromLang !== 'auto') body.source_lang = fromLang

  let url: string
  if (key.endsWith(':fx')) url = 'https://api-free.deepl.com/v2/translate'
  else if (key.endsWith(':dp')) url = 'https://api.deepl-pro.com/v2/translate'
  else url = 'https://api.deepl.com/v2/translate'

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `DeepL-Auth-Key ${key}` },
    body: JSON.stringify(body),
  })
  const result = await res.json() as any
  if (result.translations?.[0]?.text) return result.translations[0].text.trim()
  throw new Error(`DeepL API 错误: ${JSON.stringify(result)}`)
}
