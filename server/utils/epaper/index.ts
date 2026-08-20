import type { H3Event } from 'h3'
import { fetchEpaperData, fetchRhythmData } from './data'
import { buildDashboardSvg, buildRhythmSvg } from './layout'
import { isPaletteName, type PaletteName } from './palette'

export { svgToPng, SCREEN_W, SCREEN_H } from './render'
export { buildDashboardSvg, buildRhythmSvg } from './layout'
export { fetchEpaperData, deriveEpaperData, fetchRhythmData, deriveRhythmData } from './data'

/**
 * Pages the buttons cycle through, in order.
 *
 * The device sends a raw counter and never learns how many pages exist, so
 * adding one here changes what the buttons do without reflashing.
 */
export const PAGES = ['dashboard', 'rhythm'] as const
export type PageName = (typeof PAGES)[number]

/** Proper modulo — the device's counter goes negative when paging backwards. */
function wrap(n: number, len: number): number {
  return ((n % len) + len) % len
}

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

  // Reported by the panel itself — it is the only thing that can measure it.
  const rawBattery = Number(query.battery)
  const battery = Number.isFinite(rawBattery)
    ? Math.round(Math.min(100, Math.max(0, rawBattery)))
    : null

  // The panel sends a counter; a browser can pass the name instead.
  const rawPage = String(query.page ?? '')
  const asNumber = Number(rawPage)
  const page: PageName = Number.isFinite(asNumber) && rawPage !== ''
    ? PAGES[wrap(Math.trunc(asNumber), PAGES.length)]
    : (PAGES as readonly string[]).includes(rawPage)
      ? (rawPage as PageName)
      : 'dashboard'

  if (page === 'rhythm') {
    const rhythm = await fetchRhythmData()
    return { svg: buildRhythmSvg(rhythm, palette, battery), palette }
  }

  const data = await fetchEpaperData()
  return { svg: buildDashboardSvg(data, palette, battery), palette }
}
