# Homebrew 安装易翻

## 前提

GitHub Releases 中已有对应版本的 DMG，命名格式：

- `yi-fan_<version>_aarch64.dmg`（Apple Silicon）
- `yi-fan_<version>_x64.dmg`（Intel）

## 从本仓库公式安装（开发/试用）

```bash
# 在仓库根目录
# 1. 按 release 更新 sha256
pnpm homebrew:cask

# 2. 安装（要求 macOS 已装 Homebrew）
brew install --cask ./homebrew/yi-fan.rb
```

若 sha256 仍是占位符，可临时把 cask 内 `sha256` 改为 `:no_check`（仅自用）。

## 首次打开「已损坏」

未公证时：

```bash
sudo xattr -cr /Applications/易翻.app
```

## 维护公式

发布新版本后：

```bash
pnpm homebrew:cask -- --version 0.2.3
# 提交 homebrew/yi-fan.rb 的 version + sha256 变更
```

也可把本目录同步到独立 tap 仓库 `homebrew-yi-fan` 以便：

```bash
brew tap yourname/yi-fan
brew install --cask yi-fan
```
