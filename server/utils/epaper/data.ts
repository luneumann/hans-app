import { createClient } from '@supabase/supabase-js'
import {
  comfortScore, comfortLabel, dewPoint, feelsLike, isOutdoorSparrow,
  type ComfortTone,
} from '../../../app/composables/useComfort'

interface Reading {
  sparrow_id: string
  metric: string
  value: number
  recorded_at: string
}

export interface Room {
  id: string
  name: string
  temp: number | null
  humidity: number | null
  score: number | null
  tone: ComfortTone
}

export interface EpaperData {
  rooms: Room[]
  outdoor: { name: string; temp: number | null; humidity: number | null; feels: number | null } | null
  house: {
    temp: number | null
    humidity: number | null
    dew: number | null
    score: number | null
    label: string
    tone: ComfortTone
  }
  /** Indoor average temperature over the window, for the sparkline. */
  series: number[]
  updatedAt: Date | null
  /** No reading in the last hour — the panel should say so rather than lie. */
  stale: boolean
}

const WINDOW_HOURS = 24

/**
 * Sensors that keep recording but stay off the panel.
 *
 * `hallway` is the display's own SHT4x, sitting inside a warm enclosure and
 * reading several degrees above the room. It stands in the open space that
 * `living` also covers, so whether the two track linearly — or are simply not
 * comparable — is worth measuring properly later. Until then it would only
 * skew the house average that the hero number shows.
 *
 * This hides it from the display only; the inserts continue, so the history
 * needed for that comparison keeps accumulating.
 */
const HIDDEN_SPARROWS = new Set(['hallway'])

function prettyName(id: string): string {
  const s = id.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function mean(vals: number[]): number | null {
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export async function fetchEpaperData(): Promise<EpaperData> {
  const url = process.env.SUPABASE_URL
  // The anon key is INSERT-only under RLS (see firmware/sparrow_sensor) — the
  // browser app reads through a logged-in session, which the panel has no way
  // to hold. So this route reads with the service key, which is why it must
  // stay server-side and behind EPAPER_TOKEN.
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY are not set')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('sensor_readings')
    .select('sparrow_id, metric, value, recorded_at')
    .gte('recorded_at', since)
    .in('metric', ['temperature', 'humidity'])
    .order('recorded_at', { ascending: true })
    .limit(50000)
  if (error) throw error

  const rows = (data ?? []) as Reading[]
  return deriveEpaperData(rows)
}

/** Pure shaping step, split out so it can be exercised without a database. */
export function deriveEpaperData(rows: Reading[]): EpaperData {
  rows = rows.filter(r => !HIDDEN_SPARROWS.has(r.sparrow_id))
  const ids = [...new Set(rows.map(r => r.sparrow_id))].sort()

  const latest = (id: string, metric: string): number | null => {
    let out: number | null = null
    for (const r of rows) if (r.sparrow_id === id && r.metric === metric) out = r.value
    return out
  }

  const indoorIds = ids.filter(id => !isOutdoorSparrow(id))
  const outdoorId = ids.find(isOutdoorSparrow) ?? null

  const rooms: Room[] = indoorIds.map(id => {
    const temp = latest(id, 'temperature')
    const humidity = latest(id, 'humidity')
    return {
      id,
      name: prettyName(id),
      temp,
      humidity,
      score: comfortScore(temp, humidity),
      tone: comfortLabel(temp, humidity).tone,
    }
  })

  const houseTemp = mean(rooms.map(r => r.temp).filter((v): v is number => v !== null))
  const houseHum = mean(rooms.map(r => r.humidity).filter((v): v is number => v !== null))
  const verdict = comfortLabel(houseTemp, houseHum)

  // Indoor average temperature bucketed into ~5-minute slots, so the sparkline
  // reflects elapsed time rather than however many rows each sensor happened
  // to produce.
  const series = buildSeries(rows.filter(r => !isOutdoorSparrow(r.sparrow_id) && r.metric === 'temperature'))

  const lastIso = rows.length ? rows[rows.length - 1].recorded_at : null
  const updatedAt = lastIso ? new Date(lastIso) : null

  return {
    rooms,
    outdoor: outdoorId
      ? {
          name: prettyName(outdoorId),
          temp: latest(outdoorId, 'temperature'),
          humidity: latest(outdoorId, 'humidity'),
          feels: feelsLike(latest(outdoorId, 'temperature'), latest(outdoorId, 'humidity')),
        }
      : null,
    house: {
      temp: houseTemp,
      humidity: houseHum,
      dew: dewPoint(houseTemp, houseHum),
      score: comfortScore(houseTemp, houseHum),
      label: verdict.text,
      tone: verdict.tone,
    },
    series,
    updatedAt,
    stale: !updatedAt || Date.now() - updatedAt.getTime() > 60 * 60 * 1000,
  }
}

function buildSeries(rows: Reading[], buckets = 96): number[] {
  if (!rows.length) return []
  const start = new Date(rows[0].recorded_at).getTime()
  const end = new Date(rows[rows.length - 1].recorded_at).getTime()
  const span = Math.max(1, end - start)

  const sums = new Array(buckets).fill(0)
  const counts = new Array(buckets).fill(0)
  for (const r of rows) {
    const t = new Date(r.recorded_at).getTime()
    const b = Math.min(buckets - 1, Math.floor(((t - start) / span) * buckets))
    sums[b] += r.value
    counts[b]++
  }

  // Carry the last known value across empty buckets so a sensor gap reads as a
  // flat line rather than a drop to zero.
  const out: number[] = []
  let last: number | null = null
  for (let i = 0; i < buckets; i++) {
    if (counts[i]) last = sums[i] / counts[i]
    if (last !== null) out.push(last)
  }
  return out
}
