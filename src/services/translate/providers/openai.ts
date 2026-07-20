import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

/**
 * Resolve OpenAI-compatible Chat Completions endpoint from user-provided base.
 * Accepts: host, host/v1, or full .../chat/completions (with optional trailing slash).
 * Avoids double `/v1/v1/...` when users paste `https://proxy/v1`.
 */
export function buildOpenAIChatCompletionsUrl(requestPath?: string): string {
  let base = (requestPath || 'https://api.openai.com').trim()
  if (!base) base = 'https://api.openai.com'
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`

  // Strip trailing slashes for stable joins
  base = base.replace(/\/+$/, '')

  try {
    const url = new URL(base)
    let path = url.pathname.replace(/\/+$/, '') || ''

    if (path.endsWith('/chat/completions')) {
      // already full endpoint
    } else if (path.endsWith('/v1') || /\/v\d+$/.test(path)) {
      path = `${path}/chat/completions`
    } else if (path === '' || path === '/') {
      path = '/v1/chat/completions'
    } else {
      // e.g. /openai or custom prefix → append /v1/chat/completions
      path = `${path}/v1/chat/completions`
    }

    url.pathname = path
    return url.href
  } catch {
    return 'https://api.openai.com/v1/chat/completions'
  }
}

export const openai: TranslateProvider = {
  name: 'openai',
  label: 'OpenAI 兼容',
  icon: 'ph-openai-logo',
  needsConfig: true,
  helpUrl: 'https://platform.openai.com/api-keys',
  description:
    '兼容 OpenAI Chat Completions API：官方 ChatGPT、Azure、OneAPI、本地中转、多数云厂商 OpenAI 兼容接口。填写 baseURL + API Key + 模型即可。Base URL 可写主机、/v1，或完整 /chat/completions 路径。',
  configFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-... 或供应商密钥' },
    { key: 'model', label: '模型', type: 'text', placeholder: 'gpt-4o-mini / deepseek-chat / …' },
    {
      key: 'requestPath',
      label: 'Base URL（OpenAI 兼容）',
      type: 'text',
      placeholder: 'https://api.openai.com 或 https://proxy.example/v1',
    },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const apiUrl = buildOpenAIChatCompletionsUrl(config.requestPath)

    const model = config.model || 'gpt-4o-mini'
    const messages = [
      {
        role: 'system',
        content: 'You are a professional translation engine. Translate the text naturally and fluently. Only return the translated text, nothing else.',
      },
      { role: 'user', content: `Translate from ${fromLang} to ${toLang}. Preserve the original line breaks and paragraph structure. Only return the translated text.\n"""${text}"""` },
    ]

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    })

    const data = await res.json() as any
    const content = data.choices?.[0]?.message?.content?.trim()
    if (content) {
      let result = content
      if (result.startsWith('"')) result = result.slice(1)
      if (result.endsWith('"')) result = result.slice(0, -1)
      return result.trim()
    }
    throw new Error(`OpenAI 翻译错误: ${JSON.stringify(data)}`)
  },
}
