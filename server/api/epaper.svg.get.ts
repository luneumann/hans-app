import { epaperPayload } from '../utils/epaper'

/**
 * The same layout, undithered, for iterating in a browser. Colours here are
 * the addressing values — the panel renders them noticeably more muted.
 */
export default defineEventHandler(async (event) => {
  const { svg } = await epaperPayload(event)
  setHeader(event, 'content-type', 'image/svg+xml')
  setHeader(event, 'cache-control', 'no-store')
  return svg
})
