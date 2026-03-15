/**
 * NEWAMLS PDF processor
 */

import { parseDateFromText, getQuarter } from '../dateParsing.js'
import {
  ensureWorkerConfigured,
  getPdfLib,
  extractTextAtCoordinates,
  extractNumber
} from '../pdfCore.js'

/**
 * Process NEWAMLS PDF. Extracts date from footer and listings/sales from fixed coordinates on page 1.
 * Outputs three rows: Residential, Condos, Total.
 */
export const processNEWAMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()

    const pdfjsLib = getPdfLib()
    let getDocument = null
    if (pdfjsLib.getDocument) {
      getDocument = pdfjsLib.getDocument
    } else if (pdfjsLib.default?.getDocument) {
      getDocument = pdfjsLib.default.getDocument
    } else if (typeof pdfjsLib.default === 'function') {
      getDocument = pdfjsLib.default
    }

    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)

    let dateText = await extractTextAtCoordinates(page, 3.09, 72, 80, 5)
    let dateInfo = parseDateFromText(dateText)

    // If the usual coordinates miss the date, try larger areas and finally the whole page
    if (!dateInfo) {
      const largerDateText = await extractTextAtCoordinates(page, 0, 70, 100, 30)
      const largerDateInfo = parseDateFromText(largerDateText)

      if (largerDateInfo) {
        dateInfo = largerDateInfo
        dateText = largerDateText
      } else {
        const allTextContent = await page.getTextContent()
        const allText = allTextContent.items.map(item => item.str).join(' ')
        const allTextDateInfo = parseDateFromText(allText)

        if (allTextDateInfo) {
          dateInfo = allTextDateInfo
        } else {
          return null
        }
      }
    }

    const { month, year } = dateInfo
    const quarter = getQuarter(month)

    // All coordinates are percentages of page size (left, top, width, height)
    const residentialListingsText = await extractTextAtCoordinates(page, 86.47, 44.83, 2, 1.5)
    const residentialListings = extractNumber(residentialListingsText)

    const residentialSalesText = await extractTextAtCoordinates(page, 70.17, 60.92, 1.5, 1.5)
    const residentialSales = extractNumber(residentialSalesText)

    const condoListingsText = await extractTextAtCoordinates(page, 90.45, 44.83, 1.5, 1.5)
    const condoListings = extractNumber(condoListingsText)

    const condoSalesText = await extractTextAtCoordinates(page, 73.24, 60.92, 2, 1.5)
    const condoSales = extractNumber(condoSalesText)

    const county = 'Stevens, Ferry, Pend Oreille'
    const mls = 'NEWAMLS'

    const rows = [
      {
        Year: year,
        Month: month,
        Quarter: quarter,
        'House Type': 'Residential',
        County: county,
        MLS: mls,
        'Total Listings': residentialListings,
        'Total Sales': residentialSales
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
        'Total Listings': (residentialListings || 0) + (condoListings || 0),
        'Total Sales': (residentialSales || 0) + (condoSales || 0)
      }
    ]

    return {
      fileName: file.name,
      rows,
      rawData: {
        dateText,
        residentialListingsText,
        residentialSalesText,
        condoListingsText,
        condoSalesText
      }
    }
  } catch {
    return null
  }
}
