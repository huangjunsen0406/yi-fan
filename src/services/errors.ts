/**
 * Structured translation errors + friendly Chinese messages for UI.
 */

export type TranslateErrorCode =
  | 'unknown_engine'
  | 'not_configured'
  | 'offline'
  | 'network'
  | 'timeout'
  | 'auth'
  | 'rate_limit'
  | 'not_found'
  | 'server'
  | 'invalid_response'
  | 'empty_result'
  | 'provider'

export class TranslateError extends Error {
  readonly code: TranslateErrorCode
  readonly engine?: string
  readonly cause?: unknown

  constructor(
    code: TranslateErrorCode,
    message: string,
    opts?: { engine?: string; cause?: unknown }
  ) {
    super(message)
    this.name = 'TranslateError'
    this.code = code
    this.engine = opts?.engine
    this.cause = opts?.cause
  }
}

export function isTranslateError(err: unknown): err is TranslateError {
  return err instanceof TranslateError
}

/** Infer structured code from a raw error message */
export function inferErrorCode(msg: string): TranslateErrorCode {
  const lower = msg.toLowerCase()
  if (/未配置|api key|auth key|token|请先在设置/i.test(msg)) return 'not_configured'
  if (/离线|offline|无网/i.test(msg)) return 'offline'
  if (/超时|timeout|abort/i.test(lower) || msg.includes('请求超时')) return 'timeout'
  if (/network|fetch failed|failed to fetch|econnreset|enotfound/i.test(lower) || /网络|连接/.test(msg))
    return 'network'
  if (/401|unauthorized|forbidden|403|invalid.*(key|token|sign)/i.test(lower)) return 'auth'
  if (/429|rate limit|quota|额度|限流|too many/i.test(lower)) return 'rate_limit'
  if (/404|not found|未收录/i.test(lower) || /未收录/.test(msg)) return 'not_found'
  if (/500|502|503|504|server error|internal/i.test(lower)) return 'server'
  if (/返回格式|invalid.?response|parse/i.test(lower)) return 'invalid_response'
  if (/返回为空|empty/i.test(lower)) return 'empty_result'
  return 'provider'
}

/** Normalize any thrown value into TranslateError */
export function toTranslateError(
  err: unknown,
  fallbackCode: TranslateErrorCode = 'provider',
  engine?: string
): TranslateError {
  if (err instanceof TranslateError) {
    if (engine && !err.engine) {
      return new TranslateError(err.code, err.message, { engine, cause: err.cause })
    }
    return err
  }
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const msg = raw.trim() || '翻译失败'
  return new TranslateError(inferErrorCode(msg) || fallbackCode, msg, { engine, cause: err })
}

/**
 * Map raw engine / network errors to short Chinese messages for UI.
 */
export function friendlyError(err: unknown, fallback = '翻译失败'): string {
  if (err instanceof TranslateError) {
    switch (err.code) {
      case 'not_configured':
        return err.message.includes('设置')
          ? err.message
          : '请先在设置中配置该引擎的 API Key'
      case 'offline':
        return err.message || '当前离线，在线引擎不可用'
      case 'timeout':
        return '请求超时，请检查网络后重试'
      case 'network':
        return '网络异常，请检查网络连接'
      case 'auth':
        return '鉴权失败，请检查 API Key 是否正确'
      case 'rate_limit':
        return '请求过于频繁或额度不足，请稍后再试'
      case 'not_found':
        return err.message.length < 80 ? err.message : '未找到对应词条'
      case 'server':
        return '翻译服务暂时不可用，请稍后重试'
      case 'unknown_engine':
        return err.message || '未知翻译引擎'
      case 'empty_result':
        return '翻译结果为空，请重试'
      case 'invalid_response':
        return '服务返回格式异常'
      default:
        break
    }
  }

  const raw = err instanceof Error ? err.message : String(err ?? '')
  const msg = raw.trim() || fallback
  const lower = msg.toLowerCase()

  if (/未配置|api key|auth key|token|请先在设置/i.test(msg)) {
    return msg.includes('设置') ? msg : '请先在设置中配置该引擎的 API Key'
  }
  if (/超时|timeout|abort/i.test(lower) || msg.includes('请求超时')) {
    return '请求超时，请检查网络后重试'
  }
  if (/network|fetch failed|failed to fetch|econnreset|enotfound/i.test(lower) || /网络|连接/.test(msg)) {
    return '网络异常，请检查网络连接'
  }
  if (/401|unauthorized|forbidden|403|invalid.*(key|token|sign)/i.test(lower)) {
    return '鉴权失败，请检查 API Key 是否正确'
  }
  if (/429|rate limit|quota|额度|限流|too many/i.test(lower)) {
    return '请求过于频繁或额度不足，请稍后再试'
  }
  if (/404|not found/i.test(lower)) {
    return '接口地址无效或不存在'
  }
  if (/500|502|503|504|server error|internal/i.test(lower)) {
    return '翻译服务暂时不可用，请稍后重试'
  }
  if (/http\s*错误:\s*(\d+)/i.test(msg)) {
    const code = msg.match(/http\s*错误:\s*(\d+)/i)?.[1]
    return `服务返回错误${code ? ` (${code})` : ''}，请稍后重试`
  }
  // Keep short messages; truncate long JSON dumps
  if (msg.length > 120 || msg.startsWith('{') || msg.includes('JSON')) {
    return fallback + '，请稍后重试或更换引擎'
  }
  return msg
}
