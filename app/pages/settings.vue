<template>
  <div class="hans-page" style="max-width:480px;margin:0 auto;padding-top:40px">
    <div style="font-size:11px;letter-spacing:0.14em;color:var(--ink-3);text-transform:uppercase;margin-bottom:12px">Settings</div>

    <div class="hans-card" style="margin-bottom:24px">
      <div style="font-size:15px;color:var(--ink);margin-bottom:4px">Data export</div>
      <div style="font-size:13px;color:var(--ink-3);margin-bottom:16px">
        Copy every sensor reading in the database to your clipboard as JSON.
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

async function copyAllData() {
  exporting.value = true
  exportError.value = ''
  exportLabel.value = 'Exporting…'

  try {
    const pageSize = 1000
    const rows: Record<string, unknown>[] = []

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('sensor_readings')
        .select('*')
        .order('recorded_at', { ascending: true })
        .range(from, from + pageSize - 1)

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
</style>
