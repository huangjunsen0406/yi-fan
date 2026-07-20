<script setup lang="ts">
/**
 * 关于页：开机自启、主题、应用更新、简介
 * 从 SettingsView 拆出，便于维护。
 */
import { ref, onMounted } from 'vue'
import { getVersion } from '@tauri-apps/api/app'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import { Message } from '@arco-design/web-vue'
import {
  checkForUpdates,
  checkDownloadInstallAndRestart,
  getAutoCheck,
  setAutoCheck,
  skipVersion,
  openReleasesPage,
  openRepoPage,
  getAvailableUpdateVersion,
  clearAvailableUpdateVersion,
  type UpdateCheckResult,
} from '../../services/update'
import {
  themeMode,
  setThemeMode,
  initTheme,
  THEME_OPTIONS,
  type ThemeMode,
} from '../../services/theme'
import { estimateIndeterminatePct } from '../../utils/progress'

const appVersion = ref('0.0.0')
const autoStartEnabled = ref(false)
const updateAutoCheck = ref(true)
const updateChecking = ref(false)
const updateInstalling = ref(false)
const updateProgress = ref('')
const updateProgressPct = ref(0)
const updateInfo = ref<UpdateCheckResult | null>(null)
const lastUpdateError = ref('')
const updateBadgeVersion = ref('')

const emit = defineEmits<{
  'badge-change': [version: string]
}>()

onMounted(async () => {
  try {
    appVersion.value = await getVersion()
  } catch { /* ignore */ }
  try {
    autoStartEnabled.value = await isAutostartEnabled()
  } catch { /* ignore */ }
  try {
    updateAutoCheck.value = await getAutoCheck()
  } catch { /* ignore */ }
  try {
    await initTheme()
  } catch { /* ignore */ }
  try {
    updateBadgeVersion.value = await getAvailableUpdateVersion()
    emit('badge-change', updateBadgeVersion.value)
  } catch { /* ignore */ }
})

async function toggleAutoStart() {
  try {
    if (autoStartEnabled.value) await disableAutostart()
    else await enableAutostart()
    autoStartEnabled.value = await isAutostartEnabled()
  } catch (e) {
    console.error('Autostart toggle failed:', e)
  }
}

async function handleThemeChange(mode: ThemeMode) {
  await setThemeMode(mode)
}

async function toggleUpdateAutoCheck() {
  updateAutoCheck.value = !updateAutoCheck.value
  await setAutoCheck(updateAutoCheck.value)
}

async function handleCheckUpdate() {
  updateChecking.value = true
  lastUpdateError.value = ''
  updateInfo.value = null
  try {
    const info = await checkForUpdates()
    updateInfo.value = info
    if (info.available) {
      updateBadgeVersion.value = info.version
      emit('badge-change', info.version)
      Message.success(`发现新版本 v${info.version}`)
    } else {
      updateBadgeVersion.value = ''
      emit('badge-change', '')
      Message.success('当前已是最新版本')
    }
  } catch (e: any) {
    lastUpdateError.value = e.message || '检查失败'
    Message.error(lastUpdateError.value)
  } finally {
    updateChecking.value = false
  }
}

async function handleInstallUpdate() {
  if (!updateInfo.value?.available) return
  updateInstalling.value = true
  updateProgress.value = '正在下载…'
  updateProgressPct.value = 0
  lastUpdateError.value = ''
  try {
    await checkDownloadInstallAndRestart((downloaded, total) => {
      if (total && total > 0) {
        const pct = Math.min(99, Math.round((downloaded / total) * 100))
        updateProgressPct.value = pct
        updateProgress.value = `下载中 ${pct}% · ${(downloaded / 1024 / 1024).toFixed(1)} MB`
      } else {
        updateProgressPct.value = estimateIndeterminatePct(downloaded, updateProgressPct.value)
        updateProgress.value = `下载中 ${(downloaded / 1024 / 1024).toFixed(1)} MB`
      }
    })
    updateProgressPct.value = 100
    updateProgress.value = '安装完成，请手动重启'
  } catch (e: any) {
    lastUpdateError.value = e.message || '安装失败'
    Message.error({
      content: lastUpdateError.value + '（可点「GitHub 发布页」手动下载）',
      duration: 5000,
    })
    updateInstalling.value = false
    updateProgress.value = ''
    updateProgressPct.value = 0
  }
}

