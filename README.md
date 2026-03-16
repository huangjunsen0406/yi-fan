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
npm install
```

### 开发模式

启动前端 Vite 服务器和 Tauri 调试窗口：

```bash
npm run tauri dev
```

### 构建打包

构建前端并生成可执行安装包：

```bash
npm run tauri build
```

打包后的文件将存放在 `src-tauri/target/release/bundle` 目录下。

## 📁 项目结构

```text
yi-fan/
├── src/                # 前端源代码 (Vue 3)
│   ├── components/     # UI 组件
│   ├── services/       # OCR、翻译、TTS 等核心服务逻辑
│   ├── stores/         # Pinia 状态管理
│   ├── views/          # 页面视图 (翻译、截图、设置、历史等)
│   └── main.ts         # 前端入口
├── src-tauri/          # Rust 后端源代码 (Tauri)
│   ├── src/            # Rust 核心逻辑 (剪贴板、截图、托盘、语言检测)
│   └── tauri.conf.json # Tauri 配置文件
├── public/             # 静态资源
└── scripts/            # 自动化脚本
```

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源。

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request。如果有任何改进建议，请随时告知。

---

*Made with ❤️ by Yi-Fan Team*
