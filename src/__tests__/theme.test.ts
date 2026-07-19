import { describe, it, expect } from 'vitest'
import { resolveTheme } from '../services/theme'

describe('resolveTheme', () => {
  it('light/dark explicit', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })
  it('system returns light or dark', () => {
    const r = resolveTheme('system')
    expect(['light', 'dark']).toContain(r)
  })
})
