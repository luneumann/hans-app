/**
 * Reactive mobile breakpoint flag, matched to the CSS ≤640px media query.
 *
 * SSR-safe: starts `false` on the server and during the first client paint
 * (so hydration matches), then resolves in onMounted and stays in sync with
 * viewport changes / orientation flips.
 */
export function useIsMobile(maxWidth = 640) {
  const isMobile = ref(false)
  let mq: MediaQueryList | undefined
  const update = () => { isMobile.value = mq?.matches ?? false }

  onMounted(() => {
    mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    update()
    mq.addEventListener('change', update)
  })
  onUnmounted(() => mq?.removeEventListener('change', update))

  return isMobile
}
