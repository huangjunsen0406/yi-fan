import { describe, it, expect } from 'vitest'
import { friendlyError } from '../services/errors'

describe('friendlyError', () => {
  it('timeout', () => {
    expect(friendlyError(new Error('请求超时 (15s)'))).toMatch(/超时/)
  })
  it('401', () => {
    expect(friendlyError(new Error('HTTP 401 unauthorized'))).toMatch(/鉴权/)
  })
  it('429', () => {
    expect(friendlyError(new Error('429 rate limit'))).toMatch(/频繁|额度/)
  })
  it('network', () => {
    expect(friendlyError(new Error('Failed to fetch'))).toMatch(/网络/)
  })
  it('truncates json dump', () => {
    const long = '{"error":"' + 'x'.repeat(200) + '"}'
    expect(friendlyError(new Error(long)).length).toBeLessThan(80)
  })
})
