import { ref, onUnmounted } from 'vue'

export const isOnline = ref(
  typeof navigator !== 'undefined' ? navigator.onLine : true
)

let bound = false

function onOnline() {
  isOnline.value = true
}
function onOffline() {
  isOnline.value = false
}

export function bindNetworkListeners() {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  isOnline.value = navigator.onLine
}

export function unbindNetworkListeners() {
  if (!bound || typeof window === 'undefined') return
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  bound = false
}

/** Vue helper for components */
export function useNetworkStatus() {
  bindNetworkListeners()
  onUnmounted(() => {
    /* keep global listener for app lifetime */
  })
  return { isOnline }
}
