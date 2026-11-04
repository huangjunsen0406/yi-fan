import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'Simplified Chinese', '繁体中文': 'Traditional Chinese', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'Classical Chinese',
}

export const ollama: TranslateProvider = {
  name: 'ollama',
  label: 'Ollama',
  icon: 'ph-desktop',
  needsConfig: true,
  helpUrl: 'https://ollama.com/',
  description: '连接 Ollama 服务，默认地址 http://localhost:11434、模型 qwen2.5:7b，也可自定义。',
  configFields: [
    { key: 'requestPath', label: '请求地址', type: 'text', placeholder: 'http://localhost:11434', required: false },
    { key: 'model', label: '模型', type: 'text', placeholder: 'qwen2.5:7b', required: false },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    let requestPath = config.requestPath || 'http://localhost:11434'
    if (requestPath.endsWith('/')) requestPath = requestPath.slice(0, -1)
    const model = config.model || 'qwen2.5:7b'

    const messages = [
      { role: 'system', content: 'You are a professional translation engine. Translate the text naturally and fluently. Only return the translated text.' },
      { role: 'user', content: `Translate from ${fromLang} to ${toLang}. Preserve the original line breaks and paragraph structure. Only return the translated text.\n"""${text}"""` },
    ]

    const res = await fetch(`${requestPath}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })

    const data = await res.json() as any
    const content = data.message?.content?.trim()
    if (content) return content
    throw new Error(`Ollama 翻译错误: ${JSON.stringify(data)}`)
  },
}
