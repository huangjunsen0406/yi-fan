import { describe, it, expect } from 'vitest'
import {
  lookupSeedDict,
  isLikelySingleWordQuery,
} from '../services/localDict'
import {
  isDictionaryProvider,
  isOfflineCapable,
  getProvider,
} from '../services/translate'

describe('localDict seed', () => {
  it('finds common words offline', () => {
    expect(lookupSeedDict('hello')).toMatch(/你好/)
    expect(lookupSeedDict('Hello')).toMatch(/你好/)
    expect(lookupSeedDict('translate')).toBeTruthy()
  })

  it('misses unknown words', () => {
    expect(lookupSeedDict('xyznotaword123')).toBeNull()
  })

  it('detects single-word queries', () => {
    expect(isLikelySingleWordQuery('hello')).toBe(true)
    expect(isLikelySingleWordQuery('hello world')).toBe(true)
    expect(isLikelySingleWordQuery('a'.repeat(60))).toBe(false)
    expect(isLikelySingleWordQuery('第一句。第二句')).toBe(false)
  })
})

describe('dictionary provider flags', () => {
  it('marks ecdict offline + dictionary', () => {
    const p = getProvider('ecdict')
    expect(p?.capabilities?.offline).toBe(true)
    expect(p?.capabilities?.dictionary).toBe(true)
    expect(isDictionaryProvider('ecdict')).toBe(true)
    expect(isOfflineCapable('ecdict')).toBe(true)
  })

  it('marks bing/cambridge as dictionary', () => {
    expect(isDictionaryProvider('bing_dict')).toBe(true)
    expect(isDictionaryProvider('cambridge_dict')).toBe(true)
    expect(isOfflineCapable('google')).toBe(false)
  })
})
