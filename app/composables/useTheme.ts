/**
 * HANS theme system.
 *
 * One source of truth for every color the app uses.
 *
 * ─── How to tweak ────────────────────────────────────────────────────────────
 * To change a color:    edit a value in THEMES['forest-rose'].tokens
 *To recolor the heatmap: edit comfortStops (OKLch L/C/h at each comfort level)
 * To recolor the aurora:  edit auroraStops (temperature → hue)
 *
 * To add a new theme:   add another entry to THEMES, then call setTheme('name').
 *
 * The plugin app/plugins/theme.ts injects the token values as CSS variables
 * (--bg, --leaf, etc.) so the existing CSS in main.css keeps working.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ThemeTokens {
  bg: string; bgSoft: string; panel: string; panel2: string
  line: string; lineSoft: string
  ink: string; ink2: string; ink3: string; ink4: string
  leaf: string; leafSoft: string
  rose: string; roseSoft: string
  amber: string; amberSoft: string
  sky: string; skySoft: string
  clay: string; claySoft: string
  plum: string; plumSoft: string
}

/** One stop on the heatmap comfort gradient. `at` is 0..1 (score / 100). */
export interface ComfortStop {
  at: number
  L: number
  C: number
  h: number
}

/** One stop on the aurora hue mapping. `temp` in °C → `hue` in OKLch. */
export interface AuroraStop {
  temp: number
  hue: number
}

export interface Theme {
  name: string
  tokens: ThemeTokens
  comfortStops: ComfortStop[]
  auroraStops: AuroraStop[]
}

// ─── Themes ────────────────────────────────────────────────────────────────

export const THEMES: Record<string, Theme> = {
  // Default: deep navy night with flat hex design tokens
  'forest-rose': {
    name: 'Forest & Rose',
    tokens: {
      bg:        '#161a28',
      bgSoft:    '#1a1e30',
      panel:     '#1e2238',
      panel2:    '#222840',
      line:      '#252a40',
      lineSoft:  '#353c60',

      ink:       '#d8dcea',
      ink2:      '#b0b6d1',
      ink3:      '#8890b8',
      ink4:      '#6870a0',

      leaf:      '#6ab87a',
      leafSoft:  'rgba(106, 184, 122, 0.22)',
      rose:      '#e06858',
      roseSoft:  'rgba(224, 104, 88, 0.22)',
      amber:     '#f0b83c',
      amberSoft: 'rgba(240, 184, 60, 0.22)',
      sky:       '#70a8f0',
      skySoft:   'rgba(112, 168, 240, 0.22)',
      clay:      '#e06858',
      claySoft:  'rgba(224, 104, 88, 0.22)',
      plum:      '#8890b8',
      plumSoft:  'rgba(136, 144, 184, 0.22)',
    },
    // Heatmap gradient: rot → salbei → tief blau → dunkelgrün
    // Stops shifted so the 60-100 score range (where real data lives) has
    // three distinct hue zones instead of blending into one teal blob.
    comfortStops: [
      { at: 0.00, L: 0.68, C: 0.16, h: 25  },  // rot
      { at: 0.48, L: 0.76, C: 0.11, h: 140 },  // salbei
      { at: 0.74, L: 0.70, C: 0.16, h: 232 },  // tief blau
      { at: 1.00, L: 0.72, C: 0.17, h: 148 },  // dunkelgrün
    ],
    // Aurora hue mapping by temperature
    auroraStops: [
      { temp: 15, hue: 220 },   // cool sky-blue
      { temp: 21, hue: 155 },   // mint
      { temp: 28, hue: 12  },   // pastel rose
    ],
  },

  // Example alternative theme — uncomment-and-edit pattern for the future
  'twilight-amber': {
    name: 'Twilight & Amber',
    tokens: {
      bg:        'oklch(0.16 0.04 285)',
      bgSoft:    'oklch(0.20 0.045 285)',
      panel:     'oklch(0.235 0.05 285)',
      panel2:    'oklch(0.265 0.052 285)',
      line:      'oklch(0.38 0.06 285)',
      lineSoft:  'oklch(0.32 0.05 285)',
      ink:       'oklch(0.97 0.01 80)',
      ink2:      'oklch(0.82 0.012 80)',
      ink3:      'oklch(0.66 0.015 80)',
      ink4:      'oklch(0.50 0.018 80)',
      leaf:      'oklch(0.86 0.18 130)',
      leafSoft:  'oklch(0.86 0.18 130 / 0.22)',
      rose:      'oklch(0.86 0.16 350)',
      roseSoft:  'oklch(0.86 0.16 350 / 0.22)',
      amber:     'oklch(0.90 0.16 65)',
      amberSoft: 'oklch(0.90 0.16 65 / 0.22)',
      sky:       'oklch(0.88 0.13 230)',
      skySoft:   'oklch(0.88 0.13 230 / 0.22)',
      clay:      'oklch(0.86 0.16 350)',
      claySoft:  'oklch(0.86 0.16 350 / 0.22)',
      plum:      'oklch(0.86 0.16 310)',
      plumSoft:  'oklch(0.86 0.16 310 / 0.22)',
    },
    // Heatmap gradient: rot → salbei → tief blau → dunkelgrün
    comfortStops: [
      { at: 0.00, L: 0.72, C: 0.16, h: 25  },  // rot
      { at: 0.48, L: 0.80, C: 0.11, h: 140 },  // salbei
      { at: 0.74, L: 0.76, C: 0.16, h: 232 },  // tief blau
      { at: 1.00, L: 0.78, C: 0.17, h: 148 },  // dunkelgrün
    ],
    auroraStops: [
      { temp: 15, hue: 285 },
      { temp: 21, hue: 130 },
      { temp: 28, hue: 50  },
    ],
  },
}

