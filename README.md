# 易翻 (Yi-Fan)

[![Tauri 2](https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri)](https://tauri.app/)
[![Vue 3](https://img.shields.io/badge/Vue-3.0-green?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

易翻 (Yi-Fan) 是一款基于 **Tauri 2** 和 **Vue 3** 开发的跨平台轻量翻译工具。它集成了 21 种主流翻译引擎和 4 种 OCR 识别引擎，旨在为用户提供快速、便捷的翻译体验。

## 🌟 界面截图

![image-20260316093908568](https://qny.weizulin.cn/images/202603160939889.png)

![image-20260316093932584](https://qny.weizulin.cn/images/202603160939642.png)

## ✨ 功能特性

- 🚀 **轻量高效**: 基于 Tauri 2 构建，资源占用低，启动速度快。
- 🌍 **多引擎集成**:
    - **21 种翻译引擎**: 包括 DeepL, Google, OpenAI (ChatGPT), Gemini Pro, Claude (ChatGLM), Ollama, Baidu, Tencent, Alibaba, Youdao, Bing, Caiyun, Niutrans, Volcengine, Yandex, Lingva, Transmart, Cambridge Dict, Bing Dict, ECDICT 等。
    - **4 种 OCR 引擎**: 支持 Baidu, Tencent, Volcengine 以及系统原生 OCR。
- 📸 **截图翻译**: 支持全局快捷键截图，自动识别文字并翻译。
- 🎙️ **TTS 语音**: 支持多语种语音朗读。
- 📝 **历史记录**: 自动保存翻译历史，方便随时回顾。
- 🎨 **现代化 UI**: 使用 Arco Design 组件库，界面简洁美观。
- 🛠️ **高度可定制**: 支持自定义翻译引擎 API Key、快捷键设置、外观主题等。

## 🛠️ 技术栈

- **前端**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **跨平台框架**: [Tauri 2](https://tauri.app/)
- **状态管理**: [Pinia](https://pinia.vuejs.org/)
- **路由**: [Vue Router](https://router.vuejs.org/)
- **UI 组件**: [Arco Design Vue](https://arco.design/vue/)
- **工具库**: [VueUse](https://vueuse.org/)
- **后端**: [Rust](https://www.rust-lang.org/) (Tauri 插件开发)

## 🚀 开发与构建

### 准备工作

确保你已安装以下环境：
- [Node.js](https://nodejs.org/) (建议最新 LTS 版本)
- [Rust 环境](https://www.rust-lang.org/learn/get-started) (Tauri 开发必需)
- 对应平台的构建工具 (C++ Build Tools, libwebkit2gtk 等，详见 [Tauri 官方指南](https://tauri.app/v1/guides/getting-started/prerequisites))

### 安装依赖

```bash
pnpm install
```

### 开发模式

启动前端 Vite 服务器和 Tauri 调试窗口：

```bash
pnpm run tauri dev
```

### 构建打包

构建前端并生成可执行安装包：

```bash
pnpm run tauri build
```

打包后的文件将存放在 `src-tauri/target/release/bundle` 目录下。

## 📥 安装说明（macOS）

从 [GitHub Releases](https://github.com/huangjunsen0406/yi-fan/releases) 下载 DMG / `.app` 后，若出现：

> “易翻.app”已损坏，无法打开。你应该将它移到废纸篓。

这是系统 **隔离属性（quarantine）** 导致的误报（应用未做 Apple 公证），并不是文件真的损坏。在终端执行：

```bash
# 若已拖到「应用程序」
sudo xattr -cr /Applications/易翻.app

# 若还在「下载」目录，按实际路径改，例如：
# xattr -cr ~/Downloads/易翻.app
```

然后再次双击打开即可。也可在「系统设置 → 隐私与安全性」里点「仍要打开」。

> 说明：本项目暂无 Apple 开发者账号，无法进行公证（Notarization）。用终端去掉隔离属性是未签名 macOS 开源软件的常见用法。

## 📁 项目结构

```text
yi-fan/
├── src/                # 前端源代码 (Vue 3)
│   ├── components/     # UI 组件
│   ├── services/       # OCR、翻译、TTS、更新、主题等
│   ├── stores/         # Pinia 状态管理
│   ├── views/          # 页面视图 (翻译、截图、设置、历史等)
│   ├── utils/          # 纯函数工具（可单测）
│   └── main.ts         # 前端入口
├── src-tauri/          # Rust 后端源代码 (Tauri)
│   ├── src/            # 剪贴板、截图、托盘、语言检测
│   └── tauri.conf.json # Tauri 配置（含 updater endpoint）
├── scripts/            # 发版 / latest.json 生成
└── .github/workflows/  # CI typecheck + Package 发版
```

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request。如果有任何改进建议，请随时告知。

---

*Made with ❤️ by Yi-Fan Team*
