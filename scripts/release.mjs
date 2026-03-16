#!/usr/bin/env node

/**
 * 易翻 Release Script
 * Usage: pnpm release [--dry-run]
 *
 * Interactive CLI to bump version, update all config files,
 * commit, tag, and push to remote.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import prompts from 'prompts'
import semver from 'semver'
import pc from 'picocolors'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DRY_RUN = process.argv.includes('--dry-run')

// ── File paths ──
const FILES = {
  pkg: resolve(ROOT, 'package.json'),
  tauri: resolve(ROOT, 'src-tauri/tauri.conf.json'),
  cargo: resolve(ROOT, 'src-tauri/Cargo.toml'),
}

// ── Helpers ──
function run(cmd, opts = {}) {
  if (DRY_RUN) {
    console.log(pc.gray(`  [dry-run] ${cmd}`))
    return ''
  }
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe', ...opts }).trim()
  } catch (e) {
    throw new Error(`Command failed: ${cmd}\n${e.stderr || e.message}`)
  }
}

function step(icon, msg) {
  console.log(`  ${icon} ${msg}`)
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
}

function getCurrentVersion() {
  return readJSON(FILES.pkg).version
}

function getRemoteTags() {
  try {
    return run('git tag -l "v*"').split('\n').filter(Boolean)
  } catch {
    return []
  }
}

function isWorkingTreeClean() {
  return run('git status --porcelain') === ''
}

function getCurrentBranch() {
  return run('git rev-parse --abbrev-ref HEAD')
}

function isRemoteSynced() {
  try {
    run('git fetch --dry-run 2>&1')
    const local = run('git rev-parse HEAD')
    const remote = run('git rev-parse @{u}')
    return local === remote
  } catch {
    return true // no upstream, skip check
  }
}

// ── Version updaters ──
function updatePackageJson(version) {
  const data = readJSON(FILES.pkg)
  data.version = version
  writeJSON(FILES.pkg, data)
  step(pc.green('✔'), `package.json → ${pc.bold(version)}`)
}

function updateTauriConf(version) {
  const data = readJSON(FILES.tauri)
  data.version = version
  writeJSON(FILES.tauri, data)
  step(pc.green('✔'), `tauri.conf.json → ${pc.bold(version)}`)
}

function updateCargoToml(version) {
  let content = readFileSync(FILES.cargo, 'utf-8')
  content = content.replace(
    /^(version\s*=\s*)"[^"]*"/m,
    `$1"${version}"`
  )
  writeFileSync(FILES.cargo, content)
  step(pc.green('✔'), `Cargo.toml → ${pc.bold(version)}`)
}

function updateAllVersions(version) {
  updatePackageJson(version)
  updateTauriConf(version)
  updateCargoToml(version)
}

// ── Main ──
async function main() {
  console.log()
  const currentVersion = getCurrentVersion()
  console.log(pc.bold(`📦 当前版本: ${pc.cyan(currentVersion)}`))
  console.log()

  // ── 1. Choose version ──
  const versionChoices = [
    { title: `patch  ${pc.gray(`(${semver.inc(currentVersion, 'patch')})`)}  — Bug 修复`, value: 'patch' },
    { title: `minor  ${pc.gray(`(${semver.inc(currentVersion, 'minor')})`)}  — 新功能`, value: 'minor' },
    { title: `major  ${pc.gray(`(${semver.inc(currentVersion, 'major')})`)}  — 破坏性更新`, value: 'major' },
    { title: `prepatch  ${pc.gray(`(${semver.inc(currentVersion, 'prepatch', 'beta')})`)}`, value: 'prepatch' },
    { title: `重新发布当前版本  ${pc.gray(`(${currentVersion})`)}`, value: 'current' },
    { title: `自定义版本号`, value: 'custom' },
  ]

  const { releaseType } = await prompts({
    type: 'select',
    name: 'releaseType',
    message: '选择发布类型',
    choices: versionChoices,
  })

  if (releaseType === undefined) {
    console.log(pc.yellow('\n已取消'))
    process.exit(0)
  }

  let targetVersion
  if (releaseType === 'current') {
    targetVersion = currentVersion
  } else if (releaseType === 'custom') {
    const { customVersion } = await prompts({
      type: 'text',
      name: 'customVersion',
      message: '输入版本号 (例如 1.0.0)',
      validate: (v) => semver.valid(v) ? true : '无效的版本号格式',
    })
    if (!customVersion) { console.log(pc.yellow('\n已取消')); process.exit(0) }
    targetVersion = customVersion
  } else {
    targetVersion = semver.inc(currentVersion, releaseType, 'beta')
  }

  const tag = `v${targetVersion}`
  const isRerelease = releaseType === 'current'
  const existingTags = getRemoteTags()
  const tagExists = existingTags.includes(tag)

  // ── 2. Confirm ──
  console.log()
  if (isRerelease && tagExists) {
    console.log(pc.yellow(`⚠️  远程已存在 tag ${tag}，将删除后重新发布`))
  }

  const { confirmed } = await prompts({
    type: 'confirm',
    name: 'confirmed',
    message: `确认发布 ${pc.bold(pc.cyan(tag))}?`,
    initial: true,
  })

  if (!confirmed) {
    console.log(pc.yellow('\n已取消'))
    process.exit(0)
  }

  // ── 3. Pre-checks ──
  console.log(`\n${pc.bold('🔍 预检')}`)

  if (!isWorkingTreeClean() && !isRerelease) {
    // For re-release, we allow dirty state since we won't change files
    if (!isWorkingTreeClean()) {
      console.log(pc.red('  ✖ Git 工作区不干净，请先提交或暂存更改'))
      process.exit(1)
    }
  }
  step(pc.green('✔'), 'Git 工作区干净')

  const branch = getCurrentBranch()
  step(pc.green('✔'), `当前分支: ${pc.bold(branch)}`)

  if (isRemoteSynced()) {
    step(pc.green('✔'), '远程同步状态: up to date')
  } else {
    step(pc.yellow('⚠'), '远程未同步，建议先 git pull')
  }

  // ── 4. Delete existing tag if re-releasing ──
  if (tagExists) {
    console.log(`\n${pc.bold('🗑️  清理旧 tag')}`)
    run(`git push origin :refs/tags/${tag}`)
    step(pc.green('✔'), `删除远程 tag ${tag}`)
    try {
      run(`git tag -d ${tag}`)
      step(pc.green('✔'), `删除本地 tag ${tag}`)
    } catch {
      // local tag might not exist
    }
  }

  // ── 5. Update versions ──
  const versionChanged = targetVersion !== currentVersion
  if (versionChanged) {
    console.log(`\n${pc.bold('📝 更新版本号')}`)
    updateAllVersions(targetVersion)

    // Sync Cargo.lock
    console.log(pc.gray('  同步 Cargo.lock...'))
    run('cargo check 2>/dev/null || true', { cwd: resolve(ROOT, 'src-tauri') })
  }

  // ── 6. Git commit + tag + push ──
  console.log(`\n${pc.bold('🏷️  Git 操作')}`)

  const hasChanges = !isWorkingTreeClean()
  if (hasChanges) {
    run('git add -A')
    run(`git commit -m "release: ${tag}"`)
    step(pc.green('✔'), `git commit -m "release: ${tag}"`)
  } else if (!isRerelease) {
    step(pc.gray('–'), '无文件变更，跳过 commit')
  }

  run(`git tag ${tag}`)
  step(pc.green('✔'), `git tag ${tag}`)

  run(`git push origin ${branch}`)
  step(pc.green('✔'), `git push origin ${branch}`)

  run(`git push origin ${tag}`)
  step(pc.green('✔'), `git push origin ${tag}`)

  // ── 7. Done ──
  console.log(`\n${pc.bold(pc.green(`🎉 ${tag} 发布成功！`))}`)
  console.log(pc.gray(`   GitHub Release → https://github.com/huangjunsen0406/yi-fan/releases/tag/${tag}`))
  console.log()
}

main().catch((err) => {
  console.error(pc.red(`\n❌ 发布失败: ${err.message}`))
  console.log(pc.gray('如需回滚:'))
  console.log(pc.gray(`  git reset --soft HEAD~1`))
  console.log(pc.gray(`  git tag -d v<version>`))
  process.exit(1)
})
