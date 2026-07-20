import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  openai,
  buildOpenAIChatCompletionsUrl,
} from '../services/translate/providers/openai'

describe('buildOpenAIChatCompletionsUrl', () => {
  it('defaults to official OpenAI chat completions', () => {
    expect(buildOpenAIChatCompletionsUrl()).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
    expect(buildOpenAIChatCompletionsUrl('')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
  })

  it('accepts host-only baseURL', () => {
    expect(buildOpenAIChatCompletionsUrl('https://api.openai.com')).toBe(
      'https://api.openai.com/v1/chat/completions'
    )
    expect(buildOpenAIChatCompletionsUrl('https://proxy.example.com/')).toBe(
      'https://proxy.example.com/v1/chat/completions'
    )
  })

  it('does not double /v1 when base already ends with /v1', () => {
    expect(buildOpenAIChatCompletionsUrl('https://proxy.example.com/v1')).toBe(
      'https://proxy.example.com/v1/chat/completions'
    )
    expect(buildOpenAIChatCompletionsUrl('https://proxy.example.com/v1/')).toBe(
      'https://proxy.example.com/v1/chat/completions'
    )
  })

  it('keeps full /chat/completions path', () => {
    expect(
      buildOpenAIChatCompletionsUrl(
        'https://proxy.example.com/v1/chat/completions'
      )
    ).toBe('https://proxy.example.com/v1/chat/completions')
  })

  it('prepends https when scheme missing', () => {
    expect(buildOpenAIChatCompletionsUrl('my-proxy.local/v1')).toBe(
      'https://my-proxy.local/v1/chat/completions'
    )
  })

  it('preserves custom path prefixes', () => {
    expect(buildOpenAIChatCompletionsUrl('https://azure.example/openai')).toBe(
      'https://azure.example/openai/v1/chat/completions'
    )
  })
})

describe('openai provider contract', () => {
  it('exposes OpenAI-compat labels and configFields for key/model/baseURL', () => {
    expect(openai.label).toContain('OpenAI')
    expect(openai.needsConfig).toBe(true)
    const keys = (openai.configFields || []).map((f) => f.key)
    expect(keys).toEqual(expect.arrayContaining(['apiKey', 'model', 'requestPath']))
    const baseField = openai.configFields?.find((f) => f.key === 'requestPath')
    expect(baseField?.label).toMatch(/Base URL/i)
  })
})

describe('openai.translate (real provider + mocked fetchWithTimeout)', () => {
  beforeEach(() => {
    vi.resetModules()
  })
  afterEach(() => {
    vi.doUnmock('../services/translate/utils/fetchWithTimeout')
    vi.doUnmock('../services/http')
    vi.resetModules()
  })

  it('POSTs to custom baseURL without /v1/v1 and uses model + apiKey', async () => {
    const calls: { url: string; init: any }[] = []
    // openai imports fetchWithTimeout from '../utils/fetchWithTimeout' which re-exports http
    vi.doMock('../services/http', () => ({
      fetchWithTimeout: async (url: string, init?: any) => {
        calls.push({ url, init })
        return {
          json: async () => ({
            choices: [{ message: { content: '"translated"' } }],
          }),
        }
      },
    }))

    const { openai: openaiFresh, buildOpenAIChatCompletionsUrl: buildUrl } =
      await import('../services/translate/providers/openai')

    const result = await openaiFresh.translate('hi', '英语', '简体中文', {
      apiKey: 'k',
      model: 'gpt-4o-mini',
      requestPath: 'https://oneapi.local/v1',
    })

    expect(result).toBe('translated')
    expect(calls.length).toBe(1)
    expect(calls[0].url).toBe('https://oneapi.local/v1/chat/completions')
    expect(calls[0].url).not.toMatch(/\/v1\/v1\//)
    expect(calls[0].init.headers.Authorization).toBe('Bearer k')
    const body = JSON.parse(calls[0].init.body)
    expect(body.model).toBe('gpt-4o-mini')
    expect(buildUrl('https://oneapi.local/v1')).toBe(calls[0].url)
  })

  it('host-only base resolves to /v1/chat/completions', async () => {
    const calls: { url: string }[] = []
    vi.doMock('../services/http', () => ({
      fetchWithTimeout: async (url: string) => {
        calls.push({ url })
        return {
          json: async () => ({
            choices: [{ message: { content: 'ok' } }],
          }),
        }
      },
    }))

    const { openai: openaiFresh } = await import(
      '../services/translate/providers/openai'
    )
    await openaiFresh.translate('x', '英语', '简体中文', {
      apiKey: 'sk',
      requestPath: 'https://api.openai.com',
    })
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions')
  })
})
