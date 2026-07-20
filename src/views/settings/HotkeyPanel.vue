<script setup lang="ts">
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useSettingsStore } from '../../stores/settings'
import {
  HOTKEY_DEFS,
  DEFAULT_HOTKEYS,
  registerAllHotkeysDetailed,
  registerOneHotkey,
  unregisterAllHotkeys,
  hotkeyConflictHint,
  formatHotkeyFailure,
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
  for (const hk of hotkeys.value) {
    if (saved[hk.id]) hk.value = saved[hk.id]
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
      hk.status = {
        type: 'error',
        message: `注册失败：可能与系统或其他应用冲突。${hotkeyConflictHint(f.key)}`,
      }
    } else {
      hk.status = { type: 'success', message: `✓ 可用 ${hk.value}` }
    }
  }
}

async function restoreDefaultHotkeys() {
  for (const hk of hotkeys.value) {
    hk.value = DEFAULT_HOTKEYS[hk.id] || ''
    hk.status = { type: 'idle', message: '' }
    settings.setConfig('_hotkeys', hk.id, hk.value)
  }
  await settings.save()
  const r = await registerAllHotkeysDetailed(DEFAULT_HOTKEYS)
  applyProbeResult(r.failed)
  if (r.failCount === 0) Message.success('已恢复默认快捷键')
  else {
    Message.error(
      `${r.failCount} 个默认快捷键仍无法注册：${r.failed.map(formatHotkeyFailure).join('；')}`
    )
  }
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
      Message.warning({
        content: `${r.failCount} 个失败：${r.failed.map(formatHotkeyFailure).join('；')}`,
        duration: 5000,
      })
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
          {{ hk.status.message }}
        </div>
      </div>
    </div>

    <div v-if="lastProbe.length" class="info-card warn">
      <i class="ph ph-warning"></i>
      <div>
        <strong>未生效的快捷键（{{ lastProbe.length }}）</strong>
        <ul class="probe-list">
          <li v-for="f in lastProbe" :key="f.id">
            {{ formatHotkeyFailure(f) }}
          </li>
        </ul>
        <p class="probe-hint">{{ hotkeyConflictHint() }}</p>
      </div>
    </div>

    <div class="info-card">
      <i class="ph ph-info"></i>
      <div>
        <strong>使用说明</strong>
        <p>
          点击输入框后按下快捷键，再点「注册」或「检测注册」。
          平台<strong>无法扫描</strong>是哪个程序占用了热键，只能试注册判断是否可用。
        </p>
        <p v-if="isMac" class="tips-extra">
          macOS 提示：避开系统截图 ⇧⌘3/4/5、聚焦搜索 ⌘Space；可在「系统设置 → 键盘 → 键盘快捷键」对照。
        </p>
        <p v-else class="tips-extra">
          Windows 提示：避开 Win 组合键与其它翻译/截图软件；冲突时请更换 Control/Alt/Shift 组合。
        </p>
        <p class="tips-extra">Backspace 清空当前录入。</p>
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
  border-color: rgba(245, 63, 63, 0.35);
  background: rgba(245, 63, 63, 0.06);
}
.probe-list {
  margin: 8px 0 0;
  padding-left: 1.2em;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.probe-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-placeholder);
  line-height: 1.55;
}
.tips-extra {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-placeholder);
  line-height: 1.5;
}
.status-msg.warn {
  color: #d48806;
}
</style>
