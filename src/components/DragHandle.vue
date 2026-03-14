<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  drag: [deltaY: number]
}>()

const isDragging = ref(false)
let startY = 0

function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  startY = e.clientY
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent) {
  const deltaY = e.clientY - startY
  startY = e.clientY
  emit('drag', deltaY)
}

function onMouseUp() {
  isDragging.value = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}
</script>

<template>
  <div class="drag-handle" :class="{ dragging: isDragging }" @mousedown.prevent="onMouseDown">
    <div class="drag-dots">
      <span></span><span></span><span></span>
      <span></span><span></span><span></span>
    </div>
  </div>
</template>

<style scoped>
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
  cursor: row-resize;
  flex-shrink: 0;
}

.drag-handle:hover .drag-dots span,
.drag-handle.dragging .drag-dots span {
  background: #86909C;
}

.drag-dots {
  display: grid;
  grid-template-columns: repeat(3, 5px);
  grid-template-rows: repeat(2, 5px);
  gap: 3px;
}

.drag-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #C9CDD4;
  transition: background 0.15s ease;
}
</style>
