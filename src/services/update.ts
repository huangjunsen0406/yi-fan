/**
 * App updater — same model as ccMesh:
 * Tauri updater plugin + latest.json on GitHub Releases
 * (no self-hosted server, no Apple Developer cert required).
 */
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { getVersion } from '@tauri-apps/api/app'
import { openUrl } from '@tauri-apps/plugin-opener'
import { load } from '@tauri-apps/plugin-store'

export const GITHUB_REPO = 'huangjunsen0406/yi-fan'
export const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`
export const GITHUB_LATEST_URL = `${GITHUB_RELEASES_URL}/latest`

export interface UpdateCheckResult {
  available: boolean
  currentVersion: string
  version: string
  notes: string
  /** Raw update handle; only present when available */
  update: Update | null
}

const STORE_FILE = 'settings.json'
const KEY_SKIPPED = 'update_skippedVersion'
const KEY_AUTO_CHECK = 'update_autoCheck'

async function getStore() {
  return load(STORE_FILE, { autoSave: true } as any)
}

export async function getAppVersion(): Promise<string> {
  try {
    return await getVersion()
  } catch {
    return '0.0.0'
  }
}

export async function getSkippedVersion(): Promise<string> {
  try {
    const store = await getStore()
    return (await store.get<string>(KEY_SKIPPED)) || ''
  } catch {
    return ''
  }
}

export async function skipVersion(version: string): Promise<void> {
  const store = await getStore()
  await store.set(KEY_SKIPPED, version)
}

export async function getAutoCheck(): Promise<boolean> {
  try {
    const store = await getStore()
    const v = await store.get<boolean | string>(KEY_AUTO_CHECK)
    // default: true (like ccMesh)
    if (v === false || v === 'false') return false
    return true
  } catch {
    return true
  }
}

export async function setAutoCheck(enabled: boolean): Promise<void> {
  const store = await getStore()
  await store.set(KEY_AUTO_CHECK, enabled)
}

/**
 * Check GitHub Releases latest.json via Tauri updater.
 * Returns available=false when already latest or no endpoint/signature match.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = await getAppVersion()
  try {
    const update = await check()
    if (!update) {
      return {
        available: false,
        currentVersion,
        version: '',
        notes: '',
        update: null,
      }
    }
    return {
      available: true,
      currentVersion: update.currentVersion || currentVersion,
      version: update.version,
      notes: update.body || '',
      update,
    }
  } catch (e: any) {
    const msg = e?.message || String(e)
    throw new Error(msg.includes('Could not fetch') || msg.includes('error sending request')
      ? '检查更新失败：网络不可用或无法访问 GitHub'
      : `检查更新失败：${msg}`)
  }
}

export type ProgressCallback = (downloaded: number, total: number | undefined) => void

/**
 * Download, install, then relaunch.
 * Caller should pass the Update from checkForUpdates (or re-check).
 */
export async function installUpdateAndRestart(
  update: Update,
  onProgress?: ProgressCallback
): Promise<void> {
  let downloaded = 0
  let total: number | undefined
  await update.downloadAndInstall((event) => {
    if (event.event === 'Started') {
      downloaded = 0
      total = event.data.contentLength ?? undefined
      onProgress?.(0, total)
    } else if (event.event === 'Progress') {
      downloaded += event.data.chunkLength
      onProgress?.(downloaded, total)
    }
  })
  await relaunch()
}

/** Convenience: check again then install (when UI discarded the Update handle). */
export async function checkDownloadInstallAndRestart(
  onProgress?: ProgressCallback
): Promise<void> {
  const update = await check()
  if (!update) throw new Error('当前已是最新版本')
  await installUpdateAndRestart(update, onProgress)
}

export async function openReleasesPage(): Promise<void> {
  await openUrl(GITHUB_LATEST_URL)
}

export async function openRepoPage(): Promise<void> {
  await openUrl(`https://github.com/${GITHUB_REPO}`)
}
