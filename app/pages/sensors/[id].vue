<script setup lang="ts">
interface Reading {
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

const METRICS = [
  { id: 'temperature', name: 'Temperature', unit: '°C',  color: 'var(--amber)',  icon: 'thermo', decimals: 1 },
  { id: 'humidity',    name: 'Humidity',    unit: '%',   color: 'var(--sky)',    icon: 'drop',   decimals: 0 },
  { id: 'pressure',    name: 'Pressure',    unit: 'hPa', color: 'var(--ink-3)', icon: 'pres',   decimals: 1 },
  { id: 'light',       name: 'Light',       unit: 'lx',  color: 'var(--ink-3)', icon: 'sun',    decimals: 0 },
]

const SPARROW_IMAGES: Record<string, string> = {
  living:  '/sparrows/living-room.png',
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

const { data: rows, status, refresh } = await useAsyncData<Reading[]>(
  `detail_${sparrowId.value}`,
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .eq('sparrow_id', sparrowId.value)
      .gte('recorded_at', since.value)
      .order('recorded_at', { ascending: false })
      .limit(9997)
    if (error) throw error
    return ((data ?? []) as Reading[]).reverse()
  },
  { watch: [since, sparrowId] }
)

// Yesterday-at-this-time window (±15 min)
const yStart = computed(() => new Date(Date.now() - 24 * 60 * 60 * 1000 - 15 * 60 * 1000).toISOString())
const yEnd   = computed(() => new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString())
const { data: yRows, refresh: refreshY } = await useAsyncData<Reading[]>(
  `detail_y_${sparrowId.value}`,
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .eq('sparrow_id', sparrowId.value)
      .gte('recorded_at', yStart.value)
      .lte('recorded_at', yEnd.value)
    if (error) throw error
    return (data ?? []) as Reading[]
  },
  { watch: [sparrowId] }
)
function yesterdayValue(metricId: string): number | null {
  const vals = (yRows.value ?? []).filter(r => r.metric === metricId).map(r => r.value)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

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

function relativeTime(date: Date): string {
  const diffS = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffS < 60) return `${diffS}s ago`
  if (diffS < 3600) return `${Math.floor(diffS / 60)}m ago`
  if (diffS < 86400) return `${Math.floor(diffS / 3600)}h ago`
  return `${Math.floor(diffS / 86400)}d ago`
}

const lastSeen = computed(() => {
  const all = rows.value ?? []
  if (!all.length) return 'no data'
  return relativeTime(parseRecordedAt(all[all.length - 1].recorded_at))
})

// Online: last reading within 11 min (5-min wake cycle + margin)
const isOnline = computed(() => {
  const all = rows.value ?? []
  if (!all.length) return false
  return (Date.now() - parseRecordedAt(all[all.length - 1].recorded_at).getTime()) < 11 * 60 * 1000
})

// Data health: actual wake cycles vs expected for the window.
// We use temperature reading count as the cycle proxy — robust to optional
// metrics (e.g. light may be missing if no BH1750 is connected).
const dataHealth = computed(() => {
  const hours = RANGE_HOURS[selectedRange.value]
  const actualCycles = byMetric.value.get('temperature')?.length ?? 0
  const expectedCycles = hours * 12           // every 5 min = 12/hr
  return {
    actual: actualCycles,
    expected: expectedCycles,
    pct: Math.min(100, Math.round((actualCycles / Math.max(1, expectedCycles)) * 100)),
  }
})

// Dew point via Magnus approximation
const dewPoint = computed(() => {
  const T = latestValue('temperature')
  const RH = latestValue('humidity')
  if (T === null || RH === null) return null
  return +(T - (100 - RH) / 5).toFixed(1)
})

// How close is the current temperature to the dew point
const condensationRisk = computed(() => {
  const dp = dewPoint.value
  const T = latestValue('temperature')
  if (dp === null || T === null) return null
  const gap = T - dp
  if (gap < 3) return { label: 'High', color: 'var(--clay)' }
  if (gap < 6) return { label: 'Moderate', color: 'var(--amber)' }
  return { label: 'Low', color: 'var(--leaf)' }
})

// Pressure tendency: compare first 20% vs last 20% of window
const pressureTendency = computed(() => {
  const readings = byMetric.value.get('pressure') ?? []
  if (readings.length < 6) return { label: 'stable', delta: 0, color: 'var(--ink-3)' }
  const chunk = Math.max(3, Math.floor(readings.length * 0.2))
  const recent  = readings.slice(-chunk).reduce((a, r) => a + r.value, 0) / chunk
  const earlier = readings.slice(0, chunk).reduce((a, r) => a + r.value, 0) / chunk
  const delta = +(recent - earlier).toFixed(1)
  if (delta > 0.5) return { label: 'rising', delta, color: 'var(--leaf)' }
  if (delta < -0.5) return { label: 'falling', delta, color: 'var(--clay)' }
  return { label: 'stable', delta, color: 'var(--ink-3)' }
})

