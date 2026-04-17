/**
 * NWMLS-specific: resolve report date from fixed regions or full page text.
 */

import { parseNWMLSDate } from './dateParsing.js'
import { extractTextAtCoordinates } from './pdfRegionText.js'
import { getFullPageText } from './fullPageText.js'

export async function extractNWMLSDateFromPage(page) {
  let dateText = await extractTextAtCoordinates(page, 35.29, 95.04, 60, 5)
  let dateInfo = parseNWMLSDate(dateText)
  if (dateInfo) return dateInfo

  dateText = await extractTextAtCoordinates(page, 30, 93, 70, 7)
  dateInfo = parseNWMLSDate(dateText)
  if (dateInfo) return dateInfo

  const allText = await getFullPageText(page)
  return parseNWMLSDate(allText)
}
