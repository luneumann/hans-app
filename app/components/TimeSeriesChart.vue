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
  TimeScale,
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, TimeScale)

interface Reading {
  recorded_at: string
  value: number
  sparrow_id: string
}

const props = defineProps<{
  metric: string
  readings: Reading[]
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
  // Collect all unique timestamps sorted
  const allTimes = [...new Set(props.readings.map(r => r.recorded_at))].sort()
  const labels = allTimes.map(t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

  const datasets = sparrows.map((sparrow_id, i) => {
    const byTime = new Map(bySparrow.get(sparrow_id)!.map(r => [r.recorded_at, r.value]))
    return {
      label: sparrow_id,
      data: allTimes.map(t => byTime.get(t) ?? null),
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length] + '22',
      tension: 0.3,
      spanGaps: true,
      pointRadius: 2,
    }
  })

  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' as const },
    title: { display: false },
  },
  scales: {
    x: { ticks: { maxTicksLimit: 10 } },
    y: { beginAtZero: false },
  },
}
</script>

<template>
  <div class="h-64">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>
