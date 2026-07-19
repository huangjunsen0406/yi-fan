/**
 * Generate latest.json for Tauri updater (ccMesh-style).
 * Hosted at: https://github.com/<repo>/releases/latest/download/latest.json
 *
 * Reads signature files from CI artifacts and writes latest.json.
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
  return files.find((f) => pattern.test(f)) || null
}

function readSig(filePath) {
  if (!filePath || !existsSync(filePath)) return ''
  return readFileSync(filePath, 'utf-8').trim()
}

function findSig(dir, baseName) {
  if (!baseName) return ''
  return readSig(join(dir, baseName + '.sig'))
}

const artifactsDir = 'artifacts'

// macOS aarch64
const macAarch64Dir = join(artifactsDir, 'macos_aarch64-apple-darwin_updater')
const macAarch64File = findFile(macAarch64Dir, /\.app\.tar\.gz$/)
const macAarch64Sig = findSig(macAarch64Dir, macAarch64File)

// macOS x64
const macX64Dir = join(artifactsDir, 'macos_x86_64-apple-darwin_updater')
const macX64File = findFile(macX64Dir, /\.app\.tar\.gz$/)
const macX64Sig = findSig(macX64Dir, macX64File)

// Windows x64 — prefer nsis zip for updater
const winX64Dir = join(artifactsDir, 'windows_x86_64-pc-windows-msvc')
const winX64File =
  findFile(winX64Dir, /\.nsis\.zip$/) ||
  findFile(winX64Dir, /nsis\.zip$/) ||
  findFile(winX64Dir, /\.zip$/)
const winX64Sig = findSig(winX64Dir, winX64File)

// Windows arm64
const winArm64Dir = join(artifactsDir, 'windows_aarch64-pc-windows-msvc')
const winArm64File =
  findFile(winArm64Dir, /\.nsis\.zip$/) ||
  findFile(winArm64Dir, /\.zip$/)
const winArm64Sig = findSig(winArm64Dir, winArm64File)

// Linux x64 AppImage updater tar
const linuxDir = join(artifactsDir, 'linux_x86_64_appimage')
const linuxFile =
  findFile(linuxDir, /\.AppImage\.tar\.gz$/) ||
  findFile(linuxDir, /\.appimage\.tar\.gz$/i)
const linuxSig = findSig(linuxDir, linuxFile)

const now = new Date().toISOString()
const verClean = String(version).replace(/^v/, '')

// Prefer CI-provided notes (changelog), fallback to version label
const notesFromEnv = (process.env.RELEASE_NOTES || '').trim()
const notes =
  notesFromEnv ||
  `易翻 v${verClean}\n\n详见: https://github.com/${GITHUB_REPO}/releases/tag/v${verClean}`

// Tauri compares semver — do NOT prefix with "v"
const latestJson = {
  version: verClean,
  notes,
  pub_date: now,
  platforms: {},
}

function addPlatform(key, file, sig) {
  if (file && sig) {
    latestJson.platforms[key] = {
      signature: sig,
      url: `${BASE_URL}/${file}`,
    }
  } else if (file && !sig) {
    console.warn(`⚠ Missing signature for ${key}: ${file}`)
  }
}

addPlatform('darwin-aarch64', macAarch64File, macAarch64Sig)
addPlatform('darwin-x86_64', macX64File, macX64Sig)
// universal / alias keys (some Tauri versions look for -app suffix)
if (latestJson.platforms['darwin-aarch64']) {
  latestJson.platforms['darwin-aarch64-app'] = latestJson.platforms['darwin-aarch64']
}
if (latestJson.platforms['darwin-x86_64']) {
  latestJson.platforms['darwin-x86_64-app'] = latestJson.platforms['darwin-x86_64']
}

addPlatform('windows-x86_64', winX64File, winX64Sig)
addPlatform('windows-aarch64', winArm64File, winArm64Sig)
if (latestJson.platforms['windows-x86_64']) {
  latestJson.platforms['windows-x86_64-nsis'] = latestJson.platforms['windows-x86_64']
}

addPlatform('linux-x86_64', linuxFile, linuxSig)
if (latestJson.platforms['linux-x86_64']) {
  latestJson.platforms['linux-x86_64-appimage'] = latestJson.platforms['linux-x86_64']
}

writeFileSync('latest.json', JSON.stringify(latestJson, null, 2))
// keep legacy name for compatibility
writeFileSync('update.json', JSON.stringify(latestJson, null, 2))

console.log('Generated latest.json:')
console.log(JSON.stringify(latestJson, null, 2))

const platformCount = Object.keys(latestJson.platforms).length
if (platformCount === 0) {
  console.warn('⚠ No platforms with signatures — updater will not work until CI produces .sig files')
  process.exitCode = 0
}
