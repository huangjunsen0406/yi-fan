<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useSettingsStore } from '../../stores/settings'
import { providers } from '../../services/translate'
import { loadGlossary, saveGlossary, type GlossaryEntry } from '../../services/glossary'
import { isTruthyConfig } from '../../services/configSchema'

const settings = useSettingsStore()
const glossaryText = ref('')
const preferLocalDict = ref(true)

const sourceLanguages = [
  '自动检测', '简体中文', '繁体中文', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语', '文言文',
]
const targetLanguages = [
  '简体中文', '繁体中文', '英语', '日语', '韩语',
  '法语', '德语', '西班牙语', '俄语',
]
const defaultSourceLang = ref('自动检测')
const defaultTargetLang = ref('简体中文')
const defaultTranslateEngine = ref('google')
const showSourceDrop = ref(false)
const showTargetDrop = ref(false)
const showDefaultEngineDrop = ref(false)

onMounted(async () => {
  await settings.init()
  const cfg = settings.getConfig('_translate')
  if (cfg['defaultSourceLang']) defaultSourceLang.value = cfg['defaultSourceLang']
  if (cfg['defaultTargetLang']) defaultTargetLang.value = cfg['defaultTargetLang']
  if (cfg['defaultEngine']) defaultTranslateEngine.value = cfg['defaultEngine']
  preferLocalDict.value = isTruthyConfig(settings.getApp('preferLocalDict'), true)
  try {
    const entries = await loadGlossary()
    glossaryText.value = entries.map((e) => `${e.source}=${e.target}`).join('\n')
  } catch { /* ignore */ }
  document.addEventListener('click', closeDrops)
})

async function togglePreferLocalDict() {
  preferLocalDict.value = !preferLocalDict.value
  settings.setApp('preferLocalDict', String(preferLocalDict.value))
  await settings.save()
}

async function saveGlossaryUi() {
  const entries: GlossaryEntry[] = []
  for (const line of glossaryText.value.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    entries.push({ source: t.slice(0, eq).trim(), target: t.slice(eq + 1).trim() })
  }
  await saveGlossary(entries)
  Message.success(`已保存 ${entries.length} 条术语`)
}

function closeDrops() {
  showSourceDrop.value = false
  showTargetDrop.value = false
  showDefaultEngineDrop.value = false
}

async function saveDefaultLangs() {
  settings.setConfig('_translate', 'defaultSourceLang', defaultSourceLang.value)
  settings.setConfig('_translate', 'defaultTargetLang', defaultTargetLang.value)
  settings.setConfig('_translate', 'defaultEngine', defaultTranslateEngine.value)
  await settings.save()
}
</script>

<template>
  <div class="page-panel" @click="closeDrops">
    <div class="config-card">
      <h3 class="card-title">翻译偏好</h3>
      <div class="config-row">
        <span class="row-label">默认源语言</span>
        <div
          class="custom-select"
          :class="{ open: showSourceDrop }"
          @click.stop="showSourceDrop = !showSourceDrop; showTargetDrop = false; showDefaultEngineDrop = false"
        >
          <span class="select-text">{{ defaultSourceLang }}</span>
          <i class="ph ph-caret-down select-arrow"></i>
          <div v-if="showSourceDrop" class="select-dropdown">
            <div
              v-for="lang in sourceLanguages"
              :key="lang"
              class="select-option"
              :class="{ active: defaultSourceLang === lang }"
              @click.stop="defaultSourceLang = lang; showSourceDrop = false; saveDefaultLangs()"
            >{{ lang }}</div>
          </div>
        </div>
      </div>
      <div class="config-row">
        <span class="row-label">默认目标语言</span>
        <div
          class="custom-select"
          :class="{ open: showTargetDrop }"
          @click.stop="showTargetDrop = !showTargetDrop; showSourceDrop = false; showDefaultEngineDrop = false"
        >
          <span class="select-text">{{ defaultTargetLang }}</span>
          <i class="ph ph-caret-down select-arrow"></i>
          <div v-if="showTargetDrop" class="select-dropdown">
            <div
              v-for="lang in targetLanguages"
              :key="lang"
              class="select-option"
              :class="{ active: defaultTargetLang === lang }"
              @click.stop="defaultTargetLang = lang; showTargetDrop = false; saveDefaultLangs()"
            >{{ lang }}</div>
          </div>
        </div>
      </div>
      <div class="config-row">
        <span class="row-label">默认翻译引擎</span>
        <div
          class="custom-select"
          :class="{ open: showDefaultEngineDrop }"
          @click.stop="showDefaultEngineDrop = !showDefaultEngineDrop; showSourceDrop = false; showTargetDrop = false"
        >
          <span class="select-text">{{ providers.find(p => p.name === defaultTranslateEngine)?.label || '谷歌翻译' }}</span>
          <i class="ph ph-caret-down select-arrow"></i>
          <div v-if="showDefaultEngineDrop" class="select-dropdown">
            <div
              v-for="p in providers.filter(ep => settings.isEnabled(ep.name))"
              :key="p.name"
              class="select-option"
              :class="{ active: defaultTranslateEngine === p.name }"
              @click.stop="defaultTranslateEngine = p.name; showDefaultEngineDrop = false; saveDefaultLangs()"
            >{{ p.label }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="config-card">
      <h3 class="card-title">离线 / 词典</h3>
      <div class="config-row">
        <div>
          <span class="row-label">优先本地词库</span>
          <p class="card-desc" style="margin: 4px 0 0">
            查词与离线时先查内置/已缓存词条（ECDICT 可离线）；未命中再走在线。
          </p>
        </div>
        <button
          class="toggle-btn"
          :class="{ active: preferLocalDict }"
          :aria-label="preferLocalDict ? '关闭本地词库优先' : '开启本地词库优先'"
          @click="togglePreferLocalDict"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </div>

    <div class="config-card">
      <h3 class="card-title">主页引擎显示</h3>
      <p class="card-desc">选择在主页引擎栏中显示的翻译引擎。</p>
      <div class="engine-toggle-list">
        <div v-for="p in providers" :key="p.name" class="engine-toggle-item">
          <div class="engine-toggle-info">
            <i class="ph" :class="p.icon"></i>
            <span>{{ p.label }}</span>
          </div>
          <button
            class="toggle-btn"
            :class="{ active: settings.isEnabled(p.name) }"
            :aria-label="`切换${p.label}`"
            @click="settings.toggleEngine(p.name)"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    </div>

    <div class="config-card">
      <h3 class="card-title">术语表</h3>
      <p class="card-desc">每行一条：原文=固定译文。翻译时会优先保留固定译法（适合专有名词）。</p>
      <textarea
        v-model="glossaryText"
        class="glossary-area"
        rows="6"
        placeholder="Grok=Grok&#10;易翻=Yi-Fan"
        aria-label="术语表"
      />
      <button class="action-btn" style="margin-top: 10px" @click="saveGlossaryUi">保存术语表</button>
    </div>
  </div>
</template>

<style src="./settings-common.css"></style>
<style scoped>
.glossary-area {
  width: 100%;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.5;
  resize: vertical;
}
</style>
