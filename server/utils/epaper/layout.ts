import type { EpaperData } from './data'
import type { ComfortTone } from '../../../app/composables/useComfort'
import type { PaletteName } from './palette'
import { SCREEN_W, SCREEN_H } from './render'

/**
 * The 800x480 panel layout.
 *
 * Two rules drive every choice here. There are six colours and no greys, so
 * colour has to carry meaning (comfort verdict, indoor vs. outdoor) and never
 * decoration — a tint would come out as dither noise. And text is always pure
 * black on pure white: any other combination halftones, which at 17 px is
 * unreadable from across the room.
 */

const PAD = 32
const RULE = '#000000'

const TONE_FILL: Record<ComfortTone, string> = {
  good: '#00FF00',
  warn: '#FFFF00',
  bad: '#FF0000',
  neutral: '#FFFFFF',
}
// Red is the only primary dark enough to need knocked-out text.
const TONE_INK: Record<ComfortTone, string> = {
  good: '#000000',
  warn: '#000000',
  bad: '#FFFFFF',
  neutral: '#000000',
}

/**
 * On a two-colour panel every tint becomes a 50 % dither, which swallows any
 * text sitting on it. So mono drops colour entirely and encodes the verdict as
 * fill weight instead: bad inverts to solid black, everything else stays paper.
 */
function toneFill(tone: ComfortTone, mono: boolean): string {
  if (!mono) return TONE_FILL[tone]
  return tone === 'bad' ? '#000000' : '#FFFFFF'
}
function toneInk(tone: ComfortTone, mono: boolean): string {
  if (!mono) return TONE_INK[tone]
  return tone === 'bad' ? '#FFFFFF' : '#000000'
}
/** Half-height bar that marks `warn` in mono, where yellow is unavailable. */
function toneHatch(tone: ComfortTone, mono: boolean, x: number, y: number, size: number): string {
  if (!mono || tone !== 'warn') return ''
  return `<rect x="${x}" y="${y + size / 2}" width="${size}" height="${size / 2}" fill="#000000"/>`
}

const FONT = 'Geist, Helvetica Neue, Helvetica, Arial, sans-serif'

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

/** Polyline through the series, fitted to the given box. */
function sparkline(series: number[], x: number, y: number, w: number, h: number, stroke: string): string {
  if (series.length < 2) return ''
  const lo = Math.min(...series)
  const hi = Math.max(...series)
  const span = hi - lo || 1
  const pts = series.map((v, i) => {
    const px = x + (i / (series.length - 1)) * w
    const py = y + h - ((v - lo) / span) * h
    return `${px.toFixed(1)},${py.toFixed(1)}`
  }).join(' ')
  return `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="3"
    stroke-linejoin="round" stroke-linecap="round"/>`
}

