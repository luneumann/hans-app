<template>
  <div :class="['hans-intro', exiting && 'exit']">
    <div class="hans-intro-bg"></div>

    <div
      v-for="p in particles"
      :key="p.id"
      class="hans-particle"
      :style="{
        left: p.left + '%',
        top: p.top + '%',
        width: p.size + 'px',
        height: p.size + 'px',
        animationDelay: p.delay + 's',
        animationDuration: p.duration + 's',
      }"
    />

    <button class="hans-intro-skip" @click="skip">Skip</button>

    <div class="hans-intro-content">
      <div class="hans-intro-mascot">
        <HansMascot :size="160"/>
      </div>
      <h1 class="hans-intro-title">
        <span class="glyph-h">H</span>ANS
      </h1>
      <div class="hans-intro-sub">Home Ambient Network System</div>
    </div>

    <div class="hans-intro-foot">
      <span class="dot"></span>
      listening to your sparrows
    </div>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ done: [] }>()

const exiting = ref(false)

const particles = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: 10 + Math.random() * 80,
  top: 30 + Math.random() * 60,
  delay: Math.random() * 4,
  duration: 6 + Math.random() * 4,
  size: 2 + Math.random() * 3,
}))

function skip() {
  exiting.value = true
  setTimeout(() => emit('done'), 400)
}

onMounted(() => {
  const t = setTimeout(() => {
    exiting.value = true
    setTimeout(() => emit('done'), 650)
  }, 3200)
  onUnmounted(() => clearTimeout(t))
})
</script>
