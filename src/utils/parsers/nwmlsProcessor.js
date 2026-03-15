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

/** Extract county from text like "County is 'King'" */
export const parseNWMLSCounty = (text) => {
  if (!text) return null
  const countyPattern = /County is\s+['"]([^'"]+)['"]/i
  const match = text.match(countyPattern)
  if (!match) return null
  return match[1].trim()
}

const getFullPageText = async (page) => {
  const tc = await page.getTextContent()
  return tc.items.map(item => item.str).join(' ')
}

/** Scan PDF pages and return the first one that contains the given text (e.g. "Residential Totals"). */
const findPageByContent = async (pdf, marker) => {
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const text = await getFullPageText(page)
    if (text.includes(marker)) return page
  }
  return null
}

const extractDateFromPage = async (page) => {
  let dateText = await extractTextAtCoordinates(page, 35.29, 95.04, 60, 5)
  let dateInfo = parseNWMLSDate(dateText)
  if (dateInfo) return dateInfo

  dateText = await extractTextAtCoordinates(page, 30, 93, 70, 7)
  dateInfo = parseNWMLSDate(dateText)
  if (dateInfo) return dateInfo

  const allText = await getFullPageText(page)
  return parseNWMLSDate(allText)
}

const extractCountyFromText = (text) => {
  return parseNWMLSCounty(text)
}

/** Get listings and sales from the count row, using "active" and "total" column intersections. */
const extractTableData = async (page) => {
  const listings = extractNumber(await findTableIntersection(page, 'count', 'active', 0, 0, 100, 100))
  const sales = extractNumber(await findTableIntersection(page, 'count', 'total', 0, 0, 100, 100))
  return { listings, sales }
}

/**
 * Process NWMLS PDF. Finds Residential/Condo/Summary pages by content, extracts table data
 * at "count" × "active"/"total" intersections. County is parsed from a later page.
 */
export const processNWMLSPDF = async (file) => {
  try {
    ensureWorkerConfigured()

    const pdfjsLib = getPdfLib()
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument
    if (!getDocument || typeof getDocument !== 'function') {
      throw new Error('PDF.js getDocument function not available')
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await getDocument({ data: arrayBuffer }).promise

    const page1 = await pdf.getPage(1)
    const dateInfo = await extractDateFromPage(page1)
    if (!dateInfo) return null

    const { month, year } = dateInfo
    const quarter = getQuarter(month)
    const mls = 'NWMLS'

    const residentialPage = await findPageByContent(pdf, 'Residential Totals')
    const condoPage = await findPageByContent(pdf, 'Condominium Totals')
    const summaryPage = await findPageByContent(pdf, 'Summary of All Properties')

    // County is usually near the end of the PDF; search from last page backward
    let county = null
    for (let p = pdf.numPages; p >= 1 && !county; p--) {
      const page = await pdf.getPage(p)
      const text = await getFullPageText(page)
      county = extractCountyFromText(text)
    }

    if (!county) return null

    const residential = residentialPage ? await extractTableData(residentialPage) : { listings: null, sales: null }
    const condo = condoPage ? await extractTableData(condoPage) : { listings: null, sales: null }
    const total = summaryPage ? await extractTableData(summaryPage) : { listings: null, sales: null }

    const rows = [
      {
        Year: year, Month: month, Quarter: quarter,
        'House Type': 'Residential', County: county, MLS: mls,
        'Total Listings': residential.listings, 'Total Sales': residential.sales
      },
      {
        Year: year, Month: month, Quarter: quarter,
        'House Type': 'Condos', County: county, MLS: mls,
        'Total Listings': condo.listings, 'Total Sales': condo.sales
      },
      {
        Year: year, Month: month, Quarter: quarter,
        'House Type': 'Total', County: county, MLS: mls,
        'Total Listings': total.listings, 'Total Sales': total.sales
      }
    ]

    return { fileName: file.name, rows }
  } catch {
    return null
  }
}
