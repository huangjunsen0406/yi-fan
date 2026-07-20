import { describe, it, expect } from 'vitest'
import {
  ONBOARDING_DONE_KEY,
  ONBOARDING_STEPS,
  isOnboardingFlagSet,
  isOnboardingDone,
  markOnboardingDone,
  createMemoryOnboardingStore,
} from '../services/onboarding'

describe('onboarding flag + persistence', () => {
  it('exports stable done key', () => {
    expect(ONBOARDING_DONE_KEY).toBe('onboarding_done')
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
})

describe('onboarding guide content', () => {
  it('covers shortcuts, free engines, and macOS xattr remedy', () => {
    const all = ONBOARDING_STEPS.map((s) => `${s.title}\n${s.body}`).join('\n')
    // shortcuts
    expect(all).toMatch(/快捷键/)
    expect(all).toMatch(/Ctrl\+Cmd\+Space|Ctrl\+Cmd\+D/)
    // free engines
    expect(all).toMatch(/谷歌|必应|DeepL/)
    expect(all).toMatch(/无需 Key|无需/)
    // macOS quarantine
    expect(all).toMatch(/xattr/)
    expect(all).toMatch(/已损坏|无法打开/)
  })

  it('has multiple steps including welcome', () => {
    expect(ONBOARDING_STEPS.length).toBeGreaterThanOrEqual(3)
    expect(ONBOARDING_STEPS[0].title).toMatch(/欢迎|易翻/)
  })
})
