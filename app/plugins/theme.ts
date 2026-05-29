/**
 * Injects the active theme's color tokens as a `<style>` tag in the document
 * head, both at SSR and on the client. Re-runs reactively when the active
 * theme changes (so calling setTheme() from anywhere updates the whole UI).
 */
export default defineNuxtPlugin(() => {
  const theme = useTheme()

  useHead({
    style: [
      {
        key: 'hans-theme',
        id: 'hans-theme-vars',
        innerHTML: computed(() => buildThemeCss(theme.value)),
      },
    ],
  })
})
