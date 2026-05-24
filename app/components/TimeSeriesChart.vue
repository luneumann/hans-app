<script setup lang="ts">
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface Reading {
  recorded_at: string
  value: number
  sparrow_id: string
}

const props = defineProps<{
  metric: string
  readings: Reading[]
  singleSparrow?: boolean
}>()

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
]

const chartData = computed(() => {
  const bySparrow = new Map<string, Reading[]>()
  for (const r of props.readings) {
    const arr = bySparrow.get(r.sparrow_id) ?? []
    arr.push(r)
    bySparrow.set(r.sparrow_id, arr)
  }

  const sparrows = [...bySparrow.keys()].sort()
  const allTimes = [...new Set(props.readings.map(r => r.recorded_at))].sort()
  const labels = allTimes.map(t =>
    new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  )

  const datasets = sparrows.map((sparrow_id, i) => {
    const byTime = new Map(bySparrow.get(sparrow_id)!.map(r => [r.recorded_at, r.value]))
    return {
      label: sparrow_id,
      data: allTimes.map(t => byTime.get(t) ?? null),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '18',
      tension: 0.3,
      spanGaps: true,
      pointRadius: 2,
      borderWidth: 2,
      fill: props.singleSparrow,
    }
  })

  return { labels, datasets }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: !props.singleSparrow,
      labels: { color: '#6b7280', font: { size: 11 } },
    },
    title: { display: false },
    tooltip: { mode: 'index' as const, intersect: false },
  },
  scales: {
    x: {
      ticks: { maxTicksLimit: 8, color: '#9ca3af', font: { size: 11 } },
      grid: { color: '#f3f4f6' },
    },
    y: {
      beginAtZero: false,
      ticks: { color: '#9ca3af', font: { size: 11 } },
      grid: { color: '#f3f4f6' },
    },
  },
}))
</script>

<template>
  <div class="h-52">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