// ─── State ──────────────────────────────────────────────────────────────────

// Module-scoped state so all consumers share the same active theme
const activeThemeName = ref<keyof typeof THEMES>('forest-rose')

export function useTheme() {
  return computed(() => THEMES[activeThemeName.value]!)
}

export function setTheme(name: keyof typeof THEMES) {
  if (THEMES[name]) activeThemeName.value = name
}

export function listThemes(): Array<{ key: string; name: string }> {
  return Object.entries(THEMES).map(([key, t]) => ({ key, name: t.name }))
}

// ─── Helpers used by JS-driven color logic ──────────────────────────────────

function shortHuePath(a: number, b: number): number {
  let dh = b - a
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  return dh
}

/**
 * Returns an OKLch CSS color for a comfort score (0-100), interpolated
 * across the theme's comfortStops. Alpha is also interpolated low→high.
 */
export function comfortColor(score: number | null, theme: Theme): string {
  if (score === null) return 'color-mix(in oklab, var(--ink-4) 14%, transparent)'
  const t = Math.max(0, Math.min(1, score / 100))
  const stops = theme.comfortStops
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    if (t >= a.at && t <= b.at) {
      const localT = (t - a.at) / (b.at - a.at) || 0
      const L = a.L + (b.L - a.L) * localT
      const C = a.C + (b.C - a.C) * localT
      const h = (a.h + shortHuePath(a.h, b.h) * localT + 360) % 360
      const alpha = 0.45 + t * 0.5
      return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${h.toFixed(1)} / ${alpha.toFixed(2)})`
    }
  }
  return 'transparent'
}

/** CSS linear-gradient string for the heatmap legend, built from comfortStops. */
export function comfortGradientCss(theme: Theme): string {
  const stops = theme.comfortStops.map(s => {
    const alpha = 0.45 + s.at * 0.5
    return `oklch(${s.L} ${s.C} ${s.h} / ${alpha.toFixed(2)}) ${(s.at * 100).toFixed(0)}%`
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** Returns an OKLch hue (0..360) for the aurora at a given °C. */
export function auroraHueFor(temp: number | null, theme: Theme): number {
  const stops = theme.auroraStops
  if (temp === null) return stops[Math.floor(stops.length / 2)]!.hue
  if (temp <= stops[0]!.temp) return stops[0]!.hue
  if (temp >= stops[stops.length - 1]!.temp) return stops[stops.length - 1]!.hue
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!
    const b = stops[i + 1]!
    if (temp >= a.temp && temp <= b.temp) {
      const localT = (temp - a.temp) / (b.temp - a.temp) || 0
      return Math.round((a.hue + shortHuePath(a.hue, b.hue) * localT + 360) % 360)
    }
  }
  return stops[0]!.hue
}

/** Mapping from a theme's tokens to CSS variable names. */
const TOKEN_TO_CSS_VAR: Record<keyof ThemeTokens, string> = {
  bg: '--bg', bgSoft: '--bg-soft', panel: '--panel', panel2: '--panel-2',
  line: '--line', lineSoft: '--line-soft',
  ink: '--ink', ink2: '--ink-2', ink3: '--ink-3', ink4: '--ink-4',
  leaf: '--leaf', leafSoft: '--leaf-soft',
  rose: '--rose', roseSoft: '--rose-soft',
  amber: '--amber', amberSoft: '--amber-soft',
  sky: '--sky', skySoft: '--sky-soft',
  clay: '--clay', claySoft: '--clay-soft',
  plum: '--plum', plumSoft: '--plum-soft',
}

/** Build a CSS string `:root { --foo: ...; ... }` for SSR injection. */
export function buildThemeCss(theme: Theme): string {
  const decls = (Object.keys(TOKEN_TO_CSS_VAR) as Array<keyof ThemeTokens>)
    .map(k => `${TOKEN_TO_CSS_VAR[k]}: ${theme.tokens[k]};`)
    .join(' ')
  return `:root { ${decls} }`
}
