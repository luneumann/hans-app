<script setup lang="ts">
interface Reading {
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

const METRICS = [
  { id: 'temperature', name: 'Temperature', unit: '°C',  color: 'var(--clay)', icon: 'thermo', decimals: 1 },
  { id: 'humidity',    name: 'Humidity',    unit: '%',   color: 'var(--sky)',  icon: 'drop',   decimals: 0 },
  { id: 'pressure',   name: 'Pressure',    unit: 'hPa', color: 'var(--plum)', icon: 'pres',   decimals: 1 },
]

const SPARROW_IMAGES: Record<string, string> = {
  living:  '/sparrows/living-day.png',
  bedroom: '/sparrows/bedroom.png',
  kitchen: '/sparrows/kitchen.png',
  balcony: '/sparrows/balcony.png',
  study:   '/sparrows/living-night.png',
}
function sparrowImage(id: string) {
  for (const [key, img] of Object.entries(SPARROW_IMAGES)) {
    if (id.toLowerCase().includes(key)) return img
  }
  return '/sparrows/living-day.png'
}

const RANGE_HOURS: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 }
const RANGES = ['1h', '6h', '24h', '7d']
const selectedRange = ref('24h')

const supabase = useSupabaseClient()

const since = computed(() =>
  new Date(Date.now() - RANGE_HOURS[selectedRange.value] * 60 * 60 * 1000).toISOString()
)

const { data: rows, status, refresh } = await useAsyncData<Reading[]>(
  'dashboard_readings',
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .gte('recorded_at', since.value)
      .order('recorded_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as Reading[]
  },
  { watch: [since] }
)

// Derived data
const sparrows = computed(() =>
  [...new Set((rows.value ?? []).map(r => r.sparrow_id))].sort()
)

// Group readings by sparrow → metric → sorted readings
const byGroup = computed(() => {
  const map = new Map<string, Map<string, Reading[]>>()
  for (const r of rows.value ?? []) {
    if (!map.has(r.sparrow_id)) map.set(r.sparrow_id, new Map())
    const sm = map.get(r.sparrow_id)!
    const arr = sm.get(r.metric) ?? []
    arr.push(r)
    sm.set(r.metric, arr)
  }
  return map
})

// Latest value per sparrow per metric
function latestValue(sparrowId: string, metricId: string): number | null {
  const readings = byGroup.value.get(sparrowId)?.get(metricId)
  if (!readings?.length) return null
  return readings[readings.length - 1].value
}

// House average for a metric
function houseAvg(metricId: string): number | null {
  const vals = sparrows.value
    .map(s => latestValue(s, metricId))
    .filter((v): v is number => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

// Evenly-sampled series for sparkline/chart (returns last N values)
function timeSeries(sparrowId: string, metricId: string, points = 60): number[] {
  const readings = byGroup.value.get(sparrowId)?.get(metricId) ?? []
  if (!readings.length) return []
  // Sample evenly
  const step = Math.max(1, Math.floor(readings.length / points))
  const sampled: number[] = []
  for (let i = 0; i < readings.length; i += step) sampled.push(readings[i].value)
  return sampled
}

// Aggregate sparkline (mean across sparrows)
function aggSeries(metricId: string): number[] {
  const series = sparrows.value.map(s => timeSeries(s, metricId))
  const len = Math.max(...series.map(s => s.length), 0)
  if (!len) return []
  return Array.from({ length: len }, (_, i) => {
    const vals = series.map(s => s[Math.round((i / (len - 1)) * (s.length - 1)) || 0]).filter(Boolean)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })
}

// Multi-sparrow series for multi-line charts
function sparrowSeries(metricId: string): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const id of sparrows.value) {
    const s = timeSeries(id, metricId)
    if (s.length) out[id] = s
  }
  return out
}

const SPARROW_COLORS = ['var(--leaf)', 'var(--amber)', 'var(--clay)', 'var(--sky)', 'var(--plum)']
function sparrowColor(idx: number) { return SPARROW_COLORS[idx % SPARROW_COLORS.length] }

