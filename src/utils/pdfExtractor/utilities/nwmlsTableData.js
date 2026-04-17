/**
 * NWMLS-specific: listings and sales from the count row (active / total column intersections).
 */

import { findTableIntersection } from './pdfTableIntersection.js'
import { extractNumberFromText } from './extractNumberFromText.js'

export async function extractNWMLSTableData(page) {
  const listings = extractNumberFromText(
    await findTableIntersection(page, 'count', 'active', 0, 0, 100, 100)
  )
  const sales = extractNumberFromText(
    await findTableIntersection(page, 'count', 'total', 0, 0, 100, 100)
  )
  return { listings, sales }
}
