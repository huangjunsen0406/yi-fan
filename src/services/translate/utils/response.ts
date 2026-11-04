import { TranslateError, type TranslateErrorCode } from '../../errors'

/** Status codes take precedence over keywords in upstream error pages. */
export function assertTranslationResponseOk(
  response: Response,
  engine: string,
  label: string,
): void {
  if (!response.ok) {
    const status = response.status
    const code: TranslateErrorCode = status === 429 ? 'rate_limit'
      : status === 401 || status === 403 ? 'auth'
        : status === 404 ? 'not_found'
          : status >= 500 ? 'server' : 'provider'
    throw new TranslateError(code, `${label} HTTP 错误: ${status}`, { engine })
  }
}

export async function readTranslationResponse(
  response: Response,
  engine: string,
  label: string,
): Promise<unknown> {
  assertTranslationResponseOk(response, engine, label)
  try {
    return await response.json()
  } catch (cause) {
    throw new TranslateError('invalid_response', `${label}返回格式异常`, { engine, cause })
  }
}
