/**
 * Generate update.json for Tauri updater
 * Reads signature files from build artifacts and creates the update manifest
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

const version = process.env.VERSION
if (!version) {
  console.error('VERSION env var is required')
  process.exit(1)
}

const GITHUB_REPO = 'huangjunsen0406/yi-fan'
const BASE_URL = `https://github.com/${GITHUB_REPO}/releases/download/v${version}`

function findFile(dir, pattern) {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
  return files.find(f => pattern.test(f)) || null
}

function readSig(filePath) {
  if (!filePath || !existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8').trim()
}

const artifactsDir = 'artifacts'

// macOS aarch64
const macAarch64Dir = join(artifactsDir, 'macos_aarch64-apple-darwin_updater')
const macAarch64File = findFile(macAarch64Dir, /\.app\.tar\.gz$/)
const macAarch64Sig = readSig(macAarch64File ? join(macAarch64Dir, macAarch64File + '.sig') : '')

// macOS x64
const macX64Dir = join(artifactsDir, 'macos_x86_64-apple-darwin_updater')
const macX64File = findFile(macX64Dir, /\.app\.tar\.gz$/)
const macX64Sig = readSig(macX64File ? join(macX64Dir, macX64File + '.sig') : '')

// Windows x64
const winX64Dir = join(artifactsDir, 'windows_x86_64-pc-windows-msvc')
const winX64File = findFile(winX64Dir, /\.nsis\.zip$/)
const winX64Sig = readSig(winX64File ? join(winX64Dir, winX64File + '.sig') : '')

// Windows arm64
const winArm64Dir = join(artifactsDir, 'windows_aarch64-pc-windows-msvc')
const winArm64File = findFile(winArm64Dir, /\.nsis\.zip$/)
const winArm64Sig = readSig(winArm64File ? join(winArm64Dir, winArm64File + '.sig') : '')

// Linux x64
const linuxDir = join(artifactsDir, 'linux_x86_64_appimage')
const linuxFile = findFile(linuxDir, /\.AppImage\.tar\.gz$/)
const linuxSig = readSig(linuxFile ? join(linuxDir, linuxFile + '.sig') : '')

const now = new Date().toISOString()

const updateJson = {
  version: `v${version}`,
  notes: `v${version} release`,
  pub_date: now,
  platforms: {}
}

// macOS aarch64
if (macAarch64File && macAarch64Sig) {
  updateJson.platforms['darwin-aarch64'] = {
    signature: macAarch64Sig,
    url: `${BASE_URL}/${macAarch64File}`
  }
}

// macOS x64
if (macX64File && macX64Sig) {
  updateJson.platforms['darwin-x86_64'] = {
    signature: macX64Sig,
    url: `${BASE_URL}/${macX64File}`
  }
}

// Windows x64
if (winX64File && winX64Sig) {
  updateJson.platforms['windows-x86_64'] = {
    signature: winX64Sig,
    url: `${BASE_URL}/${winX64File}`
  }
}

// Windows arm64
if (winArm64File && winArm64Sig) {
  updateJson.platforms['windows-aarch64'] = {
    signature: winArm64Sig,
    url: `${BASE_URL}/${winArm64File}`
  }
}

// Linux x64
if (linuxFile && linuxSig) {
  updateJson.platforms['linux-x86_64'] = {
    signature: linuxSig,
    url: `${BASE_URL}/${linuxFile}`
  }
}

writeFileSync('update.json', JSON.stringify(updateJson, null, 2))
console.log('Generated update.json:')
console.log(JSON.stringify(updateJson, null, 2))
