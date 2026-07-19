import { describe, it, expect } from 'vitest'
import { TEXT_BLOCK_CHARS, isTextTooLong, isTextLongWarn } from '../utils/textLimit'
import { estimateIndeterminatePct } from '../utils/progress'

describe('textLimit', () => {
  it('blocks over limit', () => {
    expect(isTextTooLong(TEXT_BLOCK_CHARS)).toBe(false)
    expect(isTextTooLong(TEXT_BLOCK_CHARS + 1)).toBe(true)
  })
  it('warns in range', () => {
    expect(isTextLongWarn(2000)).toBe(true)
    expect(isTextLongWarn(100)).toBe(false)
  })
})

describe('estimateIndeterminatePct', () => {
  it('increases with downloads and caps under 100', () => {
    const a = estimateIndeterminatePct(1024 * 1024, 0)
    const b = estimateIndeterminatePct(4 * 1024 * 1024, a)
    expect(b).toBeGreaterThanOrEqual(a)
    expect(b).toBeLessThan(100)
  })
})
