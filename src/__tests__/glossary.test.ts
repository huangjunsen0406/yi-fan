import { describe, it, expect } from 'vitest'
import { protectTerms, restoreTerms } from '../services/glossary'
import { splitChunks } from '../utils/textChunk'

describe('glossary', () => {
  it('protects and restores terms', () => {
    const { text, restores } = protectTerms('Hello Grok world', [
      { source: 'Grok', target: '格洛克' },
    ])
    expect(text).not.toContain('Grok')
    expect(restores.length).toBe(1)
    expect(restoreTerms('译文 ' + restores[0].token, restores)).toContain('格洛克')
  })
})

describe('splitChunks', () => {
  it('keeps short text', () => {
    expect(splitChunks('hi', 10)).toEqual(['hi'])
  })
  it('splits long text', () => {
    const t = 'a'.repeat(50) + '\n\n' + 'b'.repeat(50)
    const parts = splitChunks(t, 40)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.join('').replace(/\n/g, '').length).toBe(100)
  })
})
