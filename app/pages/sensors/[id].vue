<script setup lang="ts">
interface SensorReading {
  id: string
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

const route = useRoute()
const sparrowId = route.params.id as string
const supabase = useSupabaseClient()

const ranges = [
  { label: '1h', hours: 1 },
  { label: '6h', hours: 6 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
]
const selectedRange = ref(ranges[2])

const since = computed(() =>
  new Date(Date.now() - selectedRange.value.hours * 60 * 60 * 1000).toISOString()
)

const { data: rows, error, status } = await useAsyncData(
  `sparrow_${sparrowId}`,
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('id, sparrow_id, metric, value, recorded_at')
      .eq('sparrow_id', sparrowId)
      .gte('recorded_at', since.value)
      .order('recorded_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as SensorReading[]
  },
  { watch: [since] }
)

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

const latestPerMetric = computed(() => {
  const result: Record<string, number> = {}
  for (const [metric, readings] of byMetric.value) {
    const latest = readings.reduce((a, b) => a.recorded_at > b.recorded_at ? a : b)
    result[metric] = latest.value
  }
  return result
})

function metaFor(metric: string): { icon: string; unit: string; label: string; color: string } {
  const map: Record<string, { icon: string; unit: string; label: string; color: string }> = {
    temperature: { icon: 'i-heroicons-fire', unit: '°C', label: 'Temperatur', color: 'text-orange-500' },
    humidity:    { icon: 'i-heroicons-cloud', unit: '%', label: 'Luftfeuchtigkeit', color: 'text-blue-500' },
    pressure:    { icon: 'i-heroicons-arrow-trending-up', unit: 'hPa', label: 'Luftdruck', color: 'text-indigo-500' },
    co2:         { icon: 'i-heroicons-beaker', unit: 'ppm', label: 'CO₂', color: 'text-green-600' },
    gas:         { icon: 'i-heroicons-beaker', unit: 'Ω', label: 'Gas', color: 'text-amber-500' },
  }
  return map[metric] ?? { icon: 'i-heroicons-signal', unit: '', label: metric, color: 'text-gray-400' }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-6 space-y-6">

    <!-- Back + Title -->
    <div class="flex items-center gap-3">
      <UButton
        to="/"
        icon="i-heroicons-arrow-left"
        variant="ghost"
        color="neutral"
        size="sm"
      />
      <div>
        <h1 class="text-xl font-semibold text-gray-900">{{ sparrowId }}</h1>
        <div class="flex items-center gap-1.5 mt-0.5">
          <div
            :class="status === 'success' ? 'bg-green-400' : 'bg-gray-300'"
            class="w-1.5 h-1.5 rounded-full"
          />
          <span class="text-xs text-gray-400">{{ status === 'pending' ? 'Lade…' : 'online' }}</span>
        </div>
      </div>
    </div>

    <!-- Error -->
    <UAlert
      v-if="error"
      color="error"
      icon="i-heroicons-exclamation-triangle"
      :description="error.message"
      title="Fehler"
    />

    <!-- Empty -->
    <div
      v-else-if="status === 'success' && metrics.length === 0"
      class="text-center py-24 text-gray-400"
    >
      <UIcon name="i-heroicons-signal-slash" class="w-10 h-10 mx-auto mb-3" />
      <p>Keine Daten für diesen Sparrow im gewählten Zeitraum.</p>
    </div>

    <template v-else>

      <!-- Metric Tiles -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UCard
          v-for="metric in metrics"
          :key="metric"
          class="bg-white shadow-sm"
        >
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <p class="text-xs text-gray-400 uppercase tracking-wide">{{ metaFor(metric).label }}</p>
              <p class="text-2xl font-mono font-semibold text-gray-900">
                {{ latestPerMetric[metric] != null ? Number(latestPerMetric[metric]).toFixed(1) : '—' }}
                <span class="text-sm font-sans font-normal text-gray-400">{{ metaFor(metric).unit }}</span>
              </p>
            </div>
            <UIcon :name="metaFor(metric).icon" :class="['w-5 h-5 mt-0.5', metaFor(metric).color]" />
          </div>
        </UCard>
      </div>

      <!-- Range Picker + Charts -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Verlauf</h2>
          <div class="flex gap-1">
            <UButton
              v-for="r in ranges"
              :key="r.label"
              size="xs"
              :variant="selectedRange.label === r.label ? 'solid' : 'ghost'"
              :color="selectedRange.label === r.label ? 'primary' : 'neutral'"
              @click="selectedRange = r"
            >
              {{ r.label }}
            </UButton>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <UCard
            v-for="metric in metrics"
            :key="metric"
            class="bg-white shadow-sm"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon :name="metaFor(metric).icon" :class="['w-4 h-4', metaFor(metric).color]" />
                <span class="font-medium text-gray-800 text-sm">{{ metaFor(metric).label }}</span>
                <span class="text-xs text-gray-400">{{ metaFor(metric).unit }}</span>
              </div>
            </template>
            <TimeSeriesChart
              :metric="metric"
              :readings="byMetric.get(metric) ?? []"
              :single-sparrow="true"
            />
          </UCard>
        </div>
      </div>

    </template>
  </div>
</template>
