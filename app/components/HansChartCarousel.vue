<template>
  <div class="hans-carousel">
    <div ref="scroller" class="hans-charts hans-carousel-track" @scroll="onScroll">
      <slot/>
    </div>
    <div v-if="count > 1" class="hans-carousel-dots" role="tablist">
      <button
        v-for="i in count"
        :key="i"
        type="button"
        :class="{ active: i - 1 === active }"
        :aria-label="`Diagramm ${i} von ${count}`"
        :aria-selected="i - 1 === active"
        @click="goTo(i - 1)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Wraps a set of chart cards. On desktop the inner `.hans-charts` keeps its
 * normal CSS grid. On mobile (≤640px, handled in main.css) the same element
 * becomes a horizontal scroll-snap carousel; this component adds the dot
 * indicators and keeps the active dot in sync with the scroll position.
 */
const props = defineProps<{ count: number }>()

const scroller = ref<HTMLElement | null>(null)
const active = ref(0)
let raf = 0

function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const el = scroller.value
    if (!el) return
    const slide = el.clientWidth || 1
    active.value = Math.round(el.scrollLeft / slide)
  })
}

function goTo(i: number) {
  const el = scroller.value
  if (!el) return
  el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
}

onUnmounted(() => { if (raf) cancelAnimationFrame(raf) })
</script>
