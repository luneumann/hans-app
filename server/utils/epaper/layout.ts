import type { EpaperData, RhythmData, RhythmTone } from './data'
import type { Forecast } from './weather'
import { dewPoint, type ComfortTone } from '../../../app/composables/useComfort'
import type { PaletteName } from './palette'
import { SCREEN_W, SCREEN_H } from './render'

/**
 * The two panel pages: the everyday dashboard, and the weekly comfort rhythm.
 *
 * Two constraints shape all of them. There are six colours and no greys, so
 * colour carries meaning (comfort verdict, indoor vs. outdoor) and never
 * decoration — a tint would come out as dither noise. And text is always pure
 * black on pure white: any other pairing halftones, which at 17 px is
 * unreadable from across the room.
 */

const PAD = 32
const RULE = '#000000'
const FONT = 'Geist, Helvetica Neue, Helvetica, Arial, sans-serif'

const TONE_FILL: Record<ComfortTone, string> = {
  good: '#00FF00', warn: '#FFFF00', bad: '#FF0000', neutral: '#FFFFFF',
}
// Spectra-6 green and red both render dark enough that black type disappears
// into them; yellow is light enough to carry it.
const TONE_INK: Record<ComfortTone, string> = {
  good: '#FFFFFF', warn: '#000000', bad: '#FFFFFF', neutral: '#000000',
}

interface Ctx {
  mono: boolean
  accent: string
  push: (s: string) => void
}

/**
 * On a two-colour panel every tint becomes a 50 % dither, which swallows any
 * text sitting on it. Mono therefore drops colour and encodes the verdict as
 * fill weight: bad inverts to solid black, everything else stays paper.
 */
function toneFill(tone: ComfortTone, mono: boolean): string {
  if (!mono) return TONE_FILL[tone]
  return tone === 'bad' ? '#000000' : '#FFFFFF'
}
function toneInk(tone: ComfortTone, mono: boolean): string {
  if (!mono) return TONE_INK[tone]
  return tone === 'bad' ? '#FFFFFF' : '#000000'
}
/** Half-height bar marking `warn` in mono, where yellow is unavailable. */
function toneHatch(tone: ComfortTone, mono: boolean, x: number, y: number, size: number): string {
  if (!mono || tone !== 'warn') return ''
  return `<rect x="${x}" y="${y + size / 2}" width="${size}" height="${size / 2}" fill="#000000"/>`
}

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, c => (
    { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!
  ))
}

const num = (v: number | null, d = 1): string => (v === null ? '--' : v.toFixed(d))

function formatStamp(d: Date | null): string {
  if (!d) return 'no readings'
  return d.toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Europe/Berlin',
  }).replace(',', ' ·')
}

/** Small caps label. Deliberately tiny — the number is the content. */
function label(text: string, x: number, y: number, fill = '#000000', anchor = 'start'): string {
  return `<text x="${x}" y="${y}" font-size="13" letter-spacing="2" text-anchor="${anchor}"
    fill="${fill}">${esc(text.toUpperCase())}</text>`
}

/**
 * Battery pill. The panel is the only thing that knows its own charge, so it
 * passes the value in on the URL; absent means "not reported".
 */
function battery(pct: number, x: number, y: number, mono: boolean): string {
  const w = 34, h = 16
  const fill = pct <= 15 && !mono ? '#FF0000' : '#000000'
  const inner = Math.max(1, Math.round((w - 6) * Math.min(100, Math.max(0, pct)) / 100))
  return [
    `<rect x="${x}" y="${y - h + 3}" width="${w}" height="${h}" rx="3"
      fill="#FFFFFF" stroke="#000000" stroke-width="2"/>`,
    `<rect x="${x + w + 1}" y="${y - h + 8}" width="3" height="6" fill="#000000"/>`,
    `<rect x="${x + 3}" y="${y - h + 6}" width="${inner}" height="${h - 6}" fill="${fill}"/>`,
    `<text x="${x + w + 12}" y="${y}" font-size="18" fill="#000000">${pct} %</text>`,
  ].join('')
}

