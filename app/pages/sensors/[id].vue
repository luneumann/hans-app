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

const route = useRoute()
const sparrowId = computed(() => route.params.id as string)

const RANGE_HOURS: Record<string, number> = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 }
const RANGES = ['1h', '6h', '24h', '7d']
const SAMPLE_INTERVAL: Record<string, string> = { '1h': '60s', '6h': '5m', '24h': '15m', '7d': '1h' }
const selectedRange = ref('24h')

const supabase = useSupabaseClient()

const since = computed(() =>
  new Date(Date.now() - RANGE_HOURS[selectedRange.value] * 60 * 60 * 1000).toISOString()
)

const { data: rows, status } = await useAsyncData<Reading[]>(
  `detail_${sparrowId.value}`,
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .eq('sparrow_id', sparrowId.value)
      .gte('recorded_at', since.value)
      .order('recorded_at', { ascending: true })
    if (error) throw error
    return (data ?? []) as Reading[]
  },
  { watch: [since, sparrowId] }
)

const byMetric = computed(() => {
  const map = new Map<string, Reading[]>()
  for (const r of rows.value ?? []) {
    const arr = map.get(r.metric) ?? []
    arr.push(r)
    map.set(r.metric, arr)
  }
  return map
})

function latestValue(metricId: string): number | null {
  const readings = byMetric.value.get(metricId)
  if (!readings?.length) return null
  return readings[readings.length - 1].value
}

function timeSeries(metricId: string, points = 80): number[] {
  const readings = byMetric.value.get(metricId) ?? []
  if (!readings.length) return []
  const step = Math.max(1, Math.floor(readings.length / points))
  const out: number[] = []
  for (let i = 0; i < readings.length; i += step) out.push(readings[i].value)
  return out
}

function trend(metricId: string): number {
  const readings = byMetric.value.get(metricId) ?? []
  if (readings.length < 4) return 0
  const chunk = Math.max(2, Math.floor(readings.length * 0.2))
  const recent  = readings.slice(-chunk).reduce((a, r) => a + r.value, 0) / chunk
  const earlier = readings.slice(-chunk * 2, -chunk).reduce((a, r) => a + r.value, 0) / chunk
  return recent - earlier
}

function minMax(metricId: string) {
  const s = timeSeries(metricId)
  if (!s.length) return { min: null, max: null }
  return { min: Math.min(...s), max: Math.max(...s) }
}

