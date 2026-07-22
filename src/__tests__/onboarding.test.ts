import { describe, it, expect, afterEach } from 'vitest'
import {
  ONBOARDING_DONE_KEY,
  ONBOARDING_DONE_VERSION_KEY,
  ONBOARDING_STEPS,
  getOnboardingSteps,
  isOnboardingFlagSet,
  isOnboardingDone,
  markOnboardingDone,
  createMemoryOnboardingStore,
  scrubDriverResidue,
} from '../services/onboarding'

describe('onboarding flag + persistence', () => {
  it('exports stable done keys', () => {
    expect(ONBOARDING_DONE_KEY).toBe('onboarding_done')
    expect(ONBOARDING_DONE_VERSION_KEY).toBe('onboarding_done_version')
  })

  it('isOnboardingFlagSet only true for boolean true', () => {
    expect(isOnboardingFlagSet(true)).toBe(true)
    expect(isOnboardingFlagSet(false)).toBe(false)
    expect(isOnboardingFlagSet('true')).toBe(false)
    expect(isOnboardingFlagSet(undefined)).toBe(false)
    expect(isOnboardingFlagSet(1)).toBe(false)
  })

  it('markOnboardingDone then isOnboardingDone returns true (memory store)', async () => {
    const store = createMemoryOnboardingStore()
    expect(await isOnboardingDone(store)).toBe(false)
    await markOnboardingDone(store)
    expect(await isOnboardingDone(store)).toBe(true)
    // second mark stays true (idempotent)
    await markOnboardingDone(store)
    expect(await isOnboardingDone(store)).toBe(true)
  })

  it('pre-seeded done flag is respected', async () => {
    const store = createMemoryOnboardingStore({ [ONBOARDING_DONE_KEY]: true })
    expect(await isOnboardingDone(store)).toBe(true)
  })

  it('forces tour again when app version changes', async () => {
    const store = createMemoryOnboardingStore()
    await markOnboardingDone(store, '0.2.3')
    expect(await isOnboardingDone(store, '0.2.3')).toBe(true)
    // upgraded — show tour once more
    expect(await isOnboardingDone(store, '0.2.4')).toBe(false)
    await markOnboardingDone(store, '0.2.4')
    expect(await isOnboardingDone(store, '0.2.4')).toBe(true)
  })

  it('legacy boolean-only done is not enough when version is required', async () => {
    const store = createMemoryOnboardingStore({ [ONBOARDING_DONE_KEY]: true })
    // old installs only had the boolean; new release still replays
    expect(await isOnboardingDone(store, '0.2.4')).toBe(false)
  })
})

describe('onboarding guide content', () => {
  it('covers shortcuts and free engines', () => {
    const all = ONBOARDING_STEPS.map((s) => `${s.title}\n${s.body}`).join('\n')
    // shortcuts
    expect(all).toMatch(/快捷键/)
    expect(all).toMatch(/快捷键|Ctrl\+Cmd|Ctrl\+Alt/)
    // free engines
    expect(all).toMatch(/谷歌|必应|DeepL/)
    expect(all).toMatch(/无需 Key|无需/)
  })

  it('has multiple steps including welcome and UI anchors', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(3)
    expect(ONBOARDING_STEPS[0].title).toMatch(/欢迎|易翻/)
    // product tour highlights real UI
    expect(ONBOARDING_STEPS.some((s) => s.element?.includes('data-tour'))).toBe(true)
  })

  it('does not include macOS quarantine tip (app must already open)', () => {
    const all = getOnboardingSteps()
      .map((s) => `${s.title}\n${s.body}`)
      .join('\n')
    expect(all).not.toMatch(/xattr|已损坏|无法打开/)
    expect(all).not.toMatch(/macOS 打开/)
  })
})

describe('scrubDriverResidue', () => {
  // vitest environment is node — install a minimal document mock for this suite
  let savedDocument: unknown

  function installDocMock() {
    const bodyClasses = new Set<string>(['driver-active', 'driver-simple', 'driver-no-scroll'])
    const cssProps = new Map<string, string>([['--driver-animation-duration', '400ms']])

    const overlay = {
      classes: new Set(['driver-overlay']),
      attrs: new Map<string, string>(),
      removed: false,
      remove() {
        this.removed = true
      },
      classList: {
        remove: (...c: string[]) => c.forEach((x) => overlay.classes.delete(x)),
      },
      removeAttribute() {},
    }
    const popover = {
      classes: new Set(['driver-popover']),
      attrs: new Map<string, string>(),
      removed: false,
      remove() {
        this.removed = true
      },
      classList: {
        remove: (...c: string[]) => c.forEach((x) => popover.classes.delete(x)),
      },
      removeAttribute() {},
    }
    const target = {
      classes: new Set(['driver-active-element', 'driver-no-interaction']),
      attrs: new Map([['aria-haspopup', 'dialog']]),
      removed: false,
      remove() {
        this.removed = true
      },
      classList: {
        remove: (...c: string[]) => c.forEach((x) => target.classes.delete(x)),
      },
      removeAttribute(k: string) {
        target.attrs.delete(k)
      },
      getAttribute(k: string) {
        return target.attrs.get(k) ?? null
      },
    }

    const live = [overlay, popover, target]

    const matches = (el: (typeof live)[number], selector: string) => {
      if (selector.startsWith('.')) return el.classes.has(selector.slice(1))
      if (selector.startsWith('#')) return el.attrs.get('id') === selector.slice(1)
      return false
    }

    const doc = {
      body: {
        classList: {
          remove: (...c: string[]) => c.forEach((x) => bodyClasses.delete(x)),
          contains: (c: string) => bodyClasses.has(c),
        },
        style: {
          removeProperty: (k: string) => cssProps.delete(k),
          getPropertyValue: (k: string) => cssProps.get(k) ?? '',
        },
      },
      querySelectorAll(sel: string) {
        const parts = sel.split(',').map((s) => s.trim())
        return live.filter((el) => !el.removed && parts.some((p) => matches(el, p)))
      },
    }

    savedDocument = (globalThis as { document?: unknown }).document
    ;(globalThis as { document: unknown }).document = doc
    return { bodyClasses, cssProps, overlay, popover, target }
  }

  afterEach(() => {
    if (savedDocument === undefined) {
      delete (globalThis as { document?: unknown }).document
    } else {
      ;(globalThis as { document: unknown }).document = savedDocument
    }
  })

  it('removes body.driver-active and leftover overlay so clicks work again', () => {
    const { bodyClasses, cssProps, overlay, popover, target } = installDocMock()

    scrubDriverResidue()

    expect(bodyClasses.has('driver-active')).toBe(false)
    expect(bodyClasses.has('driver-simple')).toBe(false)
    expect(bodyClasses.has('driver-no-scroll')).toBe(false)
    expect(cssProps.has('--driver-animation-duration')).toBe(false)
    expect(overlay.removed).toBe(true)
    expect(popover.removed).toBe(true)
    expect(target.classes.has('driver-active-element')).toBe(false)
    expect(target.classes.has('driver-no-interaction')).toBe(false)
    expect(target.getAttribute('aria-haspopup')).toBeNull()
  })

  it('is a no-op when document is undefined', () => {
    savedDocument = (globalThis as { document?: unknown }).document
    delete (globalThis as { document?: unknown }).document
    expect(() => scrubDriverResidue()).not.toThrow()
  })
})
