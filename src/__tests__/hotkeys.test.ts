import { describe, it, expect } from 'vitest'
import {
  getDefaultHotkey,
  getDefaultHotkeys,
  sanitizeHotkeyBinding,
  sanitizeHotkeyBindings,
  HOTKEY_DEFS,
} from '../services/hotkeys'

describe('platform hotkey defaults', () => {
  it('mac defaults use Control+Cmd for toggle/selection', () => {
    expect(getDefaultHotkey('toggle', true)).toBe('Control+Cmd+Space')
    expect(getDefaultHotkey('selection', true)).toBe('Control+Cmd+D')
    expect(getDefaultHotkey('ocr_recognize', true)).toBe('Control+Alt+O')
  })

  it('windows defaults never use Cmd', () => {
    const win = getDefaultHotkeys(false)
    expect(win.toggle).toBe('Control+Alt+T')
    expect(win.selection).toBe('Control+Alt+D')
    for (const v of Object.values(win)) {
      expect(v).not.toMatch(/\bCmd\b/)
    }
  })

  it('HOTKEY_DEFS cover all ids', () => {
    expect(HOTKEY_DEFS.map((d) => d.id)).toEqual([
      'toggle',
      'selection',
      'ocr_recognize',
      'ocr_translate',
      'code_format',
      'clipboard',
    ])
  })
})

describe('sanitizeHotkeyBinding', () => {
  it('replaces Cmd bindings on Windows with platform default', () => {
    expect(sanitizeHotkeyBinding('toggle', 'Control+Cmd+Space', false)).toBe(
      'Control+Alt+T'
    )
    expect(sanitizeHotkeyBinding('selection', 'Control+Cmd+D', false)).toBe(
      'Control+Alt+D'
    )
  })

  it('keeps Cmd bindings on macOS', () => {
    expect(sanitizeHotkeyBinding('toggle', 'Control+Cmd+Space', true)).toBe(
      'Control+Cmd+Space'
    )
  })

  it('keeps valid Win bindings unchanged', () => {
    expect(sanitizeHotkeyBinding('toggle', 'Control+Alt+T', false)).toBe(
      'Control+Alt+T'
    )
    expect(sanitizeHotkeyBinding('ocr_recognize', 'Control+Alt+O', false)).toBe(
      'Control+Alt+O'
    )
  })

  it('empty falls back to default', () => {
    expect(sanitizeHotkeyBinding('clipboard', '', false)).toBe('Control+Alt+L')
    expect(sanitizeHotkeyBinding('clipboard', null, true)).toBe('Control+Alt+L')
  })

  it('sanitizeHotkeyBindings reports change when migrating Cmd', () => {
    const { bindings, changed } = sanitizeHotkeyBindings(
      {
        toggle: 'Control+Cmd+Space',
        selection: 'Control+Cmd+D',
        ocr_recognize: 'Control+Alt+O',
      },
      false
    )
    expect(changed).toBe(true)
    expect(bindings.toggle).toBe('Control+Alt+T')
    expect(bindings.selection).toBe('Control+Alt+D')
    expect(bindings.ocr_recognize).toBe('Control+Alt+O')
  })
})
