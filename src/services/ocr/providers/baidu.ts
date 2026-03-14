// Baidu OCR Provider — calls Baidu Cloud OCR API
import { fetch } from '@tauri-apps/plugin-http'
import type { OcrProvider } from '../types'

const langMap: Record<string, string> = {
  '自动检测': 'CHN_ENG',
  '简体中文': 'CHN_ENG',
  '繁体中文': 'CHN_ENG',
  '英语': 'ENG',
  '日语': 'JAP',
  '韩语': 'KOR',
  '法语': 'FRE',
  '德语': 'GER',
}

export const baiduOcr: OcrProvider = {
  name: 'baidu_ocr',
  label: '百度 OCR',
  icon: 'ph-cloud',
  needsConfig: true,
  description: '使用百度云文字识别 API，每天有免费额度。需要在百度智能云创建应用获取 API Key 和 Secret Key。',
  configFields: [
    { key: 'client_id', label: 'API Key', type: 'text', placeholder: '请输入百度 OCR API Key' },
    { key: 'client_secret', label: 'Secret Key', type: 'password', placeholder: '请输入 Secret Key' },
  ],
  langMap,

  async recognize(base64: string, lang: string, config: Record<string, string> = {}): Promise<string> {
    const { client_id, client_secret } = config
    if (!client_id || !client_secret) throw new Error('请先配置百度 OCR 的 API Key 和 Secret Key')

    const mappedLang = langMap[lang] || 'CHN_ENG'

    // Step 1: Get access token
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(client_id)}&client_secret=${encodeURIComponent(client_secret)}`
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    })
    const tokenData = await tokenRes.json() as any
    if (!tokenData.access_token) throw new Error('百度 OCR 获取 Token 失败: ' + JSON.stringify(tokenData))

    // Step 2: Call OCR API
    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${tokenData.access_token}`
    const body = new URLSearchParams({
      image: base64,
      language_type: mappedLang,
      detect_direction: 'false',
    })

    const res = await fetch(ocrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json() as any

    if (data.words_result) {
      return data.words_result.map((w: any) => w.words).join('\n')
    }
    throw new Error('百度 OCR 识别失败: ' + JSON.stringify(data))
  },
}
