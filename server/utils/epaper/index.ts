import type { H3Event } from 'h3'
import { fetchEpaperData } from './data'
import { buildDashboardSvg, FORECAST_FROM_HOUR } from './layout'
import { fetchForecast, type Forecast } from './weather'
import { isPaletteName, type PaletteName } from './palette'

export { svgToPng, SCREEN_W, SCREEN_H } from './render'
export { buildDashboardSvg } from './layout'
export { fetchForecast } from './weather'
export { fetchEpaperData, deriveEpaperData } from './data'

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

  // The panel still appends `&page=N` from its button counter. There is one
  // page now, so it is read and ignored rather than removed from the firmware —
  // dropping a page needs no reflash, which was the point of sending a counter
  // instead of a page name.

  // Berlin's hour, not the server's — the panel hangs in a flat, not in iad1.
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', hour: '2-digit', hour12: false,
  }).format(new Date()))

  // Evening and night look at tomorrow. `?forecastDay` overrides it so either
  // day can be previewed at any hour.
  const evening = hour >= FORECAST_FROM_HOUR
  const dayOffset = query.forecastDay !== undefined
    ? Math.max(0, Math.min(1, Number(query.forecastDay) || 0))
    : (evening ? 1 : 0)

  const [data, forecast] = await Promise.all([
    fetchEpaperData(),
    // A forecast outage must not take the panel down with it — the indoor half
    // is the part that cannot be got anywhere else.
    fetchForecast(dayOffset).catch((err): Forecast | null => {
      console.warn('[epaper] forecast unavailable:', err instanceof Error ? err.message : err)
      return null
    }),
  ])

  const forcedHour = query.hour !== undefined ? Number(query.hour) : hour
  return {
    svg: buildDashboardSvg(data, palette, battery, forecast, forcedHour),
    palette,
  }
}
