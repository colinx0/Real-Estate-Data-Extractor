/**
 * RMLS: text items with positions for header and table parsing.
 */

export async function getRmlsPageItems(page) {
  const viewport = page.getViewport({ scale: 1.0 })
  const ph = viewport.height
  const tc = await page.getTextContent()
  return tc.items
    .filter((i) => i.str.trim())
    .map((i) => ({
      text: i.str,
      x: i.transform[4],
      y: ph - i.transform[5]
    }))
}
