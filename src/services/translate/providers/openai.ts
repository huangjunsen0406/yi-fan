import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
  '中文-简': 'zh', '中文-繁': 'zh',
}

export const openai: TranslateProvider = {
  name: 'openai',
  label: 'OpenAI',
  icon: 'ph-openai-logo',
  needsConfig: true,
  helpUrl: 'https://platform.openai.com/api-keys',
  description: '使用 OpenAI ChatGPT 进行翻译，需要 API Key。支持自定义请求地址和模型。',
  configFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
    { key: 'model', label: '模型', type: 'text', placeholder: 'gpt-4o-mini' },
    { key: 'requestPath', label: '请求地址 (可选)', type: 'text', placeholder: 'https://api.openai.com' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    let requestPath = config.requestPath || 'https://api.openai.com'
    if (!/https?:\/\/.+/.test(requestPath)) requestPath = `https://${requestPath}`
    const apiUrl = new URL(requestPath)
    if (!apiUrl.pathname.endsWith('/chat/completions')) {
      apiUrl.pathname += apiUrl.pathname.endsWith('/') ? '' : '/'
      apiUrl.pathname += 'v1/chat/completions'
    }

    const model = config.model || 'gpt-4o-mini'
    const messages = [
      {
        role: 'system',
        content: 'You are a professional translation engine. Translate the text naturally and fluently. Only return the translated text, nothing else.',
      },
      { role: 'user', content: `Translate from ${fromLang} to ${toLang}:\n"""${text}"""` },
    ]

    const res = await fetch(apiUrl.href, {
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
