/** Encode plain text for translation endpoints that interpret input as HTML. */
export function escapeTranslationText(text: string): string {
  return text.replace(/[&<>\u00a0]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u00a0': '&nbsp;' })[char]!)
}

/** Decode once: literal source text such as "&lt;" must not become "<". */
export function decodeTranslationText(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  }
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, value: string) => {
    if (!value.startsWith('#')) return named[value.toLowerCase()] ?? entity
    const code = value[1].toLowerCase() === 'x'
      ? parseInt(value.slice(2), 16)
      : parseInt(value.slice(1), 10)
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : entity
  })
}

// A pair survives Google's HTML sentence segmenter more reliably than one <br>.
const BREAK = '<br data-yi-fan-lb="1">'
const BREAK_PATTERN = '<br data-yi-fan-lb="1"\\s*/?>'

function prepareGoogleText(text: string): { text: string; runs: string[] } {
  const runs: string[] = []
  const lines = text.split(/\r\n|\r|\n/).map(line =>
    escapeTranslationText(line).replace(/[ \t]*(?:([-=_*~#])\1{2,}|\.{4,})[ \t]*/g, run => {
      runs.push(run)
      return `<span data-yi-fan-run="${runs.length - 1}"></span>`
    }),
  )
  return { text: lines.join(BREAK.repeat(2)), runs }
}

/** Keep the full text in one item so auto-detection has context across short lines. */
export function encodeGoogleText(text: string): string {
  return prepareGoogleText(text).text
}

export function decodeGoogleText(translated: string, source: string): string {
  const { runs } = prepareGoogleText(source)
  const restored = translated.replace(/[ \t]*<span data-yi-fan-run="(\d+)"\s*(?:\/>|>\s*<\/span>)[ \t]*/gi,
    (_placeholder, index: string) => runs[Number(index)] ?? ' ')
  const pair = new RegExp(`[ \\t]*${BREAK_PATTERN}[ \\t]*${BREAK_PATTERN}[ \\t]*`, 'gi')
  const single = new RegExp(BREAK_PATTERN, 'gi')
  const segments = restored.split(pair)
  const sourceLines = source.split(/\r\n|\r|\n/)
  if (segments.length !== sourceLines.length) {
    return decodeTranslationText(restored.replace(pair, '\n').replace(single, '\n'))
  }
  return segments.map((segment, index) => {
    const line = sourceLines[index]
    if (!line.trim()) return line
    const indentation = line.match(/^[ \t]*/)?.[0] ?? ''
    const bullet = line.slice(indentation.length).match(/^[-–—•·▪◦‣⁃*][ \t]+/)?.[0] ?? ''
    let content = decodeTranslationText(segment.replace(single, ' ')).trim()
    if (bullet) content = bullet + content.replace(/^[-–—•·▪◦‣⁃*](?:[ \t]+|$)/, '')
    return indentation + content
  }).join('\n')
}
