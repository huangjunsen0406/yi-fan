import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  claude,
  buildAnthropicMessagesUrl,
} from '../services/translate/providers/claude'

describe('buildAnthropicMessagesUrl', () => {
  it('defaults to official Anthropic messages endpoint', () => {
    expect(buildAnthropicMessagesUrl()).toBe(
      'https://api.anthropic.com/v1/messages'
    )
    expect(buildAnthropicMessagesUrl('')).toBe(
      'https://api.anthropic.com/v1/messages'
    )
  })

  it('accepts host-only baseURL', () => {
    expect(buildAnthropicMessagesUrl('https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1/messages'
    )
  })

  it('does not double /v1 when base already ends with /v1', () => {
    expect(buildAnthropicMessagesUrl('https://proxy.example.com/v1')).toBe(
      'https://proxy.example.com/v1/messages'
    )
    expect(buildAnthropicMessagesUrl('https://proxy.example.com/v1/')).toBe(
      'https://proxy.example.com/v1/messages'
    )
  })

  it('keeps full /v1/messages path', () => {
    expect(
      buildAnthropicMessagesUrl('https://proxy.example.com/v1/messages')
    ).toBe('https://proxy.example.com/v1/messages')
  })

  it('prepends https when scheme missing', () => {
    expect(buildAnthropicMessagesUrl('my-proxy.local/v1')).toBe(
      'https://my-proxy.local/v1/messages'
    )
  })
})

describe('claude provider contract', () => {
  it('exposes Messages protocol labels and optional model/baseURL', () => {
    expect(claude.name).toBe('claude')
    expect(claude.label).toMatch(/Claude/i)
    expect(claude.needsConfig).toBe(true)
    const keys = (claude.configFields || []).map((f) => f.key)
    expect(keys).toEqual(expect.arrayContaining(['apiKey', 'model', 'requestPath']))
    const model = claude.configFields?.find((f) => f.key === 'model')
    const base = claude.configFields?.find((f) => f.key === 'requestPath')
    expect(model?.required).toBe(false)
    expect(base?.required).toBe(false)
  })
})

describe('claude.translate (mocked fetch)', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.doUnmock('../services/http')
    vi.resetModules()
  })

  it('POSTs Messages body with x-api-key and system at top level', async () => {
    const calls: { url: string; init: any }[] = []
    vi.doMock('../services/http', () => ({
      fetchWithTimeout: async (url: string, init?: any) => {
        calls.push({ url, init })
        return {
          json: async () => ({
            content: [{ type: 'text', text: '"translated"' }],
          }),
        }
      },
    }))

    const { claude: claudeFresh } = await import(
      '../services/translate/providers/claude'
    )

    const result = await claudeFresh.translate('hi', '英语', '简体中文', {
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-4-6',
      requestPath: 'https://proxy.local/v1',
    })

    expect(result).toBe('translated')
    expect(calls.length).toBe(1)
    expect(calls[0].url).toBe('https://proxy.local/v1/messages')
    expect(calls[0].init.headers['x-api-key']).toBe('sk-ant-test')
    expect(calls[0].init.headers['anthropic-version']).toBe('2023-06-01')
    expect(calls[0].init.headers.Authorization).toBeUndefined()
    const body = JSON.parse(calls[0].init.body)
    expect(body.model).toBe('claude-sonnet-4-6')
    expect(body.system).toBeTruthy()
    expect(body.messages[0].role).toBe('user')
    expect(body.max_tokens).toBeGreaterThan(0)
  })
})
