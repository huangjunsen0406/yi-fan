/**
 * Wrapper around @tauri-apps/plugin-http fetch with a configurable timeout.
 * Default timeout: 15 seconds.
 */
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const DEFAULT_TIMEOUT_MS = 15_000

export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await tauriFetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout / 1000}s)`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