/**
 * Battery pill for the header. The panel is the only thing that knows its own
 * charge, so it passes the value in on the URL; absent means "not reported"
 * and the header simply falls back to the timestamp alone.
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

export function buildSvg(
  d: EpaperData,
  palette: PaletteName = 'spectra6',
  batteryPct: number | null = null,
): string {
  const mono = palette === 'mono'
  const accent = mono ? '#000000' : '#0000FF'
  const parts: string[] = []
  const push = (s: string) => parts.push(s)

  push(`<rect width="${SCREEN_W}" height="${SCREEN_H}" fill="#FFFFFF"/>`)

  // ── Header ────────────────────────────────────────────────────────────────
  push(`<text x="${PAD}" y="46" font-size="34" font-weight="600"
    letter-spacing="6" fill="#000000">HANS</text>`)
  // The battery pill claims the right edge; the timestamp shifts left to clear
  // it rather than trying to measure text width in a headless renderer.
  const stampRight = batteryPct === null ? SCREEN_W - PAD : SCREEN_W - PAD - 106
  push(`<text x="${stampRight}" y="46" font-size="18" text-anchor="end"
    fill="${d.stale && !mono ? '#FF0000' : '#000000'}">${esc(
      d.stale ? `stale · ${formatStamp(d.updatedAt)}` : formatStamp(d.updatedAt),
    )}</text>`)
  if (batteryPct !== null) push(battery(batteryPct, SCREEN_W - PAD - 72, 46, mono))
  push(`<rect x="${PAD}" y="66" width="${SCREEN_W - PAD * 2}" height="3" fill="${RULE}"/>`)

  // ── Hero: house average ───────────────────────────────────────────────────
  push(`<text x="${PAD}" y="196" font-size="124" font-weight="300"
    fill="#000000">${esc(num(d.house.temp))}°</text>`)
  push(`<text x="${PAD}" y="238" font-size="22" fill="#000000">${esc(
    `${num(d.house.humidity, 0)} % rel · dew point ${num(d.house.dew)}°`,
  )}</text>`)

  // Comfort verdict. The only place a score and a colour appear together.
  const badgeY = 268
  push(`<rect x="${PAD}" y="${badgeY}" width="380" height="88" rx="10"
    fill="${toneFill(d.house.tone, mono)}" stroke="${RULE}" stroke-width="3"/>`)
  push(`<text x="${PAD + 26}" y="${badgeY + 62}" font-size="52" font-weight="600"
    fill="${toneInk(d.house.tone, mono)}">${d.house.score ?? '--'}</text>`)
  push(`<text x="${PAD + 128}" y="${badgeY + 40}" font-size="17" letter-spacing="2"
    fill="${toneInk(d.house.tone, mono)}">COMFORT</text>`)
  push(`<text x="${PAD + 128}" y="${badgeY + 68}" font-size="26"
    fill="${toneInk(d.house.tone, mono)}">${esc(d.house.label)}</text>`)

  // ── Room column ───────────────────────────────────────────────────────────
  const colX = 470
  push(`<rect x="${colX}" y="66" width="3" height="${372 - 66}" fill="${RULE}"/>`)

  const listX = colX + 26
  const rightX = SCREEN_W - PAD
  const rows = d.rooms.slice(0, 5)
  const rowH = rows.length > 4 ? 56 : 66
  rows.forEach((room, i) => {
    const y = 128 + i * rowH
    // Tone square rather than a coloured label: keeps the type pure black.
    push(`<rect x="${listX}" y="${y - 15}" width="16" height="16"
      fill="${toneFill(room.tone, mono)}" stroke="${RULE}" stroke-width="2"/>`)
    push(toneHatch(room.tone, mono, listX, y - 15, 16))
    push(`<text x="${listX + 28}" y="${y}" font-size="22"
      fill="#000000">${esc(room.name)}</text>`)
    push(`<text x="${rightX}" y="${y}" font-size="26" text-anchor="end"
      fill="#000000">${esc(num(room.temp))}°</text>`)
    push(`<text x="${rightX}" y="${y + 22}" font-size="16" text-anchor="end"
      fill="#000000">${esc(num(room.humidity, 0))} %</text>`)
  })
  if (!rows.length) {
    push(`<text x="${listX}" y="140" font-size="20" fill="#000000">no sensors reporting</text>`)
  }

  // ── Bottom band: 24 h trend + outdoor ─────────────────────────────────────
  push(`<rect x="${PAD}" y="386" width="${SCREEN_W - PAD * 2}" height="3" fill="${RULE}"/>`)

  push(`<text x="${PAD}" y="414" font-size="14" letter-spacing="2"
    fill="#000000">INDOOR · 24 H</text>`)
  push(sparkline(d.series, PAD, 424, 320, 38, accent))
  if (d.series.length >= 2) {
    const lo = Math.min(...d.series), hi = Math.max(...d.series)
    push(`<text x="${PAD + 336}" y="440" font-size="16"
      fill="#000000">${esc(`${num(hi)}° high`)}</text>`)
    push(`<text x="${PAD + 336}" y="462" font-size="16"
      fill="#000000">${esc(`${num(lo)}° low`)}</text>`)
  }

  if (d.outdoor) {
    push(`<rect x="${colX}" y="386" width="3" height="${SCREEN_H - 386}" fill="${RULE}"/>`)
    push(`<text x="${listX}" y="414" font-size="14" letter-spacing="2"
      fill="${accent}">OUTDOOR · ${esc(d.outdoor.name.toUpperCase())}</text>`)
    push(`<text x="${listX}" y="458" font-size="34"
      fill="#000000">${esc(num(d.outdoor.temp))}°</text>`)
    push(`<text x="${rightX}" y="458" font-size="24" text-anchor="end"
      fill="#000000">${esc(num(d.outdoor.humidity, 0))} %</text>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SCREEN_W}" height="${SCREEN_H}"
    viewBox="0 0 ${SCREEN_W} ${SCREEN_H}" font-family="${FONT}">${parts.join('')}</svg>`
}
