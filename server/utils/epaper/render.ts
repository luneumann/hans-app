import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Resvg } from '@resvg/resvg-js'
import { PNG } from 'pngjs'
import { dither, PALETTES, type PaletteName } from './palette'

export const SCREEN_W = 800
export const SCREEN_H = 480

/**
 * Fonts have to reach resvg as files on disk — it has no buffer API — and a
 * serverless runtime ships with essentially no fonts installed. So anything
 * under server/assets/fonts is bundled as a Nitro server asset and unpacked
 * into the writable temp directory once per cold start.
 *
 * With no fonts bundled this resolves to an empty list and the renderer falls
 * back to whatever the host has, which is fine locally and thin in the cloud.
 */
let fontPaths: string[] | null = null

async function ensureFonts(): Promise<string[]> {
  if (fontPaths) return fontPaths

  const dir = join(tmpdir(), 'hans-fonts')
  const storage = useStorage('assets:fonts')
  const keys = await storage.getKeys()

  mkdirSync(dir, { recursive: true })
  const paths: string[] = []
  for (const key of keys) {
    const target = join(dir, key.replace(/:/g, '_'))
    if (!existsSync(target)) {
      const bytes = await storage.getItemRaw<Buffer | Uint8Array>(key)
      if (!bytes) continue
      writeFileSync(target, Buffer.from(bytes as Uint8Array))
    }
    paths.push(target)
  }

  fontPaths = paths
  return paths
}

/**
 * Rasterise an SVG to a PNG the panel can consume directly: exact palette
 * colours, no alpha, no grey.
 */
export async function svgToPng(svg: string, palette: PaletteName): Promise<Buffer> {
  const fontFiles = await ensureFonts()

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: SCREEN_W },
    background: 'white',
    font: {
      // Only trust the host's own fonts when we brought none of our own.
      loadSystemFonts: fontFiles.length === 0,
      fontFiles,
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
