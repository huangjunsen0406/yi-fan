import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'Simplified Chinese', '繁体中文': 'Traditional Chinese', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'Classical Chinese',
}

const DEFAULT_BASE = 'https://api.anthropic.com'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_MAX_TOKENS = 4096

/**
 * Resolve Anthropic Messages endpoint from user Base URL.
 * Accepts: host, host/v1, or full .../v1/messages.
 */
export function buildAnthropicMessagesUrl(requestPath?: string): string {
  let base = (requestPath || DEFAULT_BASE).trim()
  if (!base) base = DEFAULT_BASE
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`
  base = base.replace(/\/+$/, '')

  try {
    const url = new URL(base)
    let path = url.pathname.replace(/\/+$/, '') || ''

    if (path.endsWith('/v1/messages') || path.endsWith('/messages')) {
      // already full endpoint
    } else if (path.endsWith('/v1') || /\/v\d+$/.test(path)) {
      path = `${path}/messages`
    } else if (path === '' || path === '/') {
      path = '/v1/messages'
    } else {
      path = `${path}/v1/messages`
    }

    url.pathname = path
    return url.href
  } catch {
    return `${DEFAULT_BASE}/v1/messages`
  }
}

function extractText(data: any): string | null {
  const blocks = data?.content
  if (!Array.isArray(blocks)) return null
  const texts = blocks
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
  if (!texts.length) return null
  return texts.join('').trim()
}

export const claude: TranslateProvider = {
  name: 'claude',
  label: 'Claude',
  icon: 'ph-sparkle',
  needsConfig: true,
  helpUrl: 'https://console.anthropic.com/settings/keys',
  description:
    'Anthropic Messages 原生协议（/v1/messages）：官方 Claude API 或兼容 Messages 的中转。填写 API Key + 模型；Base URL 可写主机、/v1 或完整 /v1/messages。若中转仅提供 OpenAI Chat Completions 路由，请改用「OpenAI 兼容」。',
  configFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-... 或中转密钥' },
    {
      key: 'model',
      label: '模型',
      type: 'text',
      placeholder: 'claude-sonnet-4-6 / claude-haiku-4-5 / …',
      required: false,
    },
    {
      key: 'requestPath',
      label: 'Base URL',
      type: 'text',
      placeholder: 'https://api.anthropic.com 或 https://proxy.example/v1',
      required: false,
    },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    if (!config.apiKey?.trim()) {
      throw new Error('请先配置 Claude API Key')
    }

    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const apiUrl = buildAnthropicMessagesUrl(config.requestPath)
    const model = (config.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL

    const system =
      'You are a professional translation engine. Translate the text naturally and fluently. Only return the translated text, nothing else.'
    const userContent =
      `Translate from ${fromLang} to ${toLang}. Preserve the original line breaks and paragraph structure. Only return the translated text.\n"""${text}"""`

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    const data = await res.json() as any

    if (data?.error) {
      const msg = data.error?.message || JSON.stringify(data.error)
      throw new Error(`Claude 错误: ${msg}`)
    }

    if (data?.type === 'error') {
      throw new Error(`Claude 错误: ${data.error?.message || JSON.stringify(data)}`)
    }

    const content = extractText(data)
    if (content) {
      let result = content
      if (result.startsWith('"')) result = result.slice(1)
      if (result.endsWith('"')) result = result.slice(0, -1)
      return result.trim()
    }

    throw new Error(`Claude 翻译错误: ${JSON.stringify(data)}`)
  },
}
