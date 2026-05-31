<template>
  <div>
    <NuxtRouteAnnouncer/>

    <!-- Intro splash (first visit only) -->
    <HansIntro v-if="showIntro" @done="onIntroDone"/>

    <template v-else>
      <!-- Navbar -->
      <nav class="hans-nav">
        <NuxtLink to="/" class="hans-nav-brand">
          <div class="logo">
            <img src="/favicon.svg" alt="HANS Logo" width="36" height="36"/>
          </div>
          <div>
            <div class="brand-title">HANS</div>
            <div class="brand-sub">Ambient Network</div>
          </div>
        </NuxtLink>

        <div class="hans-nav-right">
          <div class="hans-nav-links">
            <NuxtLink to="/" class="hans-nav-link" :class="{ active: route.path === '/' }">Dashboard</NuxtLink>
            <NuxtLink to="/camera" class="hans-nav-link" :class="{ active: route.path === '/camera' }">Camera</NuxtLink>
            <NuxtLink to="/settings" class="hans-nav-link" :class="{ active: route.path === '/settings' }">Settings</NuxtLink>
          </div>
          <div class="hans-nav-status">
            <span class="dot"></span>
            <span>sparrows online</span>
          </div>
        </div>
      </nav>

      <NuxtPage/>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const showIntro = ref(false)

onMounted(() => {
  const seen = localStorage.getItem('hans-intro-seen')
  if (!seen) showIntro.value = true
})

function onIntroDone() {
  showIntro.value = false
  localStorage.setItem('hans-intro-seen', '1')
}
</script>
