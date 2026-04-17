/**
 * Scan PDF pages and return the first page whose text includes the given marker.
 */

import { getFullPageText } from './fullPageText.js'

export async function findPageByContent(pdf, marker) {
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const text = await getFullPageText(page)
    if (text.includes(marker)) return page
  }
  return null
}
