// ── Translation History Service (SQLite) ──
import Database from '@tauri-apps/plugin-sql'
import { buildWhere } from '../utils/historyQuery'

export interface HistoryRecord {
  id?: number
  source_text: string
  result_text: string
  engine: string
  source_lang: string
  target_lang: string
  created_at: string
  starred?: number
}

export interface HistoryQuery {
  limit?: number
  offset?: number
  keyword?: string
  engine?: string
  starredOnly?: boolean
  /** YYYY-MM-DD local date filter (created_at prefix) */
  date?: string
}

export { buildWhere }

const MAX_HISTORY_RECORDS = 5000

let db: Database | null = null

async function getDB(): Promise<Database> {
  if (!db) {
    db = await Database.load('sqlite:history.db')
    await db.execute(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_text TEXT NOT NULL,
        result_text TEXT NOT NULL,
        engine TEXT NOT NULL,
        source_lang TEXT DEFAULT '',
        target_lang TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')),
        starred INTEGER DEFAULT 0
      )
    `)
    // migrate: add starred if missing
    try {
      await db.execute('ALTER TABLE history ADD COLUMN starred INTEGER DEFAULT 0')
    } catch {
      /* column already exists */
    }
    await db.execute(`
      DELETE FROM history WHERE id NOT IN (
        SELECT MAX(id) FROM history
        GROUP BY source_text, engine, source_lang, target_lang
      )
    `)
    await trimHistory()
  }
  return db
}

async function trimHistory(): Promise<void> {
  if (!db) return
  const count = await getHistoryCount()
  if (count > MAX_HISTORY_RECORDS) {
    const excess = count - MAX_HISTORY_RECORDS
    await db.execute(
      `DELETE FROM history WHERE id IN (
        SELECT id FROM history WHERE COALESCE(starred,0) = 0 ORDER BY id ASC LIMIT $1
      )`,
      [excess]
    )
  }
}

export async function addHistory(
  record: Omit<HistoryRecord, 'id' | 'created_at' | 'starred'>
): Promise<void> {
  const d = await getDB()
  const existing = await d.select<{ id: number; starred: number }[]>(
    'SELECT id, COALESCE(starred,0) as starred FROM history WHERE source_text = $1 AND engine = $2 AND source_lang = $3 AND target_lang = $4 LIMIT 1',
    [record.source_text, record.engine, record.source_lang, record.target_lang]
  )
  if (existing.length > 0) {
    await d.execute(
      `UPDATE history SET result_text = $1, created_at = datetime('now','localtime') WHERE id = $2`,
      [record.result_text, existing[0].id]
    )
    return
  }
  await d.execute(
    'INSERT INTO history (source_text, result_text, engine, source_lang, target_lang, starred) VALUES ($1, $2, $3, $4, $5, 0)',
    [record.source_text, record.result_text, record.engine, record.source_lang, record.target_lang]
  )
  await trimHistory()
}

export async function getHistoryCount(q: HistoryQuery = {}): Promise<number> {
  const d = await getDB()
  const { sql, params } = buildWhere(q)
  const result = await d.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM history ${sql}`,
    params
  )
  return result[0]?.count ?? 0
}

export async function getHistory(
  limit: number = 20,
  offset: number = 0,
  q: HistoryQuery = {}
): Promise<HistoryRecord[]> {
  const d = await getDB()
  const { sql, params } = buildWhere(q)
  const p = [...params, limit, offset]
  const lim = params.length + 1
  const off = params.length + 2
  return await d.select<HistoryRecord[]>(
    `SELECT * FROM history ${sql} ORDER BY COALESCE(starred,0) DESC, id DESC LIMIT $${lim} OFFSET $${off}`,
    p
  )
}

export async function searchHistory(keyword: string): Promise<HistoryRecord[]> {
  return getHistory(200, 0, { keyword })
}

export async function getHistoryEngines(): Promise<string[]> {
  const d = await getDB()
  const rows = await d.select<{ engine: string }[]>(
    'SELECT DISTINCT engine FROM history ORDER BY engine'
  )
  return rows.map((r) => r.engine)
}

export async function toggleStarHistory(id: number): Promise<boolean> {
  const d = await getDB()
  const rows = await d.select<{ starred: number }[]>(
    'SELECT COALESCE(starred,0) as starred FROM history WHERE id = $1',
    [id]
  )
  if (!rows.length) return false
  const next = rows[0].starred ? 0 : 1
  await d.execute('UPDATE history SET starred = $1 WHERE id = $2', [next, id])
  return next === 1
}

export async function deleteHistory(id: number): Promise<void> {
  const d = await getDB()
  await d.execute('DELETE FROM history WHERE id = $1', [id])
}

export async function clearHistory(): Promise<void> {
  const d = await getDB()
  await d.execute('DELETE FROM history')
}

export async function exportHistory(): Promise<string> {
  const d = await getDB()
  const records = await d.select<HistoryRecord[]>('SELECT * FROM history ORDER BY id DESC')
  return JSON.stringify(records, null, 2)
}
