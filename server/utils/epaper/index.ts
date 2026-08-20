import type { H3Event } from 'h3'
import { fetchEpaperData, fetchRhythmData } from './data'
import { buildSvg, buildRhythmSvg, isLayoutName, type LayoutName } from './layout'
import { isPaletteName, type PaletteName } from './palette'

export { svgToPng, SCREEN_W, SCREEN_H } from './render'
export { buildSvg, buildRhythmSvg, LAYOUTS, isLayoutName, type LayoutName } from './layout'
export { fetchEpaperData, deriveEpaperData, fetchRhythmData, deriveRhythmData } from './data'

/**
 * Pages the buttons cycle through, in order.
 *
 * The device sends a raw counter and never learns how many pages exist, so
 * adding one here changes what the buttons do without reflashing.
 */
export const PAGES = ['dashboard', 'focus', 'grid', 'rhythm'] as const
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

  // `page` is what the buttons drive; `layout` stays available for pulling one
  // up directly in a browser.
  let page: PageName
  const rawPage = Number(query.page)
  if (Number.isFinite(rawPage)) {
    page = PAGES[wrap(Math.trunc(rawPage), PAGES.length)]
  } else {
    const wanted = String(query.layout ?? 'dashboard')
    page = isLayoutName(wanted) ? wanted : 'dashboard'
  }

  if (page === 'rhythm') {
    const rhythm = await fetchRhythmData()
    return { svg: buildRhythmSvg(rhythm, palette, battery), palette }
  }

  const data = await fetchEpaperData()
  return { svg: buildSvg(data, palette, battery, page as LayoutName), palette }
}
