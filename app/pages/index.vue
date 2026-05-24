<script setup lang="ts">
interface SensorReading {
  id: string
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

const supabase = useSupabaseClient()

// Last 24 hours of readings
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

const { data: rows, error, refresh, status } = await useAsyncData('sensor_readings', async () => {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('id, sparrow_id, metric, value, recorded_at')
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SensorReading[]
})

// Group readings by metric
const byMetric = computed(() => {
  const map = new Map<string, SensorReading[]>()
  for (const r of rows.value ?? []) {
    const arr = map.get(r.metric) ?? []
    arr.push(r)
    map.set(r.metric, arr)
  }
  return map
})

const metrics = computed(() => [...byMetric.value.keys()].sort())

// Latest value per sparrow per metric for stat cards
const latestBySparrow = computed(() => {
  const result: Record<string, Record<string, { value: number; recorded_at: string }>> = {}
  for (const [metric, readings] of byMetric.value) {
    const perSparrow: Record<string, { value: number; recorded_at: string }> = {}
    for (const r of readings) {
      if (!perSparrow[r.sparrow_id] || r.recorded_at > perSparrow[r.sparrow_id]!.recorded_at) {
        perSparrow[r.sparrow_id] = { value: r.value, recorded_at: r.recorded_at }
      }
    }
    result[metric] = perSparrow
  }
  return result
})

const sparrows = computed(() => [...new Set((rows.value ?? []).map(r => r.sparrow_id))].sort())

const lastRefreshed = ref(new Date())
async function handleRefresh() {
  await refresh()
  lastRefreshed.value = new Date()
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <div class="max-w-7xl mx-auto px-4 py-8 space-y-8">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">HANS Dashboard</h1>
          <p class="text-sm text-gray-400 mt-0.5">
            Last 24 hours ·
            <span v-if="status === 'success'">updated {{ lastRefreshed.toLocaleTimeString() }}</span>
            <span v-else-if="status === 'pending'">loading…</span>
          </p>
        </div>
        <UButton
          icon="i-heroicons-arrow-path"
          variant="outline"
          color="neutral"
          :loading="status === 'pending'"
          @click="handleRefresh"
        >
          Refresh
        </UButton>
      </div>

      <!-- Error state -->
      <UAlert
        v-if="error"
        color="error"
        icon="i-heroicons-exclamation-triangle"
        :description="error.message"
        title="Failed to load sensor data"
      />

      <!-- Empty state -->
      <div
        v-else-if="status === 'success' && metrics.length === 0"
        class="text-center py-24 text-gray-500"
      >
        <p class="text-lg">No sensor readings in the last 24 hours.</p>
        <p class="text-sm mt-1">Data will appear here once your Sparrows start reporting.</p>
      </div>

      <template v-else>
        <!-- Stat cards: latest value per sparrow -->
        <div v-if="sparrows.length" class="space-y-2">
          <h2 class="text-xs font-medium uppercase tracking-widest text-gray-500">Latest readings</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <template v-for="metric in metrics" :key="metric">
              <UCard
                v-for="sparrow in sparrows"
                :key="`${metric}-${sparrow}`"
                class="bg-gray-900 border-gray-800"
              >
                <div class="space-y-1">
                  <p class="text-[11px] uppercase tracking-widest text-gray-500 truncate">{{ metric }}</p>
                  <p class="text-xs text-gray-400 truncate">{{ sparrow }}</p>
                  <p class="text-xl font-mono font-semibold">
                    {{ latestBySparrow[metric]?.[sparrow]?.value ?? '—' }}
                  </p>
                </div>
              </UCard>
            </template>
          </div>
        </div>

        <!-- Time-series charts per metric -->
        <div class="space-y-6">
          <h2 class="text-xs font-medium uppercase tracking-widest text-gray-500">Time series</h2>
          <UCard
            v-for="metric in metrics"
            :key="metric"
            class="bg-gray-900 border-gray-800"
          >
            <template #header>
              <span class="font-medium capitalize">{{ metric }}</span>
            </template>
            <TimeSeriesChart :metric="metric" :readings="byMetric.get(metric) ?? []" />
          </UCard>
        </div>
      </template>

    </div>
  </div>
</template>
