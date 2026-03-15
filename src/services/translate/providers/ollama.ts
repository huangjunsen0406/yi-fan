import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

export const ollama: TranslateProvider = {
  name: 'ollama',
  label: 'Ollama',
  icon: 'ph-desktop',
  needsConfig: true,
  helpUrl: 'https://ollama.com/',
  description: '使用本地 Ollama 模型进行翻译，需要配置地址和模型名。',
  configFields: [
    { key: 'requestPath', label: '请求地址', type: 'text', placeholder: 'http://localhost:11434' },
    { key: 'model', label: '模型', type: 'text', placeholder: 'qwen2.5:7b' },
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
      { role: 'user', content: `Translate from ${fromLang} to ${toLang}:\n"""${text}"""` },
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
