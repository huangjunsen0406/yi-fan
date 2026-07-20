import { describe, it, expect } from 'vitest'
import { buildWhere, type HistoryQueryLike } from '../utils/historyQuery'

describe('history buildWhere', () => {
  it('returns empty for blank query', () => {
    expect(buildWhere({})).toEqual({ sql: '', params: [] })
  })

  it('filters by keyword on source and result', () => {
    const r = buildWhere({ keyword: 'hello' })
    expect(r.sql).toContain('source_text LIKE')
    expect(r.sql).toContain('result_text LIKE')
    expect(r.params).toEqual(['%hello%'])
  })

  it('filters by engine', () => {
    const r = buildWhere({ engine: 'google' })
    expect(r.sql).toBe('WHERE engine = $1')
    expect(r.params).toEqual(['google'])
  })

  it('filters starred only', () => {
    const r = buildWhere({ starredOnly: true })
    expect(r.sql).toContain('COALESCE(starred,0) = 1')
    expect(r.params).toEqual([])
  })

  it('filters by date prefix', () => {
    const r = buildWhere({ date: '2026-07-19' })
    expect(r.sql).toContain('created_at LIKE $1')
    expect(r.params).toEqual(['2026-07-19%'])
  })

  it('combines keyword + engine + date + starred', () => {
    const q: HistoryQueryLike = {
      keyword: 'foo',
      engine: 'bing',
      date: '2026-01-01',
      starredOnly: true,
    }
    const r = buildWhere(q)
    expect(r.sql.startsWith('WHERE ')).toBe(true)
    expect(r.sql).toContain(' AND ')
    expect(r.params).toEqual(['%foo%', 'bing', '2026-01-01%'])
  })

  it('ignores blank keyword', () => {
    const r = buildWhere({ keyword: '   ' })
    expect(r.sql).toBe('')
    expect(r.params).toEqual([])
  })
})
