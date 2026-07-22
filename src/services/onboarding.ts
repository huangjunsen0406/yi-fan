/**
 * First-run onboarding: persistence flag + Driver.js product tour.
 * Store adapter is injectable for unit tests (no Tauri required).
 * driver.js is loaded lazily so the main bundle / first paint stays light.
 *
 * Important: driver.js sets `body.driver-active` → CSS `pointer-events: none` on
 * every descendant. HMR / interrupted destroy can leave that class (or a fixed
 * overlay SVG) behind and the whole UI looks fine but is unclickable. Always
 * hard-clean residual DOM before/after a tour.
 */
import { load } from '@tauri-apps/plugin-store'
import type { Config, DriveStep, Driver } from 'driver.js'

export const ONBOARDING_STORE = 'settings.json'
/** Legacy boolean flag (kept for migration / tests) */
export const ONBOARDING_DONE_KEY = 'onboarding_done'
/** App version when the user last finished the tour — mismatch forces a one-time replay */
export const ONBOARDING_DONE_VERSION_KEY = 'onboarding_done_version'

/** Classes driver.js may leave on <body> */
const DRIVER_BODY_CLASSES = [
  'driver-active',
  'driver-fade',
  'driver-simple',
  'driver-no-scroll',
] as const

export interface OnboardingStoreAdapter {
  get: <T>(key: string) => Promise<T | undefined | null>
  set: (key: string, value: unknown) => Promise<void>
}

/** Step copy used by the tour + tests (must cover shortcuts / free engines) */
export interface OnboardingStep {
  id: string
  title: string
  body: string
  /** CSS selector for highlight target; omit for centered card */
  element?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}

/**
 * Product-tour steps (antd Tour style: highlight real UI + popover).
 * Keep free-engine / shortcut copy for tests and first-run help.
 * macOS quarantine (xattr) is not included: if the app cannot open, this tour never runs.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用易翻',
    body: '轻量跨平台翻译工具：划词、剪贴板、截图 OCR、多引擎并行。跟着高亮走一遍主界面即可上手。',
  },
  {
    id: 'input',
    title: '输入要翻译的文本',
    body: '在这里粘贴或输入内容。Enter 立即翻译，Shift+Enter 换行。',
    element: '[data-tour="input"]',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'input-tools',
    title: '原文工具',
    body: '朗读原文；「对齐」可删除多余换行（适合清理 PDF 复制文本）。',
    element: '[data-tour="input-tools"]',
    side: 'top',
    align: 'start',
  },
  {
    id: 'translate-btn',
    title: '一键翻译',
    body: '点这里或按 Enter 立即翻译；清空按钮在有内容时出现。',
    element: '[data-tour="translate-btn"]',
    side: 'top',
    align: 'end',
  },
  {
    id: 'engines',
    title: '选择翻译引擎',
    body: '无需 Key 即可用：谷歌、必应、DeepL（免费接口）。需要高质量可配置 OpenAI 兼容 API。',
    element: '[data-tour="engines"]',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'lang-controls',
    title: '语言方向',
    body: '切换源语言与目标语言。代码模式下，这里会变成命名格式（驼峰、下划线等）选择。',
    element: '[data-tour="lang-controls"]',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'output-tools',
    title: '译文工具',
    body: '朗读译文、复制结果，或「反向翻译」把译文作为新原文再译回去。',
    element: '[data-tour="output-tools"]',
    side: 'top',
    align: 'start',
  },
  {
    id: 'auto-copy',
    title: '自动复制',
    body: '循环切换：关闭 / 仅译文 / 原文+译文。开启后翻译完成会自动写入剪贴板。',
    element: '[data-tour="auto-copy"]',
    side: 'top',
    align: 'end',
  },
  {
    id: 'modes',
    title: '动态翻译与多引擎',
    body: '「动态」输入暂停后自动翻译（约 0.6 秒）；「并行」同时对比多个引擎结果。可按场景随时开关。',
    element: '[data-tour="modes"]',
    side: 'top',
    align: 'end',
  },
  {
    id: 'mode-toggle',
    title: '翻译 / 代码模式',
    body: '在「文本翻译」与「代码命名转换」之间切换；代码模式会按驼峰、下划线等格式输出。',
    element: '[data-tour="mode-toggle"]',
    side: 'top',
    align: 'start',
  },
  {
    id: 'toolbar',
    title: '工具栏',
    body: '主题、窗口置顶、剪贴板监听、翻译历史都在这里。剪贴板监听开启后会自动翻译新复制内容。',
    element: '[data-tour="toolbar"]',
    side: 'top',
    align: 'end',
  },
  {
    id: 'settings',
    title: '设置与快捷键',
    body: '常用快捷键可在设置中修改。macOS 默认：Ctrl+Cmd+Space 显示/隐藏 · Ctrl+Cmd+D 划词；Windows 默认：Ctrl+Alt+T / Ctrl+Alt+D 等（无 Cmd 键）。截图识别/翻译等为 Ctrl+Alt+O/P…',
    element: '[data-tour="settings"]',
    side: 'top',
    align: 'end',
  },
]

/** Tour steps (exported for tests / callers that need a stable list) */
export function getOnboardingSteps(): OnboardingStep[] {
  return ONBOARDING_STEPS
}

