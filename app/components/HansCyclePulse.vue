<template>
  <div class="hans-pulse-strip" :title="`${received} of ${cycles} cycles received in the last ${cycles * 5} min`">
    <div
      v-for="(slot, i) in slots"
      :key="i"
      class="hans-pulse-dot"
      :class="{ on: slot.on, latest: i === slots.length - 1 && slot.on }"
      :style="{ '--accent': color }"
    />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  timestamps: string[]   // recorded_at strings (sorted asc or unsorted, we'll handle it)
  cycles?: number        // how many 5-min slots to show
  intervalMin?: number   // length of each slot in minutes
  color?: string
}>(), { cycles: 12, intervalMin: 5, color: 'var(--leaf)' })

const slots = computed(() => {
  const now = Date.now()
  const slotMs = props.intervalMin * 60 * 1000
  const set = new Set<number>()
  for (const ts of props.timestamps) {
    const t = new Date(ts).getTime()
    const slotIdx = Math.floor((now - t) / slotMs)
    if (slotIdx >= 0 && slotIdx < props.cycles) set.add(slotIdx)
  }
  // Return oldest → newest
  return Array.from({ length: props.cycles }, (_, i) => ({
    on: set.has(props.cycles - 1 - i),
  }))
})

const received = computed(() => slots.value.filter(s => s.on).length)
</script>

<style>
.hans-pulse-strip {
  display: flex;
  gap: 4px;
  align-items: center;
}
.hans-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: color-mix(in oklab, var(--ink-4) 50%, transparent);
  border: 1px solid var(--line-soft);
  transition: background 0.4s ease, box-shadow 0.4s ease;
}
.hans-pulse-dot.on {
  background: var(--accent, var(--leaf));
  border-color: color-mix(in oklab, var(--accent, var(--leaf)) 60%, transparent);
}
.hans-pulse-dot.latest {
  box-shadow: 0 0 8px color-mix(in oklab, var(--accent, var(--leaf)) 70%, transparent);
  animation: hans-pulse 2s ease-in-out infinite;
}
</style>
