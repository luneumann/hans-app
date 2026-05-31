<script setup lang="ts">
interface Reading {
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

const METRICS = [
  { id: 'temperature', name: 'Temperature', unit: '°C',  color: 'var(--amber)',  icon: 'thermo', decimals: 1, short: 'Temp' },
  { id: 'humidity',    name: 'Humidity',    unit: '%',   color: 'var(--sky)',    icon: 'drop',   decimals: 0, short: 'Hum'  },
  { id: 'pressure',    name: 'Pressure',    unit: 'hPa', color: 'var(--ink-3)', icon: 'pres',   decimals: 1, short: 'Pres' },
  { id: 'light',       name: 'Light',       unit: 'lx',  color: 'var(--ink-3)', icon: 'sun',    decimals: 0, short: 'Lux'  },
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
      .order('recorded_at', { ascending: false })
      .limit(9997)
    if (error) throw error
    return ((data ?? []) as Reading[]).reverse()
  },
  { watch: [since] }
)

// Yesterday window: ±15 min around (now − 24h)
const yesterdayStart = computed(() => new Date(Date.now() - 24 * 60 * 60 * 1000 - 15 * 60 * 1000).toISOString())
const yesterdayEnd   = computed(() => new Date(Date.now() - 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString())

const { data: yRows, refresh: refreshYesterday } = await useAsyncData<Reading[]>(
  'yesterday_readings',
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .gte('recorded_at', yesterdayStart.value)
      .lte('recorded_at', yesterdayEnd.value)
    if (error) throw error
    return (data ?? []) as Reading[]
  }
)

