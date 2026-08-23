/**
 * Colour handling for the e-paper renderer.
 *
 * The panel is an E Ink Spectra 6 (E6): six pigment primaries, no blending,
 * no grey levels. Everything that reaches it must already be one of those six
 * colours, so we quantise here rather than letting the firmware guess.
 */

export type Rgb = [number, number, number]

/**
 * The six canonical Spectra 6 values.
 *
 * ESPHome's `epaper_spi` Spectra-6 driver maps every incoming pixel to the
 * nearest of these (see esphome/esphome#12709 — it deliberately does not use
 * the panel's sub-pixel blending). By dithering to exactly these values here,
 * that mapping becomes a 1:1 pass-through and the halftoning stays ours.
 *
 * Note these are the *addressing* values, not what you will see: the panel
 * renders with pigment, so #FF0000 shows up as a muted brick red and white is
 * closer to newsprint grey. Design against that, not against sRGB.
 */
export const SPECTRA6: Rgb[] = [
  [0, 0, 0],       // black
  [255, 255, 255], // white
  [255, 0, 0],     // red
  [0, 255, 0],     // green
  [0, 0, 255],     // blue
  [255, 255, 0],   // yellow
]

/** Fallback for a plain black-and-white panel (TRMNL OG and friends). */
export const MONO: Rgb[] = [
  [0, 0, 0],
  [255, 255, 255],
]

export const PALETTES = { spectra6: SPECTRA6, mono: MONO }
export type PaletteName = keyof typeof PALETTES

export function isPaletteName(v: string): v is PaletteName {
  return v in PALETTES
}

function nearest(palette: Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    // Squared euclidean distance in sRGB. Good enough for six primaries that
    // are maximally far apart anyway; perceptual spaces buy nothing here.
    const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
    if (d < bestDist) { bestDist = d; best = c }
  }
  return best
}

/**
 * Floyd–Steinberg dithering, in place, over an RGBA buffer.
 *
 * Alpha is composited over white first — the panel has no transparency and an
 * unpainted pixel is paper.
 */
export function dither(rgba: Buffer, width: number, height: number, palette: Rgb[]): void {
  // Error diffusion needs headroom outside 0–255, so work in floats.
  const buf = new Float32Array(width * height * 3)
  // Whether the *source* pixel had any colour in it, decided before diffusion
  // starts. Text is antialiased grey, and letting diffused error steer a grey
  // pixel towards red or yellow speckles the type with stray coloured dots —
  // invisible in a thumbnail, dirt on a 7.3" panel.
  const grey = new Uint8Array(width * height)
  const greyPalette = palette.filter(c => c[0] === c[1] && c[1] === c[2])

  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3] / 255
    const r = rgba[i * 4]     * a + 255 * (1 - a)
    const g = rgba[i * 4 + 1] * a + 255 * (1 - a)
    const b = rgba[i * 4 + 2] * a + 255 * (1 - a)
    buf[i * 3] = r; buf[i * 3 + 1] = g; buf[i * 3 + 2] = b
    grey[i] = Math.abs(r - g) < 8 && Math.abs(g - b) < 8 && Math.abs(r - b) < 8 ? 1 : 0
  }

  const spread = (i: number, er: number, eg: number, eb: number, f: number) => {
    buf[i * 3]     += er * f
    buf[i * 3 + 1] += eg * f
    buf[i * 3 + 2] += eb * f
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2]
      const choices = grey[i] && greyPalette.length ? greyPalette : palette
      const [nr, ng, nb] = nearest(choices, r, g, b)

      rgba[i * 4]     = nr
      rgba[i * 4 + 1] = ng
      rgba[i * 4 + 2] = nb
      rgba[i * 4 + 3] = 255

      const er = r - nr, eg = g - ng, eb = b - nb
      if (x + 1 < width)  spread(i + 1, er, eg, eb, 7 / 16)
      if (y + 1 < height) {
        if (x > 0)         spread(i + width - 1, er, eg, eb, 3 / 16)
        spread(i + width, er, eg, eb, 5 / 16)
        if (x + 1 < width) spread(i + width + 1, er, eg, eb, 1 / 16)
      }
    }
  }
}
