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
          @mouseenter="onEnter(cell, $event)"
          @mouseleave="onLeave"
        />
      </template>
    </div>

    <!-- Custom tooltip -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="hans-heatmap-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <span class="tt-time">{{ tooltip.time }}</span>
        <span v-if="tooltip.score !== null" class="tt-score" :style="{ color: tooltip.color }">
          {{ tooltip.score }}
        </span>
        <span v-else class="tt-nodata">no data</span>
      </div>
    </Teleport>
    <div class="hans-heatmap-foot">
      <div class="hans-heatmap-xaxis">
        <span
          v-for="t in xAxisTicks"
          :key="t.label"
          :style="{ left: t.pos + '%' }"
        >{{ t.label }}</span>
      </div>
      <div class="hans-heatmap-legend">
        <span class="lbl">poor</span>
        <span class="grad" :style="{ background: legendGradient }"></span>
        <span class="lbl">ideal</span>
        <span class="meta">comfort</span>
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

// Desktop shows 24 hourly columns; mobile collapses to 4 day-parts
// (night / morning / afternoon / evening) so the cells stay big and legible.
const isMobile = useIsMobile()
const COLS = computed(() => (isMobile.value ? 4 : 24))
const HOURS_PER_COL = computed(() => 24 / COLS.value)

const xAxisTicks = computed(() => {
  if (isMobile.value) {
    return [0, 1, 2, 3].map(seg => ({ pos: ((seg + 0.5) / 4) * 100, label: `${String(seg * 6).padStart(2, '0')}` }))
  }
  return [0, 6, 12, 18].map(h => ({ pos: ((h + 0.5) / 24) * 100, label: `${String(h).padStart(2, '0')}:00` }))
})

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
      cells: Array.from({ length: COLS.value }, (_, c) => ({
        key: `${d}-${c}`,
        color: 'transparent',
        score: null,
        time: '',
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

  const cols = COLS.value
  const hpc = HOURS_PER_COL.value

  // Bucket readings: dayIdx (0..DAYS-1, DAYS-1 = today) × column (0..cols-1)
  const buckets = new Map<string, { temps: number[]; hums: number[] }>()
  for (const r of props.readings) {
    const ts = new Date(r.recorded_at)
    const dayDiff = localDayDiff(nowDate, ts)
    if (dayDiff < 0 || dayDiff >= DAYS.value) continue
    const dayIdx = DAYS.value - 1 - dayDiff
    const col = Math.floor(ts.getHours() / hpc)
    const key = `${dayIdx}-${col}`
    let b = buckets.get(key)
    if (!b) { b = { temps: [], hums: [] }; buckets.set(key, b) }
    if (r.metric === 'temperature') b.temps.push(r.value)
    if (r.metric === 'humidity')    b.hums.push(r.value)
  }

  const nowCol = Math.floor(nowDate.getHours() / hpc)
  const nowDayIdx = DAYS.value - 1

  const result: Array<{
    dayIdx: number
    label: string
    cells: Array<{ key: string; color: string; score: number | null; time: string; isNow: boolean }>
  }> = []

  for (let d = 0; d < DAYS.value; d++) {
    const daysBack = DAYS.value - 1 - d
    const label = dayLabelFor(daysBack)
    const cells: Array<{ key: string; color: string; score: number | null; time: string; isNow: boolean }> = []
    for (let c = 0; c < cols; c++) {
      const b = buckets.get(`${d}-${c}`)
      let score: number | null = null
      if (b && b.temps.length && b.hums.length) {
        const T = b.temps.reduce((a, x) => a + x, 0) / b.temps.length
        const RH = b.hums.reduce((a, x) => a + x, 0) / b.hums.length
        score = comfortScore(T, RH)
      }
      const startH = c * hpc
      const time = cols === 24
        ? `${label} ${String(startH).padStart(2, '0')}:00`
        : `${label} ${String(startH).padStart(2, '0')}–${String(startH + hpc).padStart(2, '0')}h`
      cells.push({
        key: `${d}-${c}`,
        color: comfortColor(score, theme.value),
        score,
        time,
        isNow: d === nowDayIdx && c === nowCol,
      })
    }
    result.push({ dayIdx: d, label, cells })
  }
  return result
})

// ── Tooltip ──────────────────────────────────────────────────────────────────
const tooltip = reactive({
  visible: false,
  x: 0,
  y: 0,
  time: '',
  score: null as number | null,
  color: '',
})

function onEnter(cell: { score: number | null; time: string; color: string }, e: MouseEvent) {
  tooltip.time  = cell.time
  tooltip.score = cell.score
  tooltip.color = cell.color
  positionTooltip(e)
  tooltip.visible = true
}

function onLeave() {
  tooltip.visible = false
}

function positionTooltip(e: MouseEvent) {
  const GAP = 10
  tooltip.x = e.clientX + GAP
  tooltip.y = e.clientY - 36
}
</script>

<style>
.hans-heatmap {
  /* Shared sizing so the foot's X-axis aligns with the cell columns above */
  --hm-cols: 24;
  --hm-label-col: 36px;
  --hm-col-gap: 4px;
  --hm-row-gap: 3px;
}

.hans-heatmap-grid {
  display: grid;
  grid-template-columns: var(--hm-label-col) repeat(var(--hm-cols), 1fr);
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

@media (max-width: 640px) {
  /* 4 day-part columns instead of 24 hours → big, readable cells */
  .hans-heatmap {
    --hm-cols: 4;
    --hm-label-col: 32px;
    --hm-col-gap: 4px;
    --hm-row-gap: 4px;
    overflow: hidden;
  }
  .hans-heatmap-rowlabel { font-size: 11px; }
  .hans-heatmap-cell {
    aspect-ratio: unset;
    height: 26px;
    border-radius: 6px;
    border-width: 0;
  }
  .hans-heatmap-cell.now { border-width: 1px; }
  .hans-heatmap-foot {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-top: 12px;
  }
  .hans-heatmap-legend { font-size: 10px; justify-content: flex-start; }
  .hans-heatmap-legend .grad { width: 90px; height: 10px; }
  .hans-heatmap-xaxis { font-size: 10px; height: 14px; }
}

/* ── Tooltip (teleported to body) ── */
.hans-heatmap-tooltip {
  position: fixed;
  z-index: 9000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 11px;
  border-radius: 9px;
  background: var(--panel-2, #222840);
  border: 1px solid var(--line-soft, #353c60);
  box-shadow: 0 6px 20px oklch(0 0 0 / 0.45);
  backdrop-filter: blur(8px);
  transform: translateX(-50%);
}
.hans-heatmap-tooltip .tt-time {
  font-family: var(--font-chart);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3, #8890b8);
  white-space: nowrap;
}
.hans-heatmap-tooltip .tt-score {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1;
  font-feature-settings: 'tnum' 1;
}
.hans-heatmap-tooltip .tt-nodata {
  font-size: 11px;
  color: var(--ink-4, #6870a0);
  font-style: italic;
}
</style>
