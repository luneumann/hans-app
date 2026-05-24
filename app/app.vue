<template>
  <div class="min-h-screen bg-gray-50">
    <NuxtRouteAnnouncer />

    <!-- Navbar -->
    <header class="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-gray-900 tracking-tight">
          <UIcon name="i-heroicons-home" class="text-blue-500 w-5 h-5" />
          HANS
        </NuxtLink>
        <nav class="flex items-center gap-1">
          <UButton
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            variant="ghost"
            color="neutral"
            :icon="link.icon"
            size="sm"
          >
            {{ link.label }}
          </UButton>
        </nav>
      </div>
    </header>

    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const navLinks = [
  { to: '/', label: 'Dashboard', icon: 'i-heroicons-chart-bar' },
  { to: '/camera', label: 'Kamera', icon: 'i-heroicons-video-camera' },
  { to: '/settings', label: 'Einstellungen', icon: 'i-heroicons-cog-6-tooth' },
]
</script>