function header(d: EpaperData, batteryPct: number | null, ctx: Ctx): void {
  ctx.push(`<text x="${PAD}" y="46" font-size="30" font-weight="600"
    letter-spacing="6" fill="#000000">HANS</text>`)
  // The battery pill claims the right edge; the timestamp shifts left to clear
  // it rather than measuring text width in a headless renderer.
  const stampRight = batteryPct === null ? SCREEN_W - PAD : SCREEN_W - PAD - 106
  ctx.push(`<text x="${stampRight}" y="46" font-size="17" text-anchor="end"
    fill="${d.stale && !ctx.mono ? '#FF0000' : '#000000'}">${esc(
      d.stale ? `stale · ${formatStamp(d.updatedAt)}` : formatStamp(d.updatedAt),
    )}</text>`)
  if (batteryPct !== null) ctx.push(battery(batteryPct, SCREEN_W - PAD - 72, 46, ctx.mono))
  ctx.push(`<rect x="${PAD}" y="64" width="${SCREEN_W - PAD * 2}" height="3" fill="${RULE}"/>`)
}

// ─── dashboard ───────────────────────────────────────────────────────────────
// Right half is always the indoor reading. Left half changes with the clock:
// from 18:00 through 10:00 the next morning it carries tomorrow's forecast,
// which is when that is worth knowing; the rest of the day it answers the
// question the forecast cannot — whether opening the windows would help.

/** Vertical rule between the two halves. */
const SPLIT_X = 462

/** The forecast holds the left panel from this hour until that one, next day. */
export const FORECAST_FROM_HOUR = 21
export const FORECAST_UNTIL_HOUR = 10

function panelIndoor(d: EpaperData, ctx: Ctx): void {
  const { push, mono } = ctx
  const x = SPLIT_X + 26

  push(label('indoor', x, 104))
  push(`<text x="${x}" y="190" font-size="92" font-weight="300"
    fill="#000000">${esc(num(d.house.temp))}°</text>`)
  push(`<text x="${x}" y="226" font-size="22"
    fill="#000000">${esc(`${num(d.house.humidity, 0)} % rel`)}</text>`)
  push(`<text x="${x}" y="254" font-size="18"
    fill="#000000">${esc(`dew point ${num(d.house.dew)}°`)}</text>`)

  const by = 286
  push(`<rect x="${x}" y="${by}" width="${SCREEN_W - PAD - x}" height="84" rx="10"
    fill="${toneFill(d.house.tone, mono)}" stroke="${RULE}" stroke-width="3"/>`)
  push(toneHatch(d.house.tone, mono, x, by, 84))
  push(`<text x="${x + 22}" y="${by + 58}" font-size="46" font-weight="600"
    fill="${toneInk(d.house.tone, mono)}">${d.house.score ?? '--'}</text>`)
  push(label('comfort', x + 96, by + 34, toneInk(d.house.tone, mono)))
  push(`<text x="${x + 96}" y="${by + 64}" font-size="22"
    fill="${toneInk(d.house.tone, mono)}">${esc(d.house.label)}</text>`)

  // Outdoor sits below the rule on every page and at every hour — the one
  // reading you want without having to think about what the panel is showing.
  // It comes from the balcony sparrow rather than the forecast: a measurement
  // at the window beats a grid point five kilometres away.
  const oy = 404
  push(`<rect x="${x}" y="${oy - 26}" width="${SCREEN_W - PAD - x}" height="2" fill="${RULE}"/>`)
  push(label(d.outdoor ? `outdoor · ${d.outdoor.name}` : 'outdoor', x, oy, ctx.accent))
  if (d.outdoor) {
    push(`<text x="${x}" y="${oy + 50}" font-size="52" font-weight="300"
      fill="#000000">${esc(num(d.outdoor.temp))}°</text>`)
    push(`<text x="${SCREEN_W - PAD}" y="${oy + 50}" font-size="24" text-anchor="end"
      fill="#000000">${esc(num(d.outdoor.humidity, 0))} %</text>`)
  } else {
    push(`<text x="${x}" y="${oy + 44}" font-size="24"
      fill="#000000">sensor not reporting</text>`)
  }
}

