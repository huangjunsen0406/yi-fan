<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { useSettingsStore } from '../stores/settings'
import { providers, getProvider } from '../services/translate'
import { ocrProviders, getOcrProvider } from '../services/ocr'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import { Message } from '@arco-design/web-vue'
import {
  HOTKEY_DEFS,
  DEFAULT_HOTKEYS,
  registerAllHotkeys,
  registerOneHotkey,
  unregisterAllHotkeys,
} from '../services/hotkeys'
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
} from '../services/update'
import {
  themeMode,
  setThemeMode,
  initTheme,
  THEME_OPTIONS,
  type ThemeMode,
} from '../services/theme'

const router = useRouter()
const settings = useSettingsStore()
const appVersion = ref('0.0.0')

// ── 外观 ──
async function handleThemeChange(mode: ThemeMode) {
  await setThemeMode(mode)
}

// ── 应用更新 ──
const updateAutoCheck = ref(true)
const updateChecking = ref(false)
const updateInstalling = ref(false)
const updateProgress = ref('')
const updateProgressPct = ref(0)
const updateInfo = ref<UpdateCheckResult | null>(null)
const lastUpdateError = ref('')
const updateBadgeVersion = ref('')

// ── 一级导航 ──
type PageKey = 'hotkey' | 'translate' | 'ocr' | 'service' | 'about'
const activePage = ref<PageKey>('hotkey')

const sidebarItems: { key: PageKey; icon: string; label: string }[] = [
  { key: 'hotkey',    icon: 'ph-keyboard',   label: '快捷键' },
  { key: 'translate', icon: 'ph-translate',  label: '翻译' },
  { key: 'ocr',       icon: 'ph-scan',       label: '文字识别' },
  { key: 'service',   icon: 'ph-puzzle-piece', label: '服务' },
  { key: 'about',     icon: 'ph-info',       label: '关于' },
]

// ── 服务页: 当前选中的引擎 ──
const activeEngine = ref(providers[0]?.name || '')

// ── 翻译页: 语言选项 ──
const sourceLanguages = [
  '自动检测', '简体中文', '繁体中文', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语', '文言文',
]
const targetLanguages = [
  '简体中文', '繁体中文', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语',
]
const defaultSourceLang = ref('自动检测')
const defaultTargetLang = ref('简体中文')
const showSourceDrop = ref(false)
const showTargetDrop = ref(false)
const showDefaultEngineDrop = ref(false)
const defaultTranslateEngine = ref('google')

// ── OCR 设置 ──
const ocrLangOptions = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁体中文' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'fr-FR', label: '法语' },
  { value: 'de-DE', label: '德语' },
]
const ocrLang = ref('auto')
const ocrDeleteNewline = ref(false)
const ocrAutoCopy = ref(false)
const ocrAutoTranslate = ref(false)
const ocrHideWindow = ref(false)
const ocrCloseOnBlur = ref(false)
const autoStartEnabled = ref(false)
const showOcrLangDrop = ref(false)
const showOcrEngineDrop = ref(false)

// OCR 引擎管理
const defaultOcrEngine = ref('system_ocr')  // 实际使用的引擎
const activeOcrEngine = ref('system_ocr')   // 设置页当前浏览的引擎
const ocrTestResults = ref<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({})
for (const p of ocrProviders) ocrTestResults.value[p.name] = { status: 'idle', message: '' }


async function saveOcrSettings() {
  settings.setConfig('_ocr', 'defaultLang', ocrLang.value)
  settings.setConfig('_ocr', 'deleteNewline', String(ocrDeleteNewline.value))
  settings.setConfig('_ocr', 'autoCopy', String(ocrAutoCopy.value))
  settings.setConfig('_ocr', 'autoTranslate', String(ocrAutoTranslate.value))
  settings.setConfig('_ocr', 'hideWindow', String(ocrHideWindow.value))
  settings.setConfig('_ocr', 'closeOnBlur', String(ocrCloseOnBlur.value))
  settings.setConfig('_ocr', 'activeEngine', defaultOcrEngine.value)
  await settings.save()
  // Sync to Rust backend
  await invoke('set_ocr_hide_window', { enabled: ocrHideWindow.value })
  await invoke('set_close_on_blur', { enabled: ocrCloseOnBlur.value })
}

