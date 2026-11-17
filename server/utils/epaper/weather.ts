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

/**
 * The winter question for the forecast day, answered for the car and the
 * pavement rather than for the thermometer.
 *
 * `slippery` outranks `frost` on the panel: if the road ices over, scraping
 * the windscreen is the smaller problem.
 */
export interface WinterRisk {
  /**
   * First freezing hour of the morning window, and the coldest air in it.
   * The start is what the panel shows: once the screen has frozen it stays
   * frozen until scraped, however the air goes after.
   */
  frost: { from: number; low: number } | null
  slippery: { kind: 'freezing rain' | 'snow' | 'black ice'; hour: number; snowCm: number } | null
}

/** One continuous hour of the series, including the evening before the day. */
export interface WinterHour {
  /** Local stamp, YYYY-MM-DDTHH:MM. */
  stamp: string
  temp: number | null
  /** Ground surface temperature; null when the model has none. */
  ground: number | null
  mm: number
  snowCm: number
  code: number | null
}

export interface Forecast {
  /** Local date the figures describe, as YYYY-MM-DD. */
  date: string
  low: number | null
  high: number | null
  /** Total millimetres across the day. */
  rainTotal: number
  hourly: HourlyPoint[]
  winter: WinterRisk
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
    soil_temperature_0cm: (number | null)[]
    snowfall: (number | null)[]
    weather_code: (number | null)[]
  }
}

/** Frost on the windscreen matters before you leave: midnight until 10:00. */
const FROST_UNTIL_HOUR = 10
/** Treat the air as freezing a little above zero — a car roof under a clear sky runs colder than 2 m air. */
const FROST_AIR = 1
/** Rain this recent is still on the road when the surface drops below zero. */
const WET_LOOKBACK_H = 6
const WET_MM = 0.1

const FREEZING_RAIN = new Set([56, 57, 66, 67])
const SNOW = new Set([71, 73, 75, 77, 85, 86])
const RANK = { 'black ice': 1, snow: 2, 'freezing rain': 3 } as const

/**
 * Pure, so it can be fed made-up winters in July. `hours` runs continuously
 * and starts before `date`, so rain from the evening before can freeze on the
 * road overnight.
 *
 * Frost uses the air temperature with a degree of slack, or the ground surface
 * when that has dropped to zero: windscreens frost by radiating into a clear
 * sky, which the surface temperature captures and the 2 m air does not.
 *
 * Slippery is the model's freezing-rain code, snow onto ground near zero, or
 * a frozen surface that was rained on within the last few hours.
 */
export function winterRisk(date: string, hours: WinterHour[]): WinterRisk {
  let frost: WinterRisk['frost'] = null
  let slippery: WinterRisk['slippery'] = null
  let snowCm = 0

  // A plain loop rather than forEach: TypeScript does not follow assignments
  // made inside a callback, and would read `slippery` as never-set below.
  for (let i = 0; i < hours.length; i++) {
    const h = hours[i]
    if (!h.stamp.startsWith(date)) continue
    const hour = Number(h.stamp.slice(11, 13))
    const ground = h.ground ?? h.temp

    if (hour < FROST_UNTIL_HOUR && h.temp !== null) {
      const freezing = h.temp <= FROST_AIR || (ground !== null && ground <= 0)
      if (freezing) frost = frost
        ? { from: frost.from, low: Math.min(frost.low, h.temp) }
        : { from: hour, low: h.temp }
    }

    snowCm += h.snowCm
    let kind: NonNullable<WinterRisk['slippery']>['kind'] | null = null
    if (h.code !== null && FREEZING_RAIN.has(h.code)) kind = 'freezing rain'
    // Snow onto warm ground is slush, not a slide: only near freezing counts.
    else if ((h.snowCm > 0 || (h.code !== null && SNOW.has(h.code))) && ground !== null && ground <= 1) kind = 'snow'
    else if (ground !== null && ground <= 0) {
      const wet = hours.slice(Math.max(0, i - WET_LOOKBACK_H), i + 1).some(p => p.mm >= WET_MM)
      if (wet) kind = 'black ice'
    }
    if (kind && !slippery) slippery = { kind, hour, snowCm: 0 }
    // A worse kind later in the day takes over the label, but keeps the
    // earliest hour: that is when it starts to matter.
    if (kind && slippery && RANK[kind] > RANK[slippery.kind]) slippery.kind = kind
  }

  if (slippery) slippery.snowCm = Math.round(snowCm * 10) / 10
  return { frost, slippery }
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
  url.searchParams.set('hourly',
    'precipitation,precipitation_probability,temperature_2m,soil_temperature_0cm,snowfall,weather_code')
  url.searchParams.set('timezone', TZ)
  url.searchParams.set('forecast_days', String(dayOffset + 1))
  // Yesterday too, so rain from the evening before can freeze overnight even
  // when the panel is looking at today. It shifts the daily arrays by one.
  url.searchParams.set('past_days', '1')
  const day = dayOffset + 1

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`open-meteo responded ${res.status}`)
  const data = (await res.json()) as OpenMeteoResponse

  const date = data.daily.time[day]
  const hourly: HourlyPoint[] = []
  const series: WinterHour[] = []
  data.hourly.time.forEach((stamp, i) => {
    if (!stamp.startsWith(date)) return
    hourly.push({
      hour: Number(stamp.slice(11, 13)),
      mm: data.hourly.precipitation[i] ?? 0,
      chance: data.hourly.precipitation_probability[i] ?? 0,
      temp: data.hourly.temperature_2m[i] ?? null,
    })
  })
  data.hourly.time.forEach((stamp, i) => {
    if (stamp > `${date}T23:59`) return
    series.push({
      stamp,
      temp: data.hourly.temperature_2m[i] ?? null,
      ground: data.hourly.soil_temperature_0cm?.[i] ?? null,
      mm: data.hourly.precipitation[i] ?? 0,
      snowCm: data.hourly.snowfall?.[i] ?? 0,
      code: data.hourly.weather_code?.[i] ?? null,
    })
  })

  return {
    date,
    low: data.daily.temperature_2m_min[day] ?? null,
    high: data.daily.temperature_2m_max[day] ?? null,
    rainTotal: data.daily.precipitation_sum[day] ?? 0,
    hourly,
    winter: winterRisk(date, series),
  }
}
