<template>
  <svg viewBox="0 0 160 180" :width="size" :height="size" :class="['hans-mascot', mood]">
    <defs>
      <linearGradient :id="potId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="oklch(0.62 0.10 12)"/>
        <stop offset="1" stop-color="oklch(0.42 0.09 8)"/>
      </linearGradient>
      <linearGradient :id="leafGradId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="leafTop"/>
        <stop offset="1" :stop-color="leafBottom"/>
      </linearGradient>
      <radialGradient :id="glowId" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="oklch(0.88 0.18 155)" :stop-opacity="glowStrength"/>
        <stop offset="1" stop-color="oklch(0.88 0.18 155)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="80" cy="90" r="64" :fill="`url(#${glowId})`"/>
    <circle cx="80" cy="90" r="64" fill="oklch(0.82 0.14 12 / 0.08)"/>
    <g class="mascot-leaf-c">
      <ellipse cx="42" cy="78" rx="18" ry="8" :fill="`url(#${leafGradId})`" transform="rotate(-30 42 78)"/>
    </g>
    <g class="mascot-leaf-b">
      <ellipse cx="118" cy="76" rx="20" ry="8" :fill="`url(#${leafGradId})`" transform="rotate(30 118 76)"/>
    </g>
    <g class="mascot-leaf-a">
      <ellipse cx="80" cy="56" rx="11" ry="20" :fill="`url(#${leafGradId})`"/>
      <ellipse cx="62" cy="68" rx="9" ry="16" :fill="`url(#${leafGradId})`" transform="rotate(-20 62 68)"/>
      <ellipse cx="98" cy="68" rx="9" ry="16" :fill="`url(#${leafGradId})`" transform="rotate(20 98 68)"/>
    </g>
    <g class="mascot-stem">
      <rect x="78" y="92" width="4" height="40" fill="oklch(0.45 0.10 150)" rx="2"/>
    </g>
    <path d="M52 132 L108 132 L102 168 L58 168 Z" :fill="`url(#${potId})`" stroke="oklch(0.32 0.06 8)" stroke-width="1.2"/>
    <ellipse cx="80" cy="132" rx="28" ry="4.5" fill="oklch(0.36 0.08 8)"/>
    <ellipse cx="80" cy="132" rx="24" ry="3" fill="oklch(0.22 0.04 10)"/>
    <line x1="80" y1="44" x2="80" y2="32" stroke="oklch(0.6 0.012 170)" stroke-width="1.2"/>
    <circle cx="80" cy="30" r="3" fill="oklch(0.86 0.10 50)"/>
    <circle cx="80" cy="30" r="3" fill="oklch(0.86 0.10 50 / 0.5)" style="filter: blur(2px)"/>
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: number
  vitality?: number     // 0-100: drives mood + leaf color + sway
  humidity?: number     // %, affects sway speed
}>(), { size: 160, vitality: 75, humidity: 50 })

const uid = Math.random().toString(36).slice(2, 8)
const leafGradId = `hans-leaf-${uid}`
const glowId = `hans-glow-${uid}`
const potId = `hans-pot-${uid}`

// Mood class drives sway speed via CSS
const mood = computed(() => {
  if (props.vitality < 35) return 'tired'
  if (props.vitality < 65) return 'okay'
  if (props.vitality < 85) return 'good'
  return 'glowing'
})

// Healthier plant → richer mint-emerald leaves (cool side, no olive)
const leafTop = computed(() => {
  const chroma = 0.06 + (props.vitality / 100) * 0.14
  const hue = 145 + (props.vitality / 100) * 15
  return `oklch(0.80 ${chroma} ${hue})`
})
const leafBottom = computed(() => {
  const chroma = 0.06 + (props.vitality / 100) * 0.14
  const hue = 150 + (props.vitality / 100) * 15
  return `oklch(0.55 ${chroma} ${hue})`
})

// Glow appears once comfort is high
const glowStrength = computed(() => {
  if (props.vitality < 70) return 0
  return ((props.vitality - 70) / 30) * 0.35
})
</script>

<style>
.hans-mascot.tired   { --sway-speed: 8s;  --sway-amp: 2deg; }
.hans-mascot.okay    { --sway-speed: 5.5s; --sway-amp: 3deg; }
.hans-mascot.good    { --sway-speed: 4.5s; --sway-amp: 4deg; }
.hans-mascot.glowing { --sway-speed: 3.8s; --sway-amp: 5deg; }
</style>
