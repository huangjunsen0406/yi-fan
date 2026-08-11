import { describe, it, expect } from 'vitest'
import { providers, getProvider } from '../services/translate'

describe('provider registry includes claude + openai', () => {
  it('registers claude after openai in AI group', () => {
    const names = providers.map((p) => p.name)
    expect(names).toContain('openai')
    expect(names).toContain('claude')
    expect(names.indexOf('claude')).toBeGreaterThan(names.indexOf('openai'))
  })

  it('getProvider resolves claude', () => {
    expect(getProvider('claude')?.label).toMatch(/Claude/i)
  })
})

describe('isConfigured required field semantics', () => {
  it('openai only requires apiKey when model/requestPath optional', () => {
    const openai = getProvider('openai')!
    const requiredKeys = (openai.configFields || [])
      .filter((f) => f.required !== false)
      .map((f) => f.key)
    expect(requiredKeys).toEqual(['apiKey'])
  })

  it('claude only requires apiKey', () => {
    const claude = getProvider('claude')!
    const requiredKeys = (claude.configFields || [])
      .filter((f) => f.required !== false)
      .map((f) => f.key)
    expect(requiredKeys).toEqual(['apiKey'])
  })
})