async function testOcrEngine(name: string) {
  ocrTestResults.value[name] = { status: 'loading', message: '测试中...' }
  try {
    const provider = getOcrProvider(name)
    if (!provider) throw new Error('未知引擎')
    if (name === 'system_ocr') {
      ocrTestResults.value[name] = { status: 'success', message: '✓ 系统 OCR 可用' }
      return
    }
    const config = settings.getConfig(name)
    // Use a tiny test image (1x1 white pixel PNG base64)
    const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    await provider.recognize(testBase64, 'auto', config)
    ocrTestResults.value[name] = { status: 'success', message: '✓ 连接成功' }
  } catch (err: any) {
    ocrTestResults.value[name] = { status: 'error', message: err.message || '测试失败' }
  }
}

function closeAllDropdowns() {
  showSourceDrop.value = false
  showTargetDrop.value = false
  showDefaultEngineDrop.value = false
  showOcrLangDrop.value = false
  showOcrEngineDrop.value = false
}

async function saveDefaultLangs() {
  settings.setConfig('_translate', 'defaultSourceLang', defaultSourceLang.value)
  settings.setConfig('_translate', 'defaultTargetLang', defaultTargetLang.value)
  settings.setConfig('_translate', 'defaultEngine', defaultTranslateEngine.value)
  await settings.save()
}

// ── 快捷键（定义与注册逻辑见 services/hotkeys.ts） ──
interface HotkeyItem {
  id: string
  label: string
  command: string
  value: string
  status: { type: 'idle' | 'success' | 'error'; message: string }
}

const hotkeys = ref<HotkeyItem[]>(
  HOTKEY_DEFS.map((d) => ({
    id: d.id,
    label: d.label,
    command: d.command,
    value: d.defaultValue,
    status: { type: 'idle' as const, message: '' },
  }))
)
const activeHotkeyIdx = ref(-1)

function hotkeyBindingsFromUi(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const hk of hotkeys.value) {
    if (hk.value) map[hk.id] = hk.value
  }
  return map
}

async function restoreDefaultHotkeys() {
  for (const hk of hotkeys.value) {
    hk.value = DEFAULT_HOTKEYS[hk.id] || ''
    hk.status = { type: 'idle', message: '' }
    settings.setConfig('_hotkeys', hk.id, hk.value)
  }
  await settings.save()
  const failCount = await registerAllHotkeys(DEFAULT_HOTKEYS)
  if (failCount === 0) {
    Message.success('已恢复默认快捷键')
  } else {
    Message.error(`${failCount} 个快捷键注册失败`)
  }
}

const keyMap: Record<string, string> = {
  Backquote: '`', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
  Comma: ',', Equal: '=', Minus: '-', Plus: 'PLUS', Period: '.', Quote: "'",
  Semicolon: ';', Slash: '/', Space: 'Space', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', Escape: 'Escape', Enter: 'Enter',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
}

// 聚焦快捷键输入框时，取消注册所有全局快捷键（避免录入时触发动作）
async function onHotkeyFocus(idx: number) {
  activeHotkeyIdx.value = idx
  await unregisterAllHotkeys()
}

async function onHotkeyBlur() {
  activeHotkeyIdx.value = -1
  // 失焦后保存并重新注册（含未点「注册」的录入）
  for (const hk of hotkeys.value) {
    if (hk.value) settings.setConfig('_hotkeys', hk.id, hk.value)
  }
  await settings.save()
  await registerAllHotkeys(hotkeyBindingsFromUi())
}

function onHotkeyKeyDown(e: KeyboardEvent, idx: number) {
  e.preventDefault()
  e.stopPropagation()
  if (e.code === 'Backspace') { hotkeys.value[idx].value = ''; return }
  const isMac = navigator.platform.toUpperCase().includes('MAC')
  let combo = ''
  if (e.ctrlKey) combo = 'Control'
  if (e.shiftKey) combo = `${combo}${combo ? '+' : ''}Shift`
  if (e.metaKey) combo = `${combo}${combo ? '+' : ''}${isMac ? 'Cmd' : 'Super'}`
  if (e.altKey) combo = `${combo}${combo ? '+' : ''}Alt`
  let code = e.code
  if (code.startsWith('Key')) code = code.substring(3)
  else if (code.startsWith('Digit')) code = code.substring(5)
  else if (code.startsWith('Numpad')) code = 'Num' + code.substring(6)
  else if (code.startsWith('Arrow')) code = code.substring(5)
  else if (/^F\d+$/.test(code)) { /* keep */ }
  else if (keyMap[code] !== undefined) code = keyMap[code]
  else if (['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight'].includes(code)) code = ''
  else code = ''
  hotkeys.value[idx].value = `${combo}${combo && code ? '+' : ''}${code}`
}

