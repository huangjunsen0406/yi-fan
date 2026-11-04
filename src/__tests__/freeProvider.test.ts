import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bing } from '../services/translate/providers/bing'
import { google } from '../services/translate/providers/google'
import { friendlyError, TranslateError } from '../services/errors'
import {
  decodeGoogleText, decodeTranslationText, encodeGoogleText, escapeTranslationText,
} from '../services/translate/utils/htmlText'

const fetchMock = vi.hoisted(() => vi.fn())
vi.mock('../services/http', () => ({ fetchWithTimeout: fetchMock }))

beforeEach(() => fetchMock.mockReset())

function reply(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200 })
}

describe('Microsoft Edge translation', () => {
  it('sends one POST with a string array and no user credentials', async () => {
    fetchMock.mockResolvedValue(reply([{ translations: [{ text: '你好 &amp; 世界' }] }]))
    expect(await bing.translate('Hello <world>', '英语', '简体中文')).toBe('你好 & 世界')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const endpoint = new URL(url)
    expect(endpoint.origin + endpoint.pathname).toBe('https://edge.microsoft.com/translate/translatetext')
    expect(Object.fromEntries(endpoint.searchParams)).toEqual({
      from: 'en', to: 'zh-Hans', isEnterpriseClient: 'false',
    })
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init.body as string)).toEqual(['Hello &lt;world&gt;'])
    expect(bing.needsConfig).toBe(false)
    expect(bing.configFields).toBeUndefined()
  })

  it('uses empty from for auto-detection and zh-Hant for traditional Chinese', async () => {
    fetchMock.mockResolvedValue(reply([{ translations: [{ text: '你好' }] }]))
    await bing.translate('hi', '自动检测', '繁体中文')
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('from')).toBe('')
    expect(url.searchParams.get('to')).toBe('zh-Hant')
  })

  it('does not send empty input', async () => {
    expect(await bing.translate('  ', '英语', '简体中文')).toBe('')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('Google translateHtml', () => {
  it('uses Read Frog protocol with the public web client key', async () => {
    fetchMock.mockResolvedValue(reply([['你好 &lt;世界&gt;']]))
    expect(await google.translate('Hello <world>', '英语', '简体中文')).toBe('你好 <世界>')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://translate-pa.googleapis.com/v1/translateHtml')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'Content-Type': 'application/json+protobuf',
      'X-Goog-API-Key': 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520',
    })
    expect(JSON.parse(init.body as string)).toEqual([[['Hello &lt;world&gt;'], 'en', 'zh-CN'], 'wt_lib'])
    expect(google.needsConfig).toBe(false)
    expect(google.configFields).toBeUndefined()
  })

  it('uses auto detection and traditional Chinese codes', async () => {
    fetchMock.mockResolvedValue(reply([['你好']]))
    await google.translate('hi', '自动检测', '繁体中文')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)[0].slice(1)).toEqual(['auto', 'zh-TW'])
  })

  it('preserves newlines through the HTML translator', async () => {
    const source = '  Hello\nWorld'
    fetchMock.mockResolvedValue(reply([[encodeGoogleText(source).replace('Hello', '你好').replace('World', '世界')]]))
    expect(await google.translate(source, '英语', '简体中文')).toBe('  你好\n世界')
  })

  it('preserves punctuation without sending fragments that HTML translation discards', async () => {
    expect(await google.translate('… & < >', '自动检测', '英语')).toBe('… & < >')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stops sending remaining chunks after rate limiting', async () => {
    fetchMock.mockResolvedValue(new Response('API key quota exceeded', { status: 429 }))
    await expect(google.translate('hello '.repeat(1000), '英语', '简体中文')).rejects.toMatchObject({ code: 'rate_limit' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe.each([bing, google])('$name upstream failures', (provider) => {
  it.each([
    [400, 'provider'], [401, 'auth'], [403, 'auth'], [404, 'not_found'],
    [429, 'rate_limit'], [500, 'server'], [502, 'server'],
  ])('preserves HTTP %i classification even if the body mentions API keys', async (status, code) => {
    fetchMock.mockResolvedValue(new Response('invalid token API key quota', { status }))
    const result = provider.translate('hello', '英语', '简体中文')
    await expect(result).rejects.toMatchObject({ code, engine: provider.name })
    await expect(result).rejects.toThrow(`HTTP 错误: ${status}`)
  })

  it('does not tell users to configure a key on web authentication failures', async () => {
    fetchMock.mockResolvedValue(new Response('invalid token', { status: 403 }))
    const error = await provider.translate('hello', '英语', '简体中文').catch(error => error)
    expect(error).toBeInstanceOf(TranslateError)
    expect(friendlyError(error)).toContain('网页翻译接口鉴权失败')
    expect(friendlyError(error)).not.toMatch(/Key|配置/)
  })

  it('reports non-JSON success responses as invalid responses', async () => {
    fetchMock.mockResolvedValue(new Response('<html>unavailable</html>'))
    await expect(provider.translate('hello', '英语', '简体中文')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it.each([null, {}, [], [null], [['one', 'two']], [{ translations: [{ text: 123 }] }]])('rejects malformed response %j', async data => {
    fetchMock.mockResolvedValue(reply(data))
    await expect(provider.translate('hello', '英语', '简体中文')).rejects.toMatchObject({ code: 'invalid_response' })
  })

  it('classifies empty translations separately', async () => {
    fetchMock.mockResolvedValue(reply(provider.name === 'bing' ? [{ translations: [{ text: ' ' }] }] : [[' ']]))
    await expect(provider.translate('hello', '英语', '简体中文')).rejects.toMatchObject({ code: 'empty_result' })
  })
})

describe('HTML text compatibility', () => {
  it('escapes HTML-like input and decodes exactly once, including numeric entities', () => {
    const text = '<b>literal &lt;</b> & "quote"'
    expect(decodeTranslationText(escapeTranslationText(text))).toBe(text)
    expect(decodeTranslationText('&#39;&#x27;&#x1F600;&nbsp;')).toBe("''😀\u00a0")
    expect(decodeTranslationText('&#x110000;&#xD800;')).toBe('&#x110000;&#xD800;')
  })

  it('restores indentation and list prefixes dropped by Google, including blank lines', () => {
    const source = '  - first\n\t• second\n\nlast'
    const result = encodeGoogleText(source).replace('  - first', '第一').replace('\t• second', '第二').replace('last', '最后')
    expect(decodeGoogleText(result, source)).toBe('  - 第一\n\t• 第二\n\n最后')
  })

  it('preserves separator runs and restores restyled bullets without duplication', () => {
    const source = '- first\nLast --- item'
    const translated = encodeGoogleText(source).replace('- first', '• 第一').replace('Last', '最后').replace('item', '项')
    expect(decodeGoogleText(translated, source)).toBe('- 第一\n最后 --- 项')
  })

  it('tolerates self-closing markers with spaces added by translation', () => {
    const source = 'one\ntwo'
    const translated = encodeGoogleText(source).replace(/<br data-yi-fan-lb="1">/g, ' <br data-yi-fan-lb="1" /> ')
    expect(decodeGoogleText(translated, source)).toBe(source)
  })

  it('degrades marker drift to newlines without exposing HTML markers', () => {
    const source = 'one\ntwo'
    expect(decodeGoogleText('一<br data-yi-fan-lb="1">二', source)).toBe('一\n二')
  })

  it('does not mistake escaped literal marker text for an injected line break', () => {
    const source = '<br data-yi-fan-lb="1">'
    expect(decodeGoogleText(encodeGoogleText(source), source)).toBe(source)
  })
})
