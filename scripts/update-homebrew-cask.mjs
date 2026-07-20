#!/usr/bin/env node
/**
 * Fetch DMG sha256 from GitHub release and patch homebrew/yi-fan.rb
 *
 * Usage:
 *   node scripts/update-homebrew-cask.mjs
 *   node scripts/update-homebrew-cask.mjs --version 0.2.2
 *   pnpm homebrew:cask
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CASK = resolve(ROOT, 'homebrew/yi-fan.rb')

function argValue(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}

function getVersion() {
  const v = argValue('--version')
  if (v) return v.replace(/^v/, '')
  try {
    return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8')).version
  } catch {
    return '0.2.2'
  }
}

async function sha256OfUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return createHash('sha256').update(buf).digest('hex')
}

async function main() {
  const version = getVersion()
  const base = `https://github.com/huangjunsen0406/yi-fan/releases/download/v${version}`
  const assets = {
    arm: `${base}/yi-fan_${version}_aarch64.dmg`,
    intel: `${base}/yi-fan_${version}_x64.dmg`,
  }

  console.log(`Updating cask for v${version}`)
  let armSha = 'REPLACE_WITH_AARCH64_DMG_SHA256'
  let intelSha = 'REPLACE_WITH_X64_DMG_SHA256'

  try {
    console.log('  downloading aarch64…')
    armSha = await sha256OfUrl(assets.arm)
    console.log(`  arm:   ${armSha}`)
  } catch (e) {
    console.warn(`  arm failed: ${e.message}`)
  }
  try {
    console.log('  downloading x64…')
    intelSha = await sha256OfUrl(assets.intel)
    console.log(`  intel: ${intelSha}`)
  } catch (e) {
    console.warn(`  intel failed: ${e.message}`)
  }

  let rb = readFileSync(CASK, 'utf-8')
  rb = rb.replace(/version\s+"[^"]+"/, `version "${version}"`)
  rb = rb.replace(
    /sha256 arm:\s*"[^"]*",\s*\n\s*intel:\s*"[^"]*"/,
    `sha256 arm:   "${armSha}",\n         intel: "${intelSha}"`
  )
  writeFileSync(CASK, rb)
  console.log(`Wrote ${CASK}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
