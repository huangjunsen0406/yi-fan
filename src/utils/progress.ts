/**
 * Estimate download progress when Content-Length is missing.
 * Uses a decelerating curve so bar never jumps to 100% before Finished.
 */
export function estimateIndeterminatePct(
  downloadedBytes: number,
  prevPct: number
): number {
  // Assume ~8MB typical update if unknown; decelerate near 90%
  const assumedTotal = 8 * 1024 * 1024
  const raw = Math.min(0.9, downloadedBytes / assumedTotal)
  const curved = Math.round(raw * 100)
  // Never go backwards; cap under 92 until real finish
  return Math.min(92, Math.max(prevPct, curved))
}
