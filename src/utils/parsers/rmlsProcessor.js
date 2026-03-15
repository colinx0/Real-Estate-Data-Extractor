/**
 * RMLS PDF processor
 * Multi-county PDF with sales pages and active/pending pages per county.
 * Counties: Clark, Klickitat, Skamania (in the test data)
 *
 * Page types by header:
 *   "Home Sales Report: Total Residential" -> sales data
 *   "Home Active/Pending Report" -> active listing data
 *
 * Sales Total row (9 numeric columns):
 *   0-2: Res by bedroom, 3: Res Total, 4-6: Condo by bedroom, 7: Condo Total, 8: Full Units
 *
 * Active/Pending Total row (12 numeric columns):
 *   Groups of 4: (PendRes, PendCondo, ActRes, ActCondo) x [New, Existing, Total]
 *   Total Active Res = index 10, Total Active Condo = index 11
 */

import { getQuarter } from '../dateParsing.js'
import {
  ensureWorkerConfigured,
  getPdfLib,
  extractNumber
} from '../pdfCore.js'

const MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
}

const getPageItems = async (page) => {
  const viewport = page.getViewport({ scale: 1.0 })
  const ph = viewport.height
  const tc = await page.getTextContent()
  return tc.items.filter(i => i.str.trim()).map(i => ({
    text: i.str, x: i.transform[4], y: ph - i.transform[5]
  }))
}

const getFullPageText = async (page) => {
  const tc = await page.getTextContent()
  return tc.items.map(i => i.str).join(' ')
}

/** Look for "X County Washington" in the top of the page (low Y values). */
const parseCountyFromHeader = (items) => {
  for (const item of items.filter(i => i.y < 120).sort((a, b) => a.y - b.y)) {
    const match = item.text.match(/^(.+?)\s+County\s+Washington/i)
    if (match) return match[1].trim()
  }
  return null
}

/** Look for "Month YYYY" in the header area. */
const parseDateFromHeader = (items) => {
  for (const item of items.filter(i => i.y < 100)) {
    const m = item.text.match(/(\w+)\s+(\d{4})/)
    if (m && MONTHS[m[1].toLowerCase()]) {
      return { month: MONTHS[m[1].toLowerCase()], year: parseInt(m[2], 10) }
    }
  }
  return null
}

/** Find the "Total" row on a sales page and parse its 9 numeric columns. */
const extractSalesFromTotalRow = (items) => {
  // y > 400 skips header "Total" labels; we want the data Total row near the bottom
  const totalRows = items
    .filter(i => i.text === 'Total' && i.y > 400)
    .sort((a, b) => a.y - b.y)

  if (totalRows.length === 0) return null

  const rowItems = items
    .filter(i => Math.abs(i.y - totalRows[0].y) < 5 && i.text !== 'Total')
    .sort((a, b) => a.x - b.x)

  const nums = rowItems.map(i => extractNumber(i.text)).filter(n => n !== null)

  // Sales row: [res2bed, res3bed, res4+, resTotal, condo2bed, condo3bed, condo4+, condoTotal, fullUnits]
  return {
    residentialSales: nums[3] ?? null,
    condoSales: nums[7] ?? null,
    totalSales: nums[8] ?? null
  }
}

/** Find the "Total" row on an active/pending page and parse listings from columns 10 and 11. */
const extractActiveFromTotalRow = (items) => {
  // Same as sales: y > 400 to get the data row, not header
  const totalRows = items
    .filter(i => i.text === 'Total' && i.y > 400)
    .sort((a, b) => a.y - b.y)

  if (totalRows.length === 0) return null

  const rowItems = items
    .filter(i => Math.abs(i.y - totalRows[0].y) < 5 && i.text !== 'Total')
    .sort((a, b) => a.x - b.x)

  const nums = rowItems.map(i => extractNumber(i.text)).filter(n => n !== null)

  // Active row: 3 groups of 4 [PendRes, PendCondo, ActRes, ActCondo] for New, Existing, Total
  // Total Active Res = index 10, Total Active Condo = index 11
  return {
    residentialListings: nums[10] ?? null,
    condoListings: nums[11] ?? null
  }
}

/**
 * Process RMLS PDF. Multi-county; each county has sales + active/pending pages.
 * Extracts Residential, Condos, Total per county.
 */
export const processRMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()
    const pdfjsLib = getPdfLib()
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise

    const countyData = new Map()
    let dateInfo = null

    // One pass over all pages: identify sales vs active pages per county, extract totals
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p)
      const text = await getFullPageText(page)
      const items = await getPageItems(page)

      if (!dateInfo) dateInfo = parseDateFromHeader(items)

      const isSalesPage = text.includes('Home Sales Report: Total Residential')
      const isActivePage = text.includes('Home Active/Pending Report')
      if (!isSalesPage && !isActivePage) continue // skip non-data pages

      const county = parseCountyFromHeader(items)
      if (!county) continue

      if (!countyData.has(county)) {
        countyData.set(county, { sales: null, active: null })
      }

      if (isSalesPage) {
        countyData.get(county).sales = extractSalesFromTotalRow(items)
      } else if (isActivePage) {
        countyData.get(county).active = extractActiveFromTotalRow(items)
      }
    }

    if (!dateInfo) return null

    const { month, year } = dateInfo
    const quarter = getQuarter(month)
    const mls = 'RMLS'
    const allRows = []

    // Emit Residential, Condos, Total for each county we found
    for (const [county, data] of countyData.entries()) {
      const resListings = data.active?.residentialListings ?? null
      const condoListings = data.active?.condoListings ?? null
      const resSales = data.sales?.residentialSales ?? null
      const condoSales = data.sales?.condoSales ?? null

      allRows.push(
        {
          Year: year, Month: month, Quarter: quarter,
          'House Type': 'Residential', County: county, MLS: mls,
          'Total Listings': resListings, 'Total Sales': resSales
        },
        {
          Year: year, Month: month, Quarter: quarter,
          'House Type': 'Condos', County: county, MLS: mls,
          'Total Listings': condoListings, 'Total Sales': condoSales
        },
        {
          Year: year, Month: month, Quarter: quarter,
          'House Type': 'Total', County: county, MLS: mls,
          'Total Listings': (resListings || 0) + (condoListings || 0),
          'Total Sales': (resSales || 0) + (condoSales || 0)
        }
      )
    }

    return { fileName: file.name, rows: allRows }
  } catch {
    return null
  }
}