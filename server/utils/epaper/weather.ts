/**
 * Forecast for the panel, from Open-Meteo.
 *
 * No API key and no account, which matters for a device that refreshes four
 * times an hour: nothing to rotate, nothing to run out of. Coordinates are
 * Speyer; the service resolves them to a 108 m grid point.
 */

const LAT = 49.3172
const LON = 8.4311
const TZ = 'Europe/Berlin'

export interface HourlyPoint {
  hour: number
  /** Millimetres in that hour. */
  mm: number
  /** Chance of any precipitation, 0–100. */
  chance: number
  /** Outdoor air temperature at the top of the hour. */
  temp: number | null
}

export interface Forecast {
  /** Local date the figures describe, as YYYY-MM-DD. */
  date: string
  low: number | null
  high: number | null
  /** Total millimetres across the day. */
  rainTotal: number
  hourly: HourlyPoint[]
}

interface OpenMeteoResponse {
  daily: {
    time: string[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
  }
  hourly: {
    time: string[]
    precipitation: (number | null)[]
    precipitation_probability: (number | null)[]
    temperature_2m: (number | null)[]
  }
}

/**
 * `dayOffset` 0 is today, 1 tomorrow. Open-Meteo returns local timestamps for
 * the requested zone, so the hour can be read straight off the string rather
 * than converted — which also sidesteps the DST edge cases.
 */
export async function fetchForecast(dayOffset: number): Promise<Forecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(LAT))
  url.searchParams.set('longitude', String(LON))
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum')
  url.searchParams.set('hourly', 'precipitation,precipitation_probability,temperature_2m')
  url.searchParams.set('timezone', TZ)
  url.searchParams.set('forecast_days', String(dayOffset + 1))

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`open-meteo responded ${res.status}`)
  const data = (await res.json()) as OpenMeteoResponse

  const date = data.daily.time[dayOffset]
  const hourly: HourlyPoint[] = []
  data.hourly.time.forEach((stamp, i) => {
    if (!stamp.startsWith(date)) return
    hourly.push({
      hour: Number(stamp.slice(11, 13)),
      mm: data.hourly.precipitation[i] ?? 0,
      chance: data.hourly.precipitation_probability[i] ?? 0,
      temp: data.hourly.temperature_2m[i] ?? null,
    })
  })

  return {
    date,
    low: data.daily.temperature_2m_min[dayOffset] ?? null,
    high: data.daily.temperature_2m_max[dayOffset] ?? null,
    rainTotal: data.daily.precipitation_sum[dayOffset] ?? 0,
    hourly,
  }
}
