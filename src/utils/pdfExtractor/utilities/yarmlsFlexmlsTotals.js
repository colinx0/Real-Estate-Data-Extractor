/**
 * YARMLS flexmls Price Range Report: read ***Totals*** row by column index.
 */

import { extractNumberFromText } from './extractNumberFromText.js'

export async function extractYarmlsFlexmlsTotals(page) {
  const viewport = page.getViewport({ scale: 1.0 })
  const ph = viewport.height
  const tc = await page.getTextContent()
  const items = tc.items
    .filter((i) => i.str.trim())
    .map((i) => ({
      text: i.str,
      x: i.transform[4],
      y: ph - i.transform[5]
    }))

  const totalsItem = items.find((i) => i.text.includes('***Totals***'))
  if (!totalsItem) return null

  const rowItems = items
    .filter((i) => Math.abs(i.y - totalsItem.y) < 5 && !i.text.includes('***'))
    .sort((a, b) => a.x - b.x)

  const nums = rowItems.map((i) => extractNumberFromText(i.text)).filter((n) => n !== null)

  return {
    residentialSales: nums[3] ?? null,
    condoSales: nums[7] ?? null,
    residentialListings: nums[8] ?? null,
    condoListings: nums[9] ?? null
  }
}
