<template>
  <div :class="['hans-mascot', mood]" :style="{ width: `${size}px`, height: `${size}px` }">
    <img :src="`/hans/${mood}.png`" :width="size" :alt="`Hans is ${mood}`" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: number
  vitality?: number
  humidity?: number
}>(), { size: 160, vitality: 75, humidity: 50 })

const mood = computed(() => {
  if (props.vitality < 35) return 'tired'
  if (props.vitality < 65) return 'okay'
  if (props.vitality < 85) return 'good'
  return 'glowing'
})
</script>

<style>
.hans-mascot { display: flex; align-items: flex-end; justify-content: center; }
.hans-mascot.tired   { --sway-speed: 9s;   --sway-amp: 0.8deg; }
.hans-mascot.okay    { --sway-speed: 7s;   --sway-amp: 1.2deg; }
.hans-mascot.good    { --sway-speed: 5.5s; --sway-amp: 1.6deg; }
.hans-mascot.glowing { --sway-speed: 4.5s; --sway-amp: 2deg;   }
.hans-mascot img { display: block; transform-origin: bottom center; animation: hans-sway var(--sway-speed) ease-in-out infinite; }
</style>