// 7d data for heatmap (independent of selectedRange)
const heatmapSince = computed(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
const { data: weekRows, refresh: refreshWeek } = await useAsyncData<Reading[]>(
  'week_readings',
  async () => {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .gte('recorded_at', heatmapSince.value)
      .order('recorded_at', { ascending: false })
      .limit(9997)
    if (error) throw error
    return ((data ?? []) as Reading[]).reverse()
  }
)

const sparrows = computed(() =>
  [...new Set((rows.value ?? []).map(r => r.sparrow_id))].sort()
)

function isOutdoor(id: string) { return id.toLowerCase().includes('balcony') }

const indoorSparrows = computed(() => sparrows.value.filter(s => !isOutdoor(s)))
const outdoorSparrows = computed(() => sparrows.value.filter(s => isOutdoor(s)))

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

function latestValue(sparrowId: string, metricId: string): number | null {
  const readings = byGroup.value.get(sparrowId)?.get(metricId)
  if (!readings?.length) return null
  return readings[readings.length - 1].value
}

function houseAvg(metricId: string): number | null {
  const vals = indoorSparrows.value
    .map(s => latestValue(s, metricId))
    .filter((v): v is number => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function outdoorAvg(metricId: string): number | null {
  const vals = outdoorSparrows.value
    .map(s => latestValue(s, metricId))
    .filter((v): v is number => v !== null)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function yesterdayAvg(metricId: string): number | null {
  const vals = (yRows.value ?? []).filter(r => r.metric === metricId).map(r => r.value)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function timeSeries(sparrowId: string, metricId: string, points = 60): number[] {
  const readings = byGroup.value.get(sparrowId)?.get(metricId) ?? []
  if (!readings.length) return []
  const step = Math.max(1, Math.floor(readings.length / points))
  const sampled: number[] = []
  for (let i = 0; i < readings.length; i += step) sampled.push(readings[i].value)
  return sampled
}

function aggSeries(metricId: string): number[] {
  const series = sparrows.value.map(s => timeSeries(s, metricId))
  const len = Math.max(...series.map(s => s.length), 0)
  if (!len) return []
  return Array.from({ length: len }, (_, i) => {
    const vals = series.map(s => s[Math.round((i / (len - 1)) * (s.length - 1)) || 0]).filter(Boolean)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })
}

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

// Online: last temperature reading < 11 min ago
function isOnlineSparrow(id: string): boolean {
  const readings = byGroup.value.get(id)?.get('temperature') ?? []
  if (!readings.length) return false
  return (Date.now() - parseRecordedAt(readings[readings.length - 1].recorded_at).getTime()) < 11 * 60 * 1000
}
const onlineCount = computed(() => sparrows.value.filter(isOnlineSparrow).length)

// Sparrow's cycle timestamps for pulse strip (1h window of temperature readings)
function sparrowCycleTimestamps(id: string): string[] {
  const readings = byGroup.value.get(id)?.get('temperature') ?? []
  const cutoff = Date.now() - 60 * 60 * 1000
  return readings.filter(r => parseRecordedAt(r.recorded_at).getTime() >= cutoff).map(r => r.recorded_at)
}

function trend(sparrowId: string, metricId: string): number {
  const readings = byGroup.value.get(sparrowId)?.get(metricId) ?? []
  if (readings.length < 4) return 0
  const chunk = Math.max(2, Math.floor(readings.length * 0.2))
  const recent  = readings.slice(-chunk).reduce((a, r) => a + r.value, 0) / chunk
  const earlier = readings.slice(-chunk * 2, -chunk).reduce((a, r) => a + r.value, 0) / chunk
  return recent - earlier
}
function avgTrend(metricId: string): number {
  const vals = indoorSparrows.value.map(s => trend(s, metricId))
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

// Dew point (Magnus) house-wide
const houseDewPoint = computed(() => {
  const T = houseAvg('temperature')
  const RH = houseAvg('humidity')
  if (T === null || RH === null) return null
  return +(T - (100 - RH) / 5).toFixed(1)
})

// House pressure tendency
const housePressureDelta = computed(() => {
  const all: Reading[] = []
  for (const id of sparrows.value) all.push(...(byGroup.value.get(id)?.get('pressure') ?? []))
  all.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
  if (all.length < 6) return 0
  const chunk = Math.max(3, Math.floor(all.length * 0.2))
  const recent  = all.slice(-chunk).reduce((a, r) => a + r.value, 0) / chunk
  const earlier = all.slice(0, chunk).reduce((a, r) => a + r.value, 0) / chunk
  return +(recent - earlier).toFixed(1)
})
const housePressureTendency = computed(() => {
  if (housePressureDelta.value > 0.5) return { label: 'rising', color: 'var(--leaf)' }
  if (housePressureDelta.value < -0.5) return { label: 'falling', color: 'var(--clay)' }
  return null
})

// Warmest / coolest room (right now)
const warmestRoom = computed(() => {
  let best: { name: string; value: number } | null = null
  for (const s of sparrows.value) {
    const v = latestValue(s, 'temperature')
    if (v === null) continue
    if (!best || v > best.value) best = { name: s, value: v }
  }
  return best
})
const coolestRoom = computed(() => {
  let best: { name: string; value: number } | null = null
  for (const s of sparrows.value) {
    const v = latestValue(s, 'temperature')
    if (v === null) continue
    if (!best || v < best.value) best = { name: s, value: v }
  }
  return best
})

// Aurora hue is interpolated from the theme's auroraStops by temperature.
const theme = useTheme()
const auroraHue = computed(() => auroraHueFor(houseAvg('temperature'), theme.value))
const auroraHue2 = computed(() => (auroraHue.value + 50 + 360) % 360)

// Mascot vitality: comfort score of house
const mascotVitality = computed(() => {
  const T = houseAvg('temperature')
  const RH = houseAvg('humidity')
  if (T === null || RH === null) return 50
  return Math.round(Math.max(0, Math.min(100,
    100 - Math.abs(T - 21) * 4 - Math.abs(RH - 50) * 0.5
  )))
})
const mascotMood = computed(() => {
  const v = mascotVitality.value
  if (v < 35) return 'Resting'
  if (v < 65) return 'Watching'
  if (v < 85) return 'Content'
  return 'Thriving'
})
const mascotDetail = computed(() => {
  const v = mascotVitality.value
  const RH = houseAvg('humidity')
  if (v < 35) return 'Conditions are off — Hans is hibernating until the air balances.'
  if (v < 65) return 'Hans is keeping watch over the house.'
  if (v < 85) return `Air is balanced. ${RH !== null ? `Humidity at ${Math.round(RH)}% feels just right.` : ''}`
  return 'Hans is glowing — these are ideal conditions.'
})

// Hero text
const heroTemp    = computed(() => houseAvg('temperature'))
const heroHum     = computed(() => houseAvg('humidity'))
const outsideTemp = computed(() => outdoorAvg('temperature'))
const outsideHum  = computed(() => outdoorAvg('humidity'))

const now = ref<Date | null>(null)
const hour = computed(() => now.value?.getHours() ?? null)
const greeting = computed(() => {
  const h = hour.value
  if (h === null) return ''
  return h < 6 ? 'Quiet hours' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
})
const timeStr = computed(() => now.value?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) ?? '')
const dateStr = computed(() => now.value?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) ?? '')

// Auto-refresh every 5 seconds
let refreshTimer: ReturnType<typeof setInterval>
let weekTimer: ReturnType<typeof setInterval>
onMounted(() => {
  now.value = new Date()
  refreshTimer = setInterval(() => {
    now.value = new Date()
    refresh()
    refreshYesterday()
  }, 5000)
  // Heatmap data once per minute is plenty
  weekTimer = setInterval(refreshWeek, 60000)
})
onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(weekTimer)
})
</script>

<template>
  <div class="hans-page">

    <!-- HERO -->
    <div class="hans-hero">
      <div class="hans-hero-img" style="background-image: url('/sparrows/home.png')"></div>
      <div class="hans-hero-content">
        <div>
          <div v-if="greeting" class="hans-hero-greeting">{{ greeting }} — {{ timeStr }} local</div>
          <h1 class="hans-hero-title">
            <template v-if="heroTemp !== null && heroHum !== null">
              The house feels <em><AnimatedNumber :value="heroTemp" :decimals="1"/>°</em>
              and <em><AnimatedNumber :value="heroHum" :decimals="0"/>%</em>.
            </template>
            <template v-else>
              HANS is listening.
            </template>
          </h1>
          <div v-if="outsideTemp !== null && outsideHum !== null" class="hans-hero-outside">
            Outside feels <em><AnimatedNumber :value="outsideTemp" :decimals="1"/>°</em>
            and <em><AnimatedNumber :value="outsideHum" :decimals="0"/>%</em>.
          </div>
          <div class="hans-hero-sub">
            <template v-if="sparrows.length">
              {{ sparrows.length }} sparrow{{ sparrows.length !== 1 ? 's' : '' }} reporting in the last {{ selectedRange }}.
            </template>
            <template v-else>
              No sparrows sending data in the selected time range.
            </template>
          </div>
          <div class="hans-hero-tags">
            <span class="hans-chip hans-beacon">
              <span class="core"></span>
              <span class="hans-mono">live · auto-refresh 5s</span>
            </span>
            <span v-if="housePressureTendency" class="hans-chip">
              <span class="dot" :style="{ background: housePressureTendency.color }"></span>
              pressure · {{ housePressureTendency.label }}
            </span>
            <span v-if="houseDewPoint !== null" class="hans-chip hans-mono">
              <span class="dot" style="background:var(--sky)"></span>
              dew · {{ houseDewPoint }}°
            </span>
            <span class="hans-chip hans-mono">{{ onlineCount }} / {{ sparrows.length }} online</span>
          </div>
        </div>
        <div class="hans-hero-meta">
          <div class="hans-pill hans-mono">{{ dateStr }}</div>
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

      <!-- NARRATIVE + MASCOT -->
      <div class="hans-narrative-row" style="display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:stretch;margin-bottom:8px">
        <div class="hans-card">
          <h3 style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--ink-3);margin:0 0 12px;font-weight:500">House dispatch</h3>
          <HansNarrative
            :temp="heroTemp"
            :humidity="heroHum"
            :pressure="houseAvg('pressure')"
            :dew-point="houseDewPoint"
            :pressure-delta="housePressureDelta"
            :light="houseAvg('light')"
            :hour="hour"
            :warmest-room="warmestRoom"
            :coolest-room="coolestRoom"
            :online-count="onlineCount"
            :total-count="sparrows.length"
          />
        </div>
        <div class="hans-card hans-mascot-panel">
          <div class="mascot-wrap">
            <HansMascot
              :size="110"
              :vitality="mascotVitality"
              :humidity="heroHum ?? 50"
            />
          </div>
          <div class="info">
            <div class="mood-label">Hans is</div>
            <div class="mood">{{ mascotMood }}</div>
            <div class="mood-detail">{{ mascotDetail }}</div>
          </div>
        </div>
      </div>

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
          :yesterday-value="yesterdayAvg(m.id)"
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

      <!-- 7d COMFORT RHYTHM -->
      <div class="hans-section-head">
        <h2>Rhythm · last 7 days</h2>
        <span class="meta">hourly comfort score</span>
      </div>
      <div class="hans-card">
        <HansHeatmap :readings="weekRows ?? []" :days="7"/>
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
                  <span class="dot" :style="{ background: isOnlineSparrow(s) ? 'var(--leaf)' : 'var(--clay)' }"></span>
                  <span>{{ isOnlineSparrow(s) ? 'online' : 'offline' }}</span>
                </div>
              </div>
              <div class="mini-metrics">
                <div v-for="m in METRICS" :key="m.id" class="mm">
                  <span class="k">{{ m.short }}</span>
                  <span>
                    {{ latestValue(s, m.id) !== null ? (m.decimals === 0 ? Math.round(latestValue(s, m.id)!) : latestValue(s, m.id)!.toFixed(m.decimals)) : '—' }}<small>{{ m.unit }}</small>
                  </span>
                </div>
              </div>
              <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:8px">
                <HansCyclePulse :timestamps="sparrowCycleTimestamps(s)" :cycles="12"/>
                <span style="font-family:'Geist Mono',monospace;font-size:10px;color:var(--ink-4)">last 1h</span>
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

    </template>
  </div>
</template>

<style>
@media (max-width: 1100px) {
  .hans-narrative-row { grid-template-columns: 1fr !important; }
}
</style>
