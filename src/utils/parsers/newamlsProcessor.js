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
 * Process NEWAMLS PDF and extract data
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
    console.log(`[${file.name}] Extracted date text:`, dateText)

    let dateInfo = parseDateFromText(dateText)

    if (!dateInfo) {
      console.error(`Could not parse date from PDF: ${file.name}`)
      console.error(`Extracted text was: "${dateText}"`)

      console.log('Attempting to extract date from larger area (bottom 30% of page)...')
      const largerDateText = await extractTextAtCoordinates(page, 0, 70, 100, 30)
      console.log(`Text from larger area:`, largerDateText)
      const largerDateInfo = parseDateFromText(largerDateText)

      if (largerDateInfo) {
        console.log('Successfully parsed date from larger area')
        dateInfo = largerDateInfo
        dateText = largerDateText
      } else {
        console.log('Attempting to extract all text from page to find date...')
        const allTextContent = await page.getTextContent()
        const allText = allTextContent.items.map(item => item.str).join(' ')
        console.log('Sample of all page text (first 500 chars):', allText.substring(0, 500))
        const allTextDateInfo = parseDateFromText(allText)

        if (allTextDateInfo) {
          console.log('Successfully parsed date from all page text')
          dateInfo = allTextDateInfo
        } else {
          console.error('Could not find date in PDF. Please check the PDF format.')
          console.error('The date should be in format: "Month Day, Year" (e.g., "October 21, 2025")')
          return null
        }
      }
    }

    const { month, year } = dateInfo
    const quarter = getQuarter(month)

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
  } catch (error) {
    console.error('Error processing PDF:', file.name, error)
    return null
  }
}