async function registerHotkey(idx: number) {
  const item = hotkeys.value[idx]
  const key = item.value
  if (!key) { item.status = { type: 'error', message: '请先录入快捷键' }; return }
  const duplicate = hotkeys.value.find((hk, i) => i !== idx && hk.value === key)
  if (duplicate) {
    item.status = { type: 'error', message: `与「${duplicate.label}」冲突` }
    return
  }
  try {
    // 重新注册全部，保证与其它快捷键一致且无残留
    for (const hk of hotkeys.value) {
      if (hk.value) settings.setConfig('_hotkeys', hk.id, hk.value)
    }
    await settings.save()
    const failCount = await registerAllHotkeys(hotkeyBindingsFromUi())
    // 再单独确认当前项（失败时给出明确提示）
    if (failCount > 0) {
      try {
        await registerOneHotkey(item.command, key)
        item.status = { type: 'success', message: `✓ 已注册 ${key}` }
      } catch {
        item.status = { type: 'error', message: '注册失败，可能与系统或其他应用冲突，请换一个' }
        return
      }
    } else {
      item.status = { type: 'success', message: `✓ 已注册 ${key}` }
    }
  } catch {
    item.status = { type: 'error', message: '注册失败，可能与系统或其他应用冲突，请换一个' }
  }
}

// ── 翻译引擎测试 ──
const testResults = ref<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({})
for (const p of providers) testResults.value[p.name] = { status: 'idle', message: '' }

async function testEngine(name: string) {
  testResults.value[name] = { status: 'loading', message: '测试中...' }
  try {
    const provider = getProvider(name)
    if (!provider) throw new Error('未知引擎')
    const config = settings.getConfig(name)
    const result = await provider.translate('你好世界', '简体中文', '英语', config)
    testResults.value[name] = { status: 'success', message: `✓ "${result}"` }
  } catch (err: any) {
    testResults.value[name] = { status: 'error', message: err.message || '测试失败' }
  }
}

// Auto-save helper for service config inputs
async function autoSaveConfig() {
  await settings.save()
}

function goBack() { router.push('/') }

// ── 当前选中引擎的详情 ──
const currentProvider = computed(() => providers.find(p => p.name === activeEngine.value))

onMounted(async () => {
  appVersion.value = await getVersion()
  await settings.init()
  // 加载所有已保存的快捷键
  const savedHotkeys = settings.getConfig('_hotkeys')
  for (const hk of hotkeys.value) {
    if (savedHotkeys[hk.id]) hk.value = savedHotkeys[hk.id]
  }
  const savedSrcLang = settings.getConfig('_translate')['defaultSourceLang']
  if (savedSrcLang) defaultSourceLang.value = savedSrcLang
  const savedTgtLang = settings.getConfig('_translate')['defaultTargetLang']
  if (savedTgtLang) defaultTargetLang.value = savedTgtLang
  const savedEngine = settings.getConfig('_translate')['defaultEngine']
  if (savedEngine) defaultTranslateEngine.value = savedEngine
  // 加载 OCR 设置
  const savedOcr = settings.getConfig('_ocr')
  if (savedOcr['defaultLang']) ocrLang.value = savedOcr['defaultLang']
  if (savedOcr['deleteNewline'] === 'true') ocrDeleteNewline.value = true
  if (savedOcr['autoCopy'] === 'true') ocrAutoCopy.value = true
  if (savedOcr['autoTranslate'] === 'true') ocrAutoTranslate.value = true
  if (savedOcr['hideWindow'] === 'true') ocrHideWindow.value = true
  if (savedOcr['closeOnBlur'] === 'true') ocrCloseOnBlur.value = true
  if (savedOcr['activeEngine']) {
    defaultOcrEngine.value = savedOcr['activeEngine']
    activeOcrEngine.value = savedOcr['activeEngine']
  }
  // 加载开机自启状态
  try { autoStartEnabled.value = await isAutostartEnabled() } catch { /* ignore */ }
  // 更新设置
  try { updateAutoCheck.value = await getAutoCheck() } catch { /* ignore */ }
  try { await initTheme() } catch { /* ignore */ }
  try {
    updateBadgeVersion.value = await getAvailableUpdateVersion()
  } catch { /* ignore */ }
  // 点击外部关闭下拉
  document.addEventListener('click', closeAllDropdowns)
})

