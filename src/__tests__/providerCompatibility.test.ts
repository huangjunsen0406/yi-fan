import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openai } from '../services/translate/providers/openai'
import { claude } from '../services/translate/providers/claude'
import { ollama } from '../services/translate/providers/ollama'
import { bingDict } from '../services/translate/providers/bing_dict'
import { cambridgeDict } from '../services/translate/providers/cambridge_dict'
import { lingva } from '../services/translate/providers/lingva'
import { yandex } from '../services/translate/providers/yandex'
import { friendlyError } from '../services/errors'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../services/http', () => ({ fetchWithTimeout: fetchMock }))

beforeEach(() => fetchMock.mockReset())

describe.each([openai, claude, ollama])('$name language prompts', provider => {
  it.each([
    ['简体中文', 'Simplified Chinese'],
    ['繁体中文', 'Traditional Chinese'],
    ['文言文', 'Classical Chinese'],
  ])('preserves the meaning of target %s', async (target, promptLanguage) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '译文' } }],
      content: [{ type: 'text', text: '译文' }],
      message: { content: '译文' },
    })))
    expect(await provider.translate('hello', '英语', target, { apiKey: 'test-key' })).toBe('译文')
    const request = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(request.messages.at(-1).content).toContain(`to ${promptLanguage}.`)
  })
})

describe.each([bingDict, cambridgeDict, lingva, yandex])('$name service failures', provider => {
  it('reports a blocked service instead of an absent dictionary entry or a missing user key', async () => {
    fetchMock.mockResolvedValue(new Response('Access disabled', { status: 403 }))
    const error = await provider.translate('serendipity', '英语', '简体中文').catch(error => error)
    expect(error).toMatchObject({ code: 'auth', engine: provider.name })
    expect(friendlyError(error)).toContain('鉴权失败')
    expect(friendlyError(error)).not.toMatch(/未收录|Key|配置/)
  })
})

it('does not corrupt literal @@ or slash characters through Lingva', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ translation: 'A/B @@ C' })))
  expect(await lingva.translate('A/B @@ C', '英语', '简体中文')).toBe('A/B @@ C')
  expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent('A/B @@ C'))
})

it('queries dictionary phrases instead of silently returning empty results', async () => {
  fetchMock.mockResolvedValue(new Response('<span class="trans dtrans dtrans-se">冰淇淋</span>'))
  expect(await cambridgeDict.translate('ice cream', '英语', '简体中文')).toBe('冰淇淋')
  expect(fetchMock.mock.calls[0][0]).toContain('ice%20cream')
})