/** Weekday and date, so the panel never has to claim "today" or "tomorrow". */
function forecastTitle(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function panelForecast(f: Forecast | null, ctx: Ctx): void {
  const { push, accent } = ctx

  if (!f) {
    push(label('forecast · speyer', PAD, 104))
    push(`<text x="${PAD}" y="180" font-size="30" fill="#000000">forecast unavailable</text>`)
    return
  }

  push(label(`${forecastTitle(f.date)} · speyer`, PAD, 104))
  // The high is what a forecast is read for; the low trails it at half the
  // size, the way every weather app sets it.
  push(`<text x="${PAD}" y="192" font-size="86" font-weight="300"
    fill="#000000">${esc(`${num(f.high, 0)}°`)}</text>`)
  push(`<text x="${PAD + 140}" y="192" font-size="44" font-weight="300"
    fill="#000000">${esc(`${num(f.low, 0)}°`)}</text>`)

  const peak = Math.max(...f.hourly.map(h => h.mm), 0)
  const bx = PAD, bw = SPLIT_X - 30 - PAD
  const base = 352, maxH = 92
  const colW = bw / 24

  if (peak <= 0) {
    // No bars, no axis, no baseline. An hour axis with nothing on it is what
    // made the message look stranded — the absence of rain is a statement, not
    // a chart that failed to draw.
    push(label('rain', PAD, 238))
    push(`<text x="${bx}" y="272" font-size="34" fill="#000000">no rain expected</text>`)
  } else {
    push(label('rain by hour', PAD, 238))
    push(`<rect x="${bx}" y="${base}" width="${bw}" height="2" fill="${RULE}"/>`)
    // Scale to at least 1 mm so a drizzle does not draw like a downpour.
    const scale = Math.max(peak, 1)
    for (const h of f.hourly) {
      if (h.mm <= 0) continue
      const bh = Math.max(3, (h.mm / scale) * maxH)
      push(`<rect x="${(bx + h.hour * colW + 1).toFixed(1)}" y="${(base - bh).toFixed(1)}"
        width="${(colW - 2).toFixed(1)}" height="${bh.toFixed(1)}" fill="${accent}"/>`)
    }
    push(`<text x="${bx + bw}" y="${base - maxH + 4}" font-size="15" text-anchor="end"
      fill="#000000">${esc(`${peak.toFixed(1)} mm peak`)}</text>`)
    for (const h of [0, 6, 12, 18]) {
      push(label(String(h).padStart(2, '0'), bx + h * colW, base + 24))
    }
    push(label('24', bx + bw, base + 24, '#000000', 'end'))
  }

  const wettest = f.hourly.reduce((a, b) => (b.mm > a.mm ? b : a), f.hourly[0])
  const summary = f.rainTotal > 0
    ? `${f.rainTotal.toFixed(1)} mm total · heaviest around ${String(wettest.hour).padStart(2, '0')}:00`
    : `${Math.max(...f.hourly.map(h => h.chance), 0)} % peak chance of a shower`
  push(`<text x="${bx}" y="${peak > 0 ? base + 62 : 302}" font-size="19"
    fill="#000000">${esc(summary)}</text>`)
}

/**
 * The indoor day, at a size worth reading across the room.
 *
 * A stroked line rather than a filled area. Filling made sense while the scale
 * was tight enough for the curve to work the whole height; against a six-degree
 * floor the shape only occupies a third of it, and the fill below turns into a
 * solid block with a faint ripple on top — a lot of ink saying very little.
 */
function panelDayCourse(d: EpaperData, ctx: Ctx): void {
  const { push, accent } = ctx

  push(label('indoor · last 24 h', PAD, 104))

  const x = PAD, w = SPLIT_X - 30 - PAD
  const top = 150, base = 392, h = base - top

  if (d.series.length < 2) {
    push(`<text x="${x}" y="${top + 60}" font-size="30" fill="#000000">not enough history yet</text>`)
    return
  }

  const lo = Math.min(...d.series)
  const hi = Math.max(...d.series)
  // A room moves through maybe two degrees in a day. Scaling to whatever range
  // the data happens to have would stretch that across the full height and
  // draw a mountain out of it; a six-degree floor keeps the shape honest about
  // how small the change actually is.
  const span = Math.max(hi - lo, 6)
  const mid = (hi + lo) / 2
  const yTop = mid + span / 2, yBot = mid - span / 2
  const yOf = (v: number) => base - ((v - yBot) / (yTop - yBot)) * h

  const pts = d.series.map((v, i) =>
    `${(x + (i / (d.series.length - 1)) * w).toFixed(1)},${yOf(v).toFixed(1)}`)

  push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${accent}" stroke-width="4"
    stroke-linejoin="round" stroke-linecap="round"/>`)
  push(`<rect x="${x}" y="${base}" width="${w}" height="2" fill="${RULE}"/>`)

  // Value axis: only the two numbers that matter, sitting on their own lines.
  // Dashed rather than a faint grey — opacity has nowhere to go in a six-colour
  // palette and would dither into noise. The labels get a white plate because
  // the filled area runs underneath them at unpredictable heights.
  for (const v of [hi, lo]) {
    const vy = yOf(v)
    push(`<line x1="${x}" y1="${vy.toFixed(1)}" x2="${x + w}" y2="${vy.toFixed(1)}"
      stroke="#000000" stroke-width="1" stroke-dasharray="4 5"/>`)
    const label = `${v.toFixed(1)}°`
    const lw = label.length * 9 + 10
    push(`<rect x="${(x + w - lw).toFixed(1)}" y="${(vy - 22).toFixed(1)}"
      width="${lw}" height="20" fill="#FFFFFF"/>`)
    push(`<text x="${x + w - 5}" y="${(vy - 7).toFixed(1)}" font-size="16" text-anchor="end"
      fill="#000000">${esc(label)}</text>`)
  }

  // Time axis from the real window rather than assuming a full 24 hours — a
  // sensor gap would otherwise mislabel the whole chart.
  if (d.seriesStart && d.seriesEnd) {
    const fmt = (t: Date) => t.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin',
    })
    const span_ms = d.seriesEnd.getTime() - d.seriesStart.getTime()
    for (const frac of [0, 0.5, 1]) {
      const t = new Date(d.seriesStart.getTime() + span_ms * frac)
      const anchor = frac === 0 ? 'start' : frac === 1 ? 'end' : 'middle'
      push(label(fmt(t), x + frac * w, base + 26, '#000000', anchor))
    }
  }

  const now = d.series[d.series.length - 1]
  push(`<text x="${x}" y="${base + 62}" font-size="20" fill="#000000">${esc(
    `now ${now.toFixed(1)}° · ${(now - d.series[0] >= 0 ? '+' : '')}${(now - d.series[0]).toFixed(1)}° over the window`,
  )}</text>`)
}


function layoutDashboard(d: EpaperData, ctx: Ctx, forecast: Forecast | null, hour: number): void {
  ctx.push(`<rect x="${SPLIT_X}" y="64" width="3" height="${SCREEN_H - 64}" fill="${RULE}"/>`)
  panelIndoor(d, ctx)
  // 21:00 through 10:00: the window where the coming day is the useful
  // question. Outside it, the day the flat has actually had.
  if (hour >= FORECAST_FROM_HOUR || hour < FORECAST_UNTIL_HOUR) panelForecast(forecast, ctx)
  else panelDayCourse(d, ctx)
}


// ─── rhythm ──────────────────────────────────────────────────────────────────
// A week of indoor comfort as 7x24 tiles. This is the one place the full
// palette earns its keep: hue says *which way* the room drifted, so a cold
// night and a warm evening are told apart at a glance instead of both reading
// as "poor".

const RHYTHM_FILL: Record<RhythmTone, string> = {
  good: '#00FF00',
  warn: '#FFFF00',
  cold: '#0000FF',
  hot:  '#FF0000',
  none: '#FFFFFF',
}
// Mono keeps the same reading order by weight instead of hue.
const RHYTHM_FILL_MONO: Record<RhythmTone, string> = {
  good: '#FFFFFF', warn: '#FFFFFF', cold: '#000000', hot: '#000000', none: '#FFFFFF',
}

const RHYTHM_LEGEND: { tone: RhythmTone; text: string }[] = [
  { tone: 'cold', text: 'cold' },
  { tone: 'good', text: 'comfortable' },
  { tone: 'warn', text: 'drifting' },
  { tone: 'hot', text: 'warm' },
]

export function buildRhythmSvg(
  r: RhythmData,
  palette: PaletteName = 'spectra6',
  batteryPct: number | null = null,
): string {
  const parts: string[] = []
  const mono = palette === 'mono'
  const ctx: Ctx = {
    mono,
    accent: mono ? '#000000' : '#0000FF',
    push: (s: string) => parts.push(s),
  }
  const { push } = ctx

  push(`<rect width="${SCREEN_W}" height="${SCREEN_H}" fill="#FFFFFF"/>`)
  header({ stale: r.stale, updatedAt: r.updatedAt } as EpaperData, batteryPct, ctx)

  const labelW = 62
  const gridX = PAD + labelW
  const gridW = SCREEN_W - PAD - gridX
  const cellW = gridW / 24
  const top = 92
  const rowH = 40
  const gap = 3

  r.days.forEach((day, row) => {
    const y = top + row * rowH
    push(`<text x="${PAD + labelW - 14}" y="${y + rowH / 2 + 5}" font-size="15"
      text-anchor="end" fill="#000000">${esc(day.label)}</text>`)
    day.cells.forEach((tone, hour) => {
      const x = gridX + hour * cellW
      const fill = mono ? RHYTHM_FILL_MONO[tone] : RHYTHM_FILL[tone]
      // Empty hours get an outline only, so a gap reads as absence rather than
      // as a comfortable white tile.
      push(`<rect x="${x.toFixed(1)}" y="${y}" width="${(cellW - gap).toFixed(1)}"
        height="${rowH - gap}" fill="${fill}"
        stroke="${tone === 'none' ? '#000000' : 'none'}" stroke-width="${tone === 'none' ? 1 : 0}"/>`)
    })
  })

  const axisY = top + r.days.length * rowH + 22
  for (const h of [0, 6, 12, 18]) {
    push(label(String(h).padStart(2, '0'), gridX + h * cellW, axisY))
  }
  push(label('24', SCREEN_W - PAD, axisY, '#000000', 'end'))

  const legendY = axisY + 34
  let lx = PAD
  for (const item of RHYTHM_LEGEND) {
    push(`<rect x="${lx}" y="${legendY - 13}" width="16" height="16"
      fill="${mono ? RHYTHM_FILL_MONO[item.tone] : RHYTHM_FILL[item.tone]}"
      stroke="#000000" stroke-width="2"/>`)
    push(`<text x="${lx + 24}" y="${legendY}" font-size="15" fill="#000000">${esc(item.text)}</text>`)
    lx += 24 + item.text.length * 8 + 26
  }
  // Same corner as the dashboard, but on the legend's own line: stacking it
  // would run into the hour axis directly above and into the bottom edge below.
  if (r.outdoor) {
    push(`<text x="${SCREEN_W - PAD}" y="${legendY + 2}" font-size="26" font-weight="300"
      text-anchor="end" fill="#000000">${esc(num(r.outdoor.temp))}°</text>`)
    push(label(`outdoor · ${r.outdoor.name}`, SCREEN_W - PAD - 76, legendY, ctx.accent, 'end'))
  } else {
    push(label('indoor comfort · 7 days', SCREEN_W - PAD, legendY, '#000000', 'end'))
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}"
    viewBox="0 0 ${SCREEN_W} ${SCREEN_H}" font-family="${FONT}">${parts.join('')}</svg>`
}

export function buildDashboardSvg(
  d: EpaperData,
  palette: PaletteName = 'spectra6',
  batteryPct: number | null = null,
  forecast: Forecast | null = null,
  hour: number = new Date().getHours(),
): string {
  const parts: string[] = []
  const ctx: Ctx = {
    mono: palette === 'mono',
    accent: palette === 'mono' ? '#000000' : '#0000FF',
    push: (s: string) => parts.push(s),
  }

  ctx.push(`<rect width="${SCREEN_W}" height="${SCREEN_H}" fill="#FFFFFF"/>`)
  header(d, batteryPct, ctx)
  layoutDashboard(d, ctx, forecast, hour)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}"
    viewBox="0 0 ${SCREEN_W} ${SCREEN_H}" font-family="${FONT}">${parts.join('')}</svg>`
}
