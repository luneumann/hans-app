<template>
  <p class="hans-narrative" v-html="rendered"/>
</template>

<script setup lang="ts">
const props = defineProps<{
  temp: number | null
  humidity: number | null
  pressure: number | null
  dewPoint: number | null
  pressureDelta: number  // hPa change over the window
  light: number | null    // average illuminance in lux
  hour: number             // current local hour, 0-23, for context-aware light phrasing
  warmestRoom: { name: string; value: number } | null
  coolestRoom: { name: string; value: number } | null
  onlineCount: number
  totalCount: number
}>()

function tempPhrase(t: number): string {
  if (t < 17) return 'crisp'
  if (t < 19) return 'cool'
  if (t < 21) return 'mild'
  if (t < 23) return 'comfortable'
  if (t < 25) return 'warm'
  return 'hot'
}

function humPhrase(h: number): string {
  if (h < 30) return 'dry'
  if (h < 45) return 'fresh'
  if (h < 60) return 'balanced'
  if (h < 70) return 'humid'
  return 'damp'
}

// Light phrasing is time-aware — 200 lx at midnight is bright, at noon is dim
function lightPhrase(lux: number, hour: number): { phrase: string; aside: string | null } {
  const night = hour < 6 || hour >= 22
  if (night) {
    if (lux > 200) return { phrase: 'still lit', aside: 'lights are on past quiet hours' }
    if (lux > 20)  return { phrase: 'dimly lit', aside: null }
    if (lux > 2)   return { phrase: 'softly dark', aside: null }
    return { phrase: 'fully dark', aside: null }
  }
  // day
  if (lux > 5000) return { phrase: 'sunlit', aside: 'direct daylight pouring in' }
  if (lux > 800)  return { phrase: 'bright', aside: null }
  if (lux > 200)  return { phrase: 'softly lit', aside: null }
  if (lux > 30)   return { phrase: 'dim', aside: null }
  return { phrase: 'shaded', aside: 'unusually dark for daytime' }
}

const text = computed(() => {
  if (props.temp === null || props.humidity === null) {
    return 'The network is listening, but the sparrows have not sent enough data yet to describe the house.'
  }
  const parts: string[] = []

  parts.push(`The house feels **${tempPhrase(props.temp)}** at ${props.temp.toFixed(1)}° and the air is **${humPhrase(props.humidity)}** at ${Math.round(props.humidity)}%.`)

  if (props.light !== null) {
    const { phrase, aside } = lightPhrase(props.light, props.hour)
    const luxStr = props.light < 100 ? props.light.toFixed(1) : Math.round(props.light).toString()
    parts.push(`Rooms are **${phrase}** at ${luxStr} lx${aside ? ` — ${aside}` : ''}.`)
  }

  if (props.warmestRoom && props.coolestRoom && props.warmestRoom.name !== props.coolestRoom.name) {
    const delta = props.warmestRoom.value - props.coolestRoom.value
    if (delta > 1.5) {
      parts.push(`*${props.warmestRoom.name}* is the warmest room at ${props.warmestRoom.value.toFixed(1)}°, while *${props.coolestRoom.name}* sits ${delta.toFixed(1)}° cooler.`)
    }
  }

  if (Math.abs(props.pressureDelta) > 0.8) {
    if (props.pressureDelta > 0) parts.push(`Pressure is **rising** (+${props.pressureDelta.toFixed(1)} hPa) — fair weather likely ahead.`)
    else parts.push(`Pressure is **falling** (${props.pressureDelta.toFixed(1)} hPa) — weather may change in the next hours.`)
  } else {
    parts.push('Pressure is steady, conditions look stable.')
  }

  if (props.dewPoint !== null && props.temp !== null) {
    const gap = props.temp - props.dewPoint
    if (gap < 3) parts.push(`Surfaces are close to the dew point — watch for condensation.`)
  }

  if (props.onlineCount < props.totalCount) {
    parts.push(`${props.totalCount - props.onlineCount} of ${props.totalCount} sparrows are quiet.`)
  }

  return parts.join(' ')
})

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

const rendered = computed(() =>
  escapeHtml(text.value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
)
</script>
