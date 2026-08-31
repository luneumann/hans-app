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

  return deriveEpaperData(await fetchReadings(supabase, since, 27000))
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

// ─── Comfort rhythm ──────────────────────────────────────────────────────────

/**
 * Hue encodes the *direction* of discomfort, not just its amount.
 *
 * A six-colour panel cannot render the web app's continuous gradient, so
 * rather than fake one, the scale splits `bad` into its two causes. Knowing
 * the bedroom goes cold at 04:00 and the kitchen goes warm at 19:00 is the
 * whole point of looking at a week at once; a single "poor" colour would hide
 * exactly that.
 */
export type RhythmTone = 'good' | 'warn' | 'cold' | 'hot' | 'none'

export interface RhythmData {
  /** Seven days, oldest first, 24 hourly cells each. */
  days: { label: string; cells: RhythmTone[] }[]
  /** Latest outdoor reading, so this page can carry it too. */
  outdoor: { name: string; temp: number | null; humidity: number | null } | null
  updatedAt: Date | null
  stale: boolean
}

const RHYTHM_DAYS = 7

export async function fetchRhythmData(): Promise<RhythmData> {
  const url = process.env.SUPABASE_URL
  const key = serviceKey()
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const since = new Date(Date.now() - RHYTHM_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Headroom over the ~12 000 rows a week currently produces, so adding
  // sensors does not quietly start clipping the oldest row again.
  return deriveRhythmData(await fetchReadings(supabase, since, 45000))
}

/**
 * Berlin's offset from UTC, in minutes, as of now.
 *
 * Applied uniformly across the window rather than per row — resolving the zone
 * 20 000 times would dominate the request. The cost is that the one week a
 * year containing a DST switch is skewed by an hour on the far side of it.
 */
function berlinOffsetMinutes(): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((asUtc - now.getTime()) / 60000)
}

export function deriveRhythmData(rows: Reading[]): RhythmData {
  // Pulled out before the filter — the tiles are indoor-only, but the page
  // still shows the current outdoor reading, and it is already in these rows.
  const outdoorId = [...new Set(rows.map(r => r.sparrow_id))].find(isOutdoorSparrow) ?? null
  const lastOutdoor = (metric: string): number | null => {
    let v: number | null = null
    for (const r of rows) if (r.sparrow_id === outdoorId && r.metric === metric) v = r.value
    return v
  }
  const outdoor = outdoorId
    ? { name: prettyName(outdoorId), temp: lastOutdoor('temperature'), humidity: lastOutdoor('humidity') }
    : null

  // Outdoor readings would drag the comfort picture around, and the panel's
  // own sensor is excluded for the same reason it is hidden elsewhere.
  rows = rows.filter(r => !HIDDEN_SPARROWS.has(r.sparrow_id) && !isOutdoorSparrow(r.sparrow_id))

  const offset = berlinOffsetMinutes() * 60000
  const local = (iso: string) => new Date(new Date(iso).getTime() + offset)

  const todayLocal = new Date(Date.now() + offset)
  const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`

  // One bucket per (day, hour), averaging every indoor sensor reporting in it.
  const buckets = new Map<string, { t: number[]; h: number[] }>()
  for (const r of rows) {
    const d = local(r.recorded_at)
    const k = `${dayKey(d)}|${d.getUTCHours()}`
    let b = buckets.get(k)
    if (!b) { b = { t: [], h: [] }; buckets.set(k, b) }
    if (r.metric === 'temperature') b.t.push(r.value)
    else b.h.push(r.value)
  }

  const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

  const days: RhythmData['days'] = []
  for (let back = RHYTHM_DAYS - 1; back >= 0; back--) {
    const d = new Date(todayLocal.getTime() - back * 24 * 60 * 60 * 1000)
    const cells: RhythmTone[] = []
    for (let hour = 0; hour < 24; hour++) {
      const b = buckets.get(`${dayKey(d)}|${hour}`)
      const T = b ? avg(b.t) : null
      const RH = b ? avg(b.h) : null
      if (T === null || RH === null) { cells.push('none'); continue }
      const { tone } = comfortLabel(T, RH)
      if (tone === 'good') cells.push('good')
      else if (tone === 'warn') cells.push('warn')
      else cells.push(T < 21.5 ? 'cold' : 'hot')
    }
    days.push({
      label: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      cells,
    })
  }

  const lastIso = rows.length ? rows[rows.length - 1].recorded_at : null
  const updatedAt = lastIso ? new Date(lastIso) : null
  return {
    days,
    outdoor,
    updatedAt,
    stale: !updatedAt || Date.now() - updatedAt.getTime() > 60 * 60 * 1000,
  }
}
