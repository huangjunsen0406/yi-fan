<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getHistory,
  getHistoryCount,
  searchHistory,
  deleteHistory,
  clearHistory,
  exportHistory,
  type HistoryRecord,
} from '../services/history'
import { useTranslateStore } from '../stores/translate'

const router = useRouter()
const store = useTranslateStore()

const records = ref<HistoryRecord[]>([])
const searchKeyword = ref('')
const loading = ref(true)
const showClearConfirm = ref(false)

// ── 分页 ──
const pageSize = 10
const currentPage = ref(1)
const totalCount = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
const isSearching = ref(false)

onMounted(async () => {
  await loadRecords()
})

async function loadRecords() {
  loading.value = true
  try {
    totalCount.value = await getHistoryCount()
    const offset = (currentPage.value - 1) * pageSize
    records.value = await getHistory(pageSize, offset)
    isSearching.value = false
  } catch (e) {
    console.warn('Load history failed:', e)
  } finally {
    loading.value = false
  }
}

async function doSearch() {
  loading.value = true
  try {
    if (searchKeyword.value.trim()) {
      records.value = await searchHistory(searchKeyword.value)
      isSearching.value = true
    } else {
      currentPage.value = 1
      await loadRecords()
    }
  } catch (e) {
    console.warn('Search failed:', e)
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  loadRecords()
}

async function handleDelete(id: number) {
  await deleteHistory(id)
  records.value = records.value.filter(r => r.id !== id)
  totalCount.value = Math.max(0, totalCount.value - 1)
  // 当前页空了且不是第一页，回到前一页
  if (records.value.length === 0 && currentPage.value > 1) {
    currentPage.value--
    await loadRecords()
  }
}

async function handleClearAll() {
  await clearHistory()
  records.value = []
  totalCount.value = 0
  currentPage.value = 1
  showClearConfirm.value = false
}

async function handleExport() {
  try {
    const json = await exportHistory()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `yi-fan-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.warn('Export failed:', e)
  }
}

function copyText(text: string) {
  store.copyToClipboard(text)
}

function useAsInput(text: string) {
  router.push({ path: '/', query: { text } })
}

function goBack() {
  router.push('/')
}
</script>


<template>
  <div class="history-view">
    <!-- Header -->
    <div class="history-header" data-tauri-drag-region>
      <h2 class="header-title">翻译历史</h2>
      <div class="header-actions">
        <button class="header-btn" @click="goBack">
          <i class="ph ph-x"></i>
        </button>
      </div>
    </div>

    <!-- Search & Actions -->
    <div class="history-toolbar">
      <div class="search-box">
        <i class="ph ph-magnifying-glass"></i>
        <input
          v-model="searchKeyword"
          class="search-input"
          placeholder="搜索历史记录..."
          @input="doSearch"
        />
        <button v-if="searchKeyword" class="clear-search" @click="searchKeyword = ''; doSearch()">
          <i class="ph ph-x"></i>
        </button>
      </div>
      <div class="toolbar-btns">
        <button class="toolbar-btn" @click="handleExport" :disabled="records.length === 0">
          <i class="ph ph-download-simple"></i> 导出
        </button>
        <button class="toolbar-btn danger" @click="showClearConfirm = true" :disabled="records.length === 0">
          <i class="ph ph-trash"></i> 清空
        </button>
      </div>
    </div>

    <!-- Clear confirmation -->
    <div v-if="showClearConfirm" class="confirm-bar">
      <span>确定清空所有历史记录？</span>
      <button class="confirm-yes" @click="handleClearAll">确定</button>
      <button class="confirm-no" @click="showClearConfirm = false">取消</button>
    </div>

    <!-- Records -->
    <div class="history-list" v-if="!loading">
      <div v-if="records.length === 0" class="empty-state">
        <i class="ph ph-clock-counter-clockwise"></i>
        <span>暂无历史记录</span>
      </div>
      <div v-for="record in records" :key="record.id" class="history-card">
        <div class="card-meta">
          <span class="meta-engine">{{ record.engine }}</span>
          <span class="meta-langs">{{ record.source_lang }} → {{ record.target_lang }}</span>
          <span class="meta-time">{{ record.created_at }}</span>
        </div>
        <div class="card-body">
          <div class="card-source">{{ record.source_text }}</div>
          <div class="card-arrow"><i class="ph ph-arrow-right"></i></div>
          <div class="card-result">{{ record.result_text }}</div>
        </div>
        <div class="card-actions">
          <button class="card-btn" @click="copyText(record.result_text)" title="复制译文">
            <i class="ph ph-copy"></i>
          </button>
          <button class="card-btn" @click="useAsInput(record.source_text)" title="重新翻译">
            <i class="ph ph-arrow-bend-up-left"></i>
          </button>
          <button class="card-btn delete" @click="handleDelete(record.id!)" title="删除">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- 分页（固定底部） -->
    <div v-if="!isSearching && totalCount > pageSize" class="pagination-bar">
      <a-pagination
        :total="totalCount"
        :current="currentPage"
        :page-size="pageSize"
        size="small"
        :show-total="true"
        @change="goToPage"
      />
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>
  </div>

</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-page);
  overflow: hidden;
}

.history-header {
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

/* Toolbar */
.history-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  flex-shrink: 0;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  transition: border-color 0.2s;
}

.search-box:focus-within {
  border-color: var(--color-primary);
}

.search-box i {
  color: var(--color-text-placeholder);
  font-size: 16px;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 13px;
  color: var(--color-text);
  outline: none;
}

.clear-search {
  background: none;
  border: none;
  color: var(--color-text-placeholder);
  cursor: pointer;
  font-size: 14px;
  padding: 2px;
}

.toolbar-btns {
  display: flex;
  gap: 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover { background: var(--color-bg-hover); }
.toolbar-btn:disabled { opacity: 0.4; cursor: default; }
.toolbar-btn.danger { color: #F53F3F; border-color: #F53F3F33; }
.toolbar-btn.danger:hover { background: #F53F3F11; }

/* Confirm bar */
.confirm-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #FFF7E8;
  border-bottom: 1px solid #FFCF8B;
  font-size: 13px;
  color: #D46B08;
}

.confirm-yes, .confirm-no {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  border: 1px solid;
}

.confirm-yes { background: #F53F3F; color: #fff; border-color: #F53F3F; }
.confirm-no { background: #fff; color: var(--color-text); border-color: var(--color-border); }

/* List */
.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
}

.empty-state, .loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 60px 0;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-sm);
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

.empty-state i {
  font-size: 40px;
  opacity: 0.3;
}

/* Card */
.history-card {
  padding: 12px;
  margin-bottom: 8px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  transition: border-color 0.2s;
}

.history-card:hover {
  border-color: var(--color-primary-border);
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.meta-engine {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  padding: 1px 6px;
  border-radius: var(--radius-sm);
}

.meta-langs {
  font-size: 11px;
  color: var(--color-text-placeholder);
}

.meta-time {
  font-size: 11px;
  color: var(--color-text-placeholder);
  margin-left: auto;
}

.card-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.card-source {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  word-break: break-word;
}

.card-arrow {
  flex-shrink: 0;
  color: var(--color-text-placeholder);
  font-size: 14px;
  padding-top: 2px;
}

.card-result {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  font-weight: 500;
  line-height: 1.5;
  word-break: break-word;
}

.card-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  justify-content: flex-end;
}

.card-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 16px;
  transition: all 0.15s;
}

.card-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.card-btn.delete:hover {
  color: #F53F3F;
  background: #F53F3F11;
}

/* Pagination - 固定底部 */
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-page);
}
</style>
