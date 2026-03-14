// Volcengine OCR Provider — calls ByteDance Volcengine OCR API
import { fetch } from '@tauri-apps/plugin-http'
import type { OcrProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto',
  '简体中文': 'zh_cn',
  '繁体中文': 'zh_tw',
  '英语': 'en',
  '日语': 'ja',
  '韩语': 'ko',
  '法语': 'fr',
  '德语': 'de',
}

// ── 火山引擎签名工具 ──
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

export const volcengineOcr: OcrProvider = {
  name: 'volcengine_ocr',
  label: '火山引擎 OCR',
  icon: 'ph-cloud',
  needsConfig: true,
  description: '使用火山引擎文字识别 API。需要在火山引擎控制台创建密钥。',
  configFields: [
    { key: 'access_key_id', label: 'Access Key ID', type: 'text', placeholder: '请输入 Access Key ID' },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: '请输入 Secret Access Key' },
  ],
  langMap,

  async recognize(base64: string, _lang: string, config: Record<string, string> = {}): Promise<string> {
    const { access_key_id, secret_access_key } = config
    if (!access_key_id || !secret_access_key) throw new Error('请先配置火山引擎 OCR 的 Access Key')

    const host = 'visual.volcengineapi.com'
    const service = 'cv'
    const region = 'cn-north-1'
    const action = 'OCRNormal'
    const serviceVersion = '2020-08-26'

    // Build body
    const bodyStr = `image_base64=${encodeURIComponent(base64)}&approximate_pixel=0&mode=default&filter_thresh=80`
    const bodyHash = await sha256Hex(bodyStr)

    // X-Date header
    const now = new Date()
    const xDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
    const dateShort = xDate.slice(0, 8)

    // Credential scope
    const credentialScope = `${dateShort}/${region}/${service}/request`

    // Canonical request
    const signedHeaderKeys = ['content-type', 'host', 'x-content-sha256', 'x-date']
    const signedHeaderValues: Record<string, string> = {
      'content-type': 'application/x-www-form-urlencoded',
      'host': host,
      'x-content-sha256': bodyHash,
      'x-date': xDate,
    }
    const signedStr = signedHeaderKeys.map(k => `${k}:${signedHeaderValues[k]}\n`).join('')
    const signedHeadersStr = signedHeaderKeys.join(';')

    const normQuery = `Action=${action}&Version=${serviceVersion}`
    const canonicalRequest = `POST\n/\n${normQuery}\n${signedStr}\n${signedHeadersStr}\n${bodyHash}`

    const hashedCanonical = await sha256Hex(canonicalRequest)
    const stringToSign = `HMAC-SHA256\n${xDate}\n${credentialScope}\n${hashedCanonical}`

    // Signing key
    const kDate = await hmacSHA256(secret_access_key, dateShort)
    const kRegion = await hmacSHA256(kDate, region)
    const kService = await hmacSHA256(kRegion, service)
    const signingKey = await hmacSHA256(kService, 'request')
    const signature = bufferToHex(await hmacSHA256(signingKey, stringToSign))

    const authorization = `HMAC-SHA256 Credential=${access_key_id}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`

    const url = `https://${host}/?${normQuery}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: host,
        'X-Content-Sha256': bodyHash,
        'X-Date': xDate,
      },
      body: bodyStr,
    })

    const data = await res.json() as any
    if (data.data?.line_texts) {
      return data.data.line_texts.join('\n')
    }
    if (data.message) {
      throw new Error(`火山 OCR 错误: ${data.message}`)
    }
    throw new Error('火山 OCR 识别失败: ' + JSON.stringify(data))
  },
}
