/**
 * Concatenate all text items from a PDF page into a single string.
 */

export async function getFullPageText(page) {
  const tc = await page.getTextContent()
  return tc.items.map((item) => item.str).join(' ')
}