async function handleSkipVersion() {
  if (!updateInfo.value?.version) return
  await skipVersion(updateInfo.value.version)
  updateBadgeVersion.value = ''
  emit('badge-change', '')
  await clearAvailableUpdateVersion()
  Message.info(`已忽略 v${updateInfo.value.version}`)
  updateInfo.value = { ...updateInfo.value, available: false }
}

async function handleOpenReleases() {
  try {
    await openReleasesPage()
  } catch {
    Message.error('无法打开浏览器')
  }
}

async function handleOpenRepo() {
  try {
    await openRepoPage()
  } catch {
    Message.error('无法打开浏览器')
  }
}
</script>

<template>
  <div class="page-panel">
    <div class="config-card">
      <h3 class="card-title">通用设置</h3>
      <div class="config-row">
        <span class="row-label">开机自启</span>
        <button class="toggle-btn" :class="{ active: autoStartEnabled }" @click="toggleAutoStart">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="config-row theme-row">
        <span class="row-label">外观主题</span>
        <div class="theme-seg">
          <button
            v-for="opt in THEME_OPTIONS"
            :key="opt.value"
            type="button"
            class="theme-seg-btn"
            :class="{ active: themeMode === opt.value }"
            :title="opt.label"
            @click="handleThemeChange(opt.value)"
          >
            <i class="ph" :class="opt.icon"></i>
            <span>{{ opt.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="config-card">
      <h3 class="card-title">应用更新</h3>
      <div class="config-row">
        <span class="row-label">启动时检查更新</span>
        <button class="toggle-btn" :class="{ active: updateAutoCheck }" @click="toggleUpdateAutoCheck">
          <span class="toggle-knob"></span>
        </button>
      </div>
      <div class="update-actions">
        <button
          class="action-btn primary"
          :disabled="updateChecking || updateInstalling"
          @click="handleCheckUpdate"
        >
          {{ updateChecking ? '检查中…' : '检查更新' }}
        </button>
        <button class="action-btn" :disabled="updateInstalling" @click="handleOpenReleases">
          GitHub 发布页
        </button>
      </div>
      <p v-if="updateInfo && !updateInfo.available && !lastUpdateError" class="update-status ok">
        当前已是最新版本（v{{ updateInfo.currentVersion || appVersion }}）
      </p>
      <div v-if="updateInfo?.available" class="update-available">
        <p class="update-status new">发现新版本 v{{ updateInfo.version }}</p>
        <p v-if="updateInfo.notes" class="update-notes">{{ updateInfo.notes }}</p>
        <div v-if="updateInstalling && updateProgress" class="update-progress-bar">
          <div class="update-progress-fill" :style="{ width: updateProgressPct + '%' }"></div>
        </div>
        <div class="update-actions">
          <button
            class="action-btn primary"
            :disabled="updateInstalling"
            @click="handleInstallUpdate"
          >
            {{ updateInstalling ? (updateProgress || '安装中…') : '下载并安装' }}
          </button>
          <button class="action-btn" :disabled="updateInstalling" @click="handleSkipVersion">
            忽略此版本
          </button>
        </div>
      </div>
      <p v-if="lastUpdateError" class="update-status err">
        {{ lastUpdateError }}
        <button class="linkish" type="button" @click="handleOpenReleases">打开发布页手动安装</button>
      </p>
      <p class="update-hint">
        通过 GitHub Releases 分发，无需自建服务器。macOS 未公证时首次打开可能需右键「打开」。
      </p>
    </div>

    <div class="config-card about-card">
      <div class="about-logo">易翻</div>
      <p class="about-ver">版本 {{ appVersion }}</p>
      <p class="about-author">
        作者
        <button class="about-author-link" type="button" @click="handleOpenRepo">huangjunsen</button>
      </p>
      <p class="about-desc">基于 Tauri 2 + Vue 3 的轻量翻译工具。</p>
      <p class="about-desc">集成 21 种翻译引擎，支持全局快捷键呼出。</p>
      <p class="about-credit">
        灵感来自 uTools 插件「易翻」：体验很好，但 uTools 插件生态需会员/付费才能长期使用，
        因此独立做了这款开源、免费的桌面版，方便自己与他人离线安装、自由配置引擎。
      </p>
      <div class="about-links">
        <span class="about-badge">Tauri 2</span>
        <span class="about-badge">Vue 3</span>
        <span class="about-badge">Pinia</span>
        <button class="about-badge link" type="button" @click="handleOpenRepo">GitHub</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Panel inherits global settings styles via parent; local essentials: */
.page-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.config-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 16px 18px;
}
.card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--color-text);
}
.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
}
.config-row:last-child { border-bottom: none; }
.row-label { font-size: 13px; color: var(--color-text); }
.toggle-btn {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border);
  position: relative;
  transition: background 0.2s;
}
.toggle-btn.active { background: var(--color-primary); }
.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-bg);
  transition: transform 0.2s;
}
.toggle-btn.active .toggle-knob { transform: translateX(18px); }
.theme-row { flex-direction: column; align-items: flex-start; gap: 10px; }
.theme-seg {
  display: flex;
  width: 100%;
  gap: 6px;
  padding: 4px;
  border-radius: var(--radius-md);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-light);
}
.theme-seg-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-secondary);
}
.theme-seg-btn.active {
  color: var(--color-primary);
  background: var(--color-bg);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}
