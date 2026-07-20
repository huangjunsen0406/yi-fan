/**
 * First-run onboarding: persistence flag + shared step content.
 * Store adapter is injectable for unit tests (no Tauri required).
 */
import { load } from '@tauri-apps/plugin-store'

export const ONBOARDING_STORE = 'settings.json'
/** Persisted key: true after user finishes or skips the guide */
export const ONBOARDING_DONE_KEY = 'onboarding_done'

export interface OnboardingStoreAdapter {
  get: <T>(key: string) => Promise<T | undefined | null>
  set: (key: string, value: unknown) => Promise<void>
}

export interface OnboardingStep {
  title: string
  body: string
}

/** Shared copy used by OnboardingModal + tests (must cover shortcuts / free engines / xattr) */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: '欢迎使用易翻',
    body: '轻量跨平台翻译工具：划词、剪贴板、截图 OCR、多引擎并行。',
  },
  {
    title: '常用快捷键（macOS）',
    body: 'Ctrl+Cmd+Space 显示/隐藏 · Ctrl+Cmd+D 划词 · Ctrl+Alt+O 截图识别 · Ctrl+Alt+P 截图翻译 · Ctrl+Alt+L 剪贴板监听。可在设置中修改。',
  },
  {
    title: '推荐引擎',
    body: '无需 Key 即可用：谷歌、必应、DeepL（免费接口）。需要高质量可配置 OpenAI 兼容 API（支持自定义 baseURL）。',
  },
  {
    title: 'macOS 打开提示',
    body: '若提示「已损坏，无法打开」，在终端执行：\nsudo xattr -cr /Applications/易翻.app\n然后重新打开。这是未公证应用的常见情况。',
  },
]

export function isOnboardingFlagSet(value: unknown): boolean {
  return value === true
}

async function defaultStore(): Promise<OnboardingStoreAdapter> {
  const store = await load(ONBOARDING_STORE, { autoSave: true } as any)
  return {
    get: (key) => store.get(key),
    set: async (key, value) => {
      await store.set(key, value)
    },
  }
}

export async function isOnboardingDone(
  store?: OnboardingStoreAdapter
): Promise<boolean> {
  try {
    const s = store ?? (await defaultStore())
    return isOnboardingFlagSet(await s.get<boolean>(ONBOARDING_DONE_KEY))
  } catch {
    return false
  }
}

export async function markOnboardingDone(
  store?: OnboardingStoreAdapter
): Promise<void> {
  const s = store ?? (await defaultStore())
  await s.set(ONBOARDING_DONE_KEY, true)
}

/** In-memory adapter for unit tests */
export function createMemoryOnboardingStore(
  initial: Record<string, unknown> = {}
): OnboardingStoreAdapter {
  const map = new Map<string, unknown>(Object.entries(initial))
  return {
    get: async <T>(key: string) => map.get(key) as T | undefined,
    set: async (key, value) => {
      map.set(key, value)
    },
  }
}
