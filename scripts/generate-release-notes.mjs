#!/usr/bin/env node
/**
 * Generate bilingual (ZH/EN) release notes from git history.
 *
 * Usage:
 *   node scripts/generate-release-notes.mjs
 *   node scripts/generate-release-notes.mjs --from v0.2.1 --to v0.2.2
 *   node scripts/generate-release-notes.mjs --out RELEASE_NOTES.md
 *   pnpm release:notes
 */
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function run(cmd) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim()
}

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

function pkgVersion() {
  return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')).version
}

function previousTag() {
  try {
    return run('git describe --tags --abbrev=0 HEAD^ 2>/dev/null') || ''
  } catch {
    try {
      const tags = run('git tag -l "v*" --sort=-v:refname').split('\n').filter(Boolean)
      return tags[1] || tags[0] || ''
    } catch {
      return ''
    }
  }
}

function classify(subject) {
  const s = subject.toLowerCase()
  if (/^feat(\(.+\))?:|^feature[:\s]/i.test(subject) || s.includes('feat')) return 'feat'
  if (/^fix(\(.+\))?:/i.test(subject) || s.startsWith('fix')) return 'fix'
  if (/^docs?(\(.+\))?:/i.test(subject)) return 'docs'
  if (/^chore(\(.+\))?:|^ci(\(.+\))?:|^build(\(.+\))?:/i.test(subject)) return 'chore'
  if (/^refactor(\(.+\))?:/i.test(subject)) return 'refactor'
  if (/^perf(\(.+\))?:/i.test(subject)) return 'perf'
  if (/^release:/i.test(subject)) return 'release'
  return 'other'
}

const ZH_SECTION = {
  feat: '新功能',
  fix: '修复',
  docs: '文档',
  chore: '构建 / 杂项',
  refactor: '重构',
  perf: '性能',
  release: '发布',
  other: '其他',
}

const EN_SECTION = {
  feat: 'Features',
  fix: 'Fixes',
  docs: 'Docs',
  chore: 'Chore / CI',
  refactor: 'Refactor',
  perf: 'Performance',
  release: 'Release',
  other: 'Other',
}

function stripPrefix(subject) {
  return subject.replace(
    /^(feat|fix|docs|chore|ci|build|refactor|perf|release)(\(.+\))?:\s*/i,
    ''
  )
}

function main() {
  const to = argValue('--to') || `v${pkgVersion()}`
  const from = argValue('--from') || previousTag()
  const out = argValue('--out')

  const range = from ? `${from}..HEAD` : 'HEAD'
  let log = ''
  try {
    log = run(`git log ${range} --pretty=format:%s --no-merges`)
  } catch {
    log = run('git log -30 --pretty=format:%s --no-merges')
  }

  const lines = log.split('\n').filter(Boolean)
  const groups = {
    feat: [],
    fix: [],
    docs: [],
    chore: [],
    refactor: [],
    perf: [],
    release: [],
    other: [],
  }
  for (const subject of lines) {
    if (/^release:\s*v?\d/i.test(subject)) continue
    groups[classify(subject)].push(stripPrefix(subject))
  }

  const date = new Date().toISOString().slice(0, 10)
  const zh = []
  const en = []
  zh.push(`## 易翻 ${to}（${date}）`)
  zh.push('')
  if (from) zh.push(`相对 ${from} 的变更：`)
  zh.push('')
  en.push(`## Yi-Fan ${to} (${date})`)
  en.push('')
  if (from) en.push(`Changes since ${from}:`)
  en.push('')

  for (const key of Object.keys(ZH_SECTION)) {
    const items = groups[key]
    if (!items.length) continue
    zh.push(`### ${ZH_SECTION[key]}`)
    en.push(`### ${EN_SECTION[key]}`)
    for (const item of items) {
      zh.push(`- ${item}`)
      en.push(`- ${item}`)
    }
    zh.push('')
    en.push('')
  }

  if (!lines.length) {
    zh.push('_无提交记录_')
    en.push('_No commits_')
  }

  const body = [...zh, '---', '', ...en, ''].join('\n')
  if (out) {
    const path = resolve(ROOT, out)
    writeFileSync(path, body)
    console.log(`Wrote ${path}`)
  } else {
    process.stdout.write(body)
  }
}

main()
