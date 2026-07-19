# 设置页结构说明

`SettingsView.vue` 仍承载导航与各页状态；业务逻辑已逐步外提：

| 能力 | 位置 |
|------|------|
| 快捷键注册 | `services/hotkeys.ts` |
| 主题 | `services/theme.ts` |
| 应用更新 | `services/update.ts` |
| 翻译/OCR 配置 | `stores/settings.ts` + 各 provider |

后续可将各 `page-panel` 拆为 `HotkeyPanel.vue` / `TranslatePanel.vue` 等，由 `SettingsView` 只做路由式切换。
