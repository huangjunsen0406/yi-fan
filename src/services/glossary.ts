/**
 * Simple terminology glossary: replace terms before translation
 * (source→placeholder) and after (placeholder→target term).
 * Stored in settings store under _glossary.entries JSON.
 */
import { load } from '@tauri-apps/plugin-store'

export interface GlossaryEntry {
  source: string
  target: string
}

const STORE = 'settings.json'
const KEY = 'glossary_entries'

let cache: GlossaryEntry[] | null = null

async function getStore() {
  return load(STORE, { autoSave: true } as any)
}

export async function loadGlossary(): Promise<GlossaryEntry[]> {
  try {
    const store = await getStore()
    const raw = await store.get<GlossaryEntry[] | string>(KEY)
    if (Array.isArray(raw)) {
      cache = raw.filter((e) => e.source?.trim() && e.target?.trim())
      return cache
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = JSON.parse(raw) as GlossaryEntry[]
      cache = Array.isArray(parsed) ? parsed : []
      return cache
    }
  } catch { /* ignore */ }
  cache = []
  return cache
}

export async function saveGlossary(entries: GlossaryEntry[]): Promise<void> {
  cache = entries.filter((e) => e.source?.trim() && e.target?.trim())
  const store = await getStore()
  await store.set(KEY, cache)
}

/** Apply glossary: protect source terms, return text + restore map */
export function protectTerms(
  text: string,
  entries: GlossaryEntry[]
): { text: string; restores: { token: string; target: string }[] } {
  if (!entries.length) return { text, restores: [] }
  // Longer sources first to avoid partial replaces
  const sorted = [...entries].sort((a, b) => b.source.length - a.source.length)
  let out = text
  const restores: { token: string; target: string }[] = []
  sorted.forEach((e, i) => {
    if (!e.source || !out.includes(e.source)) return
    const token = `__YI_FAN_TERM_${i}__`
    out = out.split(e.source).join(token)
    restores.push({ token, target: e.target })
  })
  return { text: out, restores }
}

export function restoreTerms(
  text: string,
  restores: { token: string; target: string }[]
): string {
  let out = text
  for (const r of restores) {
    out = out.split(r.token).join(r.target)
  }
  return out
}

export async function applyGlossaryToTranslate(
  sourceText: string
): Promise<{ text: string; restores: { token: string; target: string }[] }> {
  const entries = cache ?? (await loadGlossary())
  return protectTerms(sourceText, entries)
}

export function applyGlossaryToResult(
  result: string,
  restores: { token: string; target: string }[]
): string {
  return restoreTerms(result, restores)
}
