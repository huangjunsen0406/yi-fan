import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh-TW', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
  '中文-简': 'zh', '中文-繁': 'zh-TW',
}

async function sha256Hash(message: string): Promise<string> {
  const data = new TextEncoder().encode(message)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const tencent: TranslateProvider = {
  name: 'tencent',
  label: '腾讯云',
  icon: 'ph-cloud',
  needsConfig: true,
  helpUrl: 'https://cloud.tencent.com/product/tmt',
  description: '使用腾讯云机器翻译 (TMT) API，需要 SecretId 和 SecretKey。',
  configFields: [
    { key: 'secretId', label: 'Secret ID', type: 'text', placeholder: '请输入腾讯云 SecretId' },
    { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: '请输入腾讯云 SecretKey' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const host = 'tmt.tencentcloudapi.com'
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

    const payload = JSON.stringify({ SourceText: text, Source: fromLang, Target: toLang, ProjectId: 0 })
    const hashedPayload = await sha256Hash(payload)
    const canonicalRequest = `POST\n/\n\ncontent-type:application/json\nhost:${host}\n\ncontent-type;host\n${hashedPayload}`
    const credentialScope = `${date}/tmt/tc3_request`
    const hashedCanonical = await sha256Hash(canonicalRequest)
    const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedCanonical}`

    const secretDate = await hmacSha256(new TextEncoder().encode('TC3' + config.secretKey).buffer as ArrayBuffer, date)
    const secretService = await hmacSha256(secretDate, 'tmt')
    const secretSigning = await hmacSha256(secretService, 'tc3_request')
    const signature = hexEncode(await hmacSha256(secretSigning, stringToSign))

    const authorization = `TC3-HMAC-SHA256 Credential=${config.secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`

    const res = await fetch(`https://${host}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': host,
        'X-TC-Action': 'TextTranslate',
        'X-TC-Version': '2018-03-21',
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Region': 'ap-beijing',
        'Authorization': authorization,
      },
      body: payload,
    })

    const data = await res.json() as any
    if (data.Response?.Error) throw new Error(`腾讯云翻译错误: ${data.Response.Error.Message}`)
    return data.Response?.TargetText || ''
  },
}
