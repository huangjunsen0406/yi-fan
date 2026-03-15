import { fetch } from '@tauri-apps/plugin-http'
import type { TranslateProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'zh', '英语': 'en',
  '日语': 'ja', '韩语': 'ko', '法语': 'fr', '德语': 'de',
  '西班牙语': 'es', '俄语': 'ru', '文言文': 'zh',
}

export const chatglm: TranslateProvider = {
  name: 'chatglm',
  label: 'ChatGLM',
  icon: 'ph-robot',
  needsConfig: true,
  helpUrl: 'https://open.bigmodel.cn/',
  description: '使用智谱 ChatGLM 进行翻译，需要 API Key。',
  configFields: [
    { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '请输入 ChatGLM API Key (id.secret 格式)' },
    { key: 'model', label: '模型', type: 'text', placeholder: 'glm-4-flash' },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const model = config.model || 'glm-4-flash'

    const messages = [
      { role: 'system', content: 'You are a professional translation engine. Translate the text naturally and fluently. Only return the translated text.' },
      { role: 'user', content: `Translate from ${fromLang} to ${toLang}:\n"""${text}"""` },
    ]

    const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.apiKey,
      },
      body: JSON.stringify({ model, messages, stream: false }),
    })

    const data = await res.json() as any
    const content = data.choices?.[0]?.message?.content?.trim()
    if (content) return content
    throw new Error(`ChatGLM 翻译错误: ${JSON.stringify(data)}`)
  },
}
