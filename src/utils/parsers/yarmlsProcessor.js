/**
 * YARMLS PDF processor
 * flexmls Price Range Report format (same as NEWAMLS but different page size).
 * Extracts data from ***Totals*** row using column position ordering.
 */

import { parseDateFromText, getQuarter } from '../dateParsing.js'
import {
  ensureWorkerConfigured,
  getPdfLib,
  extractNumber
} from '../pdfCore.js'

const getFullPageText = async (page) => {
  const tc = await page.getTextContent()
  return tc.items.map(item => item.str).join(' ')
}

const extractFlexmlsData = async (page) => {
  const viewport = page.getViewport({ scale: 1.0 })
  const ph = viewport.height
  const tc = await page.getTextContent()
  const items = tc.items.filter(i => i.str.trim()).map(i => ({
    text: i.str, x: i.transform[4], y: ph - i.transform[5]
  }))

  const totalsItem = items.find(i => i.text.includes('***Totals***'))
  if (!totalsItem) return null

  const rowItems = items
    .filter(i => Math.abs(i.y - totalsItem.y) < 5 && !i.text.includes('***'))
    .sort((a, b) => a.x - b.x)

  const nums = rowItems.map(i => extractNumber(i.text)).filter(n => n !== null)

  // flexmls Totals row column order (12 columns):
  // 0: SF 2-bed, 1: SF 3-bed, 2: SF 4+, 3: SF Total Sales
  // 4: Condo 2-bed, 5: Condo 3-bed, 6: Condo 4+, 7: Condo Total Sales
  // 8: SF Active Listings, 9: Condo Active Listings
  // 10: SF Pending, 11: Condo Pending
  return {
    residentialSales: nums[3] ?? null,
    condoSales: nums[7] ?? null,
    residentialListings: nums[8] ?? null,
    condoListings: nums[9] ?? null
  }
}

export const processYARMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()
    const pdfjsLib = getPdfLib()
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)

    const allText = await getFullPageText(page)
    const dateInfo = parseDateFromText(allText)
    if (!dateInfo) {
      console.error(`[${file.name}] Could not find date`)
      return null
    }

    const { month, year } = dateInfo
    const quarter = getQuarter(month)

    const data = await extractFlexmlsData(page)
    if (!data) {
      console.error(`[${file.name}] Could not find Totals row`)
      return null
    }

    const county = 'Yakima'
    const mls = 'YARMLS'

    const rows = [
      {
        Year: year, Month: month, Quarter: quarter,
        'House Type': 'Residential', County: county, MLS: mls,
        'Total Listings': data.residentialListings, 'Total Sales': data.residentialSales
      },
      {
        Year: year, Month: month, Quarter: quarter,
        'House Type': 'Condos', County: county, MLS: mls,
        'Total Listings': data.condoListings, 'Total Sales': data.condoSales
      },
      {
        Year: year, Month: month, Quarter: quarter,
        'House Type': 'Total', County: county, MLS: mls,
        'Total Listings': (data.residentialListings || 0) + (data.condoListings || 0),
        'Total Sales': (data.residentialSales || 0) + (data.condoSales || 0)
      }
    ]

    return { fileName: file.name, rows }
  } catch (error) {
    console.error('Error processing YARMLS PDF:', file.name, error)
    return null
  }
}