// Temperature stability: std dev over the window (lower = more stable)
const tempStability = computed(() => {
  const s = timeSeries('temperature')
  if (s.length < 2) return null
  const mean = s.reduce((a, b) => a + b, 0) / s.length
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length
  const sd = +Math.sqrt(variance).toFixed(2)
  if (sd < 0.3) return { sd, label: 'very stable' }
  if (sd < 0.8) return { sd, label: 'stable' }
  if (sd < 1.5) return { sd, label: 'variable' }
  return { sd, label: 'volatile' }
})

// Comfort score: distance from ideal 21°C / 50% RH
const comfortScore = computed(() => {
  const T = latestValue('temperature')
  const RH = latestValue('humidity')
  if (T === null || RH === null) return null
  return Math.round(Math.max(0, Math.min(100,
    100 - Math.abs(T - 21) * 4 - Math.abs(RH - 50) * 0.5
  )))
})

// Real events derived from sensor data
const recentEvents = computed(() => {
  type Ev = { ts: number; when: string; text: string }
  const events: Ev[] = []

  const humReadings = byMetric.value.get('humidity') ?? []
  for (let i = humReadings.length - 1; i > 0 && events.length < 2; i--) {
    const prev = humReadings[i - 1].value
    const curr = humReadings[i].value
    const ts = parseRecordedAt(humReadings[i].recorded_at).getTime()
    if (prev < 60 && curr >= 60)
      events.push({ ts, when: relativeTime(new Date(ts)), text: 'Humidity crossed 60% — ventilation recommended.' })
    else if (prev >= 60 && curr < 60)
      events.push({ ts, when: relativeTime(new Date(ts)), text: 'Humidity dropped back below 60%.' })
  }

  const tempVals = byMetric.value.get('temperature') ?? []
  if (tempVals.length) {
    const peak = tempVals.reduce((a, b) => a.value > b.value ? a : b)
    const peakTs = parseRecordedAt(peak.recorded_at).getTime()
    events.push({ ts: peakTs, when: relativeTime(new Date(peakTs)), text: `Temperature peak: ${peak.value.toFixed(1)} °C.` })

    const trough = tempVals.reduce((a, b) => a.value < b.value ? a : b)
    if (trough.recorded_at !== peak.recorded_at) {
      const troughTs = parseRecordedAt(trough.recorded_at).getTime()
      events.push({ ts: troughTs, when: relativeTime(new Date(troughTs)), text: `Temperature low: ${trough.value.toFixed(1)} °C.` })
    }
  }

  // Signal gaps > 10 min (WiFi drops, brownouts)
  for (let i = tempVals.length - 1; i > 0 && events.length < 5; i--) {
    const gap = parseRecordedAt(tempVals[i].recorded_at).getTime() - parseRecordedAt(tempVals[i - 1].recorded_at).getTime()
    if (gap > 10 * 60 * 1000) {
      const ts = parseRecordedAt(tempVals[i].recorded_at).getTime()
      events.push({ ts, when: relativeTime(new Date(ts)), text: `Signal gap: ${Math.round(gap / 60000)} min without data.` })
      break
    }
  }

  return events.sort((a, b) => b.ts - a.ts).slice(0, 4)
})

// Aurora hue is interpolated from the theme's auroraStops by sparrow temperature.
const theme = useTheme()
const auroraHue = computed(() => auroraHueFor(latestValue('temperature'), theme.value))
const auroraHue2 = computed(() => (auroraHue.value + 50 + 360) % 360)

// Last-hour temperature cycle timestamps for pulse strip
const cycleTimestamps = computed(() => {
  const tempReadings = byMetric.value.get('temperature') ?? []
  const cutoff = Date.now() - 60 * 60 * 1000
  return tempReadings.filter(r => parseRecordedAt(r.recorded_at).getTime() >= cutoff).map(r => r.recorded_at)
})

