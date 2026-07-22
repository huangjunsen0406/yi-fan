import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_DONE_KEY,
  ONBOARDING_DONE_VERSION_KEY,
  ONBOARDING_STEPS,
  getOnboardingSteps,
  isOnboardingFlagSet,
  isOnboardingDone,
  markOnboardingDone,
  createMemoryOnboardingStore,
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
