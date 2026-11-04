import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chatglm } from '../services/translate/providers/chatglm'
import { geminipro } from '../services/translate/providers/geminipro'
import { baiduField } from '../services/translate/providers/baidu_field'
import { deepl } from '../services/translate/providers/deepl'
import { ecdict } from '../services/translate/providers/ecdict'

const { fetchMock, lookupLocalDict, rememberLocalDict } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  lookupLocalDict: vi.fn(),
  rememberLocalDict: vi.fn(),
}))

vi.mock('../services/translate/utils/fetchWithTimeout', () => ({ fetchWithTimeout: fetchMock }))
vi.mock('../services/localDict', () => ({ lookupLocalDict, rememberLocalDict }))

function respond(data: unknown, status = 200) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('navigator', { onLine: true })
  lookupLocalDict.mockResolvedValue(null)
  rememberLocalDict.mockResolvedValue(undefined)
})

afterEach(() => vi.unstubAllGlobals())

describe('provider configuration defaults', () => {
  it.each([
    [chatglm, 'model'],
    [geminipro, 'requestPath'],
    [baiduField, 'field'],
    [deepl, 'authKey'],
  ] as const)('%s declares its defaulted field optional', (provider, key) => {
    expect(provider.configFields?.find((field) => field.key === key)?.required).toBe(false)
  })
})

describe('ChatGLM request contract', () => {
  it.each([
    ['简体中文', 'Simplified Chinese'],
    ['繁体中文', 'Traditional Chinese'],
    ['文言文', 'Classical Chinese'],
  ])('uses Bearer auth, the default model, and the requested %s', async (target, language) => {
    respond({ choices: [{ message: { content: '译文' } }] })
    expect(await chatglm.translate('Hello', '英语', target, { apiKey: 'test-id.test-secret' })).toBe('译文')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer test-id.test-secret')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('glm-4-flash')
    expect(body.stream).toBe(false)
    expect(body.messages[1].content).toContain(`to ${language}.`)
  })
})

describe('Gemini request and response contract', () => {
  it('works with only an API key and joins visible text parts', async () => {
    respond({ candidates: [{ content: { parts: [
      { thought: true, text: 'internal reasoning' },
      { text: '你好' },
      { text: '世界' },
    ] } }] })
    expect(await geminipro.translate('Hello world', '英语', '繁体中文', { apiKey: 'test-key' })).toBe('你好世界')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=test-key')
    const body = JSON.parse(init.body)
    expect(body.contents[0].parts[0].text).toContain('to Traditional Chinese.')
  })

  it('keeps a configured model URL override', async () => {
    respond({ candidates: [{ content: { parts: [{ text: '译文' }] } }] })
    await geminipro.translate('Hello', '英语', '简体中文', {
      apiKey: 'test-key', requestPath: 'https://proxy.example/models/custom-model/',
    })
    expect(fetchMock.mock.calls[0][0]).toBe('https://proxy.example/models/custom-model:generateContent?key=test-key')
  })
})

describe('DeepL official API routing', () => {
  it.each([
    ['test-key:fx', 'https://api-free.deepl.com/v2/translate'],
    ['test-key:dp', 'https://api.deepl.com/v2/translate'],
    ['test-key', 'https://api.deepl.com/v2/translate'],
  ])('routes %s only to an official endpoint', async (authKey, endpoint) => {
    respond({ translations: [{ text: '你好' }] })
    expect(await deepl.translate('Hello', '英语', '简体中文', { authKey })).toBe('你好')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(endpoint)
    expect(init.headers.Authorization).toBe(`DeepL-Auth-Key ${authKey}`)
    expect(JSON.parse(init.body)).toEqual({ text: ['Hello'], target_lang: 'ZH', source_lang: 'EN' })
  })

  it('retains the no-key JSON-RPC path', async () => {
    respond({ result: { texts: [{ text: '你好' }] } })
    expect(await deepl.translate('Hello', '自动检测', '简体中文', {})).toBe('你好')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://www2.deepl.com/jsonrpc')
    expect(JSON.parse(init.body)).toMatchObject({
      method: 'LMT_handle_texts',
      params: { lang: { source_lang_user_selected: 'auto', target_lang: 'ZH' }, texts: [{ text: 'Hello' }] },
    })
  })
})

it('uses the default Baidu field while preserving returned layout', async () => {
  respond({ trans_result: [{ dst: '  译文' }, { dst: '下一行  ' }] })
  expect(await baiduField.translate('Hello', '英语', '简体中文', {
    appId: 'test-app', secretKey: 'test-secret',
  })).toBe('  译文\n下一行  ')
  const url = new URL(fetchMock.mock.calls[0][0])
  expect(url.pathname).toBe('/api/trans/vip/fieldtranslate')
  expect(url.searchParams.get('domain')).toBe('medicine')
})

describe('HTTP failures retain their status classification', () => {
  it.each([chatglm, geminipro, baiduField, deepl, ecdict])('%s rejects throttled responses before parsing', async (provider) => {
    respond({ error: 'invalid token' }, 429)
    await expect(provider.translate('serendipity', '英语', '简体中文', { apiKey: 'test-key' }))
      .rejects.toMatchObject({ code: 'rate_limit', engine: provider.name })
    expect(rememberLocalDict).not.toHaveBeenCalled()
  })
})

describe('ECDICT cache integrity', () => {
  it('returns local definitions without making an HTTP request', async () => {
    lookupLocalDict.mockResolvedValue('本地释义')
    expect(await ecdict.translate('serendipity', '英语', '简体中文')).toBe('本地释义')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(rememberLocalDict).not.toHaveBeenCalled()
  })

  it.each([
    ['  意外发现  ', '意外发现'],
    [{ translation: '  意外发现  ' }, '意外发现'],
    [{ explanations: [{ trait: 'n.', explains: ['意外发现', '幸运'] }, { explains: ['机缘'] }] }, 'n. 意外发现; 幸运\n机缘'],
  ])('caches recognized successful dictionary responses', async (data, expected) => {
    respond(data)
    expect(await ecdict.translate('serendipity', '英语', '简体中文')).toBe(expected)
    expect(rememberLocalDict).toHaveBeenCalledExactlyOnceWith('serendipity', expected)
  })

  it.each([
    { error: 'service unavailable' },
    {},
    null,
    '   ',
    { translation: { error: 'bad response' } },
    { explanations: 'not an array' },
    { explanations: [{ trait: 'n.', explains: { error: 'bad response' } }] },
    { explanations: [{ trait: 'n.', explains: [''] }] },
  ])('rejects unknown or empty responses without caching them', async (data) => {
    respond(data)
    await expect(ecdict.translate('serendipity', '英语', '简体中文'))
      .rejects.toMatchObject({ code: 'invalid_response', engine: 'ecdict' })
    expect(rememberLocalDict).not.toHaveBeenCalled()
  })

  it('does not parse or cache an HTTP error page', async () => {
    fetchMock.mockResolvedValue(new Response('error code: 1010', { status: 403 }))
    await expect(ecdict.translate('serendipity', '英语', '简体中文'))
      .rejects.toMatchObject({ code: 'auth', engine: 'ecdict' })
    expect(rememberLocalDict).not.toHaveBeenCalled()
  })

  it('rejects a local miss while offline without making a request', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await expect(ecdict.translate('serendipity', '英语', '简体中文')).rejects.toThrow('离线且本地词库未收录')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
