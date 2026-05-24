export default defineNuxtRouteMiddleware(async (to) => {
  const excluded = ['/login', '/confirm']
  if (excluded.includes(to.path)) return

  const user = useSupabaseUser()
  if (!user.value) return navigateTo('/login')
})
