<template>
  <div class="hans-metric" :style="{ '--accent': metric.color }">
    <div class="hans-metric-head">
      <div class="hans-metric-name">
        <div class="hans-metric-icon">
          <component :is="icons[metric.icon]"/>
        </div>
        <span>{{ metric.name }}</span>
      </div>
      <div :class="['hans-metric-trend', trendUp ? 'up' : 'down']">
        <component :is="trendUp ? icons.up : icons.down"/>
        {{ trendStr }}{{ metric.unit }}
      </div>
    </div>

    <div class="hans-metric-value">
      <AnimatedNumber :value="value" :decimals="metric.decimals"/>
      <span class="unit">{{ metric.unit }}</span>
    </div>

    <div v-if="yesterdayValue !== null && yesterdayValue !== undefined" class="hans-metric-y">
      <span class="lbl">vs yesterday</span>
      <span class="hans-mono">{{ formatVal(yesterdayValue) }}{{ metric.unit }}</span>
      <span :class="['delta', deltaClass]">
        <component :is="deltaIcon"/>
        {{ deltaStr }}{{ metric.unit }}
      </span>
    </div>

    <div class="hans-metric-foot">
      <span>{{ label }}</span>
      <span>{{ rangeLabel }}</span>
    </div>

    <HansSparkline :data="sparkData" :color="metric.color" :height="36"/>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'

const icons = {
  thermo: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M14 14V5a2 2 0 0 0-4 0v9a4 4 0 1 0 4 0z' }),
    h('line', { x1: '12', y1: '9', x2: '12', y2: '15' }),
  ]),
  drop: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z' }),
  ]),
  pres: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '12', cy: '12', r: '9' }),
    h('path', { d: 'M12 12l4-3' }),
    h('circle', { cx: '12', cy: '12', r: '1.2', fill: 'currentColor' }),
  ]),
  leaf: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M5 19c0-8 7-14 14-14 0 7-6 14-14 14z' }),
    h('path', { d: 'M5 19c4-4 8-6 12-7' }),
  ]),
  up: () => h('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M3 8l3-3 3 3' }),
  ]),
  down: () => h('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M3 4l3 3 3-3' }),
  ]),
  flat: () => h('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round' }, [
    h('path', { d: 'M3 6h6' }),
  ]),
}

const props = defineProps<{
  metric: { id: string; name: string; unit: string; color: string; icon: string; decimals: number }
  value: number
  trend: number
  sparkData: number[]
  label?: string
  rangeLabel?: string
  yesterdayValue?: number | null
}>()

const trendUp = computed(() => props.trend >= 0)
const trendAbs = computed(() => Math.abs(props.trend))
const trendStr = computed(() =>
  props.metric.decimals === 0 ? Math.round(trendAbs.value).toString() : trendAbs.value.toFixed(1)
)

function formatVal(v: number) {
  return props.metric.decimals === 0 ? Math.round(v).toString() : v.toFixed(props.metric.decimals)
}

const yesterdayDelta = computed(() => {
  if (props.yesterdayValue === null || props.yesterdayValue === undefined) return 0
  return props.value - props.yesterdayValue
})
const deltaClass = computed(() => {
  const epsilon = props.metric.decimals === 0 ? 0.5 : 0.1
  if (yesterdayDelta.value > epsilon) return 'up'
  if (yesterdayDelta.value < -epsilon) return 'down'
  return 'flat'
})
const deltaIcon = computed(() => {
  if (deltaClass.value === 'up') return icons.up
  if (deltaClass.value === 'down') return icons.down
  return icons.flat
})
const deltaStr = computed(() => {
  const d = yesterdayDelta.value
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±'
  const v = Math.abs(d)
  return `${sign}${props.metric.decimals === 0 ? Math.round(v) : v.toFixed(1)}`
})
</script>
