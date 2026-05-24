<script setup lang="ts">
interface SensorReading {
  id: string
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

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

const { data: rows, error, refresh, status } = await useAsyncData(
  'sensor_readings',
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('id, sparrow_id, metric, value, recorded_at')
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
  const result: Record<string, { value: number; unit: string }> = {}
  for (const [metric, readings] of byMetric.value) {
    const latest = readings.reduce((a, b) => a.recorded_at > b.recorded_at ? a : b)
    result[metric] = { value: latest.value, unit: metaFor(metric).unit }
  }
  return result
})

const sparrows = computed(() => [...new Set((rows.value ?? []).map(r => r.sparrow_id))].sort())

const lastRefreshed = ref(new Date())
async function handleRefresh() {
  await refresh()
  lastRefreshed.value = new Date()
}

function metaFor(metric: string): { icon: string; unit: string; label: string } {
  const map: Record<string, { icon: string; unit: string; label: string }> = {
    temperature: { icon: 'i-heroicons-fire', unit: '°C', label: 'Temperatur' },
    humidity:    { icon: 'i-heroicons-cloud', unit: '%', label: 'Luftfeuchtigkeit' },
    pressure:    { icon: 'i-heroicons-arrow-trending-up', unit: 'hPa', label: 'Luftdruck' },
    co2:         { icon: 'i-heroicons-beaker', unit: 'ppm', label: 'CO₂' },
    gas:         { icon: 'i-heroicons-beaker', unit: 'Ω', label: 'Gas' },
  }
  return map[metric] ?? { icon: 'i-heroicons-signal', unit: '', label: metric }
}
</script>

<template>
  <div>
    <!-- Hero Banner -->
    <div
      class="relative h-44 bg-gradient-to-br from-blue-600 to-indigo-700 overflow-hidden"
    >
      <div class="absolute inset-0 bg-black/20" />
      <div class="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-end pb-5">
        <h1 class="text-2xl font-semibold text-white tracking-tight">HANS</h1>
        <p class="text-sm text-blue-100 mt-0.5">
          <span v-if="status === 'pending'">Lade…</span>
          <span v-else-if="status === 'success'">
            {{ sparrows.length }} Sparrow{{ sparrows.length !== 1 ? 's' : '' }} ·
            aktualisiert {{ lastRefreshed.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) }}
          </span>
        </p>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-4 py-6 space-y-8">

      <!-- Error -->
      <UAlert
        v-if="error"
        color="error"
        icon="i-heroicons-exclamation-triangle"
        :description="error.message"
        title="Fehler beim Laden"
      />

      <!-- Empty -->
      <div
        v-else-if="status === 'success' && metrics.length === 0"
        class="text-center py-24 text-gray-400"
      >
        <UIcon name="i-heroicons-signal-slash" class="w-10 h-10 mx-auto mb-3" />
        <p class="text-base">Keine Messwerte im gewählten Zeitraum.</p>
        <p class="text-sm mt-1">Sobald Sparrows senden, erscheinen hier die Daten.</p>
      </div>

      <template v-else>

        <!-- Stat Cards -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Aktuell</h2>
          </div>
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
                    {{ latestPerMetric[metric]?.value != null
                        ? Number(latestPerMetric[metric].value).toFixed(1)
                        : '—' }}
                    <span class="text-sm font-sans font-normal text-gray-400">{{ metaFor(metric).unit }}</span>
                  </p>
                </div>
                <UIcon :name="metaFor(metric).icon" class="w-5 h-5 text-blue-400 mt-0.5" />
              </div>
            </UCard>
          </div>
        </div>

        <!-- Charts -->
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

          <UCard
            v-for="metric in metrics"
            :key="metric"
            class="bg-white shadow-sm"
          >
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon :name="metaFor(metric).icon" class="w-4 h-4 text-blue-400" />
                <span class="font-medium text-gray-800">{{ metaFor(metric).label }}</span>
                <span class="text-xs text-gray-400">{{ metaFor(metric).unit }}</span>
              </div>
            </template>
            <TimeSeriesChart :metric="metric" :readings="byMetric.get(metric) ?? []" />
          </UCard>
        </div>

        <!-- Sparrow Links -->
        <div v-if="sparrows.length" class="space-y-2">
          <h2 class="text-xs font-semibold uppercase tracking-widest text-gray-400">Sparrows</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <NuxtLink
              v-for="sparrow in sparrows"
              :key="sparrow"
              :to="`/sensors/${sparrow}`"
              class="block"
            >
              <UCard class="bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-green-400" />
                    <span class="font-medium text-gray-800 text-sm">{{ sparrow }}</span>
                  </div>
                  <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-300" />
                </div>
              </UCard>
            </NuxtLink>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>
