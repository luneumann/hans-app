<template>
  <div class="hans-heatmap">
    <!-- Single grid: column 1 = day label, columns 2..25 = 24 hours.
         This guarantees the label and its row of cells are always in the
         same grid row (no separate stretching). -->
    <div class="hans-heatmap-grid">
      <template v-for="row in rows" :key="row.dayIdx">
        <span class="hans-heatmap-rowlabel">{{ row.label }}</span>
        <div
          v-for="cell in row.cells"
          :key="cell.key"
          class="hans-heatmap-cell"
          :class="{ now: cell.isNow }"
          :style="{ background: cell.color }"
          :title="cell.title"
        />
      </template>
    </div>
    <div class="hans-heatmap-foot">
      <div class="hans-heatmap-xaxis">
        <span
          v-for="h in [0, 6, 12, 18]"
          :key="h"
          :style="{ left: ((h + 0.5) / 24 * 100) + '%' }"
        >{{ String(h).padStart(2, '0') }}:00</span>
      </div>
      <div class="hans-heatmap-legend">
        <span class="lbl">low</span>
        <span class="grad" :style="{ background: legendGradient }"></span>
        <span class="lbl">high</span>
        <span class="meta">comfort score</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Reading {
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

const props = defineProps<{
  readings: Reading[]
  days?: number
}>()

const theme = useTheme()
const legendGradient = computed(() => comfortGradientCss(theme.value))

const DAYS = computed(() => props.days ?? 7)

/**
 * Number of whole local-calendar days between two Dates.
 * Uses UTC midnight of each local date so DST transitions don't introduce
 * an off-by-one (a 23h DST day would otherwise floor to 0 instead of 1).
 */
function localDayDiff(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getFullYear(),   later.getMonth(),   later.getDate())
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())
  return Math.round((a - b) / 86400000)
}

/**
 * `now` is intentionally null during SSR and the first client paint, then
 * set in onMounted. Two reasons:
 *
 *   1. SSR runs on a Node server in UTC. If we used `new Date()` during
 *      SSR, the buckets and weekday labels would be computed for a different
 *      timezone than the visitor's — and Vue's computed cache survives
 *      hydration when no dependency changes, so the wrong values stuck
 *      around until the next auto-refresh. That matches the symptom:
 *      "wrong on reload, fixes itself over time".
 *
 *   2. Rendering an identical empty skeleton on both server and client
 *      avoids a hydration mismatch.
 *
 * After mount we also tick `now` every minute so labels stay fresh if
 * the page is left open across midnight.
 */
const now = ref<Date | null>(null)
let nowInterval: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  now.value = new Date()
  nowInterval = setInterval(() => { now.value = new Date() }, 60_000)
})
onUnmounted(() => { if (nowInterval) clearInterval(nowInterval) })

