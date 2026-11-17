import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
  /** Indoor average temperature over the window, oldest first. */
  series: number[]
  /** Wall-clock span the series covers, so a chart can label real hours. */
  seriesStart: Date | null
  seriesEnd: Date | null
  updatedAt: Date | null
  /** No reading in the last hour — the panel should say so rather than lie. */
  stale: boolean
  /** Birdhouse visits as counted by the camera Pi; null when unavailable. */
  birdVisits?: BirdVisits | null
}

export interface BirdVisits {
  /** Berlin calendar day the count belongs to, YYYY-MM-DD. */
  day: string
  yesterday: boolean
  count: number | null
}

/**
 * Before this Berlin hour the panel shows yesterday's visits: early in the
 * morning today's count is still close to zero and says nothing.
 */
export const BIRD_TODAY_FROM_HOUR = 9

function berlinParts(now: Date): { day: string; hour: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(x => [x.type, x.value]))
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) }
}

/** Which Berlin day the panel should count, given the time. Pure, for testing. */
export function birdDay(now: Date): { day: string; yesterday: boolean } {
  const { day, hour } = berlinParts(now)
  if (hour >= BIRD_TODAY_FROM_HOUR) return { day, yesterday: false }
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return { day: d.toISOString().slice(0, 10), yesterday: true }
}

/**
 * The birdhouse Pi appends a row to `birdhouse_visits` whenever a day's count
 * changes (today and yesterday, so late deletions land too). The newest row of
 * a day is the current count. The Pi does the counting because grouping clips
 * into visits and discarding false triggers lives there.
 */
async function fetchBirdVisits(supabase: SupabaseClient, now = new Date()): Promise<BirdVisits> {
  const { day, yesterday } = birdDay(now)
  const { data, error } = await supabase
    .from('birdhouse_visits')
    .select('visits')
    .eq('day', day)
    .order('recorded_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw error
  return { day, yesterday, count: data?.[0]?.visits ?? null }
}

const WINDOW_HOURS = 24

/**
 * PostgREST caps a single response at roughly 10 000 rows regardless of the
 * `limit` asked for, and it truncates silently — no error, just a short array.
 * A week of readings is well past that, so the window has to be walked in
 * pages or the oldest days simply vanish.
 */
const PAGE_SIZE = 9000

async function fetchReadings(
  supabase: SupabaseClient,
  sinceIso: string,
  maxRows: number,
): Promise<Reading[]> {
  const out: Reading[] = []
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('sensor_readings')
      .select('sparrow_id, metric, value, recorded_at')
      .gte('recorded_at', sinceIso)
      .in('metric', ['temperature', 'humidity'])
      // Newest first so a short final page trims the far end of the window,
      // never the present. Reversed once the whole range is in hand.
      .order('recorded_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    const rows = (data ?? []) as Reading[]
    out.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return out.reverse()
}

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

/**
 * The key these routes read with.
 *
 * The anon key is INSERT-only under RLS (see firmware/sparrow_sensor) — the
 * browser app reads through a logged-in session, which the panel has no way to
 * hold. So a service role key is required, and both spellings in circulation
 * are accepted: Supabase's dashboard calls it `service_role`, and this project
 * shortened it at first.
 *
 * Falling back to the anon key keeps the route answering, but PostgREST will
 * return an empty set rather than an error — data that looks merely missing.
 * The warning is the only place that distinction surfaces.
 */
function serviceKey(): string | undefined {
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (service) return service
  if (process.env.SUPABASE_KEY) {
    console.warn(
      '[epaper] no service role key set — falling back to the anon key, which ' +
      'RLS restricts to INSERT. Readings will come back empty.',
    )
  }
  return process.env.SUPABASE_KEY
}

export async function fetchEpaperData(): Promise<EpaperData> {
  const url = process.env.SUPABASE_URL
  const key = serviceKey()
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  const [rows, birdVisits] = await Promise.all([
    fetchReadings(supabase, since, 27000),
    // The birdhouse is a side note; its outage must not take the panel down.
    fetchBirdVisits(supabase).catch((err): null => {
      console.warn('[epaper] bird visits unavailable:', err instanceof Error ? err.message : err)
      return null
    }),
  ])
  return { ...deriveEpaperData(rows), birdVisits }
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
  const tempRows = rows.filter(r => !isOutdoorSparrow(r.sparrow_id) && r.metric === 'temperature')
  const series = buildSeries(tempRows)

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
    seriesStart: tempRows.length ? new Date(tempRows[0].recorded_at) : null,
    seriesEnd: tempRows.length ? new Date(tempRows[tempRows.length - 1].recorded_at) : null,
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
