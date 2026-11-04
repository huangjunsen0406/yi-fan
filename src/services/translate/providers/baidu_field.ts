import { fetchWithTimeout as fetch } from '../utils/fetchWithTimeout'
import { readTranslationResponse } from '../utils/response'
import type { TranslateProvider } from '../types'
import { simpleMd5 } from '../utils/md5'

const langMap: Record<string, string> = {
  '自动检测': 'auto', '简体中文': 'zh', '繁体中文': 'cht', '英语': 'en',
  '日语': 'jp', '韩语': 'kor', '法语': 'fra', '德语': 'de',
  '西班牙语': 'spa', '俄语': 'ru', '文言文': 'wyw',
}

export const baiduField: TranslateProvider = {
  name: 'baidu_field',
  label: '百度领域',
  icon: 'ph-buildings',
  needsConfig: true,
  helpUrl: 'https://fanyi-api.baidu.com/doc/22',
  description: '百度翻译领域翻译 API，支持生物医药、金融财经等领域专业翻译。',
  configFields: [
    { key: 'appId', label: 'App ID', type: 'text', placeholder: '请输入百度翻译 App ID' },
    { key: 'secretKey', label: '密钥', type: 'password', placeholder: '请输入密钥' },
    { key: 'field', label: '领域 (可选)', type: 'text', placeholder: 'medicine / finance / mechanics 等', required: false },
  ],
  langMap,

  async translate(text, from, to, config = {}) {
    const fromLang = langMap[from] || 'auto'
    const toLang = langMap[to] || 'zh'
    const salt = Date.now().toString()
    const field = config.field || 'medicine'
    const sign = simpleMd5(config.appId + text + salt + field + config.secretKey)

    const params = new URLSearchParams({
      q: text, from: fromLang, to: toLang,
      appid: config.appId, salt, sign, domain: field,
    })

    const res = await fetch(`https://fanyi-api.baidu.com/api/trans/vip/fieldtranslate?${params}`, { method: 'GET' })
    const data = await readTranslationResponse(res, 'baidu_field', '百度领域') as any
    if (data?.error_code) throw new Error(`百度领域翻译错误: ${data.error_msg} (${data.error_code})`)
    if (!Array.isArray(data?.trans_result) ||
      !data.trans_result.every((result: any) => typeof result?.dst === 'string')) {
      throw new Error('百度领域返回格式异常')
    }
    const result = data.trans_result.map((entry: any) => entry.dst).join('\n')
    if (!result.trim()) throw new Error('百度领域翻译结果为空')
    return result
  },
}
