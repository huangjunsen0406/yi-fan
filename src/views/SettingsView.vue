<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '../stores/settings'
import { providers, getProvider } from '../services/translate'

const router = useRouter()
const settings = useSettingsStore()

const activeTab = ref(providers[0]?.name || '')
const saving = ref(false)
const testResults = ref<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({})

// Initialize test results for all providers
for (const p of providers) {
  testResults.value[p.name] = { status: 'idle', message: '' }
}

onMounted(async () => {
  await settings.init()
})

async function handleSave() {
  saving.value = true
  try {
    await settings.save()
    setTimeout(() => { saving.value = false }, 800)
  } catch {
    saving.value = false
  }
}

async function testEngine(name: string) {
  testResults.value[name] = { status: 'loading', message: '测试中...' }
  try {
    const provider = getProvider(name)
    if (!provider) throw new Error('未知引擎')
    const config = settings.getConfig(name)
    const result = await provider.translate('你好世界', '简体中文', '英语', config)
    testResults.value[name] = { status: 'success', message: `✓ "你好世界" → "${result}"` }
  } catch (err: any) {
    testResults.value[name] = { status: 'error', message: err.message || '测试失败' }
  }
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="settings-view">
    <!-- Header -->
    <div class="settings-header">
      <button class="back-btn" @click="goBack">
        <i class="ph ph-arrow-left"></i>
        <span>返回</span>
      </button>
      <h1 class="settings-title">设置</h1>
      <button class="save-btn" :disabled="saving" @click="handleSave">
        <i class="ph" :class="saving ? 'ph-check' : 'ph-floppy-disk'"></i>
        {{ saving ? '已保存' : '保存' }}
      </button>
    </div>

    <!-- Main: Left Tabs + Right Content -->
    <div class="settings-body">
      <!-- Left Tab List (dynamic from providers) -->
      <nav class="settings-nav">
        <button
          v-for="p in providers"
          :key="p.name"
          class="nav-item"
          :class="{ active: activeTab === p.name }"
          @click="activeTab = p.name"
        >
          <i class="ph" :class="p.icon"></i>
          <span>{{ p.label }}</span>
        </button>
      </nav>

      <!-- Right Content (dynamic from active provider) -->
      <div class="settings-content">
        <template v-for="p in providers" :key="p.name">
          <div v-if="activeTab === p.name" class="content-panel">
            <h2 class="panel-title">{{ p.label }}</h2>
            <p class="panel-desc">
              {{ p.description }}
              <a v-if="p.helpUrl" :href="p.helpUrl" target="_blank">了解更多</a>
            </p>

            <!-- 显示在主页开关 -->
            <div class="toggle-row">
              <span class="toggle-label">显示在主页引擎栏</span>
              <button
                class="toggle-btn"
                :class="{ active: settings.isEnabled(p.name) }"
                @click="settings.toggleEngine(p.name)"
              >
                <span class="toggle-knob"></span>
              </button>
            </div>

            <!-- Config form (only for engines that need config) -->
            <div v-if="p.needsConfig && p.configFields" class="form-group">
              <div v-for="field in p.configFields" :key="field.key" class="form-item">
                <label>{{ field.label }}</label>
                <input
                  :type="field.type"
                  :placeholder="field.placeholder"
                  :value="settings.getConfig(p.name)[field.key] || ''"
                  @input="settings.setConfig(p.name, field.key, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </div>

            <!-- No-config info card -->
            <div v-if="!p.needsConfig" class="info-card">
              <i class="ph ph-check-circle info-icon"></i>
              <div>
                <strong>无需配置</strong>
                <p>该翻译引擎使用免费接口，不需要注册或配置 API Key，开箱即用。</p>
              </div>
            </div>

            <!-- Test button -->
            <div class="test-area">
              <button
                class="test-btn"
                :disabled="p.needsConfig && !settings.isConfigured(p.name)"
                @click="testEngine(p.name)"
              >
                <i class="ph ph-play"></i> 测试连接
              </button>
              <span class="test-result" :class="testResults[p.name]?.status">
                {{ testResults[p.name]?.message }}
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.settings-header {
  display: flex;
  align-items: center;
  padding: 8px 0 12px;
  gap: 12px;
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.settings-title {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.save-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.save-btn:hover { background: var(--color-primary-light); }
.save-btn:disabled { opacity: 0.7; }

.settings-body {
  flex: 1;
  display: flex;
  min-height: 0;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.settings-nav {
  width: 130px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
  background: var(--color-bg-page);
  border-right: 1px solid var(--color-border-light);
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: left;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.nav-item i { font-size: 16px; flex-shrink: 0; }
.nav-item:hover { background: var(--color-bg-hover); color: var(--color-text); }
.nav-item.active { background: var(--color-primary-bg); color: var(--color-primary); font-weight: 500; }

.settings-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  min-width: 0;
}

.content-panel { max-width: 480px; }

.panel-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 6px;
}

.panel-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 20px;
}

.panel-desc a { color: var(--color-primary); text-decoration: none; }
.panel-desc a:hover { text-decoration: underline; }

.form-group {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 20px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-item label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-weight: 500;
}

.form-item input {
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  background: var(--color-bg);
  transition: border-color var(--transition-fast);
  outline: none;
  font-family: inherit;
}

.form-item input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.1);
}

.form-item input::placeholder { color: var(--color-text-placeholder); }

.info-card {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(0, 180, 42, 0.06);
  border: 1px solid rgba(0, 180, 42, 0.15);
  border-radius: var(--radius-md);
  margin-bottom: 20px;
}

.info-icon { font-size: 22px; color: #00B42A; flex-shrink: 0; margin-top: 1px; }
.info-card strong { font-size: var(--font-size-sm); color: var(--color-text); display: block; margin-bottom: 3px; }
.info-card p { font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.5; }

.test-area { display: flex; align-items: center; gap: 12px; }

.test-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.test-btn:hover:not(:disabled) { border-color: var(--color-primary-border); color: var(--color-primary); background: var(--color-primary-bg); }
.test-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.test-result { font-size: var(--font-size-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.test-result.loading { color: var(--color-text-secondary); }
.test-result.success { color: #00B42A; }
.test-result.error { color: #F53F3F; }

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  margin-bottom: 16px;
}

.toggle-label {
  font-size: var(--font-size-sm);
  color: var(--color-text);
  font-weight: 500;
}

.toggle-btn {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--color-border);
  transition: background 0.2s;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-btn.active {
  background: var(--color-primary);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s;
}

.toggle-btn.active .toggle-knob {
  transform: translateX(18px);
}
</style>
