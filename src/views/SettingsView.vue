<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { providers, getProvider } from '../services/translate'
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut'

const router = useRouter()
const settings = useSettingsStore()

// ── 一级导航 ──
type PageKey = 'hotkey' | 'translate' | 'service' | 'about'
const activePage = ref<PageKey>('hotkey')

const sidebarItems: { key: PageKey; icon: string; label: string }[] = [
  { key: 'hotkey',    icon: 'ph-keyboard',   label: '快捷键' },
  { key: 'translate', icon: 'ph-translate',  label: '翻译' },
  { key: 'service',   icon: 'ph-puzzle-piece', label: '服务' },
  { key: 'about',     icon: 'ph-info',       label: '关于' },
]

// ── 服务页: 当前选中的引擎 ──
const activeEngine = ref(providers[0]?.name || '')

// ── 快捷键 ──
const hotkeyToggle = ref('Alt+Space')
const hotkeyRecording = ref(false)
const hotkeyStatus = ref<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })

const keyMap: Record<string, string> = {
  Backquote: '`', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
  Comma: ',', Equal: '=', Minus: '-', Plus: 'PLUS', Period: '.', Quote: "'",
  Semicolon: ';', Slash: '/', Space: 'Space', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', Escape: 'Escape', Enter: 'Enter',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
}

function onHotkeyKeyDown(e: KeyboardEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (e.code === 'Backspace') { hotkeyToggle.value = ''; return }
  let combo = ''
  if (e.ctrlKey) combo = 'Control'
  if (e.shiftKey) combo = `${combo}${combo ? '+' : ''}Shift`
  if (e.metaKey) combo = `${combo}${combo ? '+' : ''}Super`
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
  hotkeyToggle.value = `${combo}${combo && code ? '+' : ''}${code}`
}

async function registerHotkey() {
  const key = hotkeyToggle.value
  if (!key) { hotkeyStatus.value = { type: 'error', message: '请先录入快捷键' }; return }
  try {
    const already = await isRegistered(key)
    if (already) await unregister(key)
    await register(key, (event) => {
      if (event.state === 'Pressed') {
        import('@tauri-apps/api/core').then(({ invoke }) => invoke('toggle_window'))
      }
    })
    hotkeyStatus.value = { type: 'success', message: `✓ 已注册 ${key}` }
    settings.setConfig('_hotkeys', 'toggle', key)
  } catch (err: any) {
    hotkeyStatus.value = { type: 'error', message: err.message || '注册失败' }
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

// ── 保存 ──
const saving = ref(false)
async function handleSave() {
  saving.value = true
  try { await settings.save(); setTimeout(() => { saving.value = false }, 800) }
  catch { saving.value = false }
}

function goBack() { router.push('/') }

// ── 当前选中引擎的详情 ──
const currentProvider = computed(() => providers.find(p => p.name === activeEngine.value))

onMounted(async () => {
  await settings.init()
  const savedToggle = settings.getConfig('_hotkeys')['toggle']
  if (savedToggle) hotkeyToggle.value = savedToggle
})
</script>

<template>
  <div class="settings-view">
    <!-- 左侧导航栏 -->
    <aside class="sidebar">
      <div class="sidebar-drag" data-tauri-drag-region></div>
      <div class="sidebar-logo">
        <span class="logo-text">易翻</span>
        <span class="logo-ver">v0.1.0</span>
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
        <button class="save-btn" :disabled="saving" @click="handleSave">
          <i class="ph" :class="saving ? 'ph-check' : 'ph-floppy-disk'"></i>
          {{ saving ? '已保存' : '保存' }}
        </button>
      </div>

      <div class="main-content">
        <!-- ========== 快捷键页 ========== -->
        <div v-if="activePage === 'hotkey'" class="page-panel">
          <div class="config-card">
            <h3 class="card-title">全局快捷键</h3>
            <div class="form-item">
              <label>唤出/隐藏翻译窗口</label>
              <div class="hotkey-input-row">
                <input
                  class="hotkey-input"
                  :class="{ recording: hotkeyRecording }"
                  :value="hotkeyToggle"
                  readonly
                  placeholder="点击后按下快捷键"
                  @focus="hotkeyRecording = true"
                  @blur="hotkeyRecording = false"
                  @keydown="onHotkeyKeyDown"
                />
                <button class="action-btn" @click="registerHotkey">
                  <i class="ph ph-check"></i> 注册
                </button>
              </div>
            </div>
            <div v-if="hotkeyStatus.type !== 'idle'" class="status-msg" :class="hotkeyStatus.type">
              {{ hotkeyStatus.message }}
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
              <span class="row-value">自动检测</span>
            </div>
            <div class="config-row">
              <span class="row-label">默认目标语言</span>
              <span class="row-value">简体中文</span>
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

            <!-- 启用开关 -->
            <div class="config-row">
              <span class="row-label">在主页显示</span>
              <button
                class="toggle-btn"
                :class="{ active: settings.isEnabled(currentProvider.name) }"
                @click="settings.toggleEngine(currentProvider.name)"
              >
                <span class="toggle-knob"></span>
              </button>
            </div>

            <!-- 配置表单 -->
            <div v-if="currentProvider.needsConfig && currentProvider.configFields" class="config-form">
              <div v-for="field in currentProvider.configFields" :key="field.key" class="form-item">
                <label>{{ field.label }}</label>
                <input
                  :type="field.type"
                  :placeholder="field.placeholder"
                  :value="settings.getConfig(currentProvider.name)[field.key] || ''"
                  @input="settings.setConfig(currentProvider.name, field.key, ($event.target as HTMLInputElement).value)"
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
          <div class="config-card about-card">
            <div class="about-logo">易翻</div>
            <p class="about-ver">版本 0.1.0</p>
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
