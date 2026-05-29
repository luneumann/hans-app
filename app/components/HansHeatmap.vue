<template>
  <div class="hans-heatmap">
    <div class="hans-heatmap-grid">
      <div class="hans-heatmap-rowlabels">
        <span v-for="d in dayLabels" :key="d">{{ d }}</span>
      </div>
      <div class="hans-heatmap-cells">
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="hans-heatmap-cell"
          :class="{ now: cell.isNow }"
          :style="{ background: cell.color }"
          :title="cell.title"
        />
      </div>
    </div>
    <div class="hans-heatmap-foot">
      <div class="hans-heatmap-xaxis">
        <span v-for="h in [0, 6, 12, 18]" :key="h" :style="{ left: (h / 24 * 100) + '%' }">{{ String(h).padStart(2, '0') }}</span>
      </div>
      <div class="hans-heatmap-legend">
        <span class="lbl">low</span>
        <span class="grad"></span>
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

const DAYS = computed(() => props.days ?? 7)

const dayLabels = computed(() => {
  const labels: string[] = []
  for (let i = DAYS.value - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    labels.push(d.toLocaleDateString('en-GB', { weekday: 'short' }))
  }
  return labels
})

function comfortColor(score: number | null): string {
  if (score === null) return 'color-mix(in oklab, var(--ink-4) 14%, transparent)'
  // Map 0-100 to hue: 30 (clay/red) → 130 (leaf/green)
  const hue = 30 + (score / 100) * 100
  const chroma = 0.08 + (score / 100) * 0.08
  const alpha = 0.35 + (score / 100) * 0.5
  return `oklch(0.62 ${chroma} ${hue} / ${alpha})`
}

const cells = computed(() => {
  // Bucket readings: day (0..DAYS-1, 0 = oldest) × hour (0..23) → { temp[], hum[] }
  const buckets = new Map<string, { temps: number[]; hums: number[] }>()
  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (const r of props.readings) {
    const ts = new Date(r.recorded_at)
    const dayDiff = Math.floor((todayMidnight.getTime() - new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).getTime()) / 86400000)
    if (dayDiff < 0 || dayDiff >= DAYS.value) continue
    const dayIdx = DAYS.value - 1 - dayDiff
    const hour = ts.getHours()
    const key = `${dayIdx}-${hour}`
    let b = buckets.get(key)
    if (!b) { b = { temps: [], hums: [] }; buckets.set(key, b) }
    if (r.metric === 'temperature') b.temps.push(r.value)
    if (r.metric === 'humidity') b.hums.push(r.value)
  }

  const nowHour = now.getHours()
  const nowDayIdx = DAYS.value - 1

  const out: { key: string; color: string; title: string; isNow: boolean }[] = []
  for (let d = 0; d < DAYS.value; d++) {
    for (let h = 0; h < 24; h++) {
      const b = buckets.get(`${d}-${h}`)
      let score: number | null = null
      if (b && b.temps.length && b.hums.length) {
        const T = b.temps.reduce((a, x) => a + x, 0) / b.temps.length
        const RH = b.hums.reduce((a, x) => a + x, 0) / b.hums.length
        score = Math.round(Math.max(0, Math.min(100, 100 - Math.abs(T - 21) * 4 - Math.abs(RH - 50) * 0.5)))
      }
      out.push({
        key: `${d}-${h}`,
        color: comfortColor(score),
        title: score !== null
          ? `${dayLabels.value[d]} ${String(h).padStart(2, '0')}:00 — comfort ${score}`
          : `${dayLabels.value[d]} ${String(h).padStart(2, '0')}:00 — no data`,
        isNow: d === nowDayIdx && h === nowHour,
      })
    }
  }
  return out
})
</script>

<style>
.hans-heatmap-grid {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px;
  align-items: stretch;
}
.hans-heatmap-rowlabels {
  display: grid;
  grid-template-rows: repeat(7, 1fr);
  gap: 3px;
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  color: var(--ink-4);
  align-items: center;
  text-align: right;
}
.hans-heatmap-cells {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  grid-auto-rows: 1fr;
  gap: 3px;
  min-height: 140px;
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
  margin-left: 44px;
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  color: var(--ink-4);
}
.hans-heatmap-xaxis span {
  position: absolute;
  transform: translateX(-50%);
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
  background: linear-gradient(90deg, oklch(0.62 0.1 30 / 0.4), oklch(0.62 0.14 80 / 0.5), oklch(0.7 0.16 130 / 0.85));
  border: 1px solid var(--line-soft);
}
.hans-heatmap-legend .meta { margin-left: 12px; font-family: 'Geist Mono', monospace; }
</style>
