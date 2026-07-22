<script setup lang="ts">
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useSettingsStore } from '../../stores/settings'
import {
  HOTKEY_DEFS,
  DEFAULT_HOTKEYS,
  getDefaultHotkeys,
  sanitizeHotkeyBindings,
  registerAllHotkeysDetailed,
  registerOneHotkey,
  unregisterAllHotkeys,
  hotkeyConflictHint,
  type HotkeyRegisterFailure,
} from '../../services/hotkeys'

const settings = useSettingsStore()

interface HotkeyItem {
  id: string
  label: string
  command: string
  value: string
  status: { type: 'idle' | 'success' | 'error' | 'warn'; message: string }
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
const lastProbe = ref<HotkeyRegisterFailure[]>([])
const probing = ref(false)

const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '')

function loadSaved() {
  const saved = settings.getConfig('_hotkeys')
  // Migrate illegal mac-style "Cmd" bindings on Windows → platform defaults
  const { bindings, changed } = sanitizeHotkeyBindings(saved)
  for (const hk of hotkeys.value) {
    hk.value = bindings[hk.id] || hk.value
    if (changed) settings.setConfig('_hotkeys', hk.id, hk.value)
  }
  if (changed) {
    void settings.save().catch(() => {
      /* ignore */
    })
  }
}
loadSaved()

function hotkeyBindingsFromUi(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const hk of hotkeys.value) {
    if (hk.value) map[hk.id] = hk.value
  }
  return map
}

function shortFailReason(key: string): string {
  if (!isMac && /\bCmd\b/i.test(key)) {
    return 'Windows 无 Cmd 键，请改用 Control/Alt/Shift'
  }
  return '可能与系统或其他应用冲突'
}

function applyProbeResult(failed: HotkeyRegisterFailure[]) {
  lastProbe.value = failed
  const failIds = new Set(failed.map((f) => f.id))
  for (const hk of hotkeys.value) {
    if (!hk.value) {
      hk.status = { type: 'idle', message: '' }
      continue
    }
    if (failIds.has(hk.id)) {
      const f = failed.find((x) => x.id === hk.id)!
      // Keep row status short; long tips live in the summary card below
      hk.status = {
        type: 'error',
        message: `注册失败 · ${shortFailReason(f.key)}`,
      }
    } else {
      hk.status = { type: 'success', message: `✓ 可用 ${hk.value}` }
    }
  }
}

async function restoreDefaultHotkeys() {
  const defaults = getDefaultHotkeys()
  for (const hk of hotkeys.value) {
    hk.value = defaults[hk.id] || DEFAULT_HOTKEYS[hk.id] || ''
    hk.status = { type: 'idle', message: '' }
    settings.setConfig('_hotkeys', hk.id, hk.value)
  }
  await settings.save()
  const r = await registerAllHotkeysDetailed(defaults)
  applyProbeResult(r.failed)
  if (r.failCount === 0) Message.success('已恢复默认快捷键')
  else Message.warning(`${r.failCount} 个默认快捷键仍无法注册，请在下方更换组合`)
}

/** 试注册全部当前组合（非系统扫描：平台无 API 列出占用方） */
async function probeAllHotkeys() {
  probing.value = true
  try {
    for (const hk of hotkeys.value) {
      if (hk.value) settings.setConfig('_hotkeys', hk.id, hk.value)
    }
    await settings.save()
    const r = await registerAllHotkeysDetailed(hotkeyBindingsFromUi())
    applyProbeResult(r.failed)
    if (r.failCount === 0) {
      Message.success(`全部 ${r.ok.length} 个快捷键注册成功`)
    } else {
      Message.warning(`${r.failCount} 个快捷键未生效，请在下方更换组合`)
    }
  } finally {
    probing.value = false
  }
}

const keyMap: Record<string, string> = {
  Backquote: '`', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
  Comma: ',', Equal: '=', Minus: '-', Plus: 'PLUS', Period: '.', Quote: "'",
  Semicolon: ';', Slash: '/', Space: 'Space', Tab: 'Tab', Backspace: 'Backspace',
  Delete: 'Delete', Escape: 'Escape', Enter: 'Enter',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
}

async function onHotkeyFocus(idx: number) {
  activeHotkeyIdx.value = idx
  await unregisterAllHotkeys()
}

async function onHotkeyBlur() {
  activeHotkeyIdx.value = -1
  for (const hk of hotkeys.value) {
    if (hk.value) settings.setConfig('_hotkeys', hk.id, hk.value)
  }
  await settings.save()
  const r = await registerAllHotkeysDetailed(hotkeyBindingsFromUi())
  if (r.failCount > 0) {
    applyProbeResult(r.failed)
    Message.warning(`${r.failCount} 个快捷键未能注册，请更换组合`)
  } else {
    lastProbe.value = []
  }
}

function onHotkeyKeyDown(e: KeyboardEvent, idx: number) {
  e.preventDefault()
  e.stopPropagation()
  if (e.code === 'Backspace') {
    hotkeys.value[idx].value = ''
    return
  }
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
  else if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(code)) code = ''
  else code = ''
  hotkeys.value[idx].value = `${combo}${combo && code ? '+' : ''}${code}`
  hotkeys.value[idx].status = { type: 'idle', message: '' }
}

