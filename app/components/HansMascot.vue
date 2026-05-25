<template>
  <svg viewBox="0 0 160 180" :width="size" :height="size">
    <defs>
      <linearGradient id="hans-pot" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="oklch(0.55 0.1 40)"/>
        <stop offset="1" stop-color="oklch(0.42 0.09 38)"/>
      </linearGradient>
      <linearGradient id="hans-leaf" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="oklch(0.78 0.13 130)"/>
        <stop offset="1" stop-color="oklch(0.55 0.13 145)"/>
      </linearGradient>
    </defs>
    <circle cx="80" cy="90" r="64" fill="oklch(0.79 0.12 80 / 0.08)"/>
    <g class="mascot-leaf-c">
      <ellipse cx="42" cy="78" rx="18" ry="8" fill="url(#hans-leaf)" transform="rotate(-30 42 78)"/>
    </g>
    <g class="mascot-leaf-b">
      <ellipse cx="118" cy="76" rx="20" ry="8" fill="url(#hans-leaf)" transform="rotate(30 118 76)"/>
    </g>
    <g class="mascot-leaf-a">
      <ellipse cx="80" cy="56" rx="11" ry="20" fill="url(#hans-leaf)"/>
      <ellipse cx="62" cy="68" rx="9" ry="16" fill="url(#hans-leaf)" transform="rotate(-20 62 68)"/>
      <ellipse cx="98" cy="68" rx="9" ry="16" fill="url(#hans-leaf)" transform="rotate(20 98 68)"/>
    </g>
    <g class="mascot-stem">
      <rect x="78" y="92" width="4" height="40" fill="oklch(0.42 0.09 130)" rx="2"/>
    </g>
    <path d="M52 132 L108 132 L102 168 L58 168 Z" fill="url(#hans-pot)" stroke="oklch(0.32 0.06 38)" stroke-width="1.2"/>
    <ellipse cx="80" cy="132" rx="28" ry="4.5" fill="oklch(0.36 0.08 38)"/>
    <ellipse cx="80" cy="132" rx="24" ry="3" fill="oklch(0.22 0.04 40)"/>
    <line x1="80" y1="44" x2="80" y2="32" stroke="oklch(0.6 0.018 100)" stroke-width="1.2"/>
    <circle cx="80" cy="30" r="3" fill="oklch(0.79 0.12 80)"/>
    <circle cx="80" cy="30" r="3" fill="oklch(0.79 0.12 80 / 0.5)" style="filter: blur(2px)"/>
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 160 })
</script>
