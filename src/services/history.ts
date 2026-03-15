// ── Translation History Service (SQLite) ──
import Database from '@tauri-apps/plugin-sql'

export interface HistoryRecord {
  id?: number
  source_text: string
  result_text: string
  engine: string
  source_lang: string
  target_lang: string
  created_at: string
}

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
        created_at TEXT DEFAULT (datetime('now','localtime'))
      )
    `)
    // 清除已有重复记录：同 source_text + engine + 语言对 只保留 id 最大（最新）的
    await db.execute(`
      DELETE FROM history WHERE id NOT IN (
        SELECT MAX(id) FROM history
        GROUP BY source_text, engine, source_lang, target_lang
      )
    `)
  }
  return db
}

/** Insert a new history record (dedup: same source+engine+langs → update) */
export async function addHistory(record: Omit<HistoryRecord, 'id' | 'created_at'>): Promise<void> {
  const d = await getDB()
  // 去重：相同 source_text + engine + 语言对 → 更新 result_text 和时间
  const existing = await d.select<{ id: number }[]>(
    'SELECT id FROM history WHERE source_text = $1 AND engine = $2 AND source_lang = $3 AND target_lang = $4 LIMIT 1',
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
    'INSERT INTO history (source_text, result_text, engine, source_lang, target_lang) VALUES ($1, $2, $3, $4, $5)',
    [record.source_text, record.result_text, record.engine, record.source_lang, record.target_lang]
  )
}

/** Get total count of history records */
export async function getHistoryCount(): Promise<number> {
  const d = await getDB()
  const result = await d.select<{ count: number }[]>('SELECT COUNT(*) as count FROM history')
  return result[0]?.count ?? 0
}

/** Get history records with pagination, newest first */
export async function getHistory(limit: number = 20, offset: number = 0): Promise<HistoryRecord[]> {
  const d = await getDB()
  return await d.select<HistoryRecord[]>(
    'SELECT * FROM history ORDER BY id DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  )
}

/** Search history by text (fuzzy match) */
export async function searchHistory(keyword: string): Promise<HistoryRecord[]> {
  const d = await getDB()
  const like = `%${keyword}%`
  return await d.select<HistoryRecord[]>(
    'SELECT * FROM history WHERE source_text LIKE $1 OR result_text LIKE $1 ORDER BY id DESC LIMIT 200',
    [like]
  )
}

/** Delete a single history record */
export async function deleteHistory(id: number): Promise<void> {
  const d = await getDB()
  await d.execute('DELETE FROM history WHERE id = $1', [id])
}

/** Clear all history */
export async function clearHistory(): Promise<void> {
  const d = await getDB()
  await d.execute('DELETE FROM history')
}

/** Export all history as JSON string */
export async function exportHistory(): Promise<string> {
  const d = await getDB()
  const records = await d.select<HistoryRecord[]>('SELECT * FROM history ORDER BY id DESC')
  return JSON.stringify(records, null, 2)
}
