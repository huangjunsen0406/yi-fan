import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh-tw', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

async function hmacSha1(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}

export const alibaba: TranslateProvider = {
  name: 'alibaba',
  label: '阿里翻译',
  icon: 'ph-cloud',
  needsConfig: true,
  helpUrl: 'https://www.aliyun.com/product/ai/alimt',
  description: '使用阿里云机器翻译，需要 AccessKey ID 和 AccessKey Secret。',
  configFields: [
    { key: 'accessKeyId', label: 'AccessKey ID', type: 'text', placeholder: '请输入 AccessKey ID' },
    { key: 'accessKeySecret', label: 'AccessKey Secret', type: 'password', placeholder: '请输入 AccessKey Secret' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const nonce = (Math.floor(Math.random() * 99999) + 100000) * 1000
    const timestamp = new Date().toISOString().replace(/\.[0-9]*/, '')

    const query = `AccessKeyId=${config.accessKeyId}&Action=TranslateGeneral&Format=JSON&FormatType=text&Scene=general&SignatureMethod=HMAC-SHA1&SignatureNonce=${nonce}&SignatureVersion=1.0&SourceLanguage=${fromLang}&SourceText=${encodeURIComponent(text)}&TargetLanguage=${toLang}&Timestamp=${encodeURIComponent(timestamp)}&Version=2018-10-12`

    let stringToSign = 'GET&' + encodeURIComponent('/') + '&' + encodeURIComponent(query)
    stringToSign = stringToSign.replace(/!/g, '%2521').replace(/'/g, '%2527')
      .replace(/\(/g, '%2528').replace(/\)/g, '%2529').replace(/\*/g, '%252A')
    const signature = await hmacSha1(config.accessKeySecret + '&', stringToSign)

    const url = `http://mt.cn-hangzhou.aliyuncs.com/api/translate/web/general?${query}&Signature=${encodeURIComponent(signature)}`
    const res = await fetch(url, { method: 'GET' })
    const data = await res.json() as any
    if (data.Code === '200') return data.Data?.Translated?.trim() || ''
    throw new Error(`阿里翻译错误: ${JSON.stringify(data)}`)
  },
}
