# Tauri Updater 签名密钥

应用内更新使用 **Tauri minisign** 签名（**不是** Apple 开发者证书）。

## 本机已生成的密钥

| 文件 | 说明 |
|------|------|
| `yi-fan.key` | **私钥**，已 gitignore，切勿提交 |
| `yi-fan.key.pub` | 公钥，内容已写入 `tauri.conf.json` → `plugins.updater.pubkey` |

## 配置 GitHub Secrets（发版必需）

仓库 → Settings → Secrets and variables → Actions：

1. **`TAURI_SIGNING_PRIVATE_KEY`**  
   私钥**全文**（`cat src-tauri/keys/yi-fan.key` 的内容，一整段 base64 文本）

2. **`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`**  
   当前生成时无密码，可留空或不设。若重新 `tauri signer generate -p 你的密码`，则填对应密码。

> 若 Secrets 里已有旧密钥，必须与 conf 里的 `pubkey` 是一对。  
> 本次为项目新生成了密钥对：请把 **新私钥** 写入 Secrets，否则 CI 签出来的包客户端验签会失败。

## 重新生成（可选）

```bash
pnpm tauri signer generate -w src-tauri/keys/yi-fan.key -f --ci
# 将输出的 Public key 粘贴到 src-tauri/tauri.conf.json plugins.updater.pubkey
# 再更新 GitHub Secret TAURI_SIGNING_PRIVATE_KEY
```

## 客户端检查地址

```
https://github.com/huangjunsen0406/yi-fan/releases/latest/download/latest.json
```

打 tag 发版后，CI 会把 `latest.json` 与带 `.sig` 的更新包上传到该 Release。
