/** Convert English text to code naming formats */
export function toNamingFormat(text: string, format: string): string {
  const words = text
    .replace(/[^\w\s]/g, '')
    .trim()
    .split(/[\s_\-]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())

  if (words.length === 0) return text

  switch (format) {
    case 'camelCase':
      return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
    case 'PascalCase':
      return words.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
    case 'snake_case':
      return words.join('_')
    case 'kebab-case':
      return words.join('-')
    case 'KEBAB-CASE':
      return words.map((w) => w.toUpperCase()).join('-')
    case 'CONSTANT_CASE':
      return words.map((w) => w.toUpperCase()).join('_')
    case 'words':
      return words.join(' ')
    default:
      return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
  }
}
