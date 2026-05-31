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

      <!-- Bottom tab bar (mobile) -->
      <nav class="hans-bottom-nav">
        <NuxtLink to="/" class="hans-bottom-nav-link" :class="{ active: route.path === '/' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
          </svg>
          Home
        </NuxtLink>
        <NuxtLink to="/camera" class="hans-bottom-nav-link" :class="{ active: route.path === '/camera' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
          Camera
        </NuxtLink>
        <NuxtLink to="/settings" class="hans-bottom-nav-link" :class="{ active: route.path === '/settings' }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </NuxtLink>
      </nav>
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
