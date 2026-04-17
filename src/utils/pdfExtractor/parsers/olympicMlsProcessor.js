/**
 * Olympic MLS XLSX processor
 * Reads Excel files from the WCRER Real Estate Trend Indicator format.
 * Key cells:
 *   B4: County name
 *   B7: Month name, E7: Year
 *   Row 43: Totals row
 *     B43-E43: Residential (2-or-less, 3, 4+, Total)
 *     F43-I43: Condo (2-or-less, 3, 4+, Total)
 *     J43: SF Active Listings, K43: Condo Active Listings
 */

import { getQuarter, MONTHS } from '../utilities/dateParsing.js'
import * as XLSX from 'xlsx'

/** Scan column A for a cell containing "totals" (case-insensitive); return that row index. */
const findTotalsRow = (ws) => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let r = 0; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })]
    if (cell && typeof cell.v === 'string' && cell.v.toLowerCase().includes('totals')) {
      return r
    }
  }
  return null
}

/** Read a cell as a number (handles both numeric cells and numeric strings with commas). */
const getCellValue = (ws, row, col) => {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
  if (!cell) return null
  if (typeof cell.v === 'number') return cell.v
  if (typeof cell.v === 'string') {
    const n = parseFloat(cell.v.replace(/,/g, ''))
    return isNaN(n) ? null : n
  }
  return null
}

const getCellString = (ws, row, col) => {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })]
  return cell ? String(cell.v || '').trim() : ''
}

/**
 * Process Olympic MLS XLSX. Reads county, date, and totals from fixed cells (WCRER format).
 */
export const processOlympicMLSXLSX = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]

    const county = getCellString(ws, 3, 1)
    const monthStr = getCellString(ws, 6, 1).toLowerCase()
    const yearVal = getCellValue(ws, 6, 4)

    const month = MONTHS[monthStr]
    const year = yearVal ? Math.round(yearVal) : null

    if (!month || !year) return null
    if (!county) return null

    const quarter = getQuarter(month)
    const mls = 'Olympic MLS'

    const totalsRow = findTotalsRow(ws)
    if (totalsRow === null) return null

    const resSales = getCellValue(ws, totalsRow, 4)
    const condoSales = getCellValue(ws, totalsRow, 8)
    const resListings = getCellValue(ws, totalsRow, 9)
    const condoListings = getCellValue(ws, totalsRow, 10)

    const rows = [
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Residential',
        County: county,
        MLS: mls,
        'Total Listings': resListings,
        'Total Sales': resSales
      },
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Condos',
        County: county,
        MLS: mls,
        'Total Listings': condoListings,
        'Total Sales': condoSales
      },
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Total',
        County: county,
        MLS: mls,
        'Total Listings': (resListings || 0) + (condoListings || 0),
        'Total Sales': (resSales || 0) + (condoSales || 0)
      }
    ]

    return { fileName: file.name, rows }
  } catch {
    return null
  }
}
