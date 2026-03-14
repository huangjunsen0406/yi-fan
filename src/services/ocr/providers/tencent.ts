// Tencent Cloud OCR Provider — calls Tencent Cloud GeneralBasicOCR API
import { fetch } from '@tauri-apps/plugin-http'
import type { OcrProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto',
  '简体中文': 'zh',
  '繁体中文': 'zh_rare',
  '英语': 'auto',
  '日语': 'jap',
  '韩语': 'kor',
  '法语': 'fre',
  '德语': 'ger',
}

// ── TC3 签名工具函数 ──
async function hmacSHA256(key: ArrayBuffer | string, message: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const keyData = typeof key === 'string' ? encoder.encode(key) : key
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
}

async function sha256Hex(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(message))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getUTCDate(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export const tencentOcr: OcrProvider = {
  name: 'tencent_ocr',
  label: '腾讯云 OCR',
  icon: 'ph-cloud',
  needsConfig: true,
  description: '使用腾讯云通用文字识别 API，每月有免费额度。需要在腾讯云创建密钥。',
  configFields: [
    { key: 'secret_id', label: 'SecretId', type: 'text', placeholder: '请输入腾讯云 SecretId' },
    { key: 'secret_key', label: 'SecretKey', type: 'password', placeholder: '请输入 SecretKey' },
  ],
  langMap,

  async recognize(base64: string, lang: string, config: Record<string, string> = {}): Promise<string> {
    const { secret_id, secret_key } = config
    if (!secret_id || !secret_key) throw new Error('请先配置腾讯云 OCR 的 SecretId 和 SecretKey')

    const mappedLang = langMap[lang] || 'auto'
    const endpoint = 'ocr.tencentcloudapi.com'
    const service = 'ocr'
    const action = 'GeneralBasicOCR'
    const version = '2018-11-19'
    const region = 'ap-beijing'
    const timestamp = Math.floor(Date.now() / 1000)
    const date = getUTCDate(timestamp)

    // Request body
    const body = JSON.stringify({ ImageBase64: base64, LanguageType: mappedLang })
    const hashedPayload = await sha256Hex(body)

    // Step 1: Canonical request
    const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`
    const signedHeaders = 'content-type;host'
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`

    // Step 2: String to Sign
    const algorithm = 'TC3-HMAC-SHA256'
    const credentialScope = `${date}/${service}/tc3_request`
    const hashedCanonical = await sha256Hex(canonicalRequest)
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonical}`

    // Step 3: Signature
    const kDate = await hmacSHA256(`TC3${secret_key}`, date)
    const kService = await hmacSHA256(kDate, service)
    const kSigning = await hmacSHA256(kService, 'tc3_request')
    const signature = bufferToHex(await hmacSHA256(kSigning, stringToSign))

    // Step 4: Authorization
    const authorization = `${algorithm} Credential=${secret_id}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    const res = await fetch(`https://${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Host: endpoint,
        'X-TC-Action': action,
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': version,
        'X-TC-Region': region,
      },
      body,
    })

    const data = await res.json() as any
    if (data.Response?.TextDetections) {
      return data.Response.TextDetections.map((t: any) => t.DetectedText).join('\n')
    }
    if (data.Response?.Error) {
      throw new Error(`腾讯 OCR 错误: ${data.Response.Error.Message} (${data.Response.Error.Code})`)
    }
    throw new Error('腾讯 OCR 识别失败: ' + JSON.stringify(data))
  },
}
