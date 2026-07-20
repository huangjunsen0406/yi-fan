<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getVersion } from '@tauri-apps/api/app'
import { useSettingsStore } from '../stores/settings'
import { getAvailableUpdateVersion } from '../services/update'
import { initTheme } from '../services/theme'
import HotkeyPanel from './settings/HotkeyPanel.vue'
import TranslatePanel from './settings/TranslatePanel.vue'
import OcrPanel from './settings/OcrPanel.vue'
import ServicePanel from './settings/ServicePanel.vue'
import AboutPanel from './settings/AboutPanel.vue'

const router = useRouter()
const settings = useSettingsStore()
const appVersion = ref('0.0.0')
const updateBadgeVersion = ref('')

type PageKey = 'hotkey' | 'translate' | 'ocr' | 'service' | 'about'
const activePage = ref<PageKey>(
  (typeof sessionStorage !== 'undefined' &&
    (sessionStorage.getItem('yi-fan-settings-page') as PageKey)) ||
    'hotkey'
)
if (typeof sessionStorage !== 'undefined') {
  sessionStorage.removeItem('yi-fan-settings-page')
}

const sidebarItems: { key: PageKey; icon: string; label: string }[] = [
  { key: 'hotkey', icon: 'ph-keyboard', label: '快捷键' },
  { key: 'translate', icon: 'ph-translate', label: '翻译' },
  { key: 'ocr', icon: 'ph-scan', label: '文字识别' },
  { key: 'service', icon: 'ph-puzzle-piece', label: '服务' },
  { key: 'about', icon: 'ph-info', label: '关于' },
]

function goBack() {
  router.push('/')
}

onMounted(async () => {
  try {
    appVersion.value = await getVersion()
  } catch { /* ignore */ }
  await settings.init()
  try {
    await initTheme()
  } catch { /* ignore */ }
  try {
    updateBadgeVersion.value = await getAvailableUpdateVersion()
  } catch { /* ignore */ }
})
</script>

<template>
  <div class="settings-view">
    <aside class="sidebar">
      <div class="sidebar-drag" data-tauri-drag-region></div>
      <div class="sidebar-logo" data-tauri-drag-region>
        <span class="logo-text">易翻</span>
        <span class="logo-ver">v{{ appVersion }}</span>
      </div>
      <nav class="sidebar-nav" role="navigation" aria-label="设置导航">
        <button
          v-for="item in sidebarItems"
          :key="item.key"
          class="sidebar-item"
          :class="{ active: activePage === item.key }"
          :aria-current="activePage === item.key ? 'page' : undefined"
          @click="activePage = item.key"
        >
          <i class="ph" :class="item.icon" aria-hidden="true"></i>
          <span>{{ item.label }}</span>
          <span
            v-if="item.key === 'about' && updateBadgeVersion"
            class="sidebar-badge"
            :title="`新版本 v${updateBadgeVersion}`"
          >新</span>
        </button>
      </nav>
      <div class="sidebar-bottom">
        <button class="sidebar-item" aria-label="返回主页" @click="goBack">
          <i class="ph ph-arrow-left" aria-hidden="true"></i>
          <span>返回</span>
        </button>
      </div>
    </aside>

    <main class="main-area">
      <div class="main-header" data-tauri-drag-region>
        <h2 class="page-title" data-tauri-drag-region>
          {{ sidebarItems.find((i) => i.key === activePage)?.label }}
        </h2>
      </div>
      <div class="main-content">
        <HotkeyPanel v-if="activePage === 'hotkey'" />
        <TranslatePanel v-if="activePage === 'translate'" />
        <OcrPanel v-if="activePage === 'ocr'" />
        <ServicePanel v-if="activePage === 'service'" />
        <AboutPanel
          v-if="activePage === 'about'"
          @badge-change="(v: string) => (updateBadgeVersion = v)"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--color-bg-page);
}

.sidebar {
  width: 180px;
  flex-shrink: 0;
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
}

.sidebar-drag {
  height: 38px;
  flex-shrink: 0;
  -webkit-app-region: drag;
  app-region: drag;
  padding-left: 72px;
}

.sidebar-logo {
  text-align: center;
  padding: 4px 16px 16px;
  -webkit-app-region: drag;
  app-region: drag;
}

.logo-text {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, var(--color-primary), #9b6bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  pointer-events: none;
}

.logo-ver {
  display: block;
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-top: 2px;
  pointer-events: none;
}

.sidebar-nav {
  flex: 1;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-bottom {
  padding: 8px;
  border-top: 1px solid var(--color-border-light);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  background: none;
  border: none;
  cursor: pointer;
  width: 100%;
  text-align: left;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.sidebar-item:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.sidebar-item:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.sidebar-item.active {
  background: var(--color-primary-bg);
  color: var(--color-primary);
  font-weight: 600;
}

.sidebar-item i {
  font-size: 18px;
}

.sidebar-badge {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--color-danger);
  color: #fff;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--color-bg-page);
}

.main-header {
  display: flex;
  align-items: center;
  padding: 10px 20px 8px;
  min-height: 46px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
  -webkit-app-region: drag;
  app-region: drag;
  background: var(--color-bg-page);
}

.page-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  -webkit-app-region: drag;
  app-region: drag;
  flex: 1;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
}
</style>