function toDriveSteps(steps: OnboardingStep[]): DriveStep[] {
  return steps.map((s) => ({
    // Only set element when present — welcome is a centered card without highlight
    ...(s.element ? { element: s.element } : {}),
    skipMissingElement: true,
    disableActiveInteraction: true,
    popover: {
      title: s.title,
      description: s.body,
      side: s.side,
      align: s.align,
    },
  }))
}

async function loadDriver(): Promise<typeof import('driver.js')> {
  // CSS is side-effect import; load together so popover isn't unstyled flash
  const mod = await import('driver.js')
  await import('driver.js/dist/driver.css')
  return mod
}

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

/**
 * Whether the tour should be skipped.
 * When `currentVersion` is provided, done only if the stored done-version matches
 * (so a new app version forces the tour once). Without version (unit tests), fall
 * back to the legacy boolean flag.
 */
export async function isOnboardingDone(
  store?: OnboardingStoreAdapter,
  currentVersion?: string
): Promise<boolean> {
  try {
    const s = store ?? (await defaultStore())
    if (currentVersion) {
      const doneVer = await s.get<string>(ONBOARDING_DONE_VERSION_KEY)
      return doneVer === currentVersion
    }
    return isOnboardingFlagSet(await s.get<boolean>(ONBOARDING_DONE_KEY))
  } catch {
    return false
  }
}

export async function markOnboardingDone(
  store?: OnboardingStoreAdapter,
  currentVersion?: string
): Promise<void> {
  const s = store ?? (await defaultStore())
  await s.set(ONBOARDING_DONE_KEY, true)
  if (currentVersion) {
    await s.set(ONBOARDING_DONE_VERSION_KEY, currentVersion)
  }
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

let activeTour: Driver | null = null
/** Generation counter: stale async start() after HMR / re-entry must not drive */
let tourGeneration = 0

export type StartOnboardingTourOptions = {
  store?: OnboardingStoreAdapter
  onDone?: () => void
  /** Current app version — written when the tour is finished / skipped */
  appVersion?: string
  /** Ensure main translate page is visible before highlighting */
  ensureHome?: () => void | Promise<void>
}

function waitFrames(n = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve()
      else requestAnimationFrame(() => step(left - 1))
    }
    step(n)
  })
}

/**
 * Remove any leftover driver.js DOM / body classes that block clicks.
 * Safe to call even when no tour is active (HMR, interrupted destroy, cold start).
 */