const lastSeen = computed(() => {
  const all = rows.value ?? []
  if (!all.length) return 'no data'
  const latest = new Date(all[all.length - 1].recorded_at)
  const diffS = Math.floor((Date.now() - latest.getTime()) / 1000)
  if (diffS < 60) return `${diffS}s ago`
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`
  return `${Math.floor(diffS / 3600)}h ago`
})
</script>

<template>
  <div class="hans-page">

    <!-- Back -->
    <NuxtLink to="/" class="hans-back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
      All sparrows
    </NuxtLink>

    <!-- HERO -->
    <div class="hans-hero">
      <div class="hans-hero-img" :style="{ backgroundImage: `url(${sparrowImage(sparrowId)})` }"></div>
      <div class="hans-hero-content">
        <div>
          <div class="hans-hero-greeting hans-mono">{{ sparrowId }}</div>
          <h1 class="hans-hero-title">{{ sparrowId }}</h1>
          <div class="hans-hero-sub">A small radio in a quiet corner, breathing temperature, humidity, and pressure into the network every 30 seconds.</div>
          <div class="hans-hero-tags">
            <span class="hans-chip"><span class="dot" style="background:var(--leaf)"></span>online</span>
            <span class="hans-chip hans-mono">last beacon · {{ lastSeen }}</span>
            <span class="hans-chip hans-mono">fw 0.4.1</span>
          </div>
        </div>
        <div class="hans-hero-meta">
          <div class="hans-pill hans-mono">signal · -52 dBm</div>
          <div class="hans-pill hans-mono">uptime · 14d 6h</div>
        </div>
      </div>
    </div>

    <div class="hans-detail-grid">
      <div>
        <!-- CURRENT METRICS -->
        <div class="hans-section-head" style="margin-top:0">
          <h2>Now · {{ sparrowId }}</h2>
          <div class="hans-range">
            <button
              v-for="r in RANGES"
              :key="r"
              :class="{ active: selectedRange === r }"
              @click="selectedRange = r"
            >{{ r }}</button>
          </div>
        </div>
        <div class="hans-metrics-row">
          <HansMetricCard
            v-for="m in METRICS"
            :key="m.id"
            :metric="m"
            :value="latestValue(m.id) ?? 0"
            :trend="trend(m.id)"
            :spark-data="timeSeries(m.id)"
            :label="`${sparrowId}`"
            :range-label="`last ${selectedRange}`"
          />
        </div>

        <!-- CHARTS GRID -->
        <div class="hans-section-head">
          <h2>History · {{ selectedRange }}</h2>
          <span class="meta">sample interval · {{ SAMPLE_INTERVAL[selectedRange] }}</span>
        </div>
        <div class="hans-charts">
          <div v-for="m in METRICS" :key="m.id" class="hans-card hans-chart-card">
            <div class="hans-chart-head">
              <div class="label">
                <span class="dot" :style="{ background: m.color }"></span>
                <span class="name">{{ m.name }}<span class="unit">· {{ m.unit }}</span></span>
              </div>
              <div class="range-mini">
                <span>min {{ minMax(m.id).min !== null ? (m.decimals === 0 ? Math.round(minMax(m.id).min!) : minMax(m.id).min!.toFixed(m.decimals)) : '—' }}</span>
                <span>max {{ minMax(m.id).max !== null ? (m.decimals === 0 ? Math.round(minMax(m.id).max!) : minMax(m.id).max!.toFixed(m.decimals)) : '—' }}</span>
              </div>
            </div>
            <HansLineChart
              :series="{ [sparrowId]: timeSeries(m.id) }"
              :line-colors="{ [sparrowId]: m.color }"
              :default-color="m.color"
              :decimals="m.decimals"
              :range="selectedRange"
              :height="160"
            />
          </div>
        </div>
      </div>

      <!-- SIDE PANEL -->
      <div class="hans-detail-side">
        <div class="hans-card">
          <h3 class="panel-h">Device</h3>
          <div class="hans-kv">
            <div class="k">ID</div><div class="v hans-mono">{{ sparrowId }}</div>
            <div class="k">Firmware</div><div class="v hans-mono">0.4.1</div>
            <div class="k">Hardware</div><div class="v hans-mono">rev. C</div>
            <div class="k">Signal</div><div class="v hans-mono">-52 dBm</div>
            <div class="k">Last seen</div><div class="v hans-mono">{{ lastSeen }}</div>
            <div class="k">Readings</div><div class="v hans-mono">{{ (rows ?? []).length }}</div>
          </div>
          <div class="hans-battery">
            <div class="bar"><div class="fill" style="width:82%"></div></div>
            <div class="pct">82%</div>
          </div>
        </div>

        <div class="hans-card" style="margin-top:16px">
          <h3 class="panel-h">Recent events</h3>
          <div style="display:grid;gap:10px;font-size:12px">
            <div style="display:flex;gap:10px">
              <span class="hans-mono" style="color:var(--ink-4);min-width:52px">just now</span>
              <span style="color:var(--ink-2)">Beacon received, all metrics nominal.</span>
            </div>
            <div style="display:flex;gap:10px">
              <span class="hans-mono" style="color:var(--ink-4);min-width:52px">12m ago</span>
              <span style="color:var(--ink-2)">Pressure delta -0.3 hPa over 15 min.</span>
            </div>
            <div style="display:flex;gap:10px">
              <span class="hans-mono" style="color:var(--ink-4);min-width:52px">1h ago</span>
              <span style="color:var(--ink-2)">Humidity crossed 60% — brief spike.</span>
            </div>
          </div>
        </div>

        <div class="hans-card" style="margin-top:16px">
          <h3 class="panel-h">Comfort score</h3>
          <div style="display:flex;align-items:baseline;gap:8px">
            <div class="hans-mono" style="font-size:36px;letter-spacing:-0.04em">
              {{ latestValue('temperature') !== null && latestValue('humidity') !== null
                  ? Math.round(Math.max(0, Math.min(100,
                      100
                      - Math.abs((latestValue('temperature') ?? 22) - 21) * 4
                      - Math.abs((latestValue('humidity') ?? 50) - 50) * 0.5
                    )))
                  : '—' }}
            </div>
            <div style="color:var(--ink-3);font-size:12px">/ 100</div>
          </div>
          <div style="color:var(--ink-3);font-size:12px;margin-top:6px">Based on temperature and humidity comfort ranges.</div>
        </div>
      </div>
    </div>

  </div>
</template>
