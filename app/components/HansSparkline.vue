<template>
  <svg
    :viewBox="`0 0 280 ${height}`"
    preserveAspectRatio="none"
    width="100%"
    :height="height"
    style="display:block;margin-top:12px"
  >
    <defs>
      <linearGradient :id="gradId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="color" stop-opacity="0.35"/>
        <stop offset="1" :stop-color="color" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path :d="areaPath" :fill="`url(#${gradId})`"/>
    <path :d="linePath" fill="none" :stroke="color" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>
</template>

<script setup lang="ts">
const props = defineProps<{
  data: number[]
  color: string
  height?: number
}>()

const W = 280
const h = computed(() => props.height ?? 36)
const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`

const linePath = computed(() => {
  if (!props.data.length) return ''
  const min = Math.min(...props.data)
  const max = Math.max(...props.data)
  const span = max - min || 1
  return props.data.map((v, i) => {
    const x = (i / (props.data.length - 1)) * W
    const y = h.value - ((v - min) / span) * (h.value - 4) - 2
    return `${i === 0 ? 'M' : 'L'}${x},${y}`
  }).join(' ')
})

const areaPath = computed(() => {
  if (!props.data.length) return ''
  return `${linePath.value} L${W},${h.value} L0,${h.value} Z`
})
</script>
