import { describe, it, expect } from 'vitest'
import {
  TranslateError,
  toTranslateError,
  inferErrorCode,
  friendlyError,
  isTranslateError,
} from '../services/errors'

describe('TranslateError', () => {
  it('carries code and engine', () => {
    const e = new TranslateError('offline', '当前离线', { engine: 'google' })
    expect(isTranslateError(e)).toBe(true)
    expect(e.code).toBe('offline')
    expect(e.engine).toBe('google')
  })

  it('infers codes from messages', () => {
    expect(inferErrorCode('请求超时 (15s)')).toBe('timeout')
    expect(inferErrorCode('HTTP 401 unauthorized')).toBe('auth')
    expect(inferErrorCode('429 rate limit')).toBe('rate_limit')
    expect(inferErrorCode('Failed to fetch')).toBe('network')
    expect(inferErrorCode('必应词典未收录: foo')).toBe('not_found')
  })

  it('toTranslateError preserves TranslateError', () => {
    const e = new TranslateError('auth', 'bad key', { engine: 'openai' })
    expect(toTranslateError(e).code).toBe('auth')
  })

  it.each([
    ['必应翻译获取 Token 失败', 'provider'],
    ['HTTP 401 invalid token', 'auth'],
    ['HTTP 错误: 429 invalid API key token', 'rate_limit'],
    ['HTTP 503 invalid API key', 'server'],
    ['请先配置 Claude API Key', 'not_configured'],
    ['请先配置腾讯云 OCR 的 SecretId 和 SecretKey', 'not_configured'],
    ['请先在设置中配置 OCR', 'not_configured'],
  ] as const)('classifies %s without treating arbitrary credentials as missing config', (message, code) => {
    expect(inferErrorCode(message)).toBe(code)
  })

  it('does not send Microsoft users to Key settings after a token failure', () => {
    const error = toTranslateError(new Error('必应翻译获取 Token 失败'), 'provider', 'bing')
    expect(friendlyError(error)).not.toMatch(/Key|配置/)
  })

  it('friendlyError maps structured codes', () => {
    expect(friendlyError(new TranslateError('offline', '当前离线'))).toMatch(/离线/)
    expect(friendlyError(new TranslateError('timeout', 'x'))).toMatch(/超时/)
    expect(friendlyError(new TranslateError('auth', 'x'))).toMatch(/鉴权/)
    expect(friendlyError(new Error('HTTP 429 invalid API key token'))).toMatch(/频繁|额度/)
  })
})
