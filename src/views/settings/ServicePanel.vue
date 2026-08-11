<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../../stores/settings'
import { providers, getProvider } from '../../services/translate'
import { friendlyError } from '../../services/errors'

const settings = useSettingsStore()
const activeEngine = ref(providers[0]?.name || '')
const testResults = ref<Record<string, { status: 'idle' | 'loading' | 'success' | 'error'; message: string }>>({})
for (const p of providers) testResults.value[p.name] = { status: 'idle', message: '' }

const currentProvider = computed(() => providers.find((p) => p.name === activeEngine.value))

onMounted(() => settings.init())

/** Flush pending debounce + force disk write when leaving the panel */
onUnmounted(() => {
  void settings.save().catch(() => {
    /* logged in store */
  })
})

async function autoSaveConfig() {
  await settings.save()
}

async function testEngine(name: string) {
  testResults.value[name] = { status: 'loading', message: '测试中...' }
  try {
    // Ensure latest field values are on disk before test (also helps init race)
    await settings.save()
    const provider = getProvider(name)
    if (!provider) throw new Error('未知引擎')
    const config = settings.getConfig(name)
    const result = await provider.translate('你好世界', '简体中文', '英语', config)
    testResults.value[name] = { status: 'success', message: `✓ "${result}"` }
  } catch (err: any) {
    testResults.value[name] = { status: 'error', message: friendlyError(err, '测试失败') }
  }
}
</script>

<template>
  <div class="page-panel service-page">
    <div class="engine-list">
      <button
        v-for="p in providers"
        :key="p.name"
        class="engine-item"
        :class="{ active: activeEngine === p.name }"
        @click="activeEngine = p.name"
      >
        <i class="ph" :class="p.icon"></i>
        <span>{{ p.label }}</span>
        <i
          v-if="settings.isConfigured(p.name) && p.needsConfig"
          class="ph ph-check-circle engine-configured-icon"
          title="已配置"
        ></i>
        <i
          v-else-if="settings.isEnabled(p.name)"
          class="ph ph-check-circle engine-enabled-icon"
          title="主页已启用"
        ></i>
      </button>
    </div>
    <div class="engine-detail" v-if="currentProvider">
      <h3 class="card-title">{{ currentProvider.label }}</h3>
      <p class="card-desc">{{ currentProvider.description }}</p>
      <div v-if="currentProvider.needsConfig && currentProvider.configFields" class="config-form">
        <div v-for="field in currentProvider.configFields" :key="field.key" class="form-item">
          <label>
            {{ field.label }}
            <span v-if="field.required === false" class="optional-tag">可选</span>
          </label>
          <input
            :type="field.type"
            :placeholder="field.placeholder"
            :value="settings.getConfig(currentProvider.name)[field.key] || ''"
            @input="settings.setConfig(currentProvider.name, field.key, ($event.target as HTMLInputElement).value)"
            @blur="autoSaveConfig()"
          />
        </div>
      </div>
      <div v-if="!currentProvider.needsConfig" class="info-card small">
        <i class="ph ph-check-circle"></i>
        <div>
          <strong>无需配置</strong>
          <p>免费接口，开箱即用。</p>
        </div>
      </div>
      <div class="test-area">
        <button
          class="action-btn"
          :disabled="currentProvider.needsConfig && !settings.isConfigured(currentProvider.name)"
          @click="testEngine(currentProvider.name)"
        >
          <i class="ph ph-play"></i> 测试连接
        </button>
        <span class="status-msg" :class="testResults[currentProvider.name]?.status">
          {{ testResults[currentProvider.name]?.message }}
        </span>
      </div>
    </div>
  </div>
</template>

<style src="./settings-common.css"></style>
<style scoped>
.optional-tag {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-muted, #94a3b8);
}
.engine-configured-icon {
  margin-left: auto;
  color: #22c55e;
  font-size: 16px;
}
.engine-enabled-icon {
  margin-left: auto;
  color: #94a3b8;
  font-size: 16px;
}
</style>