const rows = computed(() => {
  // Skeleton: same shape on server and pre-mount client → no hydration mismatch
  if (!now.value) {
    return Array.from({ length: DAYS.value }, (_, d) => ({
      dayIdx: d,
      label: '',
      cells: Array.from({ length: 24 }, (_, h) => ({
        key: `${d}-${h}`,
        color: 'transparent',
        title: '',
        isNow: false,
      })),
    }))
  }

  const nowDate = now.value
  const dayLabelFor = (offsetDaysBack: number) => {
    const d = new Date(nowDate)
    d.setDate(d.getDate() - offsetDaysBack)
    return d.toLocaleDateString('en-GB', { weekday: 'short' })
  }

  // Bucket readings: dayIdx (0..DAYS-1, DAYS-1 = today) × hour (0..23)
  const buckets = new Map<string, { temps: number[]; hums: number[] }>()
  for (const r of props.readings) {
    const ts = new Date(r.recorded_at)
    const dayDiff = localDayDiff(nowDate, ts)
    if (dayDiff < 0 || dayDiff >= DAYS.value) continue
    const dayIdx = DAYS.value - 1 - dayDiff
    const hour = ts.getHours()
    const key = `${dayIdx}-${hour}`
    let b = buckets.get(key)
    if (!b) { b = { temps: [], hums: [] }; buckets.set(key, b) }
    if (r.metric === 'temperature') b.temps.push(r.value)
    if (r.metric === 'humidity')    b.hums.push(r.value)
  }

  const nowHour = nowDate.getHours()
  const nowDayIdx = DAYS.value - 1

  const result: Array<{
    dayIdx: number
    label: string
    cells: Array<{ key: string; color: string; title: string; isNow: boolean }>
  }> = []

  for (let d = 0; d < DAYS.value; d++) {
    const daysBack = DAYS.value - 1 - d
    const label = dayLabelFor(daysBack)
    const cells: Array<{ key: string; color: string; title: string; isNow: boolean }> = []
    for (let h = 0; h < 24; h++) {
      const b = buckets.get(`${d}-${h}`)
      let score: number | null = null
      if (b && b.temps.length && b.hums.length) {
        const T = b.temps.reduce((a, x) => a + x, 0) / b.temps.length
        const RH = b.hums.reduce((a, x) => a + x, 0) / b.hums.length
        score = Math.round(Math.max(0, Math.min(100,
          100 - Math.abs(T - 21) * 4 - Math.abs(RH - 50) * 0.5
        )))
      }
      cells.push({
        key: `${d}-${h}`,
        color: comfortColor(score, theme.value),
        title: score !== null
          ? `${label} ${String(h).padStart(2, '0')}:00 — comfort ${score}`
          : `${label} ${String(h).padStart(2, '0')}:00 — no data`,
        isNow: d === nowDayIdx && h === nowHour,
      })
    }
    result.push({ dayIdx: d, label, cells })
  }
  return result
})
</script>

<style>
.hans-heatmap {
  /* Shared sizing so the foot's X-axis aligns with the cell columns above */
  --hm-label-col: 36px;
  --hm-col-gap: 4px;
  --hm-row-gap: 3px;
}

.hans-heatmap-grid {
  display: grid;
  grid-template-columns: var(--hm-label-col) repeat(24, 1fr);
  gap: var(--hm-row-gap) var(--hm-col-gap);
}
.hans-heatmap-rowlabel {
  /* Sits in column 1; its row is the same as its 24 sibling cells */
  align-self: center;
  justify-self: end;
  font-family: var(--font-chart);
  font-feature-settings: 'tnum' 1;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-4);
  padding-right: 2px;
}
.hans-heatmap-cell {
  border-radius: 4px;
  aspect-ratio: 1.4;
  border: 1px solid var(--line-soft);
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.hans-heatmap-cell:hover {
  transform: scale(1.18);
  border-color: var(--ink-3);
  z-index: 2;
  position: relative;
}
.hans-heatmap-cell.now {
  border-color: var(--ink);
  box-shadow: 0 0 0 1px var(--ink) inset, 0 0 10px color-mix(in oklab, var(--leaf) 40%, transparent);
}

.hans-heatmap-foot {
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.hans-heatmap-xaxis {
  position: relative;
  flex: 1;
  height: 14px;
  /* Same offset as the label column + the grid gap, so 0% of the axis
     lines up with the left edge of hour-0 in the grid above. */
  margin-left: calc(var(--hm-label-col) + var(--hm-col-gap));
  font-family: var(--font-chart);
  font-feature-settings: 'tnum' 1;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--ink-4);
}
.hans-heatmap-xaxis span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}
.hans-heatmap-legend {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  color: var(--ink-4);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.hans-heatmap-legend .grad {
  display: inline-block;
  width: 60px;
  height: 8px;
  border-radius: 2px;
  border: 1px solid var(--line-soft);
  /* background set inline from comfortGradientCss(theme) */
}
.hans-heatmap-legend .meta { margin-left: 12px; font-family: var(--font-chart); font-feature-settings: 'tnum' 1; letter-spacing: 0.04em; }
</style>
