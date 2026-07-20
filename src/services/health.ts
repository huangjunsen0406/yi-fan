import { useSettingsStore } from '../stores/settings'
import { translate, getProvider } from './translate'

export interface HealthResult {
  engine: string
  ok: boolean
  message: string
}

/** Lightweight ping of current default engine */
export async function checkDefaultEngineHealth(): Promise<HealthResult> {
  const settings = useSettingsStore()
  await settings.init()
  const engine =
    settings.getConfig('_translate')['defaultEngine'] ||
    settings.enabledEngines[0] ||
    'google'
  const provider = getProvider(engine)
  if (!provider) {
    return { engine, ok: false, message: '未知引擎' }
  }
  if (!settings.isConfigured(engine)) {
    return { engine, ok: false, message: '引擎未配置 API Key' }
  }
  try {
    const config = settings.getConfig(engine)
    const r = await translate(engine, 'ok', '英语', '简体中文', config)
    if (r && r.trim()) {
      return { engine, ok: true, message: '正常' }
    }
    return { engine, ok: false, message: '返回为空' }
  } catch (e: any) {
    return { engine, ok: false, message: e?.message || '检测失败' }
  }
}
