<template>
  <div class="hans-page" style="max-width:480px;margin:0 auto;padding-top:40px">
    <div style="font-size:11px;letter-spacing:0.14em;color:var(--ink-3);text-transform:uppercase;margin-bottom:12px">Settings</div>

    <div class="hans-card" style="margin-bottom:24px">
      <div style="font-size:15px;color:var(--ink);margin-bottom:4px">Data export</div>
      <div style="font-size:13px;color:var(--ink-3);margin-bottom:16px">
        Copy sensor readings to your clipboard as JSON.
      </div>

      <select v-model="rangeOption" class="hans-export-select" style="margin-bottom:10px">
        <option value="all">All time</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="custom">Custom range…</option>
      </select>

      <div v-if="rangeOption === 'custom'" style="display:flex;gap:8px;margin-bottom:10px">
        <input v-model="customFrom" type="date" class="hans-export-select" style="flex:1" />
        <input v-model="customTo" type="date" class="hans-export-select" style="flex:1" />
      </div>

      <button class="hans-export-btn" :disabled="exporting" @click="copyAllData">
        {{ exportLabel }}
      </button>
      <div v-if="exportError" style="font-size:12px;color:var(--sky);margin-top:10px">{{ exportError }}</div>
    </div>

    <div style="text-align:center;color:var(--ink-3);font-size:13px">
      Device management, notifications, and firmware updates — not in this round.
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()

const exporting = ref(false)
const exportError = ref('')
const exportLabel = ref('Copy all data')
const rangeOption = ref('all')
const customFrom = ref('')
const customTo = ref('')

function rangeBounds(): { from?: string; to?: string } {
  const now = new Date()
  switch (rangeOption.value) {
    case '7d':
      return { from: new Date(now.getTime() - 7 * 86400000).toISOString() }
    case '30d':
      return { from: new Date(now.getTime() - 30 * 86400000).toISOString() }
    case '90d':
      return { from: new Date(now.getTime() - 90 * 86400000).toISOString() }
    case 'custom':
      return {
        from: customFrom.value ? new Date(customFrom.value).toISOString() : undefined,
        to: customTo.value ? new Date(customTo.value + 'T23:59:59').toISOString() : undefined,
      }
    default:
      return {}
  }
}

async function copyAllData() {
  exporting.value = true
  exportError.value = ''
  exportLabel.value = 'Exporting…'

  try {
    const { from: fromDate, to: toDate } = rangeBounds()
    const pageSize = 1000
    const rows: Record<string, unknown>[] = []

    for (let from = 0; ; from += pageSize) {
      let query = supabase
        .from('sensor_readings')
        .select('*')
        .order('recorded_at', { ascending: true })
        .range(from, from + pageSize - 1)

      if (fromDate) query = query.gte('recorded_at', fromDate)
      if (toDate) query = query.lte('recorded_at', toDate)

      const { data, error } = await query

      if (error) throw error
      if (!data || data.length === 0) break

      rows.push(...data)
      if (data.length < pageSize) break
    }

    await navigator.clipboard.writeText(JSON.stringify(rows, null, 2))
    exportLabel.value = `Copied ${rows.length} rows`
  } catch (err) {
    exportError.value = err instanceof Error ? err.message : 'Failed to export data.'
    exportLabel.value = 'Copy all data'
  } finally {
    exporting.value = false
    if (!exportError.value) {
      setTimeout(() => { exportLabel.value = 'Copy all data' }, 2500)
    }
  }
}
</script>

<style scoped>
.hans-export-btn {
  width: 100%;
  padding: 13px;
  border: 0;
  border-radius: var(--r-md);
  background: var(--accent-green);
  color: #0c1a10;
  font-family: 'Geist', inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.hans-export-btn:active { transform: scale(0.99); }
.hans-export-btn:disabled { opacity: 0.6; cursor: default; }

.hans-export-select {
  width: 100%;
  padding: 11px 13px;
  border: 1px solid var(--line, rgba(255,255,255,0.12));
  border-radius: var(--r-md);
  background: var(--bg-2, transparent);
  color: var(--ink);
  font-family: 'Geist', inherit;
  font-size: 14px;
  -webkit-tap-highlight-color: transparent;
}
</style>
