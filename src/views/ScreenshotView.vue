<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { convertFileSrc } from '@tauri-apps/api/core'
import { takeScreenshot, cutImage } from '../services/ocr'

const router = useRouter()

const imgUrl = ref('')
const isDown = ref(false)
const isMoved = ref(false)
const startX = ref(0)
const startY = ref(0)
const endX = ref(0)
const endY = ref(0)
const imgRef = ref<HTMLImageElement | null>(null)

// Selection rectangle style
const selectionStyle = ref<Record<string, string>>({})

function updateSelection() {
  const left = Math.min(startX.value, endX.value)
  const top = Math.min(startY.value, endY.value)
  const width = Math.abs(endX.value - startX.value)
  const height = Math.abs(endY.value - startY.value)
  selectionStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    isDown.value = true
    startX.value = e.clientX
    startY.value = e.clientY
    endX.value = e.clientX
    endY.value = e.clientY
  } else {
    // Right click → cancel
    router.push('/')
  }
}

function onMouseMove(e: MouseEvent) {
  if (isDown.value) {
    isMoved.value = true
    endX.value = e.clientX
    endY.value = e.clientY
    updateSelection()
  }
}

async function onMouseUp(e: MouseEvent) {
  if (!isDown.value) return
  isDown.value = false

  const img = imgRef.value
  if (!img) return

  // Calculate DPI scaling
  const dpi = img.naturalWidth / window.screen.width

  const left = Math.floor(Math.min(startX.value, e.clientX) * dpi)
  const top = Math.floor(Math.min(startY.value, e.clientY) * dpi)
  const right = Math.floor(Math.max(startX.value, e.clientX) * dpi)
  const bottom = Math.floor(Math.max(startY.value, e.clientY) * dpi)
  const width = right - left
  const height = bottom - top

  if (width <= 5 || height <= 5) {
    // Too small, cancel
    router.push('/')
    return
  }

  try {
    await cutImage(left, top, width, height)
    // Navigate to recognize view
    router.push('/recognize')
  } catch (err) {
    console.error('Cut image failed:', err)
    router.push('/')
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    router.push('/')
  }
}

onMounted(async () => {
  try {
    const path = await takeScreenshot()
    imgUrl.value = convertFileSrc(path)
  } catch (err) {
    console.error('Screenshot failed:', err)
    router.push('/')
  }
  window.addEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div class="screenshot-view">
    <!-- Background: full screen screenshot -->
    <img
      ref="imgRef"
      class="screenshot-bg"
      :src="imgUrl"
      draggable="false"
      @load="() => {}"
    />

    <!-- Selection rectangle -->
    <div
      v-if="isMoved"
      class="selection-rect"
      :style="selectionStyle"
    ></div>

    <!-- Interaction overlay -->
    <div
      class="interaction-layer"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
    ></div>
  </div>
</template>

<style scoped>
.screenshot-view {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #000;
}

.screenshot-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
  pointer-events: none;
}

.selection-rect {
  position: fixed;
  border: 2px solid #4f6ef7;
  background: rgba(79, 110, 247, 0.12);
  pointer-events: none;
  z-index: 10;
}

.interaction-layer {
  position: fixed;
  inset: 0;
  cursor: crosshair;
  z-index: 5;
  user-select: none;
}
</style>