.update-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.action-btn {
  padding: 7px 14px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  font-size: 12px;
  cursor: pointer;
}
.action-btn:disabled { opacity: 0.5; cursor: default; }
.update-status { margin-top: 10px; font-size: 13px; }
.update-status.ok { color: var(--color-text-secondary); }
.update-status.new { color: var(--color-primary); font-weight: 600; }
.update-status.err { color: #F53F3F; }
.update-notes {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  max-height: 120px;
  overflow-y: auto;
}
.update-progress-bar {
  margin-top: 10px;
  height: 6px;
  border-radius: 3px;
  background: var(--color-border-light);
  overflow: hidden;
}
.update-progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s ease;
  min-width: 2%;
}
.update-hint {
  margin-top: 12px;
  font-size: 11px;
  color: var(--color-text-placeholder);
  line-height: 1.5;
}
.about-card { text-align: center; padding: 28px 16px; }
.about-logo {
  font-size: 32px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary), #9b6bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.about-ver { margin-top: 8px; color: var(--color-text-secondary); font-size: 13px; }
.about-author {
  margin-top: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.about-author-link {
  margin-left: 4px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
}
.about-author-link:hover {
  text-decoration: underline;
}
.about-desc { margin-top: 6px; font-size: 13px; color: var(--color-text-secondary); }
.about-credit {
  margin: 14px auto 0;
  max-width: 360px;
  font-size: 12px;
  line-height: 1.65;
  color: var(--color-text-placeholder);
  text-align: left;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-light);
}
.about-links { display: flex; gap: 8px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
.about-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(79, 110, 247, 0.08);
  color: var(--color-primary);
}
.about-badge.link {
  cursor: pointer;
  border: 1px solid var(--color-primary-border, rgba(79, 110, 247, 0.3));
}
.linkish {
  margin-left: 8px;
  color: var(--color-primary);
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  text-decoration: underline;
}
</style>