async function toggleAutoStart() {
  try {
    if (autoStartEnabled.value) {
      await disableAutostart()
    } else {
      await enableAutostart()
    }
    autoStartEnabled.value = await isAutostartEnabled()
  } catch (e) {
    console.error('Autostart toggle failed:', e)
  }
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
      Message.success(`发现新版本 v${info.version}`)
    } else {
      updateBadgeVersion.value = ''
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
        const pct = Math.min(100, Math.round((downloaded / total) * 100))
        updateProgressPct.value = pct
        updateProgress.value = `下载中 ${pct}%`
      } else {
        updateProgressPct.value = Math.min(95, updateProgressPct.value + 2)
        updateProgress.value = `已下载 ${(downloaded / 1024 / 1024).toFixed(1)} MB`
      }
    })
    updateProgressPct.value = 100
    updateProgress.value = '安装完成，请手动重启'
  } catch (e: any) {
    lastUpdateError.value = e.message || '安装失败'
    Message.error(lastUpdateError.value)
    updateInstalling.value = false
    updateProgress.value = ''
    updateProgressPct.value = 0
  }
}

async function handleSkipVersion() {
  if (!updateInfo.value?.version) return
  await skipVersion(updateInfo.value.version)
  updateBadgeVersion.value = ''
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
  <div class="settings-view">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-drag" data-tauri-drag-region></div>
      <div class="sidebar-logo">
        <span class="logo-text">易翻</span>
        <span class="logo-ver">v{{ appVersion }}</span>
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="item in sidebarItems"
          :key="item.key"
          class="sidebar-item"
          :class="{ active: activePage === item.key }"
          @click="activePage = item.key"
        >
          <i class="ph" :class="item.icon"></i>
          <span>{{ item.label }}</span>
          <span
            v-if="item.key === 'about' && updateBadgeVersion"
            class="sidebar-badge"
            :title="`新版本 v${updateBadgeVersion}`"
          >新</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button class="sidebar-item" @click="goBack">
          <i class="ph ph-arrow-left"></i>
          <span>返回</span>
        </button>
      </div>
    </aside>

    <!-- 右侧内容区 -->
    <main class="main-area">
      <!-- 顶栏 -->
      <div class="main-header" data-tauri-drag-region>
        <h2 class="page-title">{{ sidebarItems.find(i => i.key === activePage)?.label }}</h2>
      </div>

      <div class="main-content">
        <!-- ========== 快捷键页 ========== -->
        <div v-if="activePage === 'hotkey'" class="page-panel">
          <div class="config-card">
            <div class="card-header-row">
              <h3 class="card-title">全局快捷键</h3>
              <button class="action-btn secondary" @click="restoreDefaultHotkeys">
                <i class="ph ph-arrow-counter-clockwise"></i> 恢复默认
              </button>
            </div>
            <div v-for="(hk, idx) in hotkeys" :key="hk.id" class="form-item">
              <label>{{ hk.label }}</label>
              <div class="hotkey-input-row">
                <input
                  class="hotkey-input"
                  :class="{ recording: activeHotkeyIdx === idx }"
                  :value="hk.value"
                  readonly
                  placeholder="点击后按下快捷键"
                  @focus="onHotkeyFocus(idx)"
                  @blur="onHotkeyBlur()"
                  @keydown="(e: KeyboardEvent) => onHotkeyKeyDown(e, idx)"
                />
                <button class="action-btn" @click="registerHotkey(idx)">
                  <i class="ph ph-check"></i> 注册
                </button>
              </div>
              <div v-if="hk.status.type !== 'idle'" class="status-msg" :class="hk.status.type">
                {{ hk.status.message }}
              </div>
            </div>
          </div>

          <div class="info-card">
            <i class="ph ph-info"></i>
            <div>
              <strong>使用说明</strong>
              <p>点击输入框后按下快捷键组合（如 Alt+Space），然后点击「注册」。按 Backspace 清空。</p>
            </div>
          </div>
        </div>

        <!-- ========== 翻译设置页 ========== -->
        <div v-if="activePage === 'translate'" class="page-panel">
          <div class="config-card">
            <h3 class="card-title">翻译偏好</h3>
            <div class="config-row">
              <span class="row-label">默认源语言</span>
              <div class="custom-select" :class="{ open: showSourceDrop }" @click.stop="showSourceDrop = !showSourceDrop; showTargetDrop = false">
                <span class="select-text">{{ defaultSourceLang }}</span>
                <i class="ph ph-caret-down select-arrow"></i>
                <div v-if="showSourceDrop" class="select-dropdown">
                  <div
                    v-for="lang in sourceLanguages"
                    :key="lang"
                    class="select-option"
                    :class="{ active: defaultSourceLang === lang }"
                    @click.stop="defaultSourceLang = lang; showSourceDrop = false; saveDefaultLangs()"
                  >{{ lang }}</div>
                </div>
              </div>
            </div>
            <div class="config-row">
              <span class="row-label">默认目标语言</span>
              <div class="custom-select" :class="{ open: showTargetDrop }" @click.stop="showTargetDrop = !showTargetDrop; showSourceDrop = false">
                <span class="select-text">{{ defaultTargetLang }}</span>
                <i class="ph ph-caret-down select-arrow"></i>
                <div v-if="showTargetDrop" class="select-dropdown">
                  <div
                    v-for="lang in targetLanguages"
                    :key="lang"
                    class="select-option"
                    :class="{ active: defaultTargetLang === lang }"
                    @click.stop="defaultTargetLang = lang; showTargetDrop = false; saveDefaultLangs()"
                  >{{ lang }}</div>
                </div>
              </div>
            </div>
            <div class="config-row">
              <span class="row-label">默认翻译引擎</span>
              <div class="custom-select" :class="{ open: showDefaultEngineDrop }" @click.stop="showDefaultEngineDrop = !showDefaultEngineDrop; showSourceDrop = false; showTargetDrop = false">
                <span class="select-text">{{ providers.find(p => p.name === defaultTranslateEngine)?.label || '谷歌翻译' }}</span>
                <i class="ph ph-caret-down select-arrow"></i>
                <div v-if="showDefaultEngineDrop" class="select-dropdown">
                  <div
                    v-for="p in providers.filter(ep => settings.isEnabled(ep.name))"
                    :key="p.name"
                    class="select-option"
                    :class="{ active: defaultTranslateEngine === p.name }"
                    @click.stop="defaultTranslateEngine = p.name; showDefaultEngineDrop = false; saveDefaultLangs()"
                  >{{ p.label }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="config-card">
            <h3 class="card-title">主页引擎显示</h3>
            <p class="card-desc">选择在主页引擎栏中显示的翻译引擎。</p>
            <div class="engine-toggle-list">
              <div v-for="p in providers" :key="p.name" class="engine-toggle-item">
                <div class="engine-toggle-info">
                  <i class="ph" :class="p.icon"></i>
                  <span>{{ p.label }}</span>
                </div>
                <button
                  class="toggle-btn"
                  :class="{ active: settings.isEnabled(p.name) }"
                  @click="settings.toggleEngine(p.name)"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== 文字识别设置页 ========== -->
        <div v-if="activePage === 'ocr'" class="page-panel">
          <div class="config-card">
            <h3 class="card-title">识别偏好</h3>

            <!-- 默认识别引擎 -->
            <div class="config-row">
              <span class="row-label">默认识别引擎</span>
              <div class="custom-select" :class="{ open: showOcrEngineDrop }" @click.stop="showOcrEngineDrop = !showOcrEngineDrop; showOcrLangDrop = false">
                <span class="select-text">{{ ocrProviders.find(p => p.name === defaultOcrEngine)?.label || '系统 OCR' }}</span>
                <i class="ph ph-caret-down select-arrow"></i>
                <div v-if="showOcrEngineDrop" class="select-dropdown">
                  <div
                    v-for="p in ocrProviders"
                    :key="p.name"
                    class="select-option"
                    :class="{ active: defaultOcrEngine === p.name }"
                    @click.stop="defaultOcrEngine = p.name; showOcrEngineDrop = false; saveOcrSettings()"
                  >{{ p.label }}</div>
                </div>
              </div>
            </div>

            <!-- 默认识别语言 -->
            <div class="config-row">
              <span class="row-label">默认识别语言</span>
              <div class="custom-select" :class="{ open: showOcrLangDrop }" @click.stop="showOcrLangDrop = !showOcrLangDrop; showSourceDrop = false; showTargetDrop = false">
                <span class="select-text">{{ ocrLangOptions.find(o => o.value === ocrLang)?.label || '自动检测' }}</span>
                <i class="ph ph-caret-down select-arrow"></i>
                <div v-if="showOcrLangDrop" class="select-dropdown">
                  <div
                    v-for="opt in ocrLangOptions"
                    :key="opt.value"
                    class="select-option"
                    :class="{ active: ocrLang === opt.value }"
                    @click.stop="ocrLang = opt.value; showOcrLangDrop = false; saveOcrSettings()"
                  >{{ opt.label }}</div>
                </div>
              </div>
            </div>

            <div class="config-row">
              <span class="row-label">识别后删除换行</span>
              <button class="toggle-btn" :class="{ active: ocrDeleteNewline }" @click="ocrDeleteNewline = !ocrDeleteNewline; saveOcrSettings()">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="config-row">
              <span class="row-label">识别后自动复制</span>
              <button class="toggle-btn" :class="{ active: ocrAutoCopy }" @click="ocrAutoCopy = !ocrAutoCopy; saveOcrSettings()">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="config-row">
              <span class="row-label">识别后自动翻译</span>
              <button class="toggle-btn" :class="{ active: ocrAutoTranslate }" @click="ocrAutoTranslate = !ocrAutoTranslate; saveOcrSettings()">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="config-row">
              <span class="row-label">识别时隐藏窗口</span>
              <button class="toggle-btn" :class="{ active: ocrHideWindow }" @click="ocrHideWindow = !ocrHideWindow; saveOcrSettings()">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <div class="config-row">
              <span class="row-label">失焦后关闭窗口</span>
              <button class="toggle-btn" :class="{ active: ocrCloseOnBlur }" @click="ocrCloseOnBlur = !ocrCloseOnBlur; saveOcrSettings()">
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>

          <!-- OCR 引擎管理：左右分栏，复用翻译服务页样式 -->
          <div class="service-page">
            <!-- 左: 引擎列表 -->
            <div class="engine-list">
              <button
                v-for="p in ocrProviders"
                :key="p.name"
                class="engine-item"
                :class="{ active: activeOcrEngine === p.name }"
                @click="activeOcrEngine = p.name; saveOcrSettings()"
              >
                <i class="ph" :class="p.icon"></i>
                <span>{{ p.label }}</span>
              </button>
            </div>

            <!-- 右: 引擎详情 -->
            <div class="engine-detail" v-if="ocrProviders.find(p => p.name === activeOcrEngine)">
              <h3 class="card-title">{{ ocrProviders.find(p => p.name === activeOcrEngine)!.label }}</h3>
              <p class="card-desc">{{ ocrProviders.find(p => p.name === activeOcrEngine)!.description }}</p>

              <!-- 配置表单 -->
              <div v-if="ocrProviders.find(p => p.name === activeOcrEngine)!.needsConfig" class="config-form">
                <div v-for="field in ocrProviders.find(p => p.name === activeOcrEngine)!.configFields" :key="field.key" class="form-item">
                  <label>{{ field.label }}</label>
                  <input
                    :type="field.type"
                    :placeholder="field.placeholder"
                    :value="settings.getConfig(activeOcrEngine)[field.key] || ''"
                    @input="settings.setConfig(activeOcrEngine, field.key, ($event.target as HTMLInputElement).value)"
                    @blur="autoSaveConfig()"
                  />
                </div>
              </div>

              <!-- 无需配置提示 -->
              <div v-else class="info-card small">
                <i class="ph ph-check-circle"></i>
                <div>
                  <strong>无需配置</strong>
                  <p>系统原生 OCR，免费离线使用。</p>
                </div>
              </div>

              <!-- 测试按钮 -->
              <div class="test-area">
                <button
                  class="action-btn"
                  @click="testOcrEngine(activeOcrEngine)"
                >
                  <i class="ph ph-play"></i> 测试
                </button>
                <span class="status-msg" :class="ocrTestResults[activeOcrEngine]?.status">
                  {{ ocrTestResults[activeOcrEngine]?.message }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ========== 服务页（引擎配置）========== -->
        <div v-if="activePage === 'service'" class="page-panel service-page">
          <!-- 左: 引擎列表 -->
          <div class="engine-list">
            <button
              v-for="p in providers"
              :key="p.name"
              class="engine-item"
              :class="{ active: activeEngine === p.name }"
              @click="activeEngine = p.name"
            >
              <i class="ph" :class="p.icon"></i>
              <span>{{ p.label }}</span>
              <i v-if="settings.isEnabled(p.name)" class="ph ph-check-circle engine-enabled-icon"></i>
            </button>
          </div>

          <!-- 右: 引擎详情 -->
          <div class="engine-detail" v-if="currentProvider">
            <h3 class="card-title">{{ currentProvider.label }}</h3>
            <p class="card-desc">{{ currentProvider.description }}</p>

            <!-- 配置表单 -->
            <div v-if="currentProvider.needsConfig && currentProvider.configFields" class="config-form">
              <div v-for="field in currentProvider.configFields" :key="field.key" class="form-item">
                <label>{{ field.label }}</label>
                <input
                  :type="field.type"
                  :placeholder="field.placeholder"
                  :value="settings.getConfig(currentProvider.name)[field.key] || ''"
                  @input="settings.setConfig(currentProvider.name, field.key, ($event.target as HTMLInputElement).value)"
                  @blur="autoSaveConfig()"
                />
              </div>
            </div>

            <!-- 无需配置提示 -->
            <div v-if="!currentProvider.needsConfig" class="info-card small">
              <i class="ph ph-check-circle"></i>
              <div>
                <strong>无需配置</strong>
                <p>免费接口，开箱即用。</p>
              </div>
            </div>

            <!-- 测试按钮 -->
            <div class="test-area">
              <button
                class="action-btn"
                :disabled="currentProvider.needsConfig && !settings.isConfigured(currentProvider.name)"
                @click="testEngine(currentProvider.name)"
              >
                <i class="ph ph-play"></i> 测试连接
              </button>
              <span class="status-msg" :class="testResults[currentProvider.name]?.status">
                {{ testResults[currentProvider.name]?.message }}
              </span>
            </div>
          </div>
        </div>

        <!-- ========== 关于页 ========== -->
        <div v-if="activePage === 'about'" class="page-panel">
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
            <p v-if="lastUpdateError" class="update-status err">{{ lastUpdateError }}</p>
            <p class="update-hint">通过 GitHub Releases 分发，无需自建服务器。macOS 未公证时首次打开可能需右键「打开」。</p>
          </div>

          <div class="config-card about-card">
            <div class="about-logo">易翻</div>
            <p class="about-ver">版本 {{ appVersion }}</p>
            <p class="about-desc">基于 Tauri 2 + Vue 3 的轻量翻译工具。</p>
            <p class="about-desc">集成 21 种翻译引擎，支持全局快捷键呼出。</p>
            <div class="about-links">
              <span class="about-badge">Tauri 2</span>
              <span class="about-badge">Vue 3</span>
              <span class="about-badge">Pinia</span>
              <button class="about-badge link" type="button" @click="handleOpenRepo">GitHub</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.settings-view {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--color-bg-page);
}

/* ── Sidebar ── */
.sidebar {
  width: 180px;
  flex-shrink: 0;
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
}

.sidebar-drag {
  height: 38px;
  flex-shrink: 0;
  -webkit-app-region: drag;
  /* Overlay titlebar: traffic lights sit over left of sidebar */
  padding-left: 72px;
}

.sidebar-logo {
  text-align: center;
  padding: 4px 16px 16px;
}

.logo-text {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary), #9b6bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.logo-ver {
  display: block;
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-top: 2px;
}

.sidebar-nav {
  flex: 1;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-bottom {
  padding: 8px;
  border-top: 1px solid var(--color-border-light);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
}

.sidebar-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.sidebar-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}

.sidebar-item i {
  font-size: 18px;
}

.sidebar-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--color-danger);
  color: #fff;
  line-height: 1.4;
}

