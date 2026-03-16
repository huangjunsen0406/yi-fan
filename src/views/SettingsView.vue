<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { invoke } from '@tauri-apps/api/core'
import { getVersion } from '@tauri-apps/api/app'
import { useSettingsStore } from '../stores/settings'
import { providers, getProvider } from '../services/translate'
import { ocrProviders, getOcrProvider } from '../services/ocr'
import { register, unregister, unregisterAll, isRegistered } from '@tauri-apps/plugin-global-shortcut'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import { Message } from '@arco-design/web-vue'

const router = useRouter()
const settings = useSettingsStore()
const appVersion = ref('0.0.0')

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

// ── 快捷键 ──
interface HotkeyItem {
  id: string
  label: string
  command: string  // Tauri command name
  value: string
  status: { type: 'idle' | 'success' | 'error'; message: string }
}

const hotkeys = ref<HotkeyItem[]>([
  { id: 'toggle',      label: '唤出/隐藏窗口',  command: 'toggle_window',      value: 'Control+Cmd+Space',  status: { type: 'idle', message: '' } },
  { id: 'selection',   label: '划词翻译',       command: 'selection_translate', value: 'Control+Cmd+D',      status: { type: 'idle', message: '' } },
  { id: 'ocr_recognize', label: '截图识别(OCR)', command: 'ocr_recognize',      value: 'Control+Alt+O',  status: { type: 'idle', message: '' } },
  { id: 'ocr_translate', label: '截图翻译',     command: 'ocr_translate',      value: 'Control+Alt+P',  status: { type: 'idle', message: '' } },
  { id: 'code_format',   label: '代码格式切换',  command: 'cycle_code_format',  value: 'Control+Alt+U',  status: { type: 'idle', message: '' } },
  { id: 'clipboard',     label: '剪贴板监听',     command: 'toggle_clipboard',   value: 'Control+Alt+L',  status: { type: 'idle', message: '' } },
])
const activeHotkeyIdx = ref(-1)

// 默认快捷键映射
const DEFAULT_HOTKEYS: Record<string, string> = {
  toggle: 'Control+Cmd+Space',
  selection: 'Control+Cmd+D',
  ocr_recognize: 'Control+Alt+O',
  ocr_translate: 'Control+Alt+P',
  code_format: 'Control+Alt+U',
  clipboard: 'Control+Alt+L',
}

async function restoreDefaultHotkeys() {
  // Reset all values
  for (const hk of hotkeys.value) {
    hk.value = DEFAULT_HOTKEYS[hk.id] || ''
    hk.status = { type: 'idle', message: '' }
  }
  // Re-register all silently
  try { await unregisterAll() } catch { /* ignore */ }
  let failCount = 0
  for (const hk of hotkeys.value) {
    if (!hk.value) continue
    try {
      const already = await isRegistered(hk.value)
      if (already) await unregister(hk.value)
      await register(hk.value, (event) => {
        if (event.state === 'Pressed') {
          import('@tauri-apps/api/core').then(({ invoke }) => invoke(hk.command))
        }
      })
      settings.setConfig('_hotkeys', hk.id, hk.value)
    } catch {
      failCount++
    }
  }
  await settings.save()
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
  try { await unregisterAll() } catch { /* ignore */ }
}

function onHotkeyBlur() {
  activeHotkeyIdx.value = -1
  // Re-register all shortcuts after focus leaves
  registerAllHotkeys()
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
  // 互斥检测：检查是否与其他功能重复
  const duplicate = hotkeys.value.find((hk, i) => i !== idx && hk.value === key)
  if (duplicate) {
    item.status = { type: 'error', message: `与「${duplicate.label}」冲突` }
    return
  }
  try {
    const already = await isRegistered(key)
    if (already) await unregister(key)
    await register(key, (event) => {
      if (event.state === 'Pressed') {
        import('@tauri-apps/api/core').then(({ invoke }) => invoke(item.command))
      }
    })
    item.status = { type: 'success', message: `✓ 已注册 ${key}` }
    settings.setConfig('_hotkeys', item.id, key)
    await settings.save()
  } catch (err: any) {
    item.status = { type: 'error', message: `注册失败，可能与系统或其他应用冲突，请换一个` }
  }
}

/** Re-register all shortcuts that have a value */
async function registerAllHotkeys() {
  for (let i = 0; i < hotkeys.value.length; i++) {
    const item = hotkeys.value[i]
    if (!item.value) continue
    try {
      const already = await isRegistered(item.value)
      if (already) await unregister(item.value)
      await register(item.value, (event) => {
        if (event.state === 'Pressed') {
          import('@tauri-apps/api/core').then(({ invoke }) => invoke(item.command))
        }
      })
    } catch { /* ignore */ }
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
  height: 30px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.sidebar-logo {
  text-align: center;
  padding: 8px 16px 20px;
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
  background: rgba(79, 110, 247, 0.1);
  color: var(--color-primary);
  font-weight: 600;
}

.sidebar-item i {
  font-size: 18px;
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
  padding: 8px 20px;
  height: 46px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
  -webkit-app-region: drag;
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
  background: #ffffff;
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
  background: white;
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


</style>

