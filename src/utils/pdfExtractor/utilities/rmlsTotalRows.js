/**
 * RMLS: parse Total data rows on sales vs active/pending pages.
 */

import { extractNumberFromText } from './extractNumberFromText.js'

export const extractRmlsSalesFromTotalRow = (items) => {
  const totalRows = items
    .filter((i) => i.text === 'Total' && i.y > 400)
    .sort((a, b) => a.y - b.y)

  if (totalRows.length === 0) return null

  const rowItems = items
    .filter((i) => Math.abs(i.y - totalRows[0].y) < 5 && i.text !== 'Total')
    .sort((a, b) => a.x - b.x)

  const nums = rowItems.map((i) => extractNumberFromText(i.text)).filter((n) => n !== null)

  return {
    residentialSales: nums[3] ?? null,
    condoSales: nums[7] ?? null,
    totalSales: nums[8] ?? null
  }
}

export const extractRmlsActiveFromTotalRow = (items) => {
  const totalRows = items
    .filter((i) => i.text === 'Total' && i.y > 400)
    .sort((a, b) => a.y - b.y)

  if (totalRows.length === 0) return null

  const rowItems = items
    .filter((i) => Math.abs(i.y - totalRows[0].y) < 5 && i.text !== 'Total')
    .sort((a, b) => a.x - b.x)

  const nums = rowItems.map((i) => extractNumberFromText(i.text)).filter((n) => n !== null)

  return {
    residentialListings: nums[10] ?? null,
    condoListings: nums[11] ?? null
  }
}