/* ── Main Area ── */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg-page);
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 8px;
  min-height: 46px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
  -webkit-app-region: drag;
  background: var(--color-bg-page);
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  -webkit-app-region: no-drag;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 16px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  font-size: var(--font-size-xs);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-app-region: no-drag;
}

.save-btn:hover { opacity: 0.9; }
.save-btn:disabled { opacity: 0.6; cursor: default; }

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ── Page Panel ── */
.page-panel {
  max-width: 640px;
}

/* ── Config Card ── */
.config-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 16px;
}

.card-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 16px;
}

.card-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: 16px;
  margin-top: -8px;
}

/* ── Config Row ── */
.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.config-row:last-child { border-bottom: none; }

.row-label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.row-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* ── Custom Select (Arco style) ── */
.custom-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-page);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 120px;
  user-select: none;
}

.custom-select:hover { border-color: var(--color-primary); }
.custom-select.open { border-color: var(--color-primary); box-shadow: 0 0 0 2px rgba(79,110,247,0.1); }

.select-text { flex: 1; }
.select-arrow { font-size: 12px; color: var(--color-text-placeholder); transition: transform 0.2s; }
.custom-select.open .select-arrow { transform: rotate(180deg); }

.select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 100%;
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  padding: 4px;
  z-index: 100;
  max-height: 240px;
  overflow-y: auto;
  animation: dropIn 0.15s ease;
}

