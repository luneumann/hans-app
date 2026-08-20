// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'Hans',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@300;400;500&family=Inter:wght@400;500;600&display=swap' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  devServer: {
    // The e-paper panel pulls its frame over the LAN, so the dev server has to
    // listen on more than loopback. By default Nuxt binds HTTP to ::1 and
    // leaves only a WebSocket socket on the wildcard address, which answers
    // plain GETs with 426 Upgrade Required.
    host: '::',
  },
  vite: {
    server: {
      // Vite rejects unknown Host headers as DNS-rebinding protection; the
      // panel addresses this machine by IP. Dev only — the deployed app runs
      // on Nitro, which has no such check.
      allowedHosts: (process.env.DEV_ALLOWED_HOSTS ?? '').split(',').filter(Boolean),
    },
  },
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@nuxt/ui'],
  supabase: {
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
    },
  },
})
