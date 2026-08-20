import { epaperPayload, svgToPng } from '../utils/epaper'

/**
 * What the display actually pulls. Dithered to the panel palette, no alpha.
 * `?palette=mono` renders the same layout for a black-and-white panel.
 */
export default defineEventHandler(async (event) => {
  const { svg, palette } = await epaperPayload(event)
  const png = svgToPng(svg, palette)

  setHeader(event, 'content-type', 'image/png')
  setHeader(event, 'content-length', png.length)
  // The panel decides when to refresh; a cached frame would show stale numbers.
  setHeader(event, 'cache-control', 'no-store')
  return png
})
