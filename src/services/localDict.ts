/**
 * Local / offline dictionary.
 *
 * - Seed: compact built-in EN↔ZH common words (no network)
 * - Cache: successful online dict lookups are remembered in settings store
 * Used when offline or when preferLocalDict + single-word query.
 */
import { load } from '@tauri-apps/plugin-store'

const STORE = 'settings.json'
const CACHE_KEY = 'local_dict_cache'

/** Minimal offline seed (common words / tech terms). Lowercase keys. */
const SEED: Record<string, string> = {
  hello: '你好；问候',
  hi: '嗨；你好',
  world: '世界',
  thanks: '谢谢',
  thank: '感谢；谢谢',
  you: '你；你们',
  please: '请',
  yes: '是；好的',
  no: '不；没有',
  ok: '好的；可以',
  good: '好的；良好',
  bad: '坏的；差',
  time: '时间',
  day: '天；日',
  night: '夜晚',
  today: '今天',
  tomorrow: '明天',
  yesterday: '昨天',
  week: '周；星期',
  month: '月',
  year: '年',
  language: '语言',
  translate: '翻译',
  translation: '翻译；译文',
  dictionary: '词典；字典',
  computer: '计算机；电脑',
  software: '软件',
  hardware: '硬件',
  network: '网络',
  internet: '互联网',
  offline: '离线',
  online: '在线',
  file: '文件',
  folder: '文件夹',
  window: '窗口',
  button: '按钮',
  settings: '设置',
  preference: '偏好；偏好设置',
  error: '错误',
  success: '成功',
  fail: '失败',
  failed: '失败的',
  loading: '加载中',
  search: '搜索',
  copy: '复制',
  paste: '粘贴',
  cut: '剪切',
  delete: '删除',
  save: '保存',
  open: '打开',
  close: '关闭',
  start: '开始；启动',
  stop: '停止',
  restart: '重启',
  update: '更新',
  version: '版本',
  release: '发布；版本',
  install: '安装',
  uninstall: '卸载',
  download: '下载',
  upload: '上传',
  clipboard: '剪贴板',
  shortcut: '快捷键；捷径',
  keyboard: '键盘',
  mouse: '鼠标',
  screen: '屏幕',
  display: '显示；显示器',
  theme: '主题',
  dark: '深色；黑暗',
  light: '浅色；光',
  system: '系统',
  user: '用户',
  password: '密码',
  account: '账户',
  email: '电子邮件',
  message: '消息',
  chat: '聊天',
  code: '代码；编码',
  function: '函数；功能',
  variable: '变量',
  string: '字符串',
  number: '数字；号码',
  boolean: '布尔值',
  array: '数组',
  object: '对象',
  class: '类',
  interface: '接口',
  type: '类型',
  import: '导入',
  export: '导出',
  module: '模块',
  package: '包',
  dependency: '依赖',
  cache: '缓存',
  memory: '内存；记忆',
  cpu: '中央处理器',
  gpu: '图形处理器',
  database: '数据库',
  query: '查询',
  index: '索引',
  server: '服务器',
  client: '客户端',
  api: '应用程序接口',
  request: '请求',
  response: '响应',
  status: '状态',
  token: '令牌；标记',
  key: '键；密钥',
  value: '值',
  default: '默认',
  option: '选项',
  config: '配置',
  configuration: '配置',
  engine: '引擎',
  provider: '提供方；供应商',
  model: '模型',
  prompt: '提示词；提示',
  result: '结果',
  source: '源；来源',
  target: '目标',
  chinese: '中文；中国的',
  english: '英语；英文的',
  japanese: '日语；日本的',
  korean: '韩语；韩国的',
  french: '法语；法国的',
  german: '德语；德国的',
  spanish: '西班牙语',
  russian: '俄语；俄国的',
  apple: '苹果',
  google: '谷歌',
  microsoft: '微软',
  github: 'GitHub（代码托管）',
  macos: 'macOS 操作系统',
  windows: 'Windows 操作系统',
  linux: 'Linux 操作系统',
  browser: '浏览器',
  application: '应用程序',
  app: '应用',
  document: '文档',
  image: '图像；图片',
  video: '视频',
  audio: '音频',
  text: '文本',
  paragraph: '段落',
  sentence: '句子',
  word: '单词；词语',
  phrase: '短语',
  meaning: '含义；意思',
  example: '例子；示例',
  definition: '定义',
  synonym: '同义词',
  antonym: '反义词',
  pronunciation: '发音',
  grammar: '语法',
  vocabulary: '词汇',
  // product / project related
  'yi-fan': '易翻（本应用）',
  grok: 'Grok（xAI）',
  tauri: 'Tauri（桌面应用框架）',
  vue: 'Vue.js 前端框架',
  rust: 'Rust 编程语言',
}

let cache: Record<string, string> | null = null
let cacheLoaded = false

function normalizeWord(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  // single token / short phrase only
  if (/\s/.test(t) && t.split(/\s+/).length > 3) return null
  if (t.length > 48) return null
  return t.toLowerCase()
}

async function loadCache(): Promise<Record<string, string>> {
  if (cacheLoaded && cache) return cache
  try {
    const store = await load(STORE, { autoSave: true } as any)
    const raw = await store.get<Record<string, string>>(CACHE_KEY)
    cache = raw && typeof raw === 'object' ? raw : {}
  } catch {
    cache = {}
  }
  cacheLoaded = true
  return cache
}

async function saveCache(): Promise<void> {
  if (!cache) return
  try {
    const store = await load(STORE, { autoSave: true } as any)
    await store.set(CACHE_KEY, cache)
  } catch {
    /* ignore in browser */
  }
}

/** Lookup offline seed + learned cache. Returns null if miss. */
export async function lookupLocalDict(text: string): Promise<string | null> {
  const key = normalizeWord(text)
  if (!key) return null
  const learned = await loadCache()
  if (learned[key]) return learned[key]
  // multi-word: try whole phrase then first word
  if (SEED[key]) return SEED[key]
  const first = key.split(/\s+/)[0]
  if (first && SEED[first] && first === key) return SEED[first]
  return SEED[key] ?? null
}

/** Remember a successful online dict result for offline reuse */
export async function rememberLocalDict(text: string, meaning: string): Promise<void> {
  const key = normalizeWord(text)
  if (!key || !meaning?.trim()) return
  if (meaning.length > 2000) return
  const learned = await loadCache()
  learned[key] = meaning.trim()
  // cap cache size
  const keys = Object.keys(learned)
  if (keys.length > 5000) {
    for (const k of keys.slice(0, keys.length - 4000)) delete learned[k]
  }
  await saveCache()
}

/** Sync seed-only lookup for unit tests (no Tauri) */
export function lookupSeedDict(text: string): string | null {
  const key = normalizeWord(text)
  if (!key) return null
  return SEED[key] ?? null
}

export function isLikelySingleWordQuery(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 48) return false
  const parts = t.split(/\s+/).filter(Boolean)
  return parts.length <= 3 && !/[。！？；\n]/.test(t)
}
