<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getBase64, systemOCR } from '../services/ocr'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const settings = useSettingsStore()

const base64 = ref('')
const ocrText = ref('')
const loading = ref(true)
const error = ref('')
const ocrLang = ref('auto')

const langOptions = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh-Hans', label: '简体中文' },
  { value: 'zh-Hant', label: '繁体中文' },
  { value: 'en-US', label: '英语' },
  { value: 'ja-JP', label: '日语' },
  { value: 'ko-KR', label: '韩语' },
  { value: 'fr-FR', label: '法语' },
  { value: 'de-DE', label: '德语' },
]

async function doOCR() {
  loading.value = true
  error.value = ''
  try {
    let text = await systemOCR(ocrLang.value)

    // 应用设置：删除换行
    const ocrSettings = settings.getConfig('_ocr')
    if (ocrSettings['deleteNewline'] === 'true') {
      text = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    }

    ocrText.value = text

    // 应用设置：自动复制
    if (ocrSettings['autoCopy'] === 'true' && text) {
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        // fallback
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
    }

    // 应用设置：自动翻译
    if (ocrSettings['autoTranslate'] === 'true' && text) {
      router.push({ path: '/', query: { text } })
    }
  } catch (err: any) {
    error.value = err.message || err.toString() || 'OCR 识别失败'
  } finally {
    loading.value = false
  }
}

async function copyText() {
  try {
    await navigator.clipboard.writeText(ocrText.value)
  } catch {
    // fallback
    const textarea = document.createElement('textarea')
    textarea.value = ocrText.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

function sendToTranslate() {
  // Navigate back to main and pass OCR text
  router.push({ path: '/', query: { text: ocrText.value } })
}

function goBack() {
  router.push('/')
}

onMounted(async () => {
  await settings.init()
  // 从设置中读取默认 OCR 语言
  const savedOcr = settings.getConfig('_ocr')
  if (savedOcr['defaultLang']) {
    ocrLang.value = savedOcr['defaultLang']
  }
  try {
    base64.value = await getBase64()
    await doOCR()
  } catch (err: any) {
    error.value = err.message || '加载失败'
    loading.value = false
  }
})
</script>

<template>
  <div class="recognize-view">
    <!-- 顶栏 -->
    <div class="recognize-header" data-tauri-drag-region>
      <h2 class="header-title">文字识别</h2>
      <div class="header-actions">
        <button class="header-btn" @click="goBack">
          <i class="ph ph-x"></i>
        </button>
      </div>
    </div>

    <!-- 主体：左右分栏 -->
    <div class="recognize-body">
      <!-- 左：图片预览 -->
      <div class="image-panel">
        <div class="panel-label">截图预览</div>
        <div class="image-area">
          <img
            v-if="base64"
            :src="'data:image/png;base64,' + base64"
            class="preview-img"
            draggable="false"
          />
          <div v-else class="empty-state">
            <i class="ph ph-image"></i>
            <span>无截图</span>
          </div>
        </div>
      </div>

      <!-- 右：OCR 结果 -->
      <div class="text-panel">
        <div class="panel-label">识别结果</div>
        <div class="text-area">
          <div v-if="loading" class="loading-state">
            <div class="loading-spinner"></div>
            <span>正在识别...</span>
          </div>
          <textarea
            v-else-if="ocrText"
            v-model="ocrText"
            class="ocr-textarea"
            placeholder="OCR 结果"
          ></textarea>
          <div v-else-if="error" class="error-state">
            <i class="ph ph-warning"></i>
            <span>{{ error }}</span>
          </div>
          <div v-else class="empty-state">
            <i class="ph ph-text-aa"></i>
            <span>未识别到文字</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部控制栏 -->
    <div class="recognize-footer">
      <div class="footer-left">
        <select v-model="ocrLang" class="lang-select">
          <option v-for="opt in langOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <button class="footer-btn secondary" @click="doOCR">
          <i class="ph ph-arrow-clockwise"></i> 重新识别
        </button>
      </div>
      <div class="footer-right">
        <button class="footer-btn" @click="copyText" :disabled="!ocrText">
          <i class="ph ph-copy"></i> 复制
        </button>
        <button class="footer-btn primary" @click="sendToTranslate" :disabled="!ocrText">
          <i class="ph ph-translate"></i> 翻译
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recognize-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-page);
  overflow: hidden;
}

.recognize-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  height: 40px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-light);
  -webkit-app-region: drag;
}

.header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  -webkit-app-region: no-drag;
}

.header-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  -webkit-app-region: no-drag;
}

.header-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.recognize-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  min-height: 0;
}

.image-panel,
.text-panel {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.panel-label {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-placeholder);
  border-bottom: 1px solid var(--color-border-light);
}

.image-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  min-height: 0;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

.text-area {
  flex: 1;
  display: flex;
  min-height: 0;
}

.ocr-textarea {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  resize: none;
  outline: none;
  font-family: inherit;
}

.loading-state,
.error-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-sm);
}

.error-state {
  color: #F53F3F;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.recognize-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  height: 44px;
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-light);
}

.footer-left,
.footer-right {
  display: flex;
  gap: 6px;
  align-items: center;
}

.lang-select {
  padding: 4px 8px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--color-border);
  background: var(--color-bg-page);
  font-size: 12px;
  color: var(--color-text);
  outline: none;
  cursor: pointer;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.footer-btn:hover { background: var(--color-bg-hover); }
.footer-btn:disabled { opacity: 0.4; cursor: default; }

.footer-btn.primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.footer-btn.primary:hover { opacity: 0.9; }

.footer-btn.secondary {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
