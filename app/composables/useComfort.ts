/**
 * Comfort model for HANS.
 *
 * Indoor rooms are judged against the ASHRAE-55 comfort zone
 * (≈20–24 °C and 30–60 % RH) — the industry standard for indoor thermal
 * comfort — producing a 0–100 proximity score (for the heatmap gradient)
 * plus a human-readable label. Air "heaviness" is reported separately via
 * the dew point, which is the definitive measure of how humid air feels.
 *
 * Outdoor sensors (the balcony) are NOT held to indoor comfort rules; they
 * get a "feels like" reading (heat index when warm) and a dew-point label.
 */

// ASHRAE-55 comfort band (typical, light clothing, sedentary) — used for the
// pass/fail verdict label.
const T_LO = 20, T_HI = 24
const RH_LO = 30, RH_HI = 60

// Ideal target the score decays away from, so the number reacts within the
// normal range instead of pinning at 100 across the whole comfort box.
const T_IDEAL = 21.5, RH_IDEAL = 45

export type ComfortTone = 'good' | 'warn' | 'bad' | 'neutral'

/**
 * 0–100 indoor comfort. 100 only at the ideal point (21.5 °C / 45 % RH); it
 * decays with distance from ideal — temperature weighted more heavily than
 * humidity, since a few degrees is felt far more than a few % RH. This keeps
 * the score discriminating across normal indoor conditions instead of pinning
 * at 100 everywhere inside the comfort box.
 */
export function comfortScore(T: number | null, RH: number | null): number | null {
  if (T === null || RH === null) return null
  const dt = Math.abs(T - T_IDEAL)
  const dh = Math.abs(RH - RH_IDEAL)
  return Math.round(Math.max(0, Math.min(100, 100 - dt * 6 - dh * 0.6)))
}

/** Human-readable indoor comfort verdict, e.g. "comfortable", "cold & humid". */
export function comfortLabel(T: number | null, RH: number | null): { text: string; tone: ComfortTone } {
  if (T === null || RH === null) return { text: 'no data', tone: 'neutral' }
  const flags: string[] = []
  if (T < T_LO) flags.push('cold')
  else if (T > T_HI) flags.push('warm')
  if (RH < RH_LO) flags.push('dry')
  else if (RH > RH_HI) flags.push('humid')

  if (!flags.length) return { text: 'comfortable', tone: 'good' }
  const score = comfortScore(T, RH) ?? 0
  return { text: flags.join(' & '), tone: score < 55 ? 'bad' : 'warn' }
}

/** Dew point in °C via the Magnus formula. */
export function dewPoint(T: number | null, RH: number | null): number | null {
  if (T === null || RH === null || RH <= 0) return null
  const a = 17.27, b = 237.7
  const gamma = (a * T) / (b + T) + Math.log(RH / 100)
  return +((b * gamma) / (a - gamma)).toFixed(1)
}

/** How "heavy" the air feels, keyed off dew point (universal, indoor + out). */
export function dewPointLabel(dp: number | null): { text: string; tone: ComfortTone } {
  if (dp === null) return { text: 'no data', tone: 'neutral' }
  if (dp < 10) return { text: 'dry air', tone: 'good' }
  if (dp < 13) return { text: 'very comfortable', tone: 'good' }
  if (dp < 16) return { text: 'comfortable', tone: 'good' }
  if (dp < 18) return { text: 'slightly humid', tone: 'warn' }
  if (dp < 21) return { text: 'humid', tone: 'warn' }
  return { text: 'oppressive', tone: 'bad' }
}

/**
 * Apparent temperature for outdoor readings. Uses the NWS heat-index
 * regression when it's warm enough to matter (≥27 °C), otherwise returns the
 * dry-bulb temperature (no wind data, so no cold wind-chill).
 */
export function feelsLike(T: number | null, RH: number | null): number | null {
  if (T === null || RH === null) return null
  if (T < 27) return +T.toFixed(1)
  const Tf = T * 9 / 5 + 32
  let hi =
    -42.379 + 2.04901523 * Tf + 10.14333127 * RH - 0.22475541 * Tf * RH -
    0.00683783 * Tf * Tf - 0.05481717 * RH * RH + 0.00122874 * Tf * Tf * RH +
    0.00085282 * Tf * RH * RH - 0.00000199 * Tf * Tf * RH * RH
  // Low-humidity adjustment
  if (RH < 13 && Tf >= 80 && Tf <= 112) hi -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(Tf - 95)) / 17)
  return +(((hi - 32) * 5) / 9).toFixed(1)
}

/** Single source of truth for which sensors live outdoors. */
export function isOutdoorSparrow(id: string): boolean {
  return id.toLowerCase().includes('balcony')
}
