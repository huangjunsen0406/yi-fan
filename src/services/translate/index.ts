// ── Translation Provider Registry ──
// All 21 providers from pot-desktop, adapted to Provider interface.
// To add a new engine, create a file in providers/ and register it here.

import type { TranslateProvider } from './types'
import { TranslateError, toTranslateError } from '../errors'
import { isOnline } from '../network'
import {
  lookupLocalDict,
  rememberLocalDict,
  isLikelySingleWordQuery,
} from '../localDict'
import { google } from './providers/google'
import { transmart } from './providers/transmart'
import { baidu } from './providers/baidu'
import { youdao } from './providers/youdao'
import { deepl } from './providers/deepl'
import { bing } from './providers/bing'
import { yandex } from './providers/yandex'
import { openai } from './providers/openai'
import { alibaba } from './providers/alibaba'
import { tencent } from './providers/tencent'
import { volcengine } from './providers/volcengine'
import { niutrans } from './providers/niutrans'
import { caiyun } from './providers/caiyun'
import { chatglm } from './providers/chatglm'
import { geminipro } from './providers/geminipro'
import { ollama } from './providers/ollama'
import { lingva } from './providers/lingva'
import { bingDict } from './providers/bing_dict'
import { cambridgeDict } from './providers/cambridge_dict'
import { baiduField } from './providers/baidu_field'
import { ecdict } from './providers/ecdict'

export type { TranslateProvider, ConfigField, ProviderCapabilities } from './types'
export { TranslateError, toTranslateError } from '../errors'

/** All registered providers, in display order */
export const providers: TranslateProvider[] = [
  // ── Free / No config ──
  google,
  bing,
  deepl,
  transmart,
  yandex,
  lingva,
  // ── Dictionaries (free) ──
  bingDict,
  cambridgeDict,
  ecdict,
  // ── Needs API key ──
  baidu,
  baiduField,
  youdao,
  alibaba,
  tencent,
  volcengine,
  niutrans,
  caiyun,
  // ── AI / LLM ──
  openai,
  chatglm,
  geminipro,
  ollama,
]

/** Lookup provider by name */
export function getProvider(name: string): TranslateProvider | undefined {
  return providers.find((p) => p.name === name)
}

export function isDictionaryProvider(provider: TranslateProvider | string): boolean {
  const p = typeof provider === 'string' ? getProvider(provider) : provider
  if (!p) return false
  if (p.capabilities?.dictionary) return true
  return ['ecdict', 'bing_dict', 'cambridge_dict'].includes(p.name)
}

export function isOfflineCapable(provider: TranslateProvider | string): boolean {
  const p = typeof provider === 'string' ? getProvider(provider) : provider
  if (!p) return false
  return !!p.capabilities?.offline || p.name === 'ecdict'
}

/**
 * Translate using a named provider.
 * Offline: prefer local dictionary for single-word / dictionary engines.
 * When the source has blank-line paragraph breaks, translate each paragraph
 * separately and rejoin.
 */
export async function translate(
  engineName: string,
  text: string,
  from: string,
  to: string,
  config?: Record<string, string>
): Promise<string> {
  const provider = getProvider(engineName)
  if (!provider) {
    throw new TranslateError('unknown_engine', `未知翻译引擎: ${engineName}`, {
      engine: engineName,
    })
  }

  // Normalize Windows newlines
  let normalized = text.replace(/\r\n/g, '\n')

  const online =
    typeof navigator !== 'undefined' ? navigator.onLine : isOnline.value
  const dictMode = isDictionaryProvider(provider)
  const singleWord = isLikelySingleWordQuery(normalized)

  // Prefer local seed/cache for: offline, dictionary engines, offline-capable engines
  // (does NOT short-circuit online full-text engines like Google)
  if (singleWord && (!online || dictMode || provider.capabilities?.offline)) {
    try {
      const local = await lookupLocalDict(normalized)
      if (local) return local
    } catch {
      /* ignore local miss */
    }
  }

  if (!online && !isOfflineCapable(provider)) {
    // Last chance: any local hit for longer text first word
    if (isLikelySingleWordQuery(normalized)) {
      const local = await lookupLocalDict(normalized)
      if (local) return local
    }
    throw new TranslateError(
      'offline',
      '当前离线，该引擎需要网络。可切换 ECDICT 或等待恢复网络',
      { engine: engineName }
    )
  }

  // Glossary: protect source terms → translate → restore fixed targets
  const { applyGlossaryToTranslate, applyGlossaryToResult } = await import('../glossary')
  const { text: protectedText, restores } = await applyGlossaryToTranslate(normalized)
  normalized = protectedText

  const runOne = async (chunk: string) => {
    try {
      const out = await provider.translate(chunk, from, to, config)
      if (dictMode && out?.trim()) {
        void rememberLocalDict(chunk, out)
      }
      return applyGlossaryToResult(out, restores)
    } catch (e) {
      // Online dict miss → try local again
      if (dictMode) {
        const local = await lookupLocalDict(chunk)
        if (local) return applyGlossaryToResult(local, restores)
      }
      throw toTranslateError(e, 'provider', engineName)
    }
  }

  // Paragraph-aware translate: split on blank lines, keep separators
  if (/\n[ \t]*\n/.test(normalized)) {
    if (!online && !isOfflineCapable(provider)) {
      throw new TranslateError('offline', '当前离线，无法翻译多段文本', {
        engine: engineName,
      })
    }
    const parts = normalized.split(/(\n[ \t]*\n+)/)
    const results: string[] = []
    for (const part of parts) {
      if (!part) continue
      if (/^\n[ \t]*\n+$/.test(part) || /^[ \t]*\n+$/.test(part)) {
        results.push(part)
        continue
      }
      if (!part.trim()) {
        results.push(part)
        continue
      }
      results.push(await runOne(part))
    }
    return results.join('')
  }

  return runOne(normalized)
}