export function scrubDriverResidue(): void {
  if (typeof document === 'undefined') return

  const body = document.body
  if (body) {
    body.classList.remove(...DRIVER_BODY_CLASSES)
    body.style.removeProperty('--driver-animation-duration')
  }

  document
    .querySelectorAll(
      '.driver-overlay, .driver-popover, #driver-dummy-element, #driver-popover-content'
    )
    .forEach((el) => el.remove())

  document
    .querySelectorAll(
      '.driver-active-element, .driver-no-interaction, .driver-active-element-parent, .driver-active-element-parent-no-scroll'
    )
    .forEach((el) => {
      el.classList.remove(
        'driver-active-element',
        'driver-no-interaction',
        'driver-active-element-parent',
        'driver-active-element-parent-no-scroll'
      )
      el.removeAttribute('aria-haspopup')
      el.removeAttribute('aria-expanded')
      el.removeAttribute('aria-controls')
    })
}

/** Tear down active driver instance + residual DOM without bumping generation. */
function teardownActiveTour(): void {
  try {
    if (activeTour?.isActive()) activeTour.destroy()
  } catch {
    /* ignore */
  }
  activeTour = null
  scrubDriverResidue()
}

/**
 * Start Driver.js product tour (antd Tour style).
 * Marks onboarding done when the user finishes, skips, or closes.
 * driver.js is dynamically imported so first open does not pay the cost up front.
 */
export async function startOnboardingTour(
  options: StartOnboardingTourOptions = {}
): Promise<void> {
  // Invalidate any in-flight start() and drop previous instance (HMR-safe)
  const gen = ++tourGeneration
  teardownActiveTour()

  await options.ensureHome?.()
  if (gen !== tourGeneration) return

  // Wait for route + anchors to paint (first open is often still mounting footer/input)
  await waitFrames(2)
  if (gen !== tourGeneration) return

  const steps = getOnboardingSteps()
  const driveSteps = toDriveSteps(steps)
  if (!driveSteps.length) {
    await markOnboardingDone(options.store, options.appVersion)
    options.onDone?.()
    return
  }

  // Prefer starting only when core anchors exist; retry briefly on cold start
  const need = '[data-tour="input"], [data-tour="settings"]'
  for (let i = 0; i < 12; i++) {
    if (gen !== tourGeneration) return
    if (document.querySelector(need)) break
    await new Promise((r) => setTimeout(r, 50))
  }
  if (gen !== tourGeneration) return

  // Anchors still missing (e.g. wrong route / mid-HMR) — do not mount a broken tour
  if (!document.querySelector(need)) {
    console.warn('[onboarding] tour anchors missing; skip drive to avoid click-block overlay')
    scrubDriverResidue()
    return
  }

  let finished = false
  const finish = async () => {
    if (finished) return
    finished = true
    // Belt-and-suspenders: driver.destroy should clean up, but HMR/race can miss it
    scrubDriverResidue()
    try {
      await markOnboardingDone(options.store, options.appVersion)
    } catch {
      /* ignore */
    }
    options.onDone?.()
  }

  const { driver } = await loadDriver()
  if (gen !== tourGeneration) return

  const config: Config = {
    steps: driveSteps,
    // Lighter first-run: less animation jank on Tauri cold start
    animate: false,
    smoothScroll: false,
    allowClose: true,
    overlayOpacity: 0.45,
    stagePadding: 8,
    stageRadius: 10,
    popoverClass: 'yifan-tour-popover',
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '开始使用',
    showButtons: ['next', 'previous', 'close'],
    // Prevent background UI from stealing clicks under the overlay
    disableActiveInteraction: true,
    allowKeyboardControl: true,
    onDestroyed: () => {
      if (activeTour) activeTour = null
      scrubDriverResidue()
      void finish()
    },
  }

  activeTour = driver(config)
  // Yield once more so the popover mounts after paint, then drive
  await waitFrames(1)
  if (gen !== tourGeneration) {
    teardownActiveTour()
    return
  }
  try {
    activeTour.drive()
  } catch (e) {
    console.error('[onboarding] drive failed:', e)
    teardownActiveTour()
  }
}

/** Public teardown: cancel in-flight starts and remove residual click-block. */
export function destroyOnboardingTour(): void {
  tourGeneration += 1
  teardownActiveTour()
}

// Vite HMR: dispose residual overlay so hot reload never leaves a click-block
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    destroyOnboardingTour()
  })
  // Also scrub immediately when this module is re-evaluated after HMR
  scrubDriverResidue()
}
