import { describe, it, expect } from 'vitest'
import { splitChunks } from '../utils/textChunk'

describe('textChunk splitChunks (google long text)', () => {
  it('does not split under limit', () => {
    expect(splitChunks('short', 100)).toEqual(['short'])
  })

  it('prefers double-newline boundaries', () => {
    const a = 'A'.repeat(30)
    const b = 'B'.repeat(30)
    const parts = splitChunks(`${a}\n\n${b}`, 40)
    expect(parts.length).toBe(2)
    expect(parts[0]).toBe(a)
    expect(parts[1]).toBe(b)
  })

  it('falls back to hard cut when no break', () => {
    const t = 'x'.repeat(100)
    const parts = splitChunks(t, 40)
    expect(parts.every((p) => p.length <= 40)).toBe(true)
    expect(parts.join('')).toBe(t)
  })

  it('covers 1800-char google soft limit scenario', () => {
    const para = 'word '.repeat(400) // ~2000 chars
    const parts = splitChunks(para, 1800)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.every((p) => p.length <= 1800)).toBe(true)
  })
})
