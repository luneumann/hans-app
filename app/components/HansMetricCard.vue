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
      <span>{{ formattedValue }}</span>
      <span class="unit">{{ metric.unit }}</span>
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
}

const props = defineProps<{
  metric: { id: string; name: string; unit: string; color: string; icon: string; decimals: number }
  value: number
  trend: number
  sparkData: number[]
  label?: string
  rangeLabel?: string
}>()

const trendUp = computed(() => props.trend >= 0)
const trendAbs = computed(() => Math.abs(props.trend))
const trendStr = computed(() =>
  props.metric.decimals === 0 ? Math.round(trendAbs.value).toString() : trendAbs.value.toFixed(1)
)
const formattedValue = computed(() =>
  props.metric.decimals === 0 ? Math.round(props.value).toString() : props.value.toFixed(props.metric.decimals)
)
</script>
