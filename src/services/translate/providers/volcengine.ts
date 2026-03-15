import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh-Hant', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

async function sha256Hash(message: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const ck = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return await crypto.subtle.sign('HMAC', ck, new TextEncoder().encode(message))
}

function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const volcengine: TranslateProvider = {
  name: 'volcengine',
  label: '火山翻译',
  icon: 'ph-mountains',
  needsConfig: true,
  helpUrl: 'https://www.volcengine.com/product/machine-translation',
  description: '使用火山引擎机器翻译 API，需要 AccessKey ID 和 Secret。',
  configFields: [
    { key: 'appid', label: 'Access Key ID', type: 'text', placeholder: '请输入 Access Key ID' },
    { key: 'secret', label: 'Secret Access Key', type: 'password', placeholder: '请输入 Secret Access Key' },
  ],
  langMap,

  async translate(text, _from, to, config = {}) {
    const toLang = langMap[to] || 'zh'
    const host = 'open.volcengineapi.com'
    const bodyStr = JSON.stringify({ TargetLanguage: toLang, TextList: [text] })
    const bodyHash = await sha256Hash(bodyStr)
    const formatDate = new Date().toISOString().replace(/-/g, '').replace(/:/g, '').replace(/\.[0-9]*/, '')
    const date = formatDate.slice(0, 8)
    const credScope = `${date}/cn-north-1/translate/request`

    const signedStr = `content-type:application/json\nhost:${host}\nx-content-sha256:${bodyHash}\nx-date:${formatDate}\n`
    const signedHeaders = 'content-type;host;x-content-sha256;x-date'
    const canonReq = `POST\n/\nAction=TranslateText&Version=2020-06-01\n${signedStr}\n${signedHeaders}\n${bodyHash}`
    const hashedCanon = await sha256Hash(canonReq)
    const signingStr = `HMAC-SHA256\n${formatDate}\n${credScope}\n${hashedCanon}`

    const kDate = await hmacSha256(config.secret, date)
    const kRegion = await hmacSha256(kDate, 'cn-north-1')
    const kService = await hmacSha256(kRegion, 'translate')
    const kSigning = await hmacSha256(kService, 'request')
    const sign = hexEncode(await hmacSha256(kSigning, signingStr))

    const authorization = `HMAC-SHA256 Credential=${config.appid}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${sign}`

    const res = await fetch(`https://${host}/?Action=TranslateText&Version=2020-06-01`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': host,
        'X-Content-Sha256': bodyHash,
        'X-Date': formatDate,
        'Authorization': authorization,
      },
      body: bodyStr,
    })
    const data = await res.json() as any
    if (data.TranslationList) {
      return data.TranslationList.map((t: any) => t.Translation).join('\n').trim()
    }
    throw new Error(`火山翻译错误: ${JSON.stringify(data)}`)
  },
}
