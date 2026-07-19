/** Soft warn / hard block thresholds for input text */
export const TEXT_WARN_CHARS = 2000
export const TEXT_BLOCK_CHARS = 5000

export function isTextTooLong(len: number): boolean {
  return len > TEXT_BLOCK_CHARS
}

export function isTextLongWarn(len: number): boolean {
  return len >= TEXT_WARN_CHARS && len <= TEXT_BLOCK_CHARS
}