async function registerHotkey(idx: number) {
  const item = hotkeys.value[idx]
  const key = item.value
  if (!key) {
    item.status = { type: 'error', message: '请先录入快捷键' }
    return
  }
  const duplicate = hotkeys.value.find((hk, i) => i !== idx && hk.value === key)
  if (duplicate) {
    item.status = { type: 'error', message: `与「${duplicate.label}」冲突，请换一组` }
    return
  }
  try {
    for (const hk of hotkeys.value) {
      if (hk.value) settings.setConfig('_hotkeys', hk.id, hk.value)
    }
    await settings.save()
    const r = await registerAllHotkeysDetailed(hotkeyBindingsFromUi())
    applyProbeResult(r.failed)
    if (r.failed.some((f) => f.id === item.id)) {
      try {
        await registerOneHotkey(item.command, key)
        item.status = { type: 'success', message: `✓ 已注册 ${key}` }
        lastProbe.value = lastProbe.value.filter((f) => f.id !== item.id)
      } catch {
        item.status = {
          type: 'error',
          message: `注册失败。${hotkeyConflictHint(key)}`,
        }
      }
    } else {
      item.status = { type: 'success', message: `✓ 已注册 ${key}` }
    }
  } catch {
    item.status = {
      type: 'error',
      message: `注册失败。${hotkeyConflictHint(key)}`,
    }
  }
}
</script>

<template>
  <div class="page-panel">
    <div class="config-card">
      <div class="card-header-row">
        <h3 class="card-title">全局快捷键</h3>
        <div class="header-actions-row">
          <button class="action-btn secondary" :disabled="probing" @click="probeAllHotkeys">
            <i class="ph ph-magnifying-glass"></i>
            {{ probing ? '检测中…' : '检测注册' }}
          </button>
          <button class="action-btn secondary" @click="restoreDefaultHotkeys">
            <i class="ph ph-arrow-counter-clockwise"></i> 恢复默认
          </button>
        </div>
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
            aria-label="快捷键录入"
            @focus="onHotkeyFocus(idx)"
            @blur="onHotkeyBlur()"
            @keydown="(e: KeyboardEvent) => onHotkeyKeyDown(e, idx)"
          />
          <button class="action-btn" @click="registerHotkey(idx)">
            <i class="ph ph-check"></i> 注册
          </button>
        </div>
        <div v-if="hk.status.type !== 'idle'" class="status-msg" :class="hk.status.type">
          <i
            class="ph"
            :class="hk.status.type === 'success' ? 'ph-check-circle' : 'ph-warning-circle'"
            aria-hidden="true"
          ></i>
          <span>{{ hk.status.message }}</span>
        </div>
      </div>
    </div>

    <div v-if="lastProbe.length" class="info-card warn probe-card">
      <i class="ph ph-warning"></i>
      <div class="probe-body">
        <strong>未生效的快捷键（{{ lastProbe.length }}）</strong>
        <ul class="probe-list">
          <li v-for="f in lastProbe" :key="f.id">
            <span class="probe-label">{{ f.label }}</span>
            <kbd class="probe-key">{{ f.key }}</kbd>
          </li>
        </ul>
        <p class="probe-hint">{{ hotkeyConflictHint() }}</p>
      </div>
    </div>

    <div class="info-card tips-card">
      <i class="ph ph-info"></i>
      <div class="tips-body">
        <strong>使用说明</strong>
        <ul class="tips-list">
          <li>点击输入框后按下快捷键，再点「注册」或「检测注册」。</li>
          <li>
            平台无法扫描热键被哪个程序占用，只能通过试注册判断是否可用。
          </li>
          <li v-if="isMac">
            macOS：避开系统截图 ⇧⌘3/4/5、聚焦搜索 ⌘Space；可在「系统设置 → 键盘 → 键盘快捷键」对照。
          </li>
          <li v-else>
            Windows：避开 Win 组合键与其它翻译/截图软件；冲突时请更换 Control/Alt/Shift 组合。
          </li>
          <li><kbd>Backspace</kbd> 清空当前录入。</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style src="./settings-common.css"></style>
<style scoped>
.header-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.info-card.warn {
  border-color: rgba(245, 63, 63, 0.28);
  background: rgba(245, 63, 63, 0.05);
}
.info-card.warn > i {
  color: #F53F3F;
}
.probe-card {
  align-items: flex-start;
}
.probe-body {
  min-width: 0;
  flex: 1;
}
.probe-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.probe-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
.probe-label {
  font-weight: 500;
  color: var(--color-text);
}
.probe-key {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 4px;
  border: 1px solid rgba(245, 63, 63, 0.22);
  background: rgba(245, 63, 63, 0.06);
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.3px;
  color: #C23A3A;
}
.probe-hint {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(245, 63, 63, 0.12);
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.55;
}
.status-msg {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 6px;
  line-height: 1.45;
}
.status-msg i {
  font-size: 14px;
  margin-top: 1px;
  flex-shrink: 0;
}
.status-msg span {
  min-width: 0;
}
.tips-card {
  align-items: flex-start;
}
.tips-body {
  min-width: 0;
  flex: 1;
}
.tips-list {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tips-list li {
  position: relative;
  padding-left: 14px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.55;
}
.tips-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-primary);
  opacity: 0.45;
}
.tips-list kbd {
  display: inline-block;
  padding: 0 5px;
  margin-right: 2px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-page);
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text);
}
.status-msg.warn {
  color: #d48806;
}
</style>