// Auto-refresh every 5 seconds
let refreshTimer: ReturnType<typeof setInterval>
onMounted(() => {
  refreshTimer = setInterval(() => {
    refresh()
    refreshY()
  }, 5000)
})
onUnmounted(() => clearInterval(refreshTimer))
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
          <div class="hans-hero-sub">ESP8266 + BME280 — wakes every 5 minutes, posts temperature, humidity, and pressure, then sleeps again.</div>
          <div class="hans-hero-tags">
            <span class="hans-chip">
              <span class="dot" :style="{ background: isOnline ? 'var(--leaf)' : 'var(--clay)' }"></span>
              {{ isOnline ? 'online' : 'offline' }}
            </span>
            <span class="hans-chip hans-mono">last beacon · {{ lastSeen }}</span>
            <span v-if="pressureTendency.label !== 'stable'" class="hans-chip hans-mono">
              <span class="dot" :style="{ background: pressureTendency.color }"></span>
              pressure · {{ pressureTendency.label }}
            </span>
          </div>
        </div>
        <div class="hans-hero-meta">
          <div class="hans-pill hans-mono">data health · {{ dataHealth.pct }}%</div>
          <div class="hans-pill hans-mono">{{ dataHealth.actual }} / {{ dataHealth.expected }} cycles</div>
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
            :yesterday-value="yesterdayValue(m.id)"
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

        <!-- Device -->
        <div class="hans-card">
          <h3 class="panel-h">Device</h3>
          <div class="hans-kv">
            <div class="k">ID</div>
            <div class="v hans-mono">{{ sparrowId }}</div>
            <div class="k">Status</div>
            <div class="v hans-mono" :style="{ color: isOnline ? 'var(--leaf)' : 'var(--clay)' }">
              {{ isOnline ? 'online' : 'offline' }}
            </div>
            <div class="k">Last seen</div>
            <div class="v hans-mono">{{ lastSeen }}</div>
            <div class="k">Readings</div>
            <div class="v hans-mono">{{ (rows ?? []).length }}</div>
            <div class="k">Data health</div>
            <div class="v hans-mono">{{ dataHealth.pct }}%</div>
            <div class="k">Cycles</div>
            <div class="v hans-mono">{{ dataHealth.actual }} / {{ dataHealth.expected }}</div>
          </div>
          <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line-soft)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:var(--ink-4)">Last hour</span>
              <span style="font-family:'Geist Mono',monospace;font-size:10px;color:var(--ink-4)">5 min cycles</span>
            </div>
            <HansCyclePulse :timestamps="cycleTimestamps" :cycles="12"/>
          </div>
        </div>

        <!-- Dew point -->
        <div class="hans-card" style="margin-top:16px">
          <h3 class="panel-h">Dew point</h3>
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">
            <div class="hans-mono" style="font-size:32px;letter-spacing:-0.04em">
              {{ dewPoint !== null ? `${dewPoint}°` : '—' }}
            </div>
            <div style="color:var(--ink-3);font-size:12px">C</div>
          </div>
          <div v-if="condensationRisk" style="display:flex;align-items:center;gap:6px;font-size:12px">
            <span class="dot" :style="{ background: condensationRisk.color }"></span>
            <span style="color:var(--ink-2)">Condensation risk: <strong>{{ condensationRisk.label }}</strong></span>
          </div>
          <div style="color:var(--ink-4);font-size:11px;margin-top:6px">
            {{ dewPoint !== null && latestValue('temperature') !== null
              ? `${(latestValue('temperature')! - dewPoint).toFixed(1)}° margin to surface condensation`
              : 'Calculated from temperature and humidity.' }}
          </div>
        </div>

        <!-- Pressure tendency -->
        <div class="hans-card" style="margin-top:16px">
          <h3 class="panel-h">Pressure tendency</h3>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span class="dot" :style="{ background: pressureTendency.color }"></span>
            <span class="hans-mono" style="font-size:18px;letter-spacing:-0.02em">{{ pressureTendency.label }}</span>
          </div>
          <div style="color:var(--ink-3);font-size:12px">
            <template v-if="pressureTendency.delta !== 0">
              {{ pressureTendency.delta > 0 ? '+' : '' }}{{ pressureTendency.delta }} hPa over {{ selectedRange }}
            </template>
            <template v-else>
              No significant pressure change over {{ selectedRange }}.
            </template>
          </div>
          <div style="color:var(--ink-4);font-size:11px;margin-top:4px">
            {{ pressureTendency.label === 'rising' ? 'Improving weather likely.' : pressureTendency.label === 'falling' ? 'Weather change possible.' : 'Conditions stable.' }}
          </div>
        </div>

        <!-- Stability + Comfort -->
        <div class="hans-card" style="margin-top:16px">
          <h3 class="panel-h">Environment</h3>
          <div class="hans-kv">
            <div class="k">Comfort</div>
            <div class="v hans-mono">{{ comfortScore !== null ? `${comfortScore} / 100` : '—' }}</div>
            <div class="k">Stability</div>
            <div class="v hans-mono">{{ tempStability ? tempStability.label : '—' }}</div>
            <div class="k">Temp σ</div>
            <div class="v hans-mono">{{ tempStability ? `±${tempStability.sd} °C` : '—' }}</div>
          </div>
          <div style="color:var(--ink-4);font-size:11px;margin-top:8px">
            Comfort targets 21 °C / 50 % RH. Stability is σ of temperature over {{ selectedRange }}.
          </div>
        </div>

        <!-- Events -->
        <div class="hans-card" style="margin-top:16px">
          <h3 class="panel-h">Events · {{ selectedRange }}</h3>
          <div v-if="recentEvents.length" style="display:grid;gap:10px;font-size:12px">
            <div v-for="ev in recentEvents" :key="ev.ts" style="display:flex;gap:10px">
              <span class="hans-mono" style="color:var(--ink-4);min-width:56px;flex-shrink:0">{{ ev.when }}</span>
              <span style="color:var(--ink-2)">{{ ev.text }}</span>
            </div>
          </div>
          <div v-else style="color:var(--ink-4);font-size:12px">
            No notable events in this window.
          </div>
        </div>

      </div>
    </div>

  </div>
</template>
