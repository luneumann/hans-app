import type { H3Event } from 'h3'
import { fetchEpaperData } from './data'
import { buildSvg } from './layout'
import { isPaletteName, type PaletteName } from './palette'

export { svgToPng, SCREEN_W, SCREEN_H } from './render'
export { buildSvg } from './layout'
export { fetchEpaperData, deriveEpaperData } from './data'

/**
 * Shared entry point for the panel endpoints.
 *
 * The display fetches this unauthenticated over plain HTTP, so EPAPER_TOKEN
 * gates it with a shared secret. It is optional in dev; without it the route
 * would publish the flat's sensor history to anyone who guesses the path.
 */
export async function epaperPayload(event: H3Event): Promise<{ svg: string; palette: PaletteName }> {
  const query = getQuery(event)
  const expected = process.env.EPAPER_TOKEN

  if (expected && query.token !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'bad or missing token' })
  }
  if (!expected && !import.meta.dev) {
    throw createError({ statusCode: 500, statusMessage: 'EPAPER_TOKEN is not configured' })
  }

  const requested = String(query.palette ?? 'spectra6')
  const palette: PaletteName = isPaletteName(requested) ? requested : 'spectra6'

  const data = await fetchEpaperData()
  return { svg: buildSvg(data, palette), palette }
}
