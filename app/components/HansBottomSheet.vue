<template>
  <Teleport to="body">
    <Transition name="hans-sheet">
      <div
        v-if="modelValue"
        class="hans-sheet-root"
        @click.self="close"
      >
        <div class="hans-sheet-backdrop" @click="close"></div>
        <div
          class="hans-sheet"
          role="dialog"
          aria-modal="true"
          :style="{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? 'none' : undefined }"
        >
          <div
            class="hans-sheet-handle"
            @pointerdown="onDragStart"
          >
            <span></span>
          </div>
          <div ref="bodyEl" class="hans-sheet-body">
            <slot/>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const bodyEl = ref<HTMLElement | null>(null)
const dragY = ref(0)
const dragging = ref(false)
let startY = 0

function close() {
  emit('update:modelValue', false)
}

function onDragStart(e: PointerEvent) {
  dragging.value = true
  startY = e.clientY
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
}
function onDragMove(e: PointerEvent) {
  const dy = e.clientY - startY
  dragY.value = Math.max(0, dy) // only allow dragging down
}
function onDragEnd() {
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  // Past ~120px of downward drag → dismiss, otherwise snap back.
  if (dragY.value > 120) close()
  dragY.value = 0
}

// Lock body scroll while open; reset drag offset on each open.
watch(() => props.modelValue, (open) => {
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
  if (open) dragY.value = 0
})

// Close on Escape for keyboard/desktop fallback.
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<style>
.hans-sheet-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.hans-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 10, 18, 0.55);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}
.hans-sheet {
  position: relative;
  width: 100%;
  max-width: 640px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border-soft);
  border-bottom: 0;
  border-top-left-radius: 22px;
  border-top-right-radius: 22px;
  box-shadow: 0 -10px 44px rgba(0, 0, 0, 0.5);
  padding-bottom: env(safe-area-inset-bottom);
  will-change: transform;
}
.hans-sheet-handle {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 12px 0 6px;
  cursor: grab;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
.hans-sheet-handle span {
  display: block;
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--ink-4);
  opacity: 0.6;
}
.hans-sheet-body {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 6px 22px 26px;
}

/* enter/leave: fade backdrop (root opacity) + slide sheet up */
.hans-sheet-enter-active,
.hans-sheet-leave-active { transition: opacity 0.25s ease; }
.hans-sheet-enter-active .hans-sheet,
.hans-sheet-leave-active .hans-sheet { transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1); }
.hans-sheet-enter-from,
.hans-sheet-leave-to { opacity: 0; }
.hans-sheet-enter-from .hans-sheet,
.hans-sheet-leave-to .hans-sheet { transform: translateY(100%); }
</style>
