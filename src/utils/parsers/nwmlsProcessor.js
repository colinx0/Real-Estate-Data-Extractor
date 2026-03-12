/**
 * NWMLS PDF processor and parsing utilities
 */

import { parseNWMLSDate, getQuarter } from '../dateParsing.js'
import {
  ensureWorkerConfigured,
  getPdfLib,
  extractTextAtCoordinates,
  findTableIntersection,
  extractNumber
} from '../pdfCore.js'

/**
 * Parse county from NWMLS format text
 * Example: "County is 'Chelan'"
 * Returns: "Chelan"
 */
export const parseNWMLSCounty = (text) => {
  if (!text) return null

  const countyPattern = /County is\s+['"]([^'"]+)['"]/i
  const match = text.match(countyPattern)
  if (!match) return null

  return match[1].trim()
}

/**
 * Process NWMLS PDF and extract data
 */
export const processNWMLSPDF = async (file) => {
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

    const page1 = await pdf.getPage(1)
    let dateText = await extractTextAtCoordinates(page1, 35.29, 95.04, 60, 5)
    console.log(`[${file.name}] Extracted date text:`, dateText)

    let dateInfo = parseNWMLSDate(dateText)

    if (!dateInfo) {
      console.error(`Could not parse date from PDF: ${file.name}`)
      console.error(`Extracted text was: "${dateText}"`)

      console.log('Attempting to extract date from larger area (bottom of page 1)...')
      const largerDateText = await extractTextAtCoordinates(page1, 30, 93, 70, 7)
      console.log(`Text from larger area:`, largerDateText)
      const largerDateInfo = parseNWMLSDate(largerDateText)

      if (largerDateInfo) {
        console.log('Successfully parsed date from larger area')
        dateInfo = largerDateInfo
        dateText = largerDateText
      } else {
        console.log('Attempting to extract all text from bottom of page 1 to find date...')
        const allTextContent = await page1.getTextContent()
        const allText = allTextContent.items.map(item => item.str).join(' ')
        console.log('Sample of all page text (last 500 chars):', allText.substring(Math.max(0, allText.length - 500)))
        const allTextDateInfo = parseNWMLSDate(allText)

        if (allTextDateInfo) {
          console.log('Successfully parsed date from all page text')
          dateInfo = allTextDateInfo
        } else {
          console.error('Could not find date in PDF. Please check the PDF format.')
          console.error('The date should be in format: "Listings as of MM/DD/YYYY"')
          return null
        }
      }
    }

    const { month, year } = dateInfo
    const quarter = getQuarter(month)

    const page3 = await pdf.getPage(3)
    let countyText = await extractTextAtCoordinates(page3, 13.73, 91.41, 40, 5)
    console.log(`[${file.name}] Extracted county text:`, countyText)

    let county = parseNWMLSCounty(countyText)

    if (!county) {
      console.error(`Could not parse county from PDF: ${file.name}`)
      console.error(`Extracted text was: "${countyText}"`)

      console.log('Attempting to extract county from larger area (bottom of page 3)...')
      const largerCountyText = await extractTextAtCoordinates(page3, 10, 89, 50, 10)
      console.log(`Text from larger area:`, largerCountyText)
      const largerCounty = parseNWMLSCounty(largerCountyText)

      if (largerCounty) {
        console.log('Successfully parsed county from larger area')
        county = largerCounty
        countyText = largerCountyText
      } else {
        console.log('Attempting to extract all text from page 3 to find county...')
        const allTextContent = await page3.getTextContent()
        const allText = allTextContent.items.map(item => item.str).join(' ')
        console.log('Sample of all page text (first 500 chars):', allText.substring(0, 500))
        const allTextCounty = parseNWMLSCounty(allText)

        if (allTextCounty) {
          console.log('Successfully parsed county from all page text')
          county = allTextCounty
        } else {
          console.error('Could not find county in PDF. Please check the PDF format.')
          console.error('The county should be in format: "County is \'CountyName\'"')
          return null
        }
      }
    }

    const mls = 'NWMLS'

    let residentialListingsText = await findTableIntersection(page1, 'count', 'active', 0, 0, 100, 100)
    if (!residentialListingsText) {
      console.log('Trying full page search for residential listings...')
      residentialListingsText = await findTableIntersection(page1, 'count', 'active', 0, 0, 100, 100)
    }
    const residentialListings = extractNumber(residentialListingsText)
    console.log(`[${file.name}] Residential listings (count/active):`, residentialListingsText, '->', residentialListings)

    let residentialSalesText = await findTableIntersection(page1, 'count', 'total', 0, 0, 100, 100)
    if (!residentialSalesText) {
      console.log('Trying full page search for residential sales...')
      residentialSalesText = await findTableIntersection(page1, 'count', 'total', 0, 0, 100, 100)
    }
    const residentialSales = extractNumber(residentialSalesText)
    console.log(`[${file.name}] Residential sales (count/total):`, residentialSalesText, '->', residentialSales)

    const page2 = await pdf.getPage(2)
    let condoListingsText = await findTableIntersection(page2, 'count', 'active', 0, 0, 100, 100)
    if (!condoListingsText) {
      console.log('Trying full page search for condo listings...')
      condoListingsText = await findTableIntersection(page2, 'count', 'active', 0, 0, 100, 100)
    }
    const condoListings = extractNumber(condoListingsText)
    console.log(`[${file.name}] Condo listings (count/active):`, condoListingsText, '->', condoListings)

    let condoSalesText = await findTableIntersection(page2, 'count', 'total', 0, 0, 100, 100)
    if (!condoSalesText) {
      console.log('Trying full page search for condo sales...')
      condoSalesText = await findTableIntersection(page2, 'count', 'total', 0, 0, 100, 100)
    }
    const condoSales = extractNumber(condoSalesText)
    console.log(`[${file.name}] Condo sales (count/total):`, condoSalesText, '->', condoSales)

    let totalListingsText = await findTableIntersection(page3, 'count', 'active', 0, 0, 100, 100)
    if (!totalListingsText) {
      console.log('Trying full page search for total listings...')
      totalListingsText = await findTableIntersection(page3, 'count', 'active', 0, 0, 100, 100)
    }
    const totalListings = extractNumber(totalListingsText)
    console.log(`[${file.name}] Total listings (count/active):`, totalListingsText, '->', totalListings)

    let totalSalesText = await findTableIntersection(page3, 'count', 'total', 0, 0, 100, 100)
    if (!totalSalesText) {
      console.log('Trying full page search for total sales...')
      totalSalesText = await findTableIntersection(page3, 'count', 'total', 0, 0, 100, 100)
    }
    const totalSales = extractNumber(totalSalesText)
    console.log(`[${file.name}] Total sales (count/total):`, totalSalesText, '->', totalSales)

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
        'Total Listings': totalListings,
        'Total Sales': totalSales
      }
    ]

    return {
      fileName: file.name,
      rows,
      rawData: {
        dateText,
        countyText,
        residentialListingsText,
        residentialSalesText,
        condoListingsText,
        condoSalesText,
        totalListingsText,
        totalSalesText
      }
    }
  } catch (error) {
    console.error('Error processing NWMLS PDF:', file.name, error)
    return null
  }
}
