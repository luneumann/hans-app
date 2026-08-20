import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { PNG } from 'pngjs'
import { dither, PALETTES, type PaletteName } from './palette'

export const SCREEN_W = 800
export const SCREEN_H = 480

/**
 * Optional font drop-in. resvg can only load fonts from disk, so anything
 * here is picked up automatically; without it we fall back to whatever the
 * host has installed (fine locally, thin on a serverless runtime).
 */
const FONT_DIR = resolve(process.cwd(), 'server/assets/fonts')

/**
 * Rasterise an SVG to a PNG the panel can consume directly: exact palette
 * colours, no alpha, no grey.
 */
export function svgToPng(svg: string, palette: PaletteName): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: SCREEN_W },
    background: 'white',
    font: {
      loadSystemFonts: true,
      fontDirs: existsSync(FONT_DIR) ? [FONT_DIR] : [],
      defaultFontFamily: 'Geist',
    },
  })

  const rendered = resvg.render()
  const rgba = Buffer.from(rendered.pixels)
  dither(rgba, rendered.width, rendered.height, PALETTES[palette])

  const png = new PNG({ width: rendered.width, height: rendered.height })
  rgba.copy(png.data)
  // colorType 2 (truecolour, no alpha) — the panel has no use for an alpha
  // channel and dropping it shrinks what the ESP has to pull over the wire.
  return PNG.sync.write(png, { colorType: 2 })
}