// Trend: difference between last 20% and previous 20% of readings
function trend(sparrowId: string, metricId: string): number {
  const readings = byGroup.value.get(sparrowId)?.get(metricId) ?? []
  if (readings.length < 4) return 0
  const chunk = Math.max(2, Math.floor(readings.length * 0.2))
  const recent  = readings.slice(-chunk).reduce((a, r) => a + r.value, 0) / chunk
  const earlier = readings.slice(-chunk * 2, -chunk).reduce((a, r) => a + r.value, 0) / chunk
  return recent - earlier
}
function avgTrend(metricId: string): number {
  const vals = sparrows.value.map(s => trend(s, metricId))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

// Hero text
const heroTemp = computed(() => houseAvg('temperature'))
const heroHum  = computed(() => houseAvg('humidity'))

const now = new Date()
const hour = now.getHours()
const greeting = hour < 6 ? 'Quiet hours' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="hans-page">

    <!-- HERO -->
    <div class="hans-hero">
      <div class="hans-hero-img" style="background-image: url('/sparrows/living-day.png')"></div>
      <div class="hans-hero-content">
        <div>
          <div class="hans-hero-greeting">{{ greeting }} — {{ timeStr }} local</div>
          <h1 class="hans-hero-title">
            <template v-if="heroTemp !== null && heroHum !== null">
              The house feels <em>{{ heroTemp.toFixed(1) }}°</em> and <em>{{ Math.round(heroHum!) }}%</em>.
            </template>
            <template v-else>
              HANS is listening.
            </template>
          </h1>
          <div class="hans-hero-sub">
            <template v-if="sparrows.length">
              {{ sparrows.length }} sparrow{{ sparrows.length !== 1 ? 's' : '' }} reporting in the last {{ selectedRange }}.
            </template>
            <template v-else>
              No sparrows sending data in the selected time range.
            </template>
          </div>
          <div class="hans-hero-tags">
            <span class="hans-chip"><span class="dot" style="background:var(--leaf)"></span>air · monitored</span>
            <span class="hans-chip"><span class="dot" style="background:var(--sky)"></span>humidity · tracked</span>
            <span class="hans-chip hans-mono">{{ sparrows.length }} / {{ sparrows.length }} online</span>
          </div>
        </div>
        <div class="hans-hero-meta">
          <div class="hans-pill hans-mono">{{ new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }}</div>
          <div class="hans-pill hans-mono">data · {{ selectedRange }} window</div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="status === 'success' && !sparrows.length" style="text-align:center;padding:80px 0;color:var(--ink-3)">
      <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:12px">No data</div>
      <div style="font-size:22px;color:var(--ink)">Waiting for sparrows to report.</div>
      <div style="font-size:13px;margin-top:8px">Data will appear here once your Sparrows start sending.</div>
    </div>

    <template v-else>

      <!-- METRICS -->
      <div class="hans-section-head">
        <h2>Current ambient · house average</h2>
        <span class="meta">across {{ sparrows.length }} sparrows</span>
      </div>
      <div class="hans-metrics-row">
        <HansMetricCard
          v-for="m in METRICS"
          :key="m.id"
          :metric="m"
          :value="houseAvg(m.id) ?? 0"
          :trend="avgTrend(m.id)"
          :spark-data="aggSeries(m.id)"
          label="avg · all sparrows"
          :range-label="`last ${selectedRange}`"
        />
      </div>

      <!-- CHARTS -->
      <div class="hans-section-head">
        <h2>Trends · all sparrows</h2>
        <div class="hans-range">
          <button
            v-for="r in RANGES"
            :key="r"
            :class="{ active: selectedRange === r }"
            @click="selectedRange = r"
          >{{ r }}</button>
        </div>
      </div>
      <div class="hans-charts">
        <div v-for="m in METRICS" :key="m.id" class="hans-card hans-chart-card">
          <div class="hans-chart-head">
            <div class="label">
              <span class="dot" :style="{ background: m.color }"></span>
              <span class="name">{{ m.name }}<span class="unit">· {{ m.unit }}</span></span>
            </div>
            <div class="range-mini">
              <span>{{ selectedRange }}</span>
            </div>
          </div>
          <HansLineChart
            :series="sparrowSeries(m.id)"
            :line-colors="Object.fromEntries(sparrows.map((s, i) => [s, sparrowColor(i)]))"
            :default-color="m.color"
            :decimals="m.decimals"
            :range="selectedRange"
            :height="170"
          />
          <div class="hans-legend">
            <div v-for="(s, i) in sparrows" :key="s" class="hans-legend-item">
              <span class="dot" :style="{ background: sparrowColor(i) }"></span>
              {{ s }}
            </div>
          </div>
        </div>
      </div>

      <!-- SPARROWS -->
      <div class="hans-section-head">
        <h2>Sparrows</h2>
        <span class="meta">tap a card for the full nest</span>
      </div>
      <div class="hans-sparrows">
        <NuxtLink
          v-for="(s, i) in sparrows"
          :key="s"
          :to="`/sensors/${s}`"
          style="text-decoration:none"
        >
          <div class="hans-sparrow">
            <div class="thumb" :style="{ backgroundImage: `url(${sparrowImage(s)})` }"></div>
            <div class="body">
              <div class="row1">
                <div class="name">
                  {{ s }}
                  <span class="alias">sparrow-{{ String(i + 1).padStart(2, '0') }}</span>
                </div>
                <div class="sparrow-status">
                  <span class="dot"></span>
                  <span>online</span>
                </div>
              </div>
              <div class="mini-metrics">
                <div v-for="m in METRICS" :key="m.id" class="mm">
                  <span class="k">{{ m.id === 'temperature' ? 'Temp' : m.id === 'humidity' ? 'Hum' : 'Pres' }}</span>
                  <span>
                    {{ latestValue(s, m.id) !== null ? (m.decimals === 0 ? Math.round(latestValue(s, m.id)!) : latestValue(s, m.id)!.toFixed(m.decimals)) : '—' }}<small>{{ m.unit }}</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

    </template>
  </div>
</template>