@keyframes dropIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.select-option {
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.1s;
  white-space: nowrap;
}

.select-option:hover { background: var(--color-bg-hover); }

.select-option.active {
  color: var(--color-primary);
  font-weight: 600;
  background: rgba(79, 110, 247, 0.08);
}

/* ── Toggle Button ── */
.toggle-btn {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border);
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
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
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s;
}

.toggle-btn.active .toggle-knob { transform: translateX(18px); }

/* ── Engine Toggle List (in translate page) ── */
.engine-toggle-list {
  display: flex;
  flex-direction: column;
}

.engine-toggle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-light);
}

.engine-toggle-item:last-child { border-bottom: none; }

.engine-toggle-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.engine-toggle-info i { font-size: 16px; color: var(--color-text-secondary); }

/* ── Service Page ── */
.service-page {
  display: flex;
  gap: 16px;
  max-width: 100%;
}

.engine-list {
  width: 160px;
  flex-shrink: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 8px;
  max-height: calc(100vh - 130px);
  overflow-y: auto;
}

.engine-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: all var(--transition-fast);
  position: relative;
}

.engine-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.engine-item.active {
  background: rgba(79, 110, 247, 0.1);
  color: var(--color-primary);
  font-weight: 600;
}

.engine-item i:first-child { font-size: 15px; }

