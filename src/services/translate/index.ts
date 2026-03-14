// ── Translation Provider Registry ──
// All 21 providers from pot-desktop, adapted to Provider interface.
// To add a new engine, create a file in providers/ and register it here.

import type { TranslateProvider } from './types'
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

export type { TranslateProvider, ConfigField } from './types'

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
  return providers.find(p => p.name === name)
}

/** Translate using a named provider */
export async function translate(
  engineName: string,
  text: string,
  from: string,
  to: string,
  config?: Record<string, string>
): Promise<string> {
  const provider = getProvider(engineName)
  if (!provider) throw new Error(`未知翻译引擎: ${engineName}`)
  return provider.translate(text, from, to, config)
}
