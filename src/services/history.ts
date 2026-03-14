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
  }
  return db
}

/** Insert a new history record */
export async function addHistory(record: Omit<HistoryRecord, 'id' | 'created_at'>): Promise<void> {
  const d = await getDB()
  await d.execute(
    'INSERT INTO history (source_text, result_text, engine, source_lang, target_lang) VALUES ($1, $2, $3, $4, $5)',
    [record.source_text, record.result_text, record.engine, record.source_lang, record.target_lang]
  )
}

/** Get all history records, newest first */
export async function getHistory(limit: number = 100, offset: number = 0): Promise<HistoryRecord[]> {
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
