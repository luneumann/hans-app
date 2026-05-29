<template>
  <svg viewBox="0 0 160 180" :width="size" :height="size" :class="['hans-mascot', mood]">
    <defs>
      <linearGradient :id="potId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="m.potTop"/>
        <stop offset="1" :stop-color="m.potBottom"/>
      </linearGradient>
      <linearGradient :id="leafGradId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="leafTop"/>
        <stop offset="1" :stop-color="leafBottom"/>
      </linearGradient>
      <radialGradient :id="glowId" cx="50%" cy="50%" r="50%">
        <stop offset="0" :stop-color="m.glow" :stop-opacity="glowStrength"/>
        <stop offset="1" :stop-color="m.glow" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="80" cy="90" r="64" :fill="`url(#${glowId})`"/>
    <circle cx="80" cy="90" r="64" :fill="dishHalo"/>
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
      <rect x="78" y="92" width="4" height="40" :fill="m.stem" rx="2"/>
    </g>
    <path d="M52 132 L108 132 L102 168 L58 168 Z" :fill="`url(#${potId})`" :stroke="m.potStroke" stroke-width="1.2"/>
    <ellipse cx="80" cy="132" rx="28" ry="4.5" :fill="m.potRim"/>
    <ellipse cx="80" cy="132" rx="24" ry="3" :fill="m.potShadow"/>
    <line x1="80" y1="44" x2="80" y2="32" stroke="var(--ink-3)" stroke-width="1.2"/>
    <circle cx="80" cy="30" r="3" :fill="m.sundrop"/>
    <circle cx="80" cy="30" r="3" :fill="sundropBlur" style="filter: blur(2px)"/>
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: number
  vitality?: number     // 0-100: drives mood + leaf color + sway
  humidity?: number     // %, reserved for future fine-tuning
}>(), { size: 160, vitality: 75, humidity: 50 })

const uid = Math.random().toString(36).slice(2, 8)
const leafGradId = `hans-leaf-${uid}`
const glowId = `hans-glow-${uid}`
const potId = `hans-pot-${uid}`

const theme = useTheme()
const m = computed(() => theme.value.mascot)

// Halo behind the plant uses a tinted version of leaf color
const dishHalo = computed(() => {
  // Soft glow ring at very low opacity
  return `color-mix(in oklab, var(--leaf) 12%, transparent)`
})

const sundropBlur = computed(() => `color-mix(in oklab, ${m.value.sundrop} 50%, transparent)`)

// Mood class drives sway speed via CSS
const mood = computed(() => {
  if (props.vitality < 35) return 'tired'
  if (props.vitality < 65) return 'okay'
  if (props.vitality < 85) return 'good'
  return 'glowing'
})

// Healthier plant → richer mint leaves, hue shifts within theme's range
const leafTop = computed(() => {
  const chroma = 0.06 + (props.vitality / 100) * 0.16
  const hue = m.value.leafBaseHue + (props.vitality / 100) * m.value.leafHueShift
  return `oklch(0.82 ${chroma.toFixed(3)} ${hue.toFixed(1)})`
})
const leafBottom = computed(() => {
  const chroma = 0.06 + (props.vitality / 100) * 0.16
  const hue = m.value.leafBaseHue + 5 + (props.vitality / 100) * m.value.leafHueShift
  return `oklch(0.55 ${chroma.toFixed(3)} ${hue.toFixed(1)})`
})

// Glow appears once vitality is high
const glowStrength = computed(() => {
  if (props.vitality < 70) return 0
  return ((props.vitality - 70) / 30) * 0.4
})
</script>

<style>
.hans-mascot.tired   { --sway-speed: 8s;   --sway-amp: 2deg; }
.hans-mascot.okay    { --sway-speed: 5.5s; --sway-amp: 3deg; }
.hans-mascot.good    { --sway-speed: 4.5s; --sway-amp: 4deg; }
.hans-mascot.glowing { --sway-speed: 3.8s; --sway-amp: 5deg; }
</style>
