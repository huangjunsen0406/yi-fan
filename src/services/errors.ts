/**
 * Map raw engine / network errors to short Chinese messages for UI.
 */
export function friendlyError(err: unknown, fallback = '翻译失败'): string {
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
