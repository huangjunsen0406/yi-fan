# 翻译引擎审查记录

审查日期：2026-11-04。范围：已注册的 23 个翻译引擎；修复微软和谷歌协议，检查其他引擎的请求、配置及错误处理。没有使用用户密钥发送付费请求，也没有打包或安装 Tauri 桌面应用。

## 本次修复

- 微软：改为无需用户 Key 的 Edge `POST https://edge.microsoft.com/translate/translatetext`，移除旧 Token 获取流程；保留自动检测、简繁中文映射，处理 HTML 实体。
- 谷歌：参考陪读蛙，改为 `POST https://translate-pa.googleapis.com/v1/translateHtml`，使用公开网页客户端协议。处理 HTML 转义、换行标记、缩进、项目符号及重复分隔符。
- 错误分类：HTTP 状态优先于响应中的 Key/Token 字样；Token 获取失败不再被当成“未配置”。免密钥服务被拒绝访问时不再提示填写 API Key。
- ChatGLM：Authorization 补上 `Bearer `，默认模型字段设为选填。
- Gemini：替换已退役的 `gemini-pro` 默认模型为 `gemini-3.8-flash`，保留自定义模型地址；合并可见文本 parts，过滤 thought 内容，请求地址设为选填。模型选择依据官方更新日志，未发送付费请求验证。
- OpenAI、Claude、Ollama、ChatGLM、Gemini：提示词区分简体中文、繁体中文和文言文。
- Ollama：有默认值的地址和模型字段设为选填，说明同步默认值。
- DeepL：官方 API Key 仅发送到 `api-free.deepl.com` 或 `api.deepl.com`；移除 `:dp` 路由到非官方域名的逻辑。保留无 Key 的网页接口。
- 百度领域：领域字段设为选填；拒绝缺失、格式错误或空的翻译结果。
- ECDICT：HTTP 失败、未知 JSON 和空释义不再写入本地词库；保留本地优先和离线查词。
- 必应词典、剑桥词典、Lingva、Yandex：先校验 HTTP 状态；剑桥支持短语查询；Lingva 不再把字面 `@@` 错误转换成 `/`。
- 阿里翻译：请求改用 HTTPS。
- 新用户默认引擎：TranSmart 替换为无需配置的 Yandex；保留已有用户保存的选择。

## 网络验证与边界

| 引擎 | 本次观察 |
| --- | --- |
| 微软新接口 | 公共样例请求 HTTP 200，返回中文译文 |
| 谷歌新接口 | 公共样例请求 HTTP 200，返回中文译文；特殊字符/换行追加请求遇到 TLS 超时，相关格式通过模拟回归验证 |
| Yandex | 公共样例请求 HTTP 200，返回中文译文 |
| TranSmart | 匿名请求 HTTP 200，但业务响应为 `Auth-Failed`；继续要求 Username/Token |
| 必应词典 | HTTP 403，服务明确返回 `Disabled / Access disabled.`；目前只修正错误识别，没有证据支持替换为其他可用端点 |
| 剑桥、ECDICT | 当前网络 HTTP 403；不能据此认定全球停用 |
| Lingva | 当前网络 TLS EOF；没有据此替换服务地址 |
| 其他需凭证服务 | 检查代码与公开协议，未使用用户密钥调用 |

Niutrans、腾讯、 有道、百度通用、彩云的常规请求协议未发现明确的阻断问题。这不等同于已完成携带真实账户凭证的端到端验证。

免费网页接口仍可能被上游限流、拦截或调整；协议迁移不能保证消除 429。

## 审查中记录、尚未处理的独立问题

以下项目未纳入本次微软/谷歌协议与其他引擎兼容性修复，保留为后续工作：

- 本地 Ollama：统一离线检查会在浏览器报告离线时阻断 localhost 服务。应按实际请求地址区分本地与远程 Ollama，不能把所有 Ollama 一律视为可离线。
- 火山翻译：当前忽略用户选择的源语言，总是由服务端自动检测。
- Claude：未针对 `stop_reason=max_tokens` 单独报告输出截断，长文可能被当成完整译文。
- 百度通用、腾讯等个别提供方仍可能在缺少结果字段时返回空字符串，应继续统一响应校验。
- 段落拆分、谷歌长文分块会增加请求数；谷歌长文本分块的拼接仍沿用原有空行策略，不保证跨块排版完全一致。
- 输入防抖和 Enter 可能重复触发请求；过期结果会被丢弃，但底层请求没有取消。并发限制作用于单次调用而非全局。这些路径仍有请求放大风险。
- 本次没有增加新的 HTML 实体库；解码覆盖基础命名实体和合法数字实体，未覆盖全部 HTML 命名实体。

## 验证结果

- `pnpm test`：18 个测试文件、183 个测试全部通过。
- `pnpm build`：`vue-tsc --noEmit` 与 Vite 生产构建通过。
- `git diff --check`：通过。
- Vite 仍提示混合静态/动态导入与大体积 bundle；这些提示不阻断构建。

## 协议参考

- [陪读蛙 Google 实现](https://github.com/mengxi-ream/read-frog/blob/main/src/utils/host/translate/api/google.ts)
- [陪读蛙 Microsoft 实现](https://github.com/mengxi-ream/read-frog/blob/main/src/utils/host/translate/api/microsoft.ts)
- [陪读蛙 Microsoft 迁移提交](https://github.com/mengxi-ream/read-frog/commit/f4bcbf080663c4fc73fbac2f87529854475c3b4e)
- [智谱 HTTP 鉴权说明](https://docs.bigmodel.cn/cn/guide/develop/http/introduction.md)
- [Gemini 官方更新日志](https://aistudio.google.com/docs/changelog)（通过 [文本抓取镜像](https://r.jina.ai/https://ai.google.dev/gemini-api/docs/changelog) 获取官方页面内容）
- [DeepL 官方鉴权与端点](https://developers.deepl.com/docs/getting-started/auth.md)