.engine-enabled-icon {
  margin-left: auto;
  font-size: 12px !important;
  color: #00B42A;
}

.engine-detail {
  flex: 1;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 20px;
  min-width: 0;
}

/* ── Form ── */
.config-form {
  margin: 16px 0;
}

.form-item {
  margin-bottom: 14px;
}

.form-item label {
  display: block;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.form-item input {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-page);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  transition: all var(--transition-fast);
}

.form-item input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.1);
  outline: none;
}

/* ── Hotkey Input ── */
.hotkey-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hotkey-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-page);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-family: 'SF Mono', 'Fira Code', monospace;
  letter-spacing: 1px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.hotkey-input:focus,
.hotkey-input.recording {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.15);
  outline: none;
}

/* ── Action Button ── */
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.action-btn:hover { opacity: 0.9; }
.action-btn:disabled { opacity: 0.5; cursor: default; }
.action-btn.secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
.action-btn.secondary:hover { background: rgba(100, 108, 255, 0.08); }

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.card-header-row .card-title { margin-bottom: 0; }

/* ── Test Area ── */
.test-area {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border-light);
}

/* ── Status Message ── */
.status-msg {
  font-size: var(--font-size-xs);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
}

.status-msg.success { color: #00B42A; background: rgba(0,180,42,0.06); }
.status-msg.error { color: #F53F3F; background: rgba(245,63,63,0.06); }
.status-msg.loading { color: var(--color-primary); }

/* ── Info Card ── */
.info-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(79, 110, 247, 0.04);
  border: 1px solid rgba(79, 110, 247, 0.12);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.info-card i { font-size: 20px; color: var(--color-primary); flex-shrink: 0; margin-top: 1px; }
.info-card strong { font-size: var(--font-size-sm); color: var(--color-text); display: block; margin-bottom: 3px; }
.info-card p { font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.5; }

.info-card.small {
  padding: 10px 14px;
  background: rgba(0,180,42,0.04);
  border-color: rgba(0,180,42,0.12);
}

.info-card.small i { color: #00B42A; font-size: 18px; }

/* ── About Page ── */
.about-card {
  text-align: center;
  padding: 40px 20px;
}

.about-logo {
  font-size: 36px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--color-primary), #9b6bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.about-ver {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.about-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.about-links {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 20px;
}

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

.update-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.update-status {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.5;
}

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

.update-available {
  margin-top: 4px;
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

.theme-row {
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
}

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
  transition: all var(--transition-fast);
}

.theme-seg-btn i {
  font-size: 16px;
}

.theme-seg-btn:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.theme-seg-btn.active {
  color: var(--color-primary);
  background: var(--color-bg);
  box-shadow: var(--shadow-sm);
  font-weight: 600;
}
</style>

