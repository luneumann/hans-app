<template>
  <svg
    ref="svgEl"
    class="hans-chart-svg"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    :style="{ height: height + 'px', width: '100%' }"
  >
    <!-- Y grid -->
    <g v-for="(v, i) in gridY" :key="i">
      <line
        :x1="padL" :x2="W - padR"
        :y1="yFor(v)" :y2="yFor(v)"
        stroke="var(--line)"
        stroke-width="1"
        :stroke-dasharray="i === 0 ? '0' : '2 4'"
        :opacity="i === 0 ? 0.7 : 0.45"
      />
      <text
        :x="padL - 8" :y="yFor(v) + 3"
        text-anchor="end" font-size="10.5"
        fill="var(--ink-3)"
        class="hans-chart-text"
      >{{ decimals === 0 ? Math.round(v) : v.toFixed(decimals) }}</text>
    </g>

    <!-- X labels -->
    <text
      v-for="(lab, i) in xLabels" :key="lab"
      :x="padL + (i / (xLabels.length - 1)) * (W - padL - padR)"
      :y="H - 6"
      text-anchor="middle" font-size="10.5"
      fill="var(--ink-4)"
      class="hans-chart-text"
    >{{ lab }}</text>

    <!-- Lines -->
    <g v-for="(pts, id) in series" :key="id">
      <polyline
        :points="pts.map((v, i) => `${xFor(i, pts.length)},${yFor(v)}`).join(' ')"
        fill="none"
        :stroke="lineColors[id] || defaultColor"
        stroke-width="1.7"
        stroke-linejoin="round"
        stroke-linecap="round"
        opacity="0.95"
      />
      <circle
        :cx="xFor(pts.length - 1, pts.length)"
        :cy="yFor(pts[pts.length - 1])"
        r="2.5"
        :fill="lineColors[id] || defaultColor"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
const props = defineProps<{
  series: Record<string, number[]>
  lineColors: Record<string, string>
  defaultColor?: string
  decimals?: number
  range?: string
  height?: number
}>()

const svgEl = ref<SVGSVGElement | null>(null)
const W = ref(720)
const H = computed(() => props.height ?? 200)

onMounted(() => {
  const ro = new ResizeObserver(entries => {
    const w = entries[0]?.contentRect.width
    if (w && w > 0) W.value = w
  })
  if (svgEl.value) ro.observe(svgEl.value)
  onUnmounted(() => ro.disconnect())
})
const padL = 36, padR = 12, padT = 12, padB = 24

const allValues = computed(() => Object.values(props.series).flat())
const minVal = computed(() => {
  const mn = Math.min(...allValues.value)
  const mx = Math.max(...allValues.value)
  const span = (mx - mn) || 1
  return mn - span * 0.08
})
const maxVal = computed(() => {
  const mn = Math.min(...allValues.value)
  const mx = Math.max(...allValues.value)
  const span = (mx - mn) || 1
  return mx + span * 0.08
})

function xFor(i: number, len: number) {
  return padL + (i / (len - 1)) * (W.value - padL - padR)
}
function yFor(v: number) {
  return padT + (1 - (v - minVal.value) / (maxVal.value - minVal.value)) * (H.value - padT - padB)
}

const gridY = computed(() => {
  const ticks = 4
  return Array.from({ length: ticks + 1 }, (_, i) => minVal.value + (i / ticks) * (maxVal.value - minVal.value))
})

const xLabels = computed(() => {
  const now = new Date()
  const hm  = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const day = (d: Date) => d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
  const sub = (h: number) => new Date(now.getTime() - h * 3_600_000)
  const subD = (d: number) => new Date(now.getTime() - d * 86_400_000)

  return ({
    '1h':  [hm(sub(1)),  hm(sub(0.75)), hm(sub(0.5)), hm(sub(0.25)), hm(now)],
    '6h':  [hm(sub(6)),  hm(sub(4)),    hm(sub(2)),   hm(now)],
    '24h': [hm(sub(24)), hm(sub(18)),   hm(sub(12)),  hm(sub(6)),    hm(now)],
    '7d':  [day(subD(7)), day(subD(5)), day(subD(3)), day(subD(1)),  day(now)],
  } as Record<string, string[]>)[props.range ?? '24h'] ?? [hm(sub(24)), hm(sub(18)), hm(sub(12)), hm(sub(6)), hm(now)]
})
</script>
