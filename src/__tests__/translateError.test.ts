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

  it('friendlyError maps structured codes', () => {
    expect(friendlyError(new TranslateError('offline', '当前离线'))).toMatch(/离线/)
    expect(friendlyError(new TranslateError('timeout', 'x'))).toMatch(/超时/)
    expect(friendlyError(new TranslateError('auth', 'x'))).toMatch(/鉴权/)
  })
})
