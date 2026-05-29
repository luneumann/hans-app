<template>
  <span>{{ formatted }}</span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: number | null
  decimals?: number
  duration?: number
}>(), { decimals: 1, duration: 700 })

const display = ref<number | null>(props.value)
let raf = 0
let from = props.value ?? 0
let to = props.value ?? 0
let startTs = 0

function easeOut(t: number) { return 1 - Math.pow(1 - t, 3) }

function animate(now: number) {
  if (!startTs) startTs = now
  const t = Math.min(1, (now - startTs) / props.duration)
  const eased = easeOut(t)
  display.value = from + (to - from) * eased
  if (t < 1) raf = requestAnimationFrame(animate)
}

watch(() => props.value, (v, old) => {
  if (v === null) { display.value = null; return }
  if (old === null || old === undefined) { display.value = v; return }
  cancelAnimationFrame(raf)
  from = display.value ?? old
  to = v
  startTs = 0
  raf = requestAnimationFrame(animate)
})

onUnmounted(() => cancelAnimationFrame(raf))

const formatted = computed(() => {
  if (display.value === null) return '—'
  return props.decimals === 0
    ? Math.round(display.value).toString()
    : display.value.toFixed(props.decimals)
})
</script>
