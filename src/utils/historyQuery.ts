/** Pure history filter helpers (unit-testable, no Tauri/SQL deps) */

export interface HistoryQueryLike {
  keyword?: string
  engine?: string
  starredOnly?: boolean
  /** YYYY-MM-DD local date filter (created_at prefix) */
  date?: string
}

/** Build SQL WHERE clause + params for history table */
export function buildWhere(q: HistoryQueryLike): { sql: string; params: unknown[] } {
  const clauses: string[] = []
  const params: unknown[] = []
  let i = 1
  if (q.keyword?.trim()) {
    clauses.push(`(source_text LIKE $${i} OR result_text LIKE $${i})`)
    params.push(`%${q.keyword.trim()}%`)
    i++
  }
  if (q.engine) {
    clauses.push(`engine = $${i}`)
    params.push(q.engine)
    i++
  }
  if (q.starredOnly) {
    clauses.push(`COALESCE(starred,0) = 1`)
  }
  if (q.date) {
    clauses.push(`created_at LIKE $${i}`)
    params.push(`${q.date}%`)
    i++
  }
  const sql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return { sql, params }
}
